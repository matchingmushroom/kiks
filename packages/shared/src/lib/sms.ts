import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface SmsConfig {
  provider: "sparrowsms" | "smsfactory";
  apiKey: string;
  senderId: string;
}

export async function getSmsConfig(): Promise<SmsConfig | null> {
  try {
    const snap = await getDoc(doc(db, "shop_settings", "smsConfig"));
    if (!snap.exists()) return null;
    const data = snap.data() as SmsConfig;
    if (!data.apiKey) return null;
    return data;
  } catch {
    return null;
  }
}

export async function sendSMS(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getSmsConfig();
  if (!cfg) return { ok: false, error: "SMS not configured. Set up in Settings." };

  const cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.length < 10) return { ok: false, error: "Invalid phone number" };

  try {
    if (cfg.provider === "sparrowsms") {
      const body = new URLSearchParams({
        token: cfg.apiKey,
        from: cfg.senderId,
        to: cleanPhone,
        text: message,
      });
      const res = await fetch("https://api.sparrowsms.com/v2/sms/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const data = await res.json();
      if (data.code === "success" || data.status === "success") return { ok: true };
      return { ok: false, error: data.message || "SparrowSMS error" };
    }

    if (cfg.provider === "smsfactory") {
      const res = await fetch("https://smsfactory.io/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: cfg.apiKey,
          sender: cfg.senderId,
          to: cleanPhone,
          message,
        }),
      });
      const data = await res.json();
      if (data.status === "success" || data.success) return { ok: true };
      return { ok: false, error: data.message || "SMSFactory error" };
    }

    return { ok: false, error: "Unknown SMS provider" };
  } catch (e: any) {
    return { ok: false, error: e.message || "Network error" };
  }
}
