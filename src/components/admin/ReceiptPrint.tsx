"use client";

import { useRef, useEffect } from "react";

interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  subtotal: number;
}

interface ReceiptData {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  date: string;
  time: string;
  receiptNo: string;
  customerName: string;
  customerPhone: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  paymentMethod: string;
  recordedBy: string;
}

interface ReceiptPrintProps {
  data: ReceiptData;
  onClose: () => void;
}

export default function ReceiptPrint({ data, onClose }: ReceiptPrintProps) {
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => printRef.current?.querySelector("button")?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { window.print(); return; }
    const content = printRef.current?.innerHTML || "";
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Receipt</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; margin: 0 auto; padding: 4mm 0; color: #000; }
        .header { text-align: center; margin-bottom: 4mm; }
        .header h2 { margin: 0; font-size: 14px; font-weight: bold; }
        .header p { margin: 1mm 0; font-size: 10px; }
        .divider { border-top: 1px dashed #000; margin: 2mm 0; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { text-align: left; padding: 1mm 0; border-bottom: 1px solid #000; font-size: 10px; }
        td { padding: 0.5mm 0; }
        .right { text-align: right; }
        .total-row td { font-weight: bold; border-top: 1px solid #000; padding-top: 1mm; }
        .footer { text-align: center; margin-top: 4mm; font-size: 10px; }
        .no-print { display: none; }
        @media screen { body { background: #f5f5f5; padding: 8mm; } .receipt { background: #fff; padding: 4mm; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); } }
      </style>
    </head><body><div class="receipt">${content}<div style="text-align:center;margin-top:4mm;font-size:10px">Thank you!</div></div>
    <div style="text-align:center;margin-top:4mm" class="no-print"><button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer">Print</button> <button onclick="window.close()" style="padding:8px 24px;font-size:14px;cursor:pointer">Close</button></div>
    <script>window.onafterprint = window.close;</script></body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-y-auto max-h-[90vh]">
        <div ref={printRef} className="p-4 font-mono text-xs leading-relaxed" style={{ maxWidth: "72mm", margin: "0 auto" }}>
          <div className="text-center mb-3">
            <h2 className="text-sm font-bold">{data.shopName}</h2>
            <p className="text-[10px] text-gray-600">{data.shopAddress}</p>
            <p className="text-[10px] text-gray-600">Tel: {data.shopPhone}</p>
          </div>
          <div className="border-t border-dashed border-gray-400 my-2" />
          <div className="flex justify-between text-[10px]">
            <span>{data.date}</span>
            <span>{data.time}</span>
          </div>
          <p className="text-[10px]">Receipt: {data.receiptNo}</p>
          <p className="text-[10px]">Staff: {data.recordedBy}</p>
          {data.customerName !== "Walk-in Customer" && (
            <p className="text-[10px]">Customer: {data.customerName} {data.customerPhone ? `(${data.customerPhone})` : ""}</p>
          )}
          <div className="border-t border-dashed border-gray-400 my-2" />
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={i}>
                  <td className="max-w-[120px] truncate">{item.name}</td>
                  <td className="text-right">{item.qty}</td>
                  <td className="text-right">{item.price.toLocaleString("en-IN")}</td>
                  <td className="text-right">{item.subtotal.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-dashed border-gray-400 my-2" />
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{data.subtotal.toLocaleString("en-IN")}</span>
            </div>
            {data.discount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Discount</span>
                <span>-{data.discount.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm border-t border-dashed border-gray-400 pt-1 mt-1">
              <span>Total</span>
              <span>{data.total.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span>Paid ({data.paymentMethod})</span>
              <span>{data.paid.toLocaleString("en-IN")}</span>
            </div>
            {data.change > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Change</span>
                <span>{data.change.toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>
          <div className="border-t border-dashed border-gray-400 my-2" />
          <div className="text-center text-[10px] text-gray-600">
            <p>Thank you for your purchase!</p>
            <p>Goods once sold will not be taken back.</p>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t border-border">
          <button onClick={handlePrint}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90">
            Print Receipt
          </button>
          <button onClick={onClose}
            className="px-4 py-2 border border-border text-sm rounded-lg hover:bg-muted">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
