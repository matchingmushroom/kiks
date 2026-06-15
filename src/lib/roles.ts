import { UserRole } from "@/types";

type Permission =
  | "manage_products"
  | "manage_categories"
  | "manage_orders"
  | "manage_sales"
  | "manage_invoices"
  | "manage_coupons"
  | "manage_debtors"
  | "view_reports"
  | "manage_inventory"
  | "manage_staff"
  | "manage_homepage"
  | "manage_settings"
  | "manage_backup";

const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    "manage_products",
    "manage_categories",
    "manage_orders",
    "manage_sales",
    "manage_invoices",
    "manage_coupons",
    "manage_debtors",
    "view_reports",
    "manage_inventory",
    "manage_staff",
    "manage_homepage",
    "manage_settings",
    "manage_backup",
  ],
  manager: [
    "manage_products",
    "manage_categories",
    "manage_orders",
    "manage_sales",
    "manage_invoices",
    "manage_coupons",
    "manage_debtors",
    "view_reports",
    "manage_inventory",
    "manage_homepage",
    "manage_settings",
    "manage_backup",
  ],
  staff: [
    "manage_orders",
    "manage_sales",
    "manage_inventory",
  ],
  accountant: [
    "manage_invoices",
    "manage_debtors",
    "view_reports",
    "manage_backup",
  ],
};

export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function canAccessRoute(role: UserRole | undefined, route: string): boolean {
  if (!role) return false;
  if (role === "admin") return true;

  const routePermissions: Record<string, Permission[]> = {
    products: ["manage_products"],
    categories: ["manage_categories"],
    orders: ["manage_orders"],
    sales: ["manage_sales"],
    invoices: ["manage_invoices"],
    coupons: ["manage_coupons"],
    debtors: ["manage_debtors"],
    inventory: ["manage_inventory"],
    homepage: ["manage_homepage"],
    settings: ["manage_settings"],
    backup: ["manage_backup"],
    staff: ["manage_staff"],
  };

  const routeName = route.split("/").filter(Boolean)[1] || "dashboard";
  const needed = routePermissions[routeName];
  if (!needed) return true;
  return needed.some((p) => hasPermission(role, p));
}
