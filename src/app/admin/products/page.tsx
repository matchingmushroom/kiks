"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { Product, ProductBadge, Category } from "@/types";
import { formatCurrency, formatNumber, formatDate, compressImageUnder200KB } from "@/lib/utils";
import { generateId } from "@/lib/id-generator";
import {
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  collection,
  Timestamp,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateDummyProducts } from "@/lib/dummyProducts";
import { generateBarcodeId, generateSku, generateModelNo, generateShortCode } from "@/lib/sku-generator";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import PrintLabelsDialog from "@/components/admin/PrintLabelsDialog";
import { Plus, Edit2, Trash2, Search, X, Eye, EyeOff, Star, LayoutGrid, List, Loader2, AlertTriangle, Upload, Package, Check, ShoppingBag, Printer } from "lucide-react";

const BASE_MATERIALS = ["", "Brass", "Alloy", "Copper", "Stainless Steel", "Silver", "Gold", "Plastic", "Steel", "Wood", "Bone", "Fabric", "Resin", "Polymer"];
const PLATING_OPTIONS = ["", "Gold-plated", "Silver-plated", "Rhodium", "Rose Gold-plated", "Sterling Silver", "Antique", "Matte", "Polished", "None"];
const COLOR_OPTIONS = ["", "Gold", "Silver", "Multicolor", "White", "Pink", "Green", "Red", "Blue", "Black", "Rose Gold", "Purple", "Peach", "Cream", "Brown", "Copper", "Bronze"];
// Sub Categories now come from the selected category's subCategories array
const IDEAL_FOR_OPTIONS = ["", "Women", "Men", "Girls", "Boys", "Unisex", "Women & Girls", "Men & Boys"];
const NET_QTY_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
const OCCASION_OPTIONS = ["", "Party", "Wedding", "Engagement", "Everyday", "Gift", "Workwear", "Dailywear"];



