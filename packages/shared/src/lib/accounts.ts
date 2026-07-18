import { collection, getDocs, setDoc, doc, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AccountHead } from "@/types";

export interface AccountDef {
  id: string;
  name: string;
  type: "cash" | "bank";
}

export const ACCOUNTS: AccountDef[] = [
  { id: "cash_in_hand", name: "Cash in Hand", type: "cash" },
  { id: "bank_account", name: "Bank Account", type: "bank" },
];

export function resolveAccount(paymentMethod: string): string {
  if (paymentMethod === "bank" || paymentMethod === "bank_transfer") return "bank_account";
  if (paymentMethod === "qr") return "bank_account";
  return "cash_in_hand";
}

export function resolveAccountCode(paymentMethod: string): string {
  if (paymentMethod === "cash") return "1.1.1";
  if (paymentMethod === "bank" || paymentMethod === "qr" || paymentMethod === "bank_transfer") return "1.1.2";
  if (paymentMethod === "credit") return "1.1.6";
  if (paymentMethod === "advance") return "1.1.5";
  return "1.1.1";
}

export function getAccountById(id: string): AccountDef | undefined {
  return ACCOUNTS.find((a) => a.id === id);
}

export const DEFAULT_ACCOUNTS: AccountHead[] = [
  { id: "cash_in_hand", code: "1.1.1", name: "Cash in Hand", category: "asset", subCategory: "current_asset", isActive: true, openingBalance: 0 },
  { id: "bank_account", code: "1.1.2", name: "Bank Account", category: "asset", subCategory: "current_asset", isActive: true, openingBalance: 0 },
  { id: "petty_cash", code: "1.1.3", name: "Petty Cash", category: "asset", subCategory: "current_asset", isActive: true, openingBalance: 0 },
  { id: "stock_in_trade", code: "1.1.4", name: "Stock in Trade", category: "asset", subCategory: "current_asset", isActive: true, openingBalance: 0 },
  { id: "staff_advance", code: "1.1.5", name: "Staff Advance", category: "asset", subCategory: "current_asset", isActive: true, openingBalance: 0 },
  { id: "sundry_debtors", code: "1.1.6", name: "Sundry Debtors", category: "asset", subCategory: "current_asset", isActive: true, openingBalance: 0 },
  { id: "fixed_assets", code: "1.1.7", name: "Fixed Assets", category: "asset", subCategory: "fixed_asset", isActive: true, openingBalance: 0 },
  { id: "sundry_creditors", code: "2.1.1", name: "Sundry Creditors", category: "liability", subCategory: "current_liability", isActive: true, openingBalance: 0 },
  { id: "outstanding_expenses", code: "2.1.2", name: "Outstanding Expenses", category: "liability", subCategory: "current_liability", isActive: true, openingBalance: 0 },
  { id: "bank_loan", code: "2.1.3", name: "Bank Loan", category: "liability", subCategory: "long_term_liability", isActive: true, openingBalance: 0 },
  { id: "owners_capital", code: "3.1.1", name: "Owner's Capital", category: "equity", subCategory: "capital", isActive: true, openingBalance: 0 },
  { id: "retained_earnings", code: "3.1.2", name: "Retained Earnings", category: "equity", subCategory: "reserves", isActive: true, openingBalance: 0 },
  { id: "drawings", code: "3.1.3", name: "Drawings", category: "equity", subCategory: "drawings", isActive: true, openingBalance: 0 },
  { id: "sales_revenue", code: "4.1.1", name: "Sales Revenue", category: "income", subCategory: "revenue", isActive: true, openingBalance: 0 },
  { id: "discount_received", code: "4.1.2", name: "Discount Received", category: "income", subCategory: "other_income", isActive: true, openingBalance: 0 },
  { id: "other_income", code: "4.1.3", name: "Other Income", category: "income", subCategory: "other_income", isActive: true, openingBalance: 0 },
  { id: "cogs", code: "5.1.1", name: "Cost of Goods Sold", category: "expense", subCategory: "direct_expense", isActive: true, openingBalance: 0 },
  { id: "salary", code: "5.2.1", name: "Salary", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
  { id: "rent", code: "5.2.2", name: "Rent", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
  { id: "electricity", code: "5.2.3", name: "Electricity", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
  { id: "water", code: "5.2.4", name: "Water", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
  { id: "internet", code: "5.2.5", name: "Internet", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
  { id: "marketing", code: "5.2.6", name: "Marketing", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
  { id: "travel", code: "5.2.7", name: "Travel", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
  { id: "maintenance", code: "5.2.8", name: "Maintenance", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
  { id: "packaging", code: "5.2.9", name: "Packaging", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
  { id: "bank_charges", code: "5.2.10", name: "Bank Charges", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
  { id: "taxes", code: "5.2.11", name: "Taxes", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
  { id: "miscellaneous_expense", code: "5.2.12", name: "Miscellaneous Expense", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
];

export async function seedDefaultAccounts(): Promise<void> {
  const snap = await getDocs(query(collection(db, "chartOfAccounts"), limit(1)));
  if (!snap.empty) return;
  const batch = DEFAULT_ACCOUNTS.map((a) => setDoc(doc(db, "chartOfAccounts", a.id), a));
  await Promise.all(batch);
}

export async function getChartOfAccounts(): Promise<AccountHead[]> {
  const snap = await getDocs(collection(db, "chartOfAccounts"));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as AccountHead));
}

export function getAccountByCode(code: string, accounts: AccountHead[]): AccountHead | undefined {
  return accounts.find((a) => a.code === code);
}

export function getAccountsByCategory(category: string, accounts: AccountHead[]): AccountHead[] {
  return accounts.filter((a) => a.category === category);
}
