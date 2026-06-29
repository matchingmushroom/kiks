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

const CARDS_PER_PAGE = 15; // 3 cols x 5 rows on A4

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

    const websiteUrl = settings.website || "";

    const SOCIAL_ICONS = `<svg class="smi" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg><svg class="smi" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg><svg class="smi" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`;
    const SOCIAL_USERNAME = "panchakanya.collections";

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
      <div class="c-hero">
        <div class="c-hero-val">${escapeHtml(dLabel)} ${escapeHtml(langData.off)}</div>
        ${maxDLbl ? `<div class="c-hero-sub">${escapeHtml(langData.upTo)} ${escapeHtml(maxDLbl)}</div>` : ""}
      </div>
      <div class="c-exclusive">${escapeHtml(langData.exclusive)}</div>
      <div class="c-code-section">
        <div class="c-code-lbl">${escapeHtml(langData.codeLabel)}</div>
        <div class="c-code">${escapeHtml(code)}</div>
      </div>
      ${validUntilStr ? `<div class="c-valid">${escapeHtml(langData.validUntil)}: ${escapeHtml(validUntilStr)}</div>` : ""}
      ${minPurchase > 0 ? `<div class="c-min-purchase">${escapeHtml(langData.minPurchase)}: ${minPLbl}</div>` : ""}
      <div class="c-footer"><div class="c-social">${SOCIAL_ICONS}<span class="c-social-user">${escapeHtml(SOCIAL_USERNAME)}</span></div>${websiteUrl ? `<div class="c-website">${escapeHtml(websiteUrl)}</div>` : ""}</div>
    `;

    const buildBack = () => `
      <div class="c-back-terms">
        ${langData.terms.map((t) => `<div class="c-term-line">• ${escapeHtml(t)}</div>`).join("")}
      </div>
      ${websiteUrl ? `<div class="c-website">${escapeHtml(websiteUrl)}</div>` : ""}
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
          @page { size: A4; margin: 4mm; }
          body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
          .a4-page {
            width: 210mm;
            height: 297mm;
            padding: 2.5mm;
            page-break-after: always;
            page-break-inside: avoid;
          }
          .card-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 1.8mm;
            height: 100%;
            align-content: start;
          }
          .c-card {
            width: 100%;
            height: 56mm;
            border: 0.3mm solid #e0e0e0;
            border-radius: 0.8mm;
            display: flex;
            flex-direction: column;
            padding: 1mm 1.5mm;
            overflow: hidden;
            page-break-inside: avoid;
            position: relative;
          }
          .c-front { background: linear-gradient(135deg, #fff 0%, #fef9ef 100%); }
          .c-back { background: #f8f8f8; }

          /* Front layout */
          .c-front-table { width: 100%; border-collapse: collapse; margin-bottom: 0.3mm; }
          .c-logo-cell { width: 20mm; vertical-align: middle; text-align: left; }
          .c-logo { max-width: 18mm; max-height: 8mm; object-fit: contain; }
          .c-info-cell { vertical-align: middle; text-align: right; }
          .c-name { font-size: 7px; font-weight: 700; color: #1a1a2e; line-height: 1.15; }
          .c-addr { font-size: 5px; color: #666; line-height: 1.15; }
          .c-phone { font-size: 5px; color: #666; line-height: 1.15; }

          .c-hero { text-align: center; margin: 0.5mm 0 0.2mm; padding: 0.4mm 1mm; background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%); border-radius: 0.6mm; }
          .c-hero-val { font-weight: 900; color: #fff; font-size: 9px; letter-spacing: 0.5px; }
          .c-hero-sub { font-weight: 500; color: #ffcdd2; font-size: 5px; }

          .c-exclusive { text-align: center; font-weight: 700; color: #c62828; font-size: 5.5px; letter-spacing: 1px; text-transform: uppercase; margin: 0.15mm 0; }

          .c-code-section { text-align: center; margin: 0.2mm 0; }
          .c-code-lbl { font-size: 4.5px; color: #999; font-weight: 500; }
          .c-code {
            font-weight: 900;
            letter-spacing: 2.5px;
            color: #d32f2f;
            background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);
            padding: 0.4mm 1.5mm;
            border-radius: 1mm;
            display: inline-block;
            border: 1px dashed #d32f2f;
            font-size: 11px;
          }
          .c-valid { font-size: 4.5px; color: #888; margin-top: 0.1mm; text-align: center; }
          .c-min-purchase { font-size: 4.5px; color: #888; text-align: center; }

          /* Back layout */
          .c-back-terms { flex: 1; padding: 0.5mm 0.3mm; display: flex; flex-direction: column; justify-content: center; }
          .c-term-line { font-size: 5.5px; color: #555; line-height: 1.3; padding: 0.1mm 0; }

          .c-footer { position: absolute; bottom: 0.5mm; left: 0; right: 0; }
          .c-social { display: flex; align-items: center; justify-content: center; gap: 1.2mm; }
          .c-social .smi { width: 3.5mm; height: 3.5mm; color: #888; }
          .c-social-user { font-size: 3.8px; color: #999; }
          .c-website { text-align: center; font-size: 3.5px; color: #bbb; line-height: 1; }

          @media print {
            @page { size: A4; margin: 4mm; }
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
            • Prints up to 15 cards per sheet (3×5 grid). Front: Discount + Coupon Code &bull; Back: Terms &amp; Conditions.
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
