"use client";

import { useState } from "react";
import PriceLabel from "./PriceLabel";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LabelItem {
  productName: string;
  sku: string;
  price: number;
  quantity: number;
}

interface PrintLabelsDialogProps {
  items: LabelItem[];
  onClose: () => void;
}

export default function PrintLabelsDialog({ items, onClose }: PrintLabelsDialogProps) {
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => true));

  const toggle = (idx: number) => {
    const next = [...checked];
    next[idx] = !next[idx];
    setChecked(next);
  };

  const selected = items.filter((_, i) => checked[i]);
  const totalLabels = selected.reduce((s, it) => s + it.quantity, 0);

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) { alert("Pop-up blocked. Allow pop-ups and try again."); return; }

    const rows: string[] = [];
    for (const item of selected) {
      for (let i = 0; i < item.quantity; i++) {
        rows.push(`
          <div class="label-cell">
            <div class="pl-name">${escapeHtml(item.productName)}</div>
            <svg class="pl-barcode" data-sku="${escapeHtml(item.sku)}"></svg>
            <div class="pl-sku">${escapeHtml(item.sku)}</div>
            <div class="pl-mrp">MRP: Rs. ${item.price.toLocaleString("en-IN")}</div>
          </div>
        `);
      }
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Price Labels</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"><\/script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: 210mm;
            margin: 0 auto;
            padding: 10mm 0;
            background: #fff;
          }
          .label-grid {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 3mm;
            padding: 0 5mm;
          }
          .label-cell {
            width: 50.8mm;
            height: 25.4mm;
            border: 0.5px solid #ccc;
            border-radius: 2px;
            padding: 2mm 1.5mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: Arial, Helvetica, sans-serif;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .pl-name {
            font-size: 8px;
            font-weight: 700;
            text-align: center;
            line-height: 1.2;
            max-height: 16px;
            overflow: hidden;
            width: 100%;
            white-space: nowrap;
            text-overflow: ellipsis;
          }
          .pl-barcode {
            max-width: 46mm;
            height: 12mm;
            margin: 1px 0;
          }
          .pl-sku {
            font-size: 6px;
            color: #555;
            text-align: center;
            letter-spacing: 0.3px;
          }
          .pl-mrp {
            font-size: 8px;
            font-weight: 700;
            text-align: center;
            margin-top: 1px;
          }
          .dashed-cut {
            width: 100%;
            border: none;
            border-top: 1px dashed #aaa;
            margin: 1mm 0;
          }
          @media print {
            @page { margin: 5mm; }
            body { background: #fff; }
          }
        </style>
      </head>
      <body>
        <div class="label-grid">
          ${rows.join("")}
        </div>
        <script>
          document.querySelectorAll('.pl-barcode').forEach(function(el) {
            try {
              JsBarcode(el, el.getAttribute('data-sku'), {
                format: "CODE128",
                width: 1.2,
                height: 28,
                displayValue: false,
                margin: 0,
                background: "#ffffff",
              });
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-secondary">Print Price Labels</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {items.map((item, idx) => (
            <label key={idx} className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50">
              <input type="checkbox" checked={checked[idx]} onChange={() => toggle(idx)} className="accent-primary h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary truncate">{item.productName}</p>
                <p className="text-xs text-muted-foreground">SKU: {item.sku} &middot; MRP: Rs. {item.price.toLocaleString("en-IN")}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">Qty: {item.quantity}</span>
            </label>
          ))}
        </div>
        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{totalLabels} label{totalLabels !== 1 ? "s" : ""} selected</span>
          <Button onClick={handlePrint} disabled={totalLabels === 0} variant="accent">
            Print Selected
          </Button>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
