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


// ST-18A4100 constants
const COLS = 3;
const ROWS = 6;
const LABEL_W = 63.5;
const LABEL_H = 46.6;
const TOP_M = 8.7;
const BOTTOM_M = 8.7;
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

    const shortTerms = langData.terms.slice(0, 2);

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
        ${websiteUrl ? `<div class="cp-website">${escapeHtml(websiteUrl)}</div>` : ""}
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
            padding: 0.8mm 1.2mm 0.6mm 2.2mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: #fff;
            overflow: hidden;
            position: relative;
            border-radius: 0.3mm;
          }
          .coupon::before {
            content: '';
            position: absolute;
            left: 0; top: 0; bottom: 0;
            width: 1.2mm;
            background: linear-gradient(180deg, #7a1a1a 0%, #c62828 40%, #e53935 100%);
          }
          .coupon.empty { visibility: hidden; }
          .coupon.empty::before { display: none; }

          .cp-header { width: 100%; border-collapse: collapse; flex-shrink: 0; }
          .cp-logo-cell { width: 12mm; vertical-align: middle; }
          .cp-logo { max-width: 11mm; max-height: 6mm; object-fit: contain; display: block; }
          .cp-info-cell { vertical-align: middle; }
          .cp-name { font-size: 12px; font-weight: 800; color: #1a1a2e; line-height: 1.15; }
          .cp-addr, .cp-phone { font-size: 7px; color: #888; line-height: 1.2; white-space: pre-line; }

          .cp-exclusive {
            text-align: center; font-size: 9px; font-weight: 800; color: #fff;
            letter-spacing: 1px; text-transform: uppercase; line-height: 1.3;
            background: linear-gradient(135deg, #c62828, #e53935);
            padding: 0.2mm 0; margin: 0 -1.2mm; width: calc(100% + 2.4mm);
            flex-shrink: 0;
          }
          .cp-offer-label { text-align: center; font-size: 7px; color: #999; line-height: 1.2; flex-shrink: 0; }
          .cp-hero {
            text-align: center; font-size: 22px; font-weight: 900; color: #c62828;
            line-height: 1.1; letter-spacing: 0.5px; flex-shrink: 0;
          }
          .cp-hero-sub { text-align: center; font-size: 7px; color: #b71c1c; line-height: 1.2; flex-shrink: 0; }

          .cp-code-wrap { text-align: center; flex-shrink: 0; }
          .cp-code-lbl { font-size: 7px; color: #aaa; }
          .cp-code {
            font-size: 16px; font-weight: 900; letter-spacing: 2px;
            color: #1a1a2e; background: #fff;
            padding: 0.2mm 1.5mm; display: inline-block;
            border: 0.5px dashed #bbb; border-radius: 0.5mm; line-height: 1.3;
            font-family: 'Courier New', monospace;
          }

          .cp-meta { display: flex; justify-content: center; gap: 1.5mm; font-size: 7px; color: #999; line-height: 1.3; flex-shrink: 0; }

          .cp-terms { flex-shrink: 0; border-top: 0.3px dashed #e0e0e0; padding-top: 0.2mm; }
          .cp-term { font-size: 6px; color: #aaa; line-height: 1.2; }

          .cp-website { text-align: center; font-size: 6px; color: #ccc; line-height: 1.2; flex-shrink: 0; }

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
            • Prints on <strong>Oddy ST-18A4100</strong> sheets (18 labels/sheet, 3×6 grid).<br />
            • All content — logo, code, discount, terms — fits on <strong>one label</strong>.<br />
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
