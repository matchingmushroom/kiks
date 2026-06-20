"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { Product, ProductBadge, Category } from "@/types";
import { formatCurrency } from "@/lib/utils";
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
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Plus, Edit2, Trash2, Search, X, Eye, EyeOff, Star, LayoutGrid, List, Globe, Loader2, AlertTriangle, Upload } from "lucide-react";

const BASE_MATERIALS = ["", "Brass", "Alloy", "Copper", "Stainless Steel", "Silver", "Gold", "Plastic", "Steel", "Wood", "Bone", "Fabric", "Resin", "Polymer"];
const PLATING_OPTIONS = ["", "Gold-plated", "Silver-plated", "Rhodium", "Rose Gold-plated", "Sterling Silver", "Antique", "Matte", "Polished", "None"];
const COLOR_OPTIONS = ["", "Gold", "Silver", "Multicolor", "White", "Pink", "Green", "Red", "Blue", "Black", "Rose Gold", "Purple", "Peach", "Cream", "Brown", "Copper", "Bronze"];
const PRODUCT_TYPES = ["", "Jewel Set", "Necklace", "Earrings", "Bracelet", "Ring", "Mangalsutra Set", "Pendant Set", "Chain", "Bangles", "Nosepin", "Anklet", "Brooch", "Hair Accessory", "Cufflinks"];
const IDEAL_FOR_OPTIONS = ["", "Women", "Men", "Girls", "Boys", "Unisex", "Women & Girls", "Men & Boys"];
const NET_QTY_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
const OCCASION_OPTIONS = ["", "Party", "Wedding", "Engagement", "Everyday", "Gift", "Workwear", "Dailywear"];

const emptyProduct = {
  name: "", description: "", design: "", categoryId: "",
  images: [""], videoUrl: "", price: 0, costPrice: 0, weight: 0,
  metalType: "Gold", stoneType: "None",
  stoneWeight: 0, makingCharge: 0, warranty: "1 year",
  sku: "", quantityInStock: 1, isActive: true, isFeatured: false,
  badge: "none" as ProductBadge, originalPrice: 0,
  brand: "", modelNo: "", baseMaterial: "", plating: "",
  color: "", productType: "", idealFor: [] as string[], netQuantity: 1, occasion: [] as string[],
};

