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

export function getAccountById(id: string): AccountDef | undefined {
  return ACCOUNTS.find((a) => a.id === id);
}
