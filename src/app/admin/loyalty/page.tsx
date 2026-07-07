"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { db } from "@/lib/firebase";
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Search, Award, CheckCircle, XCircle, TrendingUp, Clock, User, Phone } from "lucide-react";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/lib/utils";

interface SaleResult {
  id: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  saleDate: number;
  recordedByName: string;
}

export default function LoyaltyPage() {
  const { settings } = useShopSettings();
  const { profile } = useAuth();
  const [searchId, setSearchId] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [results, setResults] = useState<SaleResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [awardingId, setAwardingId] = useState<string | null>(null);

  const fetchBySaleId = async () => {
    if (!searchId.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const snap = await getDoc(doc(db, "sales", searchId.trim()));
      if (!snap.exists()) {
        setMessage("Sale not found");
        setResults([]);
        return;
      }
      const d = snap.data() as any;
      setResults([{
        id: snap.id,
        customerName: d.customer?.name || "Walk-in",
        customerPhone: d.customer?.phone || "",
        totalAmount: d.totalAmount || 0,
        discountAmount: d.discountAmount || 0,
        finalAmount: d.finalAmount || 0,
        saleDate: d.createdAt?.toMillis?.() || d.createdAt || Date.now(),
        recordedByName: d.recordedByName || "",
      }]);
    } catch (e: any) {
      setMessage("Error: " + (e.message || e));
    }
    setLoading(false);
  };

  const fetchByPhone = async () => {
    if (!searchPhone.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const snap = await getDocs(query(
        collection(db, "sales"),
        where("customer.phone", "==", searchPhone.trim()),
        orderBy("createdAt", "desc"),
        limit(20),
      ));
      const list: SaleResult[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          customerName: data.customer?.name || "Walk-in",
          customerPhone: data.customer?.phone || "",
          totalAmount: data.totalAmount || 0,
          discountAmount: data.discountAmount || 0,
          finalAmount: data.finalAmount || 0,
          saleDate: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
          recordedByName: data.recordedByName || "",
        });
      });
      setResults(list);
      if (list.length === 0) setMessage("No sales found for this phone");
    } catch (e: any) {
      setMessage("Error: " + (e.message || e));
    }
    setLoading(false);
  };

  const fetchRecent = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const snap = await getDocs(query(
        collection(db, "sales"),
        orderBy("createdAt", "desc"),
        limit(30),
      ));
      const list: SaleResult[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          customerName: data.customer?.name || "Walk-in",
          customerPhone: data.customer?.phone || "",
          totalAmount: data.totalAmount || 0,
          discountAmount: data.discountAmount || 0,
          finalAmount: data.finalAmount || 0,
          saleDate: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
          recordedByName: data.recordedByName || "",
        });
      });
      setResults(list);
    } catch (e: any) {
      setMessage("Error: " + (e.message || e));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  const handleAward = async (sale: SaleResult) => {
    if (!sale.customerPhone) {
      setMessage("Cannot award: no customer phone (walk-in sale)");
      return;
    }
    if (!settings.loyaltyEnabled) {
      setMessage("Loyalty is not enabled in settings");
      return;
    }
    setAwardingId(sale.id);
    setMessage(null);

    try {
      const pointsPerRupee = settings.pointsPerRupee ?? 0.01;
      const earned = Math.floor(sale.finalAmount * pointsPerRupee);
      if (earned <= 0) {
        setMessage("Points earned = 0, nothing to award");
        setAwardingId(null);
        return;
      }

      // Check GAS to see if already awarded
      const { getHistory, batchTransaction, setGasUrl } = await import("@/lib/loyalty-gas");
      if (settings.gasLoyaltyUrl) setGasUrl(settings.gasLoyaltyUrl);

      const historyRes = await getHistory(sale.customerPhone);
      const alreadyAwarded = historyRes.ok && historyRes.data?.some(
        (t) => t.refType === "sale" && t.referenceId === sale.id && t.type === "earn"
      );
      if (alreadyAwarded) {
        setMessage(`Points already awarded for sale ${sale.id}`);
        setAwardingId(null);
        return;
      }

      // Find customer in Firestore
      const custQuery = query(collection(db, "customers"), where("phone", "==", sale.customerPhone));
      const custSnap = await getDocs(custQuery);
      let finalLoyaltyPoints: number;

      if (custSnap.docs.length > 0) {
        const custDoc = custSnap.docs[0];
        const custData = custDoc.data();
        finalLoyaltyPoints = (custData.loyaltyPoints || 0) + earned;
        await updateDoc(doc(db, "customers", custDoc.id), {
          loyaltyPoints: finalLoyaltyPoints,
          lifetimePoints: (custData.lifetimePoints || 0) + earned,
          updatedAt: Timestamp.fromDate(new Date()),
        });
      } else {
        finalLoyaltyPoints = earned;
        const { generateId } = await import("@/lib/id-generator");
        const custId = await generateId("CUST");
        await setDoc(doc(db, "customers", custId), {
          name: sale.customerName,
          phone: sale.customerPhone,
          email: "",
          address: "",
          notes: "",
          loyaltyPoints: earned,
          lifetimePoints: earned,
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
        });
      }

      // Send to GAS
      const batchRes = await batchTransaction(sale.customerPhone, earned, 0, sale.id, "sale", "Manual award by " + (profile?.displayName || "admin"));
      if (batchRes.ok) {
        setMessage(`Awarded ${earned} points to ${sale.customerName} (${sale.customerPhone}) for sale ${sale.id}`);
      } else {
        setMessage(`GAS error: ${batchRes.error}. Points saved in Firestore but not synced.`);
      }
    } catch (e: any) {
      setMessage("Award failed: " + (e.message || e));
    }
    setAwardingId(null);
  };

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 max-w-4xl space-y-6">
        <div className="flex items-center gap-2">
          <Award className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-secondary">Loyalty Management</h1>
        </div>

        {/* Search */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex gap-2">
              <input type="text" value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchBySaleId()}
                placeholder="Search by Sale ID..."
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <Button onClick={fetchBySaleId} disabled={loading || !searchId.trim()} size="sm">
                <Search className="h-3.5 w-3.5" /> Find
              </Button>
            </div>
            <div className="flex-1 flex gap-2">
              <input type="text" value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchByPhone()}
                placeholder="Search by customer phone..."
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <Button onClick={fetchByPhone} disabled={loading || !searchPhone.trim()} size="sm">
                <Phone className="h-3.5 w-3.5" /> Find
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchRecent} disabled={loading} size="sm" variant="ghost">
              <Clock className="h-3.5 w-3.5" /> Recent Sales
            </Button>
            {!settings.loyaltyEnabled && (
              <span className="text-xs text-amber-600">Loyalty is disabled. Enable in Settings &gt; Loyalty</span>
            )}
          </div>
        </div>

        {/* Status message */}
        {message && (
          <div className={`text-sm px-4 py-3 rounded-lg border ${message.startsWith("Awarded") || message.startsWith("Points earned") ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
            {message}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <LoadingSpinner text="Searching..." />
        ) : results.length > 0 ? (
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Sale ID</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium text-center">Status</th>
                    <th className="px-4 py-3 font-medium text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {results.map((sale) => (
                    <SaleRow key={sale.id} sale={sale} onAward={handleAward} awardingId={awardingId} settings={settings} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
              {results.length} sale{results.length !== 1 ? "s" : ""}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl p-8 shadow-sm text-center text-sm text-muted-foreground">
            No sales found. Use the search above or click "Recent Sales".
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function SaleRow({
  sale, onAward, awardingId, settings,
}: {
  sale: SaleResult;
  onAward: (sale: SaleResult) => Promise<void>;
  awardingId: string | null;
  settings: any;
}) {
  const [awarded, setAwarded] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [earned, setEarned] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!sale.customerPhone) { setChecking(false); return; }
      const pointsPerRupee = settings.pointsPerRupee ?? 0.01;
      setEarned(Math.floor(sale.finalAmount * pointsPerRupee));
      try {
        const { getHistory, setGasUrl } = await import("@/lib/loyalty-gas");
        if (settings.gasLoyaltyUrl) setGasUrl(settings.gasLoyaltyUrl);
        const res = await getHistory(sale.customerPhone);
        if (!cancelled) {
          setAwarded(res.ok && (res.data?.some((t) => t.refType === "sale" && t.referenceId === sale.id && t.type === "earn") ?? false));
        }
      } catch { /* ignore */ }
      if (!cancelled) setChecking(false);
    };
    check();
    return () => { cancelled = true; };
  }, [sale.id, sale.customerPhone, sale.finalAmount, sale.customerPhone, settings.pointsPerRupee, settings.gasLoyaltyUrl]);

  const canAward = !!sale.customerPhone && settings.loyaltyEnabled && earned > 0;

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 font-mono text-xs">{sale.id}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div>
            <p className="font-medium text-sm">{sale.customerName}</p>
            {sale.customerPhone && <p className="text-xs text-muted-foreground">{sale.customerPhone}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-medium">Rs. {formatNumber(sale.finalAmount)}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(sale.saleDate)}</td>
      <td className="px-4 py-3 text-center">
        {!sale.customerPhone ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <XCircle className="h-3.5 w-3.5" /> Walk-in
          </span>
        ) : checking ? (
          <span className="text-xs text-muted-foreground">Checking...</span>
        ) : awarded ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="h-3.5 w-3.5" /> Awarded
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <TrendingUp className="h-3.5 w-3.5" /> {earned} pts
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <Button
          onClick={() => onAward(sale)}
          disabled={!canAward || awardingId === sale.id || awarded === true || checking}
          size="sm"
          variant={canAward && !awarded ? "accent" : "outline"}
          className="text-xs"
        >
          {awardingId === sale.id ? "Awarding..." : awarded ? "Done" : "Award"}
        </Button>
      </td>
    </tr>
  );
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-NP", { year: "numeric", month: "short", day: "numeric" });
}
