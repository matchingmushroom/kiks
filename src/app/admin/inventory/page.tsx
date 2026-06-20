"use client";

import { useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { Product, InventoryLog, Category } from "@/types";
import { formatCurrency, formatDateTime, toDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  addDoc, collection, updateDoc, doc, Timestamp, getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Search, Plus, Minus, X, Save, ClipboardList, AlertTriangle, Package, LayoutGrid, List, Download, Mail } from "lucide-react";
import { exportInventoryCSV, downloadBlob } from "@/lib/export";

export default function AdminInventoryPage() {
  const { data: products } = useFirestore<Product>("products", {
    constraints: [orderBy("name", "asc"), limit(200)],
    realtime: false,
  });
  const { data: logs } = useFirestore<InventoryLog>("inventoryLogs", {
    constraints: [orderBy("createdAt", "desc"), limit(100)],
    realtime: false,
  });
  const { data: categories } = useFirestore<Category>("categories", {
    constraints: [limit(50)],
    realtime: false,
  });
  const { user, profile } = useAuth();

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [adjusting, setAdjusting] = useState<{ productId: string; name: string; currentStock: number } | null>(null);
  const [adjustType, setAdjustType] = useState<"add" | "remove" | "set">("add");
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustReason, setAdjustReason] = useState("");
  const [tab, setTab] = useState<"stock" | "log">("stock");
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [reportRange, setReportRange] = useState<"all" | "ytd" | "mtd" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const canExport = profile?.role !== "staff";

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const filtered = useMemo(() => {
    let result = products.filter((p) => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
      if (stockFilter === "low") return matchSearch && p.quantityInStock > 0 && p.quantityInStock <= 3;
      if (stockFilter === "out") return matchSearch && p.quantityInStock <= 0;
      if (stockFilter === "active") return matchSearch && p.isActive;
      return matchSearch;
    });
    let start = 0, end = Infinity;
    if (reportRange === "ytd") { start = new Date(new Date().getFullYear(), 0, 1).getTime(); }
    else if (reportRange === "mtd") { start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(); }
    else if (reportRange === "custom" && dateFrom && dateTo) {
      start = new Date(dateFrom).getTime();
      end = new Date(dateTo).getTime() + 86400000;
    }
    if (start > 0 || end < Infinity) {
      result = result.filter((p) => { const d = toDate(p.createdAt).getTime(); return d >= start && d <= end; });
    }
    return result;
  }, [products, search, stockFilter, reportRange, dateFrom, dateTo]);

  const totalStock = products.reduce((s, p) => s + (p.isActive ? p.quantityInStock : 0), 0);
  const lowStockCount = products.filter((p) => p.isActive && p.quantityInStock > 0 && p.quantityInStock <= 3).length;
  const outOfStockCount = products.filter((p) => p.isActive && p.quantityInStock <= 0).length;

  const startAdjust = (p: Product) => {
    setAdjusting({ productId: p.id, name: p.name, currentStock: p.quantityInStock });
    setAdjustQty(1);
    setAdjustType("add");
    setAdjustReason("");
  };

  const handleAdjust = async () => {
    if (!adjusting || adjustQty <= 0) return;
    setSaving(true);
    try {
      const productRef = doc(db, "products", adjusting.productId);
      let newQty = adjusting.currentStock;
      if (adjustType === "add") newQty += adjustQty;
      else if (adjustType === "remove") newQty = Math.max(0, newQty - adjustQty);
      else newQty = adjustQty;

      await updateDoc(productRef, { quantityInStock: newQty, updatedAt: Timestamp.fromDate(new Date()) });

      const qtyChange = adjustType === "set" ? newQty - adjusting.currentStock : (adjustType === "add" ? adjustQty : -adjustQty);

      await addDoc(collection(db, "inventoryLogs"), {
        productId: adjusting.productId,
        changeType: adjustType,
        quantityChange: qtyChange,
        reason: adjustReason,
        performedBy: user?.uid || "",
        createdAt: Timestamp.fromDate(new Date()),
      });

      // Financial impact for stock changes
      const product = products.find((p) => p.id === adjusting.productId);
      const costPrice = product?.costPrice || 0;
      if (costPrice > 0 && qtyChange !== 0) {
        const value = Math.abs(qtyChange) * costPrice;
        if (qtyChange < 0) {
          await addDoc(collection(db, "accountTransactions"), {
            accountId: "cash_in_hand",
            type: "debit",
            amount: value,
            description: `Stock loss: ${adjustReason || adjusting.name}`,
            date: Timestamp.fromDate(new Date()),
            referenceType: "manual",
            recordedBy: user?.uid || "",
            createdAt: Timestamp.fromDate(new Date()),
          });
        } else {
          await addDoc(collection(db, "accountTransactions"), {
            accountId: "cash_in_hand",
            type: "credit",
            amount: value,
            description: `Stock surplus: ${adjustReason || adjusting.name}`,
            date: Timestamp.fromDate(new Date()),
            referenceType: "manual",
            recordedBy: user?.uid || "",
            createdAt: Timestamp.fromDate(new Date()),
          });
        }
      }

      setAdjusting(null);
    } catch (e) {
      console.error("Adjust failed", e);
    }
    setSaving(false);
  };

  const handleDownloadCSV = () => {
    const csv = exportInventoryCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `inventory-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const snap = await getDoc(doc(db, "shop_settings", "emailBackupConfig"));
      if (!snap.exists()) { alert("Configure Email & Backup in Settings first."); return; }
      const cfg = snap.data() as any;
      if (!cfg.gasWebhookUrl) { alert("Configure GAS Webhook URL in Settings first."); return; }
      const csv = exportInventoryCSV(filtered);
      const period = new Date().toISOString().slice(0, 10);
      const res = await fetch(cfg.gasWebhookUrl, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "sendReport", module: "inventory", csv, filename: `inventory-${period}.csv`, period, emailTo: cfg.emailTo || "", driveFolderId: cfg.driveFolderId || "" }),
      });
      const data = await res.json();
      if (data.status === "ok") alert("Report sent!"); else alert("Error: " + (data.message || "Unknown"));
    } catch (e: any) { alert("Failed: " + (e.message || e)); }
    setSendingEmail(false);
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Inventory</h1>
            <p className="text-sm text-muted-foreground">
              {totalStock} total items · {lowStockCount} low stock · {outOfStockCount} out of stock
            </p>
          </div>
        </div>

            <div className="flex flex-wrap gap-2 mb-6">
              <button onClick={() => setTab("stock")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors ${
                  tab === "stock" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                <ClipboardList className="h-4 w-4" /> Stock
              </button>
              <button onClick={() => setTab("log")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors ${
                  tab === "log" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                <Package className="h-4 w-4" /> Audit Log
              </button>
            </div>

        {tab === "stock" ? (
          <>
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search products..." value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">All Products</option>
                <option value="active">Active</option>
                <option value="low">Low Stock (≤3)</option>
                <option value="out">Out of Stock</option>
              </select>
              {canExport && (<>
                <select value={reportRange} onChange={(e) => setReportRange(e.target.value as any)}
                  className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="all">All Time</option>
                  <option value="ytd">Year to Date</option>
                  <option value="mtd">Month to Day</option>
                  <option value="custom">Custom</option>
                </select>
                {reportRange === "custom" && (
                  <>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                      className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                      className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </>
                )}
                <button onClick={handleDownloadCSV}
                  className="px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted flex items-center gap-1.5">
                  <Download className="h-4 w-4" /> CSV
                </button>
                <button onClick={handleSendEmail} disabled={sendingEmail}
                  className="px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted flex items-center gap-1.5 disabled:opacity-50">
                  <Mail className="h-4 w-4" /> {sendingEmail ? "Sending..." : "Send"}
                </button>
              </>)}
              <button onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                className="p-2 border border-border rounded-lg text-muted-foreground hover:bg-muted" title={viewMode === "grid" ? "List View" : "Grid View"}>
                {viewMode === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
              </button>
            </div>

            {/* Adjust Stock Form */}
            {adjusting && (
              <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-secondary">
                    Adjust Stock: {adjusting.name}
                  </h2>
                  <button onClick={() => setAdjusting(null)} className="p-1 hover:bg-muted rounded">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Current stock: <span className="font-medium text-secondary">{adjusting.currentStock}</span>
                </p>
                <div className="flex flex-wrap gap-3 mb-4">
                  {(["add", "remove", "set"] as const).map((t) => (
                    <button key={t}
                      onClick={() => setAdjustType(t)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                        adjustType === t
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}>
                      {t === "add" ? "Add" : t === "remove" ? "Remove" : "Set Exact"}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="w-32">
                    <label className="block text-xs text-muted-foreground mb-1">Quantity</label>
                    <input type="number" value={adjustQty} min={1}
                      onChange={(e) => setAdjustQty(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-muted-foreground mb-1">Reason</label>
                    <input type="text" placeholder="e.g., New shipment, damaged item, return" value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={handleAdjust} disabled={saving || adjustQty <= 0} variant="accent">
                      <Save className="h-4 w-4" /> {saving ? "..." : "Update"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((p) => (
                  <div key={p.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-secondary text-sm truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{categoryMap.get(p.categoryId) || "—"} · {p.sku || "—"}</p>
                      </div>
                      <button onClick={() => startAdjust(p)}
                        className="text-xs px-2.5 py-1.5 bg-muted hover:bg-muted/80 rounded text-muted-foreground hover:text-secondary transition-colors shrink-0">
                        Adjust
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-lg ${
                        p.quantityInStock <= 0 ? "text-red-500" :
                        p.quantityInStock <= 3 ? "text-amber-500" :
                        "text-secondary"
                      }`}>{p.quantityInStock}</span>
                      {p.quantityInStock <= 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600">
                          <AlertTriangle className="h-3 w-3" /> Out of Stock
                        </span>
                      ) : p.quantityInStock <= 3 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="h-3 w-3" /> Low Stock
                        </span>
                      ) : (
                        <span className="text-xs text-green-600">In Stock</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-left">
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Product</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Category</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">SKU</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Stock</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Status</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 text-sm font-medium text-secondary">{p.name}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{categoryMap.get(p.categoryId) || "—"}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.sku || "—"}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-bold">{p.quantityInStock}</td>
                        <td className="px-4 py-2.5 text-sm text-right">
                          {p.quantityInStock <= 0 ? (
                            <span className="text-xs text-red-600 font-medium">Out of Stock</span>
                          ) : p.quantityInStock <= 3 ? (
                            <span className="text-xs text-amber-600 font-medium">Low Stock</span>
                          ) : (
                            <span className="text-xs text-green-600">In Stock</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-right">
                          <button onClick={() => startAdjust(p)}
                            className="text-xs px-2.5 py-1.5 bg-muted hover:bg-muted/80 rounded text-muted-foreground hover:text-secondary transition-colors">
                            Adjust
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No inventory changes recorded yet.</p>
            ) : (
              logs.map((log) => {
                const prod = products.find((p) => p.id === log.productId);
                return (
                  <div key={log.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-secondary text-sm truncate">{prod?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize shrink-0 ${
                        log.changeType === "add" || log.changeType === "purchase" ? "bg-green-50 text-green-700" :
                        log.changeType === "remove" ? "bg-red-50 text-red-700" :
                        log.changeType === "sale" ? "bg-purple-50 text-purple-700" :
                        log.changeType === "purchase_return" ? "bg-orange-50 text-orange-700" :
                        "bg-blue-50 text-blue-700"
                      }`}>{log.changeType.replace("_", " ")}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-medium ${
                        (log.quantityChange || 0) > 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {(log.quantityChange || 0) > 0 ? `+${log.quantityChange}` : log.quantityChange}
                      </span>
                      <span className="text-muted-foreground">{log.reason || "—"}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
