"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { Coupon } from "@/types";
import { toDate } from "@/lib/utils";

type PrintLang = "english" | "nepali";

interface CouponCardPrintProps {
  coupons: Coupon[];
  onClose: () => void;
}

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
      "Valid only on products specified at time of issuance.",
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

const SOCIAL_ICONS = `<svg class="smi" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg><svg class="smi" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg><svg class="smi" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.13-.17-2.04.24-4.19 1.48-5.94.96-1.35 2.53-2.32 4.2-2.32 1.66 0 3.24.97 4.2 2.32 1.24 1.75 1.65 3.9 1.48 5.94-.87-.36-2.03-.45-3.02-.13.04-1.48-.02-2.96-.04-4.44v-4.23Zm-6.66 18.67c-1.52.17-3.09-.37-4.23-1.27-1.84 1.27-3.92 2.28-6.07 2.85 1.26 2.38 3.26 4.36 5.74 5.54 1.53-2.08 3.49-3.7 5.73-4.22-.42-1.02-.87-1.99-1.17-3.07v.18Z"/></svg>`;

const SOCIAL_USERNAME = "panchakanya.collections";

// ST-10A4100 constants
const COLS = 2;
const ROWS = 5;
const LABEL_W = 99.1;
const LABEL_H = 57.0;
const TOP_M = 6.0;
const BOTTOM_M = 6.0;
const COL_GAP = 2.5;
const LABELS_PER_SHEET = COLS * ROWS;

