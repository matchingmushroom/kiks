"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { Coupon } from "@/types";
import { formatCurrency, formatDate, generateCouponCode, toDate } from "@/lib/utils";
import { generateId } from "@/lib/id-generator";
import { setDoc, updateDoc, deleteDoc, doc, collection, Timestamp, query, where, getDocs, getDoc, orderBy as fsOrderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, X, Save, Copy, CheckCircle, Search, LayoutGrid, List } from "lucide-react";

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
  couponType: "General",
  customCouponType: "",
  restrictedToPhones: "",
  issuedToName: "",
  issuedToPhone: "",
};

export default function AdminCouponsPage() {
  const { data: coupons, loading } = useFirestore<Coupon>("coupons", {
    constraints: [orderBy("createdAt", "desc"), limit(100)],
    realtime: false, cache: true,
  });
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [detailCoupon, setDetailCoupon] = useState<Coupon | null>(null);

  const filtered = coupons.filter((c) =>
    !search || c.code.toLowerCase().includes(search.toLowerCase())
  );

  const presetTypes = ["General", "For Confirmed Buyers", "Tiktok10", "Facebook10"];
  const existingTypes = [...new Set(coupons.map((c) => c.couponType).filter(Boolean))] as string[];
  const allTypes = [...new Set([...presetTypes, ...existingTypes])];

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
      couponType: c.couponType || "General",
      customCouponType: "",
      restrictedToPhones: (c.restrictedToPhones || []).join(", "),
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
        couponType: form.couponType === "Other" ? form.customCouponType : form.couponType,
        restrictedToPhones: form.restrictedToPhones ? form.restrictedToPhones.split(",").map((s) => s.trim()).filter(Boolean) : [],
        issuedToCustomer: { name: form.issuedToName, phone: form.issuedToPhone },
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (editingId) {
        await updateDoc(doc(db, "coupons", editingId), data);
      } else {
        const cupId = await generateId("CUPN");
        await setDoc(doc(db, "coupons", cupId), {
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
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Type of Coupon</label>
                <select value={form.couponType}
                  onChange={(e) => setForm({ ...form, couponType: e.target.value, customCouponType: "" })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {allTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="Other">Other (add new)</option>
                </select>
                {form.couponType === "Other" && (
                  <input type="text" value={form.customCouponType} placeholder="Enter new coupon type..."
                    onChange={(e) => setForm({ ...form, customCouponType: e.target.value })}
                    className="w-full mt-2 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                )}
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
                  minLength={10}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Restrict to Phones (comma-separated)</label>
                <textarea value={form.restrictedToPhones}
                  onChange={(e) => setForm({ ...form, restrictedToPhones: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded border-border" /> Active
                </label>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((c) => {
                  const now = Date.now();
                  const validUntilMs = c.validUntil ? toDate(c.validUntil).getTime() : 0;
                  const expired = validUntilMs > 0 && now > validUntilMs;
                  return (
                    <div key={c.id} onClick={() => setDetailCoupon(c)} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2 cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="font-mono font-medium text-secondary text-sm truncate">{c.code}</span>
                          <button onClick={(e) => { e.stopPropagation(); copyCode(c.code); }} className="p-1 text-muted-foreground hover:text-primary rounded" title="Copy">
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                          expired ? "bg-red-50 text-red-700" :
                          !c.isActive ? "bg-gray-100 text-muted-foreground" :
                          "bg-green-50 text-green-700"
                        }`}>
                          {expired ? "Expired" : !c.isActive ? "Inactive" : "Active"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        <span className="font-semibold text-secondary">
                          {c.discountType === "percentage" ? `${c.discountValue}%` : formatCurrency(c.discountValue)}
                        </span>
                        {c.couponType ? (
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{c.couponType}</span>
                        ) : (
                          <span className="text-muted-foreground">General</span>
                        )}
                        <span className="text-muted-foreground">Used: {c.usedCount || 0}/{c.usageLimit || "∞"}</span>
                        {c.minPurchaseAmount > 0 && <span className="text-muted-foreground">Min: {formatCurrency(c.minPurchaseAmount)}</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {c.validFrom && <span>From: {formatDate(c.validFrom)}</span>}
                        {c.validUntil && <span>To: {formatDate(c.validUntil)}</span>}
                      </div>
                      {c.issuedToCustomer?.name && (
                        <div className="text-xs text-muted-foreground">
                          Issued to: <span className="font-medium text-secondary">{c.issuedToCustomer.name}</span>
                          {c.issuedToCustomer.phone ? ` (${c.issuedToCustomer.phone})` : ""}
                        </div>
                      )}
                      <div className="text-xs">
                        {c.restrictedToPhones?.length ? (
                          <span className="font-medium">{c.restrictedToPhones.join(", ")}</span>
                        ) : (
                          <span className="text-muted-foreground">Anyone</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 pt-1">
                        <button onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); toggleActive(c.id, c.isActive); }}
                          className="p-1.5 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded"
                          title={c.isActive ? "Deactivate" : "Activate"}>
                          <CheckCircle className={`h-3.5 w-3.5 ${c.isActive ? "" : "opacity-40"}`} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id, c.code); }}
                          className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Code</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Discount</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Type</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Issued To</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Usage</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Status</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((c) => {
                      const now = Date.now();
                      const validUntilMs = c.validUntil ? toDate(c.validUntil).getTime() : 0;
                      const expired = validUntilMs > 0 && now > validUntilMs;
                      return (
                        <tr key={c.id} onClick={() => setDetailCoupon(c)} className="hover:bg-muted/30 cursor-pointer">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-medium text-secondary">{c.code}</span>
                              <button onClick={(e) => { e.stopPropagation(); copyCode(c.code); }} className="p-1 text-muted-foreground hover:text-primary rounded" title="Copy">
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-semibold">
                              {c.discountType === "percentage" ? `${c.discountValue}%` : formatCurrency(c.discountValue)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {c.couponType ? (
                              <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs">{c.couponType}</span>
                            ) : <span className="text-xs text-muted-foreground">General</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {c.issuedToCustomer?.name ? `${c.issuedToCustomer.name}${c.issuedToCustomer.phone ? ` (${c.issuedToCustomer.phone})` : ""}` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.usedCount || 0}/{c.usageLimit || "∞"}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              expired ? "bg-red-50 text-red-700" :
                              !c.isActive ? "bg-gray-100 text-muted-foreground" :
                              "bg-green-50 text-green-700"
                            }`}>
                              {expired ? "Expired" : !c.isActive ? "Inactive" : "Active"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); toggleActive(c.id, c.isActive); }}
                              className="p-1.5 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded"
                              title={c.isActive ? "Deactivate" : "Activate"}>
                              <CheckCircle className={`h-3.5 w-3.5 ${c.isActive ? "" : "opacity-40"}`} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id, c.code); }} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {detailCoupon && (
          <DetailModal title="Coupon Details" onClose={() => setDetailCoupon(null)}>
            <div className="space-y-3 text-sm">
              <Row label="Code" value={detailCoupon.code} />
              <Row label="Discount" value={detailCoupon.discountType === "percentage" ? `${detailCoupon.discountValue}%` : `Rs. ${detailCoupon.discountValue}`} />
              <Row label="Discount Type" value={detailCoupon.discountType} />
              <Row label="Coupon Type" value={detailCoupon.couponType || "General"} />
              <Row label="Issued To" value={detailCoupon.issuedToCustomer?.name ? `${detailCoupon.issuedToCustomer.name}${detailCoupon.issuedToCustomer.phone ? ` (${detailCoupon.issuedToCustomer.phone})` : ""}` : "—"} />
              <Row label="Used Count" value={`${detailCoupon.usedCount || 0} / ${detailCoupon.usageLimit || "∞"}`} />
              <Row label="Min Purchase" value={detailCoupon.minPurchaseAmount ? `Rs. ${detailCoupon.minPurchaseAmount}` : "—"} />
              <Row label="Max Discount" value={detailCoupon.maxDiscount ? `Rs. ${detailCoupon.maxDiscount}` : "—"} />
              <Row label="Valid From" value={detailCoupon.validFrom ? formatDate(detailCoupon.validFrom) : "—"} />
              <Row label="Valid Until" value={detailCoupon.validUntil ? formatDate(detailCoupon.validUntil) : "—"} />
              <Row label="Status" value={detailCoupon.isActive ? "Active" : "Inactive"} />
              <Row label="Created" value={formatDate(detailCoupon.createdAt)} />
              {detailCoupon.restrictedToPhones?.length ? <Row label="Restricted To" value={detailCoupon.restrictedToPhones.join(", ")} /> : null}
            </div>
          </DetailModal>
        )}
      </div>
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
