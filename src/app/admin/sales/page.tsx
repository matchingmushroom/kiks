"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { Sale, Product, Order, Customer, Invoice } from "@/types";
import { formatCurrency, formatDate, formatDateTime, generateCouponCode, toDate, getUseBsCalendar } from "@/lib/utils";
import { getFiscalYearStartEpoch } from "@/lib/nepaliDate";
import { generateId } from "@/lib/id-generator";
import { resolveAccount, ACCOUNTS } from "@/lib/accounts";
import { useAuth } from "@/contexts/AuthContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { Button } from "@/components/ui/button";
import {
  addDoc, collection, updateDoc, doc, setDoc, Timestamp, getDoc, getDocs, deleteDoc, query, where, limit, arrayRemove, onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDataCache } from "@/hooks/useFirestore";
import { Plus, Search, X, Save, CheckCircle, AlertTriangle, LayoutGrid, List, ExternalLink, Eye, Trash2, RotateCcw, Printer, Download, Mail } from "lucide-react";
import Link from "next/link";
import { exportSalesCSV, downloadBlob } from "@/lib/export";

interface LineItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  weight: number;
  purity?: string;
  makingCharge: number;
  subtotal: number;
}

const emptyForm = {
  customerName: "", customerPhone: "", customerAddress: "",
  items: [] as LineItem[],
  totalAmount: 0, discountAmount: 0, finalAmount: 0,
  paymentMethod: "cash", receivedAmount: 0, balanceDue: 0,
  warrantyPeriod: "", warrantyTerms: "",
  couponType: "none" as "none" | "fixed" | "percentage",
  couponValue: 0, notes: "",
};

