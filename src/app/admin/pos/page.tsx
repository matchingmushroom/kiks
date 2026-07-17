"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { Product, Coupon, Sale, Category } from "@/types";
import { formatCurrency, formatNumber, generateCouponCode } from "@/lib/utils";
import { toBS } from "@/lib/nepaliDate";
import { generateId } from "@/lib/id-generator";
import { resolveAccount } from "@/lib/accounts";
import { createJournalEntry, buildSaleJournal, buildSaleCogsJournal } from "@/lib/journal";
import { consumeFifo } from "@/lib/fifo";
import { useAuth } from "@/contexts/AuthContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { Button } from "@/components/ui/button";
import {
  addDoc, collection, updateDoc, doc, setDoc, Timestamp, getDoc, query, where, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import BarcodeScannerDialog from "@/components/admin/BarcodeScannerDialog";
import ReceiptPrint from "@/components/admin/ReceiptPrint";
import {
  Search, X, Minus, Plus, Trash2, CheckCircle, Percent, Tag, User, Camera,
} from "lucide-react";

interface LineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

type PaymentMode = "cash" | "qr" | "partial";

export default function POSPage() {
  const searchRef = useRef<HTMLInputElement>(null);
  const announceRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);
  const { user, profile } = useAuth();
  const { settings } = useShopSettings();
  const { data: products } = useFirestore<Product>("products", {
    constraints: [orderBy("name", "asc"), limit(500)],
    realtime: true,
  });
  const { data: allCoupons } = useFirestore<Coupon>("coupons", {
    constraints: [orderBy("createdAt", "desc"), limit(100)],
    realtime: true,
  });
  const { data: allCategories } = useFirestore<Category>("categories", {
    constraints: [orderBy("order", "asc"), limit(100)],
    realtime: true,
  });

  const [walkin, setWalkin] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [liteItemName, setLiteItemName] = useState("");
  const [liteItemPrice, setLiteItemPrice] = useState(0);
  const [liteItemQty, setLiteItemQty] = useState(1);
  const [liteUsedNames, setLiteUsedNames] = useState<string[]>([]);
  const [liteSuggestions, setLiteSuggestions] = useState<string[]>([]);
  const filterLiteNames = (q: string) => q ? liteUsedNames.filter((n) => n.toLowerCase().includes(q.toLowerCase())) : [];
  const addLiteItem = () => {
    if (!liteItemName || !liteItemPrice || !liteItemQty) return;
    const subtotal = liteItemPrice * liteItemQty;
    setItems((prev) => [...prev, { productId: "", productName: liteItemName, quantity: liteItemQty, unitPrice: liteItemPrice, subtotal }]);
    if (!liteUsedNames.includes(liteItemName)) setLiteUsedNames((prev) => [...prev, liteItemName]);
    setLiteItemName(""); setLiteItemPrice(0); setLiteItemQty(1); setLiteSuggestions([]);
  };
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [couponApplyError, setCouponApplyError] = useState("");
  const [issueDiscountType, setIssueDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [issueDiscountValue, setIssueDiscountValue] = useState(0);
  const [showIssuePopup, setShowIssuePopup] = useState(false);
  const [manualDiscountType, setManualDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [manualDiscountValue, setManualDiscountValue] = useState(0);
  const [comboDiscount, setComboDiscount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [customerPoints, setCustomerPoints] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [mobilePaymentOpen, setMobilePaymentOpen] = useState(true);
  const [mobileDiscountOpen, setMobileDiscountOpen] = useState(false);
  const [mobileCouponOpen, setMobileCouponOpen] = useState(false);

  useEffect(() => {
    if (walkin || !customerPhone) { setCustomerName(""); setCustomerPoints(null); setRedeemPoints(0); return; }
    let cancelled = false;
    (async () => {
      const q = query(collection(db, "customers"), where("phone", "==", customerPhone));
      const snap = await getDocs(q);
      if (cancelled) return;
      const data = snap.docs[0]?.data();
      if (data) {
        setCustomerName(data.name || "");
        setCustomerPoints(data.loyaltyPoints || 0);
      } else {
        setCustomerName("");
        setCustomerPoints(null);
        import("@/lib/loyalty-gas").then((m) =>
          m.lookupCustomer(customerPhone).then((r) => {
            if (cancelled) return;
            if (r.ok && r.data) {
              setCustomerName(r.data.name);
              setCustomerPoints(r.data.currentPoints);
            }
          })
        );
      }
    })();
    return () => { cancelled = true; };
  }, [customerPhone, walkin]);

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
      p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q) || (p.shortCode || "").toLowerCase().includes(q) || (p.barcodeId || "").toLowerCase().includes(q)
    ).slice(0, 10);
  }, [activeProducts, productSearch]);

  const totalAmount = useMemo(() =>
    items.reduce((sum, i) => sum + i.subtotal, 0),
  [items]);

  const redeemDiscount = useMemo(() => {
    if (!settings.loyaltyEnabled || !customerPhone || redeemPoints <= 0) return 0;
    if (redeemPoints < (settings.minRedemptionPoints ?? 0)) return 0;
    const maxDiscount = redeemPoints * (settings.pointValue ?? 0.5);
    return Math.min(maxDiscount, totalAmount * 0.5);
  }, [settings.loyaltyEnabled, settings.pointValue, settings.minRedemptionPoints, customerPhone, redeemPoints, totalAmount]);

  const discount = useMemo(() => {
    let total = comboDiscount + redeemDiscount;
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
  }, [comboDiscount, appliedCoupon, totalAmount, manualDiscountValue, manualDiscountType, redeemDiscount]);

  const finalAmount = Math.max(0, totalAmount - discount);
  const balanceDue = paymentMode === "partial" ? Math.max(0, finalAmount - receivedAmount) : 0;

  const categoryMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of allCategories) m.set(c.id, c.name);
    return m;
  }, [allCategories]);

  const categories = useMemo(() => {
    const ids = [...new Set(activeProducts.map((p) => p.categoryId).filter(Boolean))] as string[];
    return ids.map((id) => ({ id, name: categoryMap.get(id) || id })).filter((c) => c.name);
  }, [activeProducts, categoryMap]);

  const categoryProducts = useMemo(() =>
    selectedCategory ? activeProducts.filter((p) => p.categoryId === selectedCategory).slice(0, 30) : [],
  [activeProducts, selectedCategory]);

  const availableStock = (productId: string): number => {
    const p = activeProducts.find((p) => p.id === productId);
    return p?.quantityInStock ?? 0;
  };

  const addItem = (product: Product) => {
    if (product.comboItems?.length) {
      const comboProducts = activeProducts.filter((p) => product.comboItems!.includes(p.id));
      let totalMrp = 0;
      for (const cp of comboProducts) totalMrp += cp.price;
      const comboItemsToAdd = comboProducts.map((cp) => ({
        productId: cp.id, productName: cp.name,
        quantity: 1, unitPrice: cp.price, subtotal: cp.price,
      }));
      setItems((prev) => {
        const next = [...prev];
        for (const ci of comboItemsToAdd) {
          const idx = next.findIndex((i) => i.productId === ci.productId);
          if (idx >= 0) {
            const cp = comboProducts.find((p) => p.id === ci.productId)!;
            const newQty = Math.min(next[idx].quantity + 1, cp?.quantityInStock ?? 0);
            next[idx] = { ...next[idx], quantity: newQty, subtotal: newQty * next[idx].unitPrice };
          } else {
            next.push(ci);
          }
        }
        return next;
      });
      setComboDiscount(totalMrp - (product.comboPrice || product.price));
      setProductSearch("");
      return;
    }
    const stock = product.quantityInStock ?? 0;
    if (stock <= 0) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        const newQty = Math.min(existing.quantity + 1, stock);
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: newQty, subtotal: newQty * i.unitPrice }
            : i
        );
      }
      return [...prev, {
        productId: product.id, productName: product.name,
        quantity: 1, unitPrice: product.price, subtotal: product.price,
      }];
    });
    setProductSearch("");
  };

  const updateItem = (index: number, field: "quantity" | "unitPrice", value: number) => {
    if (value < 0) value = 0;
    if (field === "quantity" && items[index].productId) {
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
    setComboDiscount(0);
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
      if (!settings?.liteMode) {
        for (const item of items) {
          const product = activeProducts.find((p) => p.id === item.productId);
          const stock = product?.quantityInStock ?? 0;
          if (item.quantity > stock) {
            throw new Error(`Insufficient stock for ${item.productName}. Available: ${stock}`);
          }
        }
      }

      if (settings.loyaltyEnabled && redeemPoints > 0 && redeemPoints < (settings.minRedemptionPoints ?? 0)) {
        throw new Error(`Minimum ${settings.minRedemptionPoints} points required to redeem`);
      }

      const cName = walkin ? "Walk-in Customer" : customerName;
      const cPhone = walkin ? "" : customerPhone;
      const saleType = balanceDue > 0 ? (receivedAmount > 0 ? "partial" : "credit") : "cash";
      const effectiveReceived = paymentMode === "cash" || paymentMode === "qr" ? finalAmount : receivedAmount;

      // FIFO: consume layers and compute actual costs (skipped in lite mode)
      const fifoCosts: Record<string, { avgCost: number; totalCost: number }> = {};
      if (!settings?.liteMode) {
        for (const item of items) {
          const totalCost = await consumeFifo(item.productId, item.quantity);
          fifoCosts[item.productId] = { avgCost: totalCost / item.quantity, totalCost };
        }
      }
      const totalCogs = Object.values(fifoCosts).reduce((s, c) => s + c.totalCost, 0);

      const saleId = await generateId("SALE");
      await setDoc(doc(db, "sales", saleId), {
        orderId: "",
        saleType,
        customer: { name: cName, phone: cPhone, address: "", email: "" },
        items: items.map((item) => {
          const product = settings?.liteMode ? null : activeProducts.find((p) => p.id === item.productId);
          return {
            productId: item.productId, productName: item.productName, sku: product?.sku || "",
            quantity: item.quantity, unitPrice: item.unitPrice, weight: product?.weight || 0,
            purity: product?.purity || "", makingCharge: product?.makingCharge || 0,
            subtotal: item.subtotal, costPriceAtSale: fifoCosts[item.productId]?.avgCost || 0,
          };
        }),
        totalAmount,
        discountAmount: discount,
        finalAmount,
        payment: { method: paymentMode === "partial" ? (receivedAmount > 0 ? "partial" : "credit") : paymentMode, receivedAmount: effectiveReceived, balanceDue },
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
            const product = settings?.liteMode ? null : activeProducts.find((p) => p.id === item.productId);
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
          cashReceived: effectiveReceived, balanceDue,
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

      if (!settings?.liteMode) {
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
      }

      try {
        if (effectiveReceived > 0) {
          await addDoc(collection(db, "accountTransactions"), {
            accountId: "cash_in_hand", type: "credit", amount: effectiveReceived,
            description: `POS sale to ${cName}`, date: Timestamp.fromDate(new Date()),
            referenceType: "sale", referenceId: saleId, recordedBy: user?.uid || "", createdAt: Timestamp.fromDate(new Date()),
          });
        }
      } catch (e) { console.error("Account transaction failed", e); }

      try {
        const saleData: Sale = {
          id: saleId, orderId: "", saleType,
          customer: { name: cName, phone: cPhone, address: "", email: "" },
          items: items.map((item) => {
            const product = settings?.liteMode ? null : activeProducts.find((p) => p.id === item.productId);
            return {
              productId: item.productId, productName: item.productName, sku: product?.sku || "",
              quantity: item.quantity, unitPrice: item.unitPrice, weight: product?.weight || 0,
              purity: product?.purity || "", makingCharge: product?.makingCharge || 0,
              subtotal: item.subtotal, costPriceAtSale: fifoCosts[item.productId]?.avgCost || 0,
            };
          }),
          totalAmount, discountAmount: discount, finalAmount,
          payment: { method: paymentMode === "partial" ? (receivedAmount > 0 ? "partial" : "credit") : paymentMode, receivedAmount: effectiveReceived, balanceDue },
          warranty: { period: "", terms: "", startDate: Date.now(), endDate: Date.now() },
          couponIssued: null, notes: "", saleDate: Date.now(),
          recordedBy: user?.uid || "", recordedByName: profile?.displayName || "",
          createdAt: Date.now(), updatedAt: Date.now(),
        };
        const je = buildSaleJournal(saleData, profile?.displayName || "");
        await createJournalEntry(je);
        const cogsJe = buildSaleCogsJournal(saleData, totalCogs, profile?.displayName || "");
        await createJournalEntry(cogsJe);
      } catch (e) { console.error("Journal entry failed", e); }

      try {
        if (balanceDue > 0) {
          const debtorId = await generateId("DEBT");
          await setDoc(doc(db, "debtors", debtorId), {
            customerName: cName, customerPhone: cPhone, customerAddress: "",
            totalAmount: finalAmount, amountPaid: effectiveReceived, balanceDue,
            dueDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
            orderIds: [saleId], status: "active",
            paymentHistory: effectiveReceived > 0
              ? [{ date: Timestamp.fromDate(new Date()), amount: effectiveReceived, method: "cash", notes: "Initial payment" }]
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

      // Loyalty points: earn, redeem, and log to GAS
      let earned = 0;
      let finalLoyaltyPoints: number | undefined;
      try {
        if (settings.loyaltyEnabled && !walkin && customerPhone) {
          earned = Math.floor(finalAmount * (settings.pointsPerRupee ?? 0.01));
          if (earned > 0 || redeemPoints > 0) {
            const custQuery = query(collection(db, "customers"), where("phone", "==", customerPhone));
            const custSnap = await getDocs(custQuery);
            if (custSnap.docs.length > 0) {
              const custDoc = custSnap.docs[0];
              const data = custDoc.data();
              const currentPoints = data.loyaltyPoints || 0;
              const deduction = Math.min(redeemPoints, currentPoints);
              finalLoyaltyPoints = Math.max(0, currentPoints - deduction + earned);
              await updateDoc(doc(db, "customers", custDoc.id), {
                loyaltyPoints: finalLoyaltyPoints,
                lifetimePoints: (data.lifetimePoints || 0) + earned,
                updatedAt: Timestamp.fromDate(new Date()),
              });
            } else if (customerName && earned > 0) {
              finalLoyaltyPoints = earned;
              const custId = await generateId("CUST");
              await setDoc(doc(db, "customers", custId), {
                name: customerName, phone: customerPhone, email: "", address: "", notes: "",
                loyaltyPoints: earned, lifetimePoints: earned,
                createdAt: Timestamp.fromDate(new Date()), updatedAt: Timestamp.fromDate(new Date()),
              });
            }
            // Fire-and-forget to GAS for history (atomic batch)
            if (earned > 0 || redeemPoints > 0) {
              import("@/lib/loyalty-gas").then((m) => {
                m.batchTransaction(customerPhone, earned, redeemPoints, saleId, "sale", "POS sale");
              });
            }
          }
        }
      } catch (e) { console.error("Loyalty points update failed", e); }

      setSuccess(true);
      setLastReceipt({
        shopName: settings.shopName || "Shop",
        shopAddress: settings.address || "",
        shopPhone: settings.phone || "",
        date: new Date().toLocaleDateString("en-IN"),
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        receiptNo: saleId,
        customerName: cName,
        customerPhone: cPhone,
        items: items.map((i) => ({ name: i.productName, qty: i.quantity, price: i.unitPrice, subtotal: i.subtotal })),
        subtotal: totalAmount,
        discount,
        total: finalAmount,
        paid: effectiveReceived,
        change: Math.max(0, effectiveReceived - finalAmount),
        paymentMethod: paymentMode === "qr" ? "QR" : paymentMode === "cash" ? "Cash" : "Partial",
        recordedBy: profile?.displayName || "Staff",
        earnedPoints: earned > 0 ? earned : undefined,
        redeemedPoints: redeemPoints > 0 ? redeemPoints : undefined,
        loyaltyPoints: finalLoyaltyPoints,
      });
      clearForm();
      setTimeout(() => { setSuccess(false); }, 3000);
    } catch (e: any) {
      setError(e?.message || "Sale failed");
    }
    setSaving(false);
  };

  return (
    <AdminLayout>
      <div className="h-dvh flex flex-col overflow-hidden pl-5 pb-[50px]">
        {/* Screen reader live region */}
        <div ref={announceRef} tabIndex={-1} className="sr-only" aria-live="assertive" role="status">
          {success ? "Sale recorded successfully. Ready for next customer." : error ? `Error: ${error}` : ""}
        </div>

        {/* Banners */}
        {(success || error) && (
          <div className="shrink-0 px-4 pt-2">
            {success && (
              <div role="status" className="flex items-center gap-2 bg-green-50 border border-green-300 text-green-800 px-4 py-2 rounded-lg text-sm font-medium">
                <CheckCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Sale recorded! Ready for next customer.</span>
              </div>
            )}
            {error && (
              <div role="alert" className="flex items-center gap-2 bg-red-50 border border-red-300 text-red-800 px-4 py-2 rounded-lg text-sm font-medium">
                <X className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Top row: Customer + Search (fixed) */}
        <div className="shrink-0 px-4 pt-3 pb-2 space-y-2">
          {/* Customer */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={walkin} onChange={(e) => setWalkin(e.target.checked)}
                className="accent-primary w-5 h-5 rounded" />
              <span className="text-sm lg:text-xs font-semibold text-secondary">Walk-in Customer</span>
            </label>
            {!walkin && (
              <div className="flex flex-col lg:flex-row gap-1.5 w-full lg:w-auto">
                <div className="flex flex-col gap-0.5">
                  <label htmlFor="cust-name" className="text-xs text-muted-foreground">Name</label>
                  <input id="cust-name" type="text" placeholder="Customer Name" value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full lg:w-32 px-3 py-2 lg:px-2 lg:py-1.5 border-2 border-border rounded-md text-sm lg:text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label htmlFor="cust-phone" className="text-xs text-muted-foreground">Mobile No.</label>
                  <input id="cust-phone" type="tel" placeholder="Mobile Number" value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    maxLength={10}
                    className="w-full lg:w-32 px-3 py-2 lg:px-2 lg:py-1.5 border-2 border-border rounded-md text-sm lg:text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                </div>
              </div>
            )}
          </div>

          {settings?.liteMode ? (
            <div className="space-y-2">
              <div className="flex flex-col gap-2 lg:grid lg:grid-cols-4 lg:gap-3 lg:items-start">
                <div className="relative">
                  <input type="text" value={liteItemName}
                    onChange={(e) => { setLiteItemName(e.target.value); setLiteSuggestions(filterLiteNames(e.target.value)); }}
                    placeholder="Item name" autoComplete="off"
                    className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm focus:border-primary outline-none" />
                  {liteSuggestions.length > 0 && (
                    <div className="mt-1 border border-border rounded-lg divide-y divide-border max-h-32 overflow-y-auto bg-white shadow-lg absolute z-10 w-full">
                      {liteSuggestions.map((name, i) => (
                        <button key={i} type="button" onMouseDown={() => { setLiteItemName(name); setLiteSuggestions([]); }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted">{name}</button>
                      ))}
                    </div>
                  )}
                </div>
                <input type="number" value={liteItemPrice || ""}
                  onChange={(e) => setLiteItemPrice(Number(e.target.value))}
                  placeholder="Price (Rs.)" min={0} className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm focus:border-primary outline-none" />
                <input type="number" value={liteItemQty || ""}
                  onChange={(e) => setLiteItemQty(Number(e.target.value))}
                  placeholder="Qty" min={1} className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm focus:border-primary outline-none" />
                <button type="button" onClick={addLiteItem} disabled={!liteItemName || !liteItemPrice || !liteItemQty}
                  className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 lg:h-11 lg:self-start">
                  Add
                </button>
              </div>
            </div>
          ) : (
          <>
          <div className="relative">
            <label htmlFor="product-search" className="sr-only">Search products</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 lg:h-4 lg:w-4 text-muted-foreground" aria-hidden="true" />
            <input id="product-search" ref={searchRef} type="search" autoComplete="off"
              placeholder="Search product name or SKU..." value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredProducts.length > 0) { addItem(filteredProducts[0]); }
              }}
              className="w-full pl-11 lg:pl-9 pr-12 py-3 lg:py-1.5 border-2 border-border rounded-lg text-base lg:text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
            <button type="button" onClick={() => setShowScanner(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
              title="Scan barcode with camera">
              <Camera className="h-5 w-5 lg:h-4 lg:w-4" />
            </button>
          </div>

          {/* Search results dropdown */}
          {filteredProducts.length > 0 && (
            <div className="mt-1 border-2 border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto" role="listbox" aria-label="Matching products">
              {filteredProducts.map((p) => (
                <button key={p.id} role="option" aria-selected={false}
                  onClick={() => addItem(p)}
                  className="w-full flex items-center justify-between px-4 py-3 lg:px-3 lg:py-1.5 text-sm lg:text-xs hover:bg-primary/5 focus:bg-primary/5 outline-none focus:ring-2 focus:ring-inset focus:ring-primary text-left">
                  <span className="font-medium truncate text-secondary">
                    {p.name}
                    {p.comboItems?.length ? <span className="ml-1.5 text-[10px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-semibold align-middle">Combo</span> : null}
                  </span>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    Rs. {formatNumber(p.price)}
                    {p.quantityInStock !== undefined && <span className="ml-1.5">(S: {p.quantityInStock})</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
          </>
          )}

          {/* Category filter buttons */}
          {!settings?.liteMode && categories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              <button onClick={() => setSelectedCategory("")}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  !selectedCategory
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-muted-foreground border-border hover:border-primary hover:text-primary"
                }`}>
                All
              </button>
              {categories.slice(0, 10).map((cat) => (
                <button key={cat.id} onClick={() => setSelectedCategory(selectedCategory === cat.id ? "" : cat.id)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-muted-foreground border-border hover:border-primary hover:text-primary"
                  }`}>
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product quick-add grid (non-lite mode, shown after search) */}
        {!settings?.liteMode && selectedCategory && categoryProducts.length > 0 && (
          <div className="shrink-0 px-4 pb-2">
            <div className="bg-white border border-border rounded-xl p-2 shadow-sm">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-xs font-semibold text-secondary">{categoryMap.get(selectedCategory) || selectedCategory}</span>
                <button onClick={() => setSelectedCategory("")}
                  className="text-[10px] text-muted-foreground hover:text-primary">✕ Clear</button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {categoryProducts.map((p) => (
                  <button key={p.id} onClick={() => addItem(p)}
                    disabled={(p.quantityInStock ?? 0) <= 0}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border hover:bg-primary/5 hover:border-primary text-[11px] disabled:opacity-30 disabled:cursor-not-allowed">
                    <span className="font-medium text-secondary truncate max-w-24">{p.name}</span>
                    <span className="text-muted-foreground shrink-0">Rs.{formatNumber(p.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col lg:flex-row gap-3 px-4 pb-3 overflow-hidden min-h-0">
          {/* Left: Cart items (scrollable) */}
          <section aria-label="Cart items" ref={summaryRef} className="flex-1 flex flex-col min-w-0 min-h-[120px] lg:min-h-0 pb-20 lg:pb-0">
            <div className="flex-1 bg-white border border-border rounded-xl p-3 shadow-sm flex flex-col min-h-0">
              <h2 className="text-xs font-semibold text-secondary mb-2 shrink-0">
                Items ({items.length})
                {selectedCategory && <span className="ml-2 text-[10px] text-muted-foreground font-normal">from <span className="font-medium">{selectedCategory}</span></span>}
              </h2>
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground text-xs py-6">Search and add products above</p>
              ) : (
                <ul className="flex-1 overflow-y-auto space-y-2 min-h-0" role="list">
                  {items.map((item, idx) => (
                    <li key={`${item.productId}-${idx}`}
                      className="p-3 border border-border rounded-lg bg-white shadow-sm text-xs">
                      <div className="flex items-start justify-between gap-2 mb-1.5 lg:hidden">
                        <p className="font-semibold text-secondary leading-tight truncate">{item.productName}</p>
                        <button onClick={() => removeItem(idx)}
                          aria-label={`Remove ${item.productName}`}
                          className="p-1 text-red-500 hover:bg-red-50 rounded shrink-0 focus:ring-2 focus:ring-red-300 outline-none">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      {/* Mobile: 2-column grid */}
                      <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 lg:hidden">
                        <span className="text-xs text-muted-foreground">Price (Rs.)</span>
                        <input type="number" value={item.unitPrice}
                          onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                          min={0} step={10}
                          className="w-full text-xs border border-border rounded py-1 px-2 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-right" />
                        <span className="text-xs text-muted-foreground">Qty</span>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => updateItem(idx, "quantity", item.quantity - 1)}
                            aria-label={`Decrease qty of ${item.productName}`}
                            className="p-1 rounded border border-border hover:bg-muted focus:ring-2 focus:ring-primary outline-none">
                            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <input type="number" value={item.quantity}
                            onChange={(e) => updateItem(idx, "quantity", Math.max(1, Number(e.target.value)))}
                            min={1}
                            className="w-12 text-center text-xs border border-border rounded py-1 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                          <button onClick={() => updateItem(idx, "quantity", item.quantity + 1)}
                            aria-label={`Increase qty of ${item.productName}`}
                            className="p-1 rounded border border-border hover:bg-muted focus:ring-2 focus:ring-primary outline-none">
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        <span className="text-xs text-muted-foreground">Subtotal</span>
                        <p className="font-semibold text-secondary text-xs text-right">Rs. {formatNumber(item.subtotal)}</p>
                      </div>
                      {/* Desktop: horizontal row */}
                      <div className="hidden lg:flex lg:items-center lg:gap-3">
                        <p className="font-semibold text-secondary truncate flex-1 min-w-0">{item.productName}</p>
                        <button onClick={() => removeItem(idx)}
                          aria-label={`Remove ${item.productName}`}
                          className="p-1 text-red-500 hover:bg-red-50 rounded shrink-0 focus:ring-2 focus:ring-red-300 outline-none">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <div className="w-24">
                          <input type="number" value={item.unitPrice}
                            onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                            min={0} step={10}
                            className="w-full text-xs border border-border rounded py-1.5 px-2 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-right" />
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateItem(idx, "quantity", item.quantity - 1)}
                            aria-label={`Decrease qty of ${item.productName}`}
                            className="p-1.5 rounded border border-border hover:bg-muted focus:ring-2 focus:ring-primary outline-none">
                            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <input type="number" value={item.quantity}
                            onChange={(e) => updateItem(idx, "quantity", Math.max(1, Number(e.target.value)))}
                            min={1}
                            className="w-12 text-center text-xs border border-border rounded py-1.5 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                          <button onClick={() => updateItem(idx, "quantity", item.quantity + 1)}
                            aria-label={`Increase qty of ${item.productName}`}
                            className="p-1.5 rounded border border-border hover:bg-muted focus:ring-2 focus:ring-primary outline-none">
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        <p className="font-semibold text-secondary text-xs w-20 text-right">Rs. {formatNumber(item.subtotal)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Right: Payment + Discount + Coupon + Summary (fixed column) */}
          <section aria-label="Payment and discounts" className="w-full lg:w-80 shrink-0 flex flex-col gap-2 overflow-y-auto min-h-0 pb-16 lg:pb-0">
            {/* Payment */}
            <div className="bg-white border border-border rounded-xl p-3 shadow-sm">
              <button onClick={() => setMobilePaymentOpen(!mobilePaymentOpen)}
                className="flex items-center justify-between w-full lg:cursor-default">
                <span className="text-xs font-semibold text-secondary">Payment</span>
                <div className="flex gap-1" role="radiogroup" aria-label="Payment mode" onClick={(e) => e.stopPropagation()}>
                  {(["cash", "qr", "partial"] as PaymentMode[]).map((mode) => (
                    <button key={mode} role="radio" aria-checked={paymentMode === mode}
                      onClick={() => { setPaymentMode(mode); if (mode !== "partial") setReceivedAmount(0); }}
                      className={`px-3 lg:px-2.5 py-1.5 lg:py-1 text-xs lg:text-[11px] rounded-full border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                        paymentMode === mode
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-secondary border-border hover:bg-muted"
                      }`}>
                      {mode === "partial" ? "Partial" : mode === "qr" ? "QR" : "Cash"}
                    </button>
                  ))}
                </div>
              </button>
              {(mobilePaymentOpen || window.innerWidth >= 1024) && paymentMode === "partial" && (
                <div className="flex items-center gap-1.5 mt-2">
                  <label htmlFor="received-amount" className="text-xs lg:text-[11px] text-muted-foreground">Received:</label>
                  <input id="received-amount" type="number" value={receivedAmount || ""}
                    onChange={(e) => setReceivedAmount(Math.max(0, Number(e.target.value)))}
                    min={0} placeholder="0"
                    className="flex-1 lg:w-20 px-3 py-2 lg:px-2 lg:py-1 border-2 border-border rounded text-sm lg:text-xs text-right focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                </div>
              )}
            </div>

            {/* Discount */}
            <div className="bg-white border border-border rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Percent className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="text-xs font-semibold text-secondary">Discount</span>
                <div className="flex gap-1 ml-auto" role="radiogroup" aria-label="Discount type">
                  <button role="radio" aria-checked={manualDiscountType === "percentage"}
                    onClick={() => setManualDiscountType("percentage")}
                    className={`px-3 lg:px-2 py-1.5 lg:py-1 text-xs lg:text-[11px] rounded-full border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                      manualDiscountType === "percentage"
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-secondary border-border hover:bg-muted"
                    }`}>%</button>
                  <button role="radio" aria-checked={manualDiscountType === "fixed"}
                    onClick={() => setManualDiscountType("fixed")}
                    className={`px-3 lg:px-2 py-1.5 lg:py-1 text-xs lg:text-[11px] rounded-full border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                      manualDiscountType === "fixed"
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-secondary border-border hover:bg-muted"
                    }`}>Rs.</button>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <input id="manual-discount" type="number" value={manualDiscountValue || ""}
                  onChange={(e) => setManualDiscountValue(Math.max(0, Number(e.target.value)))}
                  min={0} placeholder="0"
                  className="flex-1 px-3 lg:px-2.5 py-2 lg:py-1.5 border-2 border-border rounded text-sm lg:text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                {manualDiscountValue > 0 && (
                  <span className="text-xs lg:text-[11px] font-medium text-green-700 shrink-0">
                    −{formatNumber(manualDiscountType === "percentage"
                      ? Math.min((totalAmount * manualDiscountValue) / 100, totalAmount)
                      : Math.min(manualDiscountValue, totalAmount))}
                  </span>
                )}
              </div>
            </div>

            {/* Redeem Points */}
            {settings.loyaltyEnabled && customerPoints !== null && customerPoints > 0 && (
              <div className="bg-white border border-border rounded-xl p-3 shadow-sm">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-xs font-semibold text-secondary">Redeem Points</span>
                  <span className="text-xs text-muted-foreground ml-auto">{customerPoints} pts available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input type="number" value={redeemPoints || ""}
                    onChange={(e) => setRedeemPoints(Math.min(Math.max(0, Number(e.target.value)), customerPoints))}
                    min={0} max={customerPoints} placeholder="0"
                    className="flex-1 px-3 lg:px-2.5 py-2 lg:py-1.5 border-2 border-border rounded text-sm lg:text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                  {redeemPoints > 0 && (
                    <span className="text-xs lg:text-[11px] font-medium text-green-700 shrink-0">
                      −{formatNumber(redeemPoints * (settings.pointValue ?? 0.5))}
                    </span>
                  )}
                </div>
                {(settings.minRedemptionPoints ?? 100) > 0 && customerPoints < (settings.minRedemptionPoints ?? 100) && (
                  <p className="text-[10px] text-muted-foreground mt-1">Min. {settings.minRedemptionPoints} pts to redeem</p>
                )}
                {redeemPoints > 0 && (settings.minRedemptionPoints ?? 0) > 0 && redeemPoints < (settings.minRedemptionPoints ?? 0) && (
                  <p className="text-[10px] text-red-500 mt-1">Minimum {settings.minRedemptionPoints} pts required</p>
                )}
              </div>
            )}

            {/* Coupon */}
            <div className="bg-white border border-border rounded-xl p-3 shadow-sm">
              <button onClick={() => setMobileCouponOpen(!mobileCouponOpen)}
                className="flex items-center justify-between w-full lg:hidden mb-1">
                <span className="text-xs font-semibold text-secondary">Coupon</span>
                <span className="text-[11px] text-muted-foreground">{mobileCouponOpen ? "▲" : "▼"}</span>
              </button>
              {(mobileCouponOpen || true) && (<>
              {appliedCoupon && (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 lg:px-2.5 py-2 lg:py-1.5 mb-1.5">
                  <span className="text-xs lg:text-[11px] font-semibold text-green-800 truncate">
                    {appliedCoupon.code} ({appliedCoupon.discountType === "percentage" ? `${appliedCoupon.discountValue}%` : `Rs. ${formatNumber(appliedCoupon.discountValue)}`})
                  </span>
                  <button onClick={() => { setAppliedCoupon(null); setCouponCodeInput(""); setCouponApplyError(""); }}
                    className="text-xs lg:text-[11px] font-medium text-red-600 hover:underline shrink-0 ml-1">✕</button>
                </div>
              )}
              {issueDiscountValue > 0 && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 lg:px-2.5 py-2 lg:py-1.5 mb-1.5">
                  <span className="text-xs lg:text-[11px] font-semibold text-blue-800">
                    Issue: {issueDiscountType === "percentage" ? `${issueDiscountValue}% off` : `Rs. ${formatNumber(issueDiscountValue)} off`}
                  </span>
                  <button onClick={() => { setIssueDiscountValue(0); setIssueDiscountType("percentage"); }}
                    className="text-xs lg:text-[11px] font-medium text-red-600 hover:underline shrink-0 ml-1">✕</button>
                </div>
              )}
              <div className="flex gap-1.5">
                <input id="coupon-code" type="text" value={couponCodeInput}
                  onChange={(e) => { setCouponCodeInput(e.target.value.toUpperCase()); setCouponApplyError(""); }}
                  placeholder="Coupon code..."
                  className="flex-1 px-3 lg:px-2.5 py-2 lg:py-1.5 border-2 border-border rounded text-sm lg:text-xs font-mono uppercase focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                <Button onClick={() => applyCouponCode(couponCodeInput)}
                  disabled={!couponCodeInput.trim()}
                  variant="accent" size="sm" className="px-3 lg:px-2.5 py-2 lg:py-1 text-sm lg:text-[11px] h-auto min-h-0">
                  Apply
                </Button>
              </div>
              {couponApplyError && (
                <p className="text-xs lg:text-[11px] text-red-600 font-medium mt-1" role="alert">{couponApplyError}</p>
              )}
              <button onClick={() => setShowIssuePopup(true)}
                className="text-xs lg:text-[11px] text-muted-foreground hover:text-primary font-medium mt-1 hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded px-0.5">
                Issue new &rarr;
              </button>
              </>)}
            </div>

            {/* Summary + Record (sticky at bottom) */}
            <div className="bg-white border-2 border-border rounded-xl p-3 shadow-sm mt-auto space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-secondary">Rs. {formatNumber(totalAmount)}</span>
              </div>
              {manualDiscountValue > 0 && (
                <div className="flex justify-between text-[11px] text-green-700">
                  <span>Discount{manualDiscountType === "percentage" ? ` (${manualDiscountValue}%)` : ""}</span>
                  <span>− Rs. {formatNumber(manualDiscountType === "percentage"
                    ? Math.min((totalAmount * manualDiscountValue) / 100, totalAmount)
                    : Math.min(manualDiscountValue, totalAmount))}</span>
                </div>
              )}
              {redeemDiscount > 0 && (
                <div className="flex justify-between text-[11px] text-orange-700">
                  <span>Redeem Points</span>
                  <span>− Rs. {formatNumber(redeemDiscount)}</span>
                </div>
              )}
              {comboDiscount > 0 && (
                <div className="flex justify-between text-[11px] text-purple-700">
                  <span>Combo Discount</span>
                  <span>− Rs. {formatNumber(comboDiscount)}</span>
                </div>
              )}
              {appliedCoupon && (
                <div className="flex justify-between text-[11px] text-green-700">
                  <span>Coupon ({appliedCoupon.code})</span>
                  <span>− Rs. {formatNumber(appliedCoupon.discountType === "percentage"
                    ? Math.min((totalAmount * appliedCoupon.discountValue) / 100, appliedCoupon.maxDiscount || Infinity)
                    : appliedCoupon.discountValue)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-secondary border-t-2 border-border pt-2">
                <span>Total</span>
                <span>Rs. {formatNumber(finalAmount)}</span>
              </div>
              {balanceDue > 0 && (
                <div className="flex justify-between text-[11px] text-red-600 font-semibold">
                  <span>Balance Due</span>
                  <span>Rs. {formatNumber(balanceDue)}</span>
                </div>
              )}
              {/* Desktop Record button */}
              <div className="hidden lg:block">
                <Button onClick={handleSave} disabled={saving || items.length === 0} variant="accent"
                  className="w-full py-3 text-sm font-bold">
                  <CheckCircle className="h-5 w-5" aria-hidden="true" /> {saving ? "Recording..." : "Record Sale"}
                </Button>
              </div>
            </div>
          </section>
        </div>

        {/* Mobile sticky bottom bar */}
        <div className="lg:hidden fixed bottom-14 left-0 right-0 z-[60] bg-white border-t-2 border-border px-4 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs text-muted-foreground">
              <span>{items.length} item{items.length !== 1 ? "s" : ""}</span>
              {discount > 0 && <span className="ml-2 text-green-700">−{formatNumber(discount)}</span>}
            </div>
            <span className="text-base font-bold text-secondary">Rs. {formatNumber(finalAmount)}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={clearForm} disabled={items.length === 0}
              className="px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground font-medium hover:bg-muted disabled:opacity-30 shrink-0">
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </button>
            <Button onClick={handleSave} disabled={saving || items.length === 0} variant="accent"
              className="flex-1 py-3 text-sm font-bold">
              <CheckCircle className="h-5 w-5" aria-hidden="true" /> {saving ? "Recording..." : "Record Sale"}
            </Button>
          </div>
        </div>
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
      {showScanner && (
        <BarcodeScannerDialog
          onScan={(value) => {
            const found = activeProducts.find((p) => p.sku === value.trim() || p.shortCode === value.trim() || p.barcodeId === value.trim());
            if (found) addItem(found);
            else setProductSearch(value.trim());
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
      {lastReceipt && (
        <ReceiptPrint data={lastReceipt} onClose={() => setLastReceipt(null)} />
      )}
    </AdminLayout>
  );
}


