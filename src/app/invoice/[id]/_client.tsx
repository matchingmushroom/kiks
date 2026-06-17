"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Invoice } from "@/types";
import { formatCurrency, formatDate, amountInWords } from "@/lib/utils";
import { Printer, Download } from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import InvoicePDF from "@/components/invoice/InvoicePDF";

export default function PublicInvoicePage() {
  const params = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState("KIKS Collections");
  const [shopTagline, setShopTagline] = useState("Exquisite Jewellery");
  const [shopAddress, setShopAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("/logo.svg");

  useEffect(() => {
    const load = async () => {
      try {
        const [invSnap, settingsSnap] = await Promise.all([
          getDoc(doc(db, "invoices", params.id as string)),
          getDoc(doc(db, "shop_settings", "config")),
        ]);
        const inv = invSnap.exists() ? ({ id: invSnap.id, ...invSnap.data() } as Invoice) : null;
        const settings = settingsSnap.exists() ? settingsSnap.data() : null;
        if (inv) {
          setInvoice(inv);
          document.title = `${inv.invoiceNumber} - KIKS Collections`;
        } else {
          document.title = "Invoice Not Found - KIKS Collections";
        }
        if (settings) {
          setShopName(settings.shopName || "KIKS Collections");
          setShopTagline(settings.tagline || "Exquisite Jewellery");
          setShopAddress(settings.address || "");
          setLogoUrl(settings.logoUrl || "/logo.svg");
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
    };
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Invoice not found</p>
          <a href="/" className="text-primary hover:underline text-sm">Back to Home</a>
        </div>
      </div>
    );
  }

  const invoiceData = {
    shopName,
    shopTagline,
    logoUrl,
    invoiceNumber: invoice.invoiceNumber,
    type: invoice.type,
    customer: invoice.customer,
    items: invoice.items.map((i) => ({
      productName: i.productName,
      weight: i.weight,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      subtotal: i.subtotal,
    })),
    subtotal: invoice.subtotal,
    discountAmount: invoice.discountAmount,
    totalAmount: invoice.totalAmount,
    cashReceived: invoice.cashReceived,
    balanceDue: invoice.balanceDue,
    warranty: invoice.warranty,
    notes: invoice.notes,
    termsAndConditions: invoice.termsAndConditions,
    date: formatDate(invoice.createdAt as unknown as number),
    validUntil: invoice.validUntil ? formatDate(invoice.validUntil as unknown as number) : undefined,
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-end gap-2 mb-4 no-print">
          <button onClick={() => window.print()}
            className="flex items-center gap-1 px-3 py-2 bg-white border border-border rounded-lg text-sm hover:bg-muted">
            <Printer className="h-4 w-4" /> Print
          </button>
          <PDFDownloadLink document={<InvoicePDF {...invoiceData} />} fileName={`${invoice.invoiceNumber}.pdf`}>
            {({ loading: pdfLoading }) => (
              <button className="flex items-center gap-1 px-3 py-2 bg-white border border-border rounded-lg text-sm hover:bg-muted">
                <Download className="h-4 w-4" /> {pdfLoading ? "..." : "Download PDF"}
              </button>
            )}
          </PDFDownloadLink>
        </div>

        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-8">
            <div className="flex items-start justify-between mb-8 pb-6 border-b border-border">
              <div>
                <img src={logoUrl} alt={shopName} className="h-12 mb-2" />
                <h2 className="text-xl font-bold text-secondary">{shopName}</h2>
                <p className="text-sm text-muted-foreground">{shopTagline}</p>
                {shopAddress && <p className="text-sm text-muted-foreground">{shopAddress}</p>}
              </div>
              <div className="text-right">
                <h1 className="text-3xl font-bold text-primary mb-1">
                  {invoice.type === "invoice" ? "INVOICE" : "ESTIMATE"}
                </h1>
                <p className="text-sm text-muted-foreground">#{invoice.invoiceNumber}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">Bill To</p>
                <p className="font-medium text-secondary">{invoice.customer?.name}</p>
                <p className="text-sm text-muted-foreground">{invoice.customer?.phone}</p>
                {invoice.customer?.address && (
                  <p className="text-sm text-muted-foreground">{invoice.customer.address}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase mb-1">Date</p>
                <p className="text-sm">{formatDate(invoice.createdAt as unknown as number)}</p>
                {invoice.createdByName && (
                  <p className="text-xs text-muted-foreground mt-3 mb-1">Created by: {invoice.createdByName}</p>
                )}
                {invoice.type === "estimate" && invoice.validUntil && (
                  <>
                    <p className="text-xs text-muted-foreground uppercase mt-3 mb-1">Valid Until</p>
                    <p className="text-sm">{formatDate(invoice.validUntil as unknown as number)}</p>
                  </>
                )}
              </div>
            </div>

            <table className="w-full text-sm mb-8">
              <thead>
                <tr className="bg-muted text-left">
                  <th className="px-3 py-2 text-xs text-muted-foreground font-medium">Description</th>
                  <th className="px-3 py-2 text-xs text-muted-foreground font-medium text-center">Wt(g)</th>
                  <th className="px-3 py-2 text-xs text-muted-foreground font-medium text-center">Qty</th>
                  <th className="px-3 py-2 text-xs text-muted-foreground font-medium text-right">Rate</th>
                  <th className="px-3 py-2 text-xs text-muted-foreground font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.items.map((item, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2.5 text-sm">{item.productName}</td>
                    <td className="px-3 py-2.5 text-sm text-center">{item.weight}g</td>
                    <td className="px-3 py-2.5 text-sm text-center">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-3 py-2.5 text-sm text-right font-medium">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end mb-4">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.discountAmount > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Discount</span>
                    <span>-{formatCurrency(invoice.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-secondary pt-2 border-t border-border">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.totalAmount)}</span>
                </div>
                {invoice.type === "invoice" && (invoice.cashReceived ?? 0) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Cash Received</span>
                    <span>{formatCurrency(invoice.cashReceived ?? 0)}</span>
                  </div>
                )}
                {invoice.type === "invoice" && (invoice.balanceDue ?? 0) > 0 && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span>Balance Due</span>
                    <span>{formatCurrency(invoice.balanceDue ?? 0)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-sm text-muted-foreground mb-6 italic">
              Amount in words: {amountInWords(invoice.totalAmount)}
            </div>

            {invoice.couponIssued && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm">
                <p className="font-medium text-blue-800 mb-1">Coupon Issued</p>
                <p className="font-mono text-blue-700 font-bold">{invoice.couponIssued.code}</p>
                <p className="text-blue-600 text-xs mt-1">Use this code on your next purchase for 10% off!</p>
              </div>
            )}

            {invoice.warranty?.period && (
              <div className="bg-muted rounded-lg p-4 mb-4 text-sm">
                <p className="font-medium mb-1">Warranty: {invoice.warranty.period}</p>
                <p className="text-muted-foreground">{invoice.warranty.terms}</p>
              </div>
            )}

            {invoice.notes && (
              <div className="mb-4 text-sm">
                <p className="font-medium mb-1">Notes</p>
                <p className="text-muted-foreground">{invoice.notes}</p>
              </div>
            )}

            {invoice.termsAndConditions && (
              <div className="mb-8 text-sm">
                <p className="font-medium mb-1">Terms & Conditions</p>
                <p className="text-muted-foreground">{invoice.termsAndConditions}</p>
              </div>
            )}

            <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
              <p>Thank you for your business! &bull; {shopName}</p>
              {shopAddress && <p>{shopAddress}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
