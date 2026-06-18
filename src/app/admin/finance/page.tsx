"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import {
  Sale, Product, Expense, Debtor, Purchase,
  Account, AccountTransaction, Creditor,
} from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ACCOUNTS } from "@/lib/accounts";
import { useAuth } from "@/contexts/AuthContext";
import { getDoc, doc, setDoc, Timestamp, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Download, Plus, X, Save, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

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
    constraints: [orderBy("saleDate", "desc")],
    realtime: false,
  });
  const { data: products } = useFirestore<Product>("products", { realtime: false });
  const { data: expenses } = useFirestore<Expense>("expenses", {
    constraints: [orderBy("date", "desc")],
    realtime: false,
  });

  const [pnlRange, setPnlRange] = useState<"mtd" | "ytd" | "custom">("mtd");
  const [customStart, setCustomStart] = useState(startOfMonth.toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(today.toISOString().slice(0, 10));

  const getPnlData = () => {
    let start: number, end: number;
    if (pnlRange === "mtd") { start = startOfMonth.getTime(); end = today.getTime(); }
    else if (pnlRange === "ytd") { start = startOfYear.getTime(); end = today.getTime(); }
    else { start = new Date(customStart).getTime(); end = new Date(customEnd).getTime() + 86400000; }

    const filteredSales = sales.filter((s) => {
      const d = (s.saleDate as unknown as { toMillis?: () => number })?.toMillis?.() || (s.saleDate as number);
      return d >= start && d <= end;
    });
    const grossRevenue = filteredSales.reduce((sum, s) => sum + s.finalAmount, 0);
    let cogs = 0;
    for (const sale of filteredSales) {
      for (const item of sale.items) {
        const product = products.find((p) => p.id === item.productId);
        cogs += ((item as any).costPriceAtSale ?? product?.costPrice ?? 0) * item.quantity;
      }
    }
    const filteredExpenses = expenses.filter((e) => {
      const d = (e.date as unknown as { toMillis?: () => number })?.toMillis?.() || (e.date as number);
      return d >= start && d <= end;
    });
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const expenseByHead: Record<string, number> = {};
    for (const e of filteredExpenses) expenseByHead[e.head] = (expenseByHead[e.head] || 0) + e.amount;
    return { grossRevenue, cogs, grossProfit: grossRevenue - cogs, totalExpenses, expenseByHead, netProfit: grossRevenue - cogs - totalExpenses, saleCount: filteredSales.length };
  };

  const pnl = getPnlData();

  const downloadCSV = () => {
    const rows = [
      ["Metric", "Value"],
      ["Period", pnlRange === "mtd" ? "Month to Date" : pnlRange === "ytd" ? "Year to Date" : `${customStart} to ${customEnd}`],
      ["Gross Revenue", pnl.grossRevenue.toString()],
      ["COGS", pnl.cogs.toString()],
      ["Gross Profit", pnl.grossProfit.toString()],
      ["Total Expenses", pnl.totalExpenses.toString()],
      ...Object.entries(pnl.expenseByHead).map(([head, amt]) => [`  ${head}`, amt.toString()]),
      ["Net Profit", pnl.netProfit.toString()],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `pnl-${pnlRange}-${today.toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {(["mtd", "ytd", "custom"] as const).map((r) => (
          <button key={r} onClick={() => setPnlRange(r)}
            className={`px-3 py-1.5 text-xs rounded-full border capitalize ${pnlRange === r ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"}`}>
            {r === "mtd" ? "Month to Date" : r === "ytd" ? "Year to Date" : "Custom Range"}
          </button>
        ))}
        {pnlRange === "custom" && (
          <>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-3 py-1.5 border border-border rounded-lg text-sm" />
            <span className="text-muted-foreground text-sm">to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-3 py-1.5 border border-border rounded-lg text-sm" />
          </>
        )}
        <Button onClick={downloadCSV} variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> CSV</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Gross Revenue", value: pnl.grossRevenue, color: "text-green-600" },
          { label: "COGS", value: pnl.cogs, color: "text-red-600" },
          { label: "Gross Profit", value: pnl.grossProfit, color: pnl.grossProfit >= 0 ? "text-green-600" : "text-red-600" },
          { label: "Total Expenses", value: pnl.totalExpenses, color: "text-red-600" },
          { label: "Net Profit", value: pnl.netProfit, color: pnl.netProfit >= 0 ? "text-green-600" : "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{formatCurrency(s.value)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-secondary mb-4">Expense Breakdown by Head</h3>
        {Object.keys(pnl.expenseByHead).length === 0 ? (
          <p className="text-sm text-muted-foreground">No expenses in this period.</p>
        ) : (
          <div className="divide-y divide-border">
            {Object.entries(pnl.expenseByHead).sort(([, a], [, b]) => b - a).map(([head, amt]) => (
              <div key={head} className="flex items-center justify-between py-2 text-sm">
                <span>{head}</span><span className="font-medium">{formatCurrency(amt)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 text-sm font-semibold text-secondary">
              <span>Total</span><span>{formatCurrency(pnl.totalExpenses)}</span>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-4">{pnl.saleCount} sale(s) in this period</p>
      </div>
    </div>
  );
}

function BalanceSheetSection() {
  const { data: sales } = useFirestore<Sale>("sales", {
    constraints: [orderBy("saleDate", "desc")],
    realtime: false,
  });
  const { data: products } = useFirestore<Product>("products", { realtime: false });
  const { data: expenses } = useFirestore<Expense>("expenses", {
    constraints: [orderBy("date", "desc")],
    realtime: false,
  });
  const { data: debtors } = useFirestore<Debtor>("debtors", { realtime: false });
  const { data: purchases } = useFirestore<Purchase>("purchases", {
    constraints: [orderBy("purchaseDate", "desc")],
    realtime: false,
  });
  const { data: creditors } = useFirestore<Creditor>("creditors", { realtime: false });
  const { data: accounts } = useFirestore<Account>("accounts", { realtime: false });
  const { data: transactions } = useFirestore<AccountTransaction>("accountTransactions", {
    constraints: [orderBy("date", "desc"), limit(200)],
    realtime: false,
  });

  const [bsDate, setBsDate] = useState(today.toISOString().slice(0, 10));
  const [openingCapital, setOpeningCapital] = useState(0);
  const [capitalSaving, setCapitalSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, "shop_settings", "config"));
      if (snap.exists() && snap.data().openingCapital !== undefined) setOpeningCapital(snap.data().openingCapital);
    };
    load();
  }, []);

  useEffect(() => {
    const ensureAccounts = async () => {
      if (accounts.length === 0) {
        await setDoc(doc(db, "accounts", "cash_in_hand"), { name: "Cash in Hand", type: "cash", openingBalance: 0, createdAt: Timestamp.fromDate(new Date()), updatedAt: Timestamp.fromDate(new Date()) });
        await setDoc(doc(db, "accounts", "bank_account"), { name: "Bank Account", type: "bank", openingBalance: 0, createdAt: Timestamp.fromDate(new Date()), updatedAt: Timestamp.fromDate(new Date()) });
      }
    };
    ensureAccounts();
  }, [accounts.length]);

  const getBalanceSheet = () => {
    const bsEnd = new Date(bsDate).getTime();
    const closingStock = products.reduce((sum, p) => sum + (p.quantityInStock || 0) * (p.costPrice || 0), 0);
    const sundryDebtors = debtors.filter((d) => d.status === "active").reduce((sum, d) => sum + d.balanceDue, 0);

    const accountBalances: Record<string, number> = {};
    for (const acc of accounts) {
      const credits = transactions.filter((t) => t.accountId === acc.id && t.type === "credit" && t.date <= bsEnd).reduce((s, t) => s + t.amount, 0);
      const debits = transactions.filter((t) => t.accountId === acc.id && t.type === "debit" && t.date <= bsEnd).reduce((s, t) => s + t.amount, 0);
      accountBalances[acc.id] = acc.openingBalance + credits - debits;
    }

    const cashBalance = accountBalances["cash_in_hand"] || 0;
    const bankBalance = accountBalances["bank_account"] || 0;
    const creditorsBalance = creditors.reduce((sum, c) => sum + (c.balanceDue || 0), 0);
    const purchaseCreditors = purchases.filter((p) => {
      const d = (p.purchaseDate as unknown as { toMillis?: () => number })?.toMillis?.() || (p.purchaseDate as number);
      return d <= bsEnd && (p.paymentStatus === "unpaid" || p.paymentStatus === "partially_paid");
    }).reduce((sum, p) => sum + (p.totalAmount - (p.paidAmount || 0)), 0);
    const sundryCreditors = creditorsBalance > 0 ? creditorsBalance : purchaseCreditors;

    const filteredSales = sales.filter((s) => {
      const d = (s.saleDate as unknown as { toMillis?: () => number })?.toMillis?.() || (s.saleDate as number);
      return d <= bsEnd;
    });
    const filteredExpenses = expenses.filter((e) => {
      const d = (e.date as unknown as { toMillis?: () => number })?.toMillis?.() || (e.date as number);
      return d <= bsEnd;
    });
    let retainedEarnings = 0;
    for (const sale of filteredSales) {
      for (const item of sale.items) {
        const product = products.find((p) => p.id === item.productId);
        retainedEarnings -= ((item as any).costPriceAtSale ?? product?.costPrice ?? 0) * item.quantity;
      }
      retainedEarnings += sale.finalAmount;
    }
    for (const expense of filteredExpenses) retainedEarnings -= expense.amount;

    const totalAssets = cashBalance + bankBalance + closingStock + sundryDebtors;
    const totalLiabilities = sundryCreditors;
    const totalEquity = openingCapital + retainedEarnings;

    return { cashBalance, bankBalance, closingStock, sundryDebtors, sundryCreditors, openingCapital, retainedEarnings, totalAssets, totalLiabilities, totalEquity };
  };

  const bs = getBalanceSheet();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <label className="text-sm text-muted-foreground">As of:</label>
        <input type="date" value={bsDate} onChange={(e) => setBsDate(e.target.value)} className="px-3 py-1.5 border border-border rounded-lg text-sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-secondary">Assets</h3>
          <div className="divide-y divide-border">
            <div className="flex justify-between py-2 text-sm"><span>Cash in Hand</span><span className="font-medium">{formatCurrency(bs.cashBalance)}</span></div>
            <div className="flex justify-between py-2 text-sm"><span>Bank Account</span><span className="font-medium">{formatCurrency(bs.bankBalance)}</span></div>
            <div className="flex justify-between py-2 text-sm"><span>Closing Stock ({products.length} products)</span><span className="font-medium">{formatCurrency(bs.closingStock)}</span></div>
            <div className="flex justify-between py-2 text-sm"><span>Sundry Debtors</span><span className="font-medium">{formatCurrency(bs.sundryDebtors)}</span></div>
            <div className="flex justify-between py-2 text-sm font-bold text-secondary border-t-2"><span>Total Assets</span><span>{formatCurrency(bs.totalAssets)}</span></div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-secondary">Liabilities</h3>
            <div className="divide-y divide-border">
              <div className="flex justify-between py-2 text-sm"><span>Sundry Creditors</span><span className="font-medium">{formatCurrency(bs.sundryCreditors)}</span></div>
              <div className="flex justify-between py-2 text-sm font-bold text-secondary border-t-2"><span>Total Liabilities</span><span>{formatCurrency(bs.totalLiabilities)}</span></div>
            </div>
          </div>

          <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-secondary">Equity</h3>
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between py-2 text-sm">
                <span>Opening Capital</span>
                <div className="flex items-center gap-2">
                  <input type="number" value={openingCapital || ""} onChange={(e) => setOpeningCapital(Number(e.target.value))} className="w-28 px-2 py-1 border border-border rounded text-xs text-right" />
                  <Button onClick={async () => { setCapitalSaving(true); await setDoc(doc(db, "shop_settings", "config"), { openingCapital }, { merge: true }); setCapitalSaving(false); }} disabled={capitalSaving} size="sm" variant="ghost" className="text-xs"><Save className="h-3 w-3" /></Button>
                </div>
              </div>
              <div className="flex justify-between py-2 text-sm"><span>Retained Earnings</span><span className={`font-medium ${bs.retainedEarnings >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(bs.retainedEarnings)}</span></div>
              <div className="flex justify-between py-2 text-sm font-bold text-secondary border-t-2"><span>Total Equity</span><span>{formatCurrency(bs.totalEquity)}</span></div>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm space-y-1">
            <div className="flex justify-between font-semibold"><span>Net Assets (Assets − Liabilities)</span><span>{formatCurrency(bs.totalAssets - bs.totalLiabilities)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total Equity</span><span>{formatCurrency(bs.totalEquity)}</span></div>
            <div className={`flex justify-between font-bold pt-1 border-t ${Math.abs(bs.totalAssets - bs.totalLiabilities - bs.totalEquity) < 1 ? "text-green-600" : "text-amber-600"}`}>
              <span>Balance Check</span><span>{Math.abs(bs.totalAssets - bs.totalLiabilities - bs.totalEquity) < 1 ? "✓ Balanced" : "⚠ Mismatch"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CashBankSection() {
  const { user } = useAuth();
  const { data: accounts } = useFirestore<Account>("accounts", { realtime: false });
  const { data: transactions } = useFirestore<AccountTransaction>("accountTransactions", {
    constraints: [orderBy("date", "desc"), limit(200)],
    realtime: false,
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

export default function AdminFinancePage() {
  const [tab, setTab] = useState<"pnl" | "balance" | "accounts">("pnl");

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-secondary mb-6">Finance</h1>

        <div className="flex gap-1 mb-6 border-b border-border">
          {(["pnl", "balance", "accounts"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-secondary"}`}>
              {t === "pnl" ? "P&L Statement" : t === "balance" ? "Balance Sheet" : "Cash / Bank"}
            </button>
          ))}
        </div>

        {tab === "pnl" && <PnLSection />}
        {tab === "balance" && <BalanceSheetSection />}
        {tab === "accounts" && <CashBankSection />}
      </div>
    </AdminLayout>
  );
}
