import { collection, addDoc, Timestamp, runTransaction, doc, getDoc, setDoc, query, orderBy, limit, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { JournalEntry, JournalLine, Sale, Purchase, Expense, Transfer, AccountHead } from "@/types";
import { getAccountByCode } from "./accounts";

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function getNextEntryNumber(): Promise<string> {
  const todayStr = getTodayStr();
  const counterRef = doc(db, "counters", `journal_${todayStr}`);
  try {
    const result = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const next = (snap.exists() ? (snap.data().value || 0) : 0) + 1;
      transaction.set(counterRef, { value: next }, { merge: true });
      return next;
    });
    const datePart = todayStr.replace(/-/g, "");
    return `JE-${datePart}-${String(result).padStart(4, "0")}`;
  } catch {
    const fallback = Date.now().toString(36).toUpperCase();
    return `JE-${fallback}`;
  }
}

export async function createJournalEntry(
  entry: Omit<JournalEntry, "id" | "entryNumber" | "isPosted" | "createdAt">
): Promise<string | null> {
  try {
    const entryNumber = await getNextEntryNumber();
    const docRef = await addDoc(collection(db, "journalEntries"), {
      ...entry,
      entryNumber,
      isPosted: true,
      createdAt: Date.now(),
    });
    return docRef.id;
  } catch (err) {
    console.error("Failed to create journal entry:", err);
    return null;
  }
}

export function buildSaleJournal(sale: Sale, recordedByName: string): Omit<JournalEntry, "id" | "entryNumber" | "isPosted" | "createdAt"> {
  const lines: JournalLine[] = [];
  const cashAmt = sale.payment.receivedAmount;
  const dueAmt = sale.payment.balanceDue;
  const discount = sale.discountAmount;

  if (cashAmt > 0) {
    const cashCode = sale.payment.method === "bank" || sale.payment.method === "qr" || sale.payment.method === "bank_transfer" ? "1.1.2" : "1.1.1";
    lines.push({ accountCode: cashCode, accountName: cashCode === "1.1.2" ? "Bank Account" : "Cash in Hand", debit: cashAmt, credit: 0 });
  }
  if (dueAmt > 0) {
    lines.push({ accountCode: "1.1.6", accountName: "Sundry Debtors", debit: dueAmt, credit: 0 });
  }
  if (discount > 0) {
    lines.push({ accountCode: "4.1.2", accountName: "Discount Received", debit: 0, credit: discount });
  }
  const totalCredit = sale.finalAmount + (discount > 0 ? discount : 0);
  const drTotal = lines.reduce((s, l) => s + l.debit, 0);
  const crRemaining = totalCredit - drTotal;
  if (crRemaining > 0) {
    lines.push({ accountCode: "4.1.1", accountName: "Sales Revenue", debit: 0, credit: crRemaining });
  }
  if (drTotal > totalCredit) {
    lines.push({ accountCode: "4.1.1", accountName: "Sales Revenue", debit: 0, credit: drTotal - totalCredit });
  }

  return {
    entryDate: typeof sale.saleDate === "number" ? sale.saleDate : Date.now(),
    description: `Sale ${sale.orderId} - ${sale.customer.name}`,
    lines,
    referenceType: "sale",
    referenceId: sale.id,
    recordedBy: sale.recordedBy,
    recordedByName,
  };
}

export function buildSaleCogsJournal(sale: Sale, totalCost: number, recordedByName: string): Omit<JournalEntry, "id" | "entryNumber" | "isPosted" | "createdAt"> {
  const lines: JournalLine[] = [
    { accountCode: "5.1.1", accountName: "Cost of Goods Sold", debit: totalCost, credit: 0 },
    { accountCode: "1.1.4", accountName: "Stock in Trade", debit: 0, credit: totalCost },
  ];
  return {
    entryDate: typeof sale.saleDate === "number" ? sale.saleDate : Date.now(),
    description: `COGS for Sale ${sale.orderId}`,
    lines,
    referenceType: "sale",
    referenceId: sale.id,
    recordedBy: sale.recordedBy,
    recordedByName,
  };
}

