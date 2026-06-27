"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { Sale, Product, Debtor, Order, Category, AccountTransaction } from "@/types";
import { formatCurrency, formatNumber, toDate } from "@/lib/utils";
import { getFiscalYearStartEpoch } from "@/lib/nepaliDate";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import {
  Users, Package, Wallet, AlertTriangle, TrendingUp, PieChart,
  BarChart3, ShoppingCart, Clock, RefreshCw, X, DollarSign, Landmark, CreditCard, FileDown,
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
  const todayBankCredits = myTransactions.filter((t) => {
    const d = new Date((t.date as any)?.seconds ? (t.date as any).seconds * 1000 : (t.date as number)).getTime();
    return d >= todayStart && d < todayEnd && t.accountId === "bank_account" && t.type === "credit";
  });
  const todayPaymentsTotal = todayBankCredits.reduce((s, t) => s + t.amount, 0);



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
              value={formatCurrency(openingCash + todayCash)}
              sub={`Opening: ${formatCurrency(openingCash)} | Sales: ${formatCurrency(todayCash)} (${todayCashSales.length} txns)`}
              gradient="from-green-50 to-green-100/50"
              border="border-green-200"
              onClick={() => setShowCashModal(true)}
              onDownload={() => downloadCSV(todayCashSales, `today-cash-${todayStr}`, false, currentUserName)}
            />
            <DailyCard
              title="QR / Bank Received"
              value={formatCurrency(openingBank + todayQrBank)}
              sub={`Opening: ${formatCurrency(openingBank)} | Sales: ${formatCurrency(todayQrBank)} (${todayQrSales.length} txns)`}
              gradient="from-blue-50 to-blue-100/50"
              border="border-blue-200"
              onClick={() => setShowQrModal(true)}
              onDownload={() => downloadCSV(todayQrSales, `today-qr-bank-${todayStr}`, false, currentUserName)}
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
              title="Payments (Bank Deposit)"
              value={formatCurrency(todayPaymentsTotal)}
              sub={`${todayBankCredits.length} deposit${todayBankCredits.length !== 1 ? "s" : ""}`}
              gradient="from-purple-50 to-purple-100/50"
              border="border-purple-200"
              onClick={() => setShowPaymentsModal(true)}
              onDownload={() => downloadCSV(todayBankCredits, `today-payments-${todayStr}`, true, currentUserName)}
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
                  <tr key={s.id} className="hover:bg-muted/30">
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
          onDownload={() => downloadCSV(todayCashSales, `today-cash-${todayStr}`, false, currentUserName)}>
          {todayCashSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No cash transactions today</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Sale ID</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium text-right">Received</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {todayCashSales.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{s.id?.slice(0, 8)}</td>
                    <td className="px-3 py-2">{new Date((s.saleDate as any)?.seconds ? (s.saleDate as any).seconds * 1000 : (s.saleDate as number)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-3 py-2">{s.customer?.name || <span className="text-muted-foreground italic">Walk-in</span>}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(s.payment?.receivedAmount || 0)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(s.finalAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold text-sm">
                  <td colSpan={3} className="px-3 py-2 text-right">Total</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(todayCash)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(todayCashSales.reduce((s, x) => s + x.finalAmount, 0))}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </DailyModal>

        <DailyModal title="QR / Bank Received — Today" show={showQrModal} onClose={() => setShowQrModal(false)} date={todayStr}
          onDownload={() => downloadCSV(todayQrSales, `today-qr-bank-${todayStr}`, false, currentUserName)}>
          {todayQrSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No QR/bank transactions today</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Sale ID</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-3 py-2 font-medium text-right">Received</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {todayQrSales.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{s.id?.slice(0, 8)}</td>
                    <td className="px-3 py-2">{new Date((s.saleDate as any)?.seconds ? (s.saleDate as any).seconds * 1000 : (s.saleDate as number)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-3 py-2">{s.customer?.name || <span className="text-muted-foreground italic">Walk-in</span>}</td>
                    <td className="px-3 py-2 capitalize">{s.payment?.method}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(s.payment?.receivedAmount || 0)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(s.finalAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold text-sm">
                  <td colSpan={4} className="px-3 py-2 text-right">Total</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(todayQrBank)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(todayQrSales.reduce((s, x) => s + x.finalAmount, 0))}</td>
                </tr>
              </tfoot>
            </table>
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
                  <tr key={s.id} className="hover:bg-muted/30">
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

        <DailyModal title="Payments (Bank Deposit) — Today" show={showPaymentsModal} onClose={() => setShowPaymentsModal(false)} date={todayStr}
          onDownload={() => downloadCSV(todayBankCredits, `today-payments-${todayStr}`, true, currentUserName)}>
          {todayBankCredits.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No bank deposits today</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Transaction ID</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Reference</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {todayBankCredits.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{t.id?.slice(0, 8)}</td>
                    <td className="px-3 py-2">{new Date((t.date as any)?.seconds ? (t.date as any).seconds * 1000 : (t.date as number)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-3 py-2 max-w-[180px] truncate">{t.description}</td>
                    <td className="px-3 py-2 text-xs capitalize">{t.referenceType?.replace("_", " ") || "-"}</td>
                    <td className="px-3 py-2 text-right font-semibold text-green-600">+{formatCurrency(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold text-sm">
                  <td colSpan={4} className="px-3 py-2 text-right">Total</td>
                  <td className="px-3 py-2 text-right text-green-600">{formatCurrency(todayPaymentsTotal)}</td>
                </tr>
              </tfoot>
            </table>
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

async function downloadCSV(data: any[], filename: string, isTransaction = false, userName = "") {
  if (data.length === 0) return;
  const fmtTime = (d: any) =>
    new Date(d?.seconds ? d.seconds * 1000 : d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let startY = 15;
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
    canvas.width = 40;
    canvas.height = 20;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, 40, 20);
    URL.revokeObjectURL(url);
    const png = canvas.toDataURL("image/png");
    doc.addImage(png, "PNG", pageWidth / 2 - 20, 8, 40, 16);
    startY = 28;
  } catch { /* logo not available, skip */ }
  doc.setFontSize(14);
  doc.text("Today's Report", pageWidth / 2, startY, { align: "center" });
  doc.setFontSize(9);
  doc.text(`Generated by: ${userName || "Unknown"} | ${new Date().toLocaleString()}`, pageWidth / 2, startY + 6, { align: "center" });
  const tableStart = startY + 10;
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
