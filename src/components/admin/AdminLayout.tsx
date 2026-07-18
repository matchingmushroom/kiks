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
  ClipboardList, Zap, ChevronDown, Bell, Search, MessageSquare, Award,
} from "lucide-react";

interface NavItem {
  label?: string;
  href?: string;
  icon?: ReactNode;
  permission?: string;
  divider?: boolean;
  section?: string;
  liteModeHide?: boolean;
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
  { divider: true, section: "LOYALTY" },
  { label: "Loyalty", href: "/admin/loyalty", icon: <Award className="h-4 w-4" />, permission: "manage_sales" },
  { divider: true, section: "INVENTORY" },
  { label: "Morning Dashboard", href: "/admin/morning", icon: <BarChart3 className="h-4 w-4" />, permission: "view_morning_dashboard" },
  { label: "Products", href: "/admin/products", icon: <Package className="h-4 w-4" />, permission: "manage_products", liteModeHide: true },
  { label: "Categories", href: "/admin/categories", icon: <Tags className="h-4 w-4" />, permission: "manage_categories" },
  { label: "Inventory", href: "/admin/inventory", icon: <BarChart3 className="h-4 w-4" />, permission: "manage_inventory", liteModeHide: true },
  { label: "Reconciliation", href: "/admin/reconciliation", icon: <ClipboardList className="h-4 w-4" />, permission: "manage_inventory", liteModeHide: true },
  { label: "Purchases", href: "/admin/purchases", icon: <DollarSign className="h-4 w-4" />, permission: "manage_purchases" },
  { label: "Suppliers", href: "/admin/suppliers", icon: <Truck className="h-4 w-4" />, permission: "manage_suppliers", liteModeHide: true },
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

// Icon map for bottom nav (uses larger h-5 w-5 icons)
const bottomNavIconMap: Record<string, ReactNode> = {
  "/admin": <LayoutDashboard className="h-5 w-5" />,
  "/admin/pos": <Zap className="h-5 w-5" />,
  "/admin/sales": <ShoppingCart className="h-5 w-5" />,
  "/admin/invoices": <FileText className="h-5 w-5" />,
  "/admin/orders": <Truck className="h-5 w-5" />,
  "/admin/coupons": <Tags className="h-5 w-5" />,
  "/admin/offers": <Sparkles className="h-5 w-5" />,
  "/admin/testimonials": <MessageSquare className="h-5 w-5" />,
  "/admin/debtors": <Users className="h-5 w-5" />,
  "/admin/morning": <BarChart3 className="h-5 w-5" />,
  "/admin/products": <Package className="h-5 w-5" />,
  "/admin/categories": <Tags className="h-5 w-5" />,
  "/admin/inventory": <BarChart3 className="h-5 w-5" />,
  "/admin/reconciliation": <ClipboardList className="h-5 w-5" />,
  "/admin/purchases": <DollarSign className="h-5 w-5" />,
  "/admin/suppliers": <Truck className="h-5 w-5" />,
  "/admin/creditors": <Users className="h-5 w-5" />,
  "/admin/expenses": <CreditCard className="h-5 w-5" />,
  "/admin/reports": <FileText className="h-5 w-5" />,
  "/admin/finance": <Wallet className="h-5 w-5" />,
  "/admin/accounting": <FileText className="h-5 w-5" />,
  "/admin/customers": <Users className="h-5 w-5" />,
  "/admin/staff": <Shield className="h-5 w-5" />,
  "/admin/homepage": <Home className="h-5 w-5" />,
  "/admin/access-control": <Shield className="h-5 w-5" />,
  "/admin/backup": <Receipt className="h-5 w-5" />,
  "/admin/settings": <Settings className="h-5 w-5" />,
  "/admin/setup": <Rocket className="h-5 w-5" />,
};

// Default bottom nav items (hrefs)
const defaultBottomNavHrefs = ["/admin/pos", "/admin/sales", "/admin", "/admin/products", "/admin/purchases"];

function loadBottomNavHrefs(): string[] {
  if (typeof window === "undefined") return defaultBottomNavHrefs;
  try {
    const stored = localStorage.getItem("pc_bottom_nav");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 5);
    }
  } catch {}
  return defaultBottomNavHrefs;
}