export default function AdminProductsPage() {
  const { data: products, loading } = useFirestore<Product>("products", {
    constraints: [orderBy("createdAt", "desc"), limit(200)],
    realtime: true,
  });
  const { data: categories } = useFirestore<Category>("categories", {
    constraints: [orderBy("order", "asc")],
    realtime: true,
  });

  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", design: "", categoryId: "", images: [""], videoUrl: "", price: 0, costPrice: 0, weight: 0, metalType: "Gold", stoneType: "None", stoneWeight: 0, makingCharge: 0, warranty: "0", sku: "", quantityInStock: 1, isActive: true, isFeatured: false, badge: "none" as ProductBadge, originalPrice: 0, brand: "", modelNo: "", baseMaterial: "", plating: "", color: "", productType: "", idealFor: [] as string[], netQuantity: 1, occasion: [] as string[], shortCode: "" });
  const [saving, setSaving] = useState(false);

  const [deletingAll, setDeletingAll] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [printLabelProduct, setPrintLabelProduct] = useState<{ productName: string; sku: string; barcodeId?: string; price: number; shortCode?: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [uploading, setUploading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showComboModal, setShowComboModal] = useState(false);
  const [comboName, setComboName] = useState("");
  const [comboProductSearch, setComboProductSearch] = useState("");
  const [selectedComboIds, setSelectedComboIds] = useState<string[]>([]);
  const [comboPrice, setComboPrice] = useState(0);
  const [savingCombo, setSavingCombo] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillDone, setBackfillDone] = useState(0);

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !search || p.name.toLowerCase().includes(q) || (p.shortCode || "").toLowerCase().includes(q);
    const matchCat = !catFilter || p.categoryId === catFilter;
    return matchSearch && matchCat;
  });

  const openEdit = (p: Product) => {
    setForm({
      name: p.name, description: p.description, design: p.design,
      categoryId: p.categoryId, images: p.images.length ? p.images : [""],
      videoUrl: p.videoUrl, price: p.price, costPrice: p.costPrice ?? Math.round(p.price * 0.5),
      weight: p.weight,
      metalType: p.metalType, stoneType: p.stoneType,
      stoneWeight: p.stoneWeight, makingCharge: p.makingCharge,
      warranty: p.warranty, sku: p.sku, quantityInStock: p.quantityInStock,
      isActive: p.isActive, isFeatured: p.isFeatured,
      badge: p.badge || "none", originalPrice: p.originalPrice || 0,
      brand: p.brand || "", modelNo: p.modelNo || "", baseMaterial: p.baseMaterial || "",
      plating: p.plating || "", color: p.color || "", productType: p.productType || "",
      idealFor: Array.isArray(p.idealFor) ? p.idealFor : (p.idealFor ? [p.idealFor] : []),
      netQuantity: p.netQuantity || 1,
      occasion: Array.isArray(p.occasion) ? p.occasion : (p.occasion ? [p.occasion] : []),
      shortCode: p.shortCode || "",
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.categoryId) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        images: form.images.filter(Boolean),
        price: Number(form.price),
        costPrice: Number(form.costPrice) || 0,
        weight: Number(form.weight),
        stoneWeight: Number(form.stoneWeight),
        makingCharge: Number(form.makingCharge),
        quantityInStock: Number(form.quantityInStock),
        originalPrice: Number(form.originalPrice) || 0,
        netQuantity: Number(form.netQuantity) || 1,
        badge: form.badge === "none" ? "" : form.badge,
        updatedAt: Timestamp.fromDate(new Date()),
      };
      if (editingId) {
        await updateDoc(doc(db, "products", editingId), data);
      } else {
        const prodId = await generateId("PROD");
        const cat = categories.find((c) => c.id === form.categoryId);
        const barcodeId = await generateBarcodeId(cat?.shortCode || "XX");
        const sku = generateSku(barcodeId, form.costPrice || 0, "XX", form.quantityInStock || 1);
        const modelNo = generateModelNo(cat?.shortCode || "XX", form.costPrice || 0, form.quantityInStock || 1);
        let shortCode = form.shortCode;
        if (!shortCode && cat?.shortCode) {
          const subIdx = cat.subCategories.indexOf(form.productType) + 1;
          if (subIdx > 0) {
            shortCode = await generateShortCode(cat.shortCode, subIdx);
          } else {
            shortCode = await generateShortCode(cat.shortCode, 0);
          }
        }
        await setDoc(doc(db, "products", prodId), {
          ...data,
          sku, barcodeId, modelNo, shortCode,
          createdAt: Timestamp.fromDate(new Date()),
        });
      }
      setShowForm(false);
      setEditingId(null);
    } catch (e) {
      console.error("Save failed", e);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "products", id));
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const handleDeleteAll = async () => {
    setDeleteConfirm("");
    setDeletingAll(true);
    try {
      const snap = await getDocs(collection(db, "products"));
      const ids = snap.docs.map((d) => d.id);
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        await Promise.all(batch.map((id) => deleteDoc(doc(db, "products", id))));
      }
      alert(`Deleted ${ids.length} products.`);
    } catch (e) {
      console.error("Delete all failed", e);
      alert("Failed to delete all products.");
    }
    setDeletingAll(false);
  };

  const handleSeed = async () => {
    if (!categories.length) { alert("No categories found. Create a category first."); return; }
    if (!confirm(`Add 50 dummy products across ${categories.length} categories (${categories.map(c => c.name).join(", ")})?`)) return;
    setSeeding(true);
    try {
      const dummyProducts = generateDummyProducts(categories.map(c => ({ id: c.id, name: c.name })));
      for (const p of dummyProducts) {
        const prodId = await generateId("PROD");
        await setDoc(doc(db, "products", prodId), p);
      }
      alert(`Added ${dummyProducts.length} dummy products across ${categories.length} categories successfully.`);
    } catch (e) {
      console.error("Seed failed", e);
      alert("Failed to seed products.");
    }
    setSeeding(false);
  };

  const toggleField = async (id: string, field: "isActive" | "isFeatured", value: boolean) => {
    await updateDoc(doc(db, "products", id), { [field]: value, updatedAt: Timestamp.fromDate(new Date()) });
  };

  const updateImage = (index: number, value: string) => {
    const images = [...form.images];
    images[index] = value;
    setForm({ ...form, images });
  };

  const addImage = () => {
    setForm({ ...form, images: [...form.images, ""] });
  };

  const removeImage = (index: number) => {
    const images = form.images.filter((_, i) => i !== index);
    setForm({ ...form, images: images.length ? images : [""] });
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const configSnap = await getDoc(doc(db, "shop_settings", "emailBackupConfig"));
      const cfg = configSnap.data() as Record<string, any> | undefined;
      if (!cfg?.gasWebhookUrl) {
        alert("GAS Webhook URL not configured. Please set it in Settings → Email & Backup first.");
        setUploading(false); return;
      }

      // Compress client-side: WebP with size-feedback loop to stay under 200KB
      const { base64: compressedBase64, mimeType: compressedMime, filename: compressedName } = await compressImageUnder200KB(file);
      const uploadId = "up_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

      const timeoutId = setTimeout(() => setUploading(false), 30000);
      const unsub = onSnapshot(doc(db, "pendingUploads", uploadId), (snap) => {
        const d = snap.data();
        if (!d || d.status === "pending") return;
        clearTimeout(timeoutId);
        unsub();
        if (d.status === "done") {
          const driveUrl = `https://drive.google.com/thumbnail?id=${d.fileId}&sz=w1000`;
          const images = [...form.images];
          const emptyIdx = images.indexOf("");
          if (emptyIdx !== -1) images[emptyIdx] = driveUrl;
          else images.push(driveUrl, "");
          setForm({ ...form, images });
        }
        deleteDoc(doc(db, "pendingUploads", uploadId)).catch(() => {});
        setUploading(false);
      });

      const authToken = await user?.getIdToken();

      await setDoc(doc(db, "pendingUploads", uploadId), { status: "pending", createdAt: Timestamp.fromDate(new Date()) });

      fetch(cfg.gasWebhookUrl, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
          action: "uploadImage", imageBase64: compressedBase64, filename: compressedName,
          mimeType: compressedMime, driveFolderId: cfg.imageDriveFolderId || undefined,
          uploadId, authToken,
        }),
      });
    } catch (e: any) {
      console.error("Upload failed", e);
      alert("Failed to upload image: " + (e.message || e));
      setUploading(false);
    }
  };

  const handleSaveCombo = async () => {
    if (!comboName || selectedComboIds.length === 0 || !comboPrice) return;
    setSavingCombo(true);
    try {
      const prodId = await generateId("PROD");
      const selectedProducts = products.filter((p) => selectedComboIds.includes(p.id));
      const catId = selectedProducts[0]?.categoryId || categories[0]?.id || "";
      const txn = Timestamp.fromDate(new Date());
      await setDoc(doc(db, "products", prodId), {
        name: comboName, description: `Combo of ${selectedProducts.map((p) => p.name).join(", ")}`,
        design: "", categoryId: catId, images: [], videoUrl: "", price: comboPrice,
        originalPrice: 0, badge: "", costPrice: comboPrice, weight: 0, purity: null,
        metalType: "Gold", stoneType: "None", stoneWeight: 0, makingCharge: 0,
        warranty: "0", sku: `COMBO-${prodId.slice(-6)}`, quantityInStock: 9999,
        isActive: true, isFeatured: false, brand: "", modelNo: `COMBO-${prodId.slice(-6)}`,
        baseMaterial: "", plating: "", color: "", productType: "", idealFor: [],
        netQuantity: 1, occasion: [], comboItems: selectedComboIds, comboPrice,
        createdAt: txn, updatedAt: txn,
      });
      setShowComboModal(false);
      setComboName("");
      setSelectedComboIds([]);
      setComboPrice(0);
    } catch (e) {
      console.error("Combo creation failed", e);
      alert("Failed to create combo: " + (e instanceof Error ? e.message : "Unknown error"));
    }
    setSavingCombo(false);
  };

  const handleBackfillShortCodes = async () => {
    const missing = products.filter((p) => !p.shortCode && !p.comboItems?.length);
    if (missing.length === 0) { alert("All products already have short codes."); return; }
    if (!confirm(`Generate short codes for ${missing.length} products?`)) return;
    setBackfilling(true);
    setBackfillDone(0);
    try {
      const groups: Record<string, { product: Product; cat: Category | undefined; subIdx: number }[]> = {};
      for (const p of missing) {
        const cat = categories.find((c) => c.id === p.categoryId);
        const subIdx = cat ? cat.subCategories.indexOf(p.productType) + 1 : 0;
        const key = `${cat?.shortCode || "XX"}_${subIdx}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push({ product: p, cat, subIdx });
      }
      let done = 0;
      const total = missing.length;
      for (const [key, group] of Object.entries(groups)) {
        const [catCode, subIdxStr] = key.split("_");
        const subIdx = Number(subIdxStr);
        const counterKey = `shortCode_${catCode}_${subIdx}`;
        const counterRef = doc(db, "counters", counterKey);
        const snap = await getDoc(counterRef);
        let next = (snap.exists() ? snap.data().lastNumber : 0);
        for (const { product: p } of group) {
          next++;
          const shortCode = `${catCode}${subIdx}-${next}`;
          await updateDoc(doc(db, "products", p.id), { shortCode });
          done++;
          setBackfillDone(done);
        }
        await setDoc(counterRef, { lastNumber: next }, { merge: true });
      }
      alert(`Backfilled ${done} products with short codes.`);
    } catch (e) {
      console.error("Backfill failed", e);
      alert("Backfill failed: " + (e instanceof Error ? e.message : "Unknown error"));
    }
    setBackfilling(false);
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Products</h1>
            <p className="text-sm text-muted-foreground">{products.length} total</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="p-2 border border-border rounded-lg text-muted-foreground hover:bg-muted" title={viewMode === "grid" ? "List View" : "Grid View"}>
              {viewMode === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </button>
            <Button onClick={handleBackfillShortCodes} disabled={backfilling} variant="outline" className="text-xs">
              {backfilling ? `Backfilling ${backfillDone}...` : "Backfill Short Codes"}
            </Button>
            <Button onClick={() => { setShowComboModal(true); setComboName(""); setComboProductSearch(""); setSelectedComboIds([]); setComboPrice(0); }} variant="outline">
              <Package className="h-4 w-4" /> Create Combo
            </Button>
            <Button onClick={() => window.location.href = "/admin/purchases"} variant="accent">
              <Plus className="h-4 w-4" /> Add Product via Purchase
            </Button>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-700 mb-1">
                  Delete ALL {products.length} products? This cannot be undone.
                </p>
                <p className="text-xs text-red-600 mb-3">
                  Type <strong>DELETE</strong> below and click Confirm to proceed.
                </p>
                <input type="text" placeholder='Type "DELETE" to confirm'
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="px-3 py-2 border border-red-300 rounded-lg text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-red-400 mb-3" />
                <div className="flex gap-2">
                  <Button onClick={handleDeleteAll} disabled={deletingAll || deleteConfirm !== "DELETE"} variant="accent" className="bg-red-600 hover:bg-red-700">
                    {deletingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {deletingAll ? "Deleting..." : "Confirm Delete All"}
                  </Button>
                  <Button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirm(""); }} variant="outline">Cancel</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text" placeholder="Search products..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Default</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {showComboModal && (
          <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-secondary flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> Create Combo
              </h2>
              <button onClick={() => setShowComboModal(false)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Combo Name *</label>
                <input type="text" placeholder="e.g. Wedding Gift Set" value={comboName}
                  onChange={(e) => setComboName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Select Products</label>
                <input type="text" placeholder="Search products..." value={comboProductSearch}
                  onChange={(e) => setComboProductSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-2" />
                <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                  {products.filter((p) => !p.comboItems?.length && (p.name.toLowerCase().includes(comboProductSearch.toLowerCase()) || (p.sku || "").toLowerCase().includes(comboProductSearch.toLowerCase()))).map((p) => (
                    <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm">
                      <input type="checkbox" checked={selectedComboIds.includes(p.id)}
                        onChange={() => setSelectedComboIds((prev) => prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id])}
                        className="rounded border-border accent-primary" />
                      <span className="flex-1">{p.name}</span>
                      <span className="text-muted-foreground">Rs. {formatNumber(p.price)}</span>
                    </label>
                  ))}
                  {products.filter((p) => !p.comboItems?.length).length === 0 && (
                    <p className="px-3 py-4 text-sm text-muted-foreground text-center">No products available</p>
                  )}
                </div>
                {selectedComboIds.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedComboIds.length} product(s) selected — Total MRP: Rs. {formatNumber(selectedComboIds.reduce((sum, id) => sum + (products.find((p) => p.id === id)?.price || 0), 0))}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Combo Price (NPR) *</label>
                <input type="number" placeholder="e.g. 999" value={comboPrice || ""}
                  onChange={(e) => setComboPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => setShowComboModal(false)} variant="outline">Cancel</Button>
                <Button onClick={handleSaveCombo} disabled={!comboName || selectedComboIds.length === 0 || !comboPrice || savingCombo} variant="accent">
                  {savingCombo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {savingCombo ? "Creating..." : "Create Combo"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-secondary">
                {editingId ? "Edit Product" : "New Product"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 border-b border-border pb-2">General Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                    <select value={form.categoryId} onChange={(e) => {
                      const catId = e.target.value;
                      if (catId && !editingId) {
                        const cat = categories.find((c) => c.id === catId);
                          if (cat?.shortCode) {
                          const cp = form.costPrice || 0;
                          setForm((prev) => ({
                            ...prev,
                            categoryId: catId,
                            sku: generateSku(cat.shortCode, cp, "XX", 1),
                            modelNo: generateModelNo(cat.shortCode, cp, 1),
                          }));
                          return;
                        }
                      }
                      setForm((prev) => ({ ...prev, categoryId: catId }));
                    }}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">Select</option>
                      {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Brand</label>
                    <input type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Model Number</label>
                    <input type="text" value={form.modelNo} onChange={(e) => setForm({ ...form, modelNo: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Base Material</label>
                    <select value={form.baseMaterial} onChange={(e) => setForm({ ...form, baseMaterial: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      {BASE_MATERIALS.map((m) => (<option key={m} value={m}>{m || "Select"}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Plating Type</label>
                    <select value={form.plating} onChange={(e) => setForm({ ...form, plating: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      {PLATING_OPTIONS.map((p) => (<option key={p} value={p}>{p || "Select"}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Color</label>
                    <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      {COLOR_OPTIONS.map((c) => (<option key={c} value={c}>{c || "Select"}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Sub Category</label>
                    <select value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">Select</option>
                      {categories.find((c) => c.id === form.categoryId)?.subCategories?.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Ideal For (select all that apply)</label>
                    <div className="flex flex-wrap gap-2">
                      {IDEAL_FOR_OPTIONS.filter(Boolean).map((f) => (
                        <label key={f} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                          <input type="checkbox" checked={form.idealFor.includes(f)}
                            onChange={() => setForm({
                              ...form,
                              idealFor: form.idealFor.includes(f)
                                ? form.idealFor.filter((x: string) => x !== f)
                                : [...form.idealFor, f],
                            })}
                            className="accent-primary" />
                          {f}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Net Quantity</label>
                    <select value={form.netQuantity} onChange={(e) => setForm({ ...form, netQuantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      {NET_QTY_OPTIONS.map((n) => (<option key={n} value={n}>{n}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Occasion (select all that apply)</label>
                    <div className="flex flex-wrap gap-2">
                      {OCCASION_OPTIONS.filter(Boolean).map((c) => (
                        <label key={c} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                          <input type="checkbox" checked={form.occasion.includes(c)}
                            onChange={() => setForm({
                              ...form,
                              occasion: form.occasion.includes(c)
                                ? form.occasion.filter((x: string) => x !== c)
                                : [...form.occasion, c],
                            })}
                            className="accent-primary" />
                          {c}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {editingId && products.find((p) => p.id === editingId)?.comboItems?.length ? (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
                  <h3 className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Combo Items</h3>
                  <div className="space-y-1">
                    {products.find((p) => p.id === editingId)?.comboItems?.map((pid) => {
                      const cp = products.find((x) => x.id === pid);
                      return cp ? (
                        <div key={pid} className="flex justify-between text-sm">
                          <span>{cp.name}</span>
                          <span className="text-muted-foreground">Rs. {formatNumber(cp.price)}</span>
                        </div>
                      ) : null;
                    })}
                    <div className="flex justify-between text-sm font-medium pt-1 border-t border-purple-200 mt-1">
                      <span>Combo Price</span>
                      <span className="text-purple-700">Rs. {formatNumber(products.find((p) => p.id === editingId)?.comboPrice || 0)}</span>
                    </div>
                  </div>
                </div>
              ) : null}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 border-b border-border pb-2">Pricing & Stock</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Price (NPR)</label>
                    <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Cost Price (NPR)</label>
                    <input type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Stock Quantity</label>
                    {editingId && products.find((p) => p.id === editingId)?.comboItems?.length ? (
                      <div className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-muted-foreground flex items-center gap-2">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">Combo</span>
                        Unlimited
                      </div>
                    ) : (
                      <input type="number" value={form.quantityInStock} onChange={(e) => setForm({ ...form, quantityInStock: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">SKU</label>
                    <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Short Code</label>
                    <div className="flex gap-2">
                      <input type="text" value={form.shortCode} onChange={(e) => setForm({ ...form, shortCode: e.target.value })}
                        placeholder="Auto-generated"
                        className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      <button type="button" onClick={async () => {
                        const cat = categories.find((c) => c.id === form.categoryId);
                        if (!cat?.shortCode) { alert("Select a category with a short code first."); return; }
                        const subIdx = cat.subCategories.indexOf(form.productType) + 1;
                        const sc = await generateShortCode(cat.shortCode, subIdx > 0 ? subIdx : 0);
                        setForm((prev) => ({ ...prev, shortCode: sc }));
                      }} className="px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted">
                        Generate
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Badge</label>
                    <select value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value as ProductBadge })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="none">None</option>
                      <option value="limited_stock">Limited Stock</option>
                      <option value="out_of_stock">Out of Stock</option>
                      <option value="price_dropped">Price Dropped</option>
                      <option value="offer">Offer</option>
                    </select>
                  </div>
                  {(form.badge === "price_dropped" || form.badge === "offer") && (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Original Price (NPR)</label>
                      <input type="number" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  )}
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                        className="rounded border-border" />
                      Active
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                        className="rounded border-border" />
                      Featured
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 border-b border-border pb-2">Additional Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Warranty</label>
                    <input type="text" value={form.warranty} onChange={(e) => setForm({ ...form, warranty: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Design Code</label>
                    <input type="text" value={form.design} onChange={(e) => setForm({ ...form, design: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Video URL</label>
                    <input type="text" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="https://youtube.com/embed/..." />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 border-b border-border pb-2">Description & Images</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                    <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" rows={2} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Images (URL)</label>
                    <div className="space-y-2">
                      {form.images.map((url, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input type="text" value={url} onChange={(e) => updateImage(i, e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          <div className="flex items-center gap-1 shrink-0">
                            {url && (
                              <img src={url.includes("drive.google.com") ? url.replace(/.*[?&]id=([^&]+).*/, "https://drive.google.com/thumbnail?id=$1&sz=w400").replace(/.*\/d\/([^/?#&]+).*/, "https://drive.google.com/thumbnail?id=$1&sz=w400") : url} alt=""
                                className="w-10 h-10 object-cover rounded border border-border"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                            )}
                            {form.images.length > 1 && (
                              <button onClick={() => removeImage(i)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center gap-3 pt-1">
                        <button onClick={addImage}
                          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium">
                          <Plus className="h-3.5 w-3.5" /> Add Image URL
                        </button>
                        <label className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium cursor-pointer">
                          {uploading ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...</>
                          ) : (
                            <><Upload className="h-3.5 w-3.5" /> Upload to Drive</>
                          )}
                          <input type="file" accept="image/*" className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) { await uploadImage(file); e.target.value = ""; }
                            }} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleSave} disabled={saving || !form.name} variant="accent">
                {saving ? "Saving..." : editingId ? "Update Product" : "Create Product"}
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline">Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingSpinner text="Loading products..." />
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No products found.</p>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((p) => {
              const catName = categories.find((c) => c.id === p.categoryId)?.name || "—";
              return (
                <div key={p.id} onClick={() => setDetailProduct(p)} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2 cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-secondary text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{catName}{p.brand ? ` • ${p.brand}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); toggleField(p.id, "isActive", !p.isActive); }}
                        className={`p-1.5 rounded ${p.isActive ? "text-green-600" : "text-muted-foreground"}`}
                        title={p.isActive ? "Active" : "Inactive"}>
                        {p.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); toggleField(p.id, "isFeatured", !p.isFeatured); }}
                        className={`p-1.5 rounded ${p.isFeatured ? "text-amber-500" : "text-muted-foreground"}`}
                        title={p.isFeatured ? "Featured" : "Not featured"}>
                        <Star className={`h-3.5 w-3.5 ${p.isFeatured ? "fill-amber-500" : ""}`} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name); }} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="font-semibold text-secondary">{formatCurrency(p.price)}</span>
                    {p.shortCode && <span className="font-mono text-primary font-medium">{p.shortCode}</span>}
                    {p.baseMaterial && <span className="text-muted-foreground">{p.baseMaterial}</span>}
                    {p.plating && <span className="text-muted-foreground">{p.plating}</span>}
                    <span className={p.quantityInStock <= 3 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                      Stock: {p.quantityInStock}
                    </span>
                    {p.comboItems?.length ? (
                      <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-medium">{p.comboItems.length} items</span>
                    ) : null}
                    {p.badge && p.badge !== "none" && (
                      <span className="bg-muted px-1.5 py-0.5 rounded">
                        {{limited_stock:"Limited",out_of_stock:"OOS",price_dropped:"Price ↓",offer:"Offer"}[p.badge]}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left">
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Name</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Category</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Brand</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Short Code</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-right">Price</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-right">Stock</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-center">Badge</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => {
                  const catName = categories.find((c) => c.id === p.categoryId)?.name || "—";
                  return (
                    <tr key={p.id} onClick={() => setDetailProduct(p)} className="hover:bg-muted/30 cursor-pointer">
                      <td className="px-4 py-2.5 text-sm font-medium text-secondary">{p.name}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{catName}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.brand || "—"}</td>
                      <td className="px-4 py-2.5 text-sm font-mono">{p.shortCode || "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{formatCurrency(p.price)}</td>
                      <td className={`px-4 py-2.5 text-sm text-right ${p.quantityInStock <= 3 ? "text-red-600 font-medium" : ""}`}>{p.quantityInStock}</td>
                      <td className="px-4 py-2.5 text-sm text-center">
                        {p.comboItems?.length ? (
                          <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs font-medium">Combo</span>
                        ) : p.badge && p.badge !== "none" ? (
                          <span className="bg-muted px-1.5 py-0.5 rounded text-xs">
                            {{limited_stock:"Limited",out_of_stock:"OOS",price_dropped:"Price ↓",offer:"Offer"}[p.badge]}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={(e) => { e.stopPropagation(); toggleField(p.id, "isActive", !p.isActive); }}
                            className={`p-1.5 rounded ${p.isActive ? "text-green-600" : "text-muted-foreground"}`} title={p.isActive ? "Active" : "Inactive"}>
                            {p.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); toggleField(p.id, "isFeatured", !p.isFeatured); }}
                            className={`p-1.5 rounded ${p.isFeatured ? "text-amber-500" : "text-muted-foreground"}`} title={p.isFeatured ? "Featured" : "Not featured"}>
                            <Star className={`h-3.5 w-3.5 ${p.isFeatured ? "fill-amber-500" : ""}`} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name); }} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {detailProduct && (
          <DetailModal title="Product Details" onClose={() => setDetailProduct(null)}>
            <div className="space-y-3 text-sm">
              <Row label="Name" value={detailProduct.name} />
              <Row label="Category" value={categories.find((c) => c.id === detailProduct.categoryId)?.name || "—"} />
              <Row label="Brand" value={detailProduct.brand || "—"} />
              <Row label="Price" value={`Rs. ${detailProduct.price}`} />
              <Row label="Cost Price" value={detailProduct.costPrice ? `Rs. ${detailProduct.costPrice}` : "—"} />
              <Row label="Stock" value={String(detailProduct.quantityInStock)} />
              <Row label="SKU" value={detailProduct.sku || "—"} />
              <Row label="Short Code" value={detailProduct.shortCode || "—"} />
              <Row label="Base Material" value={detailProduct.baseMaterial || "—"} />
              <Row label="Purity" value={detailProduct.purity || "—"} />
              <Row label="Weight" value={detailProduct.weight ? `${detailProduct.weight}g` : "—"} />
              <Row label="Plating" value={detailProduct.plating || "—"} />
              <Row label="Badge" value={detailProduct.badge && detailProduct.badge !== "none" ? detailProduct.badge.replace("_", " ") : "None"} />
              <Row label="Status" value={detailProduct.isActive ? "Active" : "Inactive"} />
              <Row label="Featured" value={detailProduct.isFeatured ? "Yes" : "No"} />
              {detailProduct.description && <Row label="Description" value={detailProduct.description} />}
              {detailProduct.images.filter(Boolean).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Images</p>
                  <div className="flex flex-wrap gap-2">
                    {detailProduct.images.filter(Boolean).map((url, i) => (
                      <img key={i} src={url} alt="" className="w-20 h-20 object-cover rounded border border-border"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                    ))}
                  </div>
                </div>
              )}
              {detailProduct.comboItems?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Combo Items</p>
                  <div className="space-y-1">
                    {detailProduct.comboItems.map((pid) => {
                      const cp = products.find((x) => x.id === pid);
                      return cp ? (
                        <div key={pid} className="flex justify-between text-xs">
                          <span>{cp.name}</span>
                          <span className="text-muted-foreground">Rs. {formatNumber(cp.price)}</span>
                        </div>
                      ) : null;
                    })}
                    <div className="flex justify-between text-xs font-medium pt-1 border-t border-border mt-1">
                      <span>Combo Price</span>
                      <span className="text-primary">Rs. {formatNumber(detailProduct.comboPrice || detailProduct.price)}</span>
                    </div>
                  </div>
                </div>
              ) : null}
              <Row label="Created" value={formatDate(detailProduct.createdAt)} />
            </div>
            <div className="mt-4 pt-4 border-t border-border flex justify-end">
              <Button onClick={() => setPrintLabelProduct({ productName: detailProduct.name, sku: detailProduct.sku || "", barcodeId: detailProduct.barcodeId, price: detailProduct.price, shortCode: detailProduct.shortCode })} variant="accent" size="sm">
                <Printer className="h-4 w-4" /> Print Label
              </Button>
            </div>
          </DetailModal>
        )}
      </div>

      {printLabelProduct && (
        <PrintLabelsDialog
          items={[{ ...printLabelProduct, quantity: 1 }]}
          onClose={() => setPrintLabelProduct(null)}
        />
      )}
    </AdminLayout>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-muted-foreground text-xs shrink-0 mr-4">{label}</span>
      <span className="text-right text-secondary">{value}</span>
    </div>
  );
}

function DetailModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-secondary">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}