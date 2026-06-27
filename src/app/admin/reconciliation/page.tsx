"use client";

import { useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { Product, Category } from "@/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { addDoc, collection, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Search, Save, ClipboardList, CheckCircle, X, RefreshCw } from "lucide-react";

export default function ReconciliationPage() {
  const { data: products, loading } = useFirestore<Product>("products", {
    constraints: [orderBy("name", "asc"), limit(200)],
    realtime: false, cache: true,
  });
  const { data: categories } = useFirestore<Category>("categories", { constraints: [limit(50)], realtime: false, cache: true });
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [physicalQtys, setPhysicalQtys] = useState<Record<string, number>>({});
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [results, setResults] = useState<{ product: string; before: number; after: number; diff: number }[]>([]);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const activeProducts = useMemo(
    () => products.filter((p) => p.isActive),
    [products]
  );

  const filtered = useMemo(() => {
    let result = activeProducts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
    }
    if (catFilter) {
      result = result.filter((p) => p.categoryId === catFilter);
    }
    return result;
  }, [activeProducts, search, catFilter]);

  const variance = (productId: string) => {
    const system = activeProducts.find((p) => p.id === productId)?.quantityInStock || 0;
    const physical = physicalQtys[productId] ?? system;
    return physical - system;
  };

  const handleReconcile = async () => {
    setSaving(true);
    setSaved(false);
    const batch: { product: string; before: number; after: number; diff: number }[] = [];
    try {
      for (const p of activeProducts) {
        const system = p.quantityInStock;
        const physical = physicalQtys[p.id] ?? system;
        const diff = physical - system;
        if (diff === 0) continue;

        await updateDoc(doc(db, "products", p.id), {
          quantityInStock: physical,
          updatedAt: Timestamp.fromDate(new Date()),
        });

        await addDoc(collection(db, "inventoryLogs"), {
          productId: p.id,
          changeType: "adjust",
          quantityChange: diff,
          reason: `Reconciliation: system ${system} → physical ${physical}`,
          performedBy: user?.uid || "",
          createdAt: Timestamp.fromDate(new Date()),
        });

        const costPrice = p.costPrice || 0;
        if (costPrice > 0 && diff !== 0) {
          const value = Math.abs(diff) * costPrice;
          await addDoc(collection(db, "accountTransactions"), {
            accountId: "cash_in_hand",
            type: diff < 0 ? "debit" : "credit",
            amount: value,
            description: `Reconciliation ${diff < 0 ? "loss" : "surplus"}: ${p.name}`,
            date: Timestamp.fromDate(new Date()),
            referenceType: "manual",
            recordedBy: user?.uid || "",
            createdAt: Timestamp.fromDate(new Date()),
          });
        }

        batch.push({ product: p.name, before: system, after: physical, diff });
      }

      setResults(batch);
      setSaved(true);
      setPhysicalQtys({});
      setTimeout(() => setSaved(false), 6000);
    } catch (e) {
      console.error("Reconciliation failed", e);
    }
    setSaving(false);
  };

  const totalSystem = activeProducts.reduce((s, p) => s + p.quantityInStock, 0);
  const totalPhysical = filtered.reduce((s, p) => s + (physicalQtys[p.id] ?? p.quantityInStock), 0);

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Stock Reconciliation</h1>
            <p className="text-sm text-muted-foreground">Verify physical stock against system records</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">System: <strong className="text-secondary">{formatCurrency(totalSystem)}</strong></span>
            <span className="text-muted-foreground">Counted: <strong className="text-secondary">{formatCurrency(totalPhysical)}</strong></span>
            <span className={`font-medium ${totalPhysical !== totalSystem ? "text-red-600" : "text-green-600"}`}>
              Diff: {formatCurrency(totalPhysical - totalSystem)}
            </span>
          </div>
        </div>

        {saved && results.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-sm text-green-700">
            <div className="flex items-center gap-2 font-medium mb-2"><CheckCircle className="h-4 w-4" /> Reconciliation saved</div>
            <div className="space-y-1">
              {results.slice(0, 5).map((r, i) => (
                <p key={i} className="text-xs">{r.product}: {r.before} → {r.after} ({r.diff > 0 ? "+" : ""}{r.diff})</p>
              ))}
              {results.length > 5 && <p className="text-xs text-muted-foreground">...and {results.length - 5} more</p>}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search products..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button onClick={handleReconcile} disabled={saving} variant="accent">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Reconciliation"}
          </Button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No products found.</p>
        ) : (
          <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left">
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Product</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Category</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">System Qty</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Physical Qty</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Variance</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Value at Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => {
                  const system = p.quantityInStock;
                  const physical = physicalQtys[p.id] ?? system;
                  const diff = physical - system;
                  const val = Math.abs(diff) * (p.costPrice || 0);
                  return (
                    <tr key={p.id} className={`hover:bg-muted/30 cursor-pointer ${diff !== 0 ? "bg-amber-50/50" : ""}`} onClick={() => setDetailProduct(p)}>
                      <td className="px-4 py-2.5 font-medium text-secondary">{p.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{categoryMap.get(p.categoryId) || "—"}</td>
                      <td className="px-4 py-2.5 text-right">{system}</td>
                      <td className="px-4 py-2.5 text-right">
                        <input type="number" min="0"
                          value={physicalQtys[p.id] ?? system}
                          onChange={(e) => setPhysicalQtys({ ...physicalQtys, [p.id]: Math.max(0, Number(e.target.value)) })}
                          className="w-20 px-2 py-1 border border-border rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary" />
                      </td>
                      <td className={`px-4 py-2.5 text-right font-medium ${diff !== 0 ? (diff > 0 ? "text-green-600" : "text-red-600") : "text-muted-foreground"}`}>
                        {diff !== 0 ? `${diff > 0 ? "+" : ""}${diff}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {val > 0 ? formatCurrency(val) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      {detailProduct && (
          <DetailModal title={`Product Details - ${detailProduct.name}`} onClose={() => setDetailProduct(null)}>
            <div className="space-y-2 text-sm">
              <Row label="SKU" value={detailProduct.sku || "—"} />
              <Row label="Name" value={detailProduct.name} />
              <Row label="Category" value={categoryMap.get(detailProduct.categoryId) || "—"} />
              <Row label="Price" value={formatCurrency(detailProduct.price)} />
              <Row label="Cost Price" value={detailProduct.costPrice ? formatCurrency(detailProduct.costPrice) : "—"} />
              <Row label="System Qty" value={String(detailProduct.quantityInStock)} />
              <Row label="Physical Qty" value={String(physicalQtys[detailProduct.id] ?? detailProduct.quantityInStock)} />
              <Row label="Variance" value={String(variance(detailProduct.id))} />
              <Row label="Value at Cost" value={detailProduct.costPrice ? formatCurrency(Math.abs(variance(detailProduct.id)) * detailProduct.costPrice) : "—"} />
              <Row label="Metal Type" value={detailProduct.metalType || "—"} />
              <Row label="Purity" value={detailProduct.purity || "—"} />
              <Row label="Weight" value={detailProduct.weight ? `${detailProduct.weight}g` : "—"} />
              <Row label="Status" value={detailProduct.isActive ? "Active" : "Inactive"} />
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