function BottomNav({ profile, pathname }: { profile: any; pathname: string }) {
  const [hrefs, setHrefs] = useState<string[]>(loadBottomNavHrefs);

  useEffect(() => {
    const handler = () => setHrefs(loadBottomNavHrefs());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const items = hrefs
    .map((href) => {
      const navItem = navItems.find((n) => n.href === href);
      if (!navItem) return null;
      if (navItem.permission && !hasPermission(profile?.role, navItem.permission as never, profile?.permissions)) return null;
      return { href: navItem.href!, label: navItem.label!, icon: bottomNavIconMap[href] || navItem.icon, permission: navItem.permission };
    })
    .filter(Boolean) as { href: string; label: string; icon: ReactNode; permission?: string }[];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border flex justify-around items-center h-14 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-all duration-200 ${
              isActive ? "text-primary" : "text-muted-foreground/60 hover:text-primary"
            }`}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

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
      <div className="min-h-screen flex items-center justify-center bg-[#FFFDFB]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-light tracking-wide">Loading...</p>
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFDFB] gap-5 px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50/80 flex items-center justify-center">
          <Shield className="h-8 w-8 text-danger" />
        </div>
        <h1 className="text-2xl font-heading font-semibold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground text-sm text-center max-w-xs">You do not have permission to access this page.</p>
        <Link href="/admin" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl text-sm hover:bg-primary-hover transition-all duration-200 shadow-[0_10px_30px_rgba(107,0,46,0.20)]">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
      </div>
    );
  }

  const filteredItems = navItems.filter((item) => {
    if (item.divider) return true;
    if (settings?.liteMode && item.liteModeHide) return false;
    if (!item.permission) return true;
    return hasPermission(profile?.role, item.permission as never, profile?.permissions);
  });

  return (
    <DataCacheProvider>
    <div className="min-h-screen bg-[#FFFDFB] flex flex-col lg:flex-row">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-border
        transform transition-all duration-300 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:z-auto
        flex flex-col shadow-sm
      `}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-[72px] px-5 border-b border-border shrink-0 bg-white">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-primary-foreground font-heading font-bold text-sm shadow-[0_4px_12px_rgba(107,0,46,0.25)]">
              P
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground leading-tight">{settings.shopName}</span>
                {settings?.liteMode && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider bg-primary text-primary-foreground">Lite</span>}
              </div>
              <span className="text-[10px] text-muted-foreground/60 font-light tracking-wider uppercase">Management</span>
            </div>
          </Link>
          <button className="lg:hidden p-2 hover:bg-muted rounded-xl transition-colors" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-0.5 scrollbar-thin">
          {filteredItems.map((item) => {
            if (item.divider) {
              return (
                <div key={item.section || `d-${Math.random()}`} className="pt-5 pb-2">
                  {item.section ? (
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/30 px-3">{item.section}</p>
                  ) : (
                    <div className="divider-gold mx-3" />
                  )}
                </div>
              );
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href!} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium shadow-[0_4px_12px_rgba(107,0,46,0.15)]"
                    : "text-sidebar-fg/80 hover:bg-sidebar-hover hover:text-primary"
                }`}
              >
                <span className={`shrink-0 ${isActive ? "text-primary-foreground" : "text-primary/70"}`}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border shrink-0">
          <button onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-muted-foreground/70 hover:bg-red-50/80 hover:text-danger transition-all duration-200"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-border h-[72px] flex items-center justify-between px-5 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 hover:bg-muted rounded-xl transition-colors" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5 text-foreground" />
            </button>
            <div className="hidden sm:flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{profile?.displayName || "User"}</span>
              <span className="px-2.5 py-0.5 rounded-full bg-muted text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{profile?.role || "staff"}</span>
              {settings?.liteMode && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">Lite Mode</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground/80 hover:text-primary hover:bg-muted rounded-xl transition-all duration-200 border border-border hover:border-primary/20">
              <Home className="h-3.5 w-3.5" /> View Shop
            </Link>
            <div className="relative">
              <button onClick={() => setProfileOpen(!profileOpen)}
                className="sm:hidden p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <Menu className="h-5 w-5 text-foreground" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-border rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.08)] p-2 space-y-0.5 z-40 animate-fade-in">
                  <div className="px-3 py-2.5">
                    <p className="text-sm font-semibold text-foreground truncate">{profile?.displayName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{profile?.role}</p>
                  </div>
                  <div className="border-t border-border mx-2" />
                  <Link href="/" className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-primary hover:bg-muted rounded-xl transition-all" onClick={() => setProfileOpen(false)}>
                    <Home className="h-4 w-4" /> View Shop
                  </Link>
                  <button onClick={() => { setProfileOpen(false); logout(); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-danger/80 hover:text-danger hover:bg-red-50/80 rounded-xl transition-all"
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

      <BottomNav profile={profile} pathname={pathname} />
      <div className="lg:hidden h-14" />
    </div>
    </DataCacheProvider>
  );
}
