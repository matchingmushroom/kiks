"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { setDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateId } from "@/lib/id-generator";

interface BulkCouponDialogProps {
  onClose: () => void;
  onComplete?: () => void;
}

export default function BulkCouponDialog({ onClose, onComplete }: BulkCouponDialogProps) {
  const { settings } = useShopSettings();
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(10);
  const [discountType, setDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [discountValue, setDiscountValue] = useState(100);
  const [maxDiscount, setMaxDiscount] = useState(0);
  const [minPurchase, setMinPurchase] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [customPrefix, setCustomPrefix] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const buildCodes = (): string[] => {
    if (customPrefix.trim()) {
      const prefix = customPrefix.trim().toUpperCase().replace(/\s+/g, "_");
      const padLen = String(quantity).length < 2 ? 2 : String(quantity).length;
      return Array.from({ length: quantity }, (_, i) => `${prefix}-${String(i + 1).padStart(padLen, "0")}`);
    }
    const uniqueCodes = new Set<string>();
    while (uniqueCodes.size < quantity) {
      uniqueCodes.add(generateCode());
    }
    return [...uniqueCodes];
  };

  const handleGenerate = async () => {
    if (!quantity || quantity < 1) { setError("Enter a valid quantity."); return; }
    if (!discountValue || discountValue < 1) { setError("Enter a valid discount value."); return; }
    if (!validUntil) { setError("Select a valid until date."); return; }
    setError("");
    setGenerating(true);
    const codes = buildCodes();
    try {
      const validUntilDate = Timestamp.fromDate(new Date(validUntil + "T23:59:59"));
      const validFromDate = Timestamp.fromDate(new Date());
      for (const code of codes) {
        const cupId = await generateId("CUPN");
        await setDoc(doc(db, "coupons", cupId), {
          code,
          discountType,
          discountValue: Number(discountValue),
          minPurchaseAmount: Number(minPurchase),
          maxDiscount: Number(maxDiscount),
          validFrom: validFromDate,
          validUntil: validUntilDate,
          usageLimit: 1,
          usedCount: 0,
          isActive: true,
          couponType: "Bulk",
          issuedToCustomer: { name: "", phone: "" },
          issuedForOrderId: "",
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
        });
      }
      setGeneratedCodes(codes);
      setSaved(true);
      if (onComplete) onComplete();
    } catch (e) {
      console.error("Bulk save failed", e);
      setError("Failed to save coupons. Check console.");
    }
    setGenerating(false);
  };

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) { alert("Pop-up blocked. Allow pop-ups and try again."); return; }

    const shopName = settings.shopName || "KIKS Collections";
    const address = settings.address || "";
    const phone = settings.phone || "";
    const logoUrl = settings.logoUrl || "";
    const validUntilStr = validUntil
      ? new Date(validUntil + "T23:59:59").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "";
    const discountLabel = discountType === "fixed"
      ? `Rs. ${Number(discountValue).toLocaleString("en-IN")}`
      : `${discountValue}%`;
    const maxDiscountLabel = maxDiscount > 0
      ? `Rs. ${Number(maxDiscount).toLocaleString("en-IN")}`
      : "";
    const minPurchaseLabel = minPurchase > 0
      ? `Rs. ${Number(minPurchase).toLocaleString("en-IN")}`
      : "";

    const cards = generatedCodes.map((code) => `
      <div class="coupon-card">
        <div class="coupon-inner">
          <div class="coupon-side">
            <div class="coupon-header">
              ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" class="coupon-logo" />` : ""}
              <div class="coupon-shop-name">${escapeHtml(shopName)}</div>
              <div class="coupon-shop-info">${escapeHtml(address)} | ${escapeHtml(phone)}</div>
            </div>
            <div class="coupon-divider">===========================================</div>
            <div class="coupon-thanks">Thank You for Shopping with us!</div>
            <div class="coupon-code-label">Here is your Coupon Code:</div>
            <div class="coupon-code">👉 ${escapeHtml(code)}</div>
            <div class="coupon-offer">Use this to get:</div>
            ${discountType === "fixed"
              ? `<div class="coupon-discount">🎁 ${discountLabel} OFF</div>`
              : `<div class="coupon-discount">🎁 ${discountLabel} OFF${maxDiscount > 0 ? ` (Up to ${maxDiscountLabel})` : ""}</div>`
            }
            <div class="coupon-divider">-------------------------------------------</div>
            <div class="coupon-terms-title">Terms &amp; Conditions:</div>
            <div class="coupon-terms">
              1. Valid until: ${validUntilStr}<br/>
              ${minPurchase > 0 ? `2. Minimum Purchase required: ${minPurchaseLabel}<br/>` : ""}
              3. Coupon valid for online orders via website or In-Store purchases.
            </div>
            <div class="coupon-divider">===========================================</div>
          </div>

          <div class="coupon-side">
            <div class="coupon-header">
              ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" class="coupon-logo" />` : ""}
              <div class="coupon-shop-name">${escapeHtml(shopName)}</div>
              <div class="coupon-shop-info">${escapeHtml(address)} | ${escapeHtml(phone)}</div>
            </div>
            <div class="coupon-divider">===========================================</div>
            <div class="coupon-thanks">हामीसँग किनमेल गर्नुभएकोमा धन्यवाद!</div>
            <div class="coupon-code-label">तपाईंको कुपन कोड यहाँ छ:</div>
            <div class="coupon-code">👉 ${escapeHtml(code)}</div>
            <div class="coupon-offer">यो कुपन प्रयोग गरी पाउनुहोस्:</div>
            ${discountType === "fixed"
              ? `<div class="coupon-discount">🎁 ${discountLabel} छुट</div>`
              : `<div class="coupon-discount">🎁 ${discountLabel} छुट${maxDiscount > 0 ? ` (बढीमा ${maxDiscountLabel} सम्म)` : ""}</div>`
            }
            <div class="coupon-divider">-------------------------------------------</div>
            <div class="coupon-terms-title">शर्त तथा नियमहरू:</div>
            <div class="coupon-terms">
              १. मान्य अवधि: ${validUntilStr} सम्म<br/>
              ${minPurchase > 0 ? `२. न्यूनतम खरिद रकम: ${minPurchaseLabel}<br/>` : ""}
              ३. यो कुपन वेबसाइट मार्फत अनलाइन अर्डर गर्दा वा स्टोरमै आएर खरिद गर्दा लागू हुनेछ।
            </div>
            <div class="coupon-divider">===========================================</div>
          </div>
        </div>
      </div>
    `).join("");

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bulk Coupons</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            background: #fff;
            padding: 5mm;
          }
          .coupon-card {
            width: 100%;
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 5mm;
          }
          .coupon-inner {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3mm;
            border: 2px solid #333;
            border-radius: 6px;
            padding: 4mm;
          }
          .coupon-side {
            padding: 2mm;
          }
          .coupon-side:first-child {
            border-right: 2px dashed #ccc;
          }
          .coupon-header { text-align: center; margin-bottom: 2mm; }
          .coupon-logo { max-width: 50mm; max-height: 18mm; object-fit: contain; margin-bottom: 2mm; }
          .coupon-shop-name { font-size: 16px; font-weight: 700; }
          .coupon-shop-info { font-size: 10px; color: #666; }
          .coupon-divider { font-family: monospace; font-size: 8px; color: #aaa; text-align: center; margin: 1.5mm 0; letter-spacing: 0.5px; }
          .coupon-thanks { font-size: 12px; font-weight: 600; text-align: center; margin-bottom: 2mm; }
          .coupon-code-label { font-size: 10px; color: #555; text-align: center; }
          .coupon-code { font-size: 20px; font-weight: 700; text-align: center; margin: 2mm 0; letter-spacing: 3px; color: #d32f2f; }
          .coupon-offer { font-size: 10px; color: #555; text-align: center; }
          .coupon-discount { font-size: 14px; font-weight: 700; color: #d32f2f; text-align: center; margin: 1mm 0; }
          .coupon-terms-title { font-size: 9px; font-weight: 600; margin-top: 2mm; margin-bottom: 1mm; }
          .coupon-terms { font-size: 8px; color: #555; line-height: 1.5; }
          @media print {
            @page { margin: 4mm; }
          }
        </style>
      </head>
      <body>${cards}</body>
      </html>
    `);
    printWin.document.close();
    setTimeout(() => printWin.print(), 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-secondary">Bulk Coupon Generator</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="h-4 w-4" /></button>
        </div>

        {!saved ? (
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">Generate multiple coupon codes at once and print them in English + Nepali.</p>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Quantity of Coupons *</label>
                <input type="number" min={1} max={500} value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
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
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Max Discount Amount (NPR)</label>
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
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Custom Code Prefix (optional)</label>
              <input type="text" value={customPrefix} placeholder="e.g., FESTIVAL → FESTIVAL-01, FESTIVAL-02..."
                onChange={(e) => setCustomPrefix(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <p className="text-xs text-muted-foreground mt-1">Leave empty for fully random 8-char codes.</p>
            </div>
            <Button onClick={handleGenerate} disabled={generating || !quantity || !discountValue || !validUntil} variant="accent" className="w-full">
              {generating ? `Generating ${quantity} codes...` : `Generate ${quantity} Coupon${quantity !== 1 ? "s" : ""} & Save`}
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
              <span>✅ {generatedCodes.length} coupon{generatedCodes.length !== 1 ? "s" : ""} generated and saved successfully!</span>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 max-h-32 overflow-y-auto flex flex-wrap gap-1">
              {generatedCodes.map((code) => (
                <span key={code} className="inline-block font-mono text-xs bg-white border border-border px-2 py-1 rounded">{code}</span>
              ))}
            </div>
            <div className="flex gap-3">
              <Button onClick={handlePrint} variant="accent" className="flex-1">Print Coupons</Button>
              <Button onClick={onClose} variant="outline" className="flex-1">Close</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
