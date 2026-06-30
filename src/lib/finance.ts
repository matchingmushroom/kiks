export interface PnlResult {
  grossRevenue: number;
  cogs: number;
  grossProfit: number;
  totalExpenses: number;
  expenseByHead: Record<string, number>;
  netProfit: number;
  saleCount: number;
}

export interface BalanceSheetResult {
  cashBalance: number;
  bankBalance: number;
  closingStock: number;
  productCount: number;
  sundryDebtors: number;
  sundryCreditors: number;
  openingCapital: number;
  retainedEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

function safeMs(d: unknown): number {
  if (!d) return 0;
  if (typeof d === "number") return d;
  if (typeof (d as any)?.toMillis === "function") return (d as any).toMillis();
  if (typeof (d as any)?.seconds === "number") return (d as any).seconds * 1000;
  if (d instanceof Date) return d.getTime();
  return Number(d) || 0;
}

import { Sale, Expense, Product, Debtor, Creditor, Account, AccountTransaction } from "@/types";

export function computePnl(
  sales: Sale[],
  expenses: Expense[],
  startMs: number,
  endMs: number
): PnlResult {
  const periodSales = sales.filter((s) => {
    if (s.returned || s.archived) return false;
    const d = safeMs(s.saleDate);
    return d >= startMs && d <= endMs;
  });

  const grossRevenue = periodSales.reduce((sum, s) => sum + s.finalAmount, 0);
  const saleCount = periodSales.length;

  const cogs = periodSales.reduce((sum, s) => {
    return sum + (s.items || []).reduce((itemSum, item) => {
      return itemSum + (item.quantity || 0) * (item.costPriceAtSale || 0);
    }, 0);
  }, 0);

  const grossProfit = grossRevenue - cogs;

  const periodExpenses = expenses.filter((e) => {
    if (e.archived) return false;
    const d = safeMs(e.date);
    return d >= startMs && d <= endMs;
  });

  const expenseByHead: Record<string, number> = {};
  let totalExpenses = 0;
  for (const exp of periodExpenses) {
    const head = exp.customHead || exp.head;
    expenseByHead[head] = (expenseByHead[head] || 0) + exp.amount;
    totalExpenses += exp.amount;
  }

  const netProfit = grossProfit - totalExpenses;

  return { grossRevenue, cogs, grossProfit, totalExpenses, expenseByHead, netProfit, saleCount };
}

export function computeBalanceSheet(
  sales: Sale[],
  expenses: Expense[],
  products: Product[],
  debtors: Debtor[],
  creditors: Creditor[],
  accounts: Account[],
  transactions: AccountTransaction[],
  partnersCapital: number,
  asOfMs: number
): BalanceSheetResult {
  const txFilter = (t: AccountTransaction) => safeMs(t.date) <= asOfMs;
  const relevantTx = transactions.filter(txFilter);

  const cashAccount = accounts.find((a) => a.id === "cash_in_hand");
  const bankAccount = accounts.find((a) => a.id === "bank_account");

  const cashCredits = relevantTx.filter((t) => t.accountId === "cash_in_hand" && t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const cashDebits = relevantTx.filter((t) => t.accountId === "cash_in_hand" && t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const cashBalance = (cashAccount?.openingBalance || 0) + cashCredits - cashDebits;

  const bankCredits = relevantTx.filter((t) => t.accountId === "bank_account" && t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const bankDebits = relevantTx.filter((t) => t.accountId === "bank_account" && t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const bankBalance = (bankAccount?.openingBalance || 0) + bankCredits - bankDebits;

  const activeProducts = products.filter((p) => p.isActive && !p.comboItems?.length);
  const closingStock = activeProducts.reduce((sum, p) => sum + (p.quantityInStock || 0) * (p.costPrice || 0), 0);
  const productCount = activeProducts.reduce((sum, p) => sum + (p.quantityInStock || 0), 0);

  const sundryDebtors = debtors.filter((d) => d.status === "active").reduce((sum, d) => sum + d.balanceDue, 0);
  const sundryCreditors = creditors.filter((c) => c.status === "active").reduce((sum, c) => sum + c.balanceDue, 0);

  const allSalesUpToDate = sales.filter((s) => {
    if (s.returned || s.archived) return false;
    return safeMs(s.saleDate) <= asOfMs;
  });
  const totalRevenue = allSalesUpToDate.reduce((sum, s) => sum + s.finalAmount, 0);
  const totalCogs = allSalesUpToDate.reduce((sum, s) => {
    return sum + (s.items || []).reduce((itemSum, item) => {
      return itemSum + (item.quantity || 0) * (item.costPriceAtSale || 0);
    }, 0);
  }, 0);

  const allExpensesUpToDate = expenses.filter((e) => {
    if (e.archived) return false;
    return safeMs(e.date) <= asOfMs;
  });
  const totalExpenses = allExpensesUpToDate.reduce((sum, e) => sum + e.amount, 0);

  const retainedEarnings = totalRevenue - totalCogs - totalExpenses;

  const totalAssets = cashBalance + bankBalance + closingStock + sundryDebtors;
  const totalLiabilities = sundryCreditors;
  const totalEquity = partnersCapital + retainedEarnings;

  return {
    cashBalance, bankBalance, closingStock, productCount,
    sundryDebtors, sundryCreditors, openingCapital: partnersCapital,
    retainedEarnings, totalAssets, totalLiabilities, totalEquity,
  };
}
