"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { Creditor, Account } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { resolveAccount, ACCOUNTS } from "@/lib/accounts";
import { useAuth } from "@/contexts/AuthContext";
import {
  updateDoc, doc, Timestamp, addDoc, collection, getDocs, query, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Search, X, Save, ChevronDown, ChevronUp, Plus, CheckCircle, LayoutGrid, List } from "lucide-react";

export default function AdminCreditorsPage() {
  const { data: creditors, loading } = useFirestore<Creditor>("creditors", {
    constraints: [orderBy("lastTransactionDate", "desc")],
  });
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<{ amount: string; method: string; notes: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedCreditor, setSelectedCreditor] = useState<Creditor | null>(null);
  const [gridPayment, setGridPayment] = useState<{ amount: string; method: string; notes: string } | null>(null);

  const activeCreditors = creditors.filter((c) => c.currentBalance > 0);
  const totalOutstanding = activeCreditors.reduce((s, c) => s + c.currentBalance, 0);

  const filtered = creditors.filter((c) => {
    if (!search) return true;
    return c.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
      c.supplierPhone?.includes(search);
  });

  const startPayment = (id: string) => {
    setExpandedId(id);
    setPaymentForm({ amount: "", method: "cash", notes: "" });
  };

  const recordPayment = async (creditor: Creditor) => {
    if (!paymentForm || !paymentForm.amount) return;
    const amount = Number(paymentForm.amount);
    if (amount <= 0) return;
    setSaving(true);
    try {
      const newBalance = Math.max(0, creditor.currentBalance - amount);

      await updateDoc(doc(db, "creditors", creditor.id), {
        currentBalance: newBalance,
        lastTransactionDate: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });

      await addDoc(collection(db, "accountTransactions"), {
        accountId: resolveAccount(paymentForm.method),
        type: "debit",
        amount,
        description: `Payment to supplier ${creditor.supplierName}`,
        date: Timestamp.fromDate(new Date()),
        referenceType: "creditor_payment",
        referenceId: creditor.id,
        recordedBy: user?.uid || "",
        createdAt: Timestamp.fromDate(new Date()),
      });

      setPaymentForm(null);
    } catch (e) {
      console.error("Payment failed", e);
    }
    setSaving(false);
  };

  const recordGridPayment = async (creditor: Creditor) => {
    if (!gridPayment || !gridPayment.amount) return;
    const amount = Number(gridPayment.amount);
    if (amount <= 0) return;
    setSaving(true);
    try {
      const newBalance = Math.max(0, creditor.currentBalance - amount);
      await updateDoc(doc(db, "creditors", creditor.id), {
        currentBalance: newBalance,
        lastTransactionDate: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });
      await addDoc(collection(db, "accountTransactions"), {
        accountId: resolveAccount(gridPayment.method),
        type: "debit",
        amount,
        description: `Payment to supplier ${creditor.supplierName}`,
        date: Timestamp.fromDate(new Date()),
        referenceType: "creditor_payment",
        referenceId: creditor.id,
        recordedBy: user?.uid || "",
        createdAt: Timestamp.fromDate(new Date()),
      });
      setGridPayment(null);
      setSelectedCreditor({ ...creditor, currentBalance: newBalance });
    } catch (e) {
      console.error("Payment failed", e);
    }
    setSaving(false);
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Creditors</h1>
            <p className="text-sm text-muted-foreground">
              {activeCreditors.length} active · {formatCurrency(totalOutstanding)} outstanding
            </p>
          </div>
        </div>

        <div className="relative mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search by supplier name or phone..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("list")}
              className={`p-1.5 rounded ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No creditors found.</p>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((c) => (
              <div key={c.id} onClick={() => { setSelectedCreditor(c); setGridPayment(null); }}
                className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-secondary text-sm truncate">{c.supplierName}</p>
                    {c.supplierPhone && <p className="text-xs text-muted-foreground">{c.supplierPhone}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    c.currentBalance > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                  }`}>
                    {c.currentBalance > 0 ? `Due` : "Cleared"}
                  </span>
                </div>
                <p className="text-lg font-bold text-secondary">{formatCurrency(c.currentBalance)}</p>
                <p className="text-xs text-muted-foreground">Last tx: {formatDate(c.lastTransactionDate)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <div key={c.id} className="bg-white border border-border rounded-xl shadow-sm">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-secondary text-sm">{c.supplierName}</p>
                      {c.supplierPhone && <p className="text-xs text-muted-foreground">{c.supplierPhone}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      c.currentBalance > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                    }`}>
                      {c.currentBalance > 0 ? `Due ${formatCurrency(c.currentBalance)}` : "Cleared"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last transaction: {formatDate(c.lastTransactionDate)}
                  </p>
                  {c.currentBalance > 0 && (
                    <div className="flex gap-2 mt-3">
                      <Button onClick={() => startPayment(c.id)} size="sm" variant="accent" className="text-xs">
                        <Plus className="h-3 w-3" /> Record Payment
                      </Button>
                      <Button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} size="sm" variant="outline" className="text-xs">
                        {expandedId === c.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </div>
                  )}
                </div>

                {expandedId === c.id && paymentForm && (
                  <div className="border-t border-border px-4 py-3 bg-muted/30">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Amount (NPR)</label>
                        <input type="number" value={paymentForm.amount}
                          onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Payment Method</label>
                        <select value={paymentForm.method}
                          onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                          <option value="cash">Cash</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="qr">QR Payment</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                        <input type="text" value={paymentForm.notes}
                          onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => recordPayment(c)} disabled={saving || !paymentForm.amount || Number(paymentForm.amount) <= 0} size="sm" variant="accent">
                        <Save className="h-3.5 w-3.5" /> {saving ? "Processing..." : "Confirm Payment"}
                      </Button>
                      <Button onClick={() => setPaymentForm(null)} size="sm" variant="outline">Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Grid Detail Modal */}
        {selectedCreditor && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedCreditor(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-secondary">Creditor Details</h2>
                <button onClick={() => { setSelectedCreditor(null); setGridPayment(null); }} className="p-1 hover:bg-muted rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-secondary">{selectedCreditor.supplierName}</p>
                    <p className="text-sm text-muted-foreground">{selectedCreditor.supplierPhone || "—"}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedCreditor.currentBalance > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                  }`}>
                    {selectedCreditor.currentBalance > 0 ? `Due ${formatCurrency(selectedCreditor.currentBalance)}` : "Cleared"}
                  </span>
                </div>

                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Current Balance</p>
                  <p className="font-bold text-lg text-secondary">{formatCurrency(selectedCreditor.currentBalance)}</p>
                </div>

                {selectedCreditor.currentBalance > 0 && (
                  <div className="border-t border-border pt-4">
                    {gridPayment ? (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-secondary">Record Payment</h4>
                        <div className="flex flex-wrap gap-3">
                          <div className="flex-1 min-w-[120px]">
                            <label className="block text-xs text-muted-foreground mb-1">Amount (NPR)</label>
                            <input type="number" value={gridPayment.amount}
                              onChange={(e) => setGridPayment({ ...gridPayment, amount: e.target.value })}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm" max={selectedCreditor.currentBalance} />
                          </div>
                          <div className="w-32">
                            <label className="block text-xs text-muted-foreground mb-1">Method</label>
                            <select value={gridPayment.method}
                              onChange={(e) => setGridPayment({ ...gridPayment, method: e.target.value })}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                              <option value="cash">Cash</option>
                              <option value="bank_transfer">Bank Transfer</option>
                              <option value="qr">QR Payment</option>
                            </select>
                          </div>
                          <div className="flex-1 min-w-[120px]">
                            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                            <input type="text" value={gridPayment.notes}
                              onChange={(e) => setGridPayment({ ...gridPayment, notes: e.target.value })}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                          </div>
                          <div className="flex items-end gap-2">
                            <Button onClick={() => recordGridPayment(selectedCreditor)} disabled={saving || !gridPayment.amount || Number(gridPayment.amount) <= 0} variant="accent">
                              <Save className="h-4 w-4" /> {saving ? "..." : "Pay"}
                            </Button>
                            <button onClick={() => setGridPayment(null)} className="p-2 text-muted-foreground hover:bg-muted rounded">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setGridPayment({ amount: String(selectedCreditor.currentBalance), method: "cash", notes: "" })}
                        className="flex items-center gap-1 text-sm text-primary hover:underline">
                        <Plus className="h-4 w-4" /> Record Payment
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                  <p>Last transaction: {formatDate(selectedCreditor.lastTransactionDate)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