export default function CouponCardPrint({ coupons, onClose }: CouponCardPrintProps) {
  const { settings } = useShopSettings();
  const [lang, setLang] = useState<PrintLang>("english");
  const [copies, setCopies] = useState(1);

  const shopName = settings.shopName || "Panchakanya Collections";
  const address = settings.address || "";
  const phone = settings.phone || "";
  const logoUrl = settings.logoUrl || "";
  const websiteUrl = settings.website || "";

  const langData = LANG_LABELS[lang];

  const buildCard = (c: Coupon, code: string) => {
    const validUntilStr = c.validUntil
      ? new Date(toDate(c.validUntil)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "";

    const dLabel = c.discountType === "fixed"
      ? `Rs. ${Number(c.discountValue).toLocaleString("en-IN")}`
      : `${c.discountValue}%`;
    const maxPart = c.maxDiscount > 0 ? ` (${langData.upTo} Rs. ${Number(c.maxDiscount).toLocaleString("en-IN")})` : "";
    const minPLbl = c.minPurchaseAmount > 0 ? `${langData.minPurchase}: Rs. ${Number(c.minPurchaseAmount).toLocaleString("en-IN")}` : "";

    // Pick first 3 terms and truncate to fit
    const shortTerms = langData.terms.slice(0, 3);

    return `
      <div class="coupon">
        <table class="cp-header"><tr>
          <td class="cp-logo-cell">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" class="cp-logo" />` : ""}</td>
          <td class="cp-info-cell">
            <div class="cp-name">${escapeHtml(shopName)}</div>
            ${address ? `<div class="cp-addr">${escapeHtml(address)}</div>` : ""}
            ${phone ? `<div class="cp-phone">${escapeHtml(phone)}</div>` : ""}
          </td>
        </tr></table>
        <div class="cp-exclusive">${escapeHtml(langData.exclusive)}</div>
        <div class="cp-offer-label">${escapeHtml(langData.offer)}</div>
        <div class="cp-hero">${escapeHtml(dLabel)} ${escapeHtml(langData.off)}</div>
        ${maxPart ? `<div class="cp-hero-sub">${escapeHtml(maxPart)}</div>` : ""}
        <div class="cp-code-wrap">
          <div class="cp-code-lbl">${escapeHtml(langData.codeLabel)}</div>
          <div class="cp-code">${escapeHtml(code)}</div>
        </div>
        <div class="cp-meta">
          ${validUntilStr ? `<span class="cp-valid">${escapeHtml(langData.validUntil)}: ${escapeHtml(validUntilStr)}</span>` : ""}
          ${minPLbl ? `<span class="cp-min-p">${escapeHtml(minPLbl)}</span>` : ""}
        </div>
        <div class="cp-terms">${shortTerms.map((t) => `<div class="cp-term">${escapeHtml(t)}</div>`).join("")}</div>
        <div class="cp-footer">
          <div class="cp-social">${SOCIAL_ICONS}<span class="cp-social-user">${escapeHtml(SOCIAL_USERNAME)}</span></div>
          ${websiteUrl ? `<div class="cp-website">${escapeHtml(websiteUrl)}</div>` : ""}
        </div>
      </div>
    `;
  };

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) { alert("Pop-up blocked. Allow pop-ups and try again."); return; }

    const allCards: { coupon: Coupon; code: string }[] = [];
    for (const c of coupons) {
      for (let i = 0; i < copies; i++) {
        allCards.push({ coupon: c, code: c.code });
      }
    }
    const total = allCards.length;

    let pages = "";
    for (let start = 0; start < total; start += LABELS_PER_SHEET) {
      const count = Math.min(LABELS_PER_SHEET, total - start);
      let grid = "";
      for (let i = 0; i < count; i++) {
        const { coupon, code } = allCards[start + i];
        grid += buildCard(coupon, code);
      }
      // Fill remaining slots with empty cells to preserve grid alignment
      for (let i = count; i < LABELS_PER_SHEET; i++) {
        grid += `<div class="coupon empty"></div>`;
      }
      pages += `<div class="a4-page"><div class="label-grid">${grid}</div></div>`;
    }

    if (pages === "") {
      pages = `<div class="a4-page"><div class="label-grid">${Array.from({ length: LABELS_PER_SHEET }, () => `<div class="coupon empty"></div>`).join("")}</div></div>`;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Coupon Cards</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4 portrait; margin: 0; }
          body { width: 210mm; margin: 0; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; }
          .a4-page { width: 210mm; height: 297mm; page-break-after: always; overflow: hidden; }
          .label-grid {
            display: grid;
            gap: 0 ${COL_GAP}mm;
            grid-template-columns: repeat(${COLS}, ${LABEL_W}mm);
            grid-template-rows: repeat(${ROWS}, ${LABEL_H}mm);
            width: 210mm;
            justify-content: center;
            align-content: start;
            padding: ${TOP_M}mm 0 ${BOTTOM_M}mm 0;
          }
          .coupon {
            width: ${LABEL_W}mm;
            height: ${LABEL_H}mm;
            box-sizing: border-box;
            padding: 1mm 1.5mm 0.8mm 3mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: #fff;
            overflow: hidden;
            position: relative;
            border-radius: 0.5mm;
          }
          .coupon::before {
            content: '';
            position: absolute;
            left: 0; top: 0; bottom: 0;
            width: 1.8mm;
            background: linear-gradient(180deg, #7a1a1a 0%, #c62828 40%, #e53935 100%);
          }
          .coupon.empty { visibility: hidden; }
          .coupon.empty::before { display: none; }

          .cp-header { width: 100%; border-collapse: collapse; flex-shrink: 0; }
          .cp-logo-cell { width: 16mm; vertical-align: middle; }
          .cp-logo { max-width: 15mm; max-height: 9mm; object-fit: contain; display: block; }
          .cp-info-cell { vertical-align: middle; }
          .cp-name { font-size: 16px; font-weight: 800; color: #1a1a2e; line-height: 1.15; }
          .cp-addr, .cp-phone { font-size: 10px; color: #888; line-height: 1.2; }

          .cp-exclusive {
            text-align: center; font-size: 12px; font-weight: 800; color: #fff;
            letter-spacing: 1px; text-transform: uppercase; line-height: 1.3;
            background: linear-gradient(135deg, #c62828, #e53935);
            padding: 0.3mm 0; margin: 0 -1.5mm; width: calc(100% + 3mm);
            flex-shrink: 0;
          }
          .cp-offer-label { text-align: center; font-size: 9px; color: #999; line-height: 1.2; flex-shrink: 0; }
          .cp-hero {
            text-align: center; font-size: 30px; font-weight: 900; color: #c62828;
            line-height: 1.1; letter-spacing: 0.5px; flex-shrink: 0;
          }
          .cp-hero-sub { text-align: center; font-size: 9px; color: #b71c1c; line-height: 1.2; flex-shrink: 0; }

          .cp-code-wrap { text-align: center; flex-shrink: 0; }
          .cp-code-lbl { font-size: 9px; color: #aaa; }
          .cp-code {
            font-size: 22px; font-weight: 900; letter-spacing: 2px;
            color: #1a1a2e; background: #fff;
            padding: 0.3mm 2mm; display: inline-block;
            border: 0.5px dashed #bbb; border-radius: 0.5mm; line-height: 1.3;
            font-family: 'Courier New', monospace;
          }

          .cp-meta { display: flex; justify-content: center; gap: 2mm; font-size: 9px; color: #999; line-height: 1.3; flex-shrink: 0; }

          .cp-terms { flex-shrink: 0; border-top: 0.3px dashed #e0e0e0; padding-top: 0.3mm; }
          .cp-term { font-size: 8px; color: #aaa; line-height: 1.25; }

          .cp-footer { text-align: center; flex-shrink: 0; }
          .cp-social { display: flex; align-items: center; justify-content: center; gap: 0.8mm; }
          .smi { width: 4mm; height: 4mm; color: #bbb; flex-shrink: 0; }
          .cp-social-user { font-size: 8px; color: #bbb; }
          .cp-website { font-size: 7px; color: #ccc; line-height: 1.2; text-align: center; }

          @media print {
            @page { size: A4 portrait; margin: 0; }
            body { background: #fff; }
          }
        </style>
      </head>
      <body>
        ${pages}
        <script>setTimeout(function(){window.print()},800)<\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  const totalCards = coupons.length * copies;
  const totalSheets = Math.ceil(totalCards / LABELS_PER_SHEET);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-secondary">Print Coupon Cards</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Selected Coupons</label>
            <div className="flex flex-wrap gap-2">
              {coupons.map((c) => (
                <span key={c.id} className="text-xs bg-primary/10 text-primary font-mono font-semibold px-2 py-1 rounded-full">{c.code}</span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Print Language</label>
            <div className="flex gap-2">
              <button onClick={() => setLang("english")}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${lang === "english" ? "bg-primary text-white border-primary" : "bg-white text-secondary border-border hover:bg-muted"}`}>English</button>
              <button onClick={() => setLang("nepali")}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${lang === "nepali" ? "bg-primary text-white border-primary" : "bg-white text-secondary border-border hover:bg-muted"}`}>नेपाली</button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Copies per Coupon</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setCopies(Math.max(1, copies - 1))}
                className="w-9 h-9 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted text-lg font-medium">−</button>
              <input type="number" min={1} max={999} value={copies}
                onChange={(e) => setCopies(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
                className="w-20 text-center text-sm border border-border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
              <button onClick={() => setCopies(Math.min(999, copies + 1))}
                className="w-9 h-9 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted text-lg font-medium">+</button>
            </div>
          </div>

          <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-xs leading-relaxed">
            <strong>Printing Notes:</strong><br />
            • Prints on <strong>Oddy ST-10A4100</strong> sheets (10 labels/sheet, 2×5 grid).<br />
            • All content — logo, code, discount, terms &amp; conditions — fits on <strong>one label</strong>.<br />
            • Total: <strong>{totalCards}</strong> card{totalCards !== 1 ? "s" : ""} on <strong>{totalSheets}</strong> sheet{totalSheets !== 1 ? "s" : ""}.<br />
            • Set printer: A4, Portrait, Margins: None, Scale: 100%.
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handlePrint} variant="accent" className="flex-1">Print {totalCards} Card{totalCards !== 1 ? "s" : ""}</Button>
            <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