export function buildPurchaseJournal(purchase: Purchase, recordedByName: string): Omit<JournalEntry, "id" | "entryNumber" | "isPosted" | "createdAt"> {
  const lines: JournalLine[] = [
    { accountCode: "1.1.4", accountName: "Stock in Trade", debit: purchase.totalAmount, credit: 0 },
  ];

  if (purchase.paymentStatus === "paid") {
    const code = purchase.paymentMethod === "bank" || purchase.paymentMethod === "qr" ? "1.1.2" : "1.1.1";
    lines.push({ accountCode: code, accountName: code === "1.1.2" ? "Bank Account" : "Cash in Hand", debit: 0, credit: purchase.totalAmount });
  } else if (purchase.paymentStatus === "advance") {
    lines.push({ accountCode: "1.1.5", accountName: "Staff Advance", debit: 0, credit: purchase.paidAmount || 0 });
    const remainder = (purchase.totalAmount - (purchase.paidAmount || 0));
    if (remainder > 0) {
      lines.push({ accountCode: "1.1.1", accountName: "Cash in Hand", debit: 0, credit: remainder });
    }
  } else {
    lines.push({ accountCode: "2.1.1", accountName: "Sundry Creditors", debit: 0, credit: purchase.totalAmount });
  }

  return {
    entryDate: purchase.purchaseDate,
    description: `Purchase from ${purchase.supplierName}`,
    lines,
    referenceType: "purchase",
    referenceId: purchase.id,
    recordedBy: purchase.recordedBy,
    recordedByName,
  };
}

export function buildExpenseJournal(expense: Expense, recordedByName: string): Omit<JournalEntry, "id" | "entryNumber" | "isPosted" | "createdAt"> {
  const codeMap: Record<string, string> = {
    "Rent": "5.2.2", "Salary": "5.2.1", "Electricity": "5.2.3",
    "Water": "5.2.4", "Internet": "5.2.5", "Marketing": "5.2.6",
    "Travel": "5.2.7", "Maintenance": "5.2.8", "Packaging": "5.2.9",
    "Bank Charges": "5.2.10", "Taxes": "5.2.11", "Miscellaneous": "5.2.12", "Other": "5.2.12",
  };
  const expenseCode = codeMap[expense.head] || "5.2.12";
  const cashCode = expense.paymentMethod === "bank" ? "1.1.2" : "1.1.1";
  const lines: JournalLine[] = [
    { accountCode: expenseCode, accountName: expense.head, debit: expense.amount, credit: 0 },
    { accountCode: cashCode, accountName: cashCode === "1.1.2" ? "Bank Account" : "Cash in Hand", debit: 0, credit: expense.amount },
  ];
  return {
    entryDate: expense.date,
    description: expense.title,
    lines,
    referenceType: "expense",
    referenceId: expense.id,
    recordedBy: expense.recordedBy,
    recordedByName,
  };
}

export function buildTransferJournal(transfer: Transfer, recordedByName: string): Omit<JournalEntry, "id" | "entryNumber" | "isPosted" | "createdAt"> {
  const lines: JournalLine[] = [];
  if (transfer.type === "bank_deposit") {
    lines.push(
      { accountCode: "1.1.2", accountName: "Bank Account", debit: transfer.amount, credit: 0 },
      { accountCode: "1.1.1", accountName: "Cash in Hand", debit: 0, credit: transfer.amount },
    );
  } else {
    lines.push(
      { accountCode: "1.1.5", accountName: "Staff Advance", debit: transfer.amount, credit: 0 },
      { accountCode: "1.1.1", accountName: "Cash in Hand", debit: 0, credit: transfer.amount },
    );
  }
  return {
    entryDate: transfer.date,
    description: transfer.description,
    lines,
    referenceType: "transfer",
    referenceId: transfer.id,
    recordedBy: transfer.recordedBy,
    recordedByName,
  };
}

