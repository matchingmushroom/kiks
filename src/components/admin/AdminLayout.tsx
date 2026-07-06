"use client";

import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { DataCacheProvider } from "@/contexts/DataCacheContext";
import { hasPermission } from "@/lib/roles";
import {
  LayoutDashboard, Package, ShoppingCart, Receipt, Users, BarChart3,
  Settings, LogOut, Menu, X, Tags, FileText, Truck, Home, Shield,
  Rocket, ArrowLeft, DollarSign, CreditCard, Wallet, Sparkles,
  ClipboardList, Zap, ChevronDown, Bell, Search, MessageSquare,
} from "lucide-react";

interface NavItem {
  label?: string;
  href?: string;
  icon?: ReactNode;
  permission?: string;
  divider?: boolean;
  section?: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: <LayoutDashboard className="h-4 w-4" /> },
  { divider: true, section: "SALES" },
  { label: "POS", href: "/admin/pos", icon: <Zap className="h-4 w-4" />, permission: "manage_sales" },
  { label: "Sales", href: "/admin/sales", icon: <ShoppingCart className="h-4 w-4" />, permission: "manage_sales" },
  { label: "Invoices", href: "/admin/invoices", icon: <FileText className="h-4 w-4" />, permission: "manage_invoices" },
  { label: "Orders", href: "/admin/orders", icon: <Truck className="h-4 w-4" />, permission: "manage_orders" },
  { label: "Coupons", href: "/admin/coupons", icon: <Tags className="h-4 w-4" />, permission: "manage_coupons" },
  { label: "Offers", href: "/admin/offers", icon: <Sparkles className="h-4 w-4" />, permission: "manage_offers" },
  { label: "Testimonials", href: "/admin/testimonials", icon: <MessageSquare className="h-4 w-4" />, permission: "manage_homepage" },
  { label: "Debtors", href: "/admin/debtors", icon: <Users className="h-4 w-4" />, permission: "manage_debtors" },
  { divider: true, section: "INVENTORY" },
  { label: "Morning Dashboard", href: "/admin/morning", icon: <BarChart3 className="h-4 w-4" />, permission: "view_morning_dashboard" },
  { label: "Products", href: "/admin/products", icon: <Package className="h-4 w-4" />, permission: "manage_products" },
  { label: "Categories", href: "/admin/categories", icon: <Tags className="h-4 w-4" />, permission: "manage_categories" },
  { label: "Inventory", href: "/admin/inventory", icon: <BarChart3 className="h-4 w-4" />, permission: "manage_inventory" },
  { label: "Reconciliation", href: "/admin/reconciliation", icon: <ClipboardList className="h-4 w-4" />, permission: "manage_inventory" },
  { label: "Purchases", href: "/admin/purchases", icon: <DollarSign className="h-4 w-4" />, permission: "manage_purchases" },
  { label: "Suppliers", href: "/admin/suppliers", icon: <Truck className="h-4 w-4" />, permission: "manage_suppliers" },
  { label: "Creditors", href: "/admin/creditors", icon: <Users className="h-4 w-4" />, permission: "manage_creditors" },
  { divider: true, section: "FINANCE" },
  { label: "Expenses", href: "/admin/expenses", icon: <CreditCard className="h-4 w-4" />, permission: "manage_expenses" },
  { label: "Reports", href: "/admin/reports", icon: <FileText className="h-4 w-4" />, permission: "view_reports" },
  { label: "Finance", href: "/admin/finance", icon: <Wallet className="h-4 w-4" />, permission: "view_reports" },
  { label: "Accounting", href: "/admin/accounting", icon: <FileText className="h-4 w-4" />, permission: "view_reports" },
  { divider: true, section: "PEOPLE" },
  { label: "Customers", href: "/admin/customers", icon: <Users className="h-4 w-4" />, permission: "manage_customers" },
  { label: "Staff", href: "/admin/staff", icon: <Shield className="h-4 w-4" />, permission: "manage_staff" },
  { divider: true, section: "SYSTEM" },
  { label: "Homepage", href: "/admin/homepage", icon: <Home className="h-4 w-4" />, permission: "manage_homepage" },
  { label: "Access Control", href: "/admin/access-control", icon: <Shield className="h-4 w-4" />, permission: "manage_access_control" },
  { label: "Backup", href: "/admin/backup", icon: <Receipt className="h-4 w-4" />, permission: "manage_backup" },
  { label: "Settings", href: "/admin/settings", icon: <Settings className="h-4 w-4" />, permission: "manage_settings" },
  { label: "Setup", href: "/admin/setup", icon: <Rocket className="h-4 w-4" />, permission: "manage_settings" },
];

