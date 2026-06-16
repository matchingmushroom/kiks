"use client";

import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { Expense, ExpenseHead, RecurringExpenseTemplate } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  addDoc, collection, updateDoc, doc, Timestamp, deleteDoc, setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Plus, Search, X, Save, Trash2, Edit2, Repeat, AlertCircle,
} from "lucide-react";

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
    constraints: [orderBy("date", "desc")],
  });
  const { data: templates } = useFirestore<RecurringExpenseTemplate>("recurringExpenses");

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
  const [tab, setTab] = useState<"expenses" | "recurring">("expenses");

  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [recurringForm, setRecurringForm] = useState(emptyRecurring);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    const now = Date.now();
    const count = templates.filter((t) => t.isActive && t.nextDueDate <= now).length;
    setDueCount(count);
  }, [templates]);

  const filtered = expenses.filter((e) => {
    const matchSearch = !search ||
      e.title?.toLowerCase().includes(search.toLowerCase());
    const matchHead = !headFilter || e.head === headFilter;
    return matchSearch && matchHead;
  });

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
        recordedBy: "",
        updatedAt: Timestamp.fromDate(new Date()),
      };
      if (editingId) {
        await updateDoc(doc(db, "expenses", editingId), data);
      } else {
        const expenseRef = await addDoc(collection(db, "expenses"), {
          ...data, createdAt: Timestamp.fromDate(new Date()),
        });
        const accountId = form.paymentMethod === "bank" ? "bank_account" : "cash_in_hand";
        await addDoc(collection(db, "accountTransactions"), {
          accountId,
          type: "debit",
          amount: Number(form.amount),
          description: `Expense: ${form.title}`,
          date: Timestamp.fromDate(new Date(form.date)),
          referenceType: "expense",
          referenceId: expenseRef.id,
          recordedBy: "",
          createdAt: Timestamp.fromDate(new Date()),
        });
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
    await deleteDoc(doc(db, "expenses", id));
  };

  const generateDueExpenses = async () => {
    setSaving(true);
    try {
      const now = Timestamp.fromDate(new Date());
      for (const t of templates) {
        if (!t.isActive || t.nextDueDate > Date.now()) continue;
        const expenseRef = await addDoc(collection(db, "expenses"), {
          title: t.title,
          amount: t.amount,
          head: t.head,
          customHead: t.customHead || "",
          description: t.description || "",
          date: now,
          paymentMethod: t.paymentMethod,
          receiptUrl: "",
          recordedBy: "",
          createdAt: now,
          updatedAt: now,
        });
        const accountId = t.paymentMethod === "bank" ? "bank_account" : "cash_in_hand";
        await addDoc(collection(db, "accountTransactions"), {
          accountId,
          type: "debit",
          amount: t.amount,
          description: `Recurring: ${t.title}`,
          date: now,
          referenceType: "expense",
          referenceId: expenseRef.id,
          recordedBy: "",
          createdAt: now,
        });
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
        recordedBy: "",
        updatedAt: Timestamp.fromDate(new Date()),
      };
      if (editingRecurringId) {
        await updateDoc(doc(db, "recurringExpenses", editingRecurringId), data);
      } else {
        await addDoc(collection(db, "recurringExpenses"), {
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

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Expenses</h1>
            <p className="text-sm text-muted-foreground">{expenses.length} total</p>
          </div>
          <div className="flex gap-2">
            {dueCount > 0 && (
              <Button onClick={generateDueExpenses} disabled={saving} variant="outline" className="text-amber-600 border-amber-300">
                <AlertCircle className="h-4 w-4" /> Generate {dueCount} Due
              </Button>
            )}
            {tab === "recurring" ? (
              <Button onClick={() => { setShowRecurringForm(true); setRecurringForm(emptyRecurring); setEditingRecurringId(null); }} variant="accent">
                <Plus className="h-4 w-4" /> New Template
              </Button>
            ) : (
              <Button onClick={openAdd} variant="accent">
                <Plus className="h-4 w-4" /> Add Expense
              </Button>
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
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((e) => (
                  <div key={e.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2">
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
                      <Button onClick={() => openEdit(e)} size="sm" variant="outline" className="text-xs">
                        <Edit2 className="h-3 w-3" /> Edit
                      </Button>
                      <Button onClick={() => handleDelete(e.id)} size="sm" variant="outline" className="text-xs text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
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
    </AdminLayout>
  );
}
