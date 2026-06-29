"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { setDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateId } from "@/lib/id-generator";

interface BulkCouponDialogProps {
  onClose: () => void;
  onComplete?: () => void;
}

type PrintLang = "english" | "nepali";

const LANG_LABELS: Record<PrintLang, { codeLabel: string; offer: string; off: string; upTo: string; validUntil: string; minPurchase: string; terms: string[]; exclusive: string }> = {
  english: {
    codeLabel: "Your Coupon Code",
    offer: "Use this code to get",
    off: "OFF",
    upTo: "Up to",
    validUntil: "Valid until",
    minPurchase: "Min. Purchase",
    terms: [
      "Coupon valid for both online and in-store purchases.",
      "Cannot be combined with any other offer or discount.",
      "Valid only on products specified at the time of issuance.",
      "Non-transferable and non-refundable.",
      "Management reserves the right to cancel or modify anytime.",
      "Valid only until the mentioned expiry date.",
    ],
    exclusive: "Exclusive Coupon",
  },
  nepali: {
    codeLabel: "तपाईंको कुपन कोड",
    offer: "यो कोड प्रयोग गरी पाउनुहोस्",
    off: "छुट",
    upTo: "बढीमा",
    validUntil: "मान्य अवधि",
    minPurchase: "न्यूनतम खरिद",
    terms: [
      "यो कुपन अनलाइन र स्टोर दुवैमा प्रयोग गर्न सकिन्छ।",
      "यो कुपन अन्य कुनै प्रस्ताव वा छुटसँग जोड्न सकिँदैन।",
      "यो कुपन जारी गर्दा तोकिएका उत्पादनहरूको लागि मात्र मान्य हुनेछ।",
      "यो कुपन अरू कसैलाई हस्तान्तरण गर्न वा फिर्ता गर्न सकिँदैन।",
      "व्यवस्थापनले कुपन जुनसुकै बेला रद्द वा परिमार्जन गर्ने अधिकार राख्दछ।",
      "उल्लेखित म्याद समाप्ति मिति सम्म मात्र मान्य हुनेछ।",
    ],
    exclusive: "विशेष कुपन",
  },
};

const CARDS_PER_PAGE = 10; // 2 cols x 5 rows on A4

