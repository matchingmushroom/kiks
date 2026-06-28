"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit, useDataCache } from "@/hooks/useFirestore";
import { Category } from "@/types";
import {
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  collection,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { generateId } from "@/lib/id-generator";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, X, LayoutGrid, List } from "lucide-react";

export default function AdminCategoriesPage() {
  const { data: categories, loading } = useFirestore<Category>("categories", {
    constraints: [orderBy("order", "asc")],
    realtime: false, cache: true,
  });

  const { refreshCollection } = useDataCache();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [subCategories, setSubCategories] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [orderNum, setOrderNum] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [detailCat, setDetailCat] = useState<Category | null>(null);

  const openAdd = () => {
    setName(""); setShortCode(""); setSubCategories(""); setDescription(""); setImage("");
    setOrderNum(categories.length);
    setIsActive(true);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setName(cat.name); setShortCode(cat.shortCode || ""); setSubCategories(cat.subCategories?.join(", ") || ""); setDescription(cat.description);
    setImage(cat.image); setOrderNum(cat.order);
    setIsActive(cat.isActive);
    setEditingId(cat.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name || !shortCode) return;
    setSaving(true);
    try {
      const subCats = subCategories.split(",").map((s) => s.trim()).filter(Boolean);
      const data = { name, shortCode: shortCode.toUpperCase(), subCategories: subCats, description, image, order: orderNum, isActive, updatedAt: Timestamp.fromDate(new Date()) };
      if (editingId) {
        await updateDoc(doc(db, "categories", editingId), data);
      } else {
        const catId = await generateId("CAT");
        await setDoc(doc(db, "categories", catId), { ...data, createdAt: Timestamp.fromDate(new Date()) });
      }
      setShowForm(false);
      refreshCollection("categories");
    } catch (e) {
      console.error("Save failed", e);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, n: string) => {
    if (!confirm(`Delete category "${n}"?`)) return;
    try {
      await deleteDoc(doc(db, "categories", id));
      refreshCollection("categories");
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const moveOrder = async (id: string, newOrder: number) => {
    await updateDoc(doc(db, "categories", id), { order: newOrder, updatedAt: Timestamp.fromDate(new Date()) });
    refreshCollection("categories");
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Categories</h1>
            <p className="text-sm text-muted-foreground">{categories.length} total</p>
          </div>
          <Button onClick={openAdd} variant="accent">
            <Plus className="h-4 w-4" /> Add Category
          </Button>
        </div>

        {showForm && (
          <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-secondary">
                {editingId ? "Edit Category" : "New Category"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Short Code *</label>
                <input type="text" value={shortCode} onChange={(e) => setShortCode(e.target.value.toUpperCase().slice(0, 4))} placeholder="e.g., RG"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <p className="text-xs text-muted-foreground mt-1">2-4 characters, used for SKU/Model No generation</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Order</label>
                <input type="number" value={orderNum} onChange={(e) => setOrderNum(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Image URL</label>
                <input type="text" value={image} onChange={(e) => setImage(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-border" />
                  Active
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Sub Categories</label>
                <textarea value={subCategories} onChange={(e) => setSubCategories(e.target.value)} rows={3} placeholder="e.g., Stud Earrings, Hoop Earrings, Jhumka"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated list. These appear in the product Sub Category dropdown.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleSave} disabled={saving || !name || !shortCode} variant="accent">
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline">Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : categories.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No categories yet.</p>
        ) : (
          <>
            <div className="flex items-center gap-1 mb-3">
              <button onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode("list")}
                className={`p-1.5 rounded ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
                <List className="h-4 w-4" />
              </button>
            </div>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categories.map((cat, i) => (
                  <div key={cat.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2 cursor-pointer" onClick={() => setDetailCat(cat)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-secondary text-sm truncate">{cat.name}</p>
                        {cat.shortCode && <span className="text-xs font-mono text-primary mr-2">{cat.shortCode}</span>}
                        {cat.description && <p className="text-xs text-muted-foreground truncate">{cat.description}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${cat.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-muted-foreground"}`}>
                        {cat.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); moveOrder(cat.id, cat.order - 1); }}
                          disabled={i === 0}
                          className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-xs text-muted-foreground">Order {cat.order}</span>
                        <button onClick={(e) => { e.stopPropagation(); moveOrder(cat.id, cat.order + 1); }}
                          disabled={i === categories.length - 1}
                          className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); openEdit(cat); }} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(cat.id, cat.name); }} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="h-3.5 w-3.5" />
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
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Name</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Code</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Order</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Status</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {categories.map((cat, i) => (
                      <tr key={cat.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setDetailCat(cat)}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-secondary">{cat.name}</p>
                          {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs font-medium text-primary">{cat.shortCode}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); moveOrder(cat.id, cat.order - 1); }}
                              disabled={i === 0}
                              className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30">
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <span className="text-xs">{cat.order}</span>
                            <button onClick={(e) => { e.stopPropagation(); moveOrder(cat.id, cat.order + 1); }}
                              disabled={i === categories.length - 1}
                              className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30">
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${cat.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-muted-foreground"}`}>
                            {cat.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={(e) => { e.stopPropagation(); openEdit(cat); }} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(cat.id, cat.name); }} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      {detailCat && (
          <DetailModal title={`Category - ${detailCat.name}`} onClose={() => setDetailCat(null)}>
            <div className="space-y-2 text-sm">
              <Row label="Name" value={detailCat.name} />
              <Row label="Short Code" value={detailCat.shortCode} />
              <Row label="Sub Categories" value={detailCat.subCategories?.length ? detailCat.subCategories.join(", ") : "—"} />
              <Row label="Description" value={detailCat.description || "—"} />
              <Row label="Order" value={String(detailCat.order)} />
              <Row label="Status" value={detailCat.isActive ? "Active" : "Inactive"} />
              <Row label="Image" value={detailCat.image ? <a href={detailCat.image} target="_blank" rel="noopener noreferrer" className="text-primary underline">View</a> : "—"} />
            </div>
          </DetailModal>
        )}
      </div>
    </AdminLayout>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex justify-between items-start py-1 border-b border-border last:border-0">
      <span className="text-muted-foreground text-xs shrink-0 mr-4">{label}</span>
      <span className={`text-right ${bold ? "font-bold text-secondary" : "text-secondary font-medium"}`}>{value}</span>
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
