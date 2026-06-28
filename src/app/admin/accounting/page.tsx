"use client";

import { useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { JournalEntry, AccountHead, Transfer } from "@/types";
import { formatCurrency, formatDate, formatDateTime, toDate } from "@/lib/utils";
import { getChartOfAccounts } from "@/lib/accounts";
import { useAuth } from "@/contexts/AuthContext";
import { collection, addDoc, doc, updateDoc, Timestamp, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { Search, X, FileText, RotateCcw, CheckCircle, Download, ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function AccountingPage() {
  const [tab, setTab] = useState<"journal" | "ledger" | "trial" | "advance">("journal");
  const { user, profile } = useAuth();
  const { settings } = useShopSettings();
  const { data: entries } = useFirestore<JournalEntry>("journalEntries", {
    constraints: [orderBy("entryDate", "desc"), limit(500)],
    realtime: true,
  });
  const { data: accounts } = useFirestore<AccountHead>("chartOfAccounts", {
    constraints: [limit(100)],
    realtime: true,
  });
  const { data: transfers } = useFirestore<Transfer>("transfers", {
    constraints: [orderBy("date", "desc"), limit(200)],
    realtime: true,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [detailJournal, setDetailJournal] = useState<JournalEntry | null>(null);
  const [detailLedger, setDetailLedger] = useState<{
    entryDate: number; entryNumber: string; description: string;
    debit: number; credit: number; runningBalance: number;
  } | null>(null);
  const [detailTrial, setDetailTrial] = useState<{ account: AccountHead; debit: number; credit: number } | null>(null);
  const [detailAdvance, setDetailAdvance] = useState<Transfer | null>(null);

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    let result = entries;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) =>
        e.entryNumber.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.lines.some((l) => l.accountName.toLowerCase().includes(q))
      );
    }
    return result;
  }, [entries, searchQuery]);

  const ledgerData = useMemo(() => {
    if (!entries || !accounts) return [];
    return accounts
      .filter((a) => !selectedAccount || a.id === selectedAccount)
      .map((a) => {
        const lines = entries.flatMap((e) =>
          e.lines
            .filter((l) => l.accountCode === a.code)
            .map((l) => ({ ...l, entryDate: e.entryDate, entryNumber: e.entryNumber, description: e.description }))
        );
        lines.sort((x, y) => x.entryDate - y.entryDate);
        let balance = 0;
        return {
          account: a,
          lines: lines.map((l) => {
            if (a.category === "asset" || a.category === "expense") {
              balance += l.debit - l.credit;
            } else {
              balance += l.credit - l.debit;
            }
            return { ...l, runningBalance: balance };
          }),
          balance,
        };
      });
  }, [entries, accounts, selectedAccount]);

  const trialBalance = useMemo(() => {
    if (!entries || !accounts) return [];
    const totals: Record<string, { debit: number; credit: number }> = {};
    for (const e of entries) {
      for (const l of e.lines) {
        if (!totals[l.accountCode]) totals[l.accountCode] = { debit: 0, credit: 0 };
        totals[l.accountCode].debit += l.debit;
        totals[l.accountCode].credit += l.credit;
      }
    }
    return accounts.map((a) => ({
      account: a,
      debit: totals[a.code]?.debit || 0,
      credit: totals[a.code]?.credit || 0,
    }));
  }, [entries, accounts]);

  const outstandingAdvances = useMemo(() => {
    return transfers?.filter((t) => t.type === "advance" && t.status !== "settled") || [];
  }, [transfers]);

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-secondary mb-6">Accounting</h1>

        <div className="flex gap-1 mb-6 border-b border-border">
          {(["journal", "ledger", "trial", "advance"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-secondary"}`}>
              {t === "journal" ? "Journal" : t === "ledger" ? "Ledger" : t === "trial" ? "Trial Balance" : "Advance Settlement"}
            </button>
          ))}
        </div>

        {tab === "journal" && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search entries..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <span className="text-xs text-muted-foreground">{filteredEntries.length} entries</span>
            </div>
            <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-left">
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Entry #</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Date</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Description</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Reference</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Account</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-right">Debit</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredEntries.map((e) => (
                      e.lines.map((l, i) => (
                        <tr key={`${e.id}-${i}`} className="hover:bg-muted/30 cursor-pointer" onClick={() => setDetailJournal(e)}>
                          {i === 0 && (
                            <>
                              <td className="px-4 py-2 text-xs font-mono text-secondary" rowSpan={e.lines.length}>{e.entryNumber}</td>
                              <td className="px-4 py-2 text-xs text-muted-foreground" rowSpan={e.lines.length}>{formatDate(e.entryDate)}</td>
                              <td className="px-4 py-2 text-sm text-secondary" rowSpan={e.lines.length}>{e.description}</td>
                              <td className="px-4 py-2 text-xs text-muted-foreground capitalize" rowSpan={e.lines.length}>{e.referenceType}</td>
                            </>
                          )}
                          <td className="px-4 py-2 text-sm">
                            <span className="text-xs text-muted-foreground font-mono mr-1">{l.accountCode}</span>
                            {l.accountName}
                          </td>
                          <td className="px-4 py-2 text-right text-sm">{l.debit > 0 ? formatCurrency(l.debit) : ""}</td>
                          <td className="px-4 py-2 text-right text-sm">{l.credit > 0 ? formatCurrency(l.credit) : ""}</td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "ledger" && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <select value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">All Accounts</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-6">
              {ledgerData.filter((l) => l.lines.length > 0).map((l) => (
                <div key={l.account.id} className="bg-white border border-border rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-secondary">{l.account.code} - {l.account.name}</h3>
                    <span className="text-xs text-muted-foreground capitalize">{l.account.category}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted text-left">
                          <th className="px-4 py-2 text-xs text-muted-foreground font-medium">Date</th>
                          <th className="px-4 py-2 text-xs text-muted-foreground font-medium">Entry #</th>
                          <th className="px-4 py-2 text-xs text-muted-foreground font-medium">Description</th>
                          <th className="px-4 py-2 text-xs text-muted-foreground font-medium text-right">Debit</th>
                          <th className="px-4 py-2 text-xs text-muted-foreground font-medium text-right">Credit</th>
                          <th className="px-4 py-2 text-xs text-muted-foreground font-medium text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {l.lines.map((line, i) => (
                          <tr key={i} className="hover:bg-muted/30 cursor-pointer" onClick={() => setDetailLedger(line)}>
                            <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(line.entryDate)}</td>
                            <td className="px-4 py-2 text-xs font-mono text-secondary">{line.entryNumber}</td>
                            <td className="px-4 py-2 text-sm">{line.description}</td>
                            <td className="px-4 py-2 text-right">{line.debit > 0 ? formatCurrency(line.debit) : ""}</td>
                            <td className="px-4 py-2 text-right">{line.credit > 0 ? formatCurrency(line.credit) : ""}</td>
                            <td className="px-4 py-2 text-right font-medium">{formatCurrency(line.runningBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "trial" && (
          <div>
            <p className="text-xs text-muted-foreground mb-4">As of {formatDate(Date.now())}</p>
            <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm max-w-2xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-left">
                    <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Account</th>
                    <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-right">Debit</th>
                    <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {trialBalance.map((t) => (
                    <tr key={t.account.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setDetailTrial(t)}>
                      <td className="px-4 py-2">
                        <span className="text-xs text-muted-foreground font-mono mr-1">{t.account.code}</span>
                        {t.account.name}
                        <span className="text-xs text-muted-foreground ml-2 capitalize">({t.account.category})</span>
                      </td>
                      <td className="px-4 py-2 text-right">{t.debit > 0 ? formatCurrency(t.debit) : ""}</td>
                      <td className="px-4 py-2 text-right">{t.credit > 0 ? formatCurrency(t.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30 font-medium">
                  <tr>
                    <td className="px-4 py-2.5 text-sm">Total</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(trialBalance.reduce((s, t) => s + t.debit, 0))}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(trialBalance.reduce((s, t) => s + t.credit, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {tab === "advance" && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">Outstanding staff advances</p>
            {outstandingAdvances.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No outstanding advances.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {outstandingAdvances.map((t) => (
                  <div key={t.id} className="bg-white border border-border rounded-xl p-4 shadow-sm cursor-pointer" onClick={() => setDetailAdvance(t)}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-secondary">{t.recipientName || "Staff"}</p>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </div>
                      <span className="text-sm font-bold text-secondary">{formatCurrency(t.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(t.date)}</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Active</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {detailJournal && (
          <DetailModal title={`Journal Entry - ${detailJournal.entryNumber}`} onClose={() => setDetailJournal(null)}>
            <div className="space-y-2 text-sm">
              <Row label="Entry #" value={detailJournal.entryNumber} />
              <Row label="Date" value={formatDate(detailJournal.entryDate)} />
              <Row label="Description" value={detailJournal.description} />
              <Row label="Reference" value={detailJournal.referenceType} />
              <Row label="Recorded By" value={detailJournal.recordedByName || detailJournal.recordedBy} />
              <div className="pt-2">
                <p className="text-xs font-semibold text-secondary mb-1">Line Items</p>
                {detailJournal.lines.map((l, i) => (
                  <div key={i} className="flex justify-between items-start py-1 border-b border-border last:border-0">
                    <span className="text-muted-foreground text-xs shrink-0 mr-4">{l.accountCode} - {l.accountName}</span>
                    <span className="text-right text-xs">
                      {l.debit > 0 && <span className="text-green-600 mr-2">Dr {formatCurrency(l.debit)}</span>}
                      {l.credit > 0 && <span className="text-red-600">Cr {formatCurrency(l.credit)}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </DetailModal>
        )}

        {detailLedger && (
          <DetailModal title="Ledger Entry Details" onClose={() => setDetailLedger(null)}>
            <div className="space-y-2 text-sm">
              <Row label="Entry #" value={detailLedger.entryNumber} />
              <Row label="Date" value={formatDate(detailLedger.entryDate)} />
              <Row label="Description" value={detailLedger.description} />
              <Row label="Debit" value={detailLedger.debit > 0 ? formatCurrency(detailLedger.debit) : "—"} />
              <Row label="Credit" value={detailLedger.credit > 0 ? formatCurrency(detailLedger.credit) : "—"} />
              <Row label="Running Balance" value={formatCurrency(detailLedger.runningBalance)} bold />
            </div>
          </DetailModal>
        )}

        {detailTrial && (
          <DetailModal title={`Trial Balance - ${detailTrial.account.name}`} onClose={() => setDetailTrial(null)}>
            <div className="space-y-2 text-sm">
              <Row label="Account Code" value={detailTrial.account.code} />
              <Row label="Account Name" value={detailTrial.account.name} />
              <Row label="Category" value={detailTrial.account.category} />
              <Row label="Debit Total" value={formatCurrency(detailTrial.debit)} />
              <Row label="Credit Total" value={formatCurrency(detailTrial.credit)} />
            </div>
          </DetailModal>
        )}

        {detailAdvance && (
          <DetailModal title="Advance Details" onClose={() => setDetailAdvance(null)}>
            <div className="space-y-2 text-sm">
              <Row label="Recipient" value={detailAdvance.recipientName || "Staff"} />
              <Row label="Description" value={detailAdvance.description} />
              <Row label="Amount" value={formatCurrency(detailAdvance.amount)} />
              <Row label="Date" value={formatDate(detailAdvance.date)} />
              <Row label="Status" value={detailAdvance.status || "active"} />
              {detailAdvance.settledAmount !== undefined && (
                <Row label="Settled Amount" value={formatCurrency(detailAdvance.settledAmount)} />
              )}
            </div>
          </DetailModal>
        )}
      </div>
    </AdminLayout>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex justify-between items-start py-1 border-b border-border last:border-0">
      <span className="text-muted-foreground text-xs shrink-0 mr-4">{label}</span>
      <span className={`text-right ${bold ? "font-bold text-secondary" : "text-secondary font-medium"}`}>{value}</span>
    </div>
  );
}

function DetailModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-secondary">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
