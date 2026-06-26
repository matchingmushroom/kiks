"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
  Search, X, Minus, Plus, Trash2, CheckCircle, Percent, Tag, User,
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
  const searchRef = useRef<HTMLInputElement>(null);
  const announceRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);
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
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [couponApplyError, setCouponApplyError] = useState("");
  const [issueDiscountType, setIssueDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [issueDiscountValue, setIssueDiscountValue] = useState(0);
  const [showIssuePopup, setShowIssuePopup] = useState(false);
  const [manualDiscountType, setManualDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [manualDiscountValue, setManualDiscountValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (success || error) {
      announceRef.current?.focus();
    }
  }, [success, error]);

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
    let total = 0;
    if (manualDiscountValue > 0) {
      total += manualDiscountType === "percentage"
        ? Math.min((totalAmount * manualDiscountValue) / 100, totalAmount)
        : Math.min(manualDiscountValue, totalAmount);
    }
    if (appliedCoupon) {
      total += appliedCoupon.discountType === "percentage"
        ? Math.min((totalAmount * appliedCoupon.discountValue) / 100, appliedCoupon.maxDiscount || Infinity)
        : appliedCoupon.discountValue;
    }
    return Math.min(total, totalAmount);
  }, [appliedCoupon, totalAmount, manualDiscountValue, manualDiscountType]);

  const finalAmount = Math.max(0, totalAmount - discount);
  const balanceDue = paymentMode === "credit" ? finalAmount : paymentMode === "partial" ? Math.max(0, finalAmount - receivedAmount) : 0;



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
  };

  const clearForm = () => {
    setItems([]);
    setProductSearch("");
    setAppliedCoupon(null);
    setCouponCodeInput("");
    setCouponApplyError("");
    setIssueDiscountValue(0);
    setIssueDiscountType("percentage");
    setReceivedAmount(0);
    setPaymentMode("cash");
    setManualDiscountValue(0);
    setManualDiscountType("percentage");
    setCustomerName("");
    setCustomerPhone("");
    setWalkin(true);
  };

  const applyCouponCode = (code: string) => {
    setCouponApplyError("");
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setCouponApplyError("Enter a coupon code."); return; }
    const coupon = allCoupons.find((c) => c.code.toUpperCase() === trimmed);
    if (!coupon) { setCouponApplyError("Coupon not found."); return; }
    if (!coupon.isActive) { setCouponApplyError("This coupon is no longer active."); return; }
    const now = Date.now();
    const vf = coupon.validFrom as unknown;
    const vu = coupon.validUntil as unknown;
    const from = vf && typeof vf === "object" && "toMillis" in vf ? (vf as { toMillis: () => number }).toMillis() : (coupon.validFrom as number) || 0;
    const until = vu && typeof vu === "object" && "toMillis" in vu ? (vu as { toMillis: () => number }).toMillis() : (coupon.validUntil as number) || 0;
    if (from && now < from) { setCouponApplyError("This coupon is not yet valid."); return; }
    if (until && now > until) { setCouponApplyError("This coupon has expired."); return; }
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) { setCouponApplyError("This coupon usage limit is reached."); return; }
    if (coupon.minPurchaseAmount > 0 && totalAmount < coupon.minPurchaseAmount) { setCouponApplyError(`Minimum purchase of Rs. ${formatNumber(coupon.minPurchaseAmount)} required.`); return; }
    setAppliedCoupon(coupon);
    setCouponCodeInput("");
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
        couponIssued: appliedCoupon ? { code: appliedCoupon.code, discountValue: appliedCoupon.discountValue, discountType: appliedCoupon.discountType } : null,
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
        if (issueDiscountValue > 0) {
          const siteSnap = await getDoc(doc(db, "shop_settings", "config"));
          const siteUrl = ((siteSnap.data() as Record<string, unknown>)?.website || "").toString().replace(/\/$/, "");
          const siteText = siteUrl ? `our website ${siteUrl}` : "our website";
          const newCode = generateCouponCode();
          const terms = `To be Used within 1 Months for purchase through ${siteText} during checkout or at our store's checkout counter`;
          await setDoc(doc(db, "coupons", newCode), {
            code: newCode, discountType: issueDiscountType, discountValue: issueDiscountValue,
            minPurchaseAmount: 0, maxDiscount: 200,
            validFrom: Timestamp.fromDate(new Date()),
            validUntil: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
            usageLimit: 1, usedCount: 0, isActive: true, couponType: "POS Issued",
            terms,
            issuedToCustomer: { name: cName, phone: cPhone },
            issuedForOrderId: saleId, createdAt: Timestamp.fromDate(new Date()), createdBy: user?.uid || "",
          });
          if (savedInvId) {
            await updateDoc(doc(db, "invoices", savedInvId), {
              couponIssued: { code: newCode, discountValue: issueDiscountValue, discountType: issueDiscountType, terms },
              updatedAt: Timestamp.fromDate(new Date()),
            });
          }
        }
      } catch (e) { console.error("Coupon issue failed", e); }

      try {
        if (appliedCoupon) {
          await updateDoc(doc(db, "coupons", appliedCoupon.id), {
            usedCount: (appliedCoupon.usedCount || 0) + 1,
            updatedAt: Timestamp.fromDate(new Date()),
          });
        }
      } catch (e) { console.error("Coupon usage update failed", e); }

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
      <div className="max-w-4xl mx-auto p-4 lg:p-6 space-y-5">
        {/* Screen reader live region */}
        <div ref={announceRef} tabIndex={-1} className="sr-only" aria-live="assertive" role="status">
          {success ? "Sale recorded successfully. Ready for next customer." : error ? `Error: ${error}` : ""}
        </div>

        {/* Success banner */}
        {success && (
          <div role="status" className="flex items-center gap-3 bg-green-50 border-2 border-green-300 text-green-800 px-5 py-4 rounded-xl text-base font-medium">
            <CheckCircle className="h-6 w-6 shrink-0" aria-hidden="true" />
            <span>Sale recorded successfully! Ready for next customer.</span>
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-center gap-3 bg-red-50 border-2 border-red-300 text-red-800 px-5 py-4 rounded-xl text-base font-medium">
            <X className="h-6 w-6 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Customer section */}
        <section aria-label="Customer information">
          <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={walkin} onChange={(e) => setWalkin(e.target.checked)}
                  className="accent-primary w-6 h-6 rounded" />
                <span className="text-base font-semibold text-secondary">Walk-in Customer</span>
              </label>
              {walkin ? (
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <User className="h-4 w-4" aria-hidden="true" /> Bill To: Walk-in Customer
                </span>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                  <div className="flex-1">
                    <label htmlFor="cust-name" className="sr-only">Customer Name</label>
                    <input id="cust-name" type="text" placeholder="Customer Name" value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-border rounded-lg text-base focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors" />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="cust-phone" className="sr-only">Mobile Number</label>
                    <input id="cust-phone" type="tel" placeholder="Mobile Number" value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      className="w-full px-4 py-3 border-2 border-border rounded-lg text-base focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Product search */}
        <section aria-label="Product search">
          <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
            <div className="relative">
              <label htmlFor="product-search" className="sr-only">Search products by name or SKU</label>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <input id="product-search" ref={searchRef} type="search" autoComplete="off"
                placeholder="Search products by name or SKU..." value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredProducts.length > 0) { addItem(filteredProducts[0]); }
                }}
                className="w-full pl-11 pr-4 py-3.5 border-2 border-border rounded-lg text-base focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors" />
            </div>
            {filteredProducts.length > 0 && (
              <div className="mt-3 border-2 border-border rounded-xl divide-y-2 divide-border max-h-56 overflow-y-auto" role="listbox" aria-label="Matching products">
                {filteredProducts.map((p) => (
                  <button key={p.id} role="option" aria-selected={false}
                    onClick={() => addItem(p)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-base hover:bg-primary/5 focus:bg-primary/5 outline-none focus:ring-2 focus:ring-inset focus:ring-primary transition-colors text-left">
                    <span className="font-medium truncate text-secondary">{p.name}</span>
                    <span className="text-muted-foreground shrink-0 ml-4">
                      Rs. <strong>{formatNumber(p.price)}</strong>
                      {p.quantityInStock !== undefined && (
                        <span className="text-sm ml-2">(Stock: {p.quantityInStock})</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Cart items */}
        <section aria-label="Cart items" ref={summaryRef}>
          <div className="bg-white border border-border rounded-xl p-5 shadow-sm min-h-[140px]">
            <h2 className="text-base font-semibold text-secondary mb-3">
              Items ({items.length})
            </h2>
            {items.length === 0 ? (
              <p className="text-center text-muted-foreground text-base py-8">Search and add products above</p>
            ) : (
              <ul className="space-y-3" role="list">
                {items.map((item, idx) => (
                  <li key={item.productId}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border-2 border-border rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium text-secondary truncate">{item.productName}</p>
                      <p className="text-sm text-muted-foreground">Rs. {formatNumber(item.unitPrice)} / unit</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateItem(idx, "quantity", item.quantity - 1)}
                        aria-label={`Decrease quantity of ${item.productName}`}
                        className="p-2 rounded-lg border-2 border-border hover:bg-muted focus:ring-2 focus:ring-primary outline-none transition-colors">
                        <Minus className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <label className="sr-only" htmlFor={`qty-${idx}`}>Quantity</label>
                      <input id={`qty-${idx}`} type="number" value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", Math.max(1, Number(e.target.value)))}
                        min={1}
                        className="w-14 text-center text-base border-2 border-border rounded-lg py-2 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                      <button onClick={() => updateItem(idx, "quantity", item.quantity + 1)}
                        aria-label={`Increase quantity of ${item.productName}`}
                        className="p-2 rounded-lg border-2 border-border hover:bg-muted focus:ring-2 focus:ring-primary outline-none transition-colors">
                        <Plus className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`price-${idx}`}>Unit price</label>
                      <input id={`price-${idx}`} type="number" value={item.unitPrice}
                        onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                        min={0} step={10}
                        className="w-28 text-right text-base border-2 border-border rounded-lg py-2 px-3 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                      <span className="text-base font-bold text-secondary w-28 text-right">
                        Rs. {formatNumber(item.subtotal)}
                      </span>
                      <button onClick={() => removeItem(idx)}
                        aria-label={`Remove ${item.productName} from cart`}
                        className="p-2.5 text-red-600 hover:bg-red-50 focus:bg-red-50 rounded-lg border-2 border-transparent hover:border-red-200 focus:border-red-300 focus:ring-2 focus:ring-red-200 outline-none transition-colors">
                        <Trash2 className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Payment mode */}
        <section aria-label="Payment method">
          <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="text-base font-semibold text-secondary">Payment</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Payment mode">
                {(["cash", "credit", "partial"] as PaymentMode[]).map((mode) => (
                  <button key={mode} role="radio" aria-checked={paymentMode === mode}
                    onClick={() => { setPaymentMode(mode); if (mode !== "partial") setReceivedAmount(0); }}
                    className={`px-6 py-2.5 text-sm rounded-full border-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                      paymentMode === mode
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-secondary border-border hover:bg-muted"
                    }`}>
                    {mode === "partial" ? "Partial" : mode === "credit" ? "Credit" : "Cash"}
                  </button>
                ))}
              </div>
              {paymentMode === "partial" && (
                <div className="flex items-center gap-3">
                  <label htmlFor="received-amount" className="text-sm text-muted-foreground">Received:</label>
                  <input id="received-amount" type="number" value={receivedAmount || ""}
                    onChange={(e) => setReceivedAmount(Math.max(0, Number(e.target.value)))}
                    min={0} placeholder="0"
                    className="w-28 px-3 py-2.5 border-2 border-border rounded-lg text-base text-right focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Discount */}
        <section aria-label="Discount">
          <div className="bg-white border border-border rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-secondary flex items-center gap-2">
                <Percent className="h-5 w-5" aria-hidden="true" /> Discount
              </span>
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Discount type">
                <button role="radio" aria-checked={manualDiscountType === "percentage"}
                  onClick={() => setManualDiscountType("percentage")}
                  className={`px-4 py-2 text-sm rounded-full border-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                    manualDiscountType === "percentage"
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-secondary border-border hover:bg-muted"
                  }`}>%</button>
                <button role="radio" aria-checked={manualDiscountType === "fixed"}
                  onClick={() => setManualDiscountType("fixed")}
                  className={`px-4 py-2 text-sm rounded-full border-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                    manualDiscountType === "fixed"
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-secondary border-border hover:bg-muted"
                  }`}>Rs.</button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label htmlFor="manual-discount" className="sr-only">Discount value</label>
                <input id="manual-discount" type="number" value={manualDiscountValue || ""}
                  onChange={(e) => setManualDiscountValue(Math.max(0, Number(e.target.value)))}
                  min={0} placeholder="0"
                  className="w-full px-4 py-3 border-2 border-border rounded-lg text-base focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              {manualDiscountValue > 0 && (
                <span className="text-sm font-medium text-green-700 shrink-0">
                  = − Rs. {formatNumber(manualDiscountType === "percentage"
                    ? Math.min((totalAmount * manualDiscountValue) / 100, totalAmount)
                    : Math.min(manualDiscountValue, totalAmount))}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Coupon */}
        <section aria-label="Coupon">
          <div className="bg-white border border-border rounded-xl p-5 shadow-sm space-y-3">
            {appliedCoupon && (
              <div className="flex items-center justify-between bg-green-50 border-2 border-green-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 text-sm">
                  <Tag className="h-5 w-5 text-green-600" aria-hidden="true" />
                  <span className="font-semibold text-green-800">Applied: {appliedCoupon.code}</span>
                  <span className="text-green-700">
                    ({appliedCoupon.discountType === "percentage" ? `${appliedCoupon.discountValue}%` : `Rs. ${formatNumber(appliedCoupon.discountValue)}`} off)
                  </span>
                </div>
                <button onClick={() => { setAppliedCoupon(null); setCouponCodeInput(""); setCouponApplyError(""); }}
                  className="text-sm font-medium text-red-600 hover:text-red-800 hover:underline focus:outline-none focus:ring-2 focus:ring-red-300 rounded px-2 py-1">
                  Remove
                </button>
              </div>
            )}
            {issueDiscountValue > 0 && (
              <div className="flex items-center justify-between bg-blue-50 border-2 border-blue-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 text-sm">
                  <Tag className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  <span className="font-semibold text-blue-800">
                    Will issue: {issueDiscountType === "percentage" ? `${issueDiscountValue}% off` : `Rs. ${formatNumber(issueDiscountValue)} off`}
                  </span>
                </div>
                <button onClick={() => { setIssueDiscountValue(0); setIssueDiscountType("percentage"); }}
                  className="text-sm font-medium text-red-600 hover:text-red-800 hover:underline focus:outline-none focus:ring-2 focus:ring-red-300 rounded px-2 py-1">
                  Cancel
                </button>
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1">
                <label htmlFor="coupon-code" className="sr-only">Coupon code</label>
                <input id="coupon-code" type="text" value={couponCodeInput}
                  onChange={(e) => { setCouponCodeInput(e.target.value.toUpperCase()); setCouponApplyError(""); }}
                  placeholder="Enter coupon code..."
                  className="w-full px-4 py-3 border-2 border-border rounded-lg text-base font-mono uppercase focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <Button onClick={() => applyCouponCode(couponCodeInput)}
                disabled={!couponCodeInput.trim()}
                variant="accent" size="lg" className="shrink-0">
                <Tag className="h-5 w-5" aria-hidden="true" /> Apply
              </Button>
            </div>
            {couponApplyError && (
              <p className="text-sm text-red-600 font-medium" role="alert">{couponApplyError}</p>
            )}
            <button onClick={() => setShowIssuePopup(true)}
              className="text-sm text-muted-foreground hover:text-primary font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded px-1">
              Or issue a new coupon to customer &rarr;
            </button>
          </div>
        </section>

        {/* Summary + Record */}
        <section aria-label="Sale summary">
          <div className="bg-white border-2 border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between text-base">
              <span className="text-muted-foreground">Subtotal ({items.length} item{items.length !== 1 ? "s" : ""})</span>
              <span className="font-semibold text-secondary">Rs. {formatNumber(totalAmount)}</span>
            </div>
            {manualDiscountValue > 0 && (
              <div className="flex justify-between text-base text-green-700">
                <span>Discount{manualDiscountType === "percentage" ? ` (${manualDiscountValue}%)` : ""}</span>
                <span>− Rs. {formatNumber(manualDiscountType === "percentage"
                  ? Math.min((totalAmount * manualDiscountValue) / 100, totalAmount)
                  : Math.min(manualDiscountValue, totalAmount))}</span>
              </div>
            )}
            {appliedCoupon && (
              <div className="flex justify-between text-base text-green-700">
                <span>Coupon ({appliedCoupon.code})</span>
                <span>− Rs. {formatNumber(appliedCoupon.discountType === "percentage"
                  ? Math.min((totalAmount * appliedCoupon.discountValue) / 100, appliedCoupon.maxDiscount || Infinity)
                  : appliedCoupon.discountValue)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold text-secondary border-t-2 border-border pt-4">
              <span>Total</span>
              <span>Rs. {formatNumber(finalAmount)}</span>
            </div>
            {balanceDue > 0 && (
              <div className="flex justify-between text-base text-red-600 font-semibold">
                <span>Balance Due</span>
                <span>Rs. {formatNumber(balanceDue)}</span>
              </div>
            )}
            <Button onClick={handleSave} disabled={saving || items.length === 0} variant="accent" size="lg"
              className="w-full py-4 text-lg font-bold">
              <CheckCircle className="h-6 w-6" aria-hidden="true" /> {saving ? "Recording..." : "Record Sale"}
            </Button>
          </div>
        </section>
      </div>

      {/* Issue coupon modal */}
      {showIssuePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowIssuePopup(false)}
          role="dialog" aria-modal="true" aria-labelledby="issue-coupon-title">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md mx-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 id="issue-coupon-title" className="text-lg font-bold text-secondary flex items-center gap-2">
                <Percent className="h-5 w-5" aria-hidden="true" /> Issue Coupon to Customer
              </h2>
              <button onClick={() => setShowIssuePopup(false)}
                aria-label="Close coupon dialog"
                className="p-2 hover:bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5">
              <fieldset>
                <legend className="text-base font-semibold text-secondary mb-3">Discount Type</legend>
                <div className="flex items-center gap-3" role="radiogroup" aria-label="Discount type">
                  <button role="radio" aria-checked={issueDiscountType === "percentage"}
                    onClick={() => setIssueDiscountType("percentage")}
                    className={`px-5 py-2.5 text-sm rounded-full border-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                      issueDiscountType === "percentage"
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-secondary border-border hover:bg-muted"
                    }`}>Percentage (%)</button>
                  <button role="radio" aria-checked={issueDiscountType === "fixed"}
                    onClick={() => setIssueDiscountType("fixed")}
                    className={`px-5 py-2.5 text-sm rounded-full border-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                      issueDiscountType === "fixed"
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-secondary border-border hover:bg-muted"
                    }`}>Fixed (Rs.)</button>
                </div>
              </fieldset>
              <div>
                <label htmlFor="issue-discount-value" className="block text-base font-semibold text-secondary mb-2">Discount Value</label>
                <input id="issue-discount-value" type="number" value={issueDiscountValue || ""}
                  autoFocus
                  onChange={(e) => setIssueDiscountValue(Math.max(0, Number(e.target.value)))}
                  min={0} placeholder="Enter discount value"
                  className="w-full px-4 py-3 border-2 border-border rounded-lg text-base focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <p className="text-sm text-muted-foreground bg-muted rounded-lg px-4 py-3">
                A new coupon code will be generated with this discount. The customer can use it on their next purchase.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => setShowIssuePopup(false)}
                  variant="outline" size="lg" className="flex-1">Cancel</Button>
                <Button onClick={() => { if (issueDiscountValue > 0) setShowIssuePopup(false); }}
                  disabled={issueDiscountValue <= 0}
                  variant="accent" size="lg" className="flex-1">
                  <Tag className="h-5 w-5" aria-hidden="true" /> Ready to Issue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}


