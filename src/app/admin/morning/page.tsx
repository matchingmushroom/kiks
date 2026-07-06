"use client";

import { useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import PageHeader from "@/components/admin/PageHeader";
import { useFirestore } from "@/hooks/useFirestore";
import { Product, FifoLayer, Creditor, Sale, Category } from "@/types";
import { formatCurrency, toDate } from "@/lib/utils";
import { Package, AlertTriangle, TrendingUp, DollarSign, Clock, Shield, Users, Sun } from "lucide-react";

const AGE_GREEN = 120;
const AGE_YELLOW = 180;

function getAgeDays(purchaseDate: number): number {
  return Math.floor((Date.now() - purchaseDate) / 86400000);
}

function getAgeColor(days: number): string {
  if (days <= AGE_GREEN) return "bg-green-100 text-green-700 border-green-200";
  if (days <= AGE_YELLOW) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function getSellSuggestion(days: number): { label: string; color: string } {
  if (days <= AGE_GREEN) return { label: "Keep", color: "text-green-600 bg-green-50" };
  if (days <= AGE_YELLOW) return { label: "Discount 30%", color: "text-yellow-600 bg-yellow-50" };
  return { label: "Clearance", color: "text-red-600 bg-red-50" };
}

function StatCard({ title, value, sub, icon, color }: {
  title: string; value: string; sub?: string; icon: React.ReactNode; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        <span className={`p-1.5 rounded-lg ${color || "bg-primary/10 text-primary"}`}>{icon}</span>
      </div>
      <p className="text-xl font-bold text-secondary">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function MorningDashboardPage() {
  const { data: products } = useFirestore<Product>("products", { constraints: [], realtime: true });
  const { data: fifoLayers } = useFirestore<FifoLayer>("fifo_layers", { constraints: [], realtime: true });
  const { data: creditors } = useFirestore<Creditor>("creditors", { constraints: [], realtime: true });
  const { data: sales } = useFirestore<Sale>("sales", { constraints: [], realtime: true });

  const { data: categories } = useFirestore<Category>("categories", { constraints: [], realtime: true });

  const [showAllStock, setShowAllStock] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState("");

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);
  const activeLayers = useMemo(() => fifoLayers.filter((l) => l.remainingQty > 0), [fifoLayers]);
  const activeCreditors = useMemo(() => creditors.filter((c) => c.status === "active"), [creditors]);

  const productLayerMap = useMemo(() => {
    const map = new Map<string, { layers: FifoLayer[]; oldestDays: number; totalValue: number; totalQty: number }>();
    for (const product of activeProducts) {
      const layers = activeLayers.filter((l) => l.productId === product.id);
      if (layers.length === 0) {
        map.set(product.id, { layers: [], oldestDays: 0, totalValue: 0, totalQty: product.quantityInStock || 0 });
      } else {
        const oldest = Math.min(...layers.map((l) => l.purchaseDate));
        const totalValue = layers.reduce((s, l) => s + l.remainingQty * l.unitCost, 0);
        const totalQty = layers.reduce((s, l) => s + l.remainingQty, 0);
        map.set(product.id, { layers, oldestDays: getAgeDays(oldest), totalValue, totalQty });
      }
    }
    return map;
  }, [activeProducts, activeLayers]);

  const oldestProduct = useMemo(() => {
    let oldest = 0;
    let oldestId = "";
    for (const [id, info] of productLayerMap) {
      if (info.oldestDays > oldest && info.layers.length > 0) {
        oldest = info.oldestDays;
        oldestId = id;
      }
    }
    const prod = products.find((p) => p.id === oldestId);
    return prod ? { product: prod, days: oldest } : null;
  }, [productLayerMap, products]);

  const redStockValue = useMemo(() => {
    let total = 0;
    for (const [, info] of productLayerMap) {
      for (const layer of info.layers) {
        const days = getAgeDays(layer.purchaseDate);
        if (days > AGE_YELLOW) {
          total += layer.remainingQty * layer.unitCost;
        }
      }
    }
    return total;
  }, [productLayerMap]);

  const overdueCreditors = useMemo(() => {
    const now = Date.now();
    return activeCreditors
      .filter((c) => {
        const due = toDate(c.dueDate).getTime();
        return due > 0 && due < now && c.balanceDue > 0;
      })
      .map((c) => ({
        ...c,
        dueTime: toDate(c.dueDate).getTime(),
      }))
      .sort((a, b) => a.dueTime - b.dueTime);
  }, [activeCreditors]);

  const bestSeller7Days = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    const qtyMap = new Map<string, number>();
    for (const sale of sales) {
      const saleTime = toDate(sale.saleDate).getTime();
      if (saleTime < cutoff) continue;
      for (const item of sale.items || []) {
        qtyMap.set(item.productId, (qtyMap.get(item.productId) || 0) + item.quantity);
      }
    }
    let bestId = "";
    let bestQty = 0;
    for (const [id, qty] of qtyMap) {
      if (qty > bestQty) { bestQty = qty; bestId = id; }
    }
    const prod = products.find((p) => p.id === bestId);
    return prod ? { product: prod, qty: bestQty } : null;
  }, [sales, products]);

  const overstocked = useMemo(() => {
    return activeProducts.filter((p) => (p.quantityInStock || 0) > 20).sort((a, b) => (b.quantityInStock || 0) - (a.quantityInStock || 0));
  }, [activeProducts]);

  const stockWithAge = useMemo(() => {
    const items = activeProducts
      .map((p) => ({
        product: p,
        info: productLayerMap.get(p.id) || { oldestDays: 0, totalValue: 0, totalQty: p.quantityInStock || 0, layers: [] },
      }))
      .filter((item) => categoryFilter === "all" || item.product.categoryId === categoryFilter)
      .filter((item) => collectionFilter ? (item.product.collection || "").toLowerCase().includes(collectionFilter.toLowerCase()) : true)
      .sort((a, b) => b.info.oldestDays - a.info.oldestDays);
    return showAllStock ? items : items.slice(0, 20);
  }, [activeProducts, productLayerMap, showAllStock, categoryFilter, collectionFilter]);

  const collections = useMemo(() => {
    const collSet = new Set<string>();
    for (const p of activeProducts) {
      if (p.collection) collSet.add(p.collection);
    }
    const result: {
      name: string; productCount: number; totalCost: number; totalSoldQty: number;
      totalPurchasedQty: number; totalRevenue: number; oldestPurchaseDate: number;
    }[] = [];
    for (const name of collSet) {
      const collProducts = activeProducts.filter((p) => p.collection === name);
      const prodIds = collProducts.map((p) => p.id);
      let totalCost = 0;
      let totalPurchasedQty = 0;
      let oldestPurchaseDate = Infinity;
      for (const layer of activeLayers) {
        if (prodIds.includes(layer.productId)) {
          totalCost += layer.remainingQty * layer.unitCost;
          totalPurchasedQty += layer.quantity;
          if (layer.purchaseDate < oldestPurchaseDate) oldestPurchaseDate = layer.purchaseDate;
        }
      }
      let totalSoldQty = 0;
      let totalRevenue = 0;
      for (const sale of sales) {
        for (const item of sale.items || []) {
          if (prodIds.includes(item.productId)) {
            totalSoldQty += item.quantity;
            totalRevenue += item.subtotal || 0;
          }
        }
      }
      result.push({
        name, productCount: collProducts.length, totalCost, totalSoldQty, totalPurchasedQty, totalRevenue,
        oldestPurchaseDate: oldestPurchaseDate === Infinity ? 0 : oldestPurchaseDate,
      });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [activeProducts, activeLayers, sales]);

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <PageHeader
          title=" Morning Dashboard"
          subtitle="Your daily overview — stock health, reminders, and seasonal performance"
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <StatCard
            title="Oldest Item"
            value={oldestProduct ? `${oldestProduct.product.name}` : "—"}
            sub={oldestProduct ? `${oldestProduct.days} days in stock` : "No stock"}
            icon={<Clock className="h-4 w-4" />}
            color="bg-orange-50 text-orange-600"
          />
          <StatCard
            title="Red Stock Value"
            value={formatCurrency(redStockValue)}
            sub="Items aged 180+ days"
            icon={<DollarSign className="h-4 w-4" />}
            color="bg-red-50 text-red-600"
          />
          <StatCard
            title="Overdue Bills"
            value={String(overdueCreditors.length)}
            sub={`Total due: ${formatCurrency(overdueCreditors.reduce((s, c) => s + c.balanceDue, 0))}`}
            icon={<AlertTriangle className="h-4 w-4" />}
            color="bg-rose-50 text-rose-600"
          />
          <StatCard
            title="Best Seller (7d)"
            value={bestSeller7Days ? bestSeller7Days.product.name : "—"}
            sub={bestSeller7Days ? `${bestSeller7Days.qty} units` : "No sales"}
            icon={<TrendingUp className="h-4 w-4" />}
            color="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            title="Overstocked"
            value={String(overstocked.length)}
            sub="Items with 20+ in stock"
            icon={<Package className="h-4 w-4" />}
            color="bg-blue-50 text-blue-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-secondary">Color-Coded Stock by Age</h2>
                </div>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="Filter collection..." value={collectionFilter}
                    onChange={(e) => setCollectionFilter(e.target.value)}
                    className="w-36 px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={() => setShowAllStock(!showAllStock)}
                    className="text-xs text-primary hover:underline">{showAllStock ? "Top 20" : `Show All (${activeProducts.length})`}</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button onClick={() => setCategoryFilter("all")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${categoryFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-secondary hover:bg-muted/80"}`}>All</button>
                {categories.map((c) => (
                  <button key={c.id} onClick={() => setCategoryFilter(c.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${categoryFilter === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-secondary hover:bg-muted/80"}`}>{c.name}</button>
                ))}
              </div>
              {(categoryFilter !== "all") && (
                <p className="text-xs text-muted-foreground mb-2">
                  Showing {stockWithAge.length} products in <strong>{categories.find((c) => c.id === categoryFilter)?.name || categoryFilter}</strong>
                </p>
              )}
            <div className="flex items-center gap-3 mb-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> &le;120d (Keep)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> 121-180d</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> 180d+ (Clearance)</span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Product</th>
                    <th className="pb-2 pr-2 font-medium">Category</th>
                    <th className="pb-2 pr-2 font-medium text-right">Stock</th>
                    <th className="pb-2 pr-2 font-medium text-right">Age</th>
                    <th className="pb-2 font-medium text-right">Suggestion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stockWithAge.map(({ product, info }) => {
                    const suggestion = info.layers.length > 0 ? getSellSuggestion(info.oldestDays) : { label: "No layers", color: "text-gray-400 bg-gray-50" };
                    const catName = categories.find((c) => c.id === product.categoryId)?.name || "";
                    return (
                      <tr key={product.id} className="hover:bg-muted/30">
                        <td className="py-2 pr-2 max-w-[200px] truncate">{product.name}</td>
                        <td className="py-2 pr-2 text-xs text-muted-foreground">{catName}</td>
                        <td className="py-2 pr-2 text-right font-medium">{info.totalQty}</td>
                        <td className="py-2 pr-2 text-right">
                          {info.layers.length > 0 ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${getAgeColor(info.oldestDays)}`}>
                              {info.oldestDays}d
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${suggestion.color}`}>{suggestion.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {stockWithAge.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">No products found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-rose-500" />
                <h2 className="text-sm font-semibold text-secondary">Supplier Payment Reminders</h2>
              </div>
              <span className="text-xs text-muted-foreground">{overdueCreditors.length} overdue</span>
            </div>
            {overdueCreditors.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No overdue supplier bills</p>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-2 font-medium">Supplier</th>
                      <th className="pb-2 pr-2 font-medium text-right">Total</th>
                      <th className="pb-2 pr-2 font-medium text-right">Balance</th>
                      <th className="pb-2 font-medium text-right">Overdue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {overdueCreditors.map((c) => {
                      const daysOverdue = Math.floor((Date.now() - c.dueTime) / 86400000);
                      return (
                        <tr key={c.id} className="hover:bg-muted/30">
                          <td className="py-2 pr-2 font-medium">{c.supplierName}</td>
                          <td className="py-2 pr-2 text-right">{formatCurrency(c.totalAmount)}</td>
                          <td className="py-2 pr-2 text-right text-red-600 font-medium">{formatCurrency(c.balanceDue)}</td>
                          <td className="py-2 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${daysOverdue > 60 ? "bg-red-100 text-red-700" : daysOverdue > 30 ? "bg-yellow-100 text-yellow-700" : "bg-orange-100 text-orange-700"}`}>
                              {daysOverdue}d
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-5 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-secondary">Seasonal Dashboard</h2>
            </div>
            <span className="text-xs text-muted-foreground">{collections.length} collections</span>
          </div>
          {collections.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No collections found. Set a <strong>Collection / Season</strong> on products during purchase to see seasonal performance.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Collection</th>
                    <th className="pb-2 pr-2 font-medium text-right">Products</th>
                    <th className="pb-2 pr-2 font-medium text-right">Age (wks)</th>
                    <th className="pb-2 pr-2 font-medium text-right">Cost (NPR)</th>
                    <th className="pb-2 pr-2 font-medium text-right">Sold Qty</th>
                    <th className="pb-2 pr-2 font-medium text-right">Revenue</th>
                    <th className="pb-2 pr-2 font-medium text-right">Sold %</th>
                    <th className="pb-2 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {collections.map((col) => {
                    const weeks = Math.floor((Date.now() - col.oldestPurchaseDate) / (7 * 86400000));
                    const soldPct = col.totalPurchasedQty > 0 ? Math.round((col.totalSoldQty / col.totalPurchasedQty) * 100) : 0;
                    const isFlash = weeks >= 12 && soldPct < 20;
                    return (
                      <tr key={col.name} className={`hover:bg-muted/30 ${isFlash ? "bg-red-50" : ""}`}>
                        <td className="py-2 pr-2 font-medium">{col.name}</td>
                        <td className="py-2 pr-2 text-right">{col.productCount}</td>
                        <td className="py-2 pr-2 text-right">{weeks}w</td>
                        <td className="py-2 pr-2 text-right">{formatCurrency(col.totalCost)}</td>
                        <td className="py-2 pr-2 text-right">{col.totalSoldQty}</td>
                        <td className="py-2 pr-2 text-right">{formatCurrency(col.totalRevenue)}</td>
                        <td className="py-2 pr-2 text-right">{soldPct}%</td>
                        <td className="py-2 text-right">
                          {isFlash ? (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700" title={`Sold ${soldPct}% after ${weeks} weeks — needs promotion`}>
                              Flash Alert
                            </span>
                          ) : soldPct >= 50 ? (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Healthy</span>
                          ) : weeks >= 12 ? (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Needs Push</span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">New</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
