"use client";

import { useState } from "react";
import { registerCustomer } from "@/lib/loyalty-gas";
import { Gift, CheckCircle, Loader2 } from "lucide-react";

export default function LoyaltyRegisterPage() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !name) return;
    setLoading(true);
    setResult(null);
    const res = await registerCustomer(phone.replace(/\D/g, ""), name, address);
    setResult({ ok: res.ok, message: res.ok ? "Registered successfully! Welcome to our loyalty program." : res.error || "Registration failed" });
    if (res.ok) { setPhone(""); setName(""); setAddress(""); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Gift className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-secondary">Join Loyalty Program</h1>
          <p className="text-sm text-muted-foreground mt-1">Earn points on every purchase and redeem discounts</p>
        </div>

        {result && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${result.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            <div className="flex items-center gap-2">
              {result.ok && <CheckCircle className="h-5 w-5 shrink-0" />}
              {result.message}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Mobile Number *</label>
            <input type="tel" value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="9841xxxxxx" required
              className="w-full px-4 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name *</label>
            <input type="text" value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name" required
              className="w-full px-4 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Address</label>
            <input type="text" value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Your address (optional)"
              className="w-full px-4 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button type="submit" disabled={loading || !phone || !name}
            className="w-full py-3 bg-accent text-secondary font-bold rounded-xl text-sm hover:bg-accent/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Already registered? <a href="/loyalty/check" className="text-accent font-medium hover:underline">Check your points</a>
        </p>
      </div>
    </div>
  );
}
