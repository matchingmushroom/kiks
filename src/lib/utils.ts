import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  try {
    return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  } catch {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  }
}

export function formatCurrency(amount: number): string {
  return `Rs. ${formatNumber(amount)}`;
}

export function toDate(v: unknown): Date {
  if (v && typeof (v as any).toDate === "function") return (v as any).toDate();
  if (v && typeof (v as any).getTime === "function") return new Date((v as any).getTime());
  if (typeof v === "number") return new Date(v);
  return new Date(Number(v) || 0);
}

export function formatDate(timestamp: unknown): string {
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(toDate(timestamp));
}

export function formatDateTime(timestamp: unknown): string {
  return new Intl.DateTimeFormat("en-IN", {
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

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function convertBelowThousand(n: number): string {
  if (n === 0) return "";
  let s = "";
  if (n >= 100) { s += ones[Math.floor(n / 100)] + " Hundred "; n %= 100; }
  if (n >= 20) { s += tens[Math.floor(n / 10)] + " "; n %= 10; }
  if (n > 0) { s += ones[n] + " "; }
  return s.trim();
}

export function amountInWords(amount: number): string {
  if (amount === 0) return "Zero";
  let num = Math.floor(amount);
  const fraction = Math.round((amount - num) * 100);
  let result = "";
  if (num >= 10000000) { result += convertBelowThousand(Math.floor(num / 10000000)) + " Crore "; num %= 10000000; }
  if (num >= 100000) { result += convertBelowThousand(Math.floor(num / 100000)) + " Lakh "; num %= 100000; }
  if (num >= 1000) { result += convertBelowThousand(Math.floor(num / 1000)) + " Thousand "; num %= 1000; }
  result += convertBelowThousand(num);
  if (fraction > 0) result += ` and ${fraction}/100`;
  return result.trim() + " Only";
}

export function compressImageUnder200KB(file: File): Promise<{ base64: string; mimeType: string; filename: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const supportsWebP = typeof document !== "undefined" && document.createElement("canvas").toDataURL("image/webp").indexOf("image/webp") === 5;
      const ext = supportsWebP ? "webp" : "jpeg";
      const mime = supportsWebP ? "image/webp" : "image/jpeg";
      const baseName = file.name.replace(/\.[^.]+$/, "");

      let maxDim = 2000;
      let quality = 0.85;
      const MAX_TARGET = 200 * 1024;

      const tryCompress = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
          if (blob.size < MAX_TARGET) {
            const reader = new FileReader();
            reader.onload = () => resolve({ base64: (reader.result as string).split(",")[1], mimeType: mime, filename: `${baseName}.${ext}` });
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          } else {
            if (quality > 0.3) {
              quality -= 0.1;
              tryCompress();
            } else if (maxDim > 800) {
              maxDim = Math.max(800, maxDim - 400);
              quality = 0.85;
              tryCompress();
            } else {
              const reader = new FileReader();
              reader.onload = () => resolve({ base64: (reader.result as string).split(",")[1], mimeType: mime, filename: `${baseName}.${ext}` });
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            }
          }
        }, mime, quality);
      };
      tryCompress();
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