export default function BulkCouponDialog({ onClose, onComplete }: BulkCouponDialogProps) {
  const { user } = useAuth();
  const { settings } = useShopSettings();
  const [couponCode, setCouponCode] = useState("");
  const [quantity, setQuantity] = useState(10);
  const [discountType, setDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [discountValue, setDiscountValue] = useState(100);
  const [maxDiscount, setMaxDiscount] = useState(0);
  const [minPurchase, setMinPurchase] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [printLang, setPrintLang] = useState<PrintLang>("english");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const shopName = settings.shopName || "KIKS Collections";
  const address = settings.address || "";
  const phone = settings.phone || "";
  const logoUrl = settings.logoUrl || "";

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
      // Auto-print after creation
      handleA4Print(code);
      if (onComplete) onComplete();
    } catch (e) {
      console.error("Save failed", e);
      setError("Failed to save coupon. Check console.");
    }
    setGenerating(false);
  };

  const handleA4Print = (code: string) => {
    const printWin = window.open("", "_blank");
    if (!printWin) { alert("Pop-up blocked. Allow pop-ups and try again."); return; }

    const numCards = Math.max(1, quantity);
    const langData = LANG_LABELS[printLang];
    const validUntilStr = validUntil
      ? new Date(validUntil + "T23:59:59").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "";
    const dLabel = discountType === "fixed"
      ? `Rs. ${Number(discountValue).toLocaleString("en-IN")}`
      : `${discountValue}%`;
    const maxDLbl = maxDiscount > 0
      ? `Rs. ${Number(maxDiscount).toLocaleString("en-IN")}`
      : "";
    const minPLbl = minPurchase > 0
      ? `Rs. ${Number(minPurchase).toLocaleString("en-IN")}`
      : "";

    const buildFront = () => `
      <table class="c-front-table">
        <tr>
          <td class="c-logo-cell">
            ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" class="c-logo" />` : ""}
          </td>
          <td class="c-info-cell">
            <div class="c-name">${escapeHtml(shopName)}</div>
            ${address ? `<div class="c-addr">${escapeHtml(address)}</div>` : ""}
            ${phone ? `<div class="c-phone">${escapeHtml(phone)}</div>` : ""}
          </td>
        </tr>
      </table>
      <div class="c-code-section">
        <div class="c-code-lbl">${escapeHtml(langData.codeLabel)}</div>
        <div class="c-code">${escapeHtml(code)}</div>
      </div>
      <div class="c-offer-section">
        ${discountType === "fixed"
          ? `<div class="c-offer-text">${escapeHtml(langData.offer)}: Rs. ${Number(discountValue).toLocaleString("en-IN")} ${escapeHtml(langData.off)}</div>`
          : `<div class="c-offer-text">${escapeHtml(langData.offer)}: ${discountValue}% ${escapeHtml(langData.off)}${maxDiscount > 0 ? ` (${langData.upTo} ${maxDLbl})` : ""}</div>`
        }
        ${validUntilStr ? `<div class="c-valid">${escapeHtml(langData.validUntil)}: ${escapeHtml(validUntilStr)}</div>` : ""}
        ${minPurchase > 0 ? `<div class="c-min-purchase">${escapeHtml(langData.minPurchase)}: ${minPLbl}</div>` : ""}
      </div>
    `;

    const buildBack = () => `
      <div class="c-back-header">${escapeHtml(dLabel)} ${escapeHtml(langData.off)}</div>
      <div class="c-back-title">${escapeHtml(langData.exclusive)}</div>
      <div class="c-back-divider"></div>
      <div class="c-back-terms">
        ${langData.terms.map((t) => `<div class="c-term-line">• ${escapeHtml(t)}</div>`).join("")}
      </div>
      <div class="c-back-footer">${escapeHtml(shopName)} | ${escapeHtml(phone)}</div>
    `;

    // Build pages: fronts then backs
    let frontPages = "";
    let backPages = "";
    for (let start = 0; start < numCards; start += CARDS_PER_PAGE) {
      const count = Math.min(CARDS_PER_PAGE, numCards - start);
      let frontGrid = "";
      let backGrid = "";
      for (let i = 0; i < count; i++) {
        frontGrid += `<div class="c-card c-front">${buildFront()}</div>`;
        backGrid += `<div class="c-card c-back">${buildBack()}</div>`;
      }
      frontPages += `<div class="a4-page front-page"><div class="card-grid">${frontGrid}</div></div>`;
      backPages += `<div class="a4-page back-page"><div class="card-grid">${backGrid}</div></div>`;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Coupon - ${escapeHtml(code)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page {
            size: A4;
            margin: 5mm;
          }
          body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
          .a4-page {
            width: 210mm;
            height: 297mm;
            padding: 3mm;
            page-break-after: always;
            page-break-inside: avoid;
          }
          .card-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2.5mm;
            height: 100%;
            align-content: start;
          }
          .c-card {
            width: 90mm;
            height: 54mm;
            border: 0.3mm solid #ddd;
            border-radius: 1mm;
            display: flex;
            flex-direction: column;
            padding: 1.5mm 2mm;
            overflow: hidden;
            page-break-inside: avoid;
          }
          .c-front { background: #fff; }
          .c-back { background: #fafafa; }

          /* Front layout */
          .c-front-table { width: 100%; border-collapse: collapse; }
          .c-logo-cell { width: 28mm; vertical-align: middle; text-align: left; }
          .c-logo { max-width: 26mm; max-height: 12mm; object-fit: contain; }
          .c-info-cell { vertical-align: middle; text-align: right; }
          .c-name { font-size: 9px; font-weight: 700; color: #222; line-height: 1.2; }
          .c-addr { font-size: 6px; color: #666; line-height: 1.2; }
          .c-phone { font-size: 6px; color: #666; line-height: 1.2; }

          .c-code-section {
            margin: 1mm 0 0.5mm;
            text-align: center;
          }
          .c-code-lbl { font-size: 5.5px; color: #888; font-weight: 500; }
          .c-code {
            font-size: 16px;
            font-weight: 900;
            letter-spacing: 3px;
            color: #d32f2f;
            background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%);
            padding: 0.6mm 2mm;
            border-radius: 1.5mm;
            display: inline-block;
            border: 1.2px dashed #d32f2f;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12);
          }

          .c-offer-section { margin-top: 0.3mm; text-align: center; }
          .c-offer-text { font-size: 6.5px; font-weight: 600; color: #d32f2f; }
          .c-valid { font-size: 5.5px; color: #888; margin-top: 0.2mm; }
          .c-min-purchase { font-size: 5.5px; color: #888; }

          /* Back layout */
          .c-back-header {
            font-size: 7px; font-weight: 800; color: #fff;
            background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
            text-align: center; padding: 0.8mm 2mm; border-radius: 1mm;
          }
          .c-back-title { font-size: 6px; font-weight: 600; color: #555; text-align: center; margin: 0.3mm 0; }
          .c-back-divider { height: 0.3px; background: #ddd; margin: 0.3mm 0; }
          .c-back-terms { flex: 1; padding: 0 0.5mm; display: flex; flex-direction: column; justify-content: center; }
          .c-term-line { font-size: 5px; color: #555; line-height: 1.35; padding: 0.15mm 0; }
          .c-back-footer { font-size: 5px; color: #999; text-align: center; margin-top: 0.3mm; }

          @media print {
            @page { size: A4; margin: 5mm; }
            body { background: #fff; }
            .c-card { border-color: #ccc; }
          }
        </style>
      </head>
      <body>
        ${frontPages}
        ${backPages}
        <script>
          setTimeout(function() { window.print(); }, 800);
        <\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-secondary">Coupon Generator</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {/* Language toggle */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Print Language</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPrintLang("english")}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  printLang === "english" ? "bg-primary text-white border-primary" : "bg-white text-secondary border-border hover:bg-muted"
                }`}
              >
                English
              </button>
              <button
                onClick={() => setPrintLang("nepali")}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  printLang === "nepali" ? "bg-primary text-white border-primary" : "bg-white text-secondary border-border hover:bg-muted"
                }`}
              >
                नेपाली
              </button>
            </div>
          </div>

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
              <p className="text-xs text-muted-foreground mt-1">Number of cards to print.</p>
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

          <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-xs leading-relaxed">
            <strong>Printing Tips:</strong><br />
            • Will print <strong>{Math.max(1, quantity)}</strong> visiting cards on A4 sheet{quantity > CARDS_PER_PAGE ? `s (${Math.ceil(Math.max(1, quantity) / CARDS_PER_PAGE)} sheets)` : ""}.<br />
            • Select <strong>Two-sided (Duplex)</strong> → <strong>Flip on Short Edge</strong> for proper front/back alignment.<br />
            • Front: Logo + Shop Details + Coupon Code &bull; Back: Terms &amp; Conditions.
          </div>

          <Button onClick={handleGenerate} disabled={generating || !quantity || !discountValue || !validUntil} variant="accent" className="w-full">
            {generating ? "Creating coupon..." : "Create Coupon"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
