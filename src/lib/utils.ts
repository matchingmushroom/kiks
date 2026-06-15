import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ne-NP", {
    style: "currency",
    currency: "NPR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function toDate(v: unknown): Date {
  if (v && typeof (v as any).toDate === "function") return (v as any).toDate();
  if (v && typeof (v as any).getTime === "function") return new Date((v as any).getTime());
  if (typeof v === "number") return new Date(v);
  return new Date(Number(v) || 0);
}

export function formatDate(timestamp: unknown): string {
  return new Intl.DateTimeFormat("ne-NP", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(toDate(timestamp));
}

export function formatDateTime(timestamp: unknown): string {
  return new Intl.DateTimeFormat("ne-NP", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(toDate(timestamp));
}

export function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  const r = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${y}${m}${d}-${r}`;
}

export function generateCouponCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + "...";
}
