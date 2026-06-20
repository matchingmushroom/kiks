"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { Purchase, PurchaseItem as PurchaseItemType, Product, Category, Supplier, Creditor } from "@/types";
import { formatCurrency, formatDate, toDate, compressImageUnder200KB } from "@/lib/utils";
import { generateId } from "@/lib/id-generator";
import { resolveAccount } from "@/lib/accounts";
import { useAuth } from "@/contexts/AuthContext";
import {
  addDoc, collection, updateDoc, doc, Timestamp, getDoc, deleteDoc, setDoc, getDocs, query, where, arrayUnion, onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { exportPurchasesCSV, downloadBlob } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Plus, Search, X, Save, Trash2, Undo2, PackagePlus, Tags, LayoutGrid, List, AlertTriangle, CheckCircle, Eye, RotateCcw, ChevronDown, PlusCircle, Download, Mail, Upload, Loader2, FileImage, ExternalLink } from "lucide-react";

interface FieldOptions {
  baseMaterial: string[];
  plating: string[];
  color: string[];
  productType: string[];
  idealFor: string[];
  occasion: string[];
}

const DEFAULT_FIELD_OPTIONS: FieldOptions = {
  baseMaterial: ["Brass", "Alloy", "Copper", "Stainless Steel", "Silver", "Gold", "Plastic", "Steel", "Wood", "Bone", "Fabric", "Resin", "Polymer"],
  plating: ["Gold-plated", "Silver-plated", "Rhodium", "Rose Gold-plated", "Sterling Silver", "Antique", "Matte", "Polished", "None"],
  color: ["Gold", "Silver", "Multicolor", "White", "Pink", "Green", "Red", "Blue", "Black", "Rose Gold", "Purple", "Peach", "Cream", "Brown", "Copper", "Bronze"],
  productType: ["Jewel Set", "Necklace", "Earrings", "Bracelet", "Ring", "Mangalsutra Set", "Pendant Set", "Chain", "Bangles", "Nosepin", "Anklet", "Brooch", "Hair Accessory", "Cufflinks"],
  idealFor: ["Women", "Men", "Girls", "Boys", "Unisex", "Women & Girls", "Men & Boys"],
  occasion: ["Party", "Wedding", "Engagement", "Everyday", "Gift", "Workwear", "Dailywear", "Festive"],
};

interface NewProductForm {
  name: string; categoryId: string; sku: string;
  brand: string; modelNo: string; baseMaterial: string;
  plating: string; color: string; productType: string;
  idealFor: string[]; occasion: string[]; netQuantity: number;
  costPrice: number; salesPrice: number;
  weight: number; purity: string; metalType: string;
  stoneType: string; stoneWeight: number; makingCharge: number;
  warranty: string;
}

const emptyForm = {
  supplierName: "", supplierPhone: "",
  items: [] as PurchaseItemType[],
  totalAmount: 0,
  paymentStatus: "unpaid" as "paid" | "unpaid" | "partially_paid",
  paymentMethod: "", paidAmount: 0, discountAmount: 0, billNo: "", billDate: "", billImageUrl: "", notes: "",
};

