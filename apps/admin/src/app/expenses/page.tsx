"use client";

import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { Expense, ExpenseHead, RecurringExpenseTemplate, Transfer } from "@/types";
import { formatCurrency, formatDate, toDate, getUseBsCalendar } from "@/lib/utils";
import { getFiscalYearStartEpoch } from "@/lib/nepaliDate";
import { generateId } from "@/lib/id-generator";
import { resolveAccount } from "@/lib/accounts";
import { createJournalEntry, buildExpenseJournal, buildTransferJournal } from "@/lib/journal";
import { useAuth } from "@/contexts/AuthContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import {
  addDoc, collection, updateDoc, doc, Timestamp, deleteDoc, setDoc, getDoc, getDocs, query, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Plus, Search, X, Save, Trash2, Edit2, Repeat, AlertCircle, LayoutGrid, List, Download, Mail, ArrowRightLeft,
} from "lucide-react";
import { exportExpensesCSV, downloadBlob } from "@/lib/export";

const EXPENSE_HEADS: ExpenseHead[] = [
  "Rent", "Salary", "Electricity", "Water", "Internet",
  "Marketing", "Travel", "Maintenance", "Packaging",
  "Bank Charges", "Taxes", "Miscellaneous", "Other",
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank Transfer" },
  { value: "other", label: "Other" },
];

const emptyForm = {
  title: "", amount: 0, head: "" as ExpenseHead | string,
  customHead: "", description: "", date: new Date().toISOString().slice(0, 10),
  paymentMethod: "cash" as "cash" | "bank" | "other",
  receiptUrl: "",
};

const emptyRecurring = {
  title: "", amount: 0, head: "" as ExpenseHead | string,
  customHead: "", frequency: "monthly" as "weekly" | "monthly" | "yearly",
  nextDueDate: new Date().toISOString().slice(0, 10),
  description: "", paymentMethod: "cash" as "cash" | "bank" | "other",
};

