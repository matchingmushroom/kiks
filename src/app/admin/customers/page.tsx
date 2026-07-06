"use client";

import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { Customer, Sale } from "@/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { generateId } from "@/lib/id-generator";
import {
  setDoc, updateDoc, deleteDoc, doc, collection, Timestamp, onSnapshot, query, where, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Plus, Edit2, Trash2, X, Save, Search, LayoutGrid, List, Eye, MoreVertical, TrendingUp, ShoppingCart } from "lucide-react";

const emptyForm = {
  name: "", phone: "", email: "", address: "", notes: "",
};

export default function AdminCustomersPage() {
  const { data: customers, loading } = useFirestore<Customer>("customers", {
    constraints: [orderBy("name", "asc"), limit(200)],
    realtime: true,
  });
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);

  useEffect(() => { if (openMenuId) { const handler = () => setOpenMenuId(null); window.addEventListener("click", handler); return () => window.removeEventListener("click", handler); } }, [openMenuId]);
  const [detailCustomerData, setDetailCustomerData] = useState<Customer | null>(null);

  useEffect(() => {
    if (!detailCustomerId) { setDetailCustomerData(null); setCustomerSales([]); return; }
    const unsub = onSnapshot(doc(db, "customers", detailCustomerId), (snap) => {
      if (snap.exists()) setDetailCustomerData({ id: snap.id, ...snap.data() } as Customer);
    });
    return () => unsub();
  }, [detailCustomerId]);

  const [customerSales, setCustomerSales] = useState<Sale[]>([]);
  useEffect(() => {
    if (!detailCustomerData?.phone) { setCustomerSales([]); return; }
    (async () => {
      const q = query(collection(db, "sales"), where("customer.phone", "==", detailCustomerData.phone));
      const snap = await getDocs(q);
      const sales = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
      sales.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setCustomerSales(sales.slice(0, 50));
    })();
  }, [detailCustomerData?.phone]);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (c: Customer) => {
    setForm({
      name: c.name, phone: c.phone, email: c.email || "",
      address: c.address || "", notes: c.notes || "",
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const data = {
        name: form.name, phone: form.phone, email: form.email,
        address: form.address, notes: form.notes,
        updatedAt: Timestamp.fromDate(new Date()),
      };
      if (editingId) {
        await updateDoc(doc(db, "customers", editingId), data);
      } else {
        const custId = await generateId("CUST");
        await setDoc(doc(db, "customers", custId), {
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
    if (!confirm(`Delete customer "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "customers", id));
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Customers</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} of {customers.length} total</p>
          </div>
          <Button onClick={openAdd} variant="accent"><Plus className="h-4 w-4" /> Add Customer</Button>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search by name, phone or email..." value={search}
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
              <h2 className="text-lg font-semibold text-secondary">{editingId ? "Edit Customer" : "Add Customer"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  minLength={10}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                <input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Address</label>
                <input type="text" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="md:col-span-2">
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
          <p className="text-muted-foreground text-center py-12">No customers found.</p>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((c) => (
              <div key={c.id} className="bg-white border border-border rounded-xl p-3 shadow-sm space-y-2 cursor-pointer hover:shadow-md transition-shadow">
                <div onClick={() => setDetailCustomerId(c.id)} className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-secondary text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone || "—"}</p>
                  </div>
                  <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id); }} className="p-1 text-muted-foreground hover:bg-muted rounded">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {openMenuId === c.id && (
                      <div className="absolute right-0 top-8 z-20 bg-white border border-border rounded-lg shadow-lg py-1 w-36"
                        onMouseLeave={() => setOpenMenuId(null)}>
                        <button onClick={() => { openEdit(c); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-muted">
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" /> Edit
                        </button>
                        <button onClick={() => { handleDelete(c.id, c.name); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-red-50 text-red-600">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div onClick={() => setDetailCustomerId(c.id)} className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {c.email && <span>{c.email}</span>}
                  {c.address && <span className="truncate">{c.address}</span>}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <button onClick={() => setDetailCustomerId(c.id)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                    <Eye className="h-3 w-3" /> View Details
                  </button>
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
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Email</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Address</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium text-secondary">{c.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.email || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[200px]">{c.address || "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => setDetailCustomerId(c.id)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                        <button onClick={() => openEdit(c)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                          <Edit2 className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button onClick={() => handleDelete(c.id, c.name)}
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

        {detailCustomerData && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setDetailCustomerId(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between">
                <h2 className="text-lg font-bold text-secondary">Customer Details</h2>
                <button onClick={() => setDetailCustomerId(null)} className="p-1 hover:bg-muted rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                    <p className="font-bold text-secondary">{formatCurrency(customerSales.reduce((s, sale) => s + sale.finalAmount, 0))}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Visits</p>
                    <p className="font-bold text-secondary">{customerSales.length}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Loyalty Points</p>
                    <p className="font-bold text-secondary">{detailCustomerData.loyaltyPoints || 0}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Last Visit</p>
                    <p className="font-bold text-secondary text-xs">
                      {customerSales.length > 0 ? formatDate(customerSales[0].createdAt) : "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Basic Info</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> <span className="font-medium ml-1">{detailCustomerData.name}</span></div>
                    <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium ml-1">{detailCustomerData.phone || "—"}</span></div>
                    {detailCustomerData.email && <div><span className="text-muted-foreground">Email:</span> <span className="font-medium ml-1">{detailCustomerData.email}</span></div>}
                    {detailCustomerData.address && <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="font-medium ml-1">{detailCustomerData.address}</span></div>}
                  </div>
                </div>

                {detailCustomerData.notes && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Notes</h3>
                    <p className="text-sm bg-muted/20 p-3 rounded-lg">{detailCustomerData.notes}</p>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-1.5">
                    <ShoppingCart className="h-3.5 w-3.5" /> Purchase History ({customerSales.length})
                  </h3>
                  {customerSales.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No purchases yet.</p>
                  ) : (
                    <div className="overflow-x-auto max-h-64 overflow-y-auto border border-border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                          <tr className="border-b border-border text-left text-xs text-muted-foreground">
                            <th className="px-3 py-2 font-medium">Date</th>
                            <th className="px-3 py-2 font-medium text-right">Items</th>
                            <th className="px-3 py-2 font-medium text-right">Total</th>
                            <th className="px-3 py-2 font-medium text-right">Payment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {customerSales.map((sale) => (
                            <tr key={sale.id} className="hover:bg-muted/30">
                              <td className="px-3 py-2 text-xs">{formatDate(sale.createdAt)}</td>
                              <td className="px-3 py-2 text-xs text-right">{sale.items?.length || 0}</td>
                              <td className="px-3 py-2 text-xs text-right font-medium">{formatCurrency(sale.finalAmount)}</td>
                              <td className="px-3 py-2 text-xs text-right capitalize">{sale.payment?.method || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-4 border-t border-border">
                  <p>Created: {detailCustomerData.createdAt ? formatDate(detailCustomerData.createdAt) : "—"}</p>
                  <p>Updated: {detailCustomerData.updatedAt ? formatDateTime(detailCustomerData.updatedAt) : "—"}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
