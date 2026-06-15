"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { Debtor } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  updateDoc, doc, Timestamp, arrayUnion, addDoc, collection,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Search, X, Save, ChevronDown, ChevronUp, Plus, CheckCircle } from "lucide-react";

function getDaysOverdue(dueDate: number): number {
  return Math.floor((Date.now() - dueDate) / (1000 * 60 * 60 * 24));
}

export default function AdminDebtorsPage() {
  const { data: debtors, loading } = useFirestore<Debtor>("debtors", {
    constraints: [orderBy("createdAt", "desc")],
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<{ amount: string; method: string; notes: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = debtors.filter((d) => {
    const matchSearch = !search ||
      d.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      d.customerPhone?.includes(search);
    const matchStatus = !statusFilter || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCount = debtors.filter((d) => d.status === "active").length;
  const totalOutstanding = debtors
    .filter((d) => d.status === "active")
    .reduce((s, d) => s + d.balanceDue, 0);

  const startPayment = (id: string) => {
    setExpandedId(id);
    setPaymentForm({ amount: "", method: "cash", notes: "" });
  };

  const recordPayment = async (debtor: Debtor) => {
    if (!paymentForm || !paymentForm.amount) return;
    const amount = Number(paymentForm.amount);
    if (amount <= 0) return;
    setSaving(true);
    try {
      const newBalance = Math.max(0, debtor.balanceDue - amount);
      const entry = {
        date: Timestamp.fromDate(new Date()),
        amount,
        method: paymentForm.method,
        notes: paymentForm.notes,
      };

      await updateDoc(doc(db, "debtors", debtor.id), {
        amountPaid: (debtor.amountPaid || 0) + amount,
        balanceDue: newBalance,
        status: newBalance <= 0 ? "cleared" : "active",
        paymentHistory: arrayUnion(entry),
        updatedAt: Timestamp.fromDate(new Date()),
      });

      const accountId = paymentForm.method === "cash" ? "cash_in_hand" : "bank_account";
      await addDoc(collection(db, "accountTransactions"), {
        accountId,
        type: "credit",
        amount,
        description: `Debtor payment from ${debtor.customerName}`,
        date: Timestamp.fromDate(new Date()),
        referenceType: "debtor_payment",
        referenceId: debtor.id,
        recordedBy: "",
        createdAt: Timestamp.fromDate(new Date()),
      });

      setPaymentForm(null);
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
            <h1 className="text-2xl font-bold text-secondary">Debtors</h1>
            <p className="text-sm text-muted-foreground">
              {activeCount} active · {formatCurrency(totalOutstanding)} outstanding
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search by name or phone..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="active">Active</option>
            <option value="">All Status</option>
            <option value="cleared">Cleared</option>
          </select>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No debtors found.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((debtor) => {
              const overdue = debtor.dueDate ? getDaysOverdue(debtor.dueDate as unknown as number) : 0;
              const isExpanded = expandedId === debtor.id;

              return (
                <div key={debtor.id} className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                  <div
                    className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : debtor.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-secondary">{debtor.customerName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          debtor.status === "active"
                            ? "bg-red-50 text-red-700"
                            : "bg-green-50 text-green-700"
                        }`}>
                          {debtor.status}
                        </span>
                        {debtor.status === "active" && overdue > 0 && (
                          <span className="text-xs text-red-500 font-medium">{overdue}d overdue</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{debtor.customerPhone}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-secondary">{formatCurrency(debtor.balanceDue)}</p>
                      <p className="text-xs text-muted-foreground">of {formatCurrency(debtor.totalAmount)}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-4 bg-gray-50/50 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Phone</p>
                          <p>{debtor.customerPhone || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Address</p>
                          <p>{debtor.customerAddress || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Amount</p>
                          <p className="font-medium">{formatCurrency(debtor.totalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Paid</p>
                          <p className="font-medium text-green-600">{formatCurrency(debtor.amountPaid)}</p>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase">Payment History</h3>
                        {debtor.paymentHistory && debtor.paymentHistory.length > 0 ? (
                          <div className="bg-white border border-border rounded-lg divide-y divide-border">
                            {debtor.paymentHistory.map((p, i) => (
                              <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                                <div className="flex items-center gap-3">
                                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                  <span className="text-xs text-muted-foreground">
                                    {formatDate((p.date as unknown as Timestamp)?.toMillis?.() || (p.date as unknown as number))}
                                  </span>
                                  <span className="capitalize text-xs text-muted-foreground">{p.method}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-medium">{formatCurrency(p.amount)}</span>
                                  {p.notes && <span className="text-xs text-muted-foreground">{p.notes}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No payments recorded.</p>
                        )}
                      </div>

                      {debtor.status === "active" && (
                        <div className="border-t border-border pt-4">
                          {paymentForm && paymentForm.amount !== undefined ? (
                            <div className="space-y-3">
                              <h4 className="text-sm font-medium text-secondary">Record Payment</h4>
                              <div className="flex flex-wrap gap-3">
                                <div className="flex-1 min-w-[120px]">
                                  <label className="block text-xs text-muted-foreground mb-1">Amount (NPR)</label>
                                  <input type="number" value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    max={debtor.balanceDue} />
                                </div>
                                <div className="w-32">
                                  <label className="block text-xs text-muted-foreground mb-1">Method</label>
                                  <select value={paymentForm.method}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="qr">QR Payment</option>
                                  </select>
                                </div>
                                <div className="flex-1 min-w-[120px]">
                                  <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                                  <input type="text" value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                                </div>
                                <div className="flex items-end gap-2">
                                  <Button onClick={() => recordPayment(debtor)} disabled={saving || !paymentForm.amount || Number(paymentForm.amount) <= 0} variant="accent">
                                    <Save className="h-4 w-4" /> {saving ? "..." : "Record"}
                                  </Button>
                                  <button onClick={() => setPaymentForm(null)} className="p-2 text-muted-foreground hover:bg-muted rounded">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => startPayment(debtor.id)}
                              className="flex items-center gap-1 text-sm text-primary hover:underline">
                              <Plus className="h-4 w-4" /> Record Payment
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
