"use client";

import { useState, useMemo, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { Product, Category } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { addDoc, collection, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { syncLayersToPhysical } from "@/lib/fifo";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import BarcodeScannerDialog from "@/components/admin/BarcodeScannerDialog";
import {
  Search, Save, CheckCircle, X, Camera, Barcode, Package,
} from "lucide-react";

export default function ReconciliationPage() {
  const { data: products, loading } = useFirestore<Product>("products", {
    constraints: [orderBy("name", "asc"), limit(200)],
    realtime: true,
  });
  const { data: categories } = useFirestore<Category>("categories", { constraints: [limit(50)], realtime: true });
  const { user } = useAuth();

  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [catFilter, setCatFilter] = useState("");
  const [search, setSearch] = useState("");
  const [physicalQtys, setPhysicalQtys] = useState<Record<string, number>>({});
  const [scanLog, setScanLog] = useState<{ id: string; name: string; sku: string; time: Date }[]>([]);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [results, setResults] = useState<{ product: string; before: number; after: number; diff: number }[]>([]);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const categoryProducts = useMemo(() => {
    if (!catFilter) return activeProducts;
    return activeProducts.filter((p) => p.categoryId === catFilter);
  }, [activeProducts, catFilter]);

  const filtered = useMemo(() => {
    let result = categoryProducts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.shortCode?.toLowerCase().includes(q));
    }
    return result;
  }, [categoryProducts, search]);

  const incQty = useCallback((productId: string) => {
    setPhysicalQtys((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }));
  }, []);

  const handleScan = useCallback((barcodeValue: string) => {
    const trimmed = barcodeValue.trim();
    const product = activeProducts.find(
      (p) => p.barcodeId === trimmed || p.sku === trimmed || p.shortCode === trimmed
    );
    if (product) {
      if (!catFilter || product.categoryId === catFilter) {
        incQty(product.id);
        setScanLog((prev) => [{ id: product.id, name: product.name, sku: product.sku, time: new Date() }, ...prev].slice(0, 30));
        setLastScanned(product.name);
        setTimeout(() => setLastScanned(null), 1500);
      }
    } else {
      setUnknownBarcode(trimmed);
      setTimeout(() => setUnknownBarcode(null), 3000);
    }
  }, [activeProducts, catFilter, incQty]);

  const totalSystem = useMemo(() => categoryProducts.reduce((s, p) => s + p.quantityInStock, 0), [categoryProducts]);
  const totalPhysical = useMemo(
    () => categoryProducts.reduce((s, p) => s + (physicalQtys[p.id] ?? 0), 0),
    [categoryProducts, physicalQtys]
  );

  const selectedCatName = catFilter ? categories.find((c) => c.id === catFilter)?.name || "" : "All Categories";

  const handleReconcile = async () => {
    setSaving(true);
    setSaved(false);
    const batch: { product: string; before: number; after: number; diff: number }[] = [];
    try {
      for (const p of activeProducts) {
        const system = p.quantityInStock;
        const physical = physicalQtys[p.id] ?? 0;
        const diff = physical - system;
        if (diff === 0) continue;

        await updateDoc(doc(db, "products", p.id), {
          quantityInStock: physical,
          updatedAt: Timestamp.fromDate(new Date()),
        });

        await syncLayersToPhysical(p.id, physical);

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
      setScanLog([]);
      setTimeout(() => setSaved(false), 6000);
    } catch (e) {
      console.error("Reconciliation failed", e);
    }
    setSaving(false);
  };

  const anyDiff = useMemo(
    () => categoryProducts.some((p) => (physicalQtys[p.id] ?? 0) !== p.quantityInStock),
    [categoryProducts, physicalQtys]
  );

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Stock Reconciliation</h1>
            <p className="text-sm text-muted-foreground">Scan or manually count physical stock</p>
          </div>
          <div className="flex items-center gap-3 text-sm bg-white border border-border rounded-xl px-4 py-2.5 shadow-sm">
            <span className="text-muted-foreground">System: <strong className="text-secondary">{totalSystem}</strong></span>
            <span className="text-muted-foreground">Counted: <strong className="text-secondary">{totalPhysical}</strong></span>
            <span className={`font-semibold ${totalPhysical !== totalSystem ? "text-red-600" : "text-green-600"}`}>
              Diff: {totalPhysical - totalSystem}
            </span>
          </div>
        </div>

        {/* Success banner */}
        {saved && results.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-sm text-green-700">
            <div className="flex items-center gap-2 font-medium mb-2"><CheckCircle className="h-4 w-4" /> Reconciliation saved</div>
            <div className="max-h-24 overflow-y-auto space-y-0.5">
              {results.slice(0, 8).map((r, i) => (
                <p key={i} className="text-xs">{r.product}: {r.before} → {r.after} ({r.diff > 0 ? "+" : ""}{r.diff})</p>
              ))}
              {results.length > 8 && <p className="text-xs text-muted-foreground">...and {results.length - 8} more</p>}
            </div>
          </div>
        )}

        {/* Mode toggle + Category filter */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex bg-muted rounded-lg p-0.5">
            <button onClick={() => setMode("scan")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === "scan" ? "bg-white text-secondary shadow-sm" : "text-muted-foreground hover:text-secondary"}`}>
              <Camera className="h-3.5 w-3.5 inline mr-1" /> Scan
            </button>
            <button onClick={() => setMode("manual")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === "manual" ? "bg-white text-secondary shadow-sm" : "text-muted-foreground hover:text-secondary"}`}>
              <Package className="h-3.5 w-3.5 inline mr-1" /> Manual
            </button>
          </div>
          <select value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setScanLog([]); }}
            className="flex-1 min-w-[160px] max-w-xs px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button onClick={handleReconcile} disabled={saving} variant="accent" className="whitespace-nowrap">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : mode === "scan" ? (
          /* ==================== SCAN MODE ==================== */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Scanner column */}
            <div className="lg:col-span-2">
              {!showScanner ? (
                <div className="bg-white border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
                  <Barcode className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-secondary mb-1">Barcode Scanner</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Scanning: <strong>{selectedCatName}</strong>
                  </p>
                  <Button onClick={() => setShowScanner(true)} variant="accent" size="lg">
                    <Camera className="h-5 w-5 mr-2" /> Start Scanning
                  </Button>
                </div>
              ) : (
                <BarcodeScannerDialog
                  keepOpen
                  onScan={handleScan}
                  onClose={() => setShowScanner(false)}
                />
              )}

              {/* Scan feedback */}
              {lastScanned && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-700 flex items-center gap-2 animate-pulse">
                  <CheckCircle className="h-4 w-4 shrink-0" /> {lastScanned} — counted +1
                </div>
              )}
              {unknownBarcode && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-600 flex items-center gap-2">
                  <X className="h-4 w-4 shrink-0" /> Unknown barcode: <code className="bg-red-100 px-1 rounded text-xs">{unknownBarcode}</code>
                </div>
              )}

              {/* Inline scan log */}
              {scanLog.length > 0 && (
                <div className="mt-4 bg-white border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Recently Scanned ({scanLog.length})
                  </div>
                  <div className="divide-y divide-border max-h-64 overflow-y-auto">
                    {scanLog.map((entry, i) => (
                      <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground shrink-0 w-5">#{scanLog.length - i}</span>
                          <span className="font-medium text-secondary truncate">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground font-mono">{entry.sku}</span>
                          <span className="text-xs font-semibold text-primary">×{physicalQtys[entry.id] ?? 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Summary sidebar */}
            <div className="bg-white border border-border rounded-xl p-4 space-y-3 h-fit">
              <h3 className="text-sm font-bold text-secondary">Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium text-secondary">{selectedCatName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Products in category</span>
                  <span className="font-medium text-secondary">{categoryProducts.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scanned</span>
                  <span className="font-medium text-secondary">{Object.keys(physicalQtys).length} items</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">System qty</span>
                  <span className="font-medium text-secondary">{totalSystem}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Counted qty</span>
                  <span className="font-medium text-secondary">{totalPhysical}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="font-semibold">Variance</span>
                  <span className={`font-bold ${totalPhysical !== totalSystem ? "text-red-600" : "text-green-600"}`}>
                    {totalPhysical - totalSystem}
                  </span>
                </div>
              </div>

              {!showScanner && scanLog.length === 0 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Select a category, then start scanning.
                </p>
              )}

              {showScanner && (
                <Button onClick={() => setShowScanner(false)} variant="outline" className="w-full mt-2">
                  <X className="h-4 w-4 mr-1" /> Stop Scanning
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* ==================== MANUAL MODE ==================== */
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search products..." value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>

            {categoryProducts.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No products found.</p>
            ) : (
              <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
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
                        const physical = physicalQtys[p.id] ?? 0;
                        const diff = physical - system;
                        const val = Math.abs(diff) * (p.costPrice || 0);
                        return (
                          <tr key={p.id} className={`hover:bg-muted/30 cursor-pointer ${diff !== 0 ? "bg-amber-50/50" : ""}`} onClick={() => setDetailProduct(p)}>
                            <td className="px-4 py-2.5 font-medium text-secondary">{p.name}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{categoryMap.get(p.categoryId) || "—"}</td>
                            <td className="px-4 py-2.5 text-right">{system}</td>
                            <td className="px-4 py-2.5 text-right">
                              <input type="number" min="0"
                                value={physicalQtys[p.id] ?? 0}
                                onClick={(e) => e.stopPropagation()}
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
              </div>
            )}
          </div>
        )}

        {/* Detail modal */}
        {detailProduct && (
          <DetailModal title={`Product Details - ${detailProduct.name}`} onClose={() => setDetailProduct(null)}>
            <div className="space-y-2 text-sm">
              <Row label="SKU" value={detailProduct.sku || "—"} />
              <Row label="Barcode ID" value={detailProduct.barcodeId || "—"} />
              <Row label="Name" value={detailProduct.name} />
              <Row label="Category" value={categoryMap.get(detailProduct.categoryId) || "—"} />
              <Row label="Price" value={formatCurrency(detailProduct.price)} />
              <Row label="Cost Price" value={detailProduct.costPrice ? formatCurrency(detailProduct.costPrice) : "—"} />
              <Row label="System Qty" value={String(detailProduct.quantityInStock)} />
              <Row label="Physical Qty" value={String(physicalQtys[detailProduct.id] ?? 0)} />
              <Row label="Variance" value={String((physicalQtys[detailProduct.id] ?? 0) - detailProduct.quantityInStock)} />
              <Row label="Value at Cost" value={detailProduct.costPrice ? formatCurrency(Math.abs((physicalQtys[detailProduct.id] ?? 0) - detailProduct.quantityInStock) * detailProduct.costPrice) : "—"} />
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