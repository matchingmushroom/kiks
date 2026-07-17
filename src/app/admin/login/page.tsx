"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ArrowLeft, Loader2 } from "lucide-react";

const ERROR_MAP: Record<string, string> = {
  "auth/invalid-credential": "Invalid email or password.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/invalid-email": "Invalid email format.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/network-request-failed": "Network error. Check your internet connection.",
  "auth/unauthorized-domain": "Domain not authorized for login.",
  "auth/internal-error": "Internal error. Please try again.",
  "auth/operation-not-allowed": "Email/password login is not enabled.",
};

export default function LoginPage() {
  const { settings } = useShopSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { user, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/admin");
    }
  }, [user, router]);

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/admin");
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      const code = e.code || "";
      console.error("Login error:", code, e.message);
      setError(ERROR_MAP[code] || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted to-secondary/5 p-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-secondary mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Shop
        </Link>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <img src="/logo.svg" alt={settings.shopName} className="h-12 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-secondary">Admin Login</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your dashboard</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                placeholder="Enter your email"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                placeholder="Enter your password"
                required
              />
              <div className="mt-1 text-right">
                {resetSent ? (
                  <span className="text-xs text-green-600">Reset link sent! Check your email.</span>
                ) : (
                  <button type="button" disabled={resetting || !email} onClick={async () => {
                    if (!email) return;
                    setResetting(true);
                    try {
                      await sendPasswordResetEmail(auth, email);
                      setResetSent(true);
                    } catch { setError("Failed to send reset email."); }
                    setResetting(false);
                  }} className="text-xs text-primary hover:underline disabled:opacity-50">
                    {resetting ? <Loader2 className="h-3 w-3 inline animate-spin" /> : null} Forgot password?
                  </button>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
