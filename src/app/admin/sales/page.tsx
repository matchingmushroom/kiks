"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { Sale, Product, Order } from "@/types";
import { formatCurrency, formatDate, generateCouponCode } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  addDoc, collection, updateDoc, doc, setDoc, Timestamp, getDoc, getDocs, query, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Search, X, Save, CheckCircle } from "lucide-react";

interface LineItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  weight: number;
  purity: string;
  makingCharge: number;
  subtotal: number;
}

const emptyForm = {
  customerName: "", customerPhone: "", customerAddress: "",
  items: [] as LineItem[],
  totalAmount: 0, discountAmount: 0, finalAmount: 0,
  paymentMethod: "cash", receivedAmount: 0, balanceDue: 0,
  warrantyPeriod: "", warrantyTerms: "",
  issueCoupon: false, notes: "",
};

function SalesContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const { data: sales, loading } = useFirestore<Sale>("sales", {
    constraints: [orderBy("saleDate", "desc")],
  });
  const { data: products } = useFirestore<Product>("products", {
    constraints: [orderBy("name", "asc")],
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSale, setSavedSale] = useState(false);

  useEffect(() => {
    if (orderId) {
      setShowForm(true);
    }
  }, [orderId]);

  const filteredProducts = products.filter((p) =>
    p.isActive && p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const recalc = (items: LineItem[], discount: number, received: number) => {
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const final = Math.max(0, total - discount);
    const balance = Math.max(0, final - received);
    return { totalAmount: total, finalAmount: final, balanceDue: balance };
  };

  const addItem = (product: Product) => {
    const existing = form.items.find((i) => i.productId === product.id);
    if (existing) {
      const items = form.items.map((i) =>
        i.productId === product.id
          ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice }
          : i
      );
      const calc = recalc(items, form.discountAmount, form.receivedAmount);
      setForm({ ...form, items, ...calc });
      return;
    }
    const newItem: LineItem = {
      productId: product.id,
      productName: product.name,
      sku: product.sku || "",
      quantity: 1,
      unitPrice: product.price,
      weight: product.weight,
      purity: product.purity,
      makingCharge: product.makingCharge,
      subtotal: product.price,
    };
    const items = [...form.items, newItem];
    const calc = recalc(items, form.discountAmount, form.receivedAmount);
    setForm({ ...form, items, ...calc });
    setProductSearch("");
  };

  const updateItem = (index: number, field: keyof LineItem, value: number | string) => {
    const items = form.items.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        updated.subtotal = (field === "quantity" ? Number(value) : item.quantity) *
          (field === "unitPrice" ? Number(value) : item.unitPrice);
      }
      return updated;
    });
    const calc = recalc(items, form.discountAmount, form.receivedAmount);
    setForm({ ...form, items, ...calc });
  };

  const removeItem = (index: number) => {
    const items = form.items.filter((_, i) => i !== index);
    const calc = recalc(items, form.discountAmount, form.receivedAmount);
    setForm({ ...form, items, ...calc });
  };

  const updateDiscount = (value: number) => {
    const calc = recalc(form.items, value, form.receivedAmount);
    setForm({ ...form, discountAmount: value, ...calc });
  };

  const updateReceived = (value: number) => {
    const calc = recalc(form.items, form.discountAmount, value);
    setForm({ ...form, receivedAmount: value, ...calc });
  };

  const handleSave = async () => {
    if (!form.customerName || form.items.length === 0) return;
    setSaving(true);
    try {
      const saleRef = await addDoc(collection(db, "sales"), {
        orderId: orderId || "",
        saleType: form.balanceDue > 0 ? (form.receivedAmount > 0 ? "partial" : "credit") : "cash",
        customer: { name: form.customerName, phone: form.customerPhone, address: form.customerAddress, email: "" },
        items: form.items,
        totalAmount: form.totalAmount,
        discountAmount: form.discountAmount,
        finalAmount: form.finalAmount,
        payment: { method: form.paymentMethod, receivedAmount: form.receivedAmount, balanceDue: form.balanceDue },
        warranty: { period: form.warrantyPeriod, terms: form.warrantyTerms, startDate: Timestamp.fromDate(new Date()), endDate: Timestamp.fromDate(new Date()) },
        couponIssued: null,
        notes: form.notes,
        saleDate: Timestamp.fromDate(new Date()),
        recordedBy: "",
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });

      for (const item of form.items) {
        const prodRef = doc(db, "products", item.productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          const currentStock = prodSnap.data().quantityInStock || 0;
          await updateDoc(prodRef, { quantityInStock: Math.max(0, currentStock - item.quantity) });
        }
        await addDoc(collection(db, "inventoryLogs"), {
          productId: item.productId,
          changeType: "sale",
          quantityChange: -item.quantity,
          reason: `Sale to ${form.customerName}`,
          performedBy: "",
          createdAt: Timestamp.fromDate(new Date()),
        });
      }

      if (form.receivedAmount > 0 && form.paymentMethod !== "credit") {
        const accountId = form.paymentMethod === "cash" ? "cash_in_hand" : "bank_account";
        await addDoc(collection(db, "accountTransactions"), {
          accountId,
          type: "credit",
          amount: form.receivedAmount,
          description: `Sale to ${form.customerName}`,
          date: Timestamp.fromDate(new Date()),
          referenceType: "sale",
          referenceId: saleRef.id,
          recordedBy: "",
          createdAt: Timestamp.fromDate(new Date()),
        });
      }

      if (form.balanceDue > 0) {
        const debtorData = {
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          customerAddress: form.customerAddress,
          totalAmount: form.finalAmount,
          amountPaid: form.receivedAmount,
          balanceDue: form.balanceDue,
          dueDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
          orderIds: [saleRef.id],
          status: "active",
          paymentHistory: form.receivedAmount > 0
            ? [{ date: Timestamp.fromDate(new Date()), amount: form.receivedAmount, method: form.paymentMethod, notes: "Initial payment" }]
            : [],
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
        };
        await addDoc(collection(db, "debtors"), debtorData);
      }

      if (form.issueCoupon) {
        const code = generateCouponCode();
        await setDoc(doc(db, "coupons", code), {
          code,
          discountType: "percentage",
          discountValue: 10,
          minPurchaseAmount: 0,
          maxDiscount: 5000,
          validFrom: Timestamp.fromDate(new Date()),
          validUntil: Timestamp.fromDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
          usageLimit: 1,
          usedCount: 0,
          isActive: true,
          issuedToCustomer: { name: form.customerName, phone: form.customerPhone },
          issuedForOrderId: saleRef.id,
          createdAt: Timestamp.fromDate(new Date()),
          createdBy: "",
        });
      }

      setSavedSale(true);
      setForm(emptyForm);
      setTimeout(() => setSavedSale(false), 3000);
    } catch (e) {
      console.error("Sale save failed", e);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Sales</h1>
          <p className="text-sm text-muted-foreground">{sales.length} total</p>
        </div>
        <Button onClick={() => { setShowForm(true); setForm(emptyForm); }} variant="accent">
          <Plus className="h-4 w-4" /> Record Sale
        </Button>
      </div>

      {savedSale && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle className="h-5 w-5" /> Sale recorded successfully!
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-secondary">Record Sale</h2>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Customer</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input type="text" placeholder="Customer Name *" value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <input type="tel" placeholder="Phone *" value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <input type="text" placeholder="Address" value={form.customerAddress}
                  onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
                  className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Items</h3>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search products to add..." value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                {productSearch && filteredProducts.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredProducts.slice(0, 10).map((p) => (
                      <button key={p.id} onClick={() => addItem(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between">
                        <span>{p.name}</span>
                        <span className="text-muted-foreground text-xs">{formatCurrency(p.price)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {form.items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No items added yet. Search and add products above.</p>
              ) : (
                <div className="border border-border rounded-lg divide-y divide-border">
                  {form.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="flex-1 min-w-0 truncate">{item.productName}</span>
                      <input type="number" value={item.quantity} min={1}
                        onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                        className="w-16 px-2 py-1 border border-border rounded text-xs text-center" />
                      <input type="number" value={item.unitPrice}
                        onChange={(e) => updateItem(i, "unitPrice", Number(e.target.value))}
                        className="w-24 px-2 py-1 border border-border rounded text-xs text-right" />
                      <span className="w-24 text-right font-medium text-xs">{formatCurrency(item.subtotal)}</span>
                      <button onClick={() => removeItem(i)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Warranty</h3>
                <div className="space-y-2">
                  <select value={form.warrantyPeriod} onChange={(e) => setForm({ ...form, warrantyPeriod: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">No warranty</option>
                    <option value="3 months">3 months</option>
                    <option value="6 months">6 months</option>
                    <option value="1 year">1 year</option>
                    <option value="2 years">2 years</option>
                    <option value="Lifetime">Lifetime</option>
                  </select>
                  <input type="text" placeholder="Warranty terms" value={form.warrantyTerms}
                    onChange={(e) => setForm({ ...form, warrantyTerms: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Payment</h3>
                <div className="space-y-2">
                  <select value={form.paymentMethod}
                    onChange={(e) => {
                      const method = e.target.value;
                      if (method === "credit") {
                        const calc = recalc(form.items, form.discountAmount, 0);
                        setForm({ ...form, paymentMethod: method, receivedAmount: 0, ...calc });
                      } else {
                        setForm({ ...form, paymentMethod: method });
                      }
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="qr">QR Payment</option>
                    <option value="credit">Credit Sales</option>
                  </select>
                  <input type="number" placeholder="Amount Received" value={form.receivedAmount || ""}
                    onChange={(e) => updateReceived(Number(e.target.value))}
                    disabled={form.paymentMethod === "credit"}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed" />
                  {form.paymentMethod === "credit" && (
                    <p className="text-xs text-amber-600">Full amount will be on credit / debtor account</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Discount (NPR)</label>
                <input type="number" value={form.discountAmount || ""}
                  onChange={(e) => updateDiscount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <label className="flex items-center gap-2 text-sm pt-6 cursor-pointer">
                <input type="checkbox" checked={form.issueCoupon}
                  onChange={(e) => setForm({ ...form, issueCoupon: e.target.checked })}
                  className="rounded border-border" />
                Issue 10% coupon for next purchase
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Subtotal: <span className="text-secondary font-medium">{formatCurrency(form.totalAmount)}</span></p>
                {form.discountAmount > 0 && (
                  <p className="text-muted-foreground">Discount: <span className="text-red-500">-{formatCurrency(form.discountAmount)}</span></p>
                )}
                <p className="text-base font-bold text-secondary">Total: {formatCurrency(form.finalAmount)}</p>
                {form.balanceDue > 0 && (
                  <p className="text-red-600 text-xs">Balance Due: {formatCurrency(form.balanceDue)}</p>
                )}
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setShowForm(false)} variant="outline">Cancel</Button>
                <Button onClick={handleSave} disabled={saving || !form.customerName || form.items.length === 0} variant="accent">
                  <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Sale"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sales.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No sales recorded yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {sales.map((s) => (
            <div key={s.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-secondary text-sm truncate">{s.customer?.name}</p>
                  <p className="text-xs text-muted-foreground">{s.customer?.phone}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize shrink-0 ${
                  s.payment?.balanceDue > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                }`}>
                  {s.payment?.balanceDue > 0 ? `Due ${formatCurrency(s.payment.balanceDue)}` : "Paid"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-secondary">{formatCurrency(s.finalAmount)}</span>
                <span className="text-muted-foreground">{formatDate(s.saleDate)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{s.items?.length || 0} items</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminSalesPage() {
  return (
    <AdminLayout>
      <Suspense fallback={<div className="p-6 text-center text-muted-foreground">Loading...</div>}>
        <SalesContent />
      </Suspense>
    </AdminLayout>
  );
}