const bottomNavItems = [
  { label: "POS", href: "/admin/pos", icon: <Zap className="h-5 w-5" />, permission: "manage_sales" },
  { label: "Sales", href: "/admin/sales", icon: <ShoppingCart className="h-5 w-5" />, permission: "manage_sales" },
  { label: "Home", href: "/admin", icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "Products", href: "/admin/products", icon: <Package className="h-5 w-5" />, permission: "manage_products" },
  { label: "Purchases", href: "/admin/purchases", icon: <DollarSign className="h-5 w-5" />, permission: "manage_purchases" },
];

function getRoutePermission(href: string): string | undefined {
  const item = navItems.find((n) => n.href === href);
  return item?.permission;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, logout } = useAuth();
  const { settings } = useShopSettings();

  useEffect(() => {
    if (!loading && !user) router.push("/admin/login");
  }, [user, loading, router]);

  useEffect(() => {
    setSidebarOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const routePermission = getRoutePermission(pathname);
  const permitted = routePermission
    ? hasPermission(profile?.role, routePermission as never, profile?.permissions)
    : true;

  if (!permitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <Shield className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-secondary">Access Denied</h1>
        <p className="text-muted-foreground text-sm text-center max-w-xs">You do not have permission to access this page.</p>
        <Link href="/admin" className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-secondary font-semibold rounded-full text-sm hover:bg-accent/90 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
      </div>
    );
  }

  const filteredItems = navItems.filter((item) => {
    if (item.divider) return true;
    if (!item.permission) return true;
    return hasPermission(profile?.role, item.permission as never, profile?.permissions);
  });

  return (
    <DataCacheProvider>
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-border
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:z-auto
        flex flex-col shadow-sm
      `}>
        <div className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-secondary font-bold text-xs">P</div>
            <span className="text-sm font-bold text-secondary truncate">{settings.shopName}</span>
          </Link>
          <button className="lg:hidden p-1.5 hover:bg-muted rounded-lg transition-colors" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5 scrollbar-thin">
          {filteredItems.map((item) => {
            if (item.divider) {
              return (
                <div key={item.section || `d-${Math.random()}`} className="pt-4 pb-1.5">
                  {item.section ? (
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-2">{item.section}</p>
                  ) : (
                    <hr className="border-border" />
                  )}
                </div>
              );
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href!} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-accent/10 text-accent font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-secondary"
                }`}
              >
                <span className={isActive ? "text-accent" : "text-muted-foreground/60"}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border shrink-0">
          <button onClick={logout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-border h-14 flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-1.5 hover:bg-muted rounded-lg transition-colors" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5 text-secondary" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-secondary">{profile?.displayName || "User"}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-medium">{profile?.role || "staff"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-all">
              <Home className="h-3.5 w-3.5" /> View Shop
            </Link>
            <div className="relative">
              <button onClick={() => setProfileOpen(!profileOpen)}
                className="sm:hidden p-1.5 hover:bg-muted rounded-lg transition-colors"
              >
                <Menu className="h-5 w-5 text-secondary" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-border rounded-xl shadow-lg p-2 space-y-0.5 z-40">
                  <p className="px-3 py-2 text-sm font-medium text-secondary truncate">{profile?.displayName}</p>
                  <p className="px-3 pb-2 text-xs text-muted-foreground border-b border-border">{profile?.role}</p>
                  <Link href="/" className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg" onClick={() => setProfileOpen(false)}>
                    <Home className="h-4 w-4" /> View Shop
                  </Link>
                  <button onClick={() => { setProfileOpen(false); logout(); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border flex justify-around items-center h-14 safe-area-bottom shadow-lg">
        {bottomNavItems.map((item) => {
          if (item.permission && !hasPermission(profile?.role, item.permission as never, profile?.permissions)) return null;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href!}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                isActive ? "text-accent" : "text-muted-foreground hover:text-secondary"
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="lg:hidden h-14" />
    </div>
    </DataCacheProvider>
  );
}
