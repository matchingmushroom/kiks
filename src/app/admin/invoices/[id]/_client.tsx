"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { generateId } from "@/lib/id-generator";
import { doc, getDoc, updateDoc, addDoc, collection, deleteDoc, Timestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Invoice } from "@/types";
import { formatCurrency, formatDate, amountInWords } from "@/lib/utils";
import { toBS } from "@/lib/nepaliDate";
import { Button } from "@/components/ui/button";
import { Printer, Download, Share2, ArrowLeft, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import Link from "next/link";
import { PDFDownloadLink } from "@react-pdf/renderer";
import InvoicePDF from "@/components/invoice/InvoicePDF";

const STATUSES = ["draft", "sent", "paid", "partially_paid", "cancelled", "expired"] as const;
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-50 text-gray-700 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-green-50 text-green-700 border-green-200",
  partially_paid: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-red-50 text-red-700 border-red-200",
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const { settings } = useShopSettings();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [archived, setArchived] = useState(false);
  const [shopName, setShopName] = useState("KIKS Collections");
  const [shopTagline, setShopTagline] = useState("Exquisite Jewellery");
  const [shopAddress, setShopAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("/logo.svg");
  const [converting, setConverting] = useState(false);

  const loadInvoice = async () => {
    try {
      const snap = await getDoc(doc(db, "invoices", params.id as string));
      if (snap.exists()) {
        setInvoice({ id: snap.id, ...snap.data() } as Invoice);
        setArchived(false);
      } else if (settings.gasWebhookUrl) {
        const res = await fetch(settings.gasWebhookUrl, {
          method: "POST",
          body: JSON.stringify({ action: "queryArchivedDoc", collection: "invoices", id: params.id }),
        });
        const result = await res.json();
        if (result.status === "ok" && result.doc) {
          setInvoice(result.doc as Invoice);
          setArchived(true);
        }
      }
      const settingsSnap = await getDoc(doc(db, "shop_settings", "config"));
      if (settingsSnap.exists()) {
        const s = settingsSnap.data();
        setShopName(s.shopName || "KIKS Collections");
        setShopTagline(s.tagline || "Exquisite Jewellery");
        setShopAddress(s.address || "");
        setLogoUrl(s.logoUrl || "/logo.svg");
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  useEffect(() => { loadInvoice(); }, [params.id, settings.gasWebhookUrl]);

  const updateStatus = async (status: string) => {
    if (!invoice) return;
    await updateDoc(doc(db, "invoices", invoice.id), { status, updatedAt: Timestamp.fromDate(new Date()) });
    loadInvoice();
  };

  const convertToInvoice = async () => {
    if (!invoice || invoice.type !== "estimate") return;
    setConverting(true);
    try {
      const now = new Date();
      const bs = toBS(now);
      const year = bs.month >= 4 ? bs.year : bs.year - 1;
      const counterDoc = doc(db, "counters", `invoices_${year}`);
      const counterSnap = await getDoc(counterDoc);
      let seq = 1;
      if (counterSnap.exists()) {
        seq = (counterSnap.data().lastNumber || 0) + 1;
      }
      await setDoc(counterDoc, { lastNumber: seq, year }, { merge: true });
      const invoiceNum = `INV-${String(year).slice(-3)}-${String(seq).padStart(5, "0")}`;

      const invId = await generateId("INV");
      await setDoc(doc(db, "invoices", invId), {
        ...invoice,
        id: undefined,
        type: "invoice",
        invoiceNumber: invoiceNum,
        status: "draft",
        relatedSaleId: invoice.id,
        createdByName: profile?.displayName || invoice.createdByName || "",
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });

      await updateDoc(doc(db, "invoices", invoice.id), {
        status: "expired",
        updatedAt: Timestamp.fromDate(now),
      });

      loadInvoice();
    } catch (e) {
      console.error("Convert failed", e);
    }
    setConverting(false);
  };

  const shareWhatsApp = () => {
    if (!invoice) return;
    const url = `${window.location.origin}/invoice/${invoice.id}`;
    const msg = `Your ${invoice.type === "invoice" ? "Invoice" : "Estimate"} #${invoice.invoiceNumber} is ready: ${url}`;
    openWhatsApp(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6 text-center text-muted-foreground py-20">Loading invoice...</div>
      </AdminLayout>
    );
  }

  if (!invoice) {
    return (
      <AdminLayout>
        <div className="p-6 text-center py-20">
          <p className="text-muted-foreground mb-4">Invoice not found</p>
          <Link href="/admin/invoices" className="text-primary hover:underline">Back to Invoices</Link>
        </div>
      </AdminLayout>
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
    couponCode: invoice.couponIssued?.code,
    couponDiscountText: invoice.couponIssued?.discountType === "percentage"
      ? `${invoice.couponIssued.discountValue}% off`
      : invoice.couponIssued?.discountValue ? `Rs. ${invoice.couponIssued.discountValue} off` : undefined,
    couponTerms: invoice.couponIssued?.terms,
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto no-print">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/invoices" className="p-1 hover:bg-muted rounded">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-secondary">{invoice.invoiceNumber}</h1>
              <div className="flex gap-1.5 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize border ${STATUS_COLORS[invoice.status] || ""}`}>
                  {invoice.status?.replace("_", " ")}
                </span>
                {archived && (
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-100 text-gray-600">Archived</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
              <Printer className="h-4 w-4" /> Print
            </button>
            <PDFDownloadLink document={<InvoicePDF {...invoiceData} />} fileName={`${invoice.invoiceNumber}.pdf`}>
              {({ loading: pdfLoading }) => (
                <button className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
                  <Download className="h-4 w-4" /> {pdfLoading ? "..." : "PDF"}
                </button>
              )}
            </PDFDownloadLink>
            <button onClick={shareWhatsApp} className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              <Share2 className="h-4 w-4" /> WhatsApp
            </button>
            {invoice.type === "estimate" && invoice.status !== "expired" && (
              <button onClick={convertToInvoice} disabled={converting} className="flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90">
                <RefreshCw className={`h-4 w-4 ${converting ? "animate-spin" : ""}`} /> {converting ? "Converting..." : "Convert to Invoice"}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {STATUSES.map((s) => (
            <button key={s}
              onClick={() => updateStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition-colors ${
                invoice.status === s
                  ? `${STATUS_COLORS[s]} border-current font-medium`
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-12">
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-8" id="invoice-template">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-8 pb-6 border-b border-border">
              <div>
                <img src={logoUrl} alt={shopName} className="h-14 mb-2" />
                <h2 className="text-xl font-bold text-secondary">{shopName}</h2>
                <p className="text-sm text-muted-foreground">{shopTagline}</p>
                {shopAddress && <p className="text-sm text-muted-foreground">{shopAddress}</p>}
              </div>
              <div className="sm:text-right">
                <h1 className="text-3xl font-bold text-primary mb-1">
                  {invoice.type === "invoice" ? "INVOICE" : "ESTIMATE"}
                </h1>
                <p className="text-sm text-muted-foreground">#{invoice.invoiceNumber}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-8">
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

            {/* Mobile card layout */}
            <div className="grid grid-cols-1 gap-3 sm:hidden mb-6">
              {invoice.items.map((item, i) => (
                <div key={i} className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-sm">
                  <div className="font-medium text-secondary">{item.productName}</div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <span>Wt: <strong>{item.weight}g</strong></span>
                    <span>Qty: <strong>{item.quantity}</strong></span>
                    <span>Rate: <strong>{formatCurrency(item.unitPrice)}</strong></span>
                  </div>
                  <div className="text-right text-sm font-semibold text-secondary pt-1 border-t border-border/50">
                    {formatCurrency(item.subtotal)}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <table className="hidden sm:table w-full text-sm mb-8">
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
                <p className="text-blue-600 text-xs mt-1">
                  {invoice.couponIssued.discountType === "percentage"
                    ? `${invoice.couponIssued.discountValue}% off`
                    : `Rs. ${invoice.couponIssued.discountValue} off`}
                  {invoice.couponIssued.terms ? ` · ${invoice.couponIssued.terms}` : ""}
                </p>
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
              <p>Thank you for your business! ΓÇó {shopName}</p>
              {shopAddress && <p>{shopAddress}</p>}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
