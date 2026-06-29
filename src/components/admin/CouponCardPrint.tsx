"use client";

import { useState } from "react";
import { X, MoveUp, MoveDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { Coupon } from "@/types";
import { formatCurrency, toDate } from "@/lib/utils";

type PrintLang = "english" | "nepali";
type FrontElement = "logo" | "shopName" | "address" | "phone" | "couponCode" | "discount" | "validUntil";

interface CouponCardPrintProps {
  coupons: Coupon[];
  onClose: () => void;
}

const DEFAULT_ORDER: FrontElement[] = ["logo", "shopName", "address", "phone", "couponCode", "discount", "validUntil"];

const LANG_LABELS: Record<PrintLang, { thanks: string; codeLabel: string; offer: string; off: string; upTo: string; validUntil: string; minPurchase: string; terms: string[]; exclusive: string }> = {
  english: {
    thanks: "Thank You for Shopping with us!",
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
    thanks: "हामीसँग किनमेल गर्नुभएकोमा धन्यवाद!",
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

const FRONT_LABELS: Record<FrontElement, string> = {
  logo: "Logo",
  shopName: "Shop Name",
  address: "Address",
  phone: "Contact",
  couponCode: "Coupon Code",
  discount: "Discount",
  validUntil: "Valid Until",
};

const SOCIAL_ICONS = `<svg class="smi" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg><svg class="smi" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg><svg class="smi" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`;

const SOCIAL_USERNAME = "panchakanya.collections";

const CARDS_PER_PAGE = 15;

export default function CouponCardPrint({ coupons, onClose }: CouponCardPrintProps) {
  const { settings } = useShopSettings();
  const [lang, setLang] = useState<PrintLang>("english");
  const [copies, setCopies] = useState(1);
  const [elementOrder, setElementOrder] = useState<FrontElement[]>(DEFAULT_ORDER);
  const [hiddenElements, setHiddenElements] = useState<Set<FrontElement>>(new Set());
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");

  const shopName = settings.shopName || "KIKS Collections";
  const address = settings.address || "";
  const phone = settings.phone || "";
  const logoUrl = settings.logoUrl || "";

  const fontSizeMap = { small: 1, medium: 1.25, large: 1.5 };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...elementOrder];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setElementOrder(next);
  };

  const moveDown = (idx: number) => {
    if (idx === elementOrder.length - 1) return;
    const next = [...elementOrder];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setElementOrder(next);
  };

  const toggleVisibility = (el: FrontElement) => {
    const next = new Set(hiddenElements);
    if (next.has(el)) next.delete(el);
    else next.add(el);
    setHiddenElements(next);
  };

  const langData = LANG_LABELS[lang];

  const buildFront = (c: Coupon, code: string) => {
    const validUntilStr = c.validUntil
      ? new Date(toDate(c.validUntil)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "";

    const visible = elementOrder.filter((el) => !hiddenElements.has(el));
    const scale = fontSizeMap[fontSize];

    const dLabel = c.discountType === "fixed"
      ? `Rs. ${Number(c.discountValue).toLocaleString("en-IN")}`
      : `${c.discountValue}%`;
    const maxPart = c.maxDiscount > 0 ? ` (${langData.upTo} Rs. ${Number(c.maxDiscount).toLocaleString("en-IN")})` : "";
    const websiteUrl = settings.website || "";

    // Header: logo + shop info
    let html = `<table class="cf-tbl" style="font-size:${5 * scale}px">`;
    if (visible.includes("logo") || visible.includes("shopName") || visible.includes("address") || visible.includes("phone")) {
      html += "<tr><td class=\"cf-lc\">";
      if (visible.includes("logo") && logoUrl) {
        html += `<img src="${escapeHtml(logoUrl)}" class="cf-logo" />`;
      }
      html += `</td><td class="cf-ic">`;
      if (visible.includes("shopName")) html += `<div class="cf-n" style="font-size:${7 * scale}px">${escapeHtml(shopName)}</div>`;
      if (visible.includes("address") && address) html += `<div class="cf-a" style="font-size:${5 * scale}px">${escapeHtml(address)}</div>`;
      if (visible.includes("phone") && phone) html += `<div class="cf-p" style="font-size:${5 * scale}px">${escapeHtml(phone)}</div>`;
      html += "</td></tr>";
    }
    html += "</table>";

    // Discount hero
    if (visible.includes("discount")) {
      html += `<div class="cf-hero"><div class="cf-hero-val">${escapeHtml(dLabel)} ${escapeHtml(langData.off)}</div>${maxPart ? `<div class="cf-hero-sub">${escapeHtml(maxPart)}</div>` : ""}</div>`;
    }

    // Exclusive coupon badge
    html += `<div class="cf-exclusive">${escapeHtml(langData.exclusive)}</div>`;

    // Coupon code
    if (visible.includes("couponCode")) {
      html += `<div class="cf-code-wrap"><div class="cf-code-lbl">${escapeHtml(langData.codeLabel)}</div><div class="cf-code">${escapeHtml(code)}</div></div>`;
    }

    // Valid until
    if (visible.includes("validUntil") && validUntilStr) {
      html += `<div class="cf-valid">${escapeHtml(langData.validUntil)}: ${escapeHtml(validUntilStr)}</div>`;
    }

    // Terms & conditions
    html += `<div class="cf-terms">${langData.terms.map((t) => `<span class="cf-tl">${escapeHtml(t)}</span>`).join("")}</div>`;

    // Footer: social icons + website
    html += `<div class="cf-footer"><div class="cf-social">${SOCIAL_ICONS}<span class="cf-social-user">${escapeHtml(SOCIAL_USERNAME)}</span></div>${websiteUrl ? `<div class="cf-website">${escapeHtml(websiteUrl)}</div>` : ""}</div>`;

    return html;
  };

  const buildBack = (_c: Coupon) => {
    const scale = fontSizeMap[fontSize];
    return `
      <div class="cb-brand">
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" class="cb-logo" />` : ""}
        <div class="cb-name" style="font-size:${8 * scale}px">${escapeHtml(shopName)}</div>
        ${address ? `<div class="cb-addr" style="font-size:${5 * scale}px">${escapeHtml(address)}</div>` : ""}
        ${phone ? `<div class="cb-phone" style="font-size:${5 * scale}px">${escapeHtml(phone)}</div>` : ""}
        <div class="cb-social">${SOCIAL_ICONS}<span class="cf-social-user">${escapeHtml(SOCIAL_USERNAME)}</span></div>
      </div>
    `;
  };

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) { alert("Pop-up blocked. Allow pop-ups and try again."); return; }

    // Generate all card codes (each coupon × copies)
    const allCodes: { coupon: Coupon; code: string }[] = [];
    for (const c of coupons) {
      for (let i = 0; i < copies; i++) {
        allCodes.push({ coupon: c, code: c.code });
      }
    }
    const total = allCodes.length;

    let frontPages = "";
    let backPages = "";
    for (let start = 0; start < total; start += CARDS_PER_PAGE) {
      const count = Math.min(CARDS_PER_PAGE, total - start);
      let fg = "", bg = "";
      for (let i = 0; i < count; i++) {
        const { coupon, code } = allCodes[start + i];
        fg += `<div class="cc cf">${buildFront(coupon, code)}</div>`;
        bg += `<div class="cc cb">${buildBack(coupon)}</div>`;
      }
      frontPages += `<div class="a4p fp"><div class="cg">${fg}</div></div>`;
      backPages += `<div class="a4p bp"><div class="cg">${bg}</div></div>`;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Coupon Cards</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 4mm; }
          body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
          .a4p { width: 210mm; min-height: 297mm; padding: 2.5mm; page-break-after: always; }
          .cg { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.8mm; }
          .cc { width: 100%; height: 56mm; border: 0.3mm solid #e0e0e0; border-radius: 0.8mm; display: flex; flex-direction: column; padding: 1mm 1.5mm; overflow: hidden; page-break-inside: avoid; position: relative; }
          .cf { background: linear-gradient(135deg, #fff 0%, #fef9ef 100%); }
          .cb { background: #f8f8f8; }
          .cf-tbl { width: 100%; border-collapse: collapse; margin-bottom: 0.3mm; }
          .cf-lc { width: 20mm; vertical-align: middle; text-align: left; }
          .cf-logo { max-width: 18mm; max-height: 8mm; object-fit: contain; }
          .cf-ic { vertical-align: middle; text-align: right; }
          .cf-n { font-weight: 700; color: #1a1a2e; line-height: 1.15; }
          .cf-a, .cf-p { color: #666; line-height: 1.15; }
          .cf-hero { text-align: center; margin: 0.5mm 0 0.2mm; padding: 0.4mm 1mm; background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%); border-radius: 0.6mm; }
          .cf-hero-val { font-weight: 900; color: #fff; font-size: 9px; letter-spacing: 0.5px; }
          .cf-hero-sub { font-weight: 500; color: #ffcdd2; font-size: 5px; }
          .cf-exclusive { text-align: center; font-weight: 700; color: #c62828; font-size: 5.5px; letter-spacing: 1px; text-transform: uppercase; margin: 0.15mm 0; }
          .cf-code-wrap { text-align: center; margin: 0.2mm 0; }
          .cf-code-lbl { font-size: 4.5px; color: #999; font-weight: 500; }
          .cf-code { font-weight: 900; letter-spacing: 2.5px; color: #d32f2f; background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%); padding: 0.4mm 1.5mm; border-radius: 1mm; display: inline-block; border: 1px dashed #d32f2f; font-size: 11px; }
          .cf-valid { text-align: center; font-size: 4.5px; color: #888; margin-top: 0.1mm; }
          .cf-terms { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.2mm 0.5mm; margin: 0.2mm 0.3mm 2mm; }
          .cf-tl { font-size: 3.2px; color: #999; line-height: 1.2; position: relative; }
          .cf-tl + .cf-tl::before { content: "|"; color: #ddd; margin-right: 0.5mm; }
          .cf-footer { position: absolute; bottom: 0.5mm; left: 0; right: 0; }
          .cf-social { display: flex; align-items: center; justify-content: center; gap: 1.2mm; }
          .smi { width: 3.5mm; height: 3.5mm; color: #888; }
          .cf-social-user { font-size: 3.8px; color: #999; }
          .cf-website { text-align: center; font-size: 3.5px; color: #bbb; line-height: 1; }
          .cb-brand { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 0.5mm; background: linear-gradient(135deg, #fef9ef 0%, #fff 100%); }
          .cb-logo { max-width: 18mm; max-height: 10mm; object-fit: contain; margin-bottom: 0.3mm; }
          .cb-name { font-weight: 800; color: #1a1a2e; text-align: center; }
          .cb-addr, .cb-phone { color: #888; text-align: center; }
          .cb-social { display: flex; align-items: center; justify-content: center; gap: 1.2mm; margin-top: 0.5mm; }
          .cb-social .smi { width: 3mm; height: 3mm; color: #aaa; }
          @media print { @page { size: A4; margin: 4mm; } body { background: #fff; } .cc { border-color: #ccc; } }
        </style>
      </head>
      <body>
        ${frontPages}
        ${backPages}
        <script>setTimeout(function(){window.print()},800)<\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

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
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Font Size</label>
            <div className="flex gap-2">
              {(["small", "medium", "large"] as const).map((s) => (
                <button key={s} onClick={() => setFontSize(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border capitalize transition-colors ${fontSize === s ? "bg-primary text-white border-primary" : "bg-white text-secondary border-border hover:bg-muted"}`}>{s}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Front Side Elements</label>
            <div className="space-y-1">
              {elementOrder.map((el, idx) => (
                <div key={el} className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-lg border border-border">
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30"><MoveUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveDown(idx)} disabled={idx === elementOrder.length - 1} className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30"><MoveDown className="h-3.5 w-3.5" /></button>
                  <span className="text-xs font-medium text-secondary flex-1">{FRONT_LABELS[el]}</span>
                  <button onClick={() => toggleVisibility(el)} className="p-0.5 text-muted-foreground hover:text-primary">
                    {hiddenElements.has(el) ? <EyeOff className="h-3.5 w-3.5 opacity-40" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
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
            <strong>Printing Tips:</strong><br />
            • Select <strong>Two-sided (Duplex)</strong> → <strong>Flip on Short Edge</strong>.<br />
            • Prints on A4 with up to 15 cards per sheet (3×5 grid).<br />
            • Total: {coupons.length * copies} cards on {Math.ceil(coupons.length * copies / CARDS_PER_PAGE)} sheet(s).
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handlePrint} variant="accent" className="flex-1">Print {coupons.length * copies} Card{coupons.length * copies !== 1 ? "s" : ""}</Button>
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
