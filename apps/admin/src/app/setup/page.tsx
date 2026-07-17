"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { initializeShopData } from "@/lib/seed";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, collection, getDocs, deleteDoc, writeBatch } from "firebase/firestore";
import { Shield, CheckCircle, AlertCircle, Trash2, RotateCcw } from "lucide-react";

export default function SetupPage() {
  const { profile } = useAuth();
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingAll, setDeletingAll] = useState(false);
  const [resetting, setResetting] = useState(false);

  const isAdmin = profile?.role === "admin";

  const handleInit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await initializeShopData();
      setResults(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Initialization failed");
    }
    setLoading(false);
  };

  const handleDeleteAll = async () => {
    if (!confirm("Delete ALL products, sales, purchases, orders, and expenses? This cannot be undone.")) return;
    if (!confirm("Are you sure? This will permanently delete all data in the database.")) return;
    setDeletingAll(true);
    try {
      const collections = ["products", "sales", "purchases", "orders", "expenses", "invoices", "debtors", "creditors", "coupons"];
      let total = 0;
      for (const name of collections) {
        const snap = await getDocs(collection(db, name));
        const ids = snap.docs.map((d) => d.id);
        for (let i = 0; i < ids.length; i += 50) {
          await Promise.all(ids.slice(i, i + 50).map((id) => deleteDoc(doc(db, name, id))));
        }
        total += ids.length;
      }
      alert(`Deleted ${total} documents from ${collections.length} collections.`);
    } catch (e) {
      alert("Delete all failed. Check console for details.");
      console.error(e);
    }
    setDeletingAll(false);
  };

  const handleResetAllExceptStaffAndSettings = async () => {
    if (!confirm("Delete ALL business data except staff & settings? This includes sales, purchases, products, expenses, debtors, creditors, stock, etc.")) return;
    if (!confirm("This cannot be undone. Are you sure?")) return;
    setResetting(true);
    try {
      const toDelete = ["products", "sales", "purchases", "orders", "expenses", "invoices", "debtors", "creditors", "coupons", "offers", "inventory", "reconciliation", "backups", "accountTransactions", "journalEntries", "dailyBalances", "homepage_sections"];
      let total = 0;
      const batch = writeBatch(db);
      for (const name of toDelete) {
        const snap = await getDocs(collection(db, name));
        snap.docs.forEach((d) => batch.delete(d.ref));
        total += snap.docs.length;
      }
      await batch.commit();
      alert(`Reset complete. Deleted ${total} documents from ${toDelete.length} collections. Staff & Settings preserved.`);
    } catch (e) {
      alert("Reset failed. Check console.");
      console.error(e);
    }
    setResetting(false);
  };

  const hasFailures = results.some((r) => r.startsWith("❌"));

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-secondary">First-Time Setup</h1>
        </div>
        <p className="text-muted-foreground mb-6">
          Initialize default data for your shop — settings, categories, and homepage sections.
          Run this only once when setting up a new Firestore project.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          <strong>⚠️ Note:</strong> This will create default documents in Firestore.
          If documents already exist, they will be overwritten.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {results.length > 0 && (
          <div className={`rounded-xl p-4 mb-6 border ${hasFailures ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              {hasFailures ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              <span className="text-sm font-medium">{hasFailures ? "Some items failed" : "All data initialized"}</span>
            </div>
            <ul className="space-y-1">
              {results.map((r, i) => (
                <li key={i} className="text-sm">{r}</li>
              ))}
            </ul>
          </div>
        )}

        <Button onClick={handleInit} disabled={loading} variant="accent" size="lg">
          {loading ? "Initializing..." : "Initialize Shop Data"}
        </Button>

        {isAdmin && (
          <>
            <hr className="border-border my-8" />
            <div className="bg-white border border-orange-200 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-4 border-b border-orange-200">
                <RotateCcw className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-orange-600">Reset All Data (Keep Staff & Settings)</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Delete all business records — products, sales, purchases, expenses, debtors, creditors,
                stock, invoices, orders, journal entries — while preserving staff accounts, shop settings,
                categories, chart of accounts, and partner capital.
              </p>
              <Button onClick={handleResetAllExceptStaffAndSettings} disabled={resetting} variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50">
                <RotateCcw className="h-4 w-4" /> {resetting ? "Resetting..." : "Reset All Except Staff & Settings"}
              </Button>
            </div>
            <hr className="border-border my-8" />
            <div className="bg-white border border-red-200 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-4 border-b border-red-200">
                <Trash2 className="h-5 w-5 text-red-500" />
                <h2 className="text-lg font-semibold text-red-600">Delete All Data</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Permanently delete all documents from Products, Sales, Purchases, Orders, Expenses,
                Invoices, Debtors, Creditors, and Coupons. <strong className="text-red-600">This cannot be undone.</strong>
              </p>
              <Button onClick={handleDeleteAll} disabled={deletingAll} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> {deletingAll ? "Deleting..." : "Delete All Data"}
              </Button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
