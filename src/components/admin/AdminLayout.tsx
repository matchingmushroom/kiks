"use client";

import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { DataCacheProvider } from "@/contexts/DataCacheContext";
import { hasPermission } from "@/lib/roles";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Tags,
  FileText,
  Truck,
  Home,
  Shield,
  Rocket,
  ArrowLeft,
  DollarSign,
  CreditCard,
  Wallet,
  Sparkles,
  ClipboardList,
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
  { label: "Sales", href: "/admin/sales", icon: <ShoppingCart className="h-4 w-4" />, permission: "manage_sales" },
  { label: "Invoices", href: "/admin/invoices", icon: <FileText className="h-4 w-4" />, permission: "manage_invoices" },
  { label: "Orders", href: "/admin/orders", icon: <Truck className="h-4 w-4" />, permission: "manage_orders" },
  { label: "Coupons", href: "/admin/coupons", icon: <Tags className="h-4 w-4" />, permission: "manage_coupons" },
  { label: "Offers", href: "/admin/offers", icon: <Sparkles className="h-4 w-4" />, permission: "manage_offers" },
  { label: "Debtors", href: "/admin/debtors", icon: <Users className="h-4 w-4" />, permission: "manage_debtors" },
  { divider: true, section: "INVENTORY & SUPPLY" },
  { label: "Products", href: "/admin/products", icon: <Package className="h-4 w-4" />, permission: "manage_products" },
  { label: "Categories", href: "/admin/categories", icon: <Tags className="h-4 w-4" />, permission: "manage_categories" },
  { label: "Inventory", href: "/admin/inventory", icon: <BarChart3 className="h-4 w-4" />, permission: "manage_inventory" },
  { label: "Reconciliation", href: "/admin/reconciliation", icon: <ClipboardList className="h-4 w-4" />, permission: "manage_inventory" },
  { label: "Purchases", href: "/admin/purchases", icon: <DollarSign className="h-4 w-4" />, permission: "manage_purchases" },
  { label: "Suppliers", href: "/admin/suppliers", icon: <Truck className="h-4 w-4" />, permission: "manage_suppliers" },
  { label: "Creditors", href: "/admin/creditors", icon: <Users className="h-4 w-4" />, permission: "manage_creditors" },
  { divider: true, section: "FINANCE" },
  { label: "Expenses", href: "/admin/expenses", icon: <CreditCard className="h-4 w-4" />, permission: "manage_expenses" },
  { label: "Reports", href: "/admin/finance", icon: <Wallet className="h-4 w-4" />, permission: "view_reports" },
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

function getRoutePermission(href: string): string | undefined {
  const item = navItems.find((n) => n.href === href);
  return item?.permission;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, logout } = useAuth();
  const { settings } = useShopSettings();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/admin/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-muted-foreground">Loading...</p>
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <Shield className="h-12 w-12 text-red-400" />
        <h1 className="text-xl font-bold text-secondary">Access Denied</h1>
        <p className="text-muted-foreground text-sm">
          You do not have permission to access this page.
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
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
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-fg transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:z-auto`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <Link href="/admin" className="flex items-center gap-2">
            <img src={settings.logoUrl || "/logo.svg"} alt={settings.shopName} className="h-8" />
          </Link>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
          {filteredItems.map((item) => {
            if (item.divider) {
              return (
                <div key={item.section || `divider-${Math.random()}`} className="pt-3 pb-1">
                  {item.section ? (
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-fg/40 px-3">{item.section}</p>
                  ) : (
                    <hr className="border-white/10" />
                  )}
                </div>
              );
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-active text-white font-medium"
                    : "text-sidebar-fg/70 hover:bg-white/10 hover:text-sidebar-fg"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="no-print h-16 bg-white border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-4 ml-auto">
            <Link href="/" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              View Shop
            </Link>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {profile?.displayName}{" "}
              <span className="text-xs text-muted-foreground/60">({profile?.role})</span>
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
    </DataCacheProvider>
  );
}
