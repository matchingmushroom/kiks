"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import { Sale } from "@/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { doc, onSnapshot, getDoc, addDoc, collection, updateDoc, Timestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { restoreFifo } from "@/lib/fifo";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw, X, Save } from "lucide-react";
import Link from "next/link";

export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReturn, setShowReturn] = useState(false);
  const [returnItems, setReturnItems] = useState<Record<number, number>>({});
  const [returnType, setReturnType] = useState<"refund" | "exchange">("refund");
  const [saving, setSaving] = useState(false);
  const [archived, setArchived] = useState(false);
  const { settings } = useShopSettings();

  useEffect(() => {
    const id = params?.id as string;
    if (!id) return;
    setLoading(true);
    const unsub = onSnapshot(doc(db, "sales", id), (snap) => {
      if (snap.exists()) {
        setSale({ id: snap.id, ...snap.data() } as Sale);
        setArchived(false);
        setLoading(false);
      } else if (settings.gasWebhookUrl) {
        fetch(settings.gasWebhookUrl, {
          method: "POST",
          body: JSON.stringify({ action: "queryArchivedDoc", collection: "sales", id }),
        })
          .then((r) => r.json())
          .then((result) => {
            if (result.status === "ok" && result.doc) {
              setSale(result.doc as Sale);
              setArchived(true);
            }
            setLoading(false);
          })
          .catch(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }, () => {
      if (settings.gasWebhookUrl) {
        fetch(settings.gasWebhookUrl, {
          method: "POST",
          body: JSON.stringify({ action: "queryArchivedDoc", collection: "sales", id }),
        })
          .then((r) => r.json())
          .then((result) => {
            if (result.status === "ok" && result.doc) {
              setSale(result.doc as Sale);
              setArchived(true);
            }
            setLoading(false);
          })
          .catch(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [params?.id, settings.gasWebhookUrl]);

  const openReturn = () => {
    if (!sale) return;
    const initial: Record<number, number> = {};
    sale.items?.forEach((_, i) => { initial[i] = 0; });
    setReturnItems(initial);
    setReturnType("refund");
    setShowReturn(true);
  };

  const totalReturnValue = sale?.items?.reduce((sum, item, i) => {
    const qty = returnItems[i] || 0;
    return sum + qty * item.unitPrice;
  }, 0) || 0;

  const retTotal = sale?.totalAmount || 0;
  const safeRetTotal = Math.max(retTotal, 1);
  const retCashRatio = Math.min(1, (sale?.payment?.receivedAmount || 0) / safeRetTotal);
  const retCreditRatio = Math.min(1, (sale?.payment?.balanceDue || 0) / safeRetTotal);
  const refundAmount = totalReturnValue * retCashRatio;

  const handleReturn = async () => {
    if (!sale || totalReturnValue <= 0) return;
    setSaving(true);
    try {
      for (let i = 0; i < (sale.items?.length || 0); i++) {
        const qty = returnItems[i] || 0;
        if (qty <= 0) continue;
        const item = sale.items[i];

        const productRef = doc(db, "products", item.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const currentStock = productSnap.data().quantityInStock || 0;
          await updateDoc(productRef, {
            quantityInStock: currentStock + qty,
            updatedAt: Timestamp.fromDate(new Date()),
          });
        }

        await restoreFifo(item.productId, qty, item.costPriceAtSale || 0);
        await addDoc(collection(db, "inventoryLogs"), {
          productId: item.productId,
          changeType: "sales_return",
          quantityChange: qty,
          reason: `Return from sale${returnType === "exchange" ? " (exchange)" : ""}`,
          performedBy: user?.uid || "",
          createdAt: Timestamp.fromDate(new Date()),
        });
      }

      if (returnType === "refund") {
        await addDoc(collection(db, "accountTransactions"), {
          accountId: "cash_in_hand",
          type: "debit",
          amount: refundAmount,
          description: `Sales return refund: ${sale.customer?.name}`,
          date: Timestamp.fromDate(new Date()),
          referenceType: "sales_return",
          referenceId: sale.id,
          recordedBy: user?.uid || "",
          createdAt: Timestamp.fromDate(new Date()),
        });

        // Adjust debtor balance for the credit portion
        const creditPortion = totalReturnValue * retCreditRatio;
        if (creditPortion > 0) {
          const debtorSnap = await getDocs(query(collection(db, "debtors"), where("orderIds", "array-contains", sale.id)));
          for (const d of debtorSnap.docs) {
            const data = d.data();
            const newBalance = Math.max(0, (data.balanceDue || 0) - creditPortion);
            await updateDoc(doc(db, "debtors", d.id), {
              balanceDue: newBalance,
              amountPaid: (data.amountPaid || 0) - refundAmount,
              totalAmount: Math.max(0, (data.totalAmount || 0) - totalReturnValue),
              status: newBalance <= 0 ? "cleared" : "active",
              updatedAt: Timestamp.fromDate(new Date()),
            });
          }
        }

        // Update linked invoice
        const invSnap = await getDocs(query(collection(db, "invoices"), where("relatedSaleId", "==", sale.id)));
        for (const inv of invSnap.docs) {
          const invData = inv.data();
          const newReceived = Math.max(0, (invData.cashReceived || 0) - refundAmount);
          const newBalance = Math.max(0, (invData.balanceDue || 0) - creditPortion);
          await updateDoc(inv.ref, {
            cashReceived: newReceived,
            balanceDue: newBalance,
            paymentStatus: newBalance <= 0 ? "full" : "partial",
            totalAmount: Math.max(0, (invData.totalAmount || 0) - totalReturnValue),
            updatedAt: Timestamp.fromDate(new Date()),
          });
        }
      }

      await updateDoc(doc(db, "sales", sale.id), {
        returned: true,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      setShowReturn(false);

      if (returnType === "exchange") {
        router.push(`/admin/sales?returnDiscount=${totalReturnValue}&returnCustomer=${encodeURIComponent(sale.customer?.name || "")}&returnPhone=${encodeURIComponent(sale.customer?.phone || "")}`);
      } else {
        alert(`Return processed. Refund amount: ${formatCurrency(refundAmount)}`);
      }
    } catch (e) {
      console.error("Return failed", e);
    }
    setSaving(false);
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <button onClick={() => router.push("/admin/sales")}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Sales
        </button>

        {loading ? (
          <LoadingSpinner />
        ) : !sale ? (
          <p className="text-muted-foreground text-center py-12">Sale not found.</p>
        ) : (
          <>
            <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border bg-muted/20">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold text-secondary">Sale Details</h1>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      sale.payment?.balanceDue > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                    }`}>
                      {sale.payment?.balanceDue > 0 ? `Due ${formatCurrency(sale.payment.balanceDue)}` : "Paid"}
                    </span>
                    {sale.returned && (
                      <span className="text-xs px-3 py-1 rounded-full font-medium bg-yellow-50 text-yellow-700">
                        Returned
                      </span>
                    )}
                    {archived && (
                      <span className="text-xs px-3 py-1 rounded-full font-medium bg-gray-100 text-gray-600">
                        Archived
                      </span>
                    )}
                    <Button size="sm" variant="outline" onClick={openReturn} disabled={sale.returned}>
                      <RotateCcw className="h-3.5 w-3.5" /> Return
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Customer</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> <span className="font-medium ml-1">{sale.customer?.name}</span></div>
                    <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium ml-1">{sale.customer?.phone}</span></div>
                    {sale.customer?.address && <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="font-medium ml-1">{sale.customer.address}</span></div>}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Items</h3>
                  <div className="border border-border rounded-lg divide-y divide-border">
                    <div className="flex items-center px-4 py-2 text-xs text-muted-foreground bg-muted/20 font-medium">
                      <span className="flex-1">Product</span>
                      <span className="w-16 text-center">Qty</span>
                      <span className="w-24 text-right">Unit Price</span>
                      <span className="w-24 text-right">Subtotal</span>
                    </div>
                    {sale.items?.map((item, i) => (
                      <div key={i} className="flex items-center px-4 py-2.5 text-sm">
                        <span className="flex-1">{item.productName}</span>
                        <span className="w-16 text-center text-muted-foreground">×{item.quantity}</span>
                        <span className="w-24 text-right">{formatCurrency(item.unitPrice)}</span>
                        <span className="w-24 text-right font-medium">{formatCurrency(item.subtotal || item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-3 text-sm font-bold bg-muted/10">
                      <span>Total</span>
                      <span>{formatCurrency(sale.totalAmount || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Payment</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="font-medium capitalize">{sale.payment?.method || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Received</span><span className="font-medium">{formatCurrency(sale.payment?.receivedAmount || 0)}</span></div>
                      {sale.payment?.balanceDue > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Balance Due</span><span className="font-medium text-red-600">{formatCurrency(sale.payment.balanceDue)}</span></div>}
                      {sale.discountAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-medium text-red-500">-{formatCurrency(sale.discountAmount)}</span></div>}
                      <div className="flex justify-between pt-1 border-t border-border"><span className="font-bold">Final Amount</span><span className="font-bold">{formatCurrency(sale.finalAmount)}</span></div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Warranty</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Period</span><span className="font-medium">{sale.warranty?.period || "None"}</span></div>
                      {sale.warranty?.terms && <div className="flex justify-between"><span className="text-muted-foreground">Terms</span><span className="font-medium">{sale.warranty.terms}</span></div>}
                    </div>
                  </div>
                </div>

                {sale.couponIssued && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Coupon Issued</h3>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                      <span className="font-mono font-medium text-blue-700">{sale.couponIssued.code}</span>
                      <span className="text-blue-500">•</span>
                      <span className="text-blue-600">-{formatCurrency(sale.couponIssued.discountValue)}</span>
                    </div>
                  </div>
                )}

                {sale.notes && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Notes</h3>
                    <p className="text-sm bg-muted/20 p-3 rounded-lg">{sale.notes}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-4 border-t border-border">
                  <p>Sale Date: {formatDateTime(sale.saleDate)}</p>
                  <p>Recorded By: {(sale as any).recordedByName || sale.recordedBy || "—"}</p>
                </div>
              </div>
            </div>

            {showReturn && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowReturn(false)}>
                <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-secondary">Process Return</h2>
                    <button onClick={() => setShowReturn(false)} className="p-1 hover:bg-muted rounded">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-3 mb-4">
                    {sale.items?.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-secondary truncate">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">Sold: {item.quantity} × {formatCurrency(item.unitPrice)}</p>
                        </div>
                        <input type="number" min="0" max={item.quantity}
                          value={returnItems[i] || 0}
                          onChange={(e) => {
                            const val = Math.min(item.quantity, Math.max(0, Number(e.target.value)));
                            setReturnItems({ ...returnItems, [i]: val });
                          }}
                          className="w-16 px-2 py-1 border border-border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="returnType" checked={returnType === "refund"}
                        onChange={() => setReturnType("refund")} className="text-primary" />
                      Refund
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="returnType" checked={returnType === "exchange"}
                        onChange={() => setReturnType("exchange")} className="text-primary" />
                      Exchange (discount on new bill)
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="text-sm space-y-0.5">
                      {returnType === "refund" && retCashRatio < 1 && (
                        <p className="text-xs text-muted-foreground">Items worth {formatCurrency(totalReturnValue)} · Paid {Math.round(retCashRatio * 100)}%</p>
                      )}
                      <p>Refund Amount: <span className="font-bold text-secondary">{formatCurrency(refundAmount)}</span></p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => setShowReturn(false)} variant="outline">Cancel</Button>
                      <Button onClick={handleReturn} disabled={saving || totalReturnValue <= 0} variant="accent">
                        <Save className="h-4 w-4" /> {saving ? "Processing..." : returnType === "refund" ? "Process Refund" : "Process Exchange"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
