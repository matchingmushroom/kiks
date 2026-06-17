"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { Product, Customer } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { addDoc, collection, setDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Search, X, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface LineItem {
  productName: string;
  description: string;
  weight: number;
  purity?: string;
  quantity: number;
  unitPrice: number;
  makingCharge: number;
  subtotal: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data: products } = useFirestore<Product>("products", {
    constraints: [orderBy("name", "asc")],
  });
  const { data: allCustomers } = useFirestore<Customer>("customers", {
    constraints: [orderBy("name", "asc")],
  });

  const [type, setType] = useState<"invoice" | "estimate">("invoice");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [manualCustomer, setManualCustomer] = useState(false);
  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("Goods once sold cannot be returned.");
  const [warrantyPeriod, setWarrantyPeriod] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);

  const [paymentStatus, setPaymentStatus] = useState<"full" | "partial">("full");
  const [cashReceived, setCashReceived] = useState(0);

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const total = Math.max(0, subtotal - discountAmount);
  const balanceDue = paymentStatus === "partial" ? Math.max(0, total - cashReceived) : 0;

  const filteredProducts = products.filter((p) =>
    p.isActive && p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const addItem = (p: Product) => {
    const existing = items.find((i) => i.productName === p.name);
    if (existing) {
      setItems(items.map((i) =>
        i.productName === p.name
          ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice }
          : i
      ));
      return;
    }
    setItems([...items, {
      productName: p.name,
      description: p.description,
      weight: p.weight,
      quantity: 1,
      unitPrice: p.price,
      makingCharge: p.makingCharge,
      subtotal: p.price,
    }]);
    setProductSearch("");
  };

  const updateItem = (index: number, field: keyof LineItem, value: number | string) => {
    setItems(items.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        updated.subtotal = (field === "quantity" ? Number(value) : item.quantity) *
          (field === "unitPrice" ? Number(value) : item.unitPrice);
      }
      return updated;
    }));
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!customerName || items.length === 0) return;
    setSaving(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const prefix = type === "invoice" ? "INV" : "EST";
      const counterDoc = doc(db, "counters", `${prefix.toLowerCase()}s_${year}`);
      const counterSnap = await import("firebase/firestore").then((m) => m.getDoc(counterDoc));
      let seq = 1;
      if (counterSnap.exists()) {
        seq = (counterSnap.data().lastNumber || 0) + 1;
      }
      await setDoc(counterDoc, { lastNumber: seq, year }, { merge: true });

      const invoiceNumber = `${prefix}-${year}-${String(seq).padStart(4, "0")}`;

      const docRef = await addDoc(collection(db, "invoices"), {
        invoiceNumber,
        type,
        status: "draft",
        customer: { name: customerName, phone: customerPhone, address: customerAddress },
        items,
        subtotal,
        discountAmount,
        totalAmount: total,
        paymentStatus: type === "invoice" ? paymentStatus : undefined,
        cashReceived: type === "invoice" && paymentStatus === "partial" ? cashReceived : 0,
        balanceDue: type === "invoice" && paymentStatus === "partial" ? balanceDue : 0,
        warranty: { period: warrantyPeriod, terms: warrantyTerms },
        notes,
        termsAndConditions: terms,
        validUntil: validUntil ? Timestamp.fromDate(new Date(validUntil)) : null,
        relatedSaleId: "",
        generatedBy: "",
        createdByName: profile?.displayName || "",
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });

      router.push(`/admin/invoices/${docRef.id}`);
    } catch (e) {
      console.error("Save failed", e);
    }
    setSaving(false);
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/invoices" className="p-1 hover:bg-muted rounded">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-secondary">New {type === "invoice" ? "Invoice" : "Estimate"}</h1>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setType("invoice")}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
              type === "invoice" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            Invoice
          </button>
          <button
            onClick={() => setType("estimate")}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
              type === "estimate" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            Estimate
          </button>
        </div>

        <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase">Customer</h3>
            <div className="space-y-3">
              <select value={manualCustomer ? "other" : customerName}
                onChange={(e) => {
                  if (e.target.value === "other") {
                    setManualCustomer(true);
                  } else if (e.target.value === "") {
                    setCustomerName(""); setCustomerPhone(""); setCustomerAddress("");
                    setManualCustomer(false);
                  } else {
                    const selected = allCustomers.find((c) => c.name === e.target.value);
                    setCustomerName(selected?.name || ""); setCustomerPhone(selected?.phone || ""); setCustomerAddress(selected?.address || "");
                    setManualCustomer(false);
                  }
                }}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select customer</option>
                {allCustomers.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}{c.phone ? ` (${c.phone})` : ""}</option>
                ))}
                <option value="other">Other (Enter Manually)</option>
              </select>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {manualCustomer ? (
                  <input type="text" placeholder="Customer Name *" value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                ) : (
                  <input type="text" placeholder="Customer Name *" value={customerName} readOnly
                    className="px-3 py-2 border border-border rounded-lg text-sm bg-gray-50 text-muted-foreground cursor-not-allowed" />
                )}
                {manualCustomer ? (
                  <input type="tel" placeholder="Phone" value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                ) : (
                  <input type="tel" value={customerPhone} readOnly
                    className="px-3 py-2 border border-border rounded-lg text-sm bg-gray-50 text-muted-foreground cursor-not-allowed" />
                )}
                {manualCustomer ? (
                  <input type="text" placeholder="Address" value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                ) : (
                  <input type="text" value={customerAddress} readOnly
                    className="px-3 py-2 border border-border rounded-lg text-sm bg-gray-50 text-muted-foreground cursor-not-allowed" />
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase">Items</h3>
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
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No items added.</p>
            ) : (
              <div className="border border-border rounded-lg divide-y divide-border">
                <div className="hidden md:flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground bg-muted/50 font-medium">
                  <span className="flex-1">Product</span>
                  <span className="w-12 text-center">Wt</span>
                  <span className="w-16 text-center">Qty</span>
                  <span className="w-24 text-right">Rate</span>
                  <span className="w-24 text-right">Subtotal</span>
                  <span className="w-8" />
                </div>
                {items.map((item, i) => (
                  <div key={i} className="flex flex-wrap md:flex-nowrap items-center gap-2 px-3 py-2 text-sm">
                    <span className="flex-1 min-w-0 truncate text-xs md:text-sm">{item.productName}</span>
                    <input type="number" step="0.1" value={item.weight}
                      onChange={(e) => updateItem(i, "weight", Number(e.target.value))}
                      className="w-12 px-1 py-1 border border-border rounded text-xs text-center" />
                    <input type="number" value={item.quantity} min={1}
                      onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                      className="w-14 px-1 py-1 border border-border rounded text-xs text-center" />
                    <input type="number" value={item.unitPrice}
                      onChange={(e) => updateItem(i, "unitPrice", Number(e.target.value))}
                      className="w-20 px-1 py-1 border border-border rounded text-xs text-right" />
                    <span className="w-20 text-right font-medium text-xs">{formatCurrency(item.subtotal)}</span>
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
              <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase">Warranty</h3>
              <div className="space-y-2">
                <select value={warrantyPeriod} onChange={(e) => setWarrantyPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">No warranty</option>
                  <option value="3 months">3 months</option>
                  <option value="6 months">6 months</option>
                  <option value="1 year">1 year</option>
                  <option value="2 years">2 years</option>
                  <option value="Lifetime">Lifetime</option>
                </select>
                <input type="text" placeholder="Warranty terms" value={warrantyTerms}
                  onChange={(e) => setWarrantyTerms(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Discount (NPR)</label>
                <input type="number" value={discountAmount || ""}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              {type === "estimate" && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Valid Until</label>
                  <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              )}
            </div>
          </div>

          {type === "invoice" && (
            <div className="border border-border rounded-lg p-4 space-y-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase">Payment</h3>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="paymentStatus" value="full" checked={paymentStatus === "full"}
                    onChange={() => { setPaymentStatus("full"); setCashReceived(0); }}
                    className="rounded-full border-border" />
                  Full Payment
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="paymentStatus" value="partial" checked={paymentStatus === "partial"}
                    onChange={() => setPaymentStatus("partial")}
                    className="rounded-full border-border" />
                  Partial Payment
                </label>
              </div>
              {paymentStatus === "partial" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Cash Received (NPR)</label>
                    <input type="number" value={cashReceived || ""}
                      onChange={(e) => setCashReceived(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Balance Due</label>
                    <div className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-muted/50 text-red-600 font-medium">
                      {formatCurrency(balanceDue)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" rows={2} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Terms & Conditions</label>
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" rows={2} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Subtotal: <span className="text-secondary font-medium">{formatCurrency(subtotal)}</span></p>
              {discountAmount > 0 && <p className="text-muted-foreground">Discount: <span className="text-red-500">-{formatCurrency(discountAmount)}</span></p>}
              <p className="text-lg font-bold text-secondary">Total: {formatCurrency(total)}</p>
              {paymentStatus === "partial" && cashReceived > 0 && (
                <>
                  <p className="text-muted-foreground">Cash Received: <span className="text-green-600 font-medium">{formatCurrency(cashReceived)}</span></p>
                  <p className="text-red-600 font-medium">Balance Due: {formatCurrency(balanceDue)}</p>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <Button onClick={() => router.push("/admin/invoices")} variant="outline">Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !customerName || items.length === 0} variant="accent">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : `Create ${type === "invoice" ? "Invoice" : "Estimate"}`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}