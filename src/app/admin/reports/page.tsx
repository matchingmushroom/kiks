"use client";

import { useState, useMemo, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sale, Purchase, Expense, InventoryLog, Product, Category, FifoLayer } from "@/types";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { downloadBlob } from "@/lib/export";
import { pdf, Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import {
  FileDown, FileText, Search, X, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type ReportTab = "sales" | "purchases" | "expenses" | "inventory" | "trial" | "aging" | "inventory-aging" | "inventory-turnover";

const today = () => new Date().toISOString().slice(0, 10);

export default function ReportsPage() {
  const { user } = useAuth();
  const { settings } = useShopSettings();

  const [activeTab, setActiveTab] = useState<ReportTab>("sales");
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [search, setSearch] = useState("");

  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [detailLog, setDetailLog] = useState<InventoryLog | null>(null);

  const { data: sales } = useFirestore<Sale>("sales", {
    constraints: [],
    realtime: true,
  });
  const { data: purchases } = useFirestore<Purchase>("purchases", {
    constraints: [],
    realtime: true,
  });
  const { data: expenses } = useFirestore<Expense>("expenses", {
    constraints: [],
    realtime: true,
  });
  const { data: inventoryLogs } = useFirestore<InventoryLog>("inventoryLogs", {
    constraints: [],
    realtime: true,
  });
  const { data: products } = useFirestore<Product>("products", {
    constraints: [],
    realtime: true,
  });
  const { data: categories } = useFirestore<Category>("categories", {
    constraints: [],
    realtime: true,
  });
  const { data: fifoLayers } = useFirestore<FifoLayer>("fifo_layers", {
    constraints: [],
    realtime: true,
  });

  const fromMs = new Date(dateFrom).getTime();
  const toMs = new Date(dateTo).getTime() + 86400000;

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    return sales.filter((s) => {
      const d = new Date((s.saleDate as any)?.seconds ? (s.saleDate as any).seconds * 1000 : (s.saleDate as number)).getTime();
      return d >= fromMs && d < toMs;
    }).sort((a, b) => {
      const da = new Date((a.saleDate as any)?.seconds ? (a.saleDate as any).seconds * 1000 : (a.saleDate as number)).getTime();
      const db = new Date((b.saleDate as any)?.seconds ? (b.saleDate as any).seconds * 1000 : (b.saleDate as number)).getTime();
      return db - da;
    }).filter((s) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return s.id?.toLowerCase().includes(q) || s.customer?.name?.toLowerCase().includes(q) || s.customer?.phone?.includes(q);
    });
  }, [sales, fromMs, toMs, search]);

  const filteredPurchases = useMemo(() => {
    if (!purchases) return [];
    return purchases.filter((p) => {
      const d = new Date((p.purchaseDate as any)?.seconds ? (p.purchaseDate as any).seconds * 1000 : (p.purchaseDate as number)).getTime();
      return d >= fromMs && d < toMs;
    }).sort((a, b) => {
      const da = new Date((a.purchaseDate as any)?.seconds ? (a.purchaseDate as any).seconds * 1000 : (a.purchaseDate as number)).getTime();
      const db = new Date((b.purchaseDate as any)?.seconds ? (b.purchaseDate as any).seconds * 1000 : (b.purchaseDate as number)).getTime();
      return db - da;
    }).filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return p.supplierName?.toLowerCase().includes(q) || p.billNo?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q);
    });
  }, [purchases, fromMs, toMs, search]);

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter((e) => {
      const d = new Date((e.date as any)?.seconds ? (e.date as any).seconds * 1000 : (e.date as number)).getTime();
      return d >= fromMs && d < toMs;
    }).sort((a, b) => {
      const da = new Date((a.date as any)?.seconds ? (a.date as any).seconds * 1000 : (a.date as number)).getTime();
      const db = new Date((b.date as any)?.seconds ? (b.date as any).seconds * 1000 : (b.date as number)).getTime();
      return db - da;
    }).filter((e) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return e.title?.toLowerCase().includes(q) || e.head?.toLowerCase().includes(q) || e.id?.toLowerCase().includes(q);
    });
  }, [expenses, fromMs, toMs, search]);

  const filteredLogs = useMemo(() => {
    if (!inventoryLogs) return [];
    return inventoryLogs.filter((l) => {
      const d = new Date((l.createdAt as any)?.seconds ? (l.createdAt as any).seconds * 1000 : (l.createdAt as number)).getTime();
      return d >= fromMs && d < toMs;
    }).sort((a, b) => {
      const da = new Date((a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (a.createdAt as number)).getTime();
      const db = new Date((b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (b.createdAt as number)).getTime();
      return db - da;
    }).filter((l) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return l.productId?.toLowerCase().includes(q) || l.reason?.toLowerCase().includes(q) || l.changeType?.toLowerCase().includes(q);
    });
  }, [inventoryLogs, fromMs, toMs, search]);

  const reportHeader = `${dateFrom} to ${dateTo}`;
  const reportFooter = `Generated on ${formatDateTime(Date.now())} by ${user?.displayName || user?.email || "Unknown"}`;

  // ── CSV Export ──
  const exportCSV = () => {
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    let csv = "";
    if (activeTab === "sales") {
      const headers = "Sale ID,Date,Customer Name,Phone,Type,Items,Subtotal,Discount,Grand Total,Recorded By";
      const rows = filteredSales.map((s) => [
        esc(s.id), esc(formatDate(s.saleDate)), esc(s.customer?.name), esc(s.customer?.phone),
        esc(s.saleType), esc(s.items?.length || 0), esc(s.totalAmount), esc(s.discountAmount || 0), esc(s.finalAmount), esc(s.recordedByName),
      ].join(","));
      csv = `${reportHeader}\n${headers}\n${rows.join("\n")}\n\n${reportFooter}`;
    } else if (activeTab === "purchases") {
      const headers = "Purchase ID,Date,Supplier,Phone,Items,Total Amount,Payment Status,Bill No.,Recorded By";
      const rows = filteredPurchases.map((p) => [
        esc(p.id), esc(formatDate(p.purchaseDate)), esc(p.supplierName), esc(p.supplierPhone),
        esc(p.items?.length || 0), esc(p.totalAmount), esc(p.paymentStatus), esc(p.billNo), esc(p.recordedByName),
      ].join(","));
      csv = `${reportHeader}\n${headers}\n${rows.join("\n")}\n\n${reportFooter}`;
    } else if (activeTab === "expenses") {
      const headers = "Expense ID,Date,Title,Head,Amount,Payment Method,Description,Recorded By";
      const rows = filteredExpenses.map((e) => [
        esc(e.id), esc(formatDate(e.date)), esc(e.title), esc(e.head),
        esc(e.amount), esc(e.paymentMethod), esc(e.description), esc(e.recordedBy),
      ].join(","));
      csv = `${reportHeader}\n${headers}\n${rows.join("\n")}\n\n${reportFooter}`;
    } else if (activeTab === "inventory-aging" || activeTab === "inventory-turnover") {
      csv = `${reportHeader}\n\nCSV export is not available for this report view. Use category filters and screenshot instead.`;
    } else {
      const headers = "Log ID,Product ID,Type,Quantity Change,Reason,Date";
      const rows = filteredLogs.map((l) => [
        esc(l.id), esc(l.productId), esc(l.changeType), esc(l.quantityChange), esc(l.reason), esc(formatDate(l.createdAt)),
      ].join(","));
      csv = `${reportHeader}\n${headers}\n${rows.join("\n")}\n\n${reportFooter}`;
    }
    downloadBlob(new Blob([csv], { type: "text/csv" }), `${activeTab}-report-${dateFrom}-to-${dateTo}.csv`);
  };

  // ── PDF Export ──
  const exportPDF = async () => {
    if (activeTab === "inventory-aging" || activeTab === "inventory-turnover") {
      alert("PDF export is not available for this report view.");
      return;
    }
    const cols = activeTab === "sales"
      ? ["Sale ID", "Date", "Customer", "Type", "Items", "Subtotal", "Discount", "Grand Total"]
      : activeTab === "purchases"
      ? ["Purchase ID", "Date", "Supplier", "Items", "Total", "Status", "Bill No."]
      : activeTab === "expenses"
      ? ["Expense ID", "Date", "Title", "Head", "Amount", "Method"]
      : ["Log ID", "Product ID", "Type", "Qty Change", "Reason", "Date"];

    const rows = activeTab === "sales"
      ? filteredSales.map((s) => [s.id, formatDate(s.saleDate), s.customer?.name || "", s.saleType, String(s.items?.length || 0), formatNumber(s.totalAmount), formatNumber(s.discountAmount || 0), formatNumber(s.finalAmount)])
      : activeTab === "purchases"
      ? filteredPurchases.map((p) => [p.id, formatDate(p.purchaseDate), p.supplierName, String(p.items?.length || 0), formatNumber(p.totalAmount), p.paymentStatus, p.billNo || ""])
      : activeTab === "expenses"
      ? filteredExpenses.map((e) => [e.id, formatDate(e.date), e.title, e.head, formatNumber(e.amount), e.paymentMethod])
      : filteredLogs.map((l) => [l.id, l.productId, l.changeType, String(l.quantityChange), l.reason, formatDate(l.createdAt)]);

    const styles = StyleSheet.create({
      page: { padding: 30, fontSize: 8, fontFamily: "Helvetica" },
      header: { fontSize: 14, marginBottom: 4, fontWeight: "bold" },
      subheader: { fontSize: 9, marginBottom: 12, color: "#666" },
      table: { width: "100%" },
      row: { flexDirection: "row", borderBottom: "1 solid #ddd", py: 3 },
      headerRow: { flexDirection: "row", borderBottom: "1 solid #333", py: 3, fontWeight: "bold" },
      cell: { flex: 1, px: 2 },
      footer: { marginTop: 16, fontSize: 7, color: "#999" },
    });

    const Doc = () => (
      <Document>
        <Page size="A4" orientation="landscape" style={styles.page}>
          <Text style={styles.header}>{settings.shopName} - {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report</Text>
          <Text style={styles.subheader}>Period: {dateFrom} to {dateTo}</Text>
          <View style={styles.table}>
            <View style={styles.headerRow}>
              {cols.map((c, i) => <Text key={i} style={styles.cell}>{c}</Text>)}
            </View>
            {rows.map((r, ri) => (
              <View key={ri} style={styles.row}>
                {r.map((v, ci) => <Text key={ci} style={styles.cell}>{v}</Text>)}
              </View>
            ))}
          </View>
          <Text style={styles.footer}>{reportFooter}</Text>
        </Page>
      </Document>
    );

    const blob = await pdf(<Doc />).toBlob();
    downloadBlob(blob, `${activeTab}-report-${dateFrom}-to-${dateTo}.pdf`);
  };

  // ── Summary totals ──
  const salesTotal = filteredSales.reduce((s, x) => s + (x.finalAmount || 0), 0);
  const purchasesTotal = filteredPurchases.reduce((s, x) => s + (x.totalAmount || 0), 0);
  const expensesTotal = filteredExpenses.reduce((s, x) => s + (x.amount || 0), 0);

  const TabButton = ({ tab, label }: { tab: ReportTab; label: string }) => (
    <button onClick={() => { setActiveTab(tab); setSearch(""); }}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
        activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-secondary hover:bg-muted/80"
      }`}>
      {label}
    </button>
  );

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-secondary">Reports</h1>
          <div className="flex items-center gap-2">
            <Button onClick={exportCSV} variant="outline" size="sm"><FileDown className="h-4 w-4 mr-1" /> CSV</Button>
            <Button onClick={exportPDF} variant="outline" size="sm"><FileText className="h-4 w-4 mr-1" /> PDF</Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          <TabButton tab="sales" label="Sales" />
          <TabButton tab="purchases" label="Purchases" />
          <TabButton tab="expenses" label="Expenses" />
          <TabButton tab="inventory" label="Inventory" />
          <TabButton tab="trial" label="Trial Balance" />
          <TabButton tab="aging" label="Aging" />
          <TabButton tab="inventory-aging" label="Inv. Aging" />
          <TabButton tab="inventory-turnover" label="Inv. Turnover" />
        </div>

        {/* Filters */}
        {!["trial", "aging", "inventory-aging"].includes(activeTab) && (
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm" />
            </div>
          </div>
        )}

        {/* Summary */}
        {!["trial", "aging", "inventory-aging"].includes(activeTab) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {activeTab === "sales" && <SummaryCard label="Total Sales" value={formatNumber(salesTotal)} count={`${filteredSales.length} transactions`} />}
            {activeTab === "purchases" && <SummaryCard label="Total Purchases" value={formatNumber(purchasesTotal)} count={`${filteredPurchases.length} transactions`} />}
            {activeTab === "expenses" && <SummaryCard label="Total Expenses" value={formatNumber(expensesTotal)} count={`${filteredExpenses.length} transactions`} />}
            {activeTab === "inventory" && <SummaryCard label="Total Changes" value={`${filteredLogs.length}`} count={`${filteredLogs.reduce((s, l) => s + Math.abs(l.quantityChange), 0)} units moved`} />}
          </div>
        )}

        {/* Report Header */}
        {activeTab !== "inventory-aging" && (
          <div className="text-xs text-muted-foreground italic">
            Report Period: {dateFrom} to {dateTo}
          </div>
        )}

        {/* Table */}
        {activeTab === "sales" && (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Sale ID</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium text-right">Items</th>
                  <th className="px-4 py-3 font-medium text-right">Subtotal</th>
                  <th className="px-4 py-3 font-medium text-right">Discount</th>
                  <th className="px-4 py-3 font-medium text-right">Grand Total</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {filteredSales.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">No sales in this period</td></tr>
                  ) : filteredSales.map((s) => (
                    <tr key={s.id} onClick={() => setDetailSale(s)} className="hover:bg-muted/50 cursor-pointer transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs">{s.id?.slice(0, 8)}</td>
                      <td className="px-4 py-2.5">{formatDate(s.saleDate)}</td>
                      <td className="px-4 py-2.5">{s.customer?.name || <span className="text-muted-foreground italic">Walk-in</span>}</td>
                      <td className="px-4 py-2.5 capitalize">{s.saleType}</td>
                      <td className="px-4 py-2.5 text-right">{s.items?.length || 0}</td>
                      <td className="px-4 py-2.5 text-right">{formatNumber(s.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-red-500">{s.discountAmount ? formatNumber(s.discountAmount) : "-"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatNumber(s.finalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "purchases" && (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Purchase ID</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium text-right">Items</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Bill No.</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {filteredPurchases.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">No purchases in this period</td></tr>
                  ) : filteredPurchases.map((p) => (
                    <tr key={p.id} onClick={() => setDetailPurchase(p)} className="hover:bg-muted/50 cursor-pointer transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs">{p.id?.slice(0, 8)}</td>
                      <td className="px-4 py-2.5">{formatDate(p.purchaseDate)}</td>
                      <td className="px-4 py-2.5">{p.supplierName}</td>
                      <td className="px-4 py-2.5 text-right">{p.items?.length || 0}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatNumber(p.totalAmount)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={p.paymentStatus} /></td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.billNo || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "expenses" && (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Expense ID</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Head</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Payment Method</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {filteredExpenses.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No expenses in this period</td></tr>
                  ) : filteredExpenses.map((e) => (
                    <tr key={e.id} onClick={() => setDetailExpense(e)} className="hover:bg-muted/50 cursor-pointer transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs">{e.id?.slice(0, 8)}</td>
                      <td className="px-4 py-2.5">{formatDate(e.date)}</td>
                      <td className="px-4 py-2.5 font-medium">{e.title}</td>
                      <td className="px-4 py-2.5">{e.head}{e.customHead ? ` (${e.customHead})` : ""}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatNumber(e.amount)}</td>
                      <td className="px-4 py-2.5 capitalize">{e.paymentMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Log ID</th>
                  <th className="px-4 py-3 font-medium">Product ID</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium text-right">Qty Change</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {filteredLogs.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No inventory changes in this period</td></tr>
                  ) : filteredLogs.map((l) => (
                    <tr key={l.id} onClick={() => setDetailLog(l)} className="hover:bg-muted/50 cursor-pointer transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs">{l.id?.slice(0, 8)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{l.productId?.slice(0, 8)}</td>
                      <td className="px-4 py-2.5 capitalize">{l.changeType}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${l.quantityChange > 0 ? "text-green-600" : "text-red-600"}`}>
                        {l.quantityChange > 0 ? "+" : ""}{l.quantityChange}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">{l.reason}</td>
                      <td className="px-4 py-2.5">{formatDate(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "trial" && <FinancialReportSection type="trial" user={user} />}
        {activeTab === "aging" && <FinancialReportSection type="aging" user={user} />}
        {activeTab === "inventory-aging" && <InventoryAgingSection products={products} fifoLayers={fifoLayers} categories={categories} settings={settings} />}
        {activeTab === "inventory-turnover" && <InventoryTurnoverSection products={products} sales={sales} categories={categories} fromMs={fromMs} toMs={toMs} settings={settings} />}

        {/* Report Footer */}
        <div className="text-[11px] text-muted-foreground border-t border-border pt-3">
          {reportFooter}
        </div>

        {/* ── Detail Modals ── */}
        {detailSale && (
          <DetailModal title="Sale Details" onClose={() => setDetailSale(null)}>
            <div className="space-y-3 text-sm">
              <Row label="Sale ID" value={detailSale.id} />
              <Row label="Date" value={formatDateTime(detailSale.saleDate)} />
              <Row label="Type" value={detailSale.saleType} />
              <Row label="Customer" value={detailSale.customer?.name || "Walk-in"} />
              <Row label="Phone" value={detailSale.customer?.phone || "-"} />
              <Row label="Items Count" value={String(detailSale.items?.length || 0)} />
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Items</p>
                <div className="bg-muted/50 rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                  {detailSale.items?.map((item, i) => (
                    <p key={i} className="text-xs">{item.quantity}x {item.productName} @ Rs.{formatNumber(item.unitPrice)} = Rs.{formatNumber(item.subtotal)}</p>
                  ))}
                </div>
              </div>
              <Row label="Subtotal" value={`Rs. ${formatNumber(detailSale.totalAmount)}`} />
              {detailSale.discountAmount > 0 && <Row label="Discount" value={`-Rs. ${formatNumber(detailSale.discountAmount)}`} />}
              <Row label="Grand Total" value={`Rs. ${formatNumber(detailSale.finalAmount)}`} bold />
              <Row label="Payment" value={`${detailSale.payment?.method} (Received: Rs. ${formatNumber(detailSale.payment?.receivedAmount || 0)})`} />
              {detailSale.payment?.balanceDue > 0 && <Row label="Balance Due" value={`Rs. ${formatNumber(detailSale.payment.balanceDue)}`} />}
              {detailSale.couponIssued && <Row label="Coupon Issued" value={`${detailSale.couponIssued.code} (${detailSale.couponIssued.discountValue})`} />}
              <Row label="Recorded By" value={detailSale.recordedByName || detailSale.recordedBy} />
              {detailSale.notes && <Row label="Notes" value={detailSale.notes} />}
            </div>
          </DetailModal>
        )}

        {detailPurchase && (
          <DetailModal title="Purchase Details" onClose={() => setDetailPurchase(null)}>
            <div className="space-y-3 text-sm">
              <Row label="Purchase ID" value={detailPurchase.id} />
              <Row label="Date" value={formatDateTime(detailPurchase.purchaseDate)} />
              <Row label="Supplier" value={detailPurchase.supplierName} />
              <Row label="Phone" value={detailPurchase.supplierPhone || "-"} />
              <Row label="Bill No." value={detailPurchase.billNo || "-"} />
              {detailPurchase.billImageUrl && <Row label="Bill Image" value={<a href={detailPurchase.billImageUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">View</a>} />}
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Items</p>
                <div className="bg-muted/50 rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                  {detailPurchase.items?.map((item, i) => (
                    <p key={i} className="text-xs">{item.quantity}x {item.productName} @ Rs.{formatNumber(item.unitCost)} = Rs.{formatNumber(item.subtotal)}</p>
                  ))}
                </div>
              </div>
              <Row label="Total Amount" value={`Rs. ${formatNumber(detailPurchase.totalAmount)}`} bold />
              <Row label="Payment Status" value={detailPurchase.paymentStatus} />
              {(detailPurchase.paidAmount ?? 0) > 0 && <Row label="Paid Amount" value={`Rs. ${formatNumber(detailPurchase.paidAmount ?? 0)}`} />}
              {(detailPurchase.discountAmount ?? 0) > 0 && <Row label="Discount" value={`-Rs. ${formatNumber(detailPurchase.discountAmount ?? 0)}`} />}
              <Row label="Recorded By" value={detailPurchase.recordedByName || detailPurchase.recordedBy} />
              {detailPurchase.notes && <Row label="Notes" value={detailPurchase.notes} />}
            </div>
          </DetailModal>
        )}

        {detailExpense && (
          <DetailModal title="Expense Details" onClose={() => setDetailExpense(null)}>
            <div className="space-y-3 text-sm">
              <Row label="Expense ID" value={detailExpense.id} />
              <Row label="Date" value={formatDateTime(detailExpense.date)} />
              <Row label="Title" value={detailExpense.title} />
              <Row label="Head" value={detailExpense.head + (detailExpense.customHead ? ` (${detailExpense.customHead})` : "")} />
              <Row label="Amount" value={`Rs. ${formatNumber(detailExpense.amount)}`} bold />
              <Row label="Payment Method" value={detailExpense.paymentMethod} />
              {detailExpense.description && <Row label="Description" value={detailExpense.description} />}
              {detailExpense.receiptUrl && <Row label="Receipt" value={<a href={detailExpense.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">View</a>} />}
              <Row label="Recorded By" value={detailExpense.recordedBy} />
            </div>
          </DetailModal>
        )}

        {detailLog && (
          <DetailModal title="Inventory Log Details" onClose={() => setDetailLog(null)}>
            <div className="space-y-3 text-sm">
              <Row label="Log ID" value={detailLog.id} />
              <Row label="Product ID" value={detailLog.productId} />
              <Row label="Change Type" value={detailLog.changeType} />
              <Row label="Quantity Change" value={`${detailLog.quantityChange > 0 ? "+" : ""}${detailLog.quantityChange}`} />
              <Row label="Reason" value={detailLog.reason} />
              <Row label="Date" value={formatDateTime(detailLog.createdAt)} />
              <Row label="Performed By" value={detailLog.performedBy} />
            </div>
          </DetailModal>
        )}
      </div>
    </AdminLayout>
  );
}

// ── Sub-components ──

function FinancialReportSection({ type, user }: { type: string; user: any }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gasUrl, setGasUrl] = useState<string>("");
  const [detailRow, setDetailRow] = useState<any>(null);

  useEffect(() => {
    getDoc(doc(db, "shop_settings", "emailBackupConfig")).then((snap) => {
      if (snap.exists()) setGasUrl((snap.data() as any).gasWebhookUrl || "");
    });
  }, []);

  useEffect(() => {
    if (!gasUrl) { setError("GAS Webhook URL not configured in Settings"); return; }
    setLoading(true);
    setError(null);
    setData(null);
    const actionMap: Record<string, string> = {
      trial: "computeTrialBalance", aging: "computeAgedReceivables",
    };
    const action = actionMap[type];
    if (!action) { setLoading(false); return; }
    fetch(gasUrl, {
      method: "POST",
      body: JSON.stringify({ action, start: "1970-01-01", end: new Date().toISOString().slice(0, 10) }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return res.json();
      })
      .then((result) => { setData(result); setLoading(false); })
      .catch((e) => { console.error("Financial report fetch failed:", e); setError(e?.message || "Unknown error"); setLoading(false); });
  }, [type, gasUrl]);

  const exportFinancialCSV = () => {
    if (!data) return;
    const headers = data.headers || Object.keys(data.data?.[0] || {});
    const rows = (data.data || []).map((row: any) => headers.map((h: string) => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(","));
    const csv = `${headers.join(",")}\n${rows.join("\n")}`;
    downloadBlob(new Blob([csv], { type: "text/csv" }), `${type}-report.csv`);
  };

  const exportFinancialPDF = async () => {
    if (!data) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF("landscape", "mm", "a4");
    doc.setFontSize(14);
    doc.text(`${type.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())} Report`, 14, 20);
    doc.setFontSize(8);
    doc.text(`Generated by ${user?.displayName || user?.email || "Unknown"} | ${new Date().toLocaleString()}`, 14, 26);
    const headers = data.headers || Object.keys(data.data?.[0] || {});
    const rows = (data.data || []).map((row: any) => headers.map((h: string) => String(row[h] || "")));
    autoTable(doc, { head: [headers], body: rows, startY: 30, styles: { fontSize: 7 }, theme: "striped" });
    doc.save(`${type}-report.pdf`);
  };

  if (loading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading report...</p>;
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <p className="text-sm text-red-700 font-medium">Report fetch failed</p>
      <p className="text-xs text-red-600 mt-1">{error}</p>
      <p className="text-xs text-muted-foreground mt-2">Webhook URL: {gasUrl || "—"}</p>
      <p className="text-xs text-muted-foreground">Ensure your GAS script is deployed with the required actions.</p>
    </div>
  );
  if (!data) return <p className="text-sm text-muted-foreground py-8 text-center">No data available.</p>;

  const headers = data.headers || Object.keys(data.data?.[0] || []);
  const rows = data.data || [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Button onClick={exportFinancialCSV} variant="outline" size="sm"><FileDown className="h-4 w-4 mr-1" /> CSV</Button>
        <Button onClick={exportFinancialPDF} variant="outline" size="sm"><FileText className="h-4 w-4 mr-1" /> PDF</Button>
      </div>
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-left text-xs text-muted-foreground">
                {headers.map((h: string) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-muted-foreground">No data</td></tr>
              ) : rows.map((row: any, i: number) => (
                <tr key={i} onClick={() => setDetailRow(row)} className="hover:bg-muted/30 cursor-pointer transition-colors">
                  {headers.map((h: string) => (
                    <td key={h} className="px-4 py-2">{row[h] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {detailRow && (
        <DetailModal title={`${type === "trial" ? "Trial Balance" : "Aging"} - Row Details`} onClose={() => setDetailRow(null)}>
          <div className="space-y-2 text-sm">
            {headers.map((h: string) => (
              <div key={h} className="flex justify-between items-start py-1 border-b border-border last:border-0">
                <span className="text-muted-foreground text-xs shrink-0 mr-4">{h}</span>
                <span className="text-right text-secondary font-medium">{detailRow[h] ?? ""}</span>
              </div>
            ))}
          </div>
        </DetailModal>
      )}
    </div>
  );
}

function InventoryAgingSection({
  products, fifoLayers, categories, settings,
}: {
  products: Product[] | null; fifoLayers: FifoLayer[] | null; categories: Category[] | null; settings: any;
}) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortCol, setSortCol] = useState<string>("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const activeLayers = useMemo(() => {
    if (!fifoLayers) return [];
    return fifoLayers.filter((l) => (l.remainingQty as number) > 0);
  }, [fifoLayers]);

  const catMap = useMemo(() => {
    const m: Record<string, string> = {};
    if (categories) categories.forEach((c) => { m[c.id || ""] = c.name; });
    return m;
  }, [categories]);

  const productMap = useMemo(() => {
    const m: Record<string, Product> = {};
    if (products) products.forEach((p) => { m[p.id] = p; });
    return m;
  }, [products]);

  const agingRows = useMemo(() => {
    const now = Date.now();
    const layerByProduct: Record<string, FifoLayer[]> = {};
    activeLayers.forEach((l) => {
      if (!layerByProduct[l.productId]) layerByProduct[l.productId] = [];
      layerByProduct[l.productId].push(l);
    });

    return Object.entries(layerByProduct).map(([productId, layers]) => {
      const product = productMap[productId];
      if (!product || product.quantityInStock <= 0) return null;

      const buckets = [0, 0, 0, 0, 0, 0]; // 0-30, 31-60, 61-90, 91-180, 180+
      const bucketVals = [0, 0, 0, 0, 0, 0];
      let totalQty = 0;
      let totalVal = 0;

      layers.forEach((l) => {
        const ageDays = (now - (l.purchaseDate as number)) / 86400000;
        const qty = l.remainingQty as number;
        const val = qty * (l.unitCost as number);
        totalQty += qty;
        totalVal += val;

        if (ageDays <= 30) { buckets[0] += qty; bucketVals[0] += val; }
        else if (ageDays <= 60) { buckets[1] += qty; bucketVals[1] += val; }
        else if (ageDays <= 90) { buckets[2] += qty; bucketVals[2] += val; }
        else if (ageDays <= 180) { buckets[3] += qty; bucketVals[3] += val; }
        else { buckets[4] += qty; bucketVals[4] += val; }
      });

      return {
        productId, name: product.name, sku: product.sku, categoryId: product.categoryId,
        categoryName: catMap[product.categoryId] || product.categoryId?.slice(0, 8) || "—",
        totalQty, totalVal, buckets, bucketVals,
      };
    }).filter(Boolean) as { productId: string; name: string; sku: string; categoryId: string; categoryName: string; totalQty: number; totalVal: number; buckets: number[]; bucketVals: number[] }[];
  }, [activeLayers, productMap, catMap]);

  const sortedRows = useMemo(() => {
    const filtered = categoryFilter === "all" ? agingRows : agingRows.filter((r) => r.categoryId === categoryFilter);
    return [...filtered].sort((a, b) => {
      const av = sortCol === "name" ? a.name : sortCol === "qty" ? a.totalQty : a.totalVal;
      const bv = sortCol === "name" ? b.name : sortCol === "qty" ? b.totalQty : b.totalVal;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [agingRows, categoryFilter, sortCol, sortDir]);

  const totals = useMemo(() => {
    return sortedRows.reduce(
      (s, r) => ({
        qty: s.qty + r.totalQty,
        val: s.val + r.totalVal,
        b0: s.b0 + r.buckets[0], b1: s.b1 + r.buckets[1], b2: s.b2 + r.buckets[2], b3: s.b3 + r.buckets[3], b4: s.b4 + r.buckets[4],
      }),
      { qty: 0, val: 0, b0: 0, b1: 0, b2: 0, b3: 0, b4: 0 },
    );
  }, [sortedRows]);

  const uniqueCategories = useMemo(() => {
    const ids = new Set(agingRows.map((r) => r.categoryId));
    return [...ids].map((id) => ({ id, name: catMap[id] || id?.slice(0, 8) || "—" })).sort((a, b) => a.name.localeCompare(b.name));
  }, [agingRows, catMap]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir(col === "name" ? "asc" : "desc"); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  if (!products || !fifoLayers) return <p className="text-sm text-muted-foreground py-8 text-center">Loading inventory data...</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Products in Stock" value={String(agingRows.length)} count="with active stock" />
        <SummaryCard label="Total Units" value={formatNumber(totals.qty)} count="items in stock" />
        <SummaryCard label="Stock Value (Cost)" value={`Rs. ${formatNumber(totals.val)}`} count="at purchase cost" />
        <SummaryCard label="Categories" value={String(uniqueCategories.length)} count="" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setCategoryFilter("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${categoryFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-secondary hover:bg-muted/80"}`}>
          All Categories
        </button>
        {uniqueCategories.map((c) => (
          <button key={c.id} onClick={() => setCategoryFilter(c.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${categoryFilter === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-secondary hover:bg-muted/80"}`}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-left text-xs text-muted-foreground">
                <th className="px-3 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort("name")}>Product<SortIcon col="name" /></th>
                <th className="px-3 py-3 font-medium">SKU</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("qty")}>Qty<SortIcon col="qty" /></th>
                <th className="px-3 py-3 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("value")}>Value<SortIcon col="value" /></th>
                <th className="px-3 py-3 font-medium text-right">0–30d</th>
                <th className="px-3 py-3 font-medium text-right">31–60d</th>
                <th className="px-3 py-3 font-medium text-right">61–90d</th>
                <th className="px-3 py-3 font-medium text-right">91–180d</th>
                <th className="px-3 py-3 font-medium text-right">180d+</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedRows.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground text-sm">No products with active stock</td></tr>
              ) : sortedRows.map((r) => (
                <tr key={r.productId} className="hover:bg-muted/50 transition-colors">
                  <td className="px-3 py-2.5 font-medium max-w-[180px] truncate" title={r.name}>{r.name}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{r.sku}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.categoryName}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{formatNumber(r.totalQty)}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{formatNumber(r.totalVal)}</td>
                  {r.buckets.map((b, i) => (
                    <td key={i} className={`px-3 py-2.5 text-right ${b > 0 && i >= 3 ? "text-red-600 font-medium" : ""}`}>
                      {b > 0 ? formatNumber(b) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
              {sortedRows.length > 0 && (
                <tr className="bg-muted/30 font-semibold text-xs">
                  <td className="px-3 py-3" colSpan={3}>Total ({sortedRows.length} products)</td>
                  <td className="px-3 py-3 text-right">{formatNumber(totals.qty)}</td>
                  <td className="px-3 py-3 text-right">{formatNumber(totals.val)}</td>
                  <td className="px-3 py-3 text-right">{totals.b0 > 0 ? formatNumber(totals.b0) : "—"}</td>
                  <td className="px-3 py-3 text-right">{totals.b1 > 0 ? formatNumber(totals.b1) : "—"}</td>
                  <td className="px-3 py-3 text-right">{totals.b2 > 0 ? formatNumber(totals.b2) : "—"}</td>
                  <td className="px-3 py-3 text-right">{totals.b3 > 0 ? formatNumber(totals.b3) : "—"}</td>
                  <td className="px-3 py-3 text-right">{totals.b4 > 0 ? formatNumber(totals.b4) : "—"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InventoryTurnoverSection({
  products, sales, categories, fromMs, toMs, settings,
}: {
  products: Product[] | null; sales: Sale[] | null; categories: Category[] | null; fromMs: number; toMs: number; settings: any;
}) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortCol, setSortCol] = useState("ratio");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const catMap = useMemo(() => {
    const m: Record<string, string> = {};
    if (categories) categories.forEach((c) => { m[c.id || ""] = c.name; });
    return m;
  }, [categories]);

  const turnoverRows = useMemo(() => {
    if (!products || !sales) return [];

    const productMap: Record<string, Product> = {};
    products.forEach((p) => { productMap[p.id] = p; });

    const salesInRange = sales.filter((s) => {
      const d = new Date((s.saleDate as any)?.seconds ? (s.saleDate as any).seconds * 1000 : (s.saleDate as number)).getTime();
      return d >= fromMs && d < toMs;
    });

    const unitsSold: Record<string, number> = {};
    const cogsTotal: Record<string, number> = {};

    salesInRange.forEach((s) => {
      (s.items || []).forEach((item) => {
        const pid = item.productId;
        if (!pid) return;
        unitsSold[pid] = (unitsSold[pid] || 0) + item.quantity;
        cogsTotal[pid] = (cogsTotal[pid] || 0) + (item.costPriceAtSale || 0) * item.quantity;
      });
    });

    const allPids = new Set([...Object.keys(unitsSold), ...products.filter((p) => p.quantityInStock > 0).map((p) => p.id)]);
    const rows = [...allPids].map((pid) => {
      const product = productMap[pid];
      if (!product) return null;
      const sold = unitsSold[pid] || 0;
      const cogs = cogsTotal[pid] || 0;
      const stock = product.quantityInStock || 0;
      const rangeDays = Math.max(1, (toMs - fromMs) / 86400000);
      const ratio = stock > 0 ? sold / stock : (sold > 0 ? 99 : 0);
      const daysToSell = ratio > 0 ? Math.round(rangeDays / ratio) : 999;

      return {
        productId: pid, name: product.name, sku: product.sku, categoryId: product.categoryId,
        categoryName: catMap[product.categoryId] || product.categoryId?.slice(0, 8) || "—",
        unitsSold: sold, cogs, currentStock: stock, turnoverRatio: ratio, daysToSell,
      };
    }).filter(Boolean) as { productId: string; name: string; sku: string; categoryId: string; categoryName: string; unitsSold: number; cogs: number; currentStock: number; turnoverRatio: number; daysToSell: number }[];

    return rows;
  }, [products, sales, fromMs, toMs, catMap]);

  const sortedRows = useMemo(() => {
    const filtered = categoryFilter === "all" ? turnoverRows : turnoverRows.filter((r) => r.categoryId === categoryFilter);
    return [...filtered].sort((a, b) => {
      const av = sortCol === "name" ? a.name : sortCol === "sold" ? a.unitsSold : sortCol === "stock" ? a.currentStock : sortCol === "days" ? a.daysToSell : a.turnoverRatio;
      const bv = sortCol === "name" ? b.name : sortCol === "sold" ? b.unitsSold : sortCol === "stock" ? b.currentStock : sortCol === "days" ? b.daysToSell : b.turnoverRatio;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [turnoverRows, categoryFilter, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir(col === "name" ? "asc" : "desc"); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  const uniqueCategories = useMemo(() => {
    const ids = new Set(turnoverRows.map((r) => r.categoryId));
    return [...ids].map((id) => ({ id, name: catMap[id] || id?.slice(0, 8) || "—" })).sort((a, b) => a.name.localeCompare(b.name));
  }, [turnoverRows, catMap]);

  if (!products || !sales) return <p className="text-sm text-muted-foreground py-8 text-center">Loading turnover data...</p>;

  const fastMovers = sortedRows.filter((r) => r.turnoverRatio > 2).length;
  const slowMovers = sortedRows.filter((r) => r.turnoverRatio > 0 && r.turnoverRatio < 0.5).length;
  const noSales = sortedRows.filter((r) => r.unitsSold === 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Products Tracked" value={String(turnoverRows.length)} count="" />
        <SummaryCard label="Fast Movers (Ratio > 2)" value={String(fastMovers)} count="selling quickly" />
        <SummaryCard label="Slow Movers (Ratio < 0.5)" value={String(slowMovers)} count="selling slowly" />
        <SummaryCard label="No Sales in Period" value={String(noSales)} count="zero units sold" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setCategoryFilter("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${categoryFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-secondary hover:bg-muted/80"}`}>
          All Categories
        </button>
        {uniqueCategories.map((c) => (
          <button key={c.id} onClick={() => setCategoryFilter(c.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${categoryFilter === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-secondary hover:bg-muted/80"}`}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-left text-xs text-muted-foreground">
                <th className="px-3 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort("name")}>Product<SortIcon col="name" /></th>
                <th className="px-3 py-3 font-medium">SKU</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("sold")}>Sold<SortIcon col="sold" /></th>
                <th className="px-3 py-3 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("stock")}>In Stock<SortIcon col="stock" /></th>
                <th className="px-3 py-3 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("ratio")}>Ratio<SortIcon col="ratio" /></th>
                <th className="px-3 py-3 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("days")}>Days to Sell<SortIcon col="days" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedRows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">No data in this period</td></tr>
              ) : sortedRows.slice(0, 200).map((r) => (
                <tr key={r.productId} className="hover:bg-muted/50 transition-colors">
                  <td className="px-3 py-2.5 font-medium max-w-[180px] truncate" title={r.name}>{r.name}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{r.sku}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.categoryName}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${r.unitsSold > 0 ? "text-green-700" : "text-muted-foreground"}`}>
                    {r.unitsSold > 0 ? formatNumber(r.unitsSold) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">{formatNumber(r.currentStock)}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${r.turnoverRatio > 2 ? "text-green-700" : r.turnoverRatio < 0.5 && r.turnoverRatio > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                    {r.unitsSold > 0 ? r.turnoverRatio.toFixed(2) : "—"}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-medium ${r.daysToSell <= 90 ? "text-green-700" : r.daysToSell >= 365 ? "text-red-600" : ""}`}>
                    {r.daysToSell < 999 ? `${r.daysToSell}d` : "—"}
                  </td>
                </tr>
              ))}
              {sortedRows.length > 200 && (
                <tr><td colSpan={7} className="px-4 py-3 text-center text-xs text-muted-foreground">Showing top 200 of {sortedRows.length} products. Use category filter to narrow.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, count }: { label: string; value: string; count: string }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-secondary mt-1">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{count}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    unpaid: "bg-red-100 text-red-700",
    partially_paid: "bg-yellow-100 text-yellow-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${colors[status] || "bg-gray-100 text-gray-700"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-muted-foreground text-xs shrink-0 mr-4">{label}</span>
      <span className={`text-right ${bold ? "font-bold text-secondary" : "text-secondary"}`}>{value}</span>
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
