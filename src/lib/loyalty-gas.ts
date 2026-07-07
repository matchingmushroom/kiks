export interface GASBalance {
  phone: string;
  name: string;
  currentPoints: number;
  lifetimePoints: number;
}

export interface GASTransaction {
  txnId: string;
  phone: string;
  type: "earn" | "redeem" | "refund" | "adjust";
  points: number;
  referenceId: string;
  refType: string;
  note: string;
  createdAt: string;
}

export interface GASLookup {
  phone: string;
  name: string;
  address: string;
  email: string;
  registeredAt: string;
  currentPoints: number;
  lifetimePoints: number;
}

export interface GASResponse<T> {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
}

let cachedUrl: string | null = null;

function getBaseUrl(): string {
  if (cachedUrl) return cachedUrl;
  try {
    const stored = localStorage.getItem("pc_gas_url");
    if (stored) cachedUrl = stored.replace(/\/+$/, "");
  } catch {}
  return cachedUrl || "";
}

export function setGasUrl(url: string) {
  cachedUrl = url.replace(/\/+$/, "");
  try { localStorage.setItem("pc_gas_url", cachedUrl); } catch {}
}

export function getGasUrl(): string {
  return getBaseUrl();
}

async function gasGet<T>(params: Record<string, string>): Promise<GASResponse<T>> {
  const base = getBaseUrl();
  if (!base) return { ok: false, error: "GAS URL not configured" };
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${base}?${qs}`);
  return res.json();
}

async function gasPost<T>(body: Record<string, any>): Promise<GASResponse<T>> {
  const base = getBaseUrl();
  if (!base) return { ok: false, error: "GAS URL not configured" };
  const res = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function ping(): Promise<GASResponse<{ message: string }>> {
  return gasGet({ action: "ping" });
}

export function registerCustomer(phone: string, name: string, address?: string, email?: string) {
  return gasPost({ action: "register", phone, name, address, email });
}

export function addTransaction(
  phone: string,
  type: "earn" | "redeem" | "refund" | "adjust",
  points: number,
  referenceId?: string,
  refType?: string,
  note?: string,
) {
  return gasPost({ action: "transaction", phone, type, points, referenceId, refType, note });
}

export function getBalance(phone: string): Promise<GASResponse<GASBalance>> {
  return gasGet({ action: "balance", phone });
}

export function getHistory(phone: string): Promise<GASResponse<GASTransaction[]>> {
  return gasGet({ action: "history", phone });
}

export function lookupCustomer(phone: string): Promise<GASResponse<GASLookup>> {
  return gasGet({ action: "lookup", phone });
}
