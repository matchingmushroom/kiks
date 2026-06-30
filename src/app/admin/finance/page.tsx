"use client";

import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import {
  Account, AccountTransaction, Transfer, JournalEntry,
  Sale, Expense, Product, Debtor, Creditor,
} from "@/types";
import { formatCurrency, formatDate, getUseBsCalendar } from "@/lib/utils";
import { getFiscalYearStartEpoch } from "@/lib/nepaliDate";
import { ACCOUNTS } from "@/lib/accounts";
import { createJournalEntry, buildTransferJournal } from "@/lib/journal";
import { useAuth } from "@/contexts/AuthContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { getDoc, getDocs, doc, setDoc, Timestamp, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Download, Plus, X, Save, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { computePnl, computeBalanceSheet } from "@/lib/finance";

function ReportHeader({ title, period }: { title: string; period: string }) {
  const { settings } = useShopSettings();
  return (
    <div className="text-center mb-8 pb-6 border-b-2 border-gray-400">
      {settings?.logoUrl && (
        <div className="flex justify-center mb-3">
          <img src={settings.logoUrl} alt="Logo" className="h-16 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
      <h1 className="text-xl font-bold text-gray-900 tracking-tight">{settings?.shopName || "Shop Name"}</h1>
      {settings?.address && <p className="text-sm text-gray-500 mt-0.5">{settings.address}</p>}
      {settings?.phone && <p className="text-xs text-gray-400">Phone: {settings.phone}</p>}
      <h2 className="text-lg font-semibold text-gray-800 mt-4">{title}</h2>
      <p className="text-sm text-gray-500 italic">{period}</p>
    </div>
  );
}

function Line({ label, value, bold, double, indent, negative }: { label: string; value: string | number; bold?: boolean; double?: boolean; indent?: boolean; negative?: boolean }) {
  const fmt = typeof value === "number" ? formatCurrency(value) : value;
  return (
    <div className={`flex justify-between items-center py-0.5 ${bold ? "font-bold border-t border-gray-400" : ""} ${double ? "font-bold border-t-4 border-gray-900" : ""} ${indent ? "ml-6" : ""}`}>
      <span className={`text-sm ${bold ? "text-gray-900 font-semibold" : negative ? "text-red-600" : "text-gray-700"}`}>{label}</span>
      <span className={`text-sm font-mono tabular-nums ${bold ? "text-gray-900 font-bold" : negative ? "text-red-600" : "text-gray-800"}`}>{fmt}</span>
    </div>
  );
}

function TotalLine({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1 border-t-2 border-gray-800 mt-1">
      <span className="text-sm font-bold text-gray-900">{label}</span>
      <span className={`text-sm font-bold font-mono tabular-nums ${negative && value < 0 ? "text-red-600" : "text-gray-900"}`}>{formatCurrency(value)}</span>
    </div>
  );
}

const EXPENSE_HEADS = [
  "Rent", "Salary", "Electricity", "Water", "Internet",
  "Marketing", "Travel", "Maintenance", "Packaging",
  "Bank Charges", "Taxes", "Miscellaneous",
];

const today = new Date();
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const startOfYear = new Date(today.getFullYear(), 0, 1);

function PnLSection() {
  const { data: sales } = useFirestore<Sale>("sales", {
    constraints: [orderBy("saleDate", "desc"), limit(2000)],
    realtime: true, cache: false,
  });
  const { data: expenses } = useFirestore<Expense>("expenses", {
    constraints: [orderBy("date", "desc"), limit(1000)],
    realtime: true, cache: false,
  });
  const [pnlRange, setPnlRange] = useState<"mtd" | "ytd" | "fytd" | "custom">("mtd");
  const [customStart, setCustomStart] = useState(startOfMonth.toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(today.toISOString().slice(0, 10));

  const pnlData = useMemo(() => {
    let startMs: number, endMs: number;
    const endOfDay = new Date(today.toISOString().slice(0, 10));
    endOfDay.setDate(endOfDay.getDate() + 1);
    endMs = endOfDay.getTime();
    if (pnlRange === "mtd") {
      startMs = startOfMonth.getTime();
    } else if (pnlRange === "ytd") {
      startMs = getUseBsCalendar() ? getFiscalYearStartEpoch() : startOfYear.getTime();
    } else if (pnlRange === "fytd") {
      startMs = getFiscalYearStartEpoch();
    } else {
      startMs = new Date(customStart).getTime();
      endMs = new Date(customEnd).getTime() + 86400000;
    }
    return computePnl(sales, expenses, startMs, endMs);
  }, [sales, expenses, pnlRange, customStart, customEnd]);

  const pnl = pnlData;
  const periodLabel = pnlRange === "mtd"
    ? `Month ended ${today.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}`
    : pnlRange === "ytd" ? `Year ended ${today.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}`
    : pnlRange === "fytd" ? `Fiscal Year ended ${today.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}`
    : `${customStart} to ${customEnd}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
          {(["mtd", "ytd", "fytd", "custom"] as const).map((r) => (
            <button key={r} onClick={() => setPnlRange(r)}
              className={`px-3 py-1.5 text-xs rounded-full border capitalize ${pnlRange === r ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"}`}>
              {r === "mtd" ? "Month to Date" : r === "ytd" ? "Year to Date" : r === "fytd" ? "Fiscal Year to Date" : "Custom Range"}
            </button>
          ))}
        {pnlRange === "custom" && (
          <>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-3 py-1.5 border border-border rounded-lg text-sm" />
            <span className="text-muted-foreground text-sm">to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-3 py-1.5 border border-border rounded-lg text-sm" />
          </>
        )}
      </div>

      {!sales || !expenses ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading data...</p>
      ) : sales.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No sales recorded in this period.</p>
      ) : (

        <div className="max-w-2xl mx-auto bg-white border border-gray-300 rounded-sm shadow-lg p-10 print:p-6 print:shadow-none">
          <ReportHeader title="Profit & Loss Statement" period={periodLabel} />

          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Income</h3>
            <Line label="Gross Sales Revenue" value={pnl.grossRevenue} />

            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-2">Cost of Goods Sold</h3>
            <Line label="Cost of Goods Sold" value={-pnl.cogs} negative />

            <TotalLine label="Gross Profit" value={pnl.grossProfit} />

            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-2">Operating Expenses</h3>
            {Object.keys(pnl.expenseByHead || {}).length === 0 ? (
              <p className="text-xs text-gray-400 italic ml-6">No expenses recorded</p>
            ) : (
              Object.entries(pnl.expenseByHead || {})
                .sort(([, a], [, b]) => b - a)
                .map(([head, amt]) => (
                  <Line key={head} label={head} value={-amt} indent negative />
                ))
            )}
            <TotalLine label={`Total Expenses (${Object.keys(pnl.expenseByHead || {}).length} heads)`} value={-pnl.totalExpenses} />

            <div className="mt-3 pt-2 border-t-4 border-gray-900">
              <div className="flex justify-between items-center py-1">
                <span className="text-base font-bold text-gray-900">Net {pnl.netProfit >= 0 ? "Profit" : "Loss"}</span>
                <span className={`text-base font-bold font-mono tabular-nums ${pnl.netProfit >= 0 ? "text-green-800" : "text-red-700"}`}>
                  {formatCurrency(pnl.netProfit)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-300 text-center">
            <p className="text-[10px] text-gray-400">This statement was generated on {new Date().toLocaleString()} based on recorded transactions.</p>
            <p className="text-[10px] text-gray-400">{pnl.saleCount} sale(s) included in this period.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function BalanceSheetSection() {
  const { settings } = useShopSettings();
  const [bsDate, setBsDate] = useState(today.toISOString().slice(0, 10));
  const [partners, setPartners] = useState<{ id: string; name: string; amount: number }[]>([]);

  useEffect(() => {
    getDocs(collection(db, "partnerCapitals")).then((snap) => {
      setPartners(snap.docs.map((d) => ({ id: d.id, ...d.data() } as any)).sort((a, b) => b.addedAt - a.addedAt));
    });
  }, []);

  const { data: sales } = useFirestore<Sale>("sales", {
    constraints: [orderBy("saleDate", "desc"), limit(2000)],
    realtime: true, cache: false,
  });
  const { data: expenses } = useFirestore<Expense>("expenses", {
    constraints: [orderBy("date", "desc"), limit(2000)],
    realtime: true, cache: false,
  });
  const { data: products } = useFirestore<Product>("products", {
    constraints: [orderBy("name", "asc"), limit(2000)],
    realtime: true,
  });
  const { data: debtors } = useFirestore<Debtor>("debtors", {
    constraints: [limit(500)],
    realtime: true,
  });
  const { data: creditors } = useFirestore<Creditor>("creditors", {
    constraints: [limit(500)],
    realtime: true,
  });
  const { data: accounts } = useFirestore<Account>("accounts", { realtime: true });
  const { data: transactions } = useFirestore<AccountTransaction>("accountTransactions", {
    constraints: [orderBy("date", "desc"), limit(3000)],
    realtime: true, cache: false,
  });

  const asOfMs = useMemo(() => {
    const d = new Date(bsDate);
    d.setDate(d.getDate() + 1);
    return d.getTime();
  }, [bsDate]);

  const bs = useMemo(() => {
    if (!sales || !expenses || !products || !debtors || !creditors || !accounts || !transactions) return null;
    const totalCapital = partners.reduce((s, p) => s + p.amount, 0);
    return computeBalanceSheet(sales, expenses, products, debtors, creditors, accounts, transactions, totalCapital, asOfMs);
  }, [sales, expenses, products, debtors, creditors, accounts, transactions, partners, asOfMs]);

  const totalCapital = partners.reduce((s, p) => s + p.amount, 0);
  const asOfLabel = `As at ${new Date(bsDate).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}`;

  const loading = !bs;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <label className="text-sm text-muted-foreground">As of:</label>
        <input type="date" value={bsDate} onChange={(e) => setBsDate(e.target.value)} className="px-3 py-1.5 border border-border rounded-lg text-sm" />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading balance sheet...</p>
      ) : (
      <div className="max-w-3xl mx-auto bg-white border border-gray-300 rounded-sm shadow-lg p-10 print:p-6 print:shadow-none">
        <ReportHeader title="Balance Sheet" period={asOfLabel} />

        <div className="grid grid-cols-2 gap-8">
          {/* Left column: Assets */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pb-1 border-b border-gray-300">Assets</h3>
            <div className="space-y-1">
              <Line label="Cash in Hand" value={bs.cashBalance} />
              <Line label="Bank Account" value={bs.bankBalance} />
              <Line label="Closing Stock" value={bs.closingStock} />
              <div className="flex justify-between items-center py-0.5"><span className="text-sm text-gray-700">Closing Stock (Qty)</span><span className="text-sm font-mono tabular-nums text-gray-600">{bs.productCount} units</span></div>
              <Line label="Sundry Debtors" value={bs.sundryDebtors} />
              <TotalLine label="Total Assets" value={bs.totalAssets} />
            </div>
          </div>

          {/* Right column: Liabilities & Equity */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pb-1 border-b border-gray-300">Liabilities</h3>
            <div className="space-y-1">
              <Line label="Sundry Creditors" value={bs.sundryCreditors} />
              <TotalLine label="Total Liabilities" value={bs.totalLiabilities} />
            </div>

            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-5 mb-3 pb-1 border-b border-gray-300">Equity</h3>
            <div className="space-y-1">
              <div className="ml-6 space-y-0.5">
                {partners.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No partners configured</p>
                ) : (
                  partners.map((p) => (
                    <div key={p.id} className="flex justify-between items-center py-0.5">
                      <span className="text-sm text-gray-600">{p.name}</span>
                      <span className="text-sm font-mono tabular-nums text-gray-800">{formatCurrency(p.amount)}</span>
                    </div>
                  ))
                )}
              </div>
              <Line label="Partners' Capital Total" value={totalCapital} indent />
              <Line label="Retained Earnings" value={bs.retainedEarnings} />
              <TotalLine label="Total Equity" value={bs.totalEquity} />
            </div>

            <div className="mt-5 pt-3 border-t-4 border-gray-900">
              <div className="flex justify-between items-center py-1">
                <span className="text-sm font-bold text-gray-900">Total Liabilities &amp; Equity</span>
                <span className="text-sm font-bold font-mono tabular-nums text-gray-900">{formatCurrency(bs.totalLiabilities + bs.totalEquity)}</span>
              </div>
              <div className={`flex justify-between items-center pt-1 mt-1 border-t border-dashed ${Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)) < 1 ? "text-green-700" : "text-amber-600"}`}>
                <span className="text-xs font-medium">Balance Check</span>
                <span className="text-xs font-mono">{Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)) < 1 ? "✓ In Balance" : "⚠ Out of Balance"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-300 text-center">
          <p className="text-[10px] text-gray-400">This statement was generated on {new Date().toLocaleString()}. Values in {settings?.currency || "NPR"}.</p>
        </div>
      </div>
      )}
    </div>
  );
}

