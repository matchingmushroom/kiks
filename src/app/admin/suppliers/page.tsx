"use client";

import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { Supplier } from "@/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { generateId } from "@/lib/id-generator";
import {
  setDoc, updateDoc, deleteDoc, doc, collection, Timestamp, onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Plus, Edit2, Trash2, X, Save, Search, LayoutGrid, List, Eye } from "lucide-react";

const emptyForm = {
  name: "", phone: "", address: "", contactPerson: "",
  contactPersonPhone: "", website: "", notes: "",
};

export default function AdminSuppliersPage() {
  const { data: suppliers, loading } = useFirestore<Supplier>("suppliers", {
    constraints: [orderBy("name", "asc"), limit(100)],
    realtime: false, cache: true,
  });
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [detailSupplierId, setDetailSupplierId] = useState<string | null>(null);
  const [detailSupplierData, setDetailSupplierData] = useState<Supplier | null>(null);

  useEffect(() => {
    if (!detailSupplierId) { setDetailSupplierData(null); return; }
    const unsub = onSnapshot(doc(db, "suppliers", detailSupplierId), (snap) => {
      if (snap.exists()) setDetailSupplierData({ id: snap.id, ...snap.data() } as Supplier);
    });
    return () => unsub();
  }, [detailSupplierId]);

  const filtered = useMemo(() => {
    if (!search) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      s.contactPerson?.toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (s: Supplier) => {
    setForm({
      name: s.name, phone: s.phone, address: s.address || "",
      contactPerson: s.contactPerson || "", contactPersonPhone: s.contactPersonPhone || "",
      website: s.website || "", notes: s.notes || "",
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const data = {
        name: form.name, phone: form.phone, address: form.address,
        contactPerson: form.contactPerson, contactPersonPhone: form.contactPersonPhone,
        website: form.website, notes: form.notes,
        updatedAt: Timestamp.fromDate(new Date()),
      };
      if (editingId) {
        await updateDoc(doc(db, "suppliers", editingId), data);
      } else {
        const supId = await generateId("SUPP");
        await setDoc(doc(db, "suppliers", supId), {
          ...data, createdAt: Timestamp.fromDate(new Date()),
        });
      }
      setShowForm(false);
    } catch (e) {
      console.error("Save failed", e);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete supplier "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "suppliers", id));
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Suppliers</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} of {suppliers.length} total</p>
          </div>
          <Button onClick={openAdd} variant="accent"><Plus className="h-4 w-4" /> Add Supplier</Button>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search by name, phone or contact..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
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

        {showForm && (
          <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-secondary">{editingId ? "Edit Supplier" : "Add Supplier"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
                <input type="text" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  minLength={6}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Website</label>
                <input type="text" value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Contact Person</label>
                <input type="text" value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Contact Person Phone</label>
                <input type="text" value={form.contactPersonPhone}
                  onChange={(e) => setForm({ ...form, contactPersonPhone: e.target.value })}
                  minLength={10}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Address</label>
                <input type="text" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <textarea value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleSave} disabled={saving || !form.name} variant="accent">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline">Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No suppliers found.</p>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2">
                <button onClick={() => setDetailSupplierId(s.id)} className="block space-y-2 w-full text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-secondary text-sm truncate">{s.name}</p>
                      {s.phone && <p className="text-xs text-muted-foreground">{s.phone}</p>}
                    </div>
                  </div>
                  {s.contactPerson && (
                    <p className="text-xs text-muted-foreground">Contact: {s.contactPerson}{s.contactPersonPhone ? ` (${s.contactPersonPhone})` : ""}</p>
                  )}
                  {s.address && <p className="text-xs text-muted-foreground truncate">{s.address}</p>}
                  {s.website && <p className="text-xs text-blue-600 truncate">{s.website}</p>}
                </button>
                <div className="flex items-center justify-between pt-1">
                  <button onClick={() => setDetailSupplierId(s.id)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                    <Eye className="h-3 w-3" /> View Details
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(s)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => handleDelete(s.id, s.name)}
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
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Name</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Phone</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Contact Person</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Address</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium text-secondary">{s.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{s.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{s.contactPerson || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[200px]">{s.address || "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => setDetailSupplierId(s.id)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                        <button onClick={() => openEdit(s)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                          <Edit2 className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button onClick={() => handleDelete(s.id, s.name)}
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

        {detailSupplierData && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setDetailSupplierId(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between">
                <h2 className="text-lg font-bold text-secondary">Supplier Details</h2>
                <button onClick={() => setDetailSupplierId(null)} className="p-1 hover:bg-muted rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Basic Info</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> <span className="font-medium ml-1">{detailSupplierData.name}</span></div>
                    <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium ml-1">{detailSupplierData.phone || "—"}</span></div>
                    {detailSupplierData.address && <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="font-medium ml-1">{detailSupplierData.address}</span></div>}
                    {detailSupplierData.website && <div><span className="text-muted-foreground">Website:</span> <span className="font-medium ml-1">{detailSupplierData.website}</span></div>}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Contact Person</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> <span className="font-medium ml-1">{detailSupplierData.contactPerson || "—"}</span></div>
                    <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium ml-1">{detailSupplierData.contactPersonPhone || "—"}</span></div>
                  </div>
                </div>

                {detailSupplierData.notes && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Notes</h3>
                    <p className="text-sm bg-muted/20 p-3 rounded-lg">{detailSupplierData.notes}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-4 border-t border-border">
                  <p>Created: {detailSupplierData.createdAt ? formatDate(detailSupplierData.createdAt) : "—"}</p>
                  <p>Updated: {detailSupplierData.updatedAt ? formatDateTime(detailSupplierData.updatedAt) : "—"}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
