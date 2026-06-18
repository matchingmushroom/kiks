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
  | "manage_backup"
  | "manage_purchases"
  | "manage_expenses"
  | "manage_offers"
  | "manage_creditors"
  | "manage_suppliers"
  | "manage_customers"
  | "manage_access_control"
  | "manage_reconciliation";

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
    "manage_purchases",
    "manage_expenses",
    "manage_offers",
    "manage_creditors",
    "manage_suppliers",
    "manage_customers",
    "manage_access_control",
    "manage_reconciliation",
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
    "manage_backup",
    "manage_purchases",
    "manage_expenses",
    "manage_offers",
    "manage_suppliers",
    "manage_customers",
    "manage_reconciliation",
  ],
  staff: [
    "manage_orders",
    "manage_sales",
    "manage_invoices",
    "manage_customers",
    "manage_inventory",
  ],
  accountant: [
    "manage_invoices",
    "manage_debtors",
    "view_reports",
    "manage_backup",
    "manage_purchases",
    "manage_expenses",
    "manage_creditors",
    "manage_suppliers",
    "manage_customers",
  ],
};

export function hasPermission(role: UserRole | undefined, permission: Permission, userPermissions?: string[]): boolean {
  if (!role) return false;
  const effective = userPermissions ?? rolePermissions[role] ?? [];
  return effective.includes(permission);
}

export function canAccessRoute(role: UserRole | undefined, route: string, userPermissions?: string[]): boolean {
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
    reconciliation: ["manage_reconciliation", "manage_inventory"],
    homepage: ["manage_homepage"],
    settings: ["manage_settings"],
    backup: ["manage_backup"],
    staff: ["manage_staff"],
    purchases: ["manage_purchases"],
    expenses: ["manage_expenses"],
    finance: ["view_reports"],
    offers: ["manage_offers"],
    creditors: ["manage_creditors"],
    suppliers: ["manage_suppliers"],
    customers: ["manage_customers"],
    "access-control": ["manage_access_control"],
  };

  const routeName = route.split("/").filter(Boolean)[1] || "dashboard";
  const needed = routePermissions[routeName];
  if (!needed) return true;
  return needed.some((p) => hasPermission(role, p, userPermissions));
}
