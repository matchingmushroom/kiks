"use client";

import { useState } from "react";
import { AppUser } from "@/types";
import { doc, updateDoc, Timestamp, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Shield, Save, X, Check } from "lucide-react";
import { hasPermission } from "@/lib/roles";

const ALL_PERMISSIONS = [
  "manage_products", "manage_categories", "manage_orders", "manage_sales",
  "manage_invoices", "manage_coupons", "manage_debtors", "view_reports",
  "manage_inventory", "manage_staff", "manage_homepage", "manage_settings",
  "manage_backup", "manage_purchases", "manage_expenses", "manage_offers",
  "manage_creditors", "manage_suppliers", "manage_customers",
  "manage_reconciliation", "view_morning_dashboard",
] as const;

const PERMISSION_LABELS: Record<string, string> = {
  manage_products: "Products", manage_categories: "Categories",
  manage_orders: "Orders", manage_sales: "Sales",
  manage_invoices: "Invoices", manage_coupons: "Coupons",
  manage_debtors: "Debtors", view_reports: "Reports",
  manage_inventory: "Inventory", manage_staff: "Staff",
  manage_homepage: "Homepage", manage_settings: "Settings",
  manage_backup: "Backup", manage_purchases: "Purchases",
  manage_expenses: "Expenses", manage_offers: "Offers",
  manage_creditors: "Creditors", manage_suppliers: "Suppliers",
  manage_customers: "Customers", manage_reconciliation: "Reconciliation",
  view_morning_dashboard: "Morning Dashboard",
};

interface UserCardProps {
  user: AppUser;
}

export default function UserCard({ user }: UserCardProps) {
  const [editing, setEditing] = useState(false);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setEditPermissions(user.permissions ?? []);
    setEditing(true);
  };

  const togglePermission = (perm: string) => {
    setEditPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        permissions: editPermissions.length > 0 ? editPermissions : deleteField(),
        updatedAt: Timestamp.fromDate(new Date()),
      });
      setEditing(false);
    } catch (e) {
      console.error("Save failed", e);
    }
    setSaving(false);
  };

  const resetToRoleDefaults = () => {
    setEditPermissions([]);
  };

  const activePerms = editing ? editPermissions : (user.permissions ?? []);
  const hasOverrides = activePerms.length > 0;

  return (
    <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {user.displayName?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-secondary text-sm truncate">{user.displayName}</p>
            <p className="text-xs text-muted-foreground">{user.email} <span className="capitalize">({user.role})</span></p>
          </div>
          {hasOverrides && !editing && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
              Custom
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editing ? (
            <>
              <Button size="sm" variant="ghost" onClick={resetToRoleDefaults} disabled={saving}>
                <X className="h-3.5 w-3.5" /> Reset
              </Button>
              <Button size="sm" variant="accent" onClick={savePermissions} disabled={saving}>
                <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Shield className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {ALL_PERMISSIONS.map((perm) => {
            const granted = editing
              ? editPermissions.includes(perm)
              : hasPermission(user.role, perm, user.permissions);
            const defaultGranted = hasPermission(user.role, perm, undefined);
            const isOverride = editing
              ? editPermissions.includes(perm) !== defaultGranted
              : (user.permissions && user.permissions.includes(perm) !== defaultGranted);

            return (
              <button
                key={perm}
                onClick={() => editing && togglePermission(perm)}
                disabled={!editing}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  granted
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-gray-50 text-gray-400 border-gray-200"
                } ${isOverride ? "ring-2 ring-amber-300" : ""} ${
                  editing ? "cursor-pointer hover:opacity-80" : "cursor-default"
                }`}
                title={isOverride ? "Overridden from role default" : editing ? "Click to toggle" : ""}
              >
                {granted && <Check className="h-3 w-3" />}
                {PERMISSION_LABELS[perm] || perm}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
