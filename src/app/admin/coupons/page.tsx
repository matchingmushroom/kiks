"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { Coupon } from "@/types";
import { formatCurrency, formatDate, generateCouponCode, toDate } from "@/lib/utils";
import {
  addDoc, updateDoc, deleteDoc, doc, collection, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, X, Save, Copy, CheckCircle, Search } from "lucide-react";

const emptyForm = {
  code: "",
  discountType: "percentage" as "percentage" | "fixed",
  discountValue: 10,
  minPurchaseAmount: 0,
  maxDiscount: 5000,
  validFrom: "",
  validUntil: "",
  usageLimit: 100,
  isActive: true,
  issuedToName: "",
  issuedToPhone: "",
};

export default function AdminCouponsPage() {
  const { data: coupons, loading } = useFirestore<Coupon>("coupons", {
    constraints: [orderBy("createdAt", "desc")],
  });
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const filtered = coupons.filter((c) =>
    !search || c.code.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setForm({ ...emptyForm, code: generateCouponCode() });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (c: Coupon) => {
    setForm({
      code: c.code,
      discountType: c.discountType,
      discountValue: c.discountValue,
      minPurchaseAmount: c.minPurchaseAmount,
      maxDiscount: c.maxDiscount,
      validFrom: c.validFrom ? toDate(c.validFrom).toISOString().slice(0, 16) : "",
      validUntil: c.validUntil ? toDate(c.validUntil).toISOString().slice(0, 16) : "",
      usageLimit: c.usageLimit,
      isActive: c.isActive,
      issuedToName: c.issuedToCustomer?.name || "",
      issuedToPhone: c.issuedToCustomer?.phone || "",
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.discountValue) return;
    setSaving(true);
    try {
      const data = {
        code: form.code.toUpperCase(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minPurchaseAmount: Number(form.minPurchaseAmount),
        maxDiscount: Number(form.maxDiscount),
        validFrom: form.validFrom ? Timestamp.fromDate(new Date(form.validFrom)) : null,
        validUntil: form.validUntil ? Timestamp.fromDate(new Date(form.validUntil)) : null,
        usageLimit: Number(form.usageLimit),
        usedCount: 0,
        isActive: form.isActive,
        issuedToCustomer: { name: form.issuedToName, phone: form.issuedToPhone },
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (editingId) {
        await updateDoc(doc(db, "coupons", editingId), data);
      } else {
        await addDoc(collection(db, "coupons"), {
          ...data,
          usedCount: 0,
          issuedForOrderId: "",
          createdAt: Timestamp.fromDate(new Date()),
        });
      }
      setShowForm(false);
    } catch (e) {
      console.error("Save failed", e);
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "coupons", id), { isActive: !current, updatedAt: Timestamp.fromDate(new Date()) });
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete coupon "${code}"?`)) return;
    await deleteDoc(doc(db, "coupons", id));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Coupons</h1>
            <p className="text-sm text-muted-foreground">{coupons.length} total</p>
          </div>
          <Button onClick={openAdd} variant="accent"><Plus className="h-4 w-4" /> New Coupon</Button>
        </div>

        <div className="relative max-w-xs mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search by code..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        {showForm && (
          <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-secondary">{editingId ? "Edit Coupon" : "New Coupon"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Coupon Code</label>
                <div className="flex gap-2">
                  <input type="text" value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary" />
                  <button onClick={() => setForm({ ...form, code: generateCouponCode() })}
                    className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">Generate</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Discount Type</label>
                <select value={form.discountType}
                  onChange={(e) => setForm({ ...form, discountType: e.target.value as "percentage" | "fixed" })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (NPR)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Discount Value</label>
                <input type="number" value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Min Purchase (NPR)</label>
                <input type="number" value={form.minPurchaseAmount}
                  onChange={(e) => setForm({ ...form, minPurchaseAmount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Max Discount (NPR)</label>
                <input type="number" value={form.maxDiscount}
                  onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Usage Limit</label>
                <input type="number" value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Valid From</label>
                <input type="datetime-local" value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Valid Until</label>
                <input type="datetime-local" value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded border-border" /> Active
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Issued To (Name)</label>
                <input type="text" value={form.issuedToName}
                  onChange={(e) => setForm({ ...form, issuedToName: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Issued To (Phone)</label>
                <input type="text" value={form.issuedToPhone}
                  onChange={(e) => setForm({ ...form, issuedToPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleSave} disabled={saving || !form.code} variant="accent">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline">Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No coupons found.</p>
        ) : (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">Code</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Discount</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Min Purchase</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Used / Limit</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Valid</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((c) => {
                    const now = Date.now();
                    const expired = c.validUntil && now > c.validUntil;
                    return (
                      <tr key={c.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-secondary">{c.code}</span>
                            <button onClick={() => copyCode(c.code)} className="p-1 text-muted-foreground hover:text-primary rounded" title="Copy">
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {c.discountType === "percentage" ? `${c.discountValue}%` : formatCurrency(c.discountValue)}
                          {c.discountType === "percentage" && c.maxDiscount > 0 && (
                            <span className="text-xs text-muted-foreground"> (max {formatCurrency(c.maxDiscount)})</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.minPurchaseAmount > 0 ? formatCurrency(c.minPurchaseAmount) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {c.usedCount || 0} / {c.usageLimit || "∞"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {c.validFrom && <p>From: {formatDate(c.validFrom)}</p>}
                          {c.validUntil && <p>To: {formatDate(c.validUntil)}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            expired ? "bg-red-50 text-red-700" :
                            !c.isActive ? "bg-gray-100 text-muted-foreground" :
                            "bg-green-50 text-green-700"
                          }`}>
                            {expired ? "Expired" : !c.isActive ? "Inactive" : "Active"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(c)}
                              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => toggleActive(c.id, c.isActive)}
                              className="p-1.5 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded"
                              title={c.isActive ? "Deactivate" : "Activate"}>
                              <CheckCircle className={`h-3.5 w-3.5 ${c.isActive ? "" : "opacity-40"}`} />
                            </button>
                            <button onClick={() => handleDelete(c.id, c.code)}
                              className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded">
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
