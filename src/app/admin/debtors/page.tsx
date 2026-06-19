"use client";

import { useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { Debtor } from "@/types";
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
import { exportDebtorsCSV, downloadBlob } from "@/lib/export";

function getDaysOverdue(dueDate: unknown): number {
  const d = toDate(dueDate);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export default function AdminDebtorsPage() {
  const { data: debtors, loading } = useFirestore<Debtor>("debtors", {
    constraints: [orderBy("createdAt", "desc")],
  });
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<{ amount: string; method: string; notes: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [reportRange, setReportRange] = useState<"all" | "ytd" | "mtd" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const filtered = useMemo(() => {
    let result = debtors.filter((d) => {
      const matchSearch = !search ||
        d.customerName?.toLowerCase().includes(search.toLowerCase()) ||
        d.customerPhone?.includes(search);
      const matchStatus = !statusFilter || d.status === statusFilter;
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
      result = result.filter((d) => { const dt = toDate(d.createdAt).getTime(); return dt >= start && dt <= end; });
    }
    return result;
  }, [debtors, search, statusFilter, reportRange, dateFrom, dateTo]);

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

      await addDoc(collection(db, "accountTransactions"), {
        accountId: resolveAccount(paymentForm.method),
        type: "credit",
        amount,
        description: `Debtor payment from ${debtor.customerName}`,
        date: Timestamp.fromDate(new Date()),
        referenceType: "debtor_payment",
        referenceId: debtor.id,
        recordedBy: user?.uid || "",
        createdAt: Timestamp.fromDate(new Date()),
      });

      // Sync payment to linked sale(s) and invoice(s)
      let syncErrMsg: string | null = null;
      for (const saleId of debtor.orderIds || []) {
        try {
          const saleRef = doc(db, "sales", saleId);
          const saleSnap = await getDoc(saleRef);
          if (!saleSnap.exists()) continue;
          const saleData = saleSnap.data();
          const oldReceived = saleData.payment?.receivedAmount || 0;
          const oldBalance = saleData.payment?.balanceDue || 0;
          const newReceived = oldReceived + amount;
          const newBalance = Math.max(0, oldBalance - amount);
          await updateDoc(saleRef, {
            "payment.receivedAmount": newReceived,
            "payment.balanceDue": newBalance,
            updatedAt: Timestamp.fromDate(new Date()),
          });
          // Update linked invoice
          const invQ = query(collection(db, "invoices"), where("relatedSaleId", "==", saleId));
          const invSnap = await getDocs(invQ);
          for (const invDoc of invSnap.docs) {
            await updateDoc(invDoc.ref, {
              cashReceived: newReceived,
              balanceDue: newBalance,
              paymentStatus: newBalance <= 0 ? "full" : "partial",
              updatedAt: Timestamp.fromDate(new Date()),
            });
          }
        } catch (e) {
          syncErrMsg = "Payment recorded but sale/invoice sync failed. Please update manually.";
          console.error("Sale/invoice sync failed for sale", saleId, e);
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
    const csv = exportDebtorsCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `debtors-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const snap = await getDoc(doc(db, "shop_settings", "emailBackupConfig"));
      if (!snap.exists()) { alert("Configure Email & Backup in Settings first."); return; }
      const cfg = snap.data() as any;
      if (!cfg.gasWebhookUrl) { alert("Configure GAS Webhook URL in Settings first."); return; }
      const csv = exportDebtorsCSV(filtered);
      const period = new Date().toISOString().slice(0, 10);
      const res = await fetch(cfg.gasWebhookUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendReport", module: "debtors", csv, filename: `debtors-${period}.csv`, period, emailTo: cfg.emailTo || "", driveFolderId: cfg.driveFolderId || "" }),
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
            <h1 className="text-2xl font-bold text-secondary">Debtors</h1>
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
          <p className="text-muted-foreground text-center py-12">No debtors found.</p>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((debtor) => {
              const overdue = debtor.dueDate ? getDaysOverdue(debtor.dueDate) : 0;
              return (
                <div key={debtor.id} onClick={() => setSelectedDebtor(debtor)}
                  className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2 cursor-pointer hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-secondary text-sm truncate">{debtor.customerName}</p>
                      <p className="text-xs text-muted-foreground">{debtor.customerPhone}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      debtor.status === "active" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                    }`}>
                      {debtor.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-secondary">{formatCurrency(debtor.balanceDue)}</p>
                    <p className="text-xs text-muted-foreground">of {formatCurrency(debtor.totalAmount)}</p>
                  </div>
                  {debtor.status === "active" && overdue > 0 && (
                    <span className="inline-block text-xs text-red-500 font-medium">{overdue}d overdue</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((debtor) => {
              const overdue = debtor.dueDate ? getDaysOverdue(debtor.dueDate) : 0;
              const isExpanded = expandedId === debtor.id;

              return (
                <div key={debtor.id} className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                  <div
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0" onClick={() => setSelectedDebtor(debtor)}>
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
                    <button onClick={() => setSelectedDebtor(debtor)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg" title="View details">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button onClick={() => setExpandedId(isExpanded ? null : debtor.id)} className="p-1 text-muted-foreground hover:bg-muted rounded-lg">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
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

      {/* Debtor Detail Modal */}
      {selectedDebtor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedDebtor(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-secondary">Debtor Details</h2>
              <button onClick={() => setSelectedDebtor(null)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium text-secondary">{selectedDebtor.customerName}</p>
                  <p className="text-sm text-muted-foreground">{selectedDebtor.customerPhone || "—"}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedDebtor.status === "active" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                }`}>
                  {selectedDebtor.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="font-bold text-secondary">{formatCurrency(selectedDebtor.totalAmount)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="font-bold text-green-600">{formatCurrency(selectedDebtor.amountPaid || 0)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Balance Due</p>
                  <p className="font-bold text-red-600">{formatCurrency(selectedDebtor.balanceDue)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="font-bold">{selectedDebtor.dueDate ? formatDate(selectedDebtor.dueDate) : "—"}</p>
                </div>
              </div>

              {selectedDebtor.customerAddress && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-1 uppercase">Address</h3>
                  <p className="text-sm">{selectedDebtor.customerAddress}</p>
                </div>
              )}

              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase">Payment History</h3>
                {selectedDebtor.paymentHistory && selectedDebtor.paymentHistory.length > 0 ? (
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {selectedDebtor.paymentHistory.map((p, i) => (
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

              {selectedDebtor.orderIds && selectedDebtor.orderIds.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-1 uppercase">Related Orders</h3>
                  <p className="text-sm text-muted-foreground">{selectedDebtor.orderIds.join(", ")}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                <p>Created: {formatDateTime(selectedDebtor.createdAt)}</p>
                <p>Updated: {formatDateTime(selectedDebtor.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