function PurchasesContent() {
  const { data: purchases, loading } = useFirestore<Purchase>("purchases", {
    constraints: [orderBy("purchaseDate", "desc"), limit(200)],
    realtime: false, cache: true,
  });
  const { data: products } = useFirestore<Product>("products", {
    constraints: [orderBy("name", "asc"), limit(200)],
    realtime: false, cache: true,
  });
  const { data: categories } = useFirestore<Category>("categories", {
    constraints: [orderBy("order", "asc")],
    realtime: false, cache: true,
  });
  const { data: allSuppliers } = useFirestore<Supplier>("suppliers", {
    constraints: [orderBy("name", "asc"), limit(100)],
    realtime: false, cache: true,
  });
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnCredit = searchParams.get("returnCredit");
  const returnSupplier = searchParams.get("returnSupplier");
  const returnSupplierPhone = searchParams.get("returnSupplierPhone");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [purchaseSaved, setPurchaseSaved] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [returnModal, setReturnModal] = useState<Purchase | null>(null);
  const [returnItems, setReturnItems] = useState<{ productId: string; qty: number }[]>([]);
  const [returnType, setReturnType] = useState<"refund" | "exchange">("refund");
  const [detailPurchaseId, setDetailPurchaseId] = useState<string | null>(null);
  const [detailPurchaseData, setDetailPurchaseData] = useState<Purchase | null>(null);
  const [reportRange, setReportRange] = useState<"all" | "ytd" | "mtd" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [uploadingBill, setUploadingBill] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const canExport = profile?.role !== "staff";

  // Inline product creation
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductForm, setNewProductForm] = useState<NewProductForm>({ name: "", categoryId: "", sku: "", brand: "", modelNo: "", baseMaterial: "", plating: "", color: "", productType: "", idealFor: [], occasion: [], netQuantity: 1, costPrice: 0, salesPrice: 0, weight: 0, purity: "", metalType: "", stoneType: "None", stoneWeight: 0, makingCharge: 0, warranty: "" });
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [manualSupplier, setManualSupplier] = useState(false);

  // Dynamic field options from Firestore
  const [fieldOptions, setFieldOptions] = useState<FieldOptions>(DEFAULT_FIELD_OPTIONS);
  const [newOptionField, setNewOptionField] = useState<string | null>(null);
  const [newOptionValue, setNewOptionValue] = useState("");

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const snap = await getDoc(doc(db, "fieldOptions", "config"));
        if (snap.exists()) {
          const data = snap.data() as Partial<FieldOptions>;
          setFieldOptions((prev) => ({ ...prev, ...data }));
        }
      } catch (e) {
        console.error("Failed to load field options", e);
      }
    };
    loadOptions();
  }, []);

  const addFieldOption = async (field: keyof FieldOptions, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const current = fieldOptions[field];
    if (current.includes(trimmed)) {
      setNewOptionField(null);
      setNewOptionValue("");
      return;
    }
    const updated = [...current, trimmed];
    setFieldOptions((prev) => ({ ...prev, [field]: updated }));
    try {
      await setDoc(doc(db, "fieldOptions", "config"), { [field]: updated }, { merge: true });
    } catch (e) {
      console.error("Failed to save field option", e);
    }
    setNewOptionField(null);
    setNewOptionValue("");
  };

  const METAL_TYPES = ["", "Gold", "Silver", "Platinum", "Alloy", "Copper", "Brass", "Steel", "Other"];
  const STONE_TYPES = ["None", "Diamond", "Ruby", "Emerald", "Sapphire", "Pearl", "Crystal", "Cubic Zirconia", "Multicolor Stone", "Other"];

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const addItem = (product: Product) => {
    const existing = form.items.find((i) => i.productId === product.id);
    if (existing) {
      const items = form.items.map((i) =>
        i.productId === product.id
          ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitCost }
          : i
      );
      const total = items.reduce((s, i) => s + i.subtotal, 0);
      setForm({ ...form, items, totalAmount: total });
      return;
    }
    const costPrice = product.costPrice || Math.round(product.price * 0.5);
    const qty = product.netQuantity || 1;
    const newItem: PurchaseItemType = {
      productId: product.id,
      productName: product.name,
      sku: product.sku || "",
      quantity: qty,
      unitCost: costPrice,
      salesPrice: product.price,
      subtotal: qty * costPrice,
    };
    const items = [...form.items, newItem];
    const total = items.reduce((s, i) => s + i.subtotal, 0);
    setForm({ ...form, items, totalAmount: total });
    setProductSearch("");
  };

  const updateItem = (index: number, field: keyof PurchaseItemType, value: number) => {
    const items = form.items.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "unitCost") {
        updated.subtotal =
          (field === "quantity" ? value : item.quantity) *
          (field === "unitCost" ? value : item.unitCost);
      }
      return updated;
    });
    const total = items.reduce((s, i) => s + i.subtotal, 0);
    setForm({ ...form, items, totalAmount: total });
  };

  const removeItem = (index: number) => {
    const items = form.items.filter((_, i) => i !== index);
    const total = items.reduce((s, i) => s + i.subtotal, 0);
    setForm({ ...form, items, totalAmount: total });
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    const catId = await generateId("CAT");
    await setDoc(doc(db, "categories", catId), {
      name: newCategoryName.trim(),
      description: "", image: "", order: categories.length, isActive: true,
      createdAt: Timestamp.fromDate(new Date()),
    });
    setNewProductForm({ ...newProductForm, categoryId: catId });
    setNewCategoryName("");
    setShowNewCategory(false);
  };

  const handleCreateProduct = async () => {
    if (!newProductForm.name || !newProductForm.categoryId) return;
    const f = newProductForm;
    const prodData = {
      name: f.name, description: "", design: "", categoryId: f.categoryId,
      images: [""], videoUrl: "",
      price: f.salesPrice || f.costPrice, costPrice: f.costPrice,
      weight: f.weight, purity: f.purity, metalType: f.metalType,
      stoneType: f.stoneType, stoneWeight: f.stoneWeight,
      makingCharge: f.makingCharge, warranty: f.warranty, sku: f.sku,
      quantityInStock: 0, isActive: true, isFeatured: false,
      badge: "", brand: f.brand, modelNo: f.modelNo, baseMaterial: f.baseMaterial,
      plating: f.plating, color: f.color, productType: f.productType,
      idealFor: f.idealFor, netQuantity: f.netQuantity, occasion: f.occasion,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    };
    const prodId = await generateId("PROD");
    await setDoc(doc(db, "products", prodId), prodData);
    const newProduct: Product = {
      id: prodId, ...prodData,
      price: f.salesPrice || f.costPrice,
      originalPrice: 0, badge: "none",
      quantityInStock: 0, isActive: true, isFeatured: false,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    addItem(newProduct);
    setProductSearch("");
    setShowNewProduct(false);
    setNewProductForm({ name: "", categoryId: "", sku: "", brand: "", modelNo: "", baseMaterial: "", plating: "", color: "", productType: "", idealFor: [], occasion: [], netQuantity: 1, costPrice: 0, salesPrice: 0, weight: 0, purity: "", metalType: "", stoneType: "None", stoneWeight: 0, makingCharge: 0, warranty: "" });
  };

  const upsertCreditor = async (supplierName: string, supplierPhone: string | undefined, balanceChange: number, purchaseId?: string) => {
    const existing = await getDocs(query(collection(db, "creditors"), where("supplierName", "==", supplierName)));
    const now = Timestamp.fromDate(new Date());
    const dueDate = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    if (!existing.empty) {
      const cred = existing.docs[0];
      const data = cred.data();
      const oldBalance = (data as any).balanceDue ?? (data as any).currentBalance ?? 0;
      const oldPaid = data.amountPaid ?? 0;
      const oldTotal = data.totalAmount ?? 0;
      const newBalance = oldBalance + balanceChange;
      await updateDoc(doc(db, "creditors", cred.id), {
        balanceDue: Math.max(0, newBalance),
        amountPaid: balanceChange < 0 ? Math.max(0, oldPaid + balanceChange) : oldPaid,
        totalAmount: balanceChange > 0 ? oldTotal + balanceChange : oldTotal,
        status: newBalance <= 0 ? "cleared" : "active",
        dueDate,
        lastTransactionDate: now,
        supplierPhone: supplierPhone || data.supplierPhone,
        purchaseIds: purchaseId ? arrayUnion(purchaseId) : data.purchaseIds || [],
        updatedAt: now,
      });
    } else {
      const credId = await generateId("CRED");
      await setDoc(doc(db, "creditors", credId), {
        supplierName,
        supplierPhone: supplierPhone || "",
        purchaseIds: purchaseId ? [purchaseId] : [],
        totalAmount: Math.max(0, balanceChange),
        amountPaid: 0,
        balanceDue: Math.max(0, balanceChange),
        dueDate,
        status: "active",
        paymentHistory: [],
        lastTransactionDate: now,
        notes: "",
        createdAt: now,
        updatedAt: now,
      });
    }
  };

  const handleSave = async () => {
    if (saving || !form.supplierName || form.items.length === 0) return;
    setSaving(true);
    setPurchaseError(null);
    try {
      const effectiveTotal = form.totalAmount - (form.discountAmount || 0);
      const purchaseData = {
        supplierName: form.supplierName,
        supplierPhone: form.supplierPhone,
        purchaseDate: Timestamp.fromDate(new Date()),
        items: form.items,
        totalAmount: form.totalAmount,
        discountAmount: form.discountAmount || 0,
        paymentStatus: form.paymentStatus,
        paymentMethod: form.paymentMethod,
        paidAmount: form.paidAmount,
        billNo: form.billNo,
        billDate: form.billDate,
        billImageUrl: form.billImageUrl || "",
        notes: form.notes,
        recordedBy: user?.uid || "",
        recordedByName: profile?.displayName || "",
        returned: false,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (editingId) {
        await updateDoc(doc(db, "purchases", editingId), purchaseData);
        const txSnap = await getDocs(query(collection(db, "accountTransactions"), where("referenceType", "==", "purchase"), where("referenceId", "==", editingId)));
        if (form.paidAmount && form.paidAmount > 0 && form.paymentMethod) {
          const txData = {
            accountId: resolveAccount(form.paymentMethod),
            type: "debit",
            amount: form.paidAmount,
            description: `Purchase from ${form.supplierName}`,
            date: Timestamp.fromDate(new Date()),
            recordedBy: user?.uid || "",
          };
          if (!txSnap.empty) {
            await updateDoc(doc(db, "accountTransactions", txSnap.docs[0].id), txData);
          } else {
            await addDoc(collection(db, "accountTransactions"), {
              ...txData,
              referenceType: "purchase",
              referenceId: editingId,
              createdAt: Timestamp.fromDate(new Date()),
            });
          }
        } else if (!txSnap.empty) {
          await deleteDoc(doc(db, "accountTransactions", txSnap.docs[0].id));
        }
      } else {
        const purchaseId = await generateId("PURC");
        await setDoc(doc(db, "purchases", purchaseId), purchaseData);
        for (const item of form.items) {
          const prodRef = doc(db, "products", item.productId);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const p = prodSnap.data() as Product;
            const oldStock = p.quantityInStock || 0;
            const oldCost = p.costPrice || 0;
            const newStock = oldStock + item.quantity;
            const newCost = newStock > 0
              ? Math.round(((oldCost * oldStock + item.unitCost * item.quantity) / newStock) * 100) / 100
              : item.unitCost;
            await updateDoc(prodRef, {
              quantityInStock: newStock,
              costPrice: newCost,
              price: item.salesPrice,
            });
          }
          await addDoc(collection(db, "inventoryLogs"), {
            productId: item.productId,
            changeType: "purchase",
            quantityChange: item.quantity,
            reason: `Purchase from ${form.supplierName}`,
            performedBy: user?.uid || "",
            createdAt: Timestamp.fromDate(new Date()),
          });
        }
        if (form.paidAmount && form.paidAmount > 0 && form.paymentMethod) {
          await addDoc(collection(db, "accountTransactions"), {
            accountId: resolveAccount(form.paymentMethod),
            type: "debit",
            amount: form.paidAmount,
            description: `Purchase from ${form.supplierName}`,
            date: Timestamp.fromDate(new Date()),
            referenceType: "purchase",
            referenceId: purchaseId,
            recordedBy: user?.uid || "",
            createdAt: Timestamp.fromDate(new Date()),
          });
        }
        if (form.paymentStatus !== "paid") {
          const balanceChange = form.paymentStatus === "unpaid" ? effectiveTotal : Math.max(0, effectiveTotal - (form.paidAmount || 0));
          if (balanceChange > 0) {
            await upsertCreditor(form.supplierName, form.supplierPhone, balanceChange, purchaseId);
          }
        }
      }

      setForm({ ...emptyForm });
      setEditingId(null);
      setShowForm(false);
      setPurchaseSaved(true);
      setTimeout(() => setPurchaseSaved(false), 6000);
    } catch (e: any) {
      setPurchaseError(e?.message || "Purchase failed. Please try again.");
      setForm({ ...emptyForm });
      setEditingId(null);
      setShowForm(false);
      setTimeout(() => setPurchaseError(null), 6000);
    }
    setSaving(false);
  };

  const openReturn = (p: Purchase) => {
    setReturnModal(p);
    setReturnItems(p.items.map((i) => ({ productId: i.productId, qty: 0 })));
    setReturnType("refund");
  };

  const handleReturn = async () => {
    if (!returnModal) return;
    setSaving(true);
    try {
      let returnValue = 0;
      for (const ri of returnItems) {
        if (ri.qty <= 0) continue;
        const item = returnModal.items.find((i) => i.productId === ri.productId);
        if (!item) continue;
        returnValue += ri.qty * item.unitCost;
        const prodRef = doc(db, "products", item.productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          const currentStock = prodSnap.data().quantityInStock || 0;
          await updateDoc(prodRef, { quantityInStock: Math.max(0, currentStock - ri.qty) });
        }
        await addDoc(collection(db, "inventoryLogs"), {
          productId: item.productId,
          changeType: "purchase_return",
          quantityChange: -ri.qty,
          reason: `Return from purchase #${returnModal.id}`,
          performedBy: user?.uid || "",
          createdAt: Timestamp.fromDate(new Date()),
        });
      }

      if (returnValue > 0) {
        if (returnType === "refund") {
          // Refund: create account transaction for paid portion, reduce creditor for unpaid
          if (returnModal.paymentStatus === "paid" || returnModal.paymentStatus === "partially_paid") {
            const txSnap = await getDocs(query(collection(db, "accountTransactions"), where("referenceType", "==", "purchase"), where("referenceId", "==", returnModal.id)));
            if (!txSnap.empty) {
              const origTx = txSnap.docs[0].data();
              await addDoc(collection(db, "accountTransactions"), {
                accountId: origTx.accountId,
                type: "credit",
                amount: returnValue,
                description: `Purchase return from #${returnModal.id}`,
                date: Timestamp.fromDate(new Date()),
                referenceType: "purchase_return",
                referenceId: returnModal.id,
                recordedBy: user?.uid || "",
                createdAt: Timestamp.fromDate(new Date()),
              });
            }
          }
          if (returnModal.paymentStatus === "unpaid" || returnModal.paymentStatus === "partially_paid") {
            await upsertCreditor(returnModal.supplierName, returnModal.supplierPhone, -returnValue, returnModal.id);
          }
          setReturnModal(null);
        } else {
          // Exchange: no money/creditor change, redirect to new purchase with credit
          await updateDoc(doc(db, "purchases", returnModal.id), { returned: true, updatedAt: Timestamp.fromDate(new Date()) });
          setReturnModal(null);
          router.push(`/admin/purchases?returnCredit=${returnValue}&returnSupplier=${encodeURIComponent(returnModal.supplierName)}&returnSupplierPhone=${encodeURIComponent(returnModal.supplierPhone || "")}`);
        }
      } else {
        setReturnModal(null);
      }
    } catch (e) {
      console.error("Return failed", e);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const snap = await getDoc(doc(db, "purchases", id));
    if (!snap.exists()) return;
    const purchase = snap.data() as Purchase;
    if (purchase.returned) {
      // Already returned — stock already decremented; skip restock
      await deleteDoc(doc(db, "purchases", id));
      return;
    }
    for (const item of purchase.items) {
      const prodRef = doc(db, "products", item.productId);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        const currentStock = prodSnap.data().quantityInStock || 0;
        await updateDoc(prodRef, { quantityInStock: Math.max(0, currentStock - item.quantity) });
      }
      await addDoc(collection(db, "inventoryLogs"), {
        productId: item.productId,
        changeType: "purchase",
        quantityChange: -item.quantity,
        reason: `Purchase #${id} deleted`,
        performedBy: user?.uid || "",
        createdAt: Timestamp.fromDate(new Date()),
      });
    }
    const txSnap = await getDocs(query(collection(db, "accountTransactions"), where("referenceType", "==", "purchase"), where("referenceId", "==", id)));
    for (const tx of txSnap.docs) {
      await deleteDoc(doc(db, "accountTransactions", tx.id));
    }
    await deleteDoc(doc(db, "purchases", id));
  };

  // Upload bill copy to Drive via GAS webhook
  const uploadBillImage = async (file: File) => {
    setUploadingBill(true);
    try {
      const configSnap = await getDoc(doc(db, "shop_settings", "emailBackupConfig"));
      const cfg = configSnap.data() as Record<string, any> | undefined;
      if (!cfg?.gasWebhookUrl) {
        alert("GAS Webhook URL not configured. Please set it in Settings first.");
        setUploadingBill(false); return;
      }
      // Compress client-side: WebP with size-feedback loop to stay under 200KB
      const { base64: compressedBase64, mimeType: compressedMime, filename: compressedName } = await compressImageUnder200KB(file);
      const uploadId = "up_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      const timeoutId = setTimeout(() => setUploadingBill(false), 30000);
      const unsub = onSnapshot(doc(db, "pendingUploads", uploadId), (snap) => {
        const d = snap.data();
        if (!d || d.status === "pending") return;
        clearTimeout(timeoutId);
        unsub();
        if (d.status === "done") {
          const driveUrl = `https://drive.google.com/thumbnail?id=${d.fileId}&sz=w1000`;
          setForm((prev) => ({ ...prev, billImageUrl: driveUrl }));
        }
        deleteDoc(doc(db, "pendingUploads", uploadId)).catch(() => {});
        setUploadingBill(false);
      });
      const authToken = await user?.getIdToken();
      await setDoc(doc(db, "pendingUploads", uploadId), {
        status: "pending",
        createdAt: Timestamp.fromDate(new Date()),
      });
      fetch(cfg.gasWebhookUrl, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
          action: "uploadImage",
          imageBase64: compressedBase64,
          filename: "bill_" + compressedName,
          mimeType: compressedMime,
          driveFolderId: cfg.billDriveFolderId || cfg.imageDriveFolderId || cfg.driveFolderId || undefined,
          uploadId,
          authToken,
        }),
      });
    } catch (e: any) {
      console.error("Bill upload failed", e);
      alert("Failed to upload bill: " + (e.message || e));
      setUploadingBill(false);
    }
  };

  // Live-update purchase detail modal
  useEffect(() => {
    if (!detailPurchaseId) { setDetailPurchaseData(null); return; }
    const unsub = onSnapshot(doc(db, "purchases", detailPurchaseId), (snap) => {
      if (snap.exists()) setDetailPurchaseData({ id: snap.id, ...snap.data() } as Purchase);
    });
    return () => unsub();
  }, [detailPurchaseId]);

  const filteredData = useMemo(() => {
    let start = 0, end = Infinity;
    if (reportRange === "ytd") { start = new Date(new Date().getFullYear(), 0, 1).getTime(); }
    else if (reportRange === "mtd") { start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(); }
    else if (reportRange === "custom" && dateFrom && dateTo) {
      start = new Date(dateFrom).getTime();
      end = new Date(dateTo).getTime() + 86400000;
    }
    if (start > 0 || end < Infinity) {
      return purchases.filter((p) => { const d = toDate(p.purchaseDate).getTime(); return d >= start && d <= end; });
    }
    return purchases;
  }, [purchases, reportRange, dateFrom, dateTo]);

  // Pre-fill form with exchange credit from returned purchase
  useEffect(() => {
    if (returnCredit && returnSupplier) {
      setShowForm(true);
      setForm({
        ...emptyForm,
        supplierName: returnSupplier,
        supplierPhone: returnSupplierPhone || "",
        discountAmount: Number(returnCredit),
      });
    }
  }, [returnCredit, returnSupplier, returnSupplierPhone]);

  const handleDownloadCSV = () => {
    const csv = exportPurchasesCSV(filteredData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `purchases-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const snap = await getDoc(doc(db, "shop_settings", "emailBackupConfig"));
      if (!snap.exists()) { alert("Configure Email & Backup in Settings first."); return; }
      const cfg = snap.data() as any;
      if (!cfg.gasWebhookUrl) { alert("Configure GAS Webhook URL in Settings first."); return; }
      const csv = exportPurchasesCSV(filteredData);
      const period = new Date().toISOString().slice(0, 10);
      const res = await fetch(cfg.gasWebhookUrl, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "sendReport", module: "purchases", csv, filename: `purchases-${period}.csv`, period, emailTo: cfg.emailTo || "", driveFolderId: cfg.driveFolderId || "" }),
      });
      const data = await res.json();
      if (data.status === "ok") alert("Report sent!"); else alert("Error: " + (data.message || "Unknown"));
    } catch (e: any) { alert("Failed: " + (e.message || e)); }
    setSendingEmail(false);
  };

  return (
    <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Purchases</h1>
            <p className="text-sm text-muted-foreground">{filteredData.length} total</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                className="p-2 border border-border rounded-lg text-muted-foreground hover:bg-muted flex items-center gap-1.5 text-sm">
                <Download className="h-4 w-4" /> CSV
              </button>
              <button onClick={handleSendEmail} disabled={sendingEmail}
                className="p-2 border border-border rounded-lg text-muted-foreground hover:bg-muted flex items-center gap-1.5 text-sm disabled:opacity-50">
                <Mail className="h-4 w-4" /> {sendingEmail ? "..." : "Send"}
              </button>
            </>)}
            <button onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="p-2 border border-border rounded-lg text-muted-foreground hover:bg-muted" title={viewMode === "grid" ? "List View" : "Grid View"}>
              {viewMode === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </button>
            <Button onClick={() => { setShowForm(true); setForm({ ...emptyForm }); setEditingId(null); }} variant="accent">
              <Plus className="h-4 w-4" /> New Purchase
            </Button>
          </div>
        </div>

        {purchaseSaved && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="h-5 w-5" /> Purchase recorded successfully!
          </div>
        )}

        {purchaseError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="h-5 w-5" /> {purchaseError}
          </div>
        )}

        {showForm && (
          <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-secondary">
                {editingId ? "Edit Purchase" : "New Purchase"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Supplier *</label>
                  <select value={manualSupplier ? "other" : form.supplierName}
                    onChange={(e) => {
                      if (e.target.value === "other") {
                        setManualSupplier(true);
                      } else if (e.target.value === "") {
                        setForm({ ...form, supplierName: "", supplierPhone: "" });
                        setManualSupplier(false);
                      } else {
                        const selected = allSuppliers.find((s) => s.name === e.target.value);
                        setForm({ ...form, supplierName: selected?.name || "", supplierPhone: selected?.phone || "" });
                        setManualSupplier(false);
                      }
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select supplier</option>
                    {allSuppliers.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}{s.phone ? ` (${s.phone})` : ""}</option>
                    ))}
                    <option value="other">Other (Enter Manually)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Supplier Phone</label>
                  {manualSupplier ? (
                    <input type="text" value={form.supplierPhone}
                      onChange={(e) => setForm({ ...form, supplierPhone: e.target.value })}
                      minLength={6}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  ) : (
                    <input type="text" value={form.supplierPhone} readOnly
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-gray-50 text-muted-foreground cursor-not-allowed" />
                  )}
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
                          <span className="text-muted-foreground text-xs">
                            Cost: {formatCurrency(p.costPrice || 0)} | Stock: {p.quantityInStock}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {productSearch && filteredProducts.length === 0 && (
                    <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-border rounded-lg shadow-lg p-3">
                      <p className="text-sm text-muted-foreground mb-2">No products matching "{productSearch}"</p>
                      <Button onClick={() => { setNewProductForm({ ...newProductForm, name: productSearch }); setShowNewProduct(true); setProductSearch(""); }}
                        size="sm" variant="accent">
                        <PackagePlus className="h-3.5 w-3.5" /> Create "{productSearch}"
                      </Button>
                    </div>
                  )}
                </div>
                {form.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No items added yet.</p>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground bg-muted/20 font-medium">
                      <span className="flex-1">Product</span>
                      <span className="w-16 text-center">Buy Qty</span>
                      <span className="w-20 text-right">Buy Price</span>
                      <span className="w-20 text-right">Sales Price</span>
                      <span className="w-20 text-right">Subtotal</span>
                      <span className="w-8" />
                    </div>
                    <div className="divide-y divide-border">
                      {form.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <span className="flex-1 min-w-0 truncate">{item.productName}</span>
                          <input type="number" value={item.quantity} min={1}
                            onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                            className="w-16 px-2 py-1 border border-border rounded text-xs text-center" />
                          <input type="number" value={item.unitCost}
                            onChange={(e) => updateItem(i, "unitCost", Number(e.target.value))}
                            className="w-20 px-2 py-1 border border-border rounded text-xs text-right" />
                          <input type="number" value={item.salesPrice}
                            onChange={(e) => updateItem(i, "salesPrice", Number(e.target.value))}
                            className="w-20 px-2 py-1 border border-border rounded text-xs text-right" />
                          <span className="w-20 text-right font-medium text-xs">{formatCurrency(item.subtotal)}</span>
                          <button onClick={() => removeItem(i)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showNewProduct && (
                  <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-secondary">New Product</h4>
                      <button onClick={() => setShowNewProduct(false)} className="p-1 hover:bg-muted rounded">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Basic Info */}
                    <div>
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Basic Info</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Name *</label>
                          <input type="text" value={newProductForm.name}
                            onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Category *</label>
                          <div className="flex gap-2">
                            <select value={newProductForm.categoryId}
                              onChange={(e) => {
                                if (e.target.value === "__new__") {
                                  setShowNewCategory(true);
                                } else {
                                  setNewProductForm({ ...newProductForm, categoryId: e.target.value });
                                }
                              }}
                              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                              <option value="">Select</option>
                              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              <option value="__new__">+ Add new category</option>
                            </select>
                          </div>
                          {showNewCategory && (
                            <div className="flex gap-2 mt-2">
                              <input type="text" placeholder="Category name" value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()} size="sm" variant="accent">
                                <Tags className="h-3.5 w-3.5" /> Add
                              </Button>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">SKU</label>
                          <input type="text" value={newProductForm.sku}
                            onChange={(e) => setNewProductForm({ ...newProductForm, sku: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Brand</label>
                          <input type="text" value={newProductForm.brand}
                            onChange={(e) => setNewProductForm({ ...newProductForm, brand: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Model Number</label>
                          <input type="text" value={newProductForm.modelNo}
                            onChange={(e) => setNewProductForm({ ...newProductForm, modelNo: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div>
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Details</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Base Material</label>
                          <select value={newProductForm.baseMaterial}
                            onChange={(e) => {
                              if (e.target.value === "__new__") { setNewOptionField("baseMaterial"); setNewOptionValue(""); }
                              else { setNewProductForm({ ...newProductForm, baseMaterial: e.target.value }); }
                            }}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="">Select</option>
                            {fieldOptions.baseMaterial.map((o) => (<option key={o} value={o}>{o}</option>))}
                            <option value="__new__">+ Add new</option>
                          </select>
                          {newOptionField === "baseMaterial" && (
                            <div className="flex gap-2 mt-2">
                              <input type="text" placeholder="New base material" value={newOptionValue}
                                onChange={(e) => setNewOptionValue(e.target.value)}
                                className="flex-1 px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
                              <Button onClick={() => { addFieldOption("baseMaterial", newOptionValue); setNewProductForm({ ...newProductForm, baseMaterial: newOptionValue }); }} size="sm" variant="accent">
                                <Plus className="h-3 w-3" /> Add
                              </Button>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Plating Type</label>
                          <select value={newProductForm.plating}
                            onChange={(e) => {
                              if (e.target.value === "__new__") { setNewOptionField("plating"); setNewOptionValue(""); }
                              else { setNewProductForm({ ...newProductForm, plating: e.target.value }); }
                            }}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="">Select</option>
                            {fieldOptions.plating.map((o) => (<option key={o} value={o}>{o}</option>))}
                            <option value="__new__">+ Add new</option>
                          </select>
                          {newOptionField === "plating" && (
                            <div className="flex gap-2 mt-2">
                              <input type="text" placeholder="New plating type" value={newOptionValue}
                                onChange={(e) => setNewOptionValue(e.target.value)}
                                className="flex-1 px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
                              <Button onClick={() => { addFieldOption("plating", newOptionValue); setNewProductForm({ ...newProductForm, plating: newOptionValue }); }} size="sm" variant="accent">
                                <Plus className="h-3 w-3" /> Add
                              </Button>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Color</label>
                          <select value={newProductForm.color}
                            onChange={(e) => {
                              if (e.target.value === "__new__") { setNewOptionField("color"); setNewOptionValue(""); }
                              else { setNewProductForm({ ...newProductForm, color: e.target.value }); }
                            }}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="">Select</option>
                            {fieldOptions.color.map((o) => (<option key={o} value={o}>{o}</option>))}
                            <option value="__new__">+ Add new</option>
                          </select>
                          {newOptionField === "color" && (
                            <div className="flex gap-2 mt-2">
                              <input type="text" placeholder="New color" value={newOptionValue}
                                onChange={(e) => setNewOptionValue(e.target.value)}
                                className="flex-1 px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
                              <Button onClick={() => { addFieldOption("color", newOptionValue); setNewProductForm({ ...newProductForm, color: newOptionValue }); }} size="sm" variant="accent">
                                <Plus className="h-3 w-3" /> Add
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Product Type</label>
                          <select value={newProductForm.productType}
                            onChange={(e) => {
                              if (e.target.value === "__new__") { setNewOptionField("productType"); setNewOptionValue(""); }
                              else { setNewProductForm({ ...newProductForm, productType: e.target.value }); }
                            }}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="">Select</option>
                            {fieldOptions.productType.map((t) => (<option key={t} value={t}>{t}</option>))}
                            <option value="__new__">+ Add new</option>
                          </select>
                          {newOptionField === "productType" && (
                            <div className="flex gap-2 mt-2">
                              <input type="text" placeholder="New product type" value={newOptionValue}
                                onChange={(e) => setNewOptionValue(e.target.value)}
                                className="flex-1 px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
                              <Button onClick={() => { addFieldOption("productType", newOptionValue); setNewProductForm({ ...newProductForm, productType: newOptionValue }); }} size="sm" variant="accent">
                                <Plus className="h-3 w-3" /> Add
                              </Button>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Net Quantity</label>
                          <input type="number" min={1} value={newProductForm.netQuantity || ""}
                            onChange={(e) => setNewProductForm({ ...newProductForm, netQuantity: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Ideal For</label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {fieldOptions.idealFor.map((f) => (
                              <label key={f} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                                <input type="checkbox" checked={newProductForm.idealFor.includes(f)}
                                  onChange={() => setNewProductForm({
                                    ...newProductForm,
                                    idealFor: newProductForm.idealFor.includes(f)
                                      ? newProductForm.idealFor.filter((x) => x !== f)
                                      : [...newProductForm.idealFor, f],
                                  })}
                                  className="accent-primary" />
                                {f}
                              </label>
                            ))}
                            <button onClick={() => { setNewOptionField("idealFor"); setNewOptionValue(""); }}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <PlusCircle className="h-3 w-3" /> Add new
                            </button>
                          </div>
                          {newOptionField === "idealFor" && (
                            <div className="flex gap-2 mt-2">
                              <input type="text" placeholder="New ideal for" value={newOptionValue}
                                onChange={(e) => setNewOptionValue(e.target.value)}
                                className="flex-1 px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
                              <Button onClick={() => { addFieldOption("idealFor", newOptionValue); }} size="sm" variant="accent">
                                <Plus className="h-3 w-3" /> Add
                              </Button>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Occasion</label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {fieldOptions.occasion.map((c) => (
                              <label key={c} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                                <input type="checkbox" checked={newProductForm.occasion.includes(c)}
                                  onChange={() => setNewProductForm({
                                    ...newProductForm,
                                    occasion: newProductForm.occasion.includes(c)
                                      ? newProductForm.occasion.filter((x) => x !== c)
                                      : [...newProductForm.occasion, c],
                                  })}
                                  className="accent-primary" />
                                {c}
                              </label>
                            ))}
                            <button onClick={() => { setNewOptionField("occasion"); setNewOptionValue(""); }}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <PlusCircle className="h-3 w-3" /> Add new
                            </button>
                          </div>
                          {newOptionField === "occasion" && (
                            <div className="flex gap-2 mt-2">
                              <input type="text" placeholder="New occasion" value={newOptionValue}
                                onChange={(e) => setNewOptionValue(e.target.value)}
                                className="flex-1 px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
                              <Button onClick={() => { addFieldOption("occasion", newOptionValue); }} size="sm" variant="accent">
                                <Plus className="h-3 w-3" /> Add
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div>
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pricing</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Cost Price (NPR)</label>
                          <input type="number" value={newProductForm.costPrice || ""}
                            onChange={(e) => setNewProductForm({ ...newProductForm, costPrice: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Sales Price (NPR)</label>
                          <input type="number" value={newProductForm.salesPrice || ""}
                            onChange={(e) => setNewProductForm({ ...newProductForm, salesPrice: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div>
                      <details className="group">
                        <summary className="text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer list-none flex items-center gap-1 select-none">
                          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                          Additional Details
                        </summary>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Weight (g)</label>
                            <input type="number" step="0.01" value={newProductForm.weight || ""}
                              onChange={(e) => setNewProductForm({ ...newProductForm, weight: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Purity (Kt)</label>
                            <input type="text" value={newProductForm.purity}
                              onChange={(e) => setNewProductForm({ ...newProductForm, purity: e.target.value })}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Metal Type</label>
                            <select value={newProductForm.metalType}
                              onChange={(e) => setNewProductForm({ ...newProductForm, metalType: e.target.value })}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                              {METAL_TYPES.map((m) => (<option key={m} value={m}>{m || "Select"}</option>))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Stone Type</label>
                            <select value={newProductForm.stoneType}
                              onChange={(e) => setNewProductForm({ ...newProductForm, stoneType: e.target.value })}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                              {STONE_TYPES.map((s) => (<option key={s} value={s}>{s}</option>))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Stone Weight (g)</label>
                            <input type="number" step="0.01" value={newProductForm.stoneWeight || ""}
                              onChange={(e) => setNewProductForm({ ...newProductForm, stoneWeight: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Making Charge (NPR)</label>
                            <input type="number" value={newProductForm.makingCharge || ""}
                              onChange={(e) => setNewProductForm({ ...newProductForm, makingCharge: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="block text-xs text-muted-foreground mb-1">Warranty</label>
                          <input type="text" value={newProductForm.warranty}
                            onChange={(e) => setNewProductForm({ ...newProductForm, warranty: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                      </details>
                    </div>

                    <Button onClick={handleCreateProduct} disabled={!newProductForm.name || !newProductForm.categoryId} variant="accent" size="sm">
                      <PackagePlus className="h-3.5 w-3.5" /> Create & Add to Purchase
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Status</label>
                  <select value={form.paymentStatus}
                    onChange={(e) => setForm({ ...form, paymentStatus: e.target.value as "paid" | "unpaid" | "partially_paid" })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                    <option value="partially_paid">Partially Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Method</label>
                  <select value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="qr">QR Payment</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Paid Amount</label>
                  <input type="number" value={form.paidAmount || ""}
                    onChange={(e) => setForm({ ...form, paidAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>

              {(form.discountAmount ?? 0) > 0 && (
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Credit from Return</label>
                    <input type="number" value={form.discountAmount || ""}
                      onChange={(e) => setForm({ ...form, discountAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-amber-50" />
                    <p className="text-xs text-muted-foreground mt-1">This credit reduces the effective total of this purchase</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Bill No</label>
                  <input type="text" value={form.billNo} onChange={(e) => setForm({ ...form, billNo: e.target.value })}
                    placeholder="e.g. INV-2024-001"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Bill Date</label>
                  <input type="date" value={form.billDate} onChange={(e) => setForm({ ...form, billDate: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Upload Copy of Bill</label>
                  <div className="flex items-center gap-2">
                    {form.billImageUrl ? (
                      <div className="flex items-center gap-2 flex-1">
                        <a href={form.billImageUrl.replace("&sz=w1000", "&sz=w2000")} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <FileImage className="h-3.5 w-3.5" /> View Bill
                        </a>
                        <button onClick={() => setForm({ ...form, billImageUrl: "" })}
                          className="text-xs text-red-500 hover:underline">Remove</button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium cursor-pointer flex-1">
                        {uploadingBill ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...</>
                        ) : (
                          <><Upload className="h-3.5 w-3.5" /> Choose File</>
                        )}
                        <input type="file" accept="image/*" className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) { await uploadBillImage(file); e.target.value = ""; }
                          }} />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="space-y-1 text-sm">
                  <p className="text-base font-bold text-secondary">
                    Total: {formatCurrency((form.discountAmount ?? 0) > 0 ? form.totalAmount - (form.discountAmount ?? 0) : form.totalAmount)}
                  </p>
                  {(form.discountAmount ?? 0) > 0 && (
                    <p className="text-muted-foreground text-xs">Subtotal: {formatCurrency(form.totalAmount)} <span className="text-red-500">-{formatCurrency(form.discountAmount ?? 0)} credit</span></p>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => setShowForm(false)} variant="outline">Cancel</Button>
                  <Button onClick={handleSave} disabled={saving || !form.supplierName || form.items.length === 0} variant="accent">
                    <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Purchase"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading...</p>
        ) : purchases.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No purchases yet.</p>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredData.map((p) => (
              <div key={p.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2">
                <button onClick={() => setDetailPurchaseId(p.id)} className="block space-y-2 w-full text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-secondary text-sm truncate">{p.supplierName}</p>
                      {p.supplierPhone && <p className="text-xs text-muted-foreground">{p.supplierPhone}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize shrink-0 ${
                        p.paymentStatus === "paid" ? "bg-green-50 text-green-700" :
                        p.paymentStatus === "partially_paid" ? "bg-amber-50 text-amber-700" :
                        "bg-red-50 text-red-700"
                      }`}>
                        {p.paymentStatus.replace("_", " ")}
                      </span>
                      {p.returned && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 shrink-0">Returned</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-secondary">{formatCurrency(p.totalAmount)}</span>
                    <span className="text-muted-foreground">{formatDate(p.purchaseDate)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.items?.length || 0} items</p>
                </button>
                <div className="flex items-center justify-between">
                  <button onClick={() => setDetailPurchaseId(p.id)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                    <Eye className="h-3 w-3" /> View Details
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openReturn(p)} disabled={p.returned}
                      className={"inline-flex items-center gap-1 text-xs " + (p.returned ? "text-muted-foreground/40 cursor-not-allowed" : "text-muted-foreground hover:text-primary")}>
                      <RotateCcw className="h-3 w-3" /> {p.returned ? "Returned" : "Return"}
                    </button>
                    <button onClick={() => handleDelete(p.id)}
                      className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                      <Trash2 className="h-3 w-3" />
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
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Supplier</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Items</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-center">Status</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-right">Date</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredData.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-sm font-medium text-secondary">{p.supplierName}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.items?.length || 0}</td>
                    <td className="px-4 py-2.5 text-sm text-right">{formatCurrency(p.totalAmount)}</td>
                    <td className="px-4 py-2.5 text-sm text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          p.paymentStatus === "paid" ? "bg-green-50 text-green-700" :
                          p.paymentStatus === "partially_paid" ? "bg-amber-50 text-amber-700" :
                          "bg-red-50 text-red-700"
                        }`}>
                          {p.paymentStatus.replace("_", " ")}
                        </span>
                        {p.returned && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">Returned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right text-muted-foreground">{formatDate(p.purchaseDate)}</td>
                    <td className="px-4 py-2.5 text-sm text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button onClick={() => openReturn(p)} disabled={p.returned} size="sm" variant="outline" className={"text-xs px-2 py-1 " + (p.returned ? "opacity-40 cursor-not-allowed" : "")} title={p.returned ? "Already returned" : "Return"}>
                          <Undo2 className="h-3 w-3" />
                        </Button>
                        <Button onClick={() => handleDelete(p.id)} size="sm" variant="outline" className="text-xs px-2 py-1 text-red-500">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {detailPurchaseData && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setDetailPurchaseId(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full my-8" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h2 className="text-lg font-semibold text-secondary">{detailPurchaseData.supplierName}</h2>
                <button onClick={() => setDetailPurchaseId(null)} className="p-1 hover:bg-muted rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Supplier Phone</p>
                    <p className="font-medium">{detailPurchaseData.supplierPhone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">{formatDate(detailPurchaseData.purchaseDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Payment Status</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full capitalize mt-0.5 ${
                      detailPurchaseData.paymentStatus === "paid" ? "bg-green-50 text-green-700" :
                      detailPurchaseData.paymentStatus === "partially_paid" ? "bg-amber-50 text-amber-700" :
                      "bg-red-50 text-red-700"
                    }`}>
                      {detailPurchaseData.paymentStatus.replace("_", " ")}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Payment Method</p>
                    <p className="font-medium capitalize">{detailPurchaseData.paymentMethod || "—"}</p>
                  </div>
                  {(detailPurchaseData.paidAmount ?? 0) > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Paid Amount</p>
                      <p className="font-medium">{formatCurrency(detailPurchaseData.paidAmount!)}</p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">Items</h3>
                  <div className="border border-border rounded-lg divide-y divide-border">
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground bg-muted/20 font-medium">
                      <span className="flex-1">Product</span>
                      <span className="w-16 text-center">Qty</span>
                      <span className="w-20 text-right">Buy Price</span>
                      <span className="w-20 text-right">Sales Price</span>
                      <span className="w-20 text-right">Subtotal</span>
                    </div>
                    {detailPurchaseData.items?.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                        <span className="flex-1 truncate">{item.productName}</span>
                        <span className="w-16 text-center">{item.quantity}</span>
                        <span className="w-20 text-right">{formatCurrency(item.unitCost)}</span>
                        <span className="w-20 text-right">{formatCurrency(item.salesPrice || 0)}</span>
                        <span className="w-20 text-right font-medium">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-bold text-secondary">{formatCurrency(detailPurchaseData.totalAmount)}</p>
                </div>

                {(detailPurchaseData.billNo || detailPurchaseData.billDate || detailPurchaseData.billImageUrl) && (
                  <div className="grid grid-cols-2 gap-3 text-sm border-t border-border pt-4">
                    {detailPurchaseData.billNo && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Bill No</p>
                        <p className="font-medium">{detailPurchaseData.billNo}</p>
                      </div>
                    )}
                    {detailPurchaseData.billDate && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Bill Date</p>
                        <p className="font-medium">{detailPurchaseData.billDate}</p>
                      </div>
                    )}
                    {detailPurchaseData.billImageUrl && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground mb-1">Bill Copy</p>
                        <a href={detailPurchaseData.billImageUrl.replace("&sz=w1000", "&sz=w2000")} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                          <FileImage className="h-4 w-4" /> View Bill <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {detailPurchaseData.notes && (
                  <div className="text-sm">
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p>{detailPurchaseData.notes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-4">
                  <p>Recorded by: {detailPurchaseData.recordedByName || detailPurchaseData.recordedBy || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {returnModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setReturnModal(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-secondary">Purchase Return</h2>
                <button onClick={() => setReturnModal(null)} className="p-1 hover:bg-muted rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Supplier: {returnModal.supplierName}</p>
              <div className="space-y-3 mb-4">
                {returnModal.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary truncate">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">Purchased: {item.quantity} × {formatCurrency(item.unitCost)}</p>
                    </div>
                    <input type="number" min={0} max={item.quantity} placeholder="Qty"
                      value={returnItems[i]?.qty || ""}
                      onChange={(e) => {
                        const val = Math.min(item.quantity, Math.max(0, Number(e.target.value)));
                        const updated = [...returnItems];
                        updated[i] = { ...updated[i], qty: val };
                        setReturnItems(updated);
                      }}
                      className="w-16 px-2 py-1 border border-border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="rt" checked={returnType === "refund"}
                    onChange={() => setReturnType("refund")} className="text-primary" />
                  Cash Refund (money back)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="rt" checked={returnType === "exchange"}
                    onChange={() => setReturnType("exchange")} className="text-primary" />
                  Exchange (credit on next purchase)
                </label>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="text-sm">
                  {returnItems.some((r) => r.qty > 0) && (
                    <p>Return Value: <span className="font-bold text-secondary">{formatCurrency(
                      returnModal.items.reduce((sum, item, i) => sum + (returnItems[i]?.qty || 0) * item.unitCost, 0)
                    )}</span></p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setReturnModal(null)} variant="outline">Cancel</Button>
                  <Button onClick={handleReturn} disabled={saving || returnItems.every((r) => r.qty <= 0)} variant="accent">
                    <Undo2 className="h-4 w-4" /> {saving ? "Processing..." : returnType === "refund" ? "Process Refund" : "Process Exchange"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

export default function AdminPurchasesPage() {
  return (
    <AdminLayout>
      <Suspense fallback={<div className="p-6 text-center text-muted-foreground">Loading...</div>}>
        <PurchasesContent />
      </Suspense>
    </AdminLayout>
  );
}
