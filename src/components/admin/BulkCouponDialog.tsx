"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { setDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateId } from "@/lib/id-generator";
import CouponCardPrint from "./CouponCardPrint";

interface BulkCouponDialogProps {
  onClose: () => void;
  onComplete?: () => void;
}

export default function BulkCouponDialog({ onClose, onComplete }: BulkCouponDialogProps) {
  const { user } = useAuth();
  const [couponCode, setCouponCode] = useState("");
  const [quantity, setQuantity] = useState(10);
  const [discountType, setDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [discountValue, setDiscountValue] = useState(100);
  const [maxDiscount, setMaxDiscount] = useState(0);
  const [minPurchase, setMinPurchase] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [generating, setGenerating] = useState(false);
  const [savedCode, setSavedCode] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedCouponId, setSavedCouponId] = useState("");
  const [showCardPrint, setShowCardPrint] = useState(false);
  const [error, setError] = useState("");

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleGenerate = async () => {
    if (!quantity || quantity < 1) { setError("Enter a valid quantity."); return; }
    if (!discountValue || discountValue < 1) { setError("Enter a valid discount value."); return; }
    if (!validUntil) { setError("Select a valid until date."); return; }
    setError("");
    setGenerating(true);
    const code = couponCode.trim().toUpperCase() || generateCode();
    try {
      const validUntilDate = Timestamp.fromDate(new Date(validUntil + "T23:59:59"));
      const validFromDate = Timestamp.fromDate(new Date());
      const cupId = await generateId("CUPN");
      await setDoc(doc(db, "coupons", cupId), {
        code,
        discountType,
        discountValue: Number(discountValue),
        minPurchaseAmount: Number(minPurchase),
        maxDiscount: Number(maxDiscount),
        validFrom: validFromDate,
        validUntil: validUntilDate,
        usageLimit: quantity,
        usedCount: 0,
        isActive: true,
        couponType: "Bulk",
        issuedToCustomer: { name: "", phone: "" },
        issuedForOrderId: "",
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });
      setSavedCode(code);
      setSavedCouponId(cupId);
      setSaved(true);
      if (onComplete) onComplete();
    } catch (e) {
      console.error("Save failed", e);
      setError("Failed to save coupon. Check console.");
    }
    setGenerating(false);
  };

  const handlePrint = () => {
    setShowCardPrint(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-secondary">Coupon Generator</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="h-4 w-4" /></button>
        </div>

        {!saved ? (
          <div className="p-4 space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Coupon Code</label>
                <div className="flex gap-2">
                  <input type="text" value={couponCode} placeholder="e.g., FESTIVAL10 (leave empty to auto-generate)"
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary" />
                  <button onClick={() => setCouponCode(generateCode())}
                    className="px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted shrink-0">Auto</button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Enter your custom code or click Auto for a random 8-char code.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Print Quantity *</label>
                <input type="number" min={1} max={9999} value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <p className="text-xs text-muted-foreground mt-1">Max copies you can print.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Discount Type *</label>
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "fixed" | "percentage")}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="fixed">Fixed Amount (NPR)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Discount Value *</label>
                <input type="number" min={1} value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              {discountType === "percentage" && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Max Discount (NPR)</label>
                  <input type="number" min={0} value={maxDiscount}
                    onChange={(e) => setMaxDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              )}
              {discountType === "fixed" && <div />}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Min Purchase (NPR)</label>
                <input type="number" min={0} value={minPurchase}
                  onChange={(e) => setMinPurchase(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Valid Until *</label>
                <input type="date" value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={generating || !quantity || !discountValue || !validUntil} variant="accent" className="w-full">
              {generating ? "Creating coupon..." : "Create Coupon"}
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
              <span>✅ Coupon <span className="font-mono font-bold">{savedCode}</span> created!</span>
            </div>
            <div className="flex gap-3">
              <Button onClick={handlePrint} variant="accent" className="flex-1">Print as Visiting Card</Button>
              <Button onClick={onClose} variant="outline" className="flex-1">Close</Button>
            </div>
          </div>
        )}
        {showCardPrint && (
          <CouponCardPrint
            coupons={[{
              id: savedCouponId,
              code: savedCode,
              discountType: discountType,
              discountValue: Number(discountValue),
              maxDiscount: Number(maxDiscount),
              minPurchaseAmount: Number(minPurchase),
              validFrom: Date.now(),
              validUntil: validUntil ? new Date(validUntil + "T23:59:59").getTime() : Date.now(),
              usageLimit: quantity,
              usedCount: 0,
              isActive: true,
              couponType: "",
              restrictedToPhones: [],
              issuedToCustomer: { name: "", phone: "" },
              issuedForOrderId: "",
              createdAt: Date.now(),
              createdBy: user?.uid || "",
            }]}
            onClose={() => setShowCardPrint(false)}
          />
        )}
      </div>
    </div>
  );
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
