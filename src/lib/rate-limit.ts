import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface RateLimitState {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

const DEFAULTS: Record<string, RateLimitConfig> = {
  login: { maxAttempts: 5, windowMs: 60000 },
  sms: { maxAttempts: 10, windowMs: 60000 },
  backup: { maxAttempts: 3, windowMs: 3600000 },
};

export async function checkRateLimit(
  key: string,
  config?: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const cfg = config || DEFAULTS[key] || { maxAttempts: 10, windowMs: 60000 };
  const ref = doc(db, "_rateLimits", key.replace(/[^a-zA-Z0-9_-]/g, "_"));
  const now = Date.now();

  try {
    const snap = await getDoc(ref);
    let state: RateLimitState = snap.exists()
      ? { count: snap.data().count || 0, windowStart: snap.data().windowStart || now }
      : { count: 0, windowStart: now };

    if (now - state.windowStart > cfg.windowMs) {
      state = { count: 1, windowStart: now };
    } else {
      state.count += 1;
    }

    await setDoc(ref, { ...state, updatedAt: serverTimestamp() });

    return {
      allowed: state.count <= cfg.maxAttempts,
      remaining: Math.max(0, cfg.maxAttempts - state.count),
      resetAt: state.windowStart + cfg.windowMs,
    };
  } catch {
    return { allowed: true, remaining: 1, resetAt: now };
  }
}
