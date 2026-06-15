"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { Category } from "@/types";
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
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, X } from "lucide-react";

export default function AdminCategoriesPage() {
  const { data: categories, loading } = useFirestore<Category>("categories", {
    constraints: [orderBy("order", "asc")],
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [orderNum, setOrderNum] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setName(""); setDescription(""); setImage("");
    setOrderNum(categories.length);
    setIsActive(true);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setName(cat.name); setDescription(cat.description);
    setImage(cat.image); setOrderNum(cat.order);
    setIsActive(cat.isActive);
    setEditingId(cat.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    try {
      const data = { name, description, image, order: orderNum, isActive, updatedAt: Timestamp.fromDate(new Date()) };
      if (editingId) {
        await updateDoc(doc(db, "categories", editingId), data);
      } else {
        await addDoc(collection(db, "categories"), { ...data, createdAt: Timestamp.fromDate(new Date()) });
      }
      setShowForm(false);
    } catch (e) {
      console.error("Save failed", e);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, n: string) => {
    if (!confirm(`Delete category "${n}"?`)) return;
    try {
      await deleteDoc(doc(db, "categories", id));
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const moveOrder = async (id: string, newOrder: number) => {
    await updateDoc(doc(db, "categories", id), { order: newOrder, updatedAt: Timestamp.fromDate(new Date()) });
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
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleSave} disabled={saving || !name} variant="accent">
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
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground w-20">Order</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Description</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((cat, i) => (
                  <tr key={cat.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground w-4 text-center">{cat.order}</span>
                        <div className="flex flex-col">
                          <button onClick={() => moveOrder(cat.id, cat.order - 1)}
                            disabled={i === 0}
                            className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30">
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button onClick={() => moveOrder(cat.id, cat.order + 1)}
                            disabled={i === categories.length - 1}
                            className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30">
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-secondary">{cat.name}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[300px] truncate">{cat.description}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cat.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-muted-foreground"}`}>
                        {cat.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(cat)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(cat.id, cat.name)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
