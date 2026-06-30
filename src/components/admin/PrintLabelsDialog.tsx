"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShopSettings } from "@/contexts/ShopSettingsContext";

interface LabelItem {
  productName: string;
  sku: string;
  barcodeId?: string;
  price: number;
  quantity: number;
}

interface PrintLabelsDialogProps {
  items: LabelItem[];
  onClose: () => void;
}

const ROWS = 11;
const COLS = 3;
const TOTAL = ROWS * COLS;

export default function PrintLabelsDialog({ items, onClose }: PrintLabelsDialogProps) {
  const { settings } = useShopSettings();
  const shopName = settings.shopName || "Panchakanya Collections";
  const website = settings.website || "";
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => true));
  const [quantities, setQuantities] = useState<number[]>(() => items.map((it) => it.quantity));
  const [startRow, setStartRow] = useState(1);
  const [startCol, setStartCol] = useState(1);

  const toggle = (idx: number) => {
    const next = [...checked];
    next[idx] = !next[idx];
    setChecked(next);
  };

  const setQty = (idx: number, val: number) => {
    const next = [...quantities];
    next[idx] = Math.max(0, val);
    setQuantities(next);
  };

  const totalLabels = items.reduce((s, _, i) => s + (checked[i] ? quantities[i] : 0), 0);
  const startPos = (startRow - 1) * COLS + startCol;
  const firstPageSlots = TOTAL - startPos + 1;
  const sheets = Math.max(1, Math.ceil((totalLabels - firstPageSlots) / TOTAL) + (totalLabels > firstPageSlots ? 1 : 0));
  const onFirstSheet = Math.min(totalLabels, firstPageSlots);
  const unused = firstPageSlots - onFirstSheet;

  const flatLabels = useMemo(() => {
    const result: { item: LabelItem; idx: number }[] = [];
    for (let i = 0; i < items.length; i++) {
      if (!checked[i]) continue;
      for (let j = 0; j < quantities[i]; j++) {
        result.push({ item: items[i], idx: i });
      }
    }
    return result;
  }, [items, checked, quantities]);

  const cellContents = useMemo(() => {
    const cells: { type: "empty" | "filled" | "unused"; label?: string; sku?: string; price?: number }[] = [];
    let labelIdx = 0;
    for (let pos = 1; pos <= TOTAL; pos++) {
      if (pos < startPos) {
        cells.push({ type: "empty" });
      } else if (labelIdx < flatLabels.length) {
        const { item } = flatLabels[labelIdx];
        cells.push({ type: "filled", label: item.productName, sku: item.sku, price: item.price });
        labelIdx++;
      } else {
        cells.push({ type: "unused" });
      }
    }
    return cells;
  }, [startPos, flatLabels]);

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) { alert("Pop-up blocked. Allow pop-ups and try again."); return; }

    let labelIdx = 0;
    const pages: string[] = [];
    let isFirstPage = true;

    while (labelIdx < flatLabels.length) {
      const cells: string[] = [];
      for (let pos = 1; pos <= TOTAL; pos++) {
        if (isFirstPage && pos < startPos) {
          cells.push(`<div class="label-cell empty"></div>`);
        } else if (labelIdx < flatLabels.length) {
          const { item } = flatLabels[labelIdx];
          cells.push(`
            <div class="label-cell">
              <div class="pl-shop-name">${escapeHtml(shopName)}</div>
              <div class="pl-name">${escapeHtml(item.productName)}</div>
              <svg class="pl-barcode" data-barcode="${escapeHtml(item.barcodeId || item.sku)}"></svg>
              <div class="pl-sku">${escapeHtml(item.sku)}</div>
              <div class="pl-mrp">MRP: Rs. ${item.price.toLocaleString("en-IN")}</div>
              ${website ? `<div class="pl-website">${escapeHtml(website)}</div>` : ""}
            </div>
          `);
          labelIdx++;
        } else {
          cells.push(`<div class="label-cell empty"></div>`);
        }
      }
      pages.push(`<div class="a4-page"><div class="label-grid">${cells.join("")}</div></div>`);
      isFirstPage = false;
    }

    if (pages.length === 0) {
      pages.push(`<div class="a4-page"><div class="label-grid">${Array.from({ length: TOTAL }, () => `<div class="label-cell empty"></div>`).join("")}</div></div>`);
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Price Labels</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"><\/script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4 portrait; margin: 0; }
          body { width: 210mm; margin: 0; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; }
          .a4-page { width: 210mm; height: 297mm; page-break-after: always; overflow: hidden; }
           .label-grid { display: grid; gap: 0; grid-template-columns: repeat(${COLS}, 66mm); grid-template-rows: repeat(${ROWS}, 25.4mm); width: 210mm; justify-content: center; align-content: start; padding: 9.65mm 0 7.95mm 0; }
          .label-cell { width: 66mm; height: 25.4mm; box-sizing: border-box; padding: 1mm 1.5mm; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
          .label-cell.empty { visibility: hidden; }
          .pl-shop-name { font-size: 5px; font-weight: 600; text-align: center; color: #888; line-height: 1; }
          .pl-name { font-size: 7px; font-weight: 700; text-align: center; line-height: 1.15; max-height: 14px; overflow: hidden; width: 100%; white-space: nowrap; text-overflow: ellipsis; }
          .pl-barcode { max-width: 60mm; height: 9mm; margin: 0; }
          .pl-sku { font-size: 5px; color: #555; text-align: center; letter-spacing: 0.3px; }
          .pl-mrp { font-size: 9px; font-weight: 700; text-align: center; margin-top: 0; }
          .pl-website { font-size: 4.5px; font-weight: 400; text-align: center; color: #888; line-height: 1; }
          @media print { @page { size: A4 portrait; margin: 0; } body { background: #fff; } }
        </style>
      </head>
      <body>
        ${pages.join("")}
        <script>
          document.querySelectorAll('.pl-barcode').forEach(function(el) {
            try {
              JsBarcode(el, el.getAttribute('data-barcode'), { format: "CODE128", width: 1, height: 24, displayValue: false, margin: 0, background: "#ffffff" });
            } catch(e) { console.warn(e); }
          });
          setTimeout(function() { window.print(); }, 500);
        <\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-secondary">Print Price Labels</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3 px-1">
            <button onClick={() => setChecked(Array(items.length).fill(true))} className="text-xs text-primary hover:underline font-medium">Select All</button>
            <button onClick={() => setChecked(Array(items.length).fill(false))} className="text-xs text-muted-foreground hover:underline">Deselect All</button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50">
              <input type="checkbox" checked={checked[idx]} onChange={() => toggle(idx)} className="accent-primary h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary truncate">{item.productName}</p>
                <p className="text-xs text-muted-foreground">SKU: {item.sku} &middot; MRP: Rs. {item.price.toLocaleString("en-IN")}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setQty(idx, quantities[idx] - 1)} className="w-7 h-7 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted text-sm font-medium">−</button>
                <input type="number" min={0} value={quantities[idx]}
                  onChange={(e) => setQty(idx, parseInt(e.target.value) || 0)}
                  className="w-14 text-center text-sm border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary" />
                <button onClick={() => setQty(idx, quantities[idx] + 1)} className="w-7 h-7 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted text-sm font-medium">+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Start Position Selector + Grid Preview */}
        {totalLabels > 0 && (
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-4">
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Start Row</label>
                <input type="number" min={1} max={ROWS} value={startRow}
                  onChange={(e) => setStartRow(Math.min(ROWS, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-16 px-2 py-1.5 border border-border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Start Column</label>
                <input type="number" min={1} max={COLS} value={startCol}
                  onChange={(e) => setStartCol(Math.min(COLS, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-16 px-2 py-1.5 border border-border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="text-sm text-secondary font-semibold pb-1.5">
                Position <span className="text-primary font-bold">{startPos}</span> / {TOTAL}
              </div>
            </div>

            {/* Grid Preview */}
            <div className="grid grid-cols-3 gap-[1px] bg-border rounded border border-border overflow-hidden" style={{ maxWidth: "330px" }}>
              {cellContents.map((cell, i) => {
                const row = Math.floor(i / COLS) + 1;
                const col = (i % COLS) + 1;
                const pos = i + 1;
                const isActive = pos >= startPos;
                return (
                  <button key={i}
                    onClick={() => { setStartRow(row); setStartCol(col); }}
                    className={`
                      aspect-[66/25.4] flex items-center justify-center text-[8px] font-mono transition-colors
                      ${!isActive ? "bg-white text-transparent pointer-events-none" : ""}
                      ${cell.type === "filled" ? "bg-primary/10 text-primary font-bold" : ""}
                      ${cell.type === "unused" ? "bg-white text-muted-foreground/40 border border-dashed border-muted-foreground/20 m-[1px]" : ""}
                      ${cell.type === "empty" ? "" : "cursor-pointer hover:bg-primary/5"}
                    `}
                    title={`Row ${row}, Col ${col} (Pos ${pos})`}
                  >
                    {isActive && cell.type === "unused" ? pos : ""}
                    {cell.type === "filled" ? (cell.label && cell.label.length > 6 ? cell.label.substring(0, 6) + "…" : cell.label) : ""}
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-muted-foreground space-y-0.5 bg-slate-50 p-3 rounded-lg">
              <p>Starting at <strong className="text-secondary">position {startPos}</strong> — filling <strong className="text-secondary">{onFirstSheet}</strong> of <strong className="text-secondary">{firstPageSlots}</strong> slots on this sheet.</p>
              {unused > 0 && <p><strong className="text-amber-600">{unused}</strong> slot{unused !== 1 ? "s" : ""} will remain unused on this sheet.</p>}
              <p>Total: <strong className="text-secondary">{totalLabels}</strong> label{totalLabels !== 1 ? "s" : ""} on <strong className="text-secondary">{sheets}</strong> sheet{sheets !== 1 ? "s" : ""}.</p>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{totalLabels} label{totalLabels !== 1 ? "s" : ""} selected</span>
          <Button onClick={handlePrint} disabled={totalLabels === 0} variant="accent">Print Selected</Button>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
