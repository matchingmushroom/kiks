"use client";

import { useState } from "react";
import { getBalance, getHistory, setGasUrl, getGasUrl } from "@/lib/loyalty-gas";
import type { GASTransaction } from "@/lib/loyalty-gas";
import { Gift, Search, TrendingUp, History, Loader2, ChevronDown, ChevronUp } from "lucide-react";

export default function LoyaltyCheckPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<{ name: string; currentPoints: number; lifetimePoints: number } | null>(null);
  const [history, setHistory] = useState<GASTransaction[]>([]);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-start justify-center p-4 pt-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Gift className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-secondary">Loyalty Points</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your mobile number to check your points</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <div className="flex gap-2">
            <input type="tel" value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="9841xxxxxx"
              onKeyDown={(e) => e.key === "Enter" && handleCheck()}
              className="flex-1 px-4 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={handleCheck} disabled={loading || !phone}
              className="px-5 py-3 bg-accent text-secondary font-bold rounded-xl text-sm hover:bg-accent/90 disabled:opacity-50 transition-all flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Check
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
              <a href="/loyalty/register" className="block mt-2 font-medium text-accent hover:underline">Register here →</a>
            </div>
          )}

          {balance && (
            <>
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-5 text-center">
                <p className="text-sm text-muted-foreground">Welcome, <span className="font-semibold text-secondary">{balance.name}</span></p>
                <p className="text-4xl font-bold text-accent mt-2">{balance.currentPoints}</p>
                <p className="text-xs text-muted-foreground mt-1">Current Points</p>
                <p className="text-xs text-muted-foreground mt-2">Lifetime: {balance.lifetimePoints} pts</p>
              </div>

              {history.length > 0 && (
                <div>
                  <button onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-secondary w-full justify-center py-2">
                    <History className="h-3.5 w-3.5" />
                    {showHistory ? "Hide" : "Show"} History ({history.length})
                    {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {showHistory && (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto mt-1">
                      {history.map((txn) => (
                        <div key={txn.txnId} className="flex items-center justify-between px-3 py-2 bg-muted/20 rounded-lg text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              txn.type === "earn" ? "bg-green-500" :
                              txn.type === "redeem" ? "bg-blue-500" : "bg-orange-500"
                            }`} />
                            <span className="capitalize text-muted-foreground">{txn.type}</span>
                            {txn.note && <span className="text-muted-foreground/60">· {txn.note}</span>}
                          </div>
                          <span className={`font-semibold ${
                            txn.points > 0 ? "text-green-600" : "text-red-500"
                          }`}>
                            {txn.points > 0 ? "+" : ""}{txn.points}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Not yet registered? <a href="/loyalty/register" className="text-accent font-medium hover:underline">Join now</a>
        </p>
      </div>
    </div>
  );
}
