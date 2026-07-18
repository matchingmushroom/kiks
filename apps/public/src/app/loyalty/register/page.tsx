"use client";

import { useEffect, useState } from "react";
import { registerCustomer, setGasUrl } from "@/lib/loyalty-gas";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { Gift, CheckCircle, Loader2, Sparkles, Star, Shield, ArrowRight, AlertTriangle } from "lucide-react";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";
import Link from "next/link";

export default function LoyaltyRegisterPage() {
  const { settings } = useShopSettings();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (settings.gasLoyaltyUrl) setGasUrl(settings.gasLoyaltyUrl);
  }, [settings.gasLoyaltyUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !name) return;
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const rl = await checkRateLimit("loyalty_reg_" + phone.replace(/\D/g, ""), { maxAttempts: 3, windowMs: 3600000 });
    if (!rl.allowed) {
      setResult({ ok: false, message: "Too many registration attempts. Try again later." });
      return;
    }
    setLoading(true);
    setResult(null);
    const cleanPhone = phone.replace(/\D/g, "");
    const res = await registerCustomer(cleanPhone, name, address);
    setResult({ ok: res.ok, message: res.ok ? "Registered successfully! Welcome to our loyalty program." : res.error || "Registration failed" });
    if (res.ok) { setPhone(""); setName(""); setAddress(""); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ShopHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-b from-amber-50/80 via-white to-white pb-12 pt-8 sm:pt-16">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-amber-100/30 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent/10 rounded-full text-accent text-xs font-semibold tracking-wide mb-4">
                <Sparkles className="h-3.5 w-3.5" />
                EXCLUSIVE REWARDS
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-secondary tracking-tight">
                Join Our{" "}
                <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">Loyalty Program</span>
              </h1>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
                Earn points on every purchase and unlock exclusive discounts &mdash; your loyalty, rewarded.
              </p>
            </div>
            <div className="max-w-lg mx-auto">
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-black/5 border border-border/60 p-6 sm:p-10">
                {result && (
                  <div className={`p-4 rounded-xl mb-6 text-sm font-medium border ${
                    result.ok
                      ? "bg-emerald-50/80 border-emerald-200 text-emerald-700"
                      : "bg-red-50/80 border-red-200 text-red-700"
                  }`}>
                    <div className="flex items-start gap-3">
                      {result.ok ? (
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                          <Gift className="h-5 w-5 text-red-500" />
                        </div>
                      )}
                      <div className="pt-1">
                        <p className="font-semibold">{result.ok ? "Welcome aboard!" : "Something went wrong"}</p>
                        <p className="text-xs mt-0.5 opacity-80">{result.message}</p>
                      </div>
                    </div>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5 tracking-wide uppercase">Mobile Number *</label>
                    <input type="tel" value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9841xxxxxx" required
                      className="w-full px-4 py-3.5 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5 tracking-wide uppercase">Full Name *</label>
                    <input type="text" value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name" required
                      className="w-full px-4 py-3.5 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5 tracking-wide uppercase">Address</label>
                    <input type="text" value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Your address (optional)"
                      className="w-full px-4 py-3.5 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40" />
                  </div>
                  <button type="submit" disabled={loading || !phone || !name}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-gray-800 font-bold rounded-xl text-sm hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-200">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                    {loading ? "Registering..." : "Register Now"}
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </button>
                </form>
              </div>
              <div className="text-center mt-6">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Already a member?{" "}
                  <Link href="/loyalty/check" className="text-accent font-semibold hover:underline inline-flex items-center gap-1">
                    Check your points <ArrowRight className="h-3 w-3" />
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="py-12 sm:py-16 bg-muted/20 border-t border-border/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-10">
              <h2 className="text-xl sm:text-2xl font-bold text-secondary">Why Join?</h2>
              <p className="text-sm text-muted-foreground mt-2">Perks designed for our valued customers</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[
                { icon: Star, title: "Earn Points", desc: "Get points on every purchase &mdash; the more you shop, the more you save." },
                { icon: Gift, title: "Exclusive Rewards", desc: "Redeem points for discounts on your favourite jewellery pieces." },
                { icon: Shield, title: "Member Benefits", desc: "Early access to new collections and special member-only offers." },
              ].map((item) => (
                <div key={item.title} className="bg-white rounded-xl sm:rounded-2xl border border-border/60 p-5 sm:p-6 hover:shadow-md hover:border-accent/20 transition-all group">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-accent/10 to-primary/10 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                    <item.icon className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-secondary">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.desc }} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <ShopFooter />
    </div>
  );
}