function SalesContent() {
  const { refreshCollection } = useDataCache();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("orderId");
  const customerFilter = searchParams.get("customer");
  const returnDiscount = searchParams.get("returnDiscount");
  const returnCustomer = searchParams.get("returnCustomer");
  const returnPhone = searchParams.get("returnPhone");

  const { data: sales, loading } = useFirestore<Sale>("sales", {
    constraints: [orderBy("saleDate", "desc"), limit(300)],
    realtime: false, cache: true,
  });
  const { data: products } = useFirestore<Product>("products", {
    constraints: [orderBy("name", "asc")],
    realtime: false, cache: true,
  });
  const { data: allCustomers } = useFirestore<Customer>("customers", {
    constraints: [orderBy("name", "asc"), limit(200)],
    realtime: false, cache: true,
  });
  const { user, profile } = useAuth();

  const [search, setSearch] = useState(customerFilter || "");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSale, setSavedSale] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [manualCustomer, setManualCustomer] = useState(false);
  const [orderData, setOrderData] = useState<Order | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const [detailSaleData, setDetailSaleData] = useState<Sale | null>(null);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [returnQtys, setReturnQtys] = useState<Record<number, number>>({});
  const [returnType, setReturnType] = useState<"refund" | "exchange">("refund");
  const { settings: saleSettings } = useShopSettings();
  const [archiveResults, setArchiveResults] = useState<Sale[] | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const searchArchive = async () => {
    if (!saleSettings.gasWebhookUrl) { alert("Configure GAS Webhook URL in Settings first."); return; }
    setArchiveLoading(true);
    setShowArchive(true);
    try {
      const res = await fetch(saleSettings.gasWebhookUrl, {
        method: "POST",
        body: JSON.stringify({ action: "queryArchivedRange", collection: "sales", start: "1970-01-01", end: new Date().toISOString().slice(0, 10) }),
      });
      const data = await res.json();
      setArchiveResults((data.docs || []) as Sale[]);
    } catch { setArchiveResults([]); }
    setArchiveLoading(false);
  };
  const [savingReturn, setSavingReturn] = useState(false);
  const [invoicePreviewId, setInvoicePreviewId] = useState<string | null>(null);
  const [invoicePreviewData, setInvoicePreviewData] = useState<Invoice | null>(null);
  const [showReturned, setShowReturned] = useState(false);
  const [reportRange, setReportRange] = useState<"all" | "ytd" | "mtd" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const canExport = profile?.role !== "staff";

  // Live-update sale detail modal when the sale doc changes
  useEffect(() => {
    if (!detailSaleId) { setDetailSaleData(null); return; }
    const unsub = onSnapshot(doc(db, "sales", detailSaleId), (snap) => {
      if (snap.exists()) setDetailSaleData({ id: snap.id, ...snap.data() } as Sale);
    });
    return () => unsub();
  }, [detailSaleId]);

  // Live-fetch invoice data for preview modal
  useEffect(() => {
    if (!invoicePreviewId) { setInvoicePreviewData(null); return; }
    const unsub = onSnapshot(doc(db, "invoices", invoicePreviewId), (snap) => {
      if (snap.exists()) setInvoicePreviewData({ id: snap.id, ...snap.data() } as Invoice);
    });
    return () => unsub();
  }, [invoicePreviewId]);

  const filteredSales = useMemo(() => {
    let result = sales;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) =>
        s.customer?.name?.toLowerCase().includes(q) ||
        s.customer?.phone?.includes(q) ||
        s.notes?.toLowerCase().includes(q)
      );
    }
    if (paymentFilter !== "all") {
      result = result.filter((s) =>
        paymentFilter === "paid" ? !s.payment?.balanceDue || s.payment.balanceDue <= 0
        : paymentFilter === "due" ? (s.payment?.balanceDue || 0) > 0
        : true
      );
    }
    if (!showReturned) {
      result = result.filter((s) => !s.returned);
    }
    let start = 0, end = Infinity;
    if (reportRange === "ytd") {
      start = getUseBsCalendar() ? getFiscalYearStartEpoch() : new Date(new Date().getFullYear(), 0, 1).getTime();
    } else if (reportRange === "mtd") {
      start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    } else if (reportRange === "custom" && dateFrom && dateTo) {
      start = new Date(dateFrom).getTime();
      end = new Date(dateTo).getTime() + 86400000;
    }
    if (start > 0 || end < Infinity) {
      result = result.filter((s) => {
        const d = toDate(s.saleDate).getTime();
        return d >= start && d <= end;
      });
    }
    return result;
  }, [sales, search, paymentFilter, reportRange, dateFrom, dateTo]);

  useEffect(() => {
    if (returnDiscount && returnCustomer) {
      setShowForm(true);
      setForm({
        ...emptyForm,
        customerName: returnCustomer,
        customerPhone: returnPhone || "",
        discountAmount: Number(returnDiscount),
      });
    }
  }, [returnDiscount, returnCustomer, returnPhone]);

  useEffect(() => {
    if (orderId) {
      setShowForm(true);
      setLoadingOrder(true);
      const fetchOrder = async () => {
        try {
          const snap = await getDoc(doc(db, "orders", orderId));
          if (snap.exists()) {
            const order = { id: snap.id, ...snap.data() } as Order;
            setOrderData(order);
            const items: LineItem[] = (order.items || []).map((item) => ({
              productId: item.productId,
              productName: item.productName,
              sku: item.sku || "",
              quantity: item.quantity,
              unitPrice: item.price,
              weight: item.weight || 0,
              makingCharge: item.makingCharge || 0,
              subtotal: item.subtotal || item.price * item.quantity,
            }));
            const total = items.reduce((s, i) => s + i.subtotal, 0);
            setForm({
              customerName: order.customer?.name || "",
              customerPhone: order.customer?.phone || "",
              customerAddress: order.customer?.address || "",
              items,
              totalAmount: total,
              discountAmount: 0,
              finalAmount: total,
              paymentMethod: "cash",
              receivedAmount: total,
              balanceDue: 0,
              warrantyPeriod: "",
              warrantyTerms: "",
              couponType: "none",
              couponValue: 0,
              notes: order.notes || "",
            });
          }
        } catch (e) {
          console.error("Failed to load order", e);
        }
        setLoadingOrder(false);
      };
      fetchOrder();
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
    const stock = product.quantityInStock ?? 0;
    if (stock <= 0) return;
    const existing = form.items.find((i) => i.productId === product.id);
    if (existing) {
      const newQty = Math.min(existing.quantity + 1, stock);
      const items = form.items.map((i) =>
        i.productId === product.id
          ? { ...i, quantity: newQty, subtotal: newQty * i.unitPrice }
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
      weight: product.weight || 0,
      purity: product.purity || "",
      makingCharge: product.makingCharge || 0,
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
    if (saving || !form.customerName || form.items.length === 0) return;
    setSaving(true);
    setSaleError(null);
    try {
      for (const item of form.items) {
        const product = products.find((p) => p.id === item.productId);
        const stock = product?.quantityInStock ?? 0;
        if (item.quantity > stock) {
          throw new Error(`Insufficient stock for ${item.productName}. Available: ${stock}, requested: ${item.quantity}`);
        }
      }
      const itemsWithCost = form.items.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return { ...item, costPriceAtSale: product?.costPrice || 0 };
      });
      const saleId = await generateId("SALE");
      await setDoc(doc(db, "sales", saleId), {
        orderId: orderId || "",
        saleType: form.balanceDue > 0 ? (form.receivedAmount > 0 ? "partial" : "credit") : "cash",
        customer: { name: form.customerName, phone: form.customerPhone, address: form.customerAddress, email: "" },
        items: itemsWithCost,
        totalAmount: form.totalAmount,
        discountAmount: form.discountAmount,
        finalAmount: form.finalAmount,
        payment: { method: form.paymentMethod, receivedAmount: form.receivedAmount, balanceDue: form.balanceDue },
        warranty: { period: form.warrantyPeriod, terms: form.warrantyTerms, startDate: Timestamp.fromDate(new Date()), endDate: Timestamp.fromDate(new Date()) },
        couponIssued: null,
        notes: form.notes,
        saleDate: Timestamp.fromDate(new Date()),
        recordedBy: user?.uid || "",
        recordedByName: profile?.displayName || "",
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });

      // Auto-invoice on sale — created immediately after sale doc so it's always generated
      let savedInvId: string | null = null;
      try {
        const now = new Date();
        const year = now.getFullYear();
        const invCounterDoc = doc(db, "counters", `invoices_${year}`);
        const invCounterSnap = await getDoc(invCounterDoc);
        let invSeq = 1;
        if (invCounterSnap.exists()) invSeq = (invCounterSnap.data().lastNumber || 0) + 1;
        await setDoc(invCounterDoc, { lastNumber: invSeq, year }, { merge: true });
        const invoiceNumber = `INV-${year}-${String(invSeq).padStart(4, "0")}`;

        const invId = await generateId("INV");
        await setDoc(doc(db, "invoices", invId), {
          invoiceNumber, type: "invoice", status: "draft",
          customer: { name: form.customerName, phone: form.customerPhone, address: form.customerAddress },
          items: itemsWithCost.map((item) => ({
            productId: item.productId, productName: item.productName,
            sku: item.sku || "", description: "",
            quantity: item.quantity, unitPrice: item.unitPrice,
            weight: item.weight || 0, purity: item.purity || "",
            makingCharge: item.makingCharge || 0, subtotal: item.subtotal,
          })),
          subtotal: form.totalAmount, discountAmount: form.discountAmount, totalAmount: form.finalAmount,
          paymentStatus: form.balanceDue > 0 ? "partial" : "full",
          cashReceived: form.receivedAmount, balanceDue: form.balanceDue,
          warranty: { period: form.warrantyPeriod, terms: form.warrantyTerms },
          notes: form.notes,
          termsAndConditions: "Goods once sold cannot be returned.",
          validUntil: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
          relatedSaleId: saleId,
          generatedBy: user?.uid || "",
          createdByName: profile?.displayName || "",
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
        });
        savedInvId = invId;
      } catch (e: any) {
        setInvoiceError("Invoice auto-generation failed: " + (e?.message || "Unknown error"));
        console.error("Auto-invoice failed, sale was still recorded", e);
      }

      for (const item of form.items) {
        try {
          const prodRef = doc(db, "products", item.productId);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const currentStock = prodSnap.data().quantityInStock || 0;
            await updateDoc(prodRef, { quantityInStock: Math.max(0, currentStock - item.quantity) });
          }
          await addDoc(collection(db, "inventoryLogs"), {
            productId: item.productId, changeType: "sale", quantityChange: -item.quantity,
            reason: `Sale to ${form.customerName}`, performedBy: user?.uid || "", createdAt: Timestamp.fromDate(new Date()),
          });
        } catch (e) { console.error("Stock update failed for item", item.productId, e); }
      }

      try {
        if (form.receivedAmount > 0 && form.paymentMethod !== "credit") {
          await addDoc(collection(db, "accountTransactions"), {
            accountId: resolveAccount(form.paymentMethod), type: "credit", amount: form.receivedAmount,
            description: `Sale to ${form.customerName}`, date: Timestamp.fromDate(new Date()),
            referenceType: "sale", referenceId: saleId, recordedBy: user?.uid || "", createdAt: Timestamp.fromDate(new Date()),
          });
        }
      } catch (e) { console.error("Account transaction failed", e); }

      try {
        if (form.balanceDue > 0) {
          const debtorId = await generateId("DEBT");
          await setDoc(doc(db, "debtors", debtorId), {
            customerName: form.customerName, customerPhone: form.customerPhone, customerAddress: form.customerAddress,
            totalAmount: form.finalAmount, amountPaid: form.receivedAmount, balanceDue: form.balanceDue,
            dueDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
            orderIds: [saleId], status: "active",
            paymentHistory: form.receivedAmount > 0
              ? [{ date: Timestamp.fromDate(new Date()), amount: form.receivedAmount, method: form.paymentMethod, notes: "Initial payment" }]
              : [],
            createdAt: Timestamp.fromDate(new Date()), updatedAt: Timestamp.fromDate(new Date()),
          });
        }
      } catch (e) { console.error("Debtor creation failed", e); }

      try {
        if (form.couponType !== "none" && form.couponValue > 0) {
          const siteSnap = await getDoc(doc(db, "shop_settings", "config"));
          const siteUrl = ((siteSnap.data() as Record<string, any>)?.website || "").replace(/\/$/, "");
          const siteText = siteUrl ? `our website ${siteUrl}` : "our website";
          const couponCode = generateCouponCode();
          const discountType = form.couponType === "percentage" ? "percentage" : "fixed";
          const discountValue = form.couponType === "percentage" ? Math.min(form.couponValue, 100) : form.couponValue;
          const terms = `To be Used within 1 Months for purchase through ${siteText} during checkout or at our store's checkout counter`;
          await setDoc(doc(db, "coupons", couponCode), {
            code: couponCode, discountType, discountValue, minPurchaseAmount: 0, maxDiscount: 200,
            validFrom: Timestamp.fromDate(new Date()),
            validUntil: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
            usageLimit: 1, usedCount: 0, isActive: true,
            terms,
            issuedToCustomer: { name: form.customerName, phone: form.customerPhone },
            issuedForOrderId: saleId, createdAt: Timestamp.fromDate(new Date()), createdBy: user?.uid || "",
          });
          if (savedInvId) {
            await updateDoc(doc(db, "invoices", savedInvId), {
              couponIssued: { code: couponCode, discountValue, discountType, terms },
              updatedAt: Timestamp.fromDate(new Date()),
            });
          }
        }
      } catch (e) { console.error("Coupon creation failed", e); }

      try {
        if (orderId) {
          await updateDoc(doc(db, "orders", orderId), { status: "delivered", updatedAt: Timestamp.fromDate(new Date()) });
        }
      } catch (e) { console.error("Order status update failed", e); }

      setSavedInvoiceId(savedInvId);
      setSavedSale(true);
      setForm({ ...emptyForm });
      setShowForm(false);
      setOrderData(null);
      setTimeout(() => { setSavedSale(false); setSavedInvoiceId(null); }, 6000);
    } catch (e: any) {
      setSaleError(e?.message || "Sale failed. Please try again.");
      setForm({ ...emptyForm });
      setShowForm(false);
      setOrderData(null);
      setTimeout(() => setSaleError(null), 6000);
    }
    refreshCollection("sales");
    refreshCollection("inventoryLogs");
    refreshCollection("debtors");
    refreshCollection("invoices");
    setSaving(false);
  };

  const handleDeleteSale = async (id: string) => {
    if (!confirm("Delete this sale? Inventory will be adjusted.")) return;
    const snap = await getDoc(doc(db, "sales", id));
    if (!snap.exists()) return;
    const sale = snap.data() as Sale;
    // Skip restocking if already returned — stock was restored during return
    if (!sale.returned) {
      for (const item of sale.items) {
        const prodRef = doc(db, "products", item.productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          const currentStock = prodSnap.data().quantityInStock || 0;
          await updateDoc(prodRef, { quantityInStock: currentStock + item.quantity });
        }
        await addDoc(collection(db, "inventoryLogs"), {
          productId: item.productId,
          changeType: "sale",
          quantityChange: item.quantity,
          reason: `Sale #${id} deleted`,
          performedBy: user?.uid || "",
          createdAt: Timestamp.fromDate(new Date()),
        });
      }
    }
    // Delete linked invoice
    const invSnap = await getDocs(query(collection(db, "invoices"), where("relatedSaleId", "==", id)));
    for (const inv of invSnap.docs) {
      await deleteDoc(doc(db, "invoices", inv.id));
    }
    // Delete or detach debtor
    const debtorSnap = await getDocs(query(collection(db, "debtors"), where("orderIds", "array-contains", id)));
    for (const d of debtorSnap.docs) {
      const debtorData = d.data();
      if ((debtorData.orderIds?.length || 0) <= 1) {
        await deleteDoc(doc(db, "debtors", d.id));
      } else {
        await updateDoc(doc(db, "debtors", d.id), {
          orderIds: arrayRemove(id),
        });
      }
    }
    // Delete account transactions linked to this sale
    const txSnap = await getDocs(query(collection(db, "accountTransactions"), where("referenceType", "==", "sale"), where("referenceId", "==", id)));
    for (const tx of txSnap.docs) {
      await deleteDoc(doc(db, "accountTransactions", tx.id));
    }
    await deleteDoc(doc(db, "sales", id));
    refreshCollection("sales");
    refreshCollection("inventoryLogs");
    refreshCollection("debtors");
    refreshCollection("invoices");
  };

  const openReturn = (sale: Sale) => {
    setReturnSale(sale);
    const initial: Record<number, number> = {};
    sale.items?.forEach((_, i) => { initial[i] = 0; });
    setReturnQtys(initial);
    setReturnType("refund");
  };

  const returnFullPrice = returnSale?.items?.reduce((sum, item, i) => {
    const qty = returnQtys[i] || 0;
    return sum + qty * item.unitPrice;
  }, 0) || 0;

  const returnTotal = returnSale?.totalAmount || 0;
  const safeTotal = Math.max(returnTotal, 1);
  const returnCashRatio = Math.min(1, (returnSale?.payment?.receivedAmount || 0) / safeTotal);
  const returnCreditRatio = Math.min(1, (returnSale?.payment?.balanceDue || 0) / safeTotal);
  const refundAmount = returnFullPrice * returnCashRatio;

  const handleReturn = async () => {
    if (!returnSale || returnFullPrice <= 0) return;
    setSavingReturn(true);
    try {
      for (let i = 0; i < (returnSale.items?.length || 0); i++) {
        const qty = returnQtys[i] || 0;
        if (qty <= 0) continue;
        const item = returnSale.items[i];
        const prodRef = doc(db, "products", item.productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          const currentStock = prodSnap.data().quantityInStock || 0;
          await updateDoc(prodRef, {
            quantityInStock: currentStock + qty,
            updatedAt: Timestamp.fromDate(new Date()),
          });
        }
        await addDoc(collection(db, "inventoryLogs"), {
          productId: item.productId,
          changeType: "sales_return",
          quantityChange: qty,
          reason: `Return from sale #${returnSale.id}`,
          performedBy: user?.uid || "",
          createdAt: Timestamp.fromDate(new Date()),
        });
      }

      if (returnType === "refund") {
        await addDoc(collection(db, "accountTransactions"), {
          accountId: "cash_in_hand",
          type: "debit",
          amount: refundAmount,
          description: `Sales return refund: ${returnSale.customer?.name}`,
          date: Timestamp.fromDate(new Date()),
          referenceType: "sales_return",
          referenceId: returnSale.id,
          recordedBy: user?.uid || "",
          createdAt: Timestamp.fromDate(new Date()),
        });

        // Adjust debtor balance for the credit portion of returned items
        const creditPortion = returnFullPrice * returnCreditRatio;
        if (creditPortion > 0) {
          const debtorSnap = await getDocs(query(collection(db, "debtors"), where("orderIds", "array-contains", returnSale.id)));
          for (const d of debtorSnap.docs) {
            const data = d.data();
            const newBalance = Math.max(0, (data.balanceDue || 0) - creditPortion);
            await updateDoc(doc(db, "debtors", d.id), {
              balanceDue: newBalance,
              amountPaid: (data.amountPaid || 0) - refundAmount,
              totalAmount: Math.max(0, (data.totalAmount || 0) - returnFullPrice),
              status: newBalance <= 0 ? "cleared" : "active",
              updatedAt: Timestamp.fromDate(new Date()),
            });
          }
        }

        // Update linked invoice
        const invSnap = await getDocs(query(collection(db, "invoices"), where("relatedSaleId", "==", returnSale.id)));
        for (const inv of invSnap.docs) {
          const invData = inv.data();
          const newReceived = Math.max(0, (invData.cashReceived || 0) - refundAmount);
          const newBalance = Math.max(0, (invData.balanceDue || 0) - creditPortion);
          await updateDoc(inv.ref, {
            cashReceived: newReceived,
            balanceDue: newBalance,
            paymentStatus: newBalance <= 0 ? "full" : "partial",
            totalAmount: Math.max(0, (invData.totalAmount || 0) - returnFullPrice),
            updatedAt: Timestamp.fromDate(new Date()),
          });
        }
      }

      // Mark sale as returned (prevents double restock on delete)
      await updateDoc(doc(db, "sales", returnSale.id), {
        returned: true,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      setReturnSale(null);

      if (returnType === "exchange") {
        router.push(`/admin/sales?returnDiscount=${returnFullPrice}&returnCustomer=${encodeURIComponent(returnSale.customer?.name || "")}&returnPhone=${encodeURIComponent(returnSale.customer?.phone || "")}`);
      }
    } catch (e) {
      console.error("Return failed", e);
    }
    setSavingReturn(false);
  };

  const handleDownloadCSV = () => {
    const csv = exportSalesCSV(filteredSales);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `sales-${date}.csv`);
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const snap = await getDoc(doc(db, "shop_settings", "emailBackupConfig"));
      if (!snap.exists()) { alert("Configure Email & Backup in Settings first."); return; }
      const cfg = snap.data() as { emailTo?: string; driveFolderId?: string; gasWebhookUrl?: string };
      if (!cfg.gasWebhookUrl) { alert("Configure GAS Webhook URL in Settings first."); return; }
      const csv = exportSalesCSV(filteredSales);
      const period = `${new Date().toISOString().slice(0, 10)}`;
      const res = await fetch(cfg.gasWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          action: "sendReport",
          module: "sales",
          csv,
          filename: `sales-${period}.csv`,
          period,
          emailTo: cfg.emailTo || "",
          driveFolderId: cfg.driveFolderId || "",
        }),
      });
      const data = await res.json();
      if (data.status === "ok") alert("Report sent to email" + (cfg.driveFolderId ? " and saved to Drive" : "") + "!");
      else alert("Error: " + (data.message || "Unknown error"));
    } catch (e: any) {
      alert("Failed to send: " + (e.message || e));
    }
    setSendingEmail(false);
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Sales</h1>
          <p className="text-sm text-muted-foreground">{filteredSales.length} of {sales.length} total</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={searchArchive} variant="outline">
            <Search className="h-4 w-4" /> Search Archive
          </Button>
          <Button onClick={() => { setShowForm(true); setForm({ ...emptyForm }); setInvoiceError(null); }} variant="accent">
            <Plus className="h-4 w-4" /> Record Sale
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search by customer name, phone or notes..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">All Payments</option>
          <option value="paid">Paid</option>
          <option value="due">Due</option>
        </select>
        <button onClick={() => setShowReturned(!showReturned)}
          className={`px-3 py-2 border rounded-lg text-sm flex items-center gap-1.5 ${showReturned ? "bg-yellow-50 border-yellow-300 text-yellow-800" : "border-border text-muted-foreground hover:bg-muted"}`}>
          <RotateCcw className="h-4 w-4" /> {showReturned ? "Hide" : "Show"} Returned
        </button>
        {canExport && (<>
          <select value={reportRange} onChange={(e) => setReportRange(e.target.value as any)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="all">All Time</option>
            <option value="ytd">Year to Date</option>
            <option value="mtd">Month to Day</option>
            <option value="custom">Custom</option>
          </select>
          {reportRange === "custom" && (
            <>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </>
          )}
          <button onClick={handleDownloadCSV}
            className="px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted flex items-center gap-1.5">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button onClick={handleSendEmail} disabled={sendingEmail}
            className="px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted flex items-center gap-1.5 disabled:opacity-50">
            <Mail className="h-4 w-4" /> {sendingEmail ? "Sending..." : "Send"}
          </button>
        </>)}
        <div className="flex items-center gap-1">
          <button onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setViewMode("list")}
            className={`p-1.5 rounded ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {savedSale && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle className="h-5 w-5" /> Sale recorded successfully!
          {savedInvoiceId && (
            <button onClick={() => setInvoicePreviewId(savedInvoiceId)}
              className="ml-auto inline-flex items-center gap-1 text-green-800 font-medium hover:underline">
              <Eye className="h-4 w-4" /> View Invoice
            </button>
          )}
        </div>
      )}

      {saleError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5" /> {saleError}
        </div>
      )}

      {invoiceError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-2 text-sm text-yellow-800">
          <AlertTriangle className="h-5 w-5" /> {invoiceError}
          <button onClick={() => setInvoiceError(null)} className="ml-auto p-1 hover:bg-yellow-100 rounded"><X className="h-4 w-4" /></button>
        </div>
      )}

      {orderId && orderData && !savedSale && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-2 text-sm text-blue-700">
          <span>Creating Sale from Order <strong>{orderData.orderNumber}</strong> — customer details, items, and notes pre-filled from the order.</span>
          <button onClick={() => { setForm({ ...emptyForm }); setOrderData(null); }} className="ml-auto text-blue-500 hover:text-blue-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loadingOrder && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-700">
          Loading order details...
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
              <div className="space-y-3">
                <select value={manualCustomer ? "other" : form.customerName}
                  onChange={(e) => {
                    if (e.target.value === "other") {
                      setManualCustomer(true);
                    } else if (e.target.value === "") {
                      setForm({ ...form, customerName: "", customerPhone: "", customerAddress: "" });
                      setManualCustomer(false);
                    } else {
                      const selected = allCustomers.find((c) => c.name === e.target.value);
                      setForm({ ...form, customerName: selected?.name || "", customerPhone: selected?.phone || "", customerAddress: selected?.address || "" });
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
                    <input type="text" placeholder="Customer Name *" value={form.customerName}
                      onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                      className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  ) : (
                    <input type="text" placeholder="Customer Name *" value={form.customerName} readOnly
                      className="px-3 py-2 border border-border rounded-lg text-sm bg-gray-50 text-muted-foreground cursor-not-allowed" />
                  )}
                  {manualCustomer ? (
                    <input type="tel" placeholder="Phone *" value={form.customerPhone}
                      onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                      minLength={10}
                      className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  ) : (
                    <input type="tel" value={form.customerPhone} readOnly
                      className="px-3 py-2 border border-border rounded-lg text-sm bg-gray-50 text-muted-foreground cursor-not-allowed" />
                  )}
                  {manualCustomer ? (
                    <input type="text" placeholder="Address" value={form.customerAddress}
                      onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
                      className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  ) : (
                    <input type="text" value={form.customerAddress} readOnly
                      className="px-3 py-2 border border-border rounded-lg text-sm bg-gray-50 text-muted-foreground cursor-not-allowed" />
                  )}
                </div>
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
                        <span className={`text-xs ${(p.quantityInStock ?? 0) <= 0 ? "text-red-500" : "text-muted-foreground"}`}>
                          {formatCurrency(p.price)} &middot; Stock: {p.quantityInStock ?? 0}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {form.items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No items added yet. Search and add products above.</p>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground bg-muted/20 font-medium">
                    <span className="flex-1">Product</span>
                    <span className="w-12 text-center">Stock</span>
                    <span className="w-16 text-center">Qty</span>
                    <span className="w-24 text-right">Unit Price</span>
                    <span className="w-24 text-right">Subtotal</span>
                    <span className="w-8" />
                  </div>
                  <div className="divide-y divide-border">
                    {form.items.map((item, i) => {
                      const product = products.find((p) => p.id === item.productId);
                      const maxStock = product?.quantityInStock ?? 0;
                      const exceedsStock = item.quantity > maxStock;
                      return (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <span className="flex-1 min-w-0 truncate">{item.productName}</span>
                          <span className={`w-12 text-center text-xs ${maxStock <= 0 ? "text-red-500" : "text-muted-foreground"}`}>
                            {maxStock}
                          </span>
                          <input type="number" value={item.quantity} min={1} max={Math.max(1, maxStock)}
                            onChange={(e) => {
                              let val = Number(e.target.value);
                              if (val > maxStock) val = maxStock;
                              if (val < 1) val = 1;
                              updateItem(i, "quantity", val);
                            }}
                            className={`w-16 px-2 py-1 border rounded text-xs text-center ${exceedsStock ? "border-red-400 bg-red-50" : "border-border"}`} />
                          <input type="number" value={item.unitPrice}
                            onChange={(e) => updateItem(i, "unitPrice", Number(e.target.value))}
                            className="w-24 px-2 py-1 border border-border rounded text-xs text-right" />
                          <span className="w-24 text-right font-medium text-xs">{formatCurrency(item.subtotal)}</span>
                          <button onClick={() => removeItem(i)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
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
              <div className="space-y-3">
                <label className="block text-xs font-medium text-muted-foreground">Issue Coupon</label>
                <select value={form.couponType}
                  onChange={(e) => setForm({ ...form, couponType: e.target.value as "none" | "fixed" | "percentage" })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="none">None</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (NPR)</option>
                </select>
                {form.couponType !== "none" && (
                  <input type="number" value={form.couponValue || ""} min={1}
                    placeholder={form.couponType === "percentage" ? "Discount % (max 100)" : "Discount Amount (max Rs. 200)"}
                    onChange={(e) => {
                      let val = Number(e.target.value);
                      if (form.couponType === "percentage") val = Math.min(val, 100);
                      if (form.couponType === "fixed") val = Math.min(val, 200);
                      setForm({ ...form, couponValue: Math.max(0, val) });
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                )}
                {form.couponType !== "none" && (
                  <p className="text-xs text-muted-foreground">
                    To be Used within 1 Month &middot; Max Discount: Rs. 200
                  </p>
                )}
              </div>
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

      {filteredSales.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No sales found.</p>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredSales.map((s) => (
            <div key={s.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2">
              <button onClick={() => setDetailSaleId(s.id)} className="block space-y-2 w-full text-left">
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
              </button>
              <div className="flex items-center justify-between">
                <button onClick={() => setDetailSaleId(s.id)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                  <Eye className="h-3 w-3" /> View Details
                </button>
                <div className="flex items-center gap-2">
                  {s.returned && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 font-medium">Returned</span>
                  )}
                  <button onClick={() => openReturn(s)} disabled={s.returned}
                    className={`inline-flex items-center gap-1 text-xs ${s.returned ? "text-muted-foreground/40 cursor-not-allowed" : "text-muted-foreground hover:text-primary"}`}>
                    <RotateCcw className="h-3 w-3" /> Return
                  </button>
                  <button onClick={() => handleDeleteSale(s.id)}
                    className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-left">
                <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Customer</th>
                <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Phone</th>
                <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-right">Amount</th>
                <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-center">Payment</th>
                <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-right">Date</th>
                <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-2.5">{s.customer?.name || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.customer?.phone || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(s.finalAmount)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.payment?.balanceDue > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                    }`}>
                      {s.payment?.balanceDue > 0 ? "Due" : "Paid"}
                    </span>
                    {s.returned && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 font-medium ml-1">Returned</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right text-muted-foreground">{formatDate(s.saleDate)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => setDetailSaleId(s.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                      <button onClick={() => openReturn(s)} disabled={s.returned}
                        className={`inline-flex items-center gap-1 text-xs ${s.returned ? "text-muted-foreground/40 cursor-not-allowed" : "text-muted-foreground hover:text-primary"}`}>
                        <RotateCcw className="h-3.5 w-3.5" /> Return
                      </button>
                      <button onClick={() => handleDeleteSale(s.id)}
                        className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailSaleData && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setDetailSaleId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between">
              <h2 className="text-lg font-bold text-secondary">Sale Details</h2>
              <button onClick={() => setDetailSaleId(null)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Customer</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> <span className="font-medium ml-1">{detailSaleData.customer?.name}</span></div>
                  <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium ml-1">{detailSaleData.customer?.phone}</span></div>
                  {detailSaleData.customer?.address && <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="font-medium ml-1">{detailSaleData.customer.address}</span></div>}
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
                  {detailSaleData.items?.map((item, i) => (
                    <div key={i} className="flex items-center px-4 py-2.5 text-sm">
                      <span className="flex-1">{item.productName}</span>
                      <span className="w-16 text-center text-muted-foreground">×{item.quantity}</span>
                      <span className="w-24 text-right">{formatCurrency(item.unitPrice)}</span>
                      <span className="w-24 text-right font-medium">{formatCurrency(item.subtotal || item.unitPrice * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 text-sm font-bold bg-muted/10">
                    <span>Total</span>
                    <span>{formatCurrency(detailSaleData.totalAmount || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Payment</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="font-medium capitalize">{detailSaleData.payment?.method || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Received</span><span className="font-medium">{formatCurrency(detailSaleData.payment?.receivedAmount || 0)}</span></div>
                    {(detailSaleData.payment?.balanceDue ?? 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Balance Due</span><span className="font-medium text-red-600">{formatCurrency(detailSaleData.payment!.balanceDue)}</span></div>}
                    {(detailSaleData.discountAmount ?? 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-medium text-red-500">-{formatCurrency(detailSaleData.discountAmount!)}</span></div>}
                    <div className="flex justify-between pt-1 border-t border-border"><span className="font-bold">Final Amount</span><span className="font-bold">{formatCurrency(detailSaleData.finalAmount)}</span></div>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Warranty</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Period</span><span className="font-medium">{detailSaleData.warranty?.period || "None"}</span></div>
                    {detailSaleData.warranty?.terms && <div className="flex justify-between"><span className="text-muted-foreground">Terms</span><span className="font-medium">{detailSaleData.warranty.terms}</span></div>}
                  </div>
                </div>
              </div>

              {detailSaleData.couponIssued && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Coupon Issued</h3>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <span className="font-mono font-medium text-blue-700">{detailSaleData.couponIssued.code}</span>
                    <span className="text-blue-500">•</span>
                    <span className="text-blue-600">-{formatCurrency(detailSaleData.couponIssued.discountValue)}</span>
                  </div>
                </div>
              )}

              {detailSaleData.notes && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Notes</h3>
                  <p className="text-sm bg-muted/20 p-3 rounded-lg">{detailSaleData.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-4 border-t border-border">
                <p>Sale Date: {formatDateTime(detailSaleData.saleDate)}</p>
                <p>Recorded By: {detailSaleData.recordedByName || detailSaleData.recordedBy || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {invoicePreviewData && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setInvoicePreviewId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-secondary">{invoicePreviewData.invoiceNumber}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => window.open(`/admin/invoice-viewer?id=${invoicePreviewId}`, "_blank")}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20">
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button onClick={() => setInvoicePreviewId(null)} className="p-1 hover:bg-muted rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium">{invoicePreviewData.customer?.name}</p>
                <p className="text-xs text-muted-foreground">{invoicePreviewData.customer?.phone}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Items</p>
                <div className="border border-border rounded-lg divide-y divide-border">
                  {invoicePreviewData.items?.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2">
                      <span className="flex-1 truncate">{item.productName}</span>
                      <span className="text-muted-foreground mx-2">×{item.quantity}</span>
                      <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t border-border">
                <span>Total</span>
                <span>{formatCurrency(invoicePreviewData.totalAmount)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
                <div>
                  <p>Status</p>
                  <p className="capitalize font-medium text-secondary">{invoicePreviewData.status}</p>
                </div>
                <div>
                  <p>Payment</p>
                  <p className="capitalize font-medium text-secondary">{invoicePreviewData.paymentStatus || "—"}</p>
                </div>
                {invoicePreviewData.cashReceived !== undefined && (
                  <div>
                    <p>Cash Received</p>
                    <p className="font-medium text-secondary">{formatCurrency(invoicePreviewData.cashReceived)}</p>
                  </div>
                )}
                {(invoicePreviewData.balanceDue ?? 0) > 0 && (
                  <div>
                    <p>Balance Due</p>
                    <p className="font-medium text-red-600">{formatCurrency(invoicePreviewData.balanceDue!)}</p>
                  </div>
                )}
              </div>
              {invoicePreviewData.couponIssued && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
                  <p className="font-medium text-blue-800 mb-0.5">Coupon Issued</p>
                  <p className="font-mono text-blue-700 font-bold text-sm">{invoicePreviewData.couponIssued.code}</p>
                  <p className="text-blue-600 mt-0.5">
                    {invoicePreviewData.couponIssued.discountType === "percentage"
                      ? `${invoicePreviewData.couponIssued.discountValue}% off`
                      : `Rs. ${invoicePreviewData.couponIssued.discountValue} off`}
                    {invoicePreviewData.couponIssued.terms ? ` · ${invoicePreviewData.couponIssued.terms}` : ""}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {returnSale && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setReturnSale(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-secondary">Process Return</h2>
              <button onClick={() => setReturnSale(null)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">Customer: {returnSale.customer?.name}</p>

            <div className="space-y-3 mb-4">
              {returnSale.items?.map((item, i) => (
                <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">Sold: {item.quantity} × {formatCurrency(item.unitPrice)}</p>
                  </div>
                  <input type="number" min="0" max={item.quantity}
                    value={returnQtys[i] || 0}
                    onChange={(e) => {
                      const val = Math.min(item.quantity, Math.max(0, Number(e.target.value)));
                      setReturnQtys({ ...returnQtys, [i]: val });
                    }}
                    className="w-16 px-2 py-1 border border-border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="rt" checked={returnType === "refund"}
                  onChange={() => setReturnType("refund")} className="text-primary" />
                Refund
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="rt" checked={returnType === "exchange"}
                  onChange={() => setReturnType("exchange")} className="text-primary" />
                Exchange (discount on new bill)
              </label>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="text-sm space-y-0.5">
                {returnType === "refund" && returnCashRatio < 1 && (
                  <p className="text-xs text-muted-foreground">Items worth {formatCurrency(returnFullPrice)} · Paid {Math.round(returnCashRatio * 100)}%</p>
                )}
                <p>Refund Amount: <span className="font-bold text-secondary">{formatCurrency(refundAmount)}</span></p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setReturnSale(null)} variant="outline">Cancel</Button>
                <Button onClick={handleReturn} disabled={savingReturn || returnFullPrice <= 0} variant="accent">
                  <Save className="h-4 w-4" /> {savingReturn ? "Processing..." : returnType === "refund" ? "Process Refund" : "Process Exchange"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showArchive && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { setShowArchive(false); setArchiveResults(null); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-secondary">Archived Sales</h2>
              <button onClick={() => { setShowArchive(false); setArchiveResults(null); }} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              {archiveLoading ? (
                <p className="text-center text-muted-foreground py-8">Loading archived sales...</p>
              ) : !archiveResults || archiveResults.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No archived sales found.</p>
              ) : (
                <div className="divide-y divide-border">
                  {archiveResults.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.customer?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{s.customer?.phone} · {formatDate(s.saleDate)}</p>
                      </div>
                      <span className="font-medium shrink-0 ml-4">{formatCurrency(s.finalAmount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
