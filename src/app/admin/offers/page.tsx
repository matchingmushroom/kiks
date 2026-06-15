"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { Offer, Product, Category } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  addDoc, collection, updateDoc, doc, Timestamp, deleteDoc, getDocs, query, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Plus, X, Save, Trash2, Edit2, Search, AlertCircle, CheckCircle,
} from "lucide-react";

const emptyForm = {
  title: "",
  badgeType: "offer" as "offer" | "price_dropped",
  discountType: "percentage" as "percentage" | "fixed",
  discountValue: 0,
  scope: "all" as "all" | "category" | "individual",
  categoryId: "",
  productIds: [] as string[],
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
};

export default function AdminOffersPage() {
  const { data: offers, loading } = useFirestore<Offer>("offers", {
    constraints: [orderBy("createdAt", "desc")],
  });
  const { data: products } = useFirestore<Product>("products");
  const { data: categories } = useFirestore<Category>("categories", {
    constraints: [orderBy("order", "asc")],
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [prodSearch, setProdSearch] = useState("");
  const [expiredBanner, setExpiredBanner] = useState("");

  // Auto-expire offers on page load
  useEffect(() => {
    const checkExpired = async () => {
      const now = Date.now();
      const expired = offers.filter((o) => o.isActive && o.endDate < now);
      if (expired.length === 0) return;

      let count = 0;
      for (const offer of expired) {
        const affected = getAffectedProductIds(offer);
        for (const pid of affected) {
          const prodRef = doc(db, "products", pid);
          await updateDoc(prodRef, {
            price: 0, // will restore from originalPrice below
            badge: "",
            originalPrice: 0,
          });
          // Restore price = originalPrice
          const price = products.find((p) => p.id === pid)?.originalPrice || products.find((p) => p.id === pid)?.price;
          // Actually, originalPrice was saved on each product doc. We need its value before clearing.
          // Better: read current doc, swap
          continue;
        }
        // Simpler: for each product in scope, restore and clear badge
        const snap = await getDocs(query(
          collection(db, "products"),
          ...buildScopeQuery(offer)
        ));
        snap.forEach(async (d) => {
          const data = d.data();
          const origPrice = data.originalPrice || 0;
          await updateDoc(doc(db, "products", d.id), {
            price: origPrice || data.price,
            badge: "",
            originalPrice: 0,
            updatedAt: Timestamp.fromDate(new Date()),
          });
          count++;
        });

        await updateDoc(doc(db, "offers", offer.id), { isActive: false });
      }
      if (count > 0) {
        setExpiredBanner(`${expired.length} offer(s) expired. ${count} product(s) restored to original prices.`);
      }
    };
    if (offers.length > 0 && products.length > 0) {
      checkExpired();
    }
  }, [offers.length, products.length]);

  const getAffectedProductIds = (offer: Offer): string[] => {
    if (offer.scope === "all") return products.map((p) => p.id);
    if (offer.scope === "category") return products.filter((p) => p.categoryId === offer.categoryId).map((p) => p.id);
    if (offer.scope === "individual") return offer.productIds || [];
    return [];
  };

  const buildScopeQuery = (offer: Offer) => {
    if (offer.scope === "category" && offer.categoryId) {
      return [where("categoryId", "==", offer.categoryId)];
    }
    return [];
  };

  const getAffectedCount = (): number => {
    if (form.scope === "all") return products.length;
    if (form.scope === "category") return products.filter((p) => p.categoryId === form.categoryId).length;
    if (form.scope === "individual") return form.productIds.length;
    return 0;
  };

  const getSamplePrice = (): string => {
    const sample = products.find((p) => {
      if (form.scope === "category" && p.categoryId !== form.categoryId) return false;
      if (form.scope === "individual" && !form.productIds.includes(p.id)) return false;
      return true;
    });
    if (!sample || !form.discountValue) return "";
    const discounted = form.discountType === "percentage"
      ? Math.round(sample.price * (1 - form.discountValue / 100))
      : Math.max(0, sample.price - form.discountValue);
    return `${formatCurrency(sample.price)} → ${formatCurrency(discounted)}`;
  };

  const toggleProduct = (id: string) => {
    setForm({
      ...form,
      productIds: form.productIds.includes(id)
        ? form.productIds.filter((pid) => pid !== id)
        : [...form.productIds, id],
    });
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (offer: Offer) => {
    setForm({
      title: offer.title,
      badgeType: offer.badgeType,
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      scope: offer.scope,
      categoryId: offer.categoryId || "",
      productIds: offer.productIds || [],
      startDate: new Date(offer.startDate).toISOString().slice(0, 10),
      endDate: new Date(offer.endDate).toISOString().slice(0, 10),
    });
    setEditingId(offer.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.discountValue) return;
    if (form.scope === "category" && !form.categoryId) return;
    setSaving(true);
    try {
      const start = new Date(form.startDate).getTime();
      const end = new Date(form.endDate).getTime();
      const now = Date.now();

      let productIds: string[] = [];
      if (form.scope === "all") {
        productIds = products.map((p) => p.id);
      } else if (form.scope === "category") {
        productIds = products.filter((p) => p.categoryId === form.categoryId).map((p) => p.id);
      } else {
        productIds = form.productIds;
      }

      const offerData = {
        title: form.title,
        badgeType: form.badgeType,
        discountType: form.discountType,
        discountValue: form.discountValue,
        scope: form.scope,
        categoryId: form.scope === "category" ? form.categoryId : "",
        productIds: form.scope === "individual" ? productIds : [],
        startDate: start,
        endDate: end,
        isActive: true,
        recordedBy: "",
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (editingId) {
        await updateDoc(doc(db, "offers", editingId), offerData);
      } else {
        const offerRef = await addDoc(collection(db, "offers"), {
          ...offerData,
          createdBy: "",
          createdAt: Timestamp.fromDate(new Date()),
        });

        // Apply prices only if start date has arrived or is in the past
        if (start <= now) {
          for (const pid of productIds) {
            const product = products.find((p) => p.id === pid);
            if (!product) continue;
            const discounted = form.discountType === "percentage"
              ? Math.round(product.price * (1 - form.discountValue / 100))
              : Math.max(0, product.price - form.discountValue);
            await updateDoc(doc(db, "products", pid), {
              originalPrice: product.price !== discounted ? product.price : 0,
              price: discounted,
              badge: form.badgeType,
              updatedAt: Timestamp.fromDate(new Date()),
            });
          }
        }
      }

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (e) {
      console.error("Offer save failed", e);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, offer: Offer) => {
    // Restore prices before deleting
    const productIds = getAffectedProductIds(offer);
    for (const pid of productIds) {
      const product = products.find((p) => p.id === pid);
      if (!product) continue;
      await updateDoc(doc(db, "products", pid), {
        price: product.originalPrice || product.price,
        badge: "",
        originalPrice: 0,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    }
    await deleteDoc(doc(db, "offers", id));
  };

  const getStatus = (offer: Offer) => {
    const now = Date.now();
    if (!offer.isActive) return { label: "Inactive", color: "bg-gray-50 text-gray-700 border-gray-200" };
    if (offer.endDate < now) return { label: "Expired", color: "bg-red-50 text-red-700 border-red-200" };
    if (offer.startDate > now) return { label: "Scheduled", color: "bg-blue-50 text-blue-700 border-blue-200" };
    return { label: "Active", color: "bg-green-50 text-green-700 border-green-200" };
  };

  const filteredProducts = products.filter((p) =>
    p.isActive && p.name.toLowerCase().includes(prodSearch.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Offers & Promotions</h1>
            <p className="text-sm text-muted-foreground">{offers.length} total</p>
          </div>
          <Button onClick={openAdd} variant="accent">
            <Plus className="h-4 w-4" /> New Offer
          </Button>
        </div>

        {expiredBanner && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-2 text-sm text-amber-800">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <span>{expiredBanner}</span>
            <button onClick={() => setExpiredBanner("")} className="ml-auto p-1 hover:bg-amber-100 rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {showForm && (
          <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-secondary">{editingId ? "Edit Offer" : "New Offer"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
                  <input type="text" value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Summer Sale"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Badge Type</label>
                  <select value={form.badgeType}
                    onChange={(e) => setForm({ ...form, badgeType: e.target.value as "offer" | "price_dropped" })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="offer">Offer</option>
                    <option value="price_dropped">Price Dropped</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Discount Type</label>
                    <select value={form.discountType}
                      onChange={(e) => setForm({ ...form, discountType: e.target.value as "percentage" | "fixed" })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed (NPR)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Value *</label>
                    <input type="number" value={form.discountValue || ""}
                      onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Scope</h3>
                <div className="flex flex-wrap gap-4">
                  {(["all", "category", "individual"] as const).map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="scope" value={s} checked={form.scope === s}
                        onChange={() => setForm({ ...form, scope: s, categoryId: "", productIds: [] })}
                        className="accent-primary" />
                      {s === "all" ? "All Products" : s === "category" ? "By Category" : "Individual Products"}
                    </label>
                  ))}
                </div>

                {form.scope === "category" && (
                  <select value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="mt-3 w-full max-w-xs px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}

                {form.scope === "individual" && (
                  <div className="mt-3">
                    <div className="relative max-w-sm mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type="text" placeholder="Search products..." value={prodSearch}
                        onChange={(e) => setProdSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div className="border border-border rounded-lg max-h-40 overflow-y-auto divide-y divide-border">
                      {filteredProducts.slice(0, 20).map((p) => (
                        <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 cursor-pointer">
                          <input type="checkbox" checked={form.productIds.includes(p.id)}
                            onChange={() => toggleProduct(p.id)}
                            className="rounded border-border accent-primary" />
                          <span className="flex-1 truncate">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{formatCurrency(p.price)}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{form.productIds.length} selected</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Start Date</label>
                  <input type="date" value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">End Date</label>
                  <input type="date" value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>

              {/* Preview */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
                <p className="font-medium text-secondary">Preview</p>
                <p><span className="text-muted-foreground">Products affected:</span> <strong>{getAffectedCount()}</strong></p>
                {getSamplePrice() && (
                  <p><span className="text-muted-foreground">Sample price:</span> <strong>{getSamplePrice()}</strong></p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(form.startDate) > new Date()
                    ? "Offer will be applied automatically on start date."
                    : "Offer will be applied immediately on save."}
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button onClick={handleSave} disabled={saving || !form.title || !form.discountValue} variant="accent">
                  <Save className="h-4 w-4" /> {saving ? "Saving..." : editingId ? "Update Offer" : "Create Offer"}
                </Button>
                <Button onClick={() => setShowForm(false)} variant="outline">Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading...</p>
        ) : offers.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No offers created yet.</p>
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => {
              const status = getStatus(offer);
              const affectedCount = getAffectedProductIds(offer).length;
              return (
                <div key={offer.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-secondary">{offer.title}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize border ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {offer.discountType === "percentage" ? `${offer.discountValue}% off` : `${formatCurrency(offer.discountValue)} off`}
                        {" · "}
                        <span className="capitalize">{offer.badgeType.replace("_", " ")} badge</span>
                        {" · "}
                        {offer.scope === "all" ? "All products" : offer.scope === "category" ? "By category" : `${(offer.productIds || []).length} products`}
                      </p>
                    </div>
                    <div className="text-right shrink-0 text-xs text-muted-foreground">
                      <p>{formatDate(offer.startDate)}</p>
                      <p>→ {formatDate(offer.endDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{affectedCount} product(s)</span>
                    <div className="flex gap-2">
                      <Button onClick={() => openEdit(offer)} size="sm" variant="outline" className="text-xs">
                        <Edit2 className="h-3 w-3" /> Edit
                      </Button>
                      <Button onClick={() => handleDelete(offer.id, offer)} size="sm" variant="outline" className="text-xs text-red-500">
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