export default function AdminProductsPage() {
  const { data: products, loading } = useFirestore<Product>("products", {
    constraints: [orderBy("createdAt", "desc")],
  });
  const { data: categories } = useFirestore<Category>("categories", {
    constraints: [orderBy("order", "asc")],
    realtime: false,
  });

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyProduct });
  const [saving, setSaving] = useState(false);

  const [flipkartUrl, setFlipkartUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [uploading, setUploading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || p.categoryId === catFilter;
    return matchSearch && matchCat;
  });

  const openAdd = () => {
    setForm({ ...emptyProduct });
    setEditingId(null);
    setShowForm(true);
  };

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
        await setDoc(doc(db, "products", prodId), {
          ...data,
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

      const uploadId = "up_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

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

      await setDoc(doc(db, "pendingUploads", uploadId), { status: "pending", createdAt: Timestamp.fromDate(new Date()) });

      fetch(cfg.gasWebhookUrl, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
          action: "uploadImage", imageBase64: base64, filename: file.name,
          mimeType: file.type, driveFolderId: cfg.imageDriveFolderId || undefined,
          uploadId,
        }),
      });
    } catch (e: any) {
      console.error("Upload failed", e);
      alert("Failed to upload image: " + (e.message || e));
      setUploading(false);
    }
  };

  const importFromFlipkart = async () => {
    if (!flipkartUrl.trim()) return;
    setImporting(true);
    try {
      const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(flipkartUrl)}`;
      const res = await fetch(proxy);
      const html = await res.text();

      const doc = new DOMParser().parseFromString(html, "text/html");

      const ldScripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];
      let ld: any = null;
      for (const script of ldScripts) {
        try { ld = JSON.parse(script.textContent || ""); if (ld?.name) break; } catch {}
      }

      let name = ld?.name || doc.querySelector('[class*="B_NuCI"]')?.textContent || "";
      let price = ld?.offers?.price || parseFloat(doc.querySelector('[class*="_30jeq3"]')?.textContent?.replace(/[^0-9.]/g, "") || "0");
      let description = ld?.description || doc.querySelector('[class*="_1mXcCf"]')?.textContent || "";
      let brand = ld?.brand?.name || "";
      let images: string[] = [];
      if (ld?.image) images = Array.isArray(ld.image) ? ld.image : [ld.image];

      const baseMaterial = BASE_MATERIALS.find((m) => m && html.toLowerCase().includes(m.toLowerCase())) || "";
      const plating = PLATING_OPTIONS.find((p) => p && html.toLowerCase().includes(p.toLowerCase())) || "";
      const color = COLOR_OPTIONS.find((c) => c && html.toLowerCase().includes(c.toLowerCase())) || "";
      const productType = PRODUCT_TYPES.find((t) => t && html.toLowerCase().includes(t.toLowerCase())) || "";

      setForm({
        ...emptyProduct,
        categoryId: categories[0]?.id || "",
        name: name || form.name,
        price: price || form.price,
        description: description || form.description,
        brand: brand || form.brand,
        images: images.length ? images : [""],
        baseMaterial: baseMaterial || form.baseMaterial,
        plating: plating || form.plating,
        color: color || form.color,
        productType: productType || form.productType,
      });
      setShowImport(false);
      setFlipkartUrl("");
      setShowForm(true);
    } catch (e) {
      console.error("Import failed", e);
      alert("Could not fetch product data from that URL. Try a different URL or enter details manually.");
    }
    setImporting(false);
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
            <Button onClick={() => { setShowImport(true); setFlipkartUrl(""); }} variant="outline">
              <Globe className="h-4 w-4" /> Import
            </Button>
            <Button onClick={handleSeed} disabled={seeding || !categories.length} variant="outline">
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {seeding ? "Seeding..." : "Seed 50"}
            </Button>
            {products.length > 0 && (
              <Button onClick={() => { setShowDeleteConfirm(true); setDeleteConfirm(""); }} variant="outline" className="text-red-500 border-red-200 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> Delete All
              </Button>
            )}
            <Button onClick={openAdd} variant="accent">
              <Plus className="h-4 w-4" /> Add Product
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

        {showImport && (
          <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-secondary">Import from Flipkart</h2>
              <button onClick={() => setShowImport(false)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Paste a Flipkart product URL to auto-fill product details.</p>
            <div className="flex gap-3">
              <input type="url" placeholder="https://www.flipkart.com/..." value={flipkartUrl}
                onChange={(e) => setFlipkartUrl(e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <Button onClick={importFromFlipkart} disabled={importing || !flipkartUrl.trim()} variant="accent">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                {importing ? "Fetching..." : "Fetch & Fill"}
              </Button>
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
                    <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
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
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
                    <select value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      {PRODUCT_TYPES.map((t) => (<option key={t} value={t}>{t || "Select"}</option>))}
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
                    <input type="number" value={form.quantityInStock} onChange={(e) => setForm({ ...form, quantityInStock: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">SKU</label>
                    <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
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
                <div key={p.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-secondary text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{catName}{p.brand ? ` • ${p.brand}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => toggleField(p.id, "isActive", !p.isActive)}
                        className={`p-1.5 rounded ${p.isActive ? "text-green-600" : "text-muted-foreground"}`}
                        title={p.isActive ? "Active" : "Inactive"}>
                        {p.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => toggleField(p.id, "isFeatured", !p.isFeatured)}
                        className={`p-1.5 rounded ${p.isFeatured ? "text-amber-500" : "text-muted-foreground"}`}
                        title={p.isFeatured ? "Featured" : "Not featured"}>
                        <Star className={`h-3.5 w-3.5 ${p.isFeatured ? "fill-amber-500" : ""}`} />
                      </button>
                      <button onClick={() => openEdit(p)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="font-semibold text-secondary">{formatCurrency(p.price)}</span>
                    {p.baseMaterial && <span className="text-muted-foreground">{p.baseMaterial}</span>}
                    {p.plating && <span className="text-muted-foreground">{p.plating}</span>}
                    <span className={p.quantityInStock <= 3 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                      Stock: {p.quantityInStock}
                    </span>
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
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 text-sm font-medium text-secondary">{p.name}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{catName}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.brand || "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{formatCurrency(p.price)}</td>
                      <td className={`px-4 py-2.5 text-sm text-right ${p.quantityInStock <= 3 ? "text-red-600 font-medium" : ""}`}>{p.quantityInStock}</td>
                      <td className="px-4 py-2.5 text-sm text-center">
                        {p.badge && p.badge !== "none" && (
                          <span className="bg-muted px-1.5 py-0.5 rounded text-xs">
                            {{limited_stock:"Limited",out_of_stock:"OOS",price_dropped:"Price ↓",offer:"Offer"}[p.badge]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => toggleField(p.id, "isActive", !p.isActive)}
                            className={`p-1.5 rounded ${p.isActive ? "text-green-600" : "text-muted-foreground"}`} title={p.isActive ? "Active" : "Inactive"}>
                            {p.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => toggleField(p.id, "isFeatured", !p.isFeatured)}
                            className={`p-1.5 rounded ${p.isFeatured ? "text-amber-500" : "text-muted-foreground"}`} title={p.isFeatured ? "Featured" : "Not featured"}>
                            <Star className={`h-3.5 w-3.5 ${p.isFeatured ? "fill-amber-500" : ""}`} />
                          </button>
                          <button onClick={() => openEdit(p)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}