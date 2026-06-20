"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { Sale, Product, Debtor, Order, Category } from "@/types";
import { formatCurrency, formatNumber, toDate } from "@/lib/utils";
import Link from "next/link";
import {
  Users, Package, Wallet, AlertTriangle, TrendingUp, PieChart,
  BarChart3, ShoppingCart, Clock, RefreshCw,
} from "lucide-react";
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
  const { data: sales } = useFirestore<Sale>("sales", {
    constraints: [orderBy("saleDate", "desc"), limit(200)],
    realtime: false, cache: true,
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

  const isStaff = profile?.role === "staff";
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

  const stats = [
    { label: "YTD Sales", value: formatCurrency(ytdSales), icon: TrendingUp, color: "text-green-600 bg-green-50" },
    { label: "MTD Sales", value: formatCurrency(mtdSales), icon: Wallet, color: "text-blue-600 bg-blue-50" },
    { label: "Total Sales", value: formatCurrency(totalSales), icon: Package, color: "text-purple-600 bg-purple-50" },
    { label: "Debtors Balance", value: formatCurrency(debtorsBalance), icon: Users, color: "text-red-600 bg-red-50" },
    { label: "Low Stock Items", value: String(lowStockItems.length), icon: AlertTriangle, color: "text-amber-600 bg-amber-50" },
    { label: "Active Debtors", value: String(activeDebtorsList.length), icon: Users, color: "text-orange-600 bg-orange-50" },
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
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const revenue = new Map<string, number>();
    mySales.forEach((s) => {
      (s.items || []).forEach((item) => {
        const prod = prodMap.get(item.productId) || nameMap.get(item.productName);
        const catName = prod ? catMap.get(prod.categoryId) || "Uncategorized" : "Uncategorized";
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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {stats.map((stat) => {
            const isLink = stat.label === "Low Stock Items" || stat.label === "Active Debtors";
            const href = stat.label === "Low Stock Items" ? "/admin/inventory" : "/admin/debtors";
            const Card = ({ children }: { children: React.ReactNode }) => isLink ? <Link href={href} className="block">{children}</Link> : <>{children}</>;
            return (
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
          })}
        </div>

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
