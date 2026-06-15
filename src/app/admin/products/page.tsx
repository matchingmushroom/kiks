"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { Product, Category } from "@/types";
import { formatCurrency } from "@/lib/utils";
import {
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  collection,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Plus, Edit2, Trash2, Search, X, Eye, EyeOff, Star } from "lucide-react";

const emptyProduct = {
  name: "", description: "", design: "", categoryId: "",
  images: [""], videoUrl: "", price: 0, weight: 0,
  purity: "22K", metalType: "Gold", stoneType: "None",
  stoneWeight: 0, makingCharge: 0, warranty: "1 year",
  sku: "", quantityInStock: 1, isActive: true, isFeatured: false,
};

export default function AdminProductsPage() {
  const { data: products, loading } = useFirestore<Product>("products", {
    constraints: [orderBy("createdAt", "desc")],
  });
  const { data: categories } = useFirestore<Category>("categories", {
    constraints: [orderBy("order", "asc")],
  });

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyProduct });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (categories.length > 0 && !form.categoryId) {
      setForm((f) => ({ ...f, categoryId: categories[0].id }));
    }
  }, [categories, form.categoryId]);

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || p.categoryId === catFilter;
    return matchSearch && matchCat;
  });

  const openAdd = () => {
    setForm({ ...emptyProduct, categoryId: categories[0]?.id || "" });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setForm({
      name: p.name, description: p.description, design: p.design,
      categoryId: p.categoryId, images: p.images.length ? p.images : [""],
      videoUrl: p.videoUrl, price: p.price, weight: p.weight,
      purity: p.purity, metalType: p.metalType, stoneType: p.stoneType,
      stoneWeight: p.stoneWeight, makingCharge: p.makingCharge,
      warranty: p.warranty, sku: p.sku, quantityInStock: p.quantityInStock,
      isActive: p.isActive, isFeatured: p.isFeatured,
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
        weight: Number(form.weight),
        stoneWeight: Number(form.stoneWeight),
        makingCharge: Number(form.makingCharge),
        quantityInStock: Number(form.quantityInStock),
        updatedAt: Timestamp.fromDate(new Date()),
      };
      if (editingId) {
        await updateDoc(doc(db, "products", editingId), data);
      } else {
        await addDoc(collection(db, "products"), {
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

  const toggleField = async (id: string, field: "isActive" | "isFeatured", value: boolean) => {
    await updateDoc(doc(db, "products", id), { [field]: value, updatedAt: Timestamp.fromDate(new Date()) });
  };

  const updateImage = (index: number, value: string) => {
    const images = [...form.images];
    images[index] = value;
    if (index === images.length - 1 && value) {
      images.push("");
    }
    setForm({ ...form, images });
  };

  const removeImage = (index: number) => {
    const images = form.images.filter((_, i) => i !== index);
    setForm({ ...form, images: images.length ? images : [""] });
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Products</h1>
            <p className="text-sm text-muted-foreground">{products.length} total</p>
          </div>
          <Button onClick={openAdd} variant="accent">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>

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
            <option value="">All Categories</option>
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
                  {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Price (NPR)</label>
                <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Weight (g)</label>
                <input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Purity</label>
                <select value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {["24K", "22K", "18K", "14K", "10K", "95% Silver", "92.5% Silver", "90% Silver"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Metal Type</label>
                <select value={form.metalType} onChange={(e) => setForm({ ...form, metalType: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {["Gold", "Silver", "Platinum", "Rose Gold", "White Gold"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Stone Type</label>
                <select value={form.stoneType} onChange={(e) => setForm({ ...form, stoneType: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {["None", "Diamond", "Ruby", "Emerald", "Sapphire", "Pearl", "Cubic Zirconia"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Stone Weight (ct)</label>
                <input type="number" step="0.01" value={form.stoneWeight} onChange={(e) => setForm({ ...form, stoneWeight: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Making Charge (NPR)</label>
                <input type="number" value={form.makingCharge} onChange={(e) => setForm({ ...form, makingCharge: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Warranty</label>
                <input type="text" value={form.warranty} onChange={(e) => setForm({ ...form, warranty: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">SKU</label>
                <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Stock Quantity</label>
                <input type="number" value={form.quantityInStock} onChange={(e) => setForm({ ...form, quantityInStock: Number(e.target.value) })}
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
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" rows={2} />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Images (URL)</label>
                <div className="space-y-2">
                  {form.images.map((url, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" value={url} onChange={(e) => updateImage(i, e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      {form.images.length > 1 && (
                        <button onClick={() => removeImage(i)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
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
        ) : (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Price</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Weight</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Stock</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => {
                    const catName = categories.find((c) => c.id === p.categoryId)?.name || "—";
                    return (
                      <tr key={p.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium text-secondary max-w-[200px] truncate">{p.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{catName}</td>
                        <td className="px-4 py-3">{formatCurrency(p.price)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.weight}g</td>
                        <td className="px-4 py-3">
                          <span className={p.quantityInStock <= 3 ? "text-red-600 font-medium" : ""}>
                            {p.quantityInStock}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleField(p.id, "isActive", !p.isActive)}
                              className={`p-1 rounded ${p.isActive ? "text-green-600" : "text-muted-foreground"}`}
                              title={p.isActive ? "Active" : "Inactive"}>
                              {p.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => toggleField(p.id, "isFeatured", !p.isFeatured)}
                              className={`p-1 rounded ${p.isFeatured ? "text-amber-500" : "text-muted-foreground"}`}
                              title={p.isFeatured ? "Featured" : "Not featured"}>
                              <Star className={`h-3.5 w-3.5 ${p.isFeatured ? "fill-amber-500" : ""}`} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(p)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
