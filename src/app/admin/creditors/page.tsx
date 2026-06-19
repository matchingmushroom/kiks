"use client";

import { useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { Creditor } from "@/types";
import { formatCurrency, formatDate, formatDateTime, toDate } from "@/lib/utils";
import { resolveAccount } from "@/lib/accounts";
import { useAuth } from "@/contexts/AuthContext";
import {
  updateDoc, doc, Timestamp, arrayUnion, addDoc, collection,
  getDoc, query, where, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Search, X, Save, ChevronDown, ChevronUp, Plus, CheckCircle, Eye, LayoutGrid, List, AlertTriangle, Download, Mail } from "lucide-react";
import { exportCreditorsCSV, downloadBlob } from "@/lib/export";

export default function AdminCreditorsPage() {
  const { data: creditors, loading } = useFirestore<Creditor>("creditors", {
    constraints: [orderBy("createdAt", "desc")],
  });
  const { user, profile } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<{ amount: string; method: string; notes: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedCreditor, setSelectedCreditor] = useState<Creditor | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [reportRange, setReportRange] = useState<"all" | "ytd" | "mtd" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const canExport = profile?.role !== "staff";

  const filtered = useMemo(() => {
    let result = creditors.filter((c) => {
      const matchSearch = !search ||
        c.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
        c.supplierPhone?.includes(search);
      const matchStatus = !statusFilter || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
    let start = 0, end = Infinity;
    if (reportRange === "ytd") { start = new Date(new Date().getFullYear(), 0, 1).getTime(); }
    else if (reportRange === "mtd") { start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(); }
    else if (reportRange === "custom" && dateFrom && dateTo) {
      start = new Date(dateFrom).getTime();
      end = new Date(dateTo).getTime() + 86400000;
    }
    if (start > 0 || end < Infinity) {
      result = result.filter((c) => { const d = toDate(c.lastTransactionDate).getTime(); return d >= start && d <= end; });
    }
    return result;
  }, [creditors, search, statusFilter, reportRange, dateFrom, dateTo]);

  const activeCount = creditors.filter((c) => c.status === "active").length;
  const totalOutstanding = creditors
    .filter((c) => c.status === "active")
    .reduce((s, c) => s + c.balanceDue, 0);

  const startPayment = (id: string) => {
    setExpandedId(id);
    setPaymentForm({ amount: "", method: "cash", notes: "" });
  };

  const recordPayment = async (creditor: Creditor) => {
    if (!paymentForm || !paymentForm.amount) return;
    const amount = Number(paymentForm.amount);
    if (amount <= 0) return;
    setSaving(true);
    setSyncError(null);
    try {
      const newBalance = Math.max(0, creditor.balanceDue - amount);
      const entry = {
        date: Timestamp.fromDate(new Date()),
        amount,
        method: paymentForm.method,
        notes: paymentForm.notes,
      };

      await updateDoc(doc(db, "creditors", creditor.id), {
        amountPaid: (creditor.amountPaid || 0) + amount,
        balanceDue: newBalance,
        status: newBalance <= 0 ? "cleared" : "active",
        paymentHistory: arrayUnion(entry),
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

      // Sync payment to linked purchase(s)
      let syncErrMsg: string | null = null;
      for (const purchaseId of creditor.purchaseIds || []) {
        try {
          const purchaseRef = doc(db, "purchases", purchaseId);
          const purchaseSnap = await getDoc(purchaseRef);
          if (!purchaseSnap.exists()) continue;
          const purchaseData = purchaseSnap.data();
          const oldPaid = purchaseData.paidAmount || 0;
          const newPaid = oldPaid + amount;
          const newStatus = newPaid >= purchaseData.totalAmount ? "paid" : "partially_paid";
          await updateDoc(purchaseRef, {
            paidAmount: newPaid,
            paymentStatus: newStatus,
            updatedAt: Timestamp.fromDate(new Date()),
          });
        } catch (e) {
          syncErrMsg = "Payment recorded but purchase sync failed. Please update manually.";
          console.error("Purchase sync failed for purchase", purchaseId, e);
        }
      }
      if (syncErrMsg) setSyncError(syncErrMsg);

      setPaymentForm(null);
    } catch (e) {
      console.error("Payment failed", e);
    }
    setSaving(false);
  };

  const handleDownloadCSV = () => {
    const csv = exportCreditorsCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `creditors-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const snap = await getDoc(doc(db, "shop_settings", "emailBackupConfig"));
      if (!snap.exists()) { alert("Configure Email & Backup in Settings first."); return; }
      const cfg = snap.data() as any;
      if (!cfg.gasWebhookUrl) { alert("Configure GAS Webhook URL in Settings first."); return; }
      const csv = exportCreditorsCSV(filtered);
      const period = new Date().toISOString().slice(0, 10);
      const res = await fetch(cfg.gasWebhookUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendReport", module: "creditors", csv, filename: `creditors-${period}.csv`, period, emailTo: cfg.emailTo || "", driveFolderId: cfg.driveFolderId || "" }),
      });
      const data = await res.json();
      if (data.status === "ok") alert("Report sent!"); else alert("Error: " + (data.message || "Unknown"));
    } catch (e: any) { alert("Failed: " + (e.message || e)); }
    setSendingEmail(false);
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Creditors</h1>
            <p className="text-sm text-muted-foreground">
              {activeCount} active · {formatCurrency(totalOutstanding)} outstanding
            </p>
          </div>
        </div>

        {syncError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm text-yellow-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />{syncError}
            <button onClick={() => setSyncError(null)} className="ml-auto p-1 hover:bg-yellow-100 rounded"><X className="h-4 w-4" /></button>
          </div>
        )}

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
          {canExport && (<>
            <select value={reportRange} onChange={(e) => setReportRange(e.target.value as any)}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="all">All Time</option>
              <option value="ytd">Year to Date</option>
              <option value="mtd">Month to Day</option>
              <option value="custom">Custom</option>
            </select>
            {reportRange === "custom" && (
              <>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </>
            )}
            <button onClick={handleDownloadCSV}
              className="px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted flex items-center gap-1.5">
              <Download className="h-4 w-4" /> CSV
            </button>
            <button onClick={handleSendEmail} disabled={sendingEmail}
              className="px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted flex items-center gap-1.5 disabled:opacity-50">
              <Mail className="h-4 w-4" /> {sendingEmail ? "Sending..." : "Send"}
            </button>
          </>)}
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
            {filtered.map((creditor) => (
              <div key={creditor.id} onClick={() => setSelectedCreditor(creditor)}
                className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-secondary text-sm truncate">{creditor.supplierName}</p>
                    <p className="text-xs text-muted-foreground">{creditor.supplierPhone}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    creditor.status === "active" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                  }`}>
                    {creditor.status}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-bold text-secondary">{formatCurrency(creditor.balanceDue)}</p>
                  <p className="text-xs text-muted-foreground">of {formatCurrency(creditor.totalAmount)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((creditor) => {
              const isExpanded = expandedId === creditor.id;

              return (
                <div key={creditor.id} className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                  <div
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0" onClick={() => setSelectedCreditor(creditor)}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-secondary">{creditor.supplierName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          creditor.status === "active"
                            ? "bg-red-50 text-red-700"
                            : "bg-green-50 text-green-700"
                        }`}>
                          {creditor.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{creditor.supplierPhone}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-secondary">{formatCurrency(creditor.balanceDue)}</p>
                      <p className="text-xs text-muted-foreground">of {formatCurrency(creditor.totalAmount)}</p>
                    </div>
                    <button onClick={() => setSelectedCreditor(creditor)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg" title="View details">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button onClick={() => setExpandedId(isExpanded ? null : creditor.id)} className="p-1 text-muted-foreground hover:bg-muted rounded-lg">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-4 bg-gray-50/50 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Phone</p>
                          <p>{creditor.supplierPhone || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Amount</p>
                          <p className="font-medium">{formatCurrency(creditor.totalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Paid</p>
                          <p className="font-medium text-green-600">{formatCurrency(creditor.amountPaid)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Due Date</p>
                          <p className="font-medium">{creditor.dueDate ? formatDate(creditor.dueDate) : "—"}</p>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase">Payment History</h3>
                        {creditor.paymentHistory && creditor.paymentHistory.length > 0 ? (
                          <div className="bg-white border border-border rounded-lg divide-y divide-border">
                            {creditor.paymentHistory.map((p, i) => (
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

                      {creditor.status === "active" && (
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
                                    max={creditor.balanceDue} />
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
                                  <Button onClick={() => recordPayment(creditor)} disabled={saving || !paymentForm.amount || Number(paymentForm.amount) <= 0} variant="accent">
                                    <Save className="h-4 w-4" /> {saving ? "..." : "Record"}
                                  </Button>
                                  <button onClick={() => setPaymentForm(null)} className="p-2 text-muted-foreground hover:bg-muted rounded">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => startPayment(creditor.id)}
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

      {/* Creditor Detail Modal */}
      {selectedCreditor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedCreditor(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-secondary">Creditor Details</h2>
              <button onClick={() => setSelectedCreditor(null)} className="p-1 hover:bg-muted rounded">
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
                  selectedCreditor.status === "active" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                }`}>
                  {selectedCreditor.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="font-bold text-secondary">{formatCurrency(selectedCreditor.totalAmount)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="font-bold text-green-600">{formatCurrency(selectedCreditor.amountPaid || 0)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Balance Due</p>
                  <p className="font-bold text-red-600">{formatCurrency(selectedCreditor.balanceDue)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="font-bold">{selectedCreditor.dueDate ? formatDate(selectedCreditor.dueDate) : "—"}</p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase">Payment History</h3>
                {selectedCreditor.paymentHistory && selectedCreditor.paymentHistory.length > 0 ? (
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {selectedCreditor.paymentHistory.map((p, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          <span className="text-xs text-muted-foreground">
                            {formatDate((p.date as unknown as { toMillis?: () => number })?.toMillis?.() || (p.date as unknown as number))}
                          </span>
                          <span className="capitalize text-xs text-muted-foreground">{p.method}</span>
                        </div>
                        <span className="font-medium">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No payments recorded.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                <p>Created: {formatDateTime(selectedCreditor.createdAt)}</p>
                <p>Updated: {formatDateTime(selectedCreditor.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