function CashBankSection() {
  const { user, profile } = useAuth();
  const { data: accounts } = useFirestore<Account>("accounts", { realtime: true });
  const { data: transactions } = useFirestore<AccountTransaction>("accountTransactions", {
    constraints: [orderBy("date", "desc"), limit(200)],
    realtime: true,
  });

  const [showTxForm, setShowTxForm] = useState(false);
  const [txForm, setTxForm] = useState({ accountId: "", type: "credit" as "credit" | "debit", amount: 0, description: "", date: today.toISOString().slice(0, 10) });
  const [txSaving, setTxSaving] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ fromAccountId: "", toAccountId: "", amount: 0, date: today.toISOString().slice(0, 10), description: "" });
  const [transferSaving, setTransferSaving] = useState(false);

  useEffect(() => {
    const ensureAccounts = async () => {
      if (accounts.length === 0) {
        await setDoc(doc(db, "accounts", "cash_in_hand"), { name: "Cash in Hand", type: "cash", openingBalance: 0, createdAt: Timestamp.fromDate(new Date()), updatedAt: Timestamp.fromDate(new Date()) });
        await setDoc(doc(db, "accounts", "bank_account"), { name: "Bank Account", type: "bank", openingBalance: 0, createdAt: Timestamp.fromDate(new Date()), updatedAt: Timestamp.fromDate(new Date()) });
      }
    };
    ensureAccounts();
  }, [accounts.length]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap gap-3">
          {accounts.map((acc) => {
            const credits = transactions.filter((t) => t.accountId === acc.id && t.type === "credit").reduce((s, t) => s + t.amount, 0);
            const debits = transactions.filter((t) => t.accountId === acc.id && t.type === "debit").reduce((s, t) => s + t.amount, 0);
            return (
              <div key={acc.id} className="bg-white border border-border rounded-xl p-4 shadow-sm min-w-[180px]">
                <p className="text-xs text-muted-foreground mb-1">{acc.name}</p>
                <p className="text-lg font-bold">{formatCurrency(acc.openingBalance + credits - debits)}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{acc.type}</p>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowTxForm(true)} variant="accent"><Plus className="h-4 w-4" /> Add Transaction</Button>
          <Button onClick={() => setShowTransfer(true)} variant="outline">Transfer</Button>
        </div>
      </div>

      {showTxForm && (
        <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-secondary">Manual Transaction</h3>
            <button onClick={() => setShowTxForm(false)} className="p-1 hover:bg-muted rounded"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Account</label>
              <select value={txForm.accountId} onChange={(e) => setTxForm({ ...txForm, accountId: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
              <select value={txForm.type} onChange={(e) => setTxForm({ ...txForm, type: e.target.value as "credit" | "debit" })} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                <option value="credit">Credit (Money In)</option>
                <option value="debit">Debit (Money Out)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Amount (NPR)</label>
              <input type="number" value={txForm.amount || ""} onChange={(e) => setTxForm({ ...txForm, amount: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
              <input type="date" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <input type="text" value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex gap-3 pt-4 mt-4 border-t border-border">
            <Button onClick={async () => {
              if (!txForm.accountId || !txForm.amount) return;
              setTxSaving(true);
              await addDoc(collection(db, "accountTransactions"), { accountId: txForm.accountId, type: txForm.type, amount: Number(txForm.amount), description: txForm.description, date: Timestamp.fromDate(new Date(txForm.date)), referenceType: "manual", recordedBy: user?.uid || "", createdAt: Timestamp.fromDate(new Date()) });
              setShowTxForm(false);
              setTxForm({ accountId: accounts[0]?.id || "", type: "credit", amount: 0, description: "", date: today.toISOString().slice(0, 10) });
              setTxSaving(false);
            }} disabled={txSaving || !txForm.accountId || !txForm.amount} variant="accent"><Save className="h-4 w-4" /> {txSaving ? "Saving..." : "Add Transaction"}</Button>
            <Button onClick={() => setShowTxForm(false)} variant="outline">Cancel</Button>
          </div>
        </div>
      )}

      {showTransfer && (
        <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-secondary">Transfer Between Accounts</h3>
            <button onClick={() => setShowTransfer(false)} className="p-1 hover:bg-muted rounded"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">From Account</label>
              <select value={transferForm.fromAccountId} onChange={(e) => setTransferForm({ ...transferForm, fromAccountId: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                <option value="">Select</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">To Account</label>
              <select value={transferForm.toAccountId} onChange={(e) => setTransferForm({ ...transferForm, toAccountId: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                <option value="">Select</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Amount (NPR)</label>
              <input type="number" value={transferForm.amount || ""} onChange={(e) => setTransferForm({ ...transferForm, amount: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
              <input type="date" value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description (optional)</label>
              <input type="text" value={transferForm.description} onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex gap-3 pt-4 mt-4 border-t border-border">
            <Button onClick={async () => {
              if (!transferForm.fromAccountId || !transferForm.toAccountId || !transferForm.amount || transferForm.fromAccountId === transferForm.toAccountId) return;
              setTransferSaving(true);
              const transferId = `transfer_${Date.now()}`;
              const date = Timestamp.fromDate(new Date(transferForm.date));
              await addDoc(collection(db, "accountTransactions"), { accountId: transferForm.fromAccountId, type: "debit", amount: Number(transferForm.amount), description: transferForm.description || `Transfer to ${ACCOUNTS.find((a) => a.id === transferForm.toAccountId)?.name || transferForm.toAccountId}`, date, referenceType: "transfer", referenceId: transferId, recordedBy: user?.uid || "", createdAt: Timestamp.fromDate(new Date()) });
              await addDoc(collection(db, "accountTransactions"), { accountId: transferForm.toAccountId, type: "credit", amount: Number(transferForm.amount), description: transferForm.description || `Transfer from ${ACCOUNTS.find((a) => a.id === transferForm.fromAccountId)?.name || transferForm.fromAccountId}`, date, referenceType: "transfer", referenceId: transferId, recordedBy: user?.uid || "", createdAt: Timestamp.fromDate(new Date()) });
              try {
                const transferEntry: Transfer = {
                  id: transferId, type: "bank_deposit", amount: Number(transferForm.amount),
                  description: transferForm.description || `Transfer`, date: new Date(transferForm.date).getTime(),
                  fromAccountId: transferForm.fromAccountId, toAccountId: transferForm.toAccountId,
                  recordedBy: user?.uid || "", recordedByName: profile?.displayName || "",
                  createdAt: Date.now(), updatedAt: Date.now(),
                };
                const tje = buildTransferJournal(transferEntry, profile?.displayName || "System");
                await createJournalEntry(tje);
              } catch (e) { console.error("Transfer journal entry failed", e); }
              setShowTransfer(false);
              setTransferForm({ fromAccountId: "", toAccountId: "", amount: 0, date: today.toISOString().slice(0, 10), description: "" });
              setTransferSaving(false);
            }} disabled={transferSaving || !transferForm.fromAccountId || !transferForm.toAccountId || !transferForm.amount || transferForm.fromAccountId === transferForm.toAccountId} variant="accent"><Save className="h-4 w-4" /> {transferSaving ? "Processing..." : "Complete Transfer"}</Button>
            <Button onClick={() => setShowTransfer(false)} variant="outline">Cancel</Button>
          </div>
        </div>
      )}

      <div className="bg-white border border-border rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b border-border"><h3 className="text-sm font-semibold text-secondary">Transaction Log</h3></div>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">No transactions yet.</p>
        ) : (
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {transactions.map((t) => {
              const acc = accounts.find((a) => a.id === t.accountId);
              return (
                <div key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/30">
                  <div className="flex items-center gap-3 min-w-0">
                    {t.type === "credit" ? <ArrowUpRight className="h-4 w-4 text-green-500 shrink-0" /> : <ArrowDownRight className="h-4 w-4 text-red-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className="truncate">{t.description || t.referenceType}</p>
                      <p className="text-xs text-muted-foreground">{acc?.name} · {formatDate(t.date)} · {t.referenceType}</p>
                    </div>
                  </div>
                  <span className={`font-medium shrink-0 ml-4 ${t.type === "credit" ? "text-green-600" : "text-red-600"}`}>{t.type === "credit" ? "+" : "-"}{formatCurrency(t.amount)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CashFlowSection() {
  const { data: entries } = useFirestore<JournalEntry>("journalEntries", {
    constraints: [orderBy("entryDate", "desc"), limit(500)],
    realtime: true,
  });
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [cfRange, setCfRange] = useState<"mtd" | "custom">("mtd");
  const [cfStart, setCfStart] = useState(startOfMonth.toISOString().slice(0, 10));
  const [cfEnd, setCfEnd] = useState(today.toISOString().slice(0, 10));

  const cashFlow = useMemo(() => {
    if (!entries) return { operating: 0, investing: 0, financing: 0, net: 0, details: [] as { category: string; label: string; amount: number }[] };
    const start = cfRange === "mtd" ? startOfMonth.getTime() : new Date(cfStart).getTime();
    const end = new Date(cfEnd).getTime();
    const filtered = entries.filter((e) => {
      const d = typeof e.entryDate === "number" ? e.entryDate : new Date(e.entryDate).getTime();
      return d >= start && d <= end;
    });
    let operating = 0, investing = 0, financing = 0;
    const details: { category: string; label: string; amount: number }[] = [];
    for (const e of filtered) {
      for (const l of e.lines) {
        if (l.accountCode.startsWith("4.") || l.accountCode.startsWith("5.1")) {
          operating += l.credit - l.debit;
        } else if (l.accountCode.startsWith("1.1.7")) {
          investing += l.debit - l.credit;
        } else if (l.accountCode.startsWith("2.1.3") || l.accountCode.startsWith("3.")) {
          financing += l.credit - l.debit;
        }
      }
    }
    const netCash = entries
      .flatMap((e) => e.lines)
      .filter((l) => l.accountCode === "1.1.1" || l.accountCode === "1.1.2")
      .reduce((sum, l) => sum + (l.debit - l.credit), 0);
    return { operating, investing, financing, net: operating + investing + financing, details: [
      { category: "Operating", label: "Net cash from operations", amount: operating },
      { category: "Investing", label: "Net cash from investing", amount: investing },
      { category: "Financing", label: "Net cash from financing", amount: financing },
      { category: "Net", label: "Net cash change (from cash/bank)", amount: netCash },
    ] };
  }, [entries, cfRange, cfStart, cfEnd]);

  const cfPeriod = cfRange === "mtd"
    ? `Month ended ${today.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}`
    : `${cfStart} to ${cfEnd}`;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <select value={cfRange} onChange={(e) => setCfRange(e.target.value as "mtd" | "custom")}
          className="px-3 py-2 border border-border rounded-lg text-sm">
          <option value="mtd">Month to Date</option>
          <option value="custom">Custom Range</option>
        </select>
        {cfRange === "custom" && (
          <>
            <input type="date" value={cfStart} onChange={(e) => setCfStart(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm" />
            <input type="date" value={cfEnd} onChange={(e) => setCfEnd(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm" />
          </>
        )}
      </div>

      {!entries && <p className="text-sm text-muted-foreground py-8 text-center">Loading cash flow data...</p>}
      {entries && entries.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No journal entries found. Cash flow requires journal entries.</p>}
      {entries && entries.length > 0 && (
        <div className="max-w-2xl mx-auto bg-white border border-gray-300 rounded-sm shadow-lg p-10 print:p-6 print:shadow-none">
          <ReportHeader title="Cash Flow Statement" period={cfPeriod} />

          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Operating Activities</h3>
            <Line label="Net cash from operations" value={cashFlow.operating} />
          </div>

          <div className="mt-4 space-y-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Investing Activities</h3>
            <Line label="Net cash from investing" value={cashFlow.investing} />
          </div>

          <div className="mt-4 space-y-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Financing Activities</h3>
            <Line label="Net cash from financing" value={cashFlow.financing} />
          </div>

          <div className="mt-5 pt-2 border-t-4 border-gray-900">
            <div className="flex justify-between items-center py-1">
              <span className="text-base font-bold text-gray-900">Net Cash Change</span>
              <span className={`text-base font-bold font-mono tabular-nums ${cashFlow.net >= 0 ? "text-green-800" : "text-red-700"}`}>
                {formatCurrency(cashFlow.net)}
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-300 text-center">
            <p className="text-[10px] text-gray-400">This statement was generated on {new Date().toLocaleString()} based on recorded journal entries.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminFinancePage() {
  const [tab, setTab] = useState<"pnl" | "balance" | "accounts" | "cashflow">("pnl");

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-secondary mb-6">Finance</h1>

        <div className="flex gap-1 mb-6 border-b border-border">
          {(["pnl", "balance", "cashflow", "accounts"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-secondary"}`}>
              {t === "pnl" ? "P&L Statement" : t === "balance" ? "Balance Sheet" : t === "cashflow" ? "Cash Flow" : "Cash / Bank"}
            </button>
          ))}
        </div>

        {tab === "pnl" && <PnLSection />}
        {tab === "balance" && <BalanceSheetSection />}
        {tab === "cashflow" && <CashFlowSection />}
        {tab === "accounts" && <CashBankSection />}
      </div>
    </AdminLayout>
  );
}
