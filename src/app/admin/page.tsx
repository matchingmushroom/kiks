"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { Sale, Product, Debtor, Order, Category, AccountTransaction, Purchase } from "@/types";
import { formatCurrency, formatNumber, toDate } from "@/lib/utils";
import { getFiscalYearStartEpoch } from "@/lib/nepaliDate";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import {
  Users, Package, Wallet, AlertTriangle, TrendingUp, PieChart,
  BarChart3, ShoppingCart, Clock, RefreshCw, X, DollarSign, Landmark, CreditCard, FileDown, Search,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell,
  BarChart, Bar,
} from "recharts";

const COLORS = ["#b8860b", "#d4a853", "#1a1a2e", "#e2a63b", "#f5d78e", "#8b6914", "#c49a3a"];

function getLast30Days() {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default function AdminDashboardPage() {
  const { profile } = useAuth();
  const { settings } = useShopSettings();
  const [showTodaySales, setShowTodaySales] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDebtorModal, setShowDebtorModal] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [detailCashSale, setDetailCashSale] = useState<Sale | null>(null);
  const [detailQrSale, setDetailQrSale] = useState<Sale | null>(null);
  const [detailDebtorSale, setDetailDebtorSale] = useState<Sale | null>(null);
  const [detailPayment, setDetailPayment] = useState<AccountTransaction | null>(null);
  const useBs = !!settings.useBsCalendar;
  const { data: sales } = useFirestore<Sale>("sales", {
    constraints: [orderBy("saleDate", "desc"), limit(200)],
    realtime: true, cache: false,
  });
  const { data: products } = useFirestore<Product>("products", {
    constraints: [orderBy("name", "asc"), limit(200)],
    realtime: false, cache: true,
  });
  const { data: orders } = useFirestore<Order>("orders", {
    constraints: [orderBy("createdAt", "desc"), limit(50)],
    realtime: false, cache: true,
  });
  const { data: categories } = useFirestore<Category>("categories", {
    constraints: [limit(50)],
    realtime: false, cache: true,
  });
  const { data: debtors } = useFirestore<Debtor>("debtors", {
    constraints: [orderBy("balanceDue", "desc"), limit(50)],
    realtime: false, cache: true,
  });
  const { data: transactions } = useFirestore<AccountTransaction>("accountTransactions", {
    constraints: [orderBy("date", "desc"), limit(200)],
    realtime: false, cache: true,
  });

  const { data: purchases } = useFirestore<Purchase>("purchases", {
    constraints: [orderBy("purchaseDate", "desc"), limit(500)],
    realtime: false, cache: true,
  });

  const [skuSearch, setSkuSearch] = useState("");
  const [skuResult, setSkuResult] = useState<{
    product: Product; purchase: Purchase | null;
  } | null>(null);

  const handleSkuSearch = () => {
    const p = products.find((x) => x.sku === skuSearch.trim());
    if (!p) { setSkuResult(null); return; }
    const pc = purchases.find((x) => x.items.some((i) => i.productId === p.id));
    setSkuResult({ product: p, purchase: pc || null });
  };

  const currentUserName = profile?.displayName || "";
  const [openingCash, setOpeningCash] = useState(0);
  const [openingBank, setOpeningBank] = useState(0);
  const isStaff = profile?.role === "staff";
  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    getDoc(doc(db, "dailyBalances", todayKey)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setOpeningCash(d.cash || 0);
        setOpeningBank(d.bank || 0);
      }
    }).catch(() => {});
  }, []);
  const mySales = isStaff ? sales.filter((s) => s.recordedBy === profile?.uid) : sales;
  const myOrders = isStaff ? orders.filter((o) => o.processedBy === profile?.uid) : orders;

  const totalSales = sales.reduce((sum, s) => sum + s.finalAmount, 0);
  const lowStockItems = products.filter((p) => p.quantityInStock > 0 && p.quantityInStock <= 3);
  const activeDebtorsList = debtors.filter((d) => d.status === "active");
  const debtorsBalance = activeDebtorsList.reduce((sum, d) => sum + d.balanceDue, 0);

  const last30 = getLast30Days();
  const safeDate = (d: unknown) => {
    try {
      let ms = 0;
      if (typeof (d as any)?.toMillis === "function") ms = (d as any).toMillis();
      else if (typeof (d as any)?.getTime === "function") ms = (d as any).getTime();
      else ms = Number(d as any) || 0;
      return new Date(ms).toISOString().slice(0, 10);
    } catch { return ""; }
  };

  const now = new Date();
  const ytdStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const ytdSales = mySales
    .filter((s) => safeDate(s.saleDate) >= ytdStart)
    .reduce((sum, s) => sum + s.finalAmount, 0);
  const mtdSales = mySales
    .filter((s) => safeDate(s.saleDate) >= mtdStart)
    .reduce((sum, s) => sum + s.finalAmount, 0);
  const todayStr = now.toISOString().slice(0, 10);
  const todayStart = new Date(todayStr).getTime();
  const todayEnd = todayStart + 86400000;
  const todaySales = mySales.filter((s) => {
    const d = new Date((s.saleDate as any)?.seconds ? (s.saleDate as any).seconds * 1000 : (s.saleDate as number)).getTime();
    return d >= todayStart && d < todayEnd;
  });
  const todayCashSales = todaySales.filter((s) => s.payment?.method === "cash");
  const todayQrSales = todaySales.filter((s) => s.payment?.method === "qr" || s.payment?.method === "bank_transfer");
  const todayDebtorSales = todaySales.filter((s) => s.saleType === "credit" || s.saleType === "partial");
  const todayTotal = todaySales.reduce((s, x) => s + x.finalAmount, 0);
  const todayCash = todaySales.filter((s) => s.payment?.method === "cash").reduce((s, x) => s + (x.payment?.receivedAmount || 0), 0);
  const todayQrBank = todaySales.filter((s) => s.payment?.method === "qr" || s.payment?.method === "bank_transfer").reduce((s, x) => s + (x.payment?.receivedAmount || 0), 0);
  const todayDebtor = todaySales.filter((s) => s.saleType === "credit" || s.saleType === "partial").reduce((s, x) => s + (x.payment?.balanceDue || 0), 0);
  const myTransactions = isStaff ? (transactions || []).filter((t) => t.recordedBy === profile?.uid) : (transactions || []);
  const todayFilter = (t: AccountTransaction) => {
    const d = new Date((t.date as any)?.seconds ? (t.date as any).seconds * 1000 : (t.date as number)).getTime();
    return d >= todayStart && d < todayEnd;
  };
  const todayCashCredits = myTransactions
    .filter((t) => todayFilter(t) && t.accountId === "cash_in_hand" && t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);
  const todayCashDebits = myTransactions
    .filter((t) => todayFilter(t) && t.accountId === "cash_in_hand" && t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);
  const todayBankCredits = myTransactions
    .filter((t) => todayFilter(t) && t.accountId === "bank_account" && t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);
  const todayBankDebits = myTransactions
    .filter((t) => todayFilter(t) && t.accountId === "bank_account" && t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);
  const todayCashLedger = myTransactions
    .filter((t) => todayFilter(t) && t.accountId === "cash_in_hand")
    .sort((a, b) => {
      const da = (a.date as any)?.seconds ? (a.date as any).seconds * 1000 : (a.date as number);
      const db = (b.date as any)?.seconds ? (b.date as any).seconds * 1000 : (b.date as number);
      return da - db;
    });
  const todayBankLedger = myTransactions
    .filter((t) => todayFilter(t) && t.accountId === "bank_account")
    .sort((a, b) => {
      const da = (a.date as any)?.seconds ? (a.date as any).seconds * 1000 : (a.date as number);
      const db = (b.date as any)?.seconds ? (b.date as any).seconds * 1000 : (b.date as number);
      return da - db;
    });
  const todayPaymentsTotal = todayBankCredits;

  const fytdStart = new Date(getFiscalYearStartEpoch()).toISOString().slice(0, 10);
  const fytdSales = mySales
    .filter((s) => safeDate(s.saleDate) >= fytdStart)
    .reduce((sum, s) => sum + s.finalAmount, 0);
  const fytdDebtors = activeDebtorsList
    .filter((d) => safeDate(d.createdAt) >= fytdStart)
    .reduce((sum, d) => sum + d.balanceDue, 0);
  const fytdActiveDebtors = activeDebtorsList
    .filter((d) => safeDate(d.createdAt) >= fytdStart)
    .length;

  const fytdStats = useBs
    ? [
        { label: "FYTD Sales", value: formatCurrency(fytdSales), icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
        { label: "FYTD Debtors", value: formatCurrency(fytdDebtors), icon: Users, color: "text-rose-600 bg-rose-50" },
        { label: "FYTD Debtors Count", value: String(fytdActiveDebtors), icon: Users, color: "text-teal-600 bg-teal-50" },
      ]
    : [];

  const stats = [
    { label: "YTD Sales", value: formatCurrency(ytdSales), icon: TrendingUp, color: "text-green-600 bg-green-50", fytd: fytdStats[0] },
    { label: "MTD Sales", value: formatCurrency(mtdSales), icon: Wallet, color: "text-blue-600 bg-blue-50", fytd: undefined },
    { label: "Total Sales", value: formatCurrency(totalSales), icon: Package, color: "text-purple-600 bg-purple-50", fytd: undefined },
    { label: "Debtors Balance", value: formatCurrency(debtorsBalance), icon: Users, color: "text-red-600 bg-red-50", fytd: fytdStats[1] },
    { label: "Low Stock Items", value: String(lowStockItems.length), icon: AlertTriangle, color: "text-amber-600 bg-amber-50", fytd: undefined },
    { label: "Active Debtors", value: String(activeDebtorsList.length), icon: Users, color: "text-orange-600 bg-orange-50", fytd: fytdStats[2] },
  ];

  const salesTrend = last30.map((date) => ({
    date: date.slice(5),
    sales: mySales
      .filter((s) => safeDate(s.saleDate) === date)
      .reduce((sum, s) => sum + s.finalAmount, 0),
  }));

  const categoryData = useMemo(() => {
    const prodMap = new Map(products.map((p) => [p.id, p]));
    const nameMap = new Map(products.map((p) => [p.name, p]));
    const catNameMap = new Map(categories.map((c) => [c.id, c.name]));
    const revenue = new Map<string, number>();
    mySales.forEach((s) => {
      (s.items || []).forEach((item) => {
        const prod = prodMap.get(item.productId) || nameMap.get(item.productName);
        if (!prod) return;
        const catName = catNameMap.get(prod.categoryId) || prod.categoryId || "Unknown";
        revenue.set(catName, (revenue.get(catName) || 0) + (item.subtotal || 0));
      });
    });
    return Array.from(revenue.entries()).map(([name, value]) => ({ name, value }));
  }, [mySales, products, categories]);

  const inventoryData = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const stock = new Map<string, number>();
    products.forEach((p) => {
      if (p.isActive) {
        const catName = catMap.get(p.categoryId) || "Uncategorized";
        stock.set(catName, (stock.get(catName) || 0) + p.quantityInStock);
      }
    });
    return Array.from(stock.entries()).map(([name, stock]) => ({ name, stock }));
  }, [products, categories]);

  const productSales = new Map<string, { qty: number; revenue: number }>();
  mySales.forEach((s) => {
    (s.items || []).forEach((item) => {
      const prev = productSales.get(item.productName) || { qty: 0, revenue: 0 };
      productSales.set(item.productName, {
        qty: prev.qty + item.quantity,
        revenue: prev.revenue + (item.subtotal || 0),
      });
    });
  });
  const topProducts = Array.from(productSales.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary mb-1">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {profile?.displayName || "User"}
              {isStaff && <span className="ml-2 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">Showing your data</span>}
            </p>
          </div>
          <button onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 border border-border rounded-lg hover:border-primary">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {/* SKU Search */}
        <div className="bg-white rounded-xl border border-border p-4 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-secondary">SKU Lookup</h2>
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Enter SKU number..." value={skuSearch}
              onChange={(e) => setSkuSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSkuSearch()}
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={handleSkuSearch}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Search</button>
          </div>
          {skuResult && (
            <div className="mt-4 border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Field</th>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr><td className="px-3 py-2 text-muted-foreground">Product Name</td><td className="px-3 py-2 font-medium">{skuResult.product.name}</td></tr>
                  <tr><td className="px-3 py-2 text-muted-foreground">Model No.</td><td className="px-3 py-2">{skuResult.product.modelNo || "—"}</td></tr>
                  <tr><td className="px-3 py-2 text-muted-foreground">SKU</td><td className="px-3 py-2 font-mono">{skuResult.product.sku}</td></tr>
                  <tr><td className="px-3 py-2 text-muted-foreground">Inventory Qty</td><td className="px-3 py-2">{skuResult.product.quantityInStock}</td></tr>
                  <tr><td className="px-3 py-2 text-muted-foreground">Store Cost</td><td className="px-3 py-2">{formatCurrency(Math.ceil((skuResult.product.costPrice || 0) * 1.25 / 10) * 10)}</td></tr>
                  <tr><td className="px-3 py-2 text-muted-foreground">Sale Price</td><td className="px-3 py-2">{formatCurrency(Math.floor((skuResult.product.costPrice || 0) * 1.5))} - {formatCurrency(skuResult.product.price)}</td></tr>
                  <tr><td className="px-3 py-2 text-muted-foreground">Supplier Name</td><td className="px-3 py-2">{skuResult.purchase?.supplierName || "—"}</td></tr>
                  <tr><td className="px-3 py-2 text-muted-foreground">Purchase Date</td><td className="px-3 py-2">{skuResult.purchase?.purchaseDate ? toDate(skuResult.purchase.purchaseDate).toLocaleDateString() : "—"}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {skuSearch && !skuResult && (
            <p className="mt-2 text-sm text-red-500">No product found with SKU "{skuSearch.trim()}"</p>
          )}
        </div>

        {!isStaff && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {stats.flatMap((stat) => {
            const cards: React.ReactNode[] = [];
            const isLink = stat.label === "Low Stock Items" || stat.label === "Active Debtors";
            const href = stat.label === "Low Stock Items" ? "/admin/inventory" : "/admin/debtors";
            const Card = ({ children }: { children: React.ReactNode }) => isLink ? <Link href={href} className="block">{children}</Link> : <>{children}</>;
            cards.push(
              <Card key={stat.label}>
                <div className="bg-white rounded-xl border border-border p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className={`inline-flex p-1.5 rounded-lg ${stat.color} mb-2`}>
                    <stat.icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  <p className="text-sm font-bold text-secondary mt-0.5">{stat.value}</p>
                </div>
              </Card>
            );
            if (stat.fytd) {
              cards.push(
                <div key={stat.label + "-fytd"}>
                  <div className="bg-white rounded-xl border border-border p-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className={`inline-flex p-1.5 rounded-lg ${stat.fytd.color} mb-2`}>
                      <stat.icon className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{stat.fytd.label}</p>
                    <p className="text-sm font-bold text-secondary mt-0.5">{stat.fytd.value}</p>
                  </div>
                </div>
              );
            }
            return cards;
          })}
        </div>
        )}

        {/* Daily Report */}
        <div className="bg-white rounded-xl border border-border p-4 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-secondary flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Daily Report — {todayStr}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <DailyCard
              title="Total Sales Today"
              value={formatCurrency(todayTotal)}
              sub={`${todaySales.length} transaction${todaySales.length !== 1 ? "s" : ""}`}
              gradient="from-primary/10 to-primary/5"
              border="border-primary/20"
              onClick={() => setShowTodaySales(true)}
              onDownload={() => downloadCSV(todaySales, `today-sales-${todayStr}`, false, currentUserName)}
            />
            <DailyCard
              title="Cash In Hand"
              value={formatCurrency(openingCash + todayCashCredits - todayCashDebits)}
              sub={`Opening: ${formatCurrency(openingCash)} | In: ${formatCurrency(todayCashCredits)}${todayCashDebits > 0 ? ` | Out: -${formatCurrency(todayCashDebits)}` : ""}`}
              gradient="from-green-50 to-green-100/50"
              border="border-green-200"
              onClick={() => setShowCashModal(true)}
              onDownload={() => downloadCSV(todayCashLedger, `today-cash-${todayStr}`, true, currentUserName)}
            />
            <DailyCard
              title="QR / Bank Received"
              value={formatCurrency(openingBank + todayBankCredits - todayBankDebits)}
              sub={`Opening: ${formatCurrency(openingBank)} | In: ${formatCurrency(todayBankCredits)}${todayBankDebits > 0 ? ` | Out: -${formatCurrency(todayBankDebits)}` : ""}`}
              gradient="from-blue-50 to-blue-100/50"
              border="border-blue-200"
              onClick={() => setShowQrModal(true)}
              onDownload={() => downloadCSV(todayBankLedger, `today-bank-${todayStr}`, true, currentUserName)}
            />
            <DailyCard
              title="Debtor (Credit Given)"
              value={formatCurrency(todayDebtor)}
              sub={`${todayDebtorSales.length} transaction${todayDebtorSales.length !== 1 ? "s" : ""}`}
              gradient="from-rose-50 to-rose-100/50"
              border="border-rose-200"
              onClick={() => setShowDebtorModal(true)}
              onDownload={() => downloadCSV(todayDebtorSales, `today-debtor-${todayStr}`, false, currentUserName)}
            />
            <DailyCard
              title="Bank Transactions"
              value={formatCurrency(todayPaymentsTotal)}
              sub={`In: ${formatCurrency(todayBankCredits)} | Out: ${formatCurrency(todayBankDebits)}`}
              gradient="from-purple-50 to-purple-100/50"
              border="border-purple-200"
              onClick={() => setShowPaymentsModal(true)}
              onDownload={() => downloadCSV(todayBankLedger, `today-bank-${todayStr}`, true, currentUserName)}
            />
          </div>
        </div>

        {/* ── Modals ── */}
        <DailyModal title="Today's Sales" show={showTodaySales} onClose={() => setShowTodaySales(false)} date={todayStr}
          onDownload={() => downloadCSV(todaySales, `today-sales-${todayStr}`, false, currentUserName)}>
          {todaySales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No sales today</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Sale ID</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-3 py-2 font-medium text-right">Sub Total</th>
                  <th className="px-3 py-2 font-medium text-right">Discount</th>
                  <th className="px-3 py-2 font-medium text-right">Received</th>
                  <th className="px-3 py-2 font-medium text-right">Due</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {todaySales.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setDetailSale(s)}>
                    <td className="px-3 py-2 font-mono text-xs">{s.id?.slice(0, 8)}</td>
                    <td className="px-3 py-2">{new Date((s.saleDate as any)?.seconds ? (s.saleDate as any).seconds * 1000 : (s.saleDate as number)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-3 py-2">{s.customer?.name || <span className="text-muted-foreground italic">Walk-in</span>}</td>
                    <td className="px-3 py-2 capitalize">{s.payment?.method || s.saleType}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(s.totalAmount)}</td>
                    <td className="px-3 py-2 text-right text-red-500">{(s.discountAmount || 0) > 0 ? `-${formatCurrency(s.discountAmount)}` : "-"}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(s.payment?.receivedAmount || 0)}</td>
                    <td className="px-3 py-2 text-right text-red-500">{(s.payment?.balanceDue || 0) > 0 ? formatCurrency(s.payment.balanceDue) : "-"}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(s.finalAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold text-sm">
                  <td colSpan={4} className="px-3 py-2 text-right">Total</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(todaySales.reduce((s, x) => s + x.totalAmount, 0))}</td>
                  <td className="px-3 py-2 text-right text-red-500">{formatCurrency(todaySales.reduce((s, x) => s + (x.discountAmount || 0), 0))}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(todaySales.reduce((s, x) => s + (x.payment?.receivedAmount || 0), 0))}</td>
                  <td className="px-3 py-2 text-right text-red-500">{formatCurrency(todaySales.reduce((s, x) => s + (x.payment?.balanceDue || 0), 0))}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(todayTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </DailyModal>

        <DailyModal title="Cash In Hand — Today" show={showCashModal} onClose={() => setShowCashModal(false)} date={todayStr}
          onDownload={() => downloadCSV(todayCashLedger, `today-cash-${todayStr}`, true, currentUserName)}>
          {todayCashLedger.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No cash transactions today</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium text-right">In (Cr)</th>
                    <th className="px-3 py-2 font-medium text-right">Out (Dr)</th>
                    <th className="px-3 py-2 font-medium text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(() => {
                    let running = 0;
                    return todayCashLedger.map((t) => {
                      running += t.type === "credit" ? t.amount : -t.amount;
                      const time = new Date((t.date as any)?.seconds ? (t.date as any).seconds * 1000 : (t.date as number));
                      let typeLabel = t.referenceType?.replace(/_/g, " ") || "manual";
                      let typeClass = "bg-gray-100 text-gray-700";
                      if (t.referenceType === "sale") typeClass = "bg-green-100 text-green-700";
                      else if (t.referenceType === "debtor_payment") typeClass = "bg-blue-100 text-blue-700";
                      else if (t.referenceType === "expense") typeClass = "bg-red-100 text-red-700";
                      else if (t.referenceType === "transfer") typeClass = "bg-orange-100 text-orange-700";
                      else if (t.referenceType === "creditor_payment") typeClass = "bg-purple-100 text-purple-700";
                      else if (t.referenceType === "sales_return") typeClass = "bg-pink-100 text-pink-700";
                      return (
                        <tr key={t.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setDetailCashSale(null); setShowCashModal(false); }}>
                          <td className="px-3 py-2 whitespace-nowrap">{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                          <td className="px-3 py-2"><span className={"inline-block px-2 py-0.5 rounded text-xs font-medium " + typeClass}>{typeLabel}</span></td>
                          <td className="px-3 py-2 max-w-[200px] truncate">{t.description || "-"}</td>
                          <td className="px-3 py-2 text-right font-medium text-green-600">{t.type === "credit" ? formatCurrency(t.amount) : "-"}</td>
                          <td className="px-3 py-2 text-right font-medium text-red-600">{t.type === "debit" ? formatCurrency(t.amount) : "-"}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${running >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(running)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold text-sm">
                    <td colSpan={3} className="px-3 py-2 text-right">Net Today</td>
                    <td className="px-3 py-2 text-right text-green-600">{formatCurrency(todayCashCredits)}</td>
                    <td className="px-3 py-2 text-right text-red-600">{formatCurrency(todayCashDebits)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(todayCashCredits - todayCashDebits)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DailyModal>

        <DailyModal title="QR / Bank — Today" show={showQrModal} onClose={() => setShowQrModal(false)} date={todayStr}
          onDownload={() => downloadCSV(todayBankLedger, `today-bank-${todayStr}`, true, currentUserName)}>
          {todayBankLedger.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No bank transactions today</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium text-right">In (Cr)</th>
                    <th className="px-3 py-2 font-medium text-right">Out (Dr)</th>
                    <th className="px-3 py-2 font-medium text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(() => {
                    let running = 0;
                    return todayBankLedger.map((t) => {
                      running += t.type === "credit" ? t.amount : -t.amount;
                      const time = new Date((t.date as any)?.seconds ? (t.date as any).seconds * 1000 : (t.date as number));
                      let typeLabel = t.referenceType?.replace(/_/g, " ") || "manual";
                      let typeClass = "bg-gray-100 text-gray-700";
                      if (t.referenceType === "sale") typeClass = "bg-green-100 text-green-700";
                      else if (t.referenceType === "debtor_payment") typeClass = "bg-blue-100 text-blue-700";
                      else if (t.referenceType === "expense") typeClass = "bg-red-100 text-red-700";
                      else if (t.referenceType === "transfer") typeClass = "bg-orange-100 text-orange-700";
                      else if (t.referenceType === "creditor_payment") typeClass = "bg-purple-100 text-purple-700";
                      else if (t.referenceType === "sales_return") typeClass = "bg-pink-100 text-pink-700";
                      return (
                        <tr key={t.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setDetailQrSale(null); setShowQrModal(false); }}>
                          <td className="px-3 py-2 whitespace-nowrap">{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                          <td className="px-3 py-2"><span className={"inline-block px-2 py-0.5 rounded text-xs font-medium " + typeClass}>{typeLabel}</span></td>
                          <td className="px-3 py-2 max-w-[200px] truncate">{t.description || "-"}</td>
                          <td className="px-3 py-2 text-right font-medium text-green-600">{t.type === "credit" ? formatCurrency(t.amount) : "-"}</td>
                          <td className="px-3 py-2 text-right font-medium text-red-600">{t.type === "debit" ? formatCurrency(t.amount) : "-"}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${running >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(running)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold text-sm">
                    <td colSpan={3} className="px-3 py-2 text-right">Net Today</td>
                    <td className="px-3 py-2 text-right text-green-600">{formatCurrency(todayBankCredits)}</td>
                    <td className="px-3 py-2 text-right text-red-600">{formatCurrency(todayBankDebits)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(todayBankCredits - todayBankDebits)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DailyModal>

        <DailyModal title="Debtor (Credit Given) — Today" show={showDebtorModal} onClose={() => setShowDebtorModal(false)} date={todayStr}
          onDownload={() => downloadCSV(todayDebtorSales, `today-debtor-${todayStr}`, false, currentUserName)}>
          {todayDebtorSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No credit transactions today</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Sale ID</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium text-right">Received</th>
                  <th className="px-3 py-2 font-medium text-right">Balance Due</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {todayDebtorSales.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setDetailDebtorSale(s)}>
                    <td className="px-3 py-2 font-mono text-xs">{s.id?.slice(0, 8)}</td>
                    <td className="px-3 py-2">{new Date((s.saleDate as any)?.seconds ? (s.saleDate as any).seconds * 1000 : (s.saleDate as number)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-3 py-2">{s.customer?.name || <span className="text-muted-foreground italic">Walk-in</span>}</td>
                    <td className="px-3 py-2 capitalize">{s.saleType}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(s.payment?.receivedAmount || 0)}</td>
                    <td className="px-3 py-2 text-right text-red-500">{formatCurrency(s.payment?.balanceDue || 0)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(s.finalAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold text-sm">
                  <td colSpan={4} className="px-3 py-2 text-right">Total</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(todayDebtorSales.reduce((s, x) => s + (x.payment?.receivedAmount || 0), 0))}</td>
                  <td className="px-3 py-2 text-right text-red-500">{formatCurrency(todayDebtor)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(todayDebtorSales.reduce((s, x) => s + x.finalAmount, 0))}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </DailyModal>

        <DailyModal title="Bank Transactions — Today" show={showPaymentsModal} onClose={() => setShowPaymentsModal(false)} date={todayStr}
          onDownload={() => downloadCSV(todayBankLedger, `today-bank-${todayStr}`, true, currentUserName)}>
          {todayBankLedger.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No bank transactions today</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium text-right">In (Cr)</th>
                    <th className="px-3 py-2 font-medium text-right">Out (Dr)</th>
                    <th className="px-3 py-2 font-medium text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(() => {
                    let running = 0;
                    return todayBankLedger.map((t) => {
                      running += t.type === "credit" ? t.amount : -t.amount;
                      const time = new Date((t.date as any)?.seconds ? (t.date as any).seconds * 1000 : (t.date as number));
                      let typeLabel = t.referenceType?.replace(/_/g, " ") || "manual";
                      let typeClass = "bg-gray-100 text-gray-700";
                      if (t.referenceType === "sale") typeClass = "bg-green-100 text-green-700";
                      else if (t.referenceType === "debtor_payment") typeClass = "bg-blue-100 text-blue-700";
                      else if (t.referenceType === "expense") typeClass = "bg-red-100 text-red-700";
                      else if (t.referenceType === "transfer") typeClass = "bg-orange-100 text-orange-700";
                      else if (t.referenceType === "creditor_payment") typeClass = "bg-purple-100 text-purple-700";
                      else if (t.referenceType === "sales_return") typeClass = "bg-pink-100 text-pink-700";
                      return (
                        <tr key={t.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setDetailPayment(t)}>
                          <td className="px-3 py-2 whitespace-nowrap">{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                          <td className="px-3 py-2"><span className={"inline-block px-2 py-0.5 rounded text-xs font-medium " + typeClass}>{typeLabel}</span></td>
                          <td className="px-3 py-2 max-w-[200px] truncate">{t.description || "-"}</td>
                          <td className="px-3 py-2 text-right font-medium text-green-600">{t.type === "credit" ? formatCurrency(t.amount) : "-"}</td>
                          <td className="px-3 py-2 text-right font-medium text-red-600">{t.type === "debit" ? formatCurrency(t.amount) : "-"}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${running >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(running)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold text-sm">
                    <td colSpan={3} className="px-3 py-2 text-right">Net Today</td>
                    <td className="px-3 py-2 text-right text-green-600">{formatCurrency(todayBankCredits)}</td>
                    <td className="px-3 py-2 text-right text-red-600">{formatCurrency(todayBankDebits)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(todayBankCredits - todayBankDebits)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DailyModal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-secondary">Sales Trend (30 days)</h2>
            </div>
            {mySales.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No sales data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`Rs. ${formatNumber(v)}`, "Sales"]} />
                  <Line type="monotone" dataKey="sales" stroke="#b8860b" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-secondary">Sales by Category</h2>
            </div>
            {categoryData.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <RPieChart>
                  <Pie
                    data={categoryData}
                    cx="50%" cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `Rs. ${formatNumber(v)}`} />
                </RPieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-secondary">Inventory by Category</h2>
            </div>
            {inventoryData.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No products yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={inventoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip formatter={(v: number) => [v, "In Stock"]} />
                  <Bar dataKey="stock" fill="#b8860b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-secondary">Top Selling Products</h2>
            </div>
            {topProducts.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No sales yet</p>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                      <span className="truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs flex-shrink-0">
                      <span className="text-muted-foreground">x{p.qty}</span>
                      <span className="font-medium text-secondary">{formatCurrency(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-secondary">Recent Sales</h2>
            </div>
            {mySales.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No sales yet</p>
            ) : (
              <div className="space-y-2">
                {mySales.slice(0, 5).map((s) => (
                  <Link key={s.id} href={`/admin/sales?customer=${encodeURIComponent(s.customer?.name || "")}`}
                    className="flex items-center justify-between text-sm hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                    <div className="min-w-0 truncate">
                      <span className="truncate font-medium">{s.customer?.name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground ml-2">{s.customer?.phone}</span>
                    </div>
                    <span className="font-medium flex-shrink-0">{formatCurrency(s.finalAmount)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-secondary">Recent Orders</h2>
            </div>
            {myOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No orders yet</p>
            ) : (
              <div className="space-y-2">
                {myOrders.slice(0, 5).map((order) => (
                  <Link key={order.id} href="/admin/orders"
                    className="flex items-center justify-between text-sm hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        order.status === "pending" ? "bg-amber-400" :
                        order.status === "confirmed" ? "bg-blue-400" :
                        order.status === "delivered" ? "bg-green-400" : "bg-gray-400"
                      }`} />
                      <span className="truncate">{order.customer?.name || "Unknown"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs flex-shrink-0">
                      <span className="text-muted-foreground capitalize">{order.status}</span>
                      <span className="font-medium">{formatCurrency(order.totalAmount)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-red-500" />
              <h2 className="text-sm font-semibold text-secondary">Overdue Debtors</h2>
            </div>
            {activeDebtorsList.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No outstanding debts</p>
            ) : (
              <div className="space-y-2">
                {activeDebtorsList.slice(0, 5).map((d) => (
                  <Link key={d.id} href="/admin/debtors"
                    className="flex items-center justify-between text-sm hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                    <div className="min-w-0 truncate">
                      <span className="truncate">{d.customerName}</span>
                      <span className="text-xs text-muted-foreground ml-2">{d.customerPhone}</span>
                    </div>
                    <span className="font-medium text-red-600 flex-shrink-0">{formatCurrency(d.balanceDue)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row Detail Modals */}
      <RowDetailModal show={!!detailSale} onClose={() => setDetailSale(null)} title="Sale Details">
        {detailSale && (
          <SaleDetailContent sale={detailSale} />
        )}
      </RowDetailModal>

      <RowDetailModal show={!!detailCashSale} onClose={() => setDetailCashSale(null)} title="Cash Sale Details">
        {detailCashSale && (
          <SaleDetailContent sale={detailCashSale} />
        )}
      </RowDetailModal>

      <RowDetailModal show={!!detailQrSale} onClose={() => setDetailQrSale(null)} title="QR / Bank Sale Details">
        {detailQrSale && (
          <SaleDetailContent sale={detailQrSale} />
        )}
      </RowDetailModal>

      <RowDetailModal show={!!detailDebtorSale} onClose={() => setDetailDebtorSale(null)} title="Credit Sale Details">
        {detailDebtorSale && (
          <SaleDetailContent sale={detailDebtorSale} />
        )}
      </RowDetailModal>

      <RowDetailModal show={!!detailPayment} onClose={() => setDetailPayment(null)} title="Payment Details">
        {detailPayment && (
          <PaymentDetailContent transaction={detailPayment} />
        )}
      </RowDetailModal>
    </AdminLayout>
  );
}

// ── Daily Report Sub-components ──

function DailyCard({ title, value, sub, gradient, border, onClick, onDownload }: {
  title: string; value: string; sub: string; gradient: string; border: string;
  onClick: () => void; onDownload: () => void;
}) {
  return (
    <div className={`relative bg-gradient-to-br ${gradient} rounded-xl p-4 border ${border} hover:shadow-md transition-shadow`}>
      <button onClick={onDownload}
        className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-primary hover:bg-white/50 rounded-lg transition-colors"
        title="Download CSV">
        <FileDown className="h-3.5 w-3.5" />
      </button>
      <button onClick={onClick} className="w-full text-left focus:outline-none">
        <p className="text-[11px] text-muted-foreground">{title}</p>
        <p className="text-lg font-bold text-secondary mt-1">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
      </button>
    </div>
  );
}

function DailyModal({ title, show, onClose, children, date, onDownload }: {
  title: string; show: boolean; onClose: () => void; children: React.ReactNode; date: string; onDownload: () => void;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-secondary">{title}</h2>
          <div className="flex items-center gap-2">
            <button onClick={onDownload} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg" title="Download CSV">
              <FileDown className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function RowDetailModal({ show, onClose, title, children }: {
  show: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-secondary">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function fmtDate(d: unknown) {
  const ms = (d as any)?.seconds ? (d as any).seconds * 1000 : (d as number);
  return new Date(ms).toLocaleString();
}

function SaleDetailContent({ sale }: { sale: Sale }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-muted-foreground block text-xs">Sale ID</span>
          <span className="font-mono text-xs break-all">{sale.id}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Date / Time</span>
          <span>{fmtDate(sale.saleDate)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Customer</span>
          <span>{sale.customer?.name || <span className="italic text-muted-foreground">Walk-in</span>}</span>
          {sale.customer?.phone && <span className="text-muted-foreground ml-1">({sale.customer.phone})</span>}
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Sale Type</span>
          <span className="capitalize">{sale.saleType}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Payment Method</span>
          <span className="capitalize">{sale.payment?.method || "-"}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Recorded By</span>
          <span>{sale.recordedByName || sale.recordedBy || "-"}</span>
        </div>
      </div>
      {sale.items && sale.items.length > 0 && (
        <div>
          <span className="text-muted-foreground block text-xs mb-1 font-medium">Items</span>
          <table className="w-full text-xs border border-border rounded-lg">
            <thead>
              <tr className="bg-muted text-left text-muted-foreground">
                <th className="px-2 py-1">Product</th>
                <th className="px-2 py-1 text-right">Qty</th>
                <th className="px-2 py-1 text-right">Unit Price</th>
                <th className="px-2 py-1 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sale.items.map((item, i) => (
                <tr key={i}>
                  <td className="px-2 py-1">{item.productName}</td>
                  <td className="px-2 py-1 text-right">{item.quantity}</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div>
          <span className="text-muted-foreground block text-xs">Total Amount</span>
          <span>{formatCurrency(sale.totalAmount)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Discount</span>
          <span className={sale.discountAmount > 0 ? "text-red-500" : ""}>{sale.discountAmount > 0 ? `-${formatCurrency(sale.discountAmount)}` : "-"}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Final Amount</span>
          <span className="font-semibold">{formatCurrency(sale.finalAmount)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Received</span>
          <span className="text-green-600 font-medium">{formatCurrency(sale.payment?.receivedAmount || 0)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Balance Due</span>
          <span className={sale.payment?.balanceDue > 0 ? "text-red-500 font-medium" : ""}>{sale.payment?.balanceDue > 0 ? formatCurrency(sale.payment.balanceDue) : "-"}</span>
        </div>
        {sale.couponIssued && (
          <div>
            <span className="text-muted-foreground block text-xs">Coupon Issued</span>
            <span>{sale.couponIssued.code} ({formatCurrency(sale.couponIssued.discountValue)})</span>
          </div>
        )}
      </div>
      {sale.notes && (
        <div className="pt-2 border-t border-border">
          <span className="text-muted-foreground block text-xs">Notes</span>
          <span>{sale.notes}</span>
        </div>
      )}
    </div>
  );
}

function PaymentDetailContent({ transaction }: { transaction: AccountTransaction }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-muted-foreground block text-xs">Transaction ID</span>
          <span className="font-mono text-xs break-all">{transaction.id}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Date / Time</span>
          <span>{fmtDate(transaction.date)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Amount</span>
          <span className="font-semibold text-green-600">{formatCurrency(transaction.amount)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Type</span>
          <span className="capitalize">{transaction.type}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Reference Type</span>
          <span className="capitalize">{transaction.referenceType?.replace("_", " ") || "-"}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Reference ID</span>
          <span className="font-mono text-xs">{transaction.referenceId?.slice(0, 12) || "-"}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Account ID</span>
          <span className="font-mono text-xs">{transaction.accountId}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-xs">Recorded By</span>
          <span>{transaction.recordedBy || "-"}</span>
        </div>
      </div>
      {transaction.description && (
        <div className="pt-2 border-t border-border">
          <span className="text-muted-foreground block text-xs">Description</span>
          <span>{transaction.description}</span>
        </div>
      )}
    </div>
  );
}

async function downloadCSV(data: any[], filename: string, isTransaction = false, userName = "") {
  if (data.length === 0) return;
  const fmtTime = (d: any) =>
    new Date(d?.seconds ? d.seconds * 1000 : d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let startY = 15;
  const logoWidthMm = 45;
  const logoHeightMm = 22;
  try {
    const resp = await fetch("/logo.svg");
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    const dpr = 4;
    canvas.width = logoWidthMm * dpr;
    canvas.height = logoHeightMm * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, logoWidthMm * dpr, logoHeightMm * dpr);
    URL.revokeObjectURL(url);
    const png = canvas.toDataURL("image/png");
    doc.addImage(png, "PNG", 10, 8, logoWidthMm, logoHeightMm);
    startY = 14;
  } catch { /* logo not available, skip */ }
  doc.setFontSize(16);
  doc.text("Today's Report", pageWidth - 14, 14, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated by: ${userName || "Unknown"} | ${new Date().toLocaleString()}`, pageWidth - 14, 20, { align: "right" });
  doc.setTextColor(0);
  const tableStart = Math.max(startY, logoHeightMm + 12);
  if (isTransaction) {
    const rows = data.map((t: any) => [
      t.id?.slice(0, 8) || "", fmtTime(t.date), t.description || "",
      t.referenceType?.replace("_", " ") || "", t.amount ?? 0,
    ]);
    autoTable(doc, {
      head: [["Transaction ID", "Time", "Description", "Reference Type", "Amount"]],
      body: rows,
      startY: tableStart,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [51, 51, 51] },
    });
  } else {
    const rows = data.map((s: any) => [
      s.id?.slice(0, 8) || "", fmtTime(s.saleDate), s.customer?.name || "Walk-in",
      s.payment?.method || s.saleType || "", s.totalAmount ?? 0,
      s.discountAmount ?? 0, s.payment?.receivedAmount ?? 0, s.payment?.balanceDue ?? 0, s.finalAmount ?? 0,
    ]);
    autoTable(doc, {
      head: [["Sale ID", "Time", "Customer", "Method", "Sub Total", "Discount", "Received", "Due", "Total"]],
      body: rows,
      startY: tableStart,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [51, 51, 51] },
    });
  }
  doc.save(`${filename}.pdf`);
}
