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
      "This coupon can be used for both online and in-store purchases.",
      "Coupon cannot be combined with any other offer or discount.",
      "Valid only for the products specified at the time of issuance.",
      "The coupon is non-transferable and non-refundable.",
      "Management reserves the right to cancel or modify the coupon at any time.",
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

  const buildCouponFront = (c: Coupon, scale: number) => {
    const discountLabel = c.discountType === "fixed"
      ? `Rs. ${Number(c.discountValue).toLocaleString("en-IN")}`
      : `${c.discountValue}%`;
    const maxDiscountLabel = c.maxDiscount > 0
      ? `Rs. ${Number(c.maxDiscount).toLocaleString("en-IN")}`
      : "";
    const validUntilStr = c.validUntil
      ? new Date(toDate(c.validUntil)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "";

    const elements: Record<FrontElement, string> = {
      logo: logoUrl ? `<img src="${escapeHtml(logoUrl)}" class="c-logo" style="max-height:${Math.round(18 * scale)}mm" />` : "",
      shopName: `<div class="c-name" style="font-size:${Math.round(11 * scale)}px">${escapeHtml(shopName)}</div>`,
      address: address ? `<div class="c-addr" style="font-size:${Math.round(6.5 * scale)}px">${escapeHtml(address)}</div>` : "",
      phone: phone ? `<div class="c-phone" style="font-size:${Math.round(6.5 * scale)}px">${escapeHtml(phone)}</div>` : "",
      couponCode: `<div class="c-code-wrap"><div class="c-code-label" style="font-size:${Math.round(6 * scale)}px">${escapeHtml(langData.codeLabel)}</div><div class="c-code" style="font-size:${Math.round(18 * scale)}px">${escapeHtml(c.code)}</div></div>`,
      discount: `<div class="c-offer" style="font-size:${Math.round(8 * scale)}px">${discountTypeLabel(c, scale)}</div>`,
      validUntil: validUntilStr ? `<div class="c-valid" style="font-size:${Math.round(6 * scale)}px">${escapeHtml(langData.validUntil)}: ${escapeHtml(validUntilStr)}</div>` : "",
    };

    return elementOrder
      .filter((el) => !hiddenElements.has(el) && elements[el])
      .map((el) => elements[el])
      .join("");
  };

  const discountTypeLabel = (c: Coupon, scale: number) => {
    const langData = LANG_LABELS[lang];
    if (c.discountType === "fixed") {
      return `🎁 ${escapeHtml(langData.offer)}: Rs. ${Number(c.discountValue).toLocaleString("en-IN")} ${escapeHtml(langData.off)}`;
    }
    const maxPart = c.maxDiscount > 0 ? ` (${langData.upTo} Rs. ${Number(c.maxDiscount).toLocaleString("en-IN")})` : "";
    return `🎁 ${escapeHtml(langData.offer)}: ${c.discountValue}% ${escapeHtml(langData.off)}${maxPart}`;
  };

  const buildTermsBack = (c: Coupon, scale: number) => {
    const langData = LANG_LABELS[lang];
    const minPurchaseStr = c.minPurchaseAmount > 0
      ? `<div class="c-term-line" style="font-size:${Math.round(6 * scale)}px">• ${escapeHtml(langData.minPurchase)}: Rs. ${Number(c.minPurchaseAmount).toLocaleString("en-IN")}</div>`
      : "";

    const termsHtml = langData.terms
      .map((t) => `<div class="c-term-line" style="font-size:${Math.round(6 * scale)}px">• ${escapeHtml(t)}</div>`)
      .join("");

    const headerBg = c.discountType === "fixed"
      ? `Rs. ${Number(c.discountValue).toLocaleString("en-IN")} ${LANG_LABELS[lang].off}`
      : `${c.discountValue}% ${LANG_LABELS[lang].off}`;

    return `
      <div class="c-back-header" style="font-size:${Math.round(8 * scale)}px">${escapeHtml(headerBg)}</div>
      <div class="c-back-title" style="font-size:${Math.round(7 * scale)}px">${escapeHtml(langData.exclusive)}</div>
      <div class="c-back-divider"></div>
      <div class="c-back-terms">
        ${minPurchaseStr}
        ${termsHtml}
      </div>
      <div class="c-back-footer" style="font-size:${Math.round(5.5 * scale)}px">${escapeHtml(shopName)} | ${escapeHtml(phone)}</div>
    `;
  };

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) { alert("Pop-up blocked. Allow pop-ups and try again."); return; }

    const scale = fontSizeMap[fontSize];
    const allCards: string[] = [];

    for (let cIdx = 0; cIdx < copies; cIdx++) {
      for (const c of coupons) {
        allCards.push(`
          <div class="card-front">
            ${buildCouponFront(c, scale)}
          </div>
          <div class="card-back">
            ${buildTermsBack(c, scale)}
          </div>
        `);
      }
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Coupon Cards</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page {
            size: 90mm 54mm;
            margin: 0;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            background: #fff;
          }
          .card-front, .card-back {
            width: 90mm;
            height: 54mm;
            page-break-after: always;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2mm 3mm;
            overflow: hidden;
          }
          .card-front {
            background: #fff;
            border: 0.5mm solid #ddd;
          }
          .card-back {
            background: #fafafa;
            border: 0.5mm solid #ddd;
          }
          .c-logo {
            max-width: 70mm;
            object-fit: contain;
            margin-bottom: 0.5mm;
          }
          .c-name {
            font-weight: 700;
            color: #222;
            text-align: center;
            line-height: 1.2;
          }
          .c-addr, .c-phone {
            color: #666;
            text-align: center;
            line-height: 1.3;
          }
          .c-code-wrap {
            text-align: center;
            margin: 0.5mm 0;
          }
          .c-code-label {
            color: #888;
            font-weight: 500;
          }
          .c-code {
            font-weight: 900;
            letter-spacing: 3px;
            color: #d32f2f;
            text-align: center;
            background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%);
            padding: 0.8mm 3mm;
            border-radius: 2mm;
            display: inline-block;
            border: 1.5px dashed #d32f2f;
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          }
          .c-offer {
            font-weight: 600;
            color: #d32f2f;
            text-align: center;
            margin: 0.3mm 0;
          }
          .c-valid {
            color: #888;
            text-align: center;
          }
          .c-back-header {
            font-weight: 800;
            color: #fff;
            background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
            text-align: center;
            padding: 1mm 3mm;
            border-radius: 1.5mm;
            width: 100%;
            margin-bottom: 0.5mm;
          }
          .c-back-title {
            font-weight: 600;
            color: #555;
            text-align: center;
            margin-bottom: 0.3mm;
          }
          .c-back-divider {
            width: 100%;
            height: 0.5px;
            background: #ddd;
            margin: 0.5mm 0;
          }
          .c-back-terms {
            width: 100%;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 0 1mm;
          }
          .c-term-line {
            color: #555;
            line-height: 1.4;
            padding: 0.3mm 0;
          }
          .c-back-footer {
            color: #999;
            text-align: center;
            width: 100%;
            margin-top: 0.5mm;
          }
          @media print {
            @page {
              size: 90mm 54mm;
              margin: 0;
            }
            body { background: #fff; }
            .card-front, .card-back {
              border: none;
            }
          }
        </style>
      </head>
      <body>
        ${allCards.join("")}
      </body>
      </html>
    `);
    printWin.document.close();
    setTimeout(() => printWin.print(), 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-secondary">Print Coupon Cards</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-5">
          {/* Selected coupons */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Selected Coupons</label>
            <div className="flex flex-wrap gap-2">
              {coupons.map((c) => (
                <span key={c.id} className="text-xs bg-primary/10 text-primary font-mono font-semibold px-2 py-1 rounded-full">
                  {c.code}
                </span>
              ))}
            </div>
          </div>

          {/* Language toggle */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Print Language</label>
            <div className="flex gap-2">
              <button
                onClick={() => setLang("english")}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  lang === "english" ? "bg-primary text-white border-primary" : "bg-white text-secondary border-border hover:bg-muted"
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLang("nepali")}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  lang === "nepali" ? "bg-primary text-white border-primary" : "bg-white text-secondary border-border hover:bg-muted"
                }`}
              >
                नेपाली
              </button>
            </div>
          </div>

          {/* Font size */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Font Size</label>
            <div className="flex gap-2">
              {(["small", "medium", "large"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFontSize(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border capitalize transition-colors ${
                    fontSize === s ? "bg-primary text-white border-primary" : "bg-white text-secondary border-border hover:bg-muted"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Element order & visibility */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Front Side Elements (drag to reorder)</label>
            <div className="space-y-1">
              {elementOrder.map((el, idx) => (
                <div key={el} className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-lg border border-border">
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30">
                    <MoveUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => moveDown(idx)} disabled={idx === elementOrder.length - 1} className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30">
                    <MoveDown className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs font-medium text-secondary flex-1">{FRONT_LABELS[el]}</span>
                  <button onClick={() => toggleVisibility(el)} className="p-0.5 text-muted-foreground hover:text-primary">
                    {hiddenElements.has(el) ? <EyeOff className="h-3.5 w-3.5 opacity-40" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Print copies */}
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

          {/* Print hint */}
          <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-xs leading-relaxed">
            <strong>Printing Tips:</strong><br />
            • Select <strong>Two-sided (Duplex)</strong> printing in your printer settings.<br />
            • Choose <strong>Flip on Short Edge</strong> for proper front/back alignment.<br />
            • Each card is <strong>90mm × 54mm</strong> (standard business card size).<br />
            • Total pages to print: {coupons.length * copies * 2} ({coupons.length * copies} cards × front + back).
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handlePrint} variant="accent" className="flex-1">
              Print {coupons.length * copies} Card{coupons.length * copies !== 1 ? "s" : ""}
            </Button>
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