export default function AdminExpensesPage() {
  const { data: expenses, loading } = useFirestore<Expense>("expenses", {
    constraints: [orderBy("date", "desc"), limit(200)],
    realtime: true,
  });
  const { data: templates } = useFirestore<RecurringExpenseTemplate>("recurringExpenses", { constraints: [limit(50)], realtime: true });
  const { user, profile } = useAuth();

  // Merge hardcoded heads with unique custom heads from existing expenses
  const allHeads = useMemo(() => {
    const customHeads = [...new Set(expenses.map((e) => e.head).filter((h) => !EXPENSE_HEADS.includes(h as ExpenseHead) && h))];
    return [...EXPENSE_HEADS, ...customHeads.sort()] as string[];
  }, [expenses]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [headFilter, setHeadFilter] = useState("");
  const [tab, setTab] = useState<"expenses" | "recurring" | "transfers">("expenses");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [reportRange, setReportRange] = useState<"all" | "ytd" | "mtd" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const canExport = profile?.role !== "staff";
  const { settings: expenseSettings } = useShopSettings();
  const [archiveResults, setArchiveResults] = useState<Expense[] | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const { data: transfers } = useFirestore<Transfer>("transfers", {
    constraints: [orderBy("date", "desc"), limit(200)],
    realtime: true,
  });
  const [openingCash, setOpeningCash] = useState(0);
  const [openingBank, setOpeningBank] = useState(0);
  const [openingSaving, setOpeningSaving] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [transferForm, setTransferForm] = useState({
    type: "bank_deposit" as "bank_deposit" | "advance",
    amount: 0,
    description: "",
    date: new Date().toISOString().slice(0, 10),
    fromAccountId: "cash_in_hand",
    toAccountId: "bank_account",
    recipientName: "",
    recipientPhone: "",
    notes: "",
  });

  const searchArchive = async () => {
    if (!expenseSettings.gasWebhookUrl) { alert("Configure GAS Webhook URL in Settings first."); return; }
    setArchiveLoading(true);
    setShowArchive(true);
    try {
      const res = await fetch(expenseSettings.gasWebhookUrl, {
        method: "POST",
        body: JSON.stringify({ action: "queryArchivedRange", collection: "expenses", start: "1970-01-01", end: new Date().toISOString().slice(0, 10) }),
      });
      const data = await res.json();
      setArchiveResults((data.docs || []) as Expense[]);
    } catch { setArchiveResults([]); }
    setArchiveLoading(false);
  };

  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [detailTransfer, setDetailTransfer] = useState<Transfer | null>(null);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [recurringForm, setRecurringForm] = useState(emptyRecurring);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    const now = Date.now();
    const count = templates.filter((t) => t.isActive && t.nextDueDate <= now).length;
    setDueCount(count);
  }, [templates]);

  // Load opening balance for today
  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    getDoc(doc(db, "dailyBalances", todayKey)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setOpeningCash(d.cash || 0);
        setOpeningBank(d.bank || 0);
      }
    }).catch(() => {});
  }, []);

  const saveOpeningBalance = async () => {
    setOpeningSaving(true);
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      await setDoc(doc(db, "dailyBalances", todayKey), {
        cash: Number(openingCash),
        bank: Number(openingBank),
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (e) { console.error("Failed to save opening balance", e); }
    setOpeningSaving(false);
  };

  const filtered = useMemo(() => {
    let result = expenses.filter((e) => {
      const matchSearch = !search ||
        e.title?.toLowerCase().includes(search.toLowerCase());
      const matchHead = !headFilter || e.head === headFilter;
      return matchSearch && matchHead;
    });
    let start = 0, end = Infinity;
    if (reportRange === "ytd") { start = getUseBsCalendar() ? getFiscalYearStartEpoch() : new Date(new Date().getFullYear(), 0, 1).getTime(); }
    else if (reportRange === "mtd") { start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(); }
    else if (reportRange === "custom" && dateFrom && dateTo) {
      start = new Date(dateFrom).getTime();
      end = new Date(dateTo).getTime() + 86400000;
    }
    if (start > 0 || end < Infinity) {
      result = result.filter((e) => { const d = toDate(e.date).getTime(); return d >= start && d <= end; });
    }
    return result;
  }, [expenses, search, headFilter, reportRange, dateFrom, dateTo]);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (e: Expense) => {
    setForm({
      title: e.title, amount: e.amount, head: e.head,
      customHead: e.customHead || "", description: e.description || "",
      date: new Date(e.date).toISOString().slice(0, 10),
      paymentMethod: e.paymentMethod, receiptUrl: e.receiptUrl || "",
    });
    setEditingId(e.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.amount) return;
    setSaving(true);
    try {
      const data = {
        title: form.title,
        amount: Number(form.amount),
        head: form.head === "Other" && form.customHead ? form.customHead : form.head,
        customHead: form.head === "Other" ? form.customHead : "",
        description: form.description,
        date: Timestamp.fromDate(new Date(form.date)),
        paymentMethod: form.paymentMethod,
        receiptUrl: form.receiptUrl,
        recordedBy: user?.uid || "",
        updatedAt: Timestamp.fromDate(new Date()),
      };
      if (editingId) {
        await updateDoc(doc(db, "expenses", editingId), data);
        const txSnap = await getDocs(query(collection(db, "accountTransactions"), where("referenceType", "==", "expense"), where("referenceId", "==", editingId)));
        const txData = {
          accountId: resolveAccount(form.paymentMethod),
          type: "debit",
          amount: Number(form.amount),
          description: `Expense: ${form.title}`,
          date: Timestamp.fromDate(new Date(form.date)),
          recordedBy: user?.uid || "",
        };
        if (!txSnap.empty) {
          await updateDoc(doc(db, "accountTransactions", txSnap.docs[0].id), txData);
        } else {
          await addDoc(collection(db, "accountTransactions"), {
            ...txData,
            referenceType: "expense",
            referenceId: editingId,
            createdAt: Timestamp.fromDate(new Date()),
          });
        }
        // Update journal entry for edited expense
        try {
          const jeSnap = await getDocs(query(collection(db, "journalEntries"), where("referenceType", "==", "expense"), where("referenceId", "==", editingId)));
          for (const je of jeSnap.docs) await deleteDoc(doc(db, "journalEntries", je.id));
          const expenseEntry: Expense = {
            id: editingId, title: form.title, amount: Number(form.amount),
            head: form.head, customHead: form.customHead, description: form.description,
            date: new Date(form.date).getTime(), paymentMethod: form.paymentMethod,
            receiptUrl: form.receiptUrl, recordedBy: user?.uid || "",
            createdAt: Date.now(), updatedAt: Date.now(),
          };
          const eje = buildExpenseJournal(expenseEntry, profile?.displayName || "");
          await createJournalEntry(eje);
        } catch (e) { console.error("Expense edit journal sync failed", e); }
      } else {
        const expenseId = await generateId("EXP");
        await setDoc(doc(db, "expenses", expenseId), {
          ...data, createdAt: Timestamp.fromDate(new Date()),
        });
        await addDoc(collection(db, "accountTransactions"), {
          accountId: resolveAccount(form.paymentMethod),
          type: "debit",
          amount: Number(form.amount),
          description: `Expense: ${form.title}`,
          date: Timestamp.fromDate(new Date(form.date)),
          referenceType: "expense",
          referenceId: expenseId,
          recordedBy: user?.uid || "",
          createdAt: Timestamp.fromDate(new Date()),
        });
        try {
          const expenseEntry: Expense = {
            id: expenseId, title: form.title, amount: Number(form.amount),
            head: form.head, customHead: form.customHead, description: form.description,
            date: new Date(form.date).getTime(), paymentMethod: form.paymentMethod,
            receiptUrl: form.receiptUrl, recordedBy: user?.uid || "",
            createdAt: Date.now(), updatedAt: Date.now(),
          };
          const eje = buildExpenseJournal(expenseEntry, profile?.displayName || "");
          await createJournalEntry(eje);
        } catch (e) { console.error("Expense journal entry failed", e); }
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (e) {
      console.error("Expense save failed", e);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const txSnap = await getDocs(query(collection(db, "accountTransactions"), where("referenceType", "==", "expense"), where("referenceId", "==", id)));
    for (const tx of txSnap.docs) {
      await deleteDoc(doc(db, "accountTransactions", tx.id));
    }
    const jeSnap = await getDocs(query(collection(db, "journalEntries"), where("referenceType", "==", "expense"), where("referenceId", "==", id)));
    for (const je of jeSnap.docs) {
      await deleteDoc(doc(db, "journalEntries", je.id));
    }
    await deleteDoc(doc(db, "expenses", id));
  };

  const generateDueExpenses = async () => {
    setSaving(true);
    try {
      const now = Timestamp.fromDate(new Date());
      for (const t of templates) {
        if (!t.isActive || t.nextDueDate > Date.now()) continue;
        const expenseId = await generateId("EXP");
        await setDoc(doc(db, "expenses", expenseId), {
          title: t.title,
          amount: t.amount,
          head: t.head,
          customHead: t.customHead || "",
          description: t.description || "",
          date: now,
          paymentMethod: t.paymentMethod,
          receiptUrl: "",
          recordedBy: user?.uid || "",
          createdAt: now,
          updatedAt: now,
        });
        await addDoc(collection(db, "accountTransactions"), {
          accountId: resolveAccount(t.paymentMethod),
          type: "debit",
          amount: t.amount,
          description: `Recurring: ${t.title}`,
          date: now,
          referenceType: "expense",
          referenceId: expenseId,
          recordedBy: user?.uid || "",
          createdAt: now,
        });
        try {
          const recExp: Expense = {
            id: expenseId, title: t.title, amount: t.amount,
            head: t.head, customHead: t.customHead || "", description: t.description || "",
            date: Date.now(), paymentMethod: t.paymentMethod,
            receiptUrl: "", recordedBy: user?.uid || "",
            createdAt: Date.now(), updatedAt: Date.now(),
          };
          const rje = buildExpenseJournal(recExp, profile?.displayName || "");
          await createJournalEntry(rje);
        } catch (e) { console.error("Recurring expense journal entry failed", e); }
        const nextDate = new Date(t.nextDueDate);
        switch (t.frequency) {
          case "weekly": nextDate.setDate(nextDate.getDate() + 7); break;
          case "monthly": nextDate.setMonth(nextDate.getMonth() + 1); break;
          case "yearly": nextDate.setFullYear(nextDate.getFullYear() + 1); break;
        }
        await updateDoc(doc(db, "recurringExpenses", t.id), {
          nextDueDate: Timestamp.fromDate(nextDate),
        });
      }
      setDueCount(0);
    } catch (e) {
      console.error("Generate failed", e);
    }
    setSaving(false);
  };

  const saveRecurring = async () => {
    if (!recurringForm.title || !recurringForm.amount) return;
    setSaving(true);
    try {
      const data = {
        title: recurringForm.title,
        amount: Number(recurringForm.amount),
        head: recurringForm.head === "Other" && recurringForm.customHead ? recurringForm.customHead : recurringForm.head,
        customHead: recurringForm.head === "Other" ? recurringForm.customHead : "",
        frequency: recurringForm.frequency,
        nextDueDate: Timestamp.fromDate(new Date(recurringForm.nextDueDate)),
        description: recurringForm.description,
        paymentMethod: recurringForm.paymentMethod,
        isActive: true,
        recordedBy: user?.uid || "",
        updatedAt: Timestamp.fromDate(new Date()),
      };
      if (editingRecurringId) {
        await updateDoc(doc(db, "recurringExpenses", editingRecurringId), data);
      } else {
        const recId = await generateId("RECEXP");
        await setDoc(doc(db, "recurringExpenses", recId), {
          ...data, createdAt: Timestamp.fromDate(new Date()),
        });
      }
      setShowRecurringForm(false);
      setRecurringForm(emptyRecurring);
      setEditingRecurringId(null);
    } catch (e) {
      console.error("Recurring save failed", e);
    }
    setSaving(false);
  };

  const deleteRecurring = async (id: string) => {
    await deleteDoc(doc(db, "recurringExpenses", id));
  };

  const saveTransfer = async () => {
    if (!transferForm.amount || !transferForm.description) return;
    setSaving(true);
    try {
      const transferId = await generateId("TRF");
      const now = Timestamp.fromDate(new Date());
      const dateTs = Timestamp.fromDate(new Date(transferForm.date));
      await setDoc(doc(db, "transfers", transferId), {
        type: transferForm.type,
        amount: Number(transferForm.amount),
        description: transferForm.description,
        date: dateTs,
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.type === "bank_deposit" ? transferForm.toAccountId : "",
        recipientName: transferForm.type === "advance" ? transferForm.recipientName : "",
        recipientPhone: transferForm.type === "advance" ? transferForm.recipientPhone : "",
        notes: transferForm.notes,
        recordedBy: user?.uid || "",
        recordedByName: profile?.displayName || "",
        createdAt: now,
        updatedAt: now,
      });
      // Debit from source account
      await addDoc(collection(db, "accountTransactions"), {
        accountId: transferForm.fromAccountId,
        type: "debit",
        amount: Number(transferForm.amount),
        description: transferForm.type === "bank_deposit"
          ? `Bank deposit: ${transferForm.description}`
          : `Advance to ${transferForm.recipientName || "staff/supplier"}: ${transferForm.description}`,
        date: dateTs,
        referenceType: "transfer",
        referenceId: transferId,
        recordedBy: user?.uid || "",
        createdAt: now,
      });
      // Credit to destination account for bank deposit
      if (transferForm.type === "bank_deposit") {
        await addDoc(collection(db, "accountTransactions"), {
          accountId: transferForm.toAccountId,
          type: "credit",
          amount: Number(transferForm.amount),
          description: `Cash deposit: ${transferForm.description}`,
          date: dateTs,
          referenceType: "transfer",
          referenceId: transferId,
          recordedBy: user?.uid || "",
          createdAt: now,
        });
      }
      try {
        const transferEntry: Transfer = {
          id: transferId, type: transferForm.type, amount: Number(transferForm.amount),
          description: transferForm.description, date: new Date(transferForm.date).getTime(),
          fromAccountId: transferForm.fromAccountId,
          toAccountId: transferForm.type === "bank_deposit" ? transferForm.toAccountId : "",
          recipientName: transferForm.type === "advance" ? transferForm.recipientName : "",
          recipientPhone: transferForm.type === "advance" ? transferForm.recipientPhone : "",
          notes: transferForm.notes,
          recordedBy: user?.uid || "", recordedByName: profile?.displayName || "",
          createdAt: Date.now(), updatedAt: Date.now(),
        };
        const tje = buildTransferJournal(transferEntry, profile?.displayName || "System");
        await createJournalEntry(tje);
      } catch (e) { console.error("Transfer journal entry failed", e); }
      setShowTransferForm(false);
      setTransferForm({
        type: "bank_deposit", amount: 0, description: "", date: new Date().toISOString().slice(0, 10),
        fromAccountId: "cash_in_hand", toAccountId: "bank_account",
        recipientName: "", recipientPhone: "", notes: "",
      });
      setEditingTransferId(null);
    } catch (e) { console.error("Transfer save failed", e); }
    setSaving(false);
  };

  const deleteTransfer = async (id: string) => {
    const txSnap = await getDocs(query(collection(db, "accountTransactions"), where("referenceType", "==", "transfer"), where("referenceId", "==", id)));
    for (const tx of txSnap.docs) await deleteDoc(doc(db, "accountTransactions", tx.id));
    await deleteDoc(doc(db, "transfers", id));
  };

  const handleDownloadCSV = () => {
    const csv = exportExpensesCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `expenses-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const snap = await getDoc(doc(db, "shop_settings", "emailBackupConfig"));
      if (!snap.exists()) { alert("Configure Email & Backup in Settings first."); return; }
      const cfg = snap.data() as any;
      if (!cfg.gasWebhookUrl) { alert("Configure GAS Webhook URL in Settings first."); return; }
      const csv = exportExpensesCSV(filtered);
      const period = new Date().toISOString().slice(0, 10);
      const res = await fetch(cfg.gasWebhookUrl, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "sendReport", module: "expenses", csv, filename: `expenses-${period}.csv`, period, emailTo: cfg.emailTo || "", driveFolderId: cfg.driveFolderId || "" }),
      });
      const data = await res.json();
      if (data.status === "ok") alert("Report sent!"); else alert("Error: " + (data.message || "Unknown"));
    } catch (e: any) { alert("Operation failed. Try again."); }
    setSendingEmail(false);
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Expenses</h1>
            <p className="text-sm text-muted-foreground">{expenses.length} total</p>
          </div>
          <div className="flex gap-2">
            {tab === "expenses" && (
              <button onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                className="p-2 border border-border rounded-lg text-muted-foreground hover:bg-muted" title={viewMode === "grid" ? "List View" : "Grid View"}>
                {viewMode === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
              </button>
            )}
            {dueCount > 0 && (
              <Button onClick={generateDueExpenses} disabled={saving} variant="outline" className="text-amber-600 border-amber-300">
                <AlertCircle className="h-4 w-4" /> Generate {dueCount} Due
              </Button>
            )}
            {tab === "recurring" ? (
              <Button onClick={() => { setShowRecurringForm(true); setRecurringForm(emptyRecurring); setEditingRecurringId(null); }} variant="accent">
                <Plus className="h-4 w-4" /> New Template
              </Button>
            ) : tab === "transfers" ? (
              <Button onClick={() => { setShowTransferForm(true); setTransferForm({
                type: "bank_deposit", amount: 0, description: "", date: new Date().toISOString().slice(0, 10),
                fromAccountId: "cash_in_hand", toAccountId: "bank_account",
                recipientName: "", recipientPhone: "", notes: "",
              }); setEditingTransferId(null); }} variant="accent">
                <Plus className="h-4 w-4" /> New Transfer
              </Button>
            ) : (
              <>
                <Button onClick={openAdd} variant="accent">
                  <Plus className="h-4 w-4" /> Add Expense
                </Button>
                <Button onClick={searchArchive} variant="outline">
                  <Search className="h-4 w-4" /> Search Archive
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-border">
          <button onClick={() => setTab("expenses")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "expenses" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-secondary"
            }`}>
            Expenses
          </button>
          <button onClick={() => setTab("recurring")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "recurring" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-secondary"
            }`}>
            Recurring Templates
          </button>
          <button onClick={() => setTab("transfers")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "transfers" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-secondary"
            }`}>
            Transfers
          </button>
        </div>

        {tab === "expenses" && (
          <>
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search expenses..." value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <select value={headFilter} onChange={(e) => setHeadFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">All Heads</option>
                {allHeads.map((h) => <option key={h} value={h}>{h}</option>)}
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
            </div>

            {showForm && (
              <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-secondary">{editingId ? "Edit Expense" : "New Expense"}</h2>
                  <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
                    <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Amount (NPR) *</label>
                    <input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Head</label>
                    <select value={form.head} onChange={(e) => setForm({ ...form, head: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">Select head</option>
                      {allHeads.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {form.head === "Other" && (
                      <input type="text" placeholder="Custom head name" value={form.customHead}
                        onChange={(e) => setForm({ ...form, customHead: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-primary" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Method</label>
                    <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as "cash" | "bank" | "other" })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Receipt URL</label>
                    <input type="text" value={form.receiptUrl} onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                    <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" rows={2} />
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t border-border mt-4">
                  <Button onClick={handleSave} disabled={saving || !form.title || !form.amount} variant="accent">
                    <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Expense"}
                  </Button>
                  <Button onClick={() => setShowForm(false)} variant="outline">Cancel</Button>
                </div>
              </div>
            )}

            {loading ? (
              <p className="text-muted-foreground text-center py-12">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No expenses found.</p>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((e) => (
                  <div key={e.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2 cursor-pointer" onClick={() => setDetailExpense(e)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-secondary text-sm truncate">{e.title}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {e.head}
                        </span>
                      </div>
                      <span className="font-semibold text-secondary text-sm shrink-0">{formatCurrency(e.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{e.paymentMethod}</span>
                      <span className="text-muted-foreground">{formatDate(e.date)}</span>
                    </div>
                    {e.description && <p className="text-xs text-muted-foreground truncate">{e.description}</p>}
                    <div className="flex gap-2 pt-1">
                      <Button onClick={(ev) => { ev.stopPropagation(); openEdit(e); }} size="sm" variant="outline" className="text-xs">
                        <Edit2 className="h-3 w-3" /> Edit
                      </Button>
                      <Button onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id); }} size="sm" variant="outline" className="text-xs text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-left">
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Title</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Head</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Amount</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground capitalize">Method</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Date</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((e) => (
                      <tr key={e.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setDetailExpense(e)}>
                        <td className="px-4 py-2.5 text-sm font-medium text-secondary">{e.title}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{e.head}</span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-right font-medium">{formatCurrency(e.amount)}</td>
                        <td className="px-4 py-2.5 text-sm text-right capitalize">{e.paymentMethod}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-muted-foreground">{formatDate(e.date)}</td>
                        <td className="px-4 py-2.5 text-sm text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={(ev) => { ev.stopPropagation(); openEdit(e); }} className="p-1 hover:bg-muted rounded" title="Edit">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id); }} className="p-1 hover:bg-muted rounded text-red-500" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "transfers" && (
          <>
            {/* Opening Balance */}
            <div className="bg-white border border-border rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-secondary flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-primary" />
                  Opening Balance for Today
                </h3>
                <button onClick={saveOpeningBalance} disabled={openingSaving}
                  className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                  {openingSaving ? "Saving..." : "Save"}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Cash in Hand Opening (NPR)</label>
                  <input type="number" value={openingCash || ""}
                    onChange={(e) => setOpeningCash(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Bank Account Opening (NPR)</label>
                  <input type="number" value={openingBank || ""}
                    onChange={(e) => setOpeningBank(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
            </div>

            {showTransferForm && (
              <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-secondary">{editingTransferId ? "Edit Transfer" : "New Transfer"}</h2>
                  <button onClick={() => setShowTransferForm(false)} className="p-1 hover:bg-muted rounded">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Type *</label>
                    <select value={transferForm.type} onChange={(e) => setTransferForm({ ...transferForm, type: e.target.value as "bank_deposit" | "advance" })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="bank_deposit">Bank Deposit</option>
                      <option value="advance">Advance</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Amount (NPR) *</label>
                    <input type="number" value={transferForm.amount || ""} onChange={(e) => setTransferForm({ ...transferForm, amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
                    <input type="date" value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">From Account</label>
                    <select value={transferForm.fromAccountId} onChange={(e) => setTransferForm({ ...transferForm, fromAccountId: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="cash_in_hand">Cash in Hand</option>
                      <option value="bank_account">Bank Account</option>
                    </select>
                  </div>
                  {transferForm.type === "bank_deposit" ? (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">To Account</label>
                      <select value={transferForm.toAccountId} onChange={(e) => setTransferForm({ ...transferForm, toAccountId: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="bank_account">Bank Account</option>
                        <option value="cash_in_hand">Cash in Hand</option>
                      </select>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Recipient Name *</label>
                        <input type="text" value={transferForm.recipientName} onChange={(e) => setTransferForm({ ...transferForm, recipientName: e.target.value })}
                          placeholder="Staff/supplier name" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Recipient Phone</label>
                        <input type="text" value={transferForm.recipientPhone} onChange={(e) => setTransferForm({ ...transferForm, recipientPhone: e.target.value })}
                          placeholder="Phone" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                    </>
                  )}
                  <div className={transferForm.type === "bank_deposit" ? "" : "md:col-span-2"}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Description *</label>
                    <input type="text" value={transferForm.description} onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                      placeholder="Purpose of transfer" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  {transferForm.type === "advance" && (
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                      <textarea value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" rows={2} />
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-4 border-t border-border mt-4">
                  <Button onClick={saveTransfer} disabled={saving || !transferForm.amount || !transferForm.description || (transferForm.type === "advance" && !transferForm.recipientName)} variant="accent">
                    <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Transfer"}
                  </Button>
                  <Button onClick={() => setShowTransferForm(false)} variant="outline">Cancel</Button>
                </div>
              </div>
            )}

            {!transfers || transfers.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No transfers yet.</p>
            ) : (
              <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-left">
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Type</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Description</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Amount</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground">From</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground">To / Recipient</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Date</th>
                      <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transfers.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setDetailTransfer(t)}>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            t.type === "bank_deposit" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                          }`}>
                            {t.type === "bank_deposit" ? "Bank Deposit" : "Advance"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-secondary font-medium">{t.description}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold">{formatCurrency(t.amount)}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">{t.fromAccountId?.replace("_", " ")}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {t.type === "bank_deposit" ? (t.toAccountId || "").replace("_", " ") : (t.recipientName || "-")}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-right text-muted-foreground">{formatDate(t.date)}</td>
                        <td className="px-4 py-2.5 text-sm text-right">
                          <button onClick={(ev) => { ev.stopPropagation(); deleteTransfer(t.id); }} className="p-1 hover:bg-muted rounded text-red-500" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "recurring" && (
          <>
            {dueCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-2 text-sm text-amber-800">
                <AlertCircle className="h-5 w-5 shrink-0" />
                {dueCount} recurring expense{dueCount > 1 ? "s" : ""} due.{" "}
                <button onClick={generateDueExpenses} disabled={saving} className="underline font-medium ml-1">
                  Generate now
                </button>
              </div>
            )}

            {showRecurringForm && (
              <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-secondary">
                    {editingRecurringId ? "Edit Template" : "New Recurring Template"}
                  </h2>
                  <button onClick={() => setShowRecurringForm(false)} className="p-1 hover:bg-muted rounded">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
                    <input type="text" value={recurringForm.title}
                      onChange={(e) => setRecurringForm({ ...recurringForm, title: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Amount (NPR) *</label>
                    <input type="number" value={recurringForm.amount || ""}
                      onChange={(e) => setRecurringForm({ ...recurringForm, amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Head</label>
                    <select value={recurringForm.head}
                      onChange={(e) => setRecurringForm({ ...recurringForm, head: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">Select head</option>
                      {allHeads.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {recurringForm.head === "Other" && (
                      <input type="text" placeholder="Custom head name" value={recurringForm.customHead}
                        onChange={(e) => setRecurringForm({ ...recurringForm, customHead: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-primary" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Frequency</label>
                    <select value={recurringForm.frequency}
                      onChange={(e) => setRecurringForm({ ...recurringForm, frequency: e.target.value as "weekly" | "monthly" | "yearly" })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Next Due Date</label>
                    <input type="date" value={recurringForm.nextDueDate}
                      onChange={(e) => setRecurringForm({ ...recurringForm, nextDueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Method</label>
                    <select value={recurringForm.paymentMethod}
                      onChange={(e) => setRecurringForm({ ...recurringForm, paymentMethod: e.target.value as "cash" | "bank" | "other" })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t border-border mt-4">
                  <Button onClick={saveRecurring} disabled={saving || !recurringForm.title || !recurringForm.amount} variant="accent">
                    <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Template"}
                  </Button>
                  <Button onClick={() => setShowRecurringForm(false)} variant="outline">Cancel</Button>
                </div>
              </div>
            )}

            {templates.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No recurring templates yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {templates.map((t) => (
                  <div key={t.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-secondary text-sm truncate">{t.title}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {t.head}
                        </span>
                      </div>
                      <span className="font-semibold text-secondary text-sm shrink-0">{formatCurrency(t.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-muted-foreground">{t.frequency}</span>
                      <span className="text-muted-foreground">Next: {formatDate(t.nextDueDate)}</span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button onClick={() => { setRecurringForm({
                        title: t.title, amount: t.amount, head: t.head,
                        customHead: t.customHead || "", frequency: t.frequency,
                        nextDueDate: new Date(t.nextDueDate).toISOString().slice(0, 10),
                        description: t.description || "", paymentMethod: t.paymentMethod,
                      }); setEditingRecurringId(t.id); setShowRecurringForm(true); }}
                        size="sm" variant="outline" className="text-xs">
                        <Edit2 className="h-3 w-3" /> Edit
                      </Button>
                      <Button onClick={() => deleteRecurring(t.id)} size="sm" variant="outline" className="text-xs text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showArchive && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { setShowArchive(false); setArchiveResults(null); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-secondary">Archived Expenses</h2>
              <button onClick={() => { setShowArchive(false); setArchiveResults(null); }} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              {archiveLoading ? (
                <p className="text-center text-muted-foreground py-8">Loading archived expenses...</p>
              ) : !archiveResults || archiveResults.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No archived expenses found.</p>
              ) : (
                <div className="divide-y divide-border">
                  {archiveResults.map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">{e.head} · {formatDate(e.date)}</p>
                      </div>
                      <span className="font-medium shrink-0 ml-4">{formatCurrency(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {detailExpense && (
        <DetailModal title={`Expense - ${detailExpense.title}`} onClose={() => setDetailExpense(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Title</span><p className="font-medium">{detailExpense.title}</p></div>
              <div><span className="text-muted-foreground">Head</span><p className="font-medium">{detailExpense.head}</p></div>
              {detailExpense.customHead && <div><span className="text-muted-foreground">Custom Head</span><p className="font-medium">{detailExpense.customHead}</p></div>}
              <div><span className="text-muted-foreground">Amount</span><p className="font-medium">{formatCurrency(detailExpense.amount)}</p></div>
              <div><span className="text-muted-foreground">Payment Method</span><p className="font-medium capitalize">{detailExpense.paymentMethod}</p></div>
              <div><span className="text-muted-foreground">Date</span><p className="font-medium">{formatDate(detailExpense.date)}</p></div>
            </div>
            {detailExpense.description && (
              <div className="text-sm"><span className="text-muted-foreground">Description</span><p className="mt-0.5">{detailExpense.description}</p></div>
            )}
            {detailExpense.receiptUrl && (
              <div className="text-sm"><span className="text-muted-foreground">Receipt</span><p className="mt-0.5"><a href={detailExpense.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">View Receipt</a></p></div>
            )}
            <div className="text-sm"><span className="text-muted-foreground">Recorded By (ID)</span><p className="mt-0.5 font-mono text-xs">{detailExpense.recordedBy}</p></div>
          </div>
        </DetailModal>
      )}
      {detailTransfer && (
        <DetailModal title={`Transfer - ${detailTransfer.description}`} onClose={() => setDetailTransfer(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Type</span><p className="font-medium capitalize">{detailTransfer.type === "bank_deposit" ? "Bank Deposit" : "Advance"}</p></div>
              <div><span className="text-muted-foreground">Description</span><p className="font-medium">{detailTransfer.description}</p></div>
              <div><span className="text-muted-foreground">Amount</span><p className="font-medium">{formatCurrency(detailTransfer.amount)}</p></div>
              <div><span className="text-muted-foreground">From</span><p className="font-medium capitalize">{detailTransfer.fromAccountId?.replace("_", " ")}</p></div>
              <div><span className="text-muted-foreground">To / Recipient</span><p className="font-medium">{detailTransfer.type === "bank_deposit" ? (detailTransfer.toAccountId || "").replace("_", " ") : (detailTransfer.recipientName || "-")}</p></div>
              <div><span className="text-muted-foreground">Date</span><p className="font-medium">{formatDate(detailTransfer.date)}</p></div>
            </div>
            {detailTransfer.settledAmount !== undefined && (
              <div className="text-sm"><span className="text-muted-foreground">Settled Amount</span><p className="font-medium mt-0.5">{formatCurrency(detailTransfer.settledAmount)}</p></div>
            )}
            {detailTransfer.status && (
              <div className="text-sm"><span className="text-muted-foreground">Status</span><p className="font-medium mt-0.5 capitalize">{detailTransfer.status}</p></div>
            )}
            {detailTransfer.recordedByName && (
              <div className="text-sm"><span className="text-muted-foreground">Recorded By</span><p className="font-medium mt-0.5">{detailTransfer.recordedByName}</p></div>
            )}
            {detailTransfer.notes && (
              <div className="text-sm"><span className="text-muted-foreground">Notes</span><p className="mt-0.5">{detailTransfer.notes}</p></div>
            )}
          </div>
        </DetailModal>
      )}
    </AdminLayout>
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
