"use client";

import { useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit, useDataCache } from "@/hooks/useFirestore";
import { Product, Coupon } from "@/types";
import { formatCurrency, formatNumber, generateCouponCode } from "@/lib/utils";
import { toBS } from "@/lib/nepaliDate";
import { generateId } from "@/lib/id-generator";
import { resolveAccount } from "@/lib/accounts";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  addDoc, collection, updateDoc, doc, setDoc, Timestamp, getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Search, X, Minus, Plus, Trash2, CheckCircle, Percent, Tag,
} from "lucide-react";

interface LineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

type PaymentMode = "cash" | "credit" | "partial";

export default function POSPage() {
  const { refreshCollection } = useDataCache();
  const { user, profile } = useAuth();
  const { data: products } = useFirestore<Product>("products", {
    constraints: [orderBy("name", "asc"), limit(500)],
    realtime: false, cache: true,
  });
  const { data: allCoupons } = useFirestore<Coupon>("coupons", {
    constraints: [orderBy("createdAt", "desc"), limit(100)],
    realtime: false, cache: true,
  });

  const [walkin, setWalkin] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [showCouponPopup, setShowCouponPopup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return [];
    const q = productSearch.toLowerCase();
    return activeProducts.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)
    ).slice(0, 10);
  }, [activeProducts, productSearch]);

  const totalAmount = useMemo(() =>
    items.reduce((sum, i) => sum + i.subtotal, 0),
  [items]);

  const discount = useMemo(() => {
    if (!selectedCoupon) return 0;
    return selectedCoupon.discountType === "percentage"
      ? Math.min((totalAmount * selectedCoupon.discountValue) / 100, selectedCoupon.maxDiscount || Infinity)
      : selectedCoupon.discountValue;
  }, [selectedCoupon, totalAmount]);

  const finalAmount = Math.max(0, totalAmount - discount);
  const balanceDue = paymentMode === "credit" ? finalAmount : paymentMode === "partial" ? Math.max(0, finalAmount - receivedAmount) : 0;

  const activeCoupons = useMemo(() =>
    allCoupons.filter((c) => c.isActive && c.couponType !== "For Confirmed Buyers"),
  [allCoupons]);

  const availableStock = (productId: string): number => {
    const p = activeProducts.find((p) => p.id === productId);
    return p?.quantityInStock ?? 0;
  };

  const addItem = (product: Product) => {
    const stock = product.quantityInStock ?? 0;
    if (stock <= 0) return;
    const existing = items.find((i) => i.productId === product.id);
    if (existing) {
      const newQty = Math.min(existing.quantity + 1, stock);
      setItems(items.map((i) =>
        i.productId === product.id
          ? { ...i, quantity: newQty, subtotal: newQty * i.unitPrice }
          : i
      ));
      return;
    }
    setItems([...items, {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPrice: product.price,
      subtotal: product.price,
    }]);
    setProductSearch("");
  };

  const updateItem = (index: number, field: "quantity" | "unitPrice", value: number) => {
    if (value < 0) value = 0;
    if (field === "quantity") {
      const stock = availableStock(items[index].productId);
      value = Math.min(value, stock);
    }
    setItems(items.map((item, i) => {
      if (i !== index) return item;
      const qty = field === "quantity" ? value : item.quantity;
      const price = field === "unitPrice" ? value : item.unitPrice;
      return { ...item, quantity: qty, unitPrice: price, subtotal: qty * price };
    }));
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    if (selectedCoupon) setSelectedCoupon(null);
  };

  const clearForm = () => {
    setItems([]);
    setProductSearch("");
    setSelectedCoupon(null);
    setReceivedAmount(0);
    setPaymentMode("cash");
    setCustomerName("");
    setCustomerPhone("");
    setWalkin(true);
  };

  const handleSave = async () => {
    if (items.length === 0) return;
    setSaving(true);
    setError("");
    try {
      for (const item of items) {
        const product = activeProducts.find((p) => p.id === item.productId);
        const stock = product?.quantityInStock ?? 0;
        if (item.quantity > stock) {
          throw new Error(`Insufficient stock for ${item.productName}. Available: ${stock}`);
        }
      }

      const cName = walkin ? "Walk-in Customer" : customerName;
      const cPhone = walkin ? "" : customerPhone;
      const saleType = balanceDue > 0 ? (receivedAmount > 0 ? "partial" : "credit") : "cash";

      const saleId = await generateId("SALE");
      await setDoc(doc(db, "sales", saleId), {
        orderId: "",
        saleType,
        customer: { name: cName, phone: cPhone, address: "", email: "" },
        items: items.map((item) => {
          const product = activeProducts.find((p) => p.id === item.productId);
          return {
            productId: item.productId, productName: item.productName, sku: product?.sku || "",
            quantity: item.quantity, unitPrice: item.unitPrice, weight: product?.weight || 0,
            purity: product?.purity || "", makingCharge: product?.makingCharge || 0,
            subtotal: item.subtotal, costPriceAtSale: product?.costPrice || 0,
          };
        }),
        totalAmount,
        discountAmount: discount,
        finalAmount,
        payment: { method: "cash", receivedAmount, balanceDue },
        warranty: { period: "", terms: "", startDate: Timestamp.fromDate(new Date()), endDate: Timestamp.fromDate(new Date()) },
        couponIssued: null,
        notes: walkin ? "POS sale - Walk-in" : "POS sale",
        saleDate: Timestamp.fromDate(new Date()),
        recordedBy: user?.uid || "",
        recordedByName: profile?.displayName || "",
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });

      let savedInvId: string | null = null;
      try {
        const now = new Date();
        const bs = toBS(now);
        const year = bs.month >= 4 ? bs.year : bs.year - 1;
        const invCounterDoc = doc(db, "counters", `invoices_${year}`);
        const invCounterSnap = await getDoc(invCounterDoc);
        let invSeq = 1;
        if (invCounterSnap.exists()) invSeq = (invCounterSnap.data().lastNumber || 0) + 1;
        await setDoc(invCounterDoc, { lastNumber: invSeq, year }, { merge: true });
        const invoiceNumber = `INV-${String(year).slice(-3)}-${String(invSeq).padStart(5, "0")}`;
        const invId = await generateId("INV");
        await setDoc(doc(db, "invoices", invId), {
          invoiceNumber, type: "invoice", status: "draft",
          customer: { name: cName, phone: cPhone, address: "" },
          items: items.map((item) => {
            const product = activeProducts.find((p) => p.id === item.productId);
            return {
              productId: item.productId, productName: item.productName,
              sku: product?.sku || "", description: "",
              quantity: item.quantity, unitPrice: item.unitPrice,
              weight: product?.weight || 0, purity: product?.purity || "",
              makingCharge: product?.makingCharge || 0, subtotal: item.subtotal,
            };
          }),
          subtotal: totalAmount, discountAmount: discount, totalAmount: finalAmount,
          paymentStatus: balanceDue > 0 ? "partial" : "full",
          cashReceived: receivedAmount, balanceDue,
          warranty: { period: "", terms: "" },
          notes: "",
          termsAndConditions: "Goods once sold cannot be returned.",
          validUntil: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
          relatedSaleId: saleId,
          generatedBy: user?.uid || "",
          createdByName: profile?.displayName || "",
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
        });
        savedInvId = invId;
      } catch (e) {
        console.error("Auto-invoice failed", e);
      }

      for (const item of items) {
        try {
          const prodRef = doc(db, "products", item.productId);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const currentStock = prodSnap.data().quantityInStock || 0;
            await updateDoc(prodRef, { quantityInStock: Math.max(0, currentStock - item.quantity) });
          }
          await addDoc(collection(db, "inventoryLogs"), {
            productId: item.productId, changeType: "sale", quantityChange: -item.quantity,
            reason: `POS sale to ${cName}`, performedBy: user?.uid || "", createdAt: Timestamp.fromDate(new Date()),
          });
        } catch (e) { console.error("Stock update failed", e); }
      }

      try {
        if (receivedAmount > 0) {
          await addDoc(collection(db, "accountTransactions"), {
            accountId: resolveAccount("cash"), type: "credit", amount: receivedAmount,
            description: `POS sale to ${cName}`, date: Timestamp.fromDate(new Date()),
            referenceType: "sale", referenceId: saleId, recordedBy: user?.uid || "", createdAt: Timestamp.fromDate(new Date()),
          });
        }
      } catch (e) { console.error("Account transaction failed", e); }

      try {
        if (balanceDue > 0) {
          const debtorId = await generateId("DEBT");
          await setDoc(doc(db, "debtors", debtorId), {
            customerName: cName, customerPhone: cPhone, customerAddress: "",
            totalAmount: finalAmount, amountPaid: receivedAmount, balanceDue,
            dueDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
            orderIds: [saleId], status: "active",
            paymentHistory: receivedAmount > 0
              ? [{ date: Timestamp.fromDate(new Date()), amount: receivedAmount, method: "cash", notes: "Initial payment" }]
              : [],
            createdAt: Timestamp.fromDate(new Date()), updatedAt: Timestamp.fromDate(new Date()),
          });
        }
      } catch (e) { console.error("Debtor creation failed", e); }

      try {
        if (selectedCoupon) {
          const siteSnap = await getDoc(doc(db, "shop_settings", "config"));
          const siteUrl = ((siteSnap.data() as Record<string, unknown>)?.website || "").toString().replace(/\/$/, "");
          const siteText = siteUrl ? `our website ${siteUrl}` : "our website";
          const couponCode = generateCouponCode();
          const terms = `To be Used within 1 Months for purchase through ${siteText} during checkout or at our store's checkout counter`;
          await setDoc(doc(db, "coupons", couponCode), {
            code: couponCode, discountType: selectedCoupon.discountType, discountValue: selectedCoupon.discountValue,
            minPurchaseAmount: 0, maxDiscount: 200,
            validFrom: Timestamp.fromDate(new Date()),
            validUntil: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
            usageLimit: 1, usedCount: 0, isActive: true, couponType: selectedCoupon.couponType,
            terms,
            issuedToCustomer: { name: cName, phone: cPhone },
            issuedForOrderId: saleId, createdAt: Timestamp.fromDate(new Date()), createdBy: user?.uid || "",
          });
          if (savedInvId) {
            await updateDoc(doc(db, "invoices", savedInvId), {
              couponIssued: { code: couponCode, discountValue: selectedCoupon.discountValue, discountType: selectedCoupon.discountType, terms },
              updatedAt: Timestamp.fromDate(new Date()),
            });
          }
        }
      } catch (e) { console.error("Coupon creation failed", e); }

      setSuccess(true);
      clearForm();
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e?.message || "Sale failed");
    }
    refreshCollection("sales");
    refreshCollection("inventoryLogs");
    refreshCollection("debtors");
    refreshCollection("invoices");
    setSaving(false);
  };

  return (
    <AdminLayout>
      <div className="p-4 max-w-3xl mx-auto space-y-4">
        {/* Success banner */}
        {success && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-medium">
            <CheckCircle className="h-5 w-5 shrink-0" /> Sale recorded successfully! Ready for next customer.
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
            <X className="h-5 w-5 shrink-0" /> {error}
          </div>
        )}

        {/* Walk-in toggle + customer */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={walkin} onChange={(e) => setWalkin(e.target.checked)}
                className="accent-primary w-5 h-5" />
              <span className="text-sm font-semibold text-secondary">Walk-in Customer</span>
            </label>
            {walkin ? (
              <span className="text-xs text-muted-foreground">Bill To: Walk-in Customer</span>
            ) : (
              <div className="flex gap-2 flex-1">
                <input type="text" placeholder="Name" value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <input type="tel" placeholder="Mobile Number" value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  maxLength={10}
                  className="flex-1 px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            )}
          </div>
        </div>

        {/* Product search */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search products by name or SKU..." value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          {filteredProducts.length > 0 && (
            <div className="mt-2 border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
              {filteredProducts.map((p) => (
                <button key={p.id} onClick={() => addItem(p)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left">
                  <span className="font-medium truncate">{p.name}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    Rs. {formatNumber(p.price)} {p.quantityInStock !== undefined && <span className="text-xs">(Stock: {p.quantityInStock})</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-3 min-h-[120px]">
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">Search and add products above</p>
          ) : (
            items.map((item, idx) => (
              <div key={item.productId}
                className="flex items-center gap-3 py-2 border-b border-border last:border-b-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">Rs. {formatNumber(item.unitPrice)}/unit</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateItem(idx, "quantity", item.quantity - 1)}
                    className="p-1 rounded hover:bg-muted transition-colors">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input type="number" value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", Math.max(1, Number(e.target.value)))}
                    min={1} className="w-10 text-center text-sm border border-border rounded py-1" />
                  <button onClick={() => updateItem(idx, "quantity", item.quantity + 1)}
                    className="p-1 rounded hover:bg-muted transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" value={item.unitPrice}
                    onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                    min={0} step={10}
                    className="w-24 text-right text-sm border border-border rounded py-1 px-2" />
                  <span className="text-sm font-semibold text-secondary w-24 text-right">
                    Rs. {formatNumber(item.subtotal)}
                  </span>
                  <button onClick={() => removeItem(idx)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Payment mode */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-secondary">Payment:</span>
            {(["cash", "credit", "partial"] as PaymentMode[]).map((mode) => (
              <button key={mode}
                onClick={() => { setPaymentMode(mode); if (mode !== "partial") setReceivedAmount(0); }}
                className={`px-4 py-1.5 text-xs rounded-full border capitalize font-medium transition-colors ${
                  paymentMode === mode
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-muted-foreground border-border hover:bg-muted"
                }`}>
                {mode === "partial" ? "Partial" : mode === "credit" ? "Credit" : "Cash"}
              </button>
            ))}
            {paymentMode === "partial" && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-muted-foreground">Received:</span>
                <input type="number" value={receivedAmount || ""}
                  onChange={(e) => setReceivedAmount(Math.max(0, Number(e.target.value)))}
                  min={0} placeholder="0"
                  className="w-24 px-2 py-1 border border-border rounded text-sm text-right" />
              </div>
            )}
          </div>
        </div>

        {/* Coupon */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <button onClick={() => setShowCouponPopup(true)}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <Tag className="h-4 w-4" /> {selectedCoupon ? `Coupon: ${selectedCoupon.code} (-${selectedCoupon.discountType === "percentage" ? selectedCoupon.discountValue + "%" : "Rs. " + selectedCoupon.discountValue})` : "Add Coupon (optional)"}
          </button>
          {selectedCoupon && (
            <button onClick={() => setSelectedCoupon(null)}
              className="ml-3 text-xs text-red-500 hover:underline">Remove</button>
          )}
        </div>

        {/* Summary + Record */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal ({items.length} item{items.length !== 1 ? "s" : ""})</span>
            <span>Rs. {formatNumber(totalAmount)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>- Rs. {formatNumber(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-secondary border-t border-border pt-2">
            <span>Total</span>
            <span>Rs. {formatNumber(finalAmount)}</span>
          </div>
          {balanceDue > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>Balance Due</span>
              <span>Rs. {formatNumber(balanceDue)}</span>
            </div>
          )}
          <Button onClick={handleSave} disabled={saving || items.length === 0} variant="accent"
            className="w-full py-3 text-base">
            <CheckCircle className="h-5 w-5" /> {saving ? "Recording..." : "Record Sale"}
          </Button>
        </div>
      </div>

      {/* Coupon popup */}
      {showCouponPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowCouponPopup(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-secondary flex items-center gap-2">
                <Percent className="h-4 w-4" /> Select Coupon to Issue
              </h3>
              <button onClick={() => setShowCouponPopup(false)} className="p-1 hover:bg-muted rounded">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              <button onClick={() => { setSelectedCoupon(null); setShowCouponPopup(false); }}
                className="w-full text-left px-3 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
                <span className="text-muted-foreground">No coupon</span>
              </button>
              {activeCoupons.map((c) => (
                <button key={c.id} onClick={() => { setSelectedCoupon(c); setShowCouponPopup(false); }}
                  className="w-full text-left px-3 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
                  <span className="font-mono font-medium text-secondary">{c.code}</span>
                  <span className="text-muted-foreground ml-2">
                    — {c.discountType === "percentage" ? `${c.discountValue}% off` : `Rs. ${formatNumber(c.discountValue)} off`}
                    {c.minPurchaseAmount > 0 && ` (min ${formatNumber(c.minPurchaseAmount)})`}
                  </span>
                </button>
              ))}
              {activeCoupons.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No active coupons available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}