export function buildAdvanceSettlementJournal(
  purchase: Purchase,
  settledAmount: number,
  transfer: Transfer,
  recordedByName: string,
  topUpAmount: number = 0,
): Omit<JournalEntry, "id" | "entryNumber" | "isPosted" | "createdAt"> {
  const lines: JournalLine[] = [
    { accountCode: "1.1.4", accountName: "Stock in Trade", debit: purchase.totalAmount, credit: 0 },
    { accountCode: "1.1.5", accountName: "Staff Advance", debit: 0, credit: settledAmount },
  ];
  if (topUpAmount > 0) {
    lines.push({ accountCode: "1.1.1", accountName: "Cash in Hand", debit: 0, credit: topUpAmount });
  }
  return {
    entryDate: purchase.purchaseDate,
    description: `Advance settlement for purchase from ${purchase.supplierName}`,
    lines,
    referenceType: "advance",
    referenceId: purchase.id,
    recordedBy: transfer.recordedBy,
    recordedByName,
  };
}

export function buildDebtorPaymentJournal(
  customerName: string,
  amount: number,
  method: string,
  debtorId: string,
  recordedBy: string,
  recordedByName: string,
): Omit<JournalEntry, "id" | "entryNumber" | "isPosted" | "createdAt"> {
  const cashCode = method === "bank" || method === "bank_transfer" || method === "qr" ? "1.1.2" : "1.1.1";
  const lines: JournalLine[] = [
    { accountCode: cashCode, accountName: cashCode === "1.1.2" ? "Bank Account" : "Cash in Hand", debit: amount, credit: 0 },
    { accountCode: "1.1.6", accountName: "Sundry Debtors", debit: 0, credit: amount },
  ];
  return {
    entryDate: Date.now(),
    description: `Debtor payment from ${customerName}`,
    lines,
    referenceType: "debtor_payment",
    referenceId: debtorId,
    recordedBy,
    recordedByName,
  };
}

export function buildCreditorPaymentJournal(
  supplierName: string,
  amount: number,
  method: string,
  creditorId: string,
  recordedBy: string,
  recordedByName: string,
): Omit<JournalEntry, "id" | "entryNumber" | "isPosted" | "createdAt"> {
  const cashCode = method === "bank" || method === "bank_transfer" || method === "qr" ? "1.1.2" : "1.1.1";
  const lines: JournalLine[] = [
    { accountCode: "2.1.1", accountName: "Sundry Creditors", debit: amount, credit: 0 },
    { accountCode: cashCode, accountName: cashCode === "1.1.2" ? "Bank Account" : "Cash in Hand", debit: 0, credit: amount },
  ];
  return {
    entryDate: Date.now(),
    description: `Payment to supplier ${supplierName}`,
    lines,
    referenceType: "creditor_payment",
    referenceId: creditorId,
    recordedBy,
    recordedByName,
  };
}

export function buildSalesReturnJournal(
  sale: Sale,
  refundAmount: number,
  recordedBy: string,
  recordedByName: string,
): Omit<JournalEntry, "id" | "entryNumber" | "isPosted" | "createdAt"> {
  const lines: JournalLine[] = [
    { accountCode: "4.1.3", accountName: "Sales Returns", debit: refundAmount, credit: 0 },
    { accountCode: "1.1.1", accountName: "Cash in Hand", debit: 0, credit: refundAmount },
  ];
  return {
    entryDate: Date.now(),
    description: `Sales return refund - ${sale.customer?.name || "Walk-in"}`,
    lines,
    referenceType: "sales_return",
    referenceId: sale.id,
    recordedBy,
    recordedByName,
  };
}

export async function getJournalEntries(
  referenceType?: string,
  referenceId?: string,
): Promise<JournalEntry[]> {
  try {
    const ref = collection(db, "journalEntries");
    const q = referenceType
      ? query(ref, orderBy("entryDate", "desc"), limit(500))
      : query(ref, orderBy("entryDate", "desc"), limit(500));
    const snap = await getDocs(q);
    let entries = snap.docs.map((d) => ({ ...d.data(), id: d.id } as JournalEntry));
    if (referenceType) {
      entries = entries.filter((e) => e.referenceType === referenceType);
    }
    if (referenceId) {
      entries = entries.filter((e) => e.referenceId === referenceId);
    }
    return entries;
  } catch {
    return [];
  }
}
