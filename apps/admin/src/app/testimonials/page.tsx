"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { Testimonial } from "@/types";
import { formatDate } from "@/lib/utils";
import { generateId } from "@/lib/id-generator";
import { useAuth } from "@/contexts/AuthContext";
import { setDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, X, Save, Trash2, Edit2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

const emptyForm = {
  customerName: "",
  rating: 5,
  text: "",
  productName: "",
  isActive: true,
  order: 0,
};

export default function AdminTestimonialsPage() {
  const { user } = useAuth();
  const { data: testimonials, loading } = useFirestore<Testimonial>("testimonials", {
    constraints: [orderBy("order", "asc")],
    realtime: true,
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (t: Testimonial) => {
    setForm({
      customerName: t.customerName,
      rating: t.rating,
      text: t.text,
      productName: t.productName || "",
      isActive: t.isActive,
      order: t.order ?? 0,
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.customerName.trim() || !form.text.trim()) return;
    setSaving(true);
    try {
      const id = editingId || await generateId("TEST");
      const data: Record<string, any> = {
        ...form,
        customerName: form.customerName.trim(),
        text: form.text.trim(),
        productName: form.productName.trim() || "",
        updatedAt: Date.now(),
      };
      if (!editingId) data.createdAt = Date.now();
      await setDoc(doc(db, "testimonials", id), data, { merge: true });
      resetForm();
    } catch (e) {
      console.error("Failed to save testimonial", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this testimonial?")) return;
    try {
      await deleteDoc(doc(db, "testimonials", id));
    } catch (e) {
      console.error("Failed to delete testimonial", e);
    }
  };

  const handleToggleActive = async (t: Testimonial) => {
    try {
      await updateDoc(doc(db, "testimonials", t.id), { isActive: !t.isActive });
    } catch (e) {
      console.error("Failed to toggle testimonial", e);
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-secondary">Testimonials</h1>
            <p className="text-sm text-muted-foreground">Manage customer reviews</p>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Testimonial
          </Button>
        </div>

        {showForm && (
          <div className="bg-muted/30 border border-border rounded-xl p-5 mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-secondary">{editingId ? "Edit Testimonial" : "New Testimonial"}</h2>
              <button onClick={resetForm} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Customer Name *</label>
                <input type="text" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Product Name</label>
                <input type="text" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Review Text *</label>
              <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button key={r} type="button" onClick={() => setForm({ ...form, rating: r })}
                      className={`p-1 rounded transition-colors ${r <= form.rating ? "text-amber-400" : "text-gray-200"}`}>
                      <Star className={`h-5 w-5 ${r <= form.rating ? "fill-amber-400" : ""}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Order</label>
                <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded border-border" />
                  <span className="text-sm text-muted-foreground">Active</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.customerName.trim() || !form.text.trim()}>
                <Save className="h-4 w-4 mr-1.5" /> {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
        ) : testimonials.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquareIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No testimonials yet. Add your first one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {testimonials.map((t) => (
              <div key={t.id} className="bg-white border border-border rounded-xl p-4 sm:p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                  {t.customerName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-secondary">{t.customerName}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, j) => (
                        <Star key={j} className={`h-3.5 w-3.5 ${j < t.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />
                      ))}
                    </div>
                    {t.productName && <span className="text-xs text-muted-foreground">— {t.productName}</span>}
                  </div>
                  <p className="text-sm text-secondary mt-1.5 leading-relaxed">&ldquo;{t.text}&rdquo;</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Order: {t.order ?? 0}</span>
                    <button onClick={() => handleToggleActive(t)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                      {t.isActive ? "Active" : "Inactive"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleEdit(t)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary" title="Edit">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-muted-foreground hover:text-red-600" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
    </svg>
  );
}
