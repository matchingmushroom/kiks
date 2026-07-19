"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { db } from "@/lib/firebase";
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Search, Award, CheckCircle, XCircle, TrendingUp, Clock, User, Phone, Pencil } from "lucide-react";
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
  const [manualTarget, setManualTarget] = useState<SaleResult | null>(null);
  const [manualPoints, setManualPoints] = useState(0);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [loyaltyInfo, setLoyaltyInfo] = useState<{ name: string; phone: string; points: number; lifetimePoints: number } | null>(null);

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
    } catch {
      setMessage("Could not load sales data.");
    }
    setLoading(false);
  };

  const fetchByPhone = async () => {
    if (!searchPhone.trim()) return;
    setLoading(true);
    setMessage(null);
    setLoyaltyInfo(null);
    const phone = searchPhone.trim();
    let foundLoyalty = false;
    try {
      // Look up customer loyalty points from Firestore
      const custQuery = query(collection(db, "customers"), where("phone", "==", phone));
      const custSnap = await getDocs(custQuery);
      if (custSnap.docs.length > 0) {
        const c = custSnap.docs[0].data();
        setLoyaltyInfo({ name: c.name || "", phone: c.phone || phone, points: c.loyaltyPoints || 0, lifetimePoints: c.lifetimePoints || 0 });
        foundLoyalty = true;
      } else {
        // Try GAS lookup
        try {
          const { lookupCustomer, setGasUrl } = await import("@/lib/loyalty-gas");
          if (settings.gasLoyaltyUrl) setGasUrl(settings.gasLoyaltyUrl);
          const gasRes = await lookupCustomer(phone);
          if (gasRes.ok && gasRes.data) {
            setLoyaltyInfo({ name: gasRes.data.name || "", phone: gasRes.data.phone, points: gasRes.data.currentPoints || 0, lifetimePoints: gasRes.data.lifetimePoints || 0 });
            foundLoyalty = true;
          }
        } catch { /* GAS lookup optional */ }
      }

      // Fetch sales for this phone (no orderBy to avoid composite index requirement)
      const snap = await getDocs(query(
        collection(db, "sales"),
        where("customer.phone", "==", phone),
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
      list.sort((a, b) => b.saleDate - a.saleDate);
      setResults(list.slice(0, 20));
      if (list.length === 0 && !foundLoyalty) setMessage("No sales or customer found for this phone");
    } catch {
      setMessage("Could not load sales data.");
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
    } catch {
      setMessage("Could not load sales data.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  const handleAward = async (sale: SaleResult) => {
    if (!sale.customerPhone) {
      setMessage("Enter a customer phone before awarding");
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

      // Check GAS to see if already awarded (only if phone matches sale's original phone)
      const { getHistory, batchTransaction, setGasUrl } = await import("@/lib/loyalty-gas");
      if (settings.gasLoyaltyUrl) setGasUrl(settings.gasLoyaltyUrl);

      if (sale.customerPhone) {
        const historyRes = await getHistory(sale.customerPhone);
        const alreadyAwarded = historyRes.ok && historyRes.data?.some(
          (t) => t.refType === "sale" && t.referenceId === sale.id && t.type === "earn"
        );
        if (alreadyAwarded) {
          setMessage(`Points already awarded for sale ${sale.id}`);
          setAwardingId(null);
          return;
        }
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

      // Ensure customer is registered in GAS
      const { registerCustomer, lookupCustomer } = await import("@/lib/loyalty-gas");
      const lookupRes = await lookupCustomer(sale.customerPhone);
      if (!lookupRes.ok) {
        const regRes = await registerCustomer(sale.customerPhone, sale.customerName);
        if (!regRes.ok) {
          setMessage(`GAS error: ${regRes.error}. Points saved in Firestore but not synced.`);
          setAwardingId(null);
          return;
        }
      }

      // Send to GAS
      const batchRes = await batchTransaction(sale.customerPhone, earned, 0, sale.id, "sale", "Manual award by " + (profile?.displayName || "admin"));
      if (batchRes.ok) {
        setMessage(`Awarded ${earned} points to ${sale.customerName} (${sale.customerPhone}) for sale ${sale.id}`);
      } else {
        setMessage(`GAS error: ${batchRes.error}. Points saved in Firestore but not synced.`);
      }
    } catch {
      setMessage("Award failed. Try again.");
    }
    setAwardingId(null);
  };

  const handleManualAward = async () => {
    const phone = manualPhone || "";
    const name = manualName || "";
    if (!manualTarget || !phone) { setMessage("Enter a phone number"); return; }
    const pointsPerRupee = settings.pointsPerRupee ?? 0.01;
    const earned = Math.floor(manualTarget.finalAmount * pointsPerRupee);
    if (earned <= 0) { setMessage("Points earned = 0"); return; }
    setAwardingId(manualTarget.id + "_manual");
    setMessage(null);
    try {
      const { batchTransaction, setGasUrl } = await import("@/lib/loyalty-gas");
      if (settings.gasLoyaltyUrl) setGasUrl(settings.gasLoyaltyUrl);

      const custQuery = query(collection(db, "customers"), where("phone", "==", phone));
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
          name,
          phone,
          email: "", address: "", notes: "",
          loyaltyPoints: earned,
          lifetimePoints: earned,
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
        });
      }

      await updateDoc(doc(db, "sales", manualTarget.id), {
        customer: { name, phone },
      });

      // Ensure customer is registered in GAS
      const { registerCustomer, lookupCustomer } = await import("@/lib/loyalty-gas");
      const lookupRes = await lookupCustomer(phone);
      if (!lookupRes.ok) {
        const regRes = await registerCustomer(phone, name);
        if (!regRes.ok) {
          setMessage(`GAS error: ${regRes.error}. Points saved in Firestore but not synced.`);
          setAwardingId(null); setManualTarget(null); setManualPoints(0); setManualName(""); setManualPhone("");
          return;
        }
      }

      const refId = manualTarget.id;
      const batchRes = await batchTransaction(phone, earned, 0, refId, "sale", "Walk-in award by " + (profile?.displayName || "admin"));
      if (batchRes.ok) {
        setMessage(`Awarded ${earned} points to ${name} (${phone}) for sale ${manualTarget.id}`);
      } else {
        setMessage(`GAS error: ${batchRes.error}. Points saved in Firestore but not synced.`);
      }
      setResults((prev) => prev.map((r) => r.id === manualTarget.id ? { ...r, customerName: name, customerPhone: phone } : r));
    } catch {
      setMessage("Manual award failed. Try again.");
    }
    setAwardingId(null);
    setManualTarget(null);
    setManualPoints(0);
    setManualName("");
    setManualPhone("");
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

        {/* Loyalty info card */}
        {loyaltyInfo && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-semibold text-secondary">{loyaltyInfo.name || "Unknown"}</p>
                <p className="text-xs text-muted-foreground">{loyaltyInfo.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Loyalty Points</p>
                <p className="text-2xl font-bold text-purple-700">{loyaltyInfo.points}</p>
                <p className="text-xs text-muted-foreground">Lifetime: {loyaltyInfo.lifetimePoints}</p>
              </div>
            </div>
          </div>
        )}

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
                    <SaleRow key={sale.id} sale={sale} onAward={handleAward} onManualAward={() => { setManualTarget(sale); setManualPoints(0); }} awardingId={awardingId} settings={settings} />
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

      {/* Manual award dialog */}
      {manualTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => { setManualTarget(null); setManualPoints(0); setManualName(""); setManualPhone(""); }}
          role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-auto"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-secondary mb-1">Award Walk-in Customer</h2>
            <p className="text-xs text-muted-foreground mb-3">Sale: {manualTarget.id}</p>
            <div className="space-y-4">
              <div>
                <label htmlFor="manual-name" className="block text-sm font-medium text-secondary mb-1">Customer name</label>
                <input id="manual-name" type="text" value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Enter name"
                  className="w-full px-4 py-3 border-2 border-border rounded-lg text-base focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div>
                <label htmlFor="manual-phone" className="block text-sm font-medium text-secondary mb-1">Phone number</label>
                <input id="manual-phone" type="tel" value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="Enter phone number"
                  className="w-full px-4 py-3 border-2 border-border rounded-lg text-base focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Points earned (auto-calculated)</p>
                <p className="text-lg font-bold text-secondary">{Math.floor(manualTarget.finalAmount * (settings.pointsPerRupee ?? 0.01))} pts</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => { setManualTarget(null); setManualPoints(0); setManualName(""); setManualPhone(""); }}
                  variant="outline" size="lg" className="flex-1">Cancel</Button>
                <Button onClick={handleManualAward}
                  disabled={!manualPhone || awardingId === (manualTarget.id + "_manual")}
                  variant="accent" size="lg" className="flex-1">
                  {awardingId === (manualTarget.id + "_manual") ? "Awarding..." : "Award"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function SaleRow({
  sale, onAward, onManualAward, awardingId, settings,
}: {
  sale: SaleResult;
  onAward: (sale: SaleResult) => Promise<void>;
  onManualAward: () => void;
  awardingId: string | null;
  settings: any;
}) {
  const [awarded, setAwarded] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [earned, setEarned] = useState(0);

  useEffect(() => {
    if (!sale.customerPhone) { setChecking(false); return; }
    let cancelled = false;
    const check = async () => {
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
  }, [sale.id, sale.customerPhone, sale.finalAmount, settings.pointsPerRupee, settings.gasLoyaltyUrl]);

  const hasPhone = !!sale.customerPhone;
  const effectiveEarned = earned > 0 ? earned : Math.floor(sale.finalAmount * (settings.pointsPerRupee ?? 0.01));
  const canAward = hasPhone && settings.loyaltyEnabled && effectiveEarned > 0 && awarded !== true;

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 font-mono text-xs">{sale.id}</td>
      <td className="px-4 py-3 min-w-[200px]">
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
        {!hasPhone ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <XCircle className="h-3.5 w-3.5" /> No phone
          </span>
        ) : checking && !!sale.customerPhone ? (
          <span className="text-xs text-muted-foreground">Checking...</span>
        ) : awarded ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="h-3.5 w-3.5" /> Awarded
          </span>
        ) : hasPhone ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <TrendingUp className="h-3.5 w-3.5" /> {effectiveEarned} pts
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex flex-col items-center gap-1">
          {sale.customerPhone && (
            <Button onClick={() => {
              const overrideSale = { ...sale };
              onAward(overrideSale);
            }} disabled={!canAward || awardingId === sale.id || !!awarded || checking} size="sm"
              variant={canAward && !awarded ? "accent" : "outline"} className="text-xs">
              {awardingId === sale.id ? "Awarding..." : awarded ? "Done" : "Award"}
            </Button>
          )}
          {!sale.customerPhone && (
            <button onClick={onManualAward}
              title="Award walk-in customer"
              className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded transition-colors">
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-NP", { year: "numeric", month: "short", day: "numeric" });
}
