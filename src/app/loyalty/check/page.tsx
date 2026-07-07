"use client";

import { useEffect, useState } from "react";
import { getBalance, getHistory, initGasUrl } from "@/lib/loyalty-gas";
import type { GASTransaction } from "@/lib/loyalty-gas";
import { Gift, Search, TrendingUp, History, Loader2, ChevronDown, ChevronUp, Sparkles, ArrowRight, Award, Clock } from "lucide-react";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";
import Link from "next/link";

export default function LoyaltyCheckPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<{ name: string; currentPoints: number; lifetimePoints: number } | null>(null);
  const [history, setHistory] = useState<GASTransaction[]>([]);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { initGasUrl(); }, []);

  const handleCheck = async () => {
    if (!phone) return;
    setLoading(true);
    setError("");
    setBalance(null);
    setHistory([]);
    const balRes = await getBalance(phone.replace(/\D/g, ""));
    if (!balRes.ok || !balRes.data) {
      setError(balRes.error || "Phone not registered. Please register first.");
      setLoading(false);
      return;
    }
    setBalance(balRes.data);
    const histRes = await getHistory(phone.replace(/\D/g, ""));
    if (histRes.ok && histRes.data) setHistory(histRes.data);
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
                <Award className="h-3.5 w-3.5" />
                YOUR REWARDS
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-secondary tracking-tight">
                Check Your{" "}
                <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">Loyalty Points</span>
              </h1>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
                Enter your mobile number to see your points balance and transaction history.
              </p>
            </div>
            <div className="max-w-lg mx-auto">
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-black/5 border border-border/60 p-6 sm:p-8">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <input type="tel" value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9841xxxxxx"
                      onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                      className="w-full pl-10 pr-4 py-3.5 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40" />
                  </div>
                  <button onClick={handleCheck} disabled={loading || !phone}
                    className="px-5 sm:px-6 py-3.5 bg-gradient-to-r from-accent to-primary text-white font-bold rounded-xl text-sm hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-2 shadow-lg shadow-accent/20 shrink-0">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="hidden sm:inline">Check</span>
                  </button>
                </div>

                {error && (
                  <div className="mt-5 p-4 bg-red-50/80 border border-red-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <Gift className="h-4 w-4 text-red-500" />
                      </div>
                      <div className="pt-0.5">
                        <p className="text-sm font-semibold text-red-700">Not Found</p>
                        <p className="text-xs text-red-600/80 mt-0.5">{error}</p>
                        <Link href="/loyalty/register" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline mt-2">
                          Register here <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {balance && (
                  <div className="mt-6 space-y-5">
                    <div className="relative overflow-hidden bg-gradient-to-br from-accent via-accent to-primary rounded-2xl p-6 sm:p-8 text-white">
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-black/5 rounded-full blur-2xl" />
                      </div>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Award className="h-5 w-5 text-white/80" />
                            <span className="text-xs font-semibold text-white/80 tracking-wide uppercase">Loyalty Balance</span>
                          </div>
                          <Sparkles className="h-4 w-4 text-white/60" />
                        </div>
                        <p className="text-sm text-white/80">Welcome, <span className="font-semibold text-white">{balance.name}</span></p>
                        <div className="mt-3 flex items-baseline gap-1.5">
                          <span className="text-5xl sm:text-6xl font-bold tracking-tight">{balance.currentPoints}</span>
                          <span className="text-sm text-white/70 font-medium">pts</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-4 text-xs text-white/70">
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5" />
                            <span>Lifetime: <strong className="text-white">{balance.lifetimePoints}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{history.length} transactions</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {history.length > 0 && (
                      <div className="bg-muted/20 rounded-xl border border-border/60 overflow-hidden">
                        <button onClick={() => setShowHistory(!showHistory)}
                          className="flex items-center justify-between w-full px-4 sm:px-5 py-3.5 text-sm font-semibold text-muted-foreground hover:text-secondary transition-colors">
                          <div className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            Transaction History
                            <span className="text-xs bg-muted/50 px-2 py-0.5 rounded-full text-muted-foreground">{history.length}</span>
                          </div>
                          {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        {showHistory && (
                          <div className="border-t border-border/60 px-2 pb-2 max-h-72 overflow-y-auto space-y-0.5">
                            {history.map((txn) => (
                              <div key={txn.txnId} className="flex items-center justify-between px-3 py-2.5 hover:bg-white rounded-lg text-xs sm:text-sm transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                                    txn.type === "earn" ? "bg-emerald-500" :
                                    txn.type === "redeem" ? "bg-blue-500" : "bg-orange-400"
                                  }`} />
                                  <div className="min-w-0">
                                    <p className="font-medium text-secondary capitalize truncate">{txn.type}</p>
                                    {txn.note && <p className="text-xs text-muted-foreground/60 truncate">{txn.note}</p>}
                                  </div>
                                </div>
                                <span className={`font-bold shrink-0 ml-3 ${
                                  txn.points > 0 ? "text-emerald-600" : "text-red-500"
                                }`}>
                                  {txn.points > 0 ? "+" : ""}{txn.points}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="text-center mt-6">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Not yet registered?{" "}
                  <Link href="/loyalty/register" className="text-accent font-semibold hover:underline inline-flex items-center gap-1">
                    Join our loyalty program <ArrowRight className="h-3 w-3" />
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <ShopFooter />
    </div>
  );
}
