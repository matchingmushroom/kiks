"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { Chart, BarController, BarElement, CategoryScale, LinearScale, PieController, ArcElement, Tooltip, Legend } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { Sale, Purchase, Product, Category } from "@/types";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Send, Loader2, X, Download } from "lucide-react";
import PartnerReportPDF from "./PartnerReportPDF";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, PieController, ArcElement, Tooltip, Legend, ChartDataLabels);

function getMonthStart(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function getYearStart(): number {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).getTime();
}

function getDayStart(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function last30Days(): { start: number; days: string[] } {
  const days: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }));
  }
  return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime(), days };
}

interface PartnerReportProps {
  partnerEmails: string[];
  onClose: () => void;
}

export default function PartnerReport({ partnerEmails, onClose }: PartnerReportProps) {
  const { settings } = useShopSettings();
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [barChartUrl, setBarChartUrl] = useState<string | null>(null);
  const [pieChartUrl, setPieChartUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const pieRef = useRef<HTMLCanvasElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [saleSnap, purchaseSnap, prodSnap, catSnap] = await Promise.all([
          getDocs(collection(db, "sales")),
          getDocs(collection(db, "purchases")),
          getDocs(collection(db, "products")),
          getDocs(collection(db, "categories")),
        ]);
        const toMs = (v: unknown): number =>
          v && typeof v === "object" && "seconds" in v
            ? (v as { seconds: number; nanoseconds: number }).seconds * 1000
            : (v as number);
        setSales(saleSnap.docs.map((d) => {
          const data = d.data();
          return { ...data, id: d.id, createdAt: toMs(data.createdAt), saleDate: toMs(data.saleDate) } as Sale;
        }));
        setPurchases(purchaseSnap.docs.map((d) => {
          const data = d.data();
          return { ...data, id: d.id, createdAt: toMs(data.createdAt) } as Purchase;
        }));
        setProducts(prodSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Product)));
        setCategories(catSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Category)));
      } catch (e) {
        console.error("Failed to fetch report data", e);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (loading) return;
    renderCharts();
  }, [loading, sales, purchases, products]);

  const computeSaleTotal = (s: Sale[]) =>
    s.reduce((sum, sale) => sum + (sale.items || []).reduce((s2, it) => s2 + (it.subtotal || it.unitPrice * it.quantity || 0), 0), 0);

  const todayStart = getDayStart();
  const monthStart = getMonthStart();
  const yearStart = getYearStart();
  const { start: monthAgo, days: dayLabels } = last30Days();

  const todaySales = sales.filter((s) => (s.createdAt as number) >= todayStart);
  const mtdSales = sales.filter((s) => (s.createdAt as number) >= monthStart);
  const ytdSales = sales.filter((s) => (s.createdAt as number) >= yearStart);

  const todaySaleTotal = computeSaleTotal(todaySales);
  const mtdSaleTotal = computeSaleTotal(mtdSales);
  const ytdSaleTotal = computeSaleTotal(ytdSales);

  const todayPurchases = purchases.filter((p) => (p.createdAt as number) >= todayStart);
  const mtdPurchases = purchases.filter((p) => (p.createdAt as number) >= monthStart);
  const ytdPurchases = purchases.filter((p) => (p.createdAt as number) >= yearStart);

  const todayPurchaseTotal = todayPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const mtdPurchaseTotal = mtdPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const ytdPurchaseTotal = ytdPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

  const costPrice = (p: Product) => p.costPrice || p.price || 0;
  const inventoryValue = products.reduce((sum, p) => sum + costPrice(p) * (p.quantityInStock || 0), 0);

  const inventoryByCategory: { name: string; value: number; color: string }[] = [];
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];
  let catIdx = 0;
  for (const p of products) {
    const cat = catMap.get(p.categoryId);
    const catName = cat?.name || "Uncategorized";
    const existing = inventoryByCategory.find((c) => c.name === catName);
    const val = costPrice(p) * (p.quantityInStock || 0);
    if (existing) {
      existing.value += val;
    } else {
      inventoryByCategory.push({ name: catName, value: val, color: colors[catIdx % colors.length] });
      catIdx++;
    }
  }
  inventoryByCategory.sort((a, b) => b.value - a.value);

  const dailySalesData = dayLabels.map((_, i) => {
    const dayStart = monthAgo + i * 86400000;
    const dayEnd = dayStart + 86400000;
    const daySales = sales.filter((s) => {
      const t = s.createdAt as number;
      return t >= dayStart && t < dayEnd;
    });
    return computeSaleTotal(daySales);
  });

  const netToday = todaySaleTotal - todayPurchaseTotal;
  const netMtd = mtdSaleTotal - mtdPurchaseTotal;
  const netYtd = ytdSaleTotal - ytdPurchaseTotal;

  const captureCharts = useCallback(() => {
    if (!barChartUrl && chartRef.current) {
      setBarChartUrl(chartRef.current.toDataURL("image/png"));
    }
    if (!pieChartUrl && pieRef.current) {
      setPieChartUrl(pieRef.current.toDataURL("image/png"));
    }
  }, [barChartUrl, pieChartUrl]);

  useEffect(() => {
    if (barChartUrl && pieChartUrl) {
      generatePdfBlob();
    }
  }, [barChartUrl, pieChartUrl]);

  function renderCharts() {
    setTimeout(() => {
      if (chartRef.current) {
        const ctx = chartRef.current.getContext("2d");
        if (ctx) {
          new Chart(ctx, {
            type: "bar",
            data: {
              labels: dayLabels.filter((_, i) => i % 5 === 0 || i === dayLabels.length - 1),
              datasets: [{
                label: "Daily Sales (Rs.)",
                data: dailySalesData.filter((_, i) => i % 5 === 0 || i === dayLabels.length - 1),
                backgroundColor: "#3b82f6",
                borderRadius: 4,
              }],
            },
              options: {
              responsive: true,
              maintainAspectRatio: true,
              animation: false,
              plugins: {
                legend: { display: false },
                datalabels: {
                  anchor: "end",
                  align: "end",
                  color: "#1e3a5f",
                  font: { weight: "bold", size: 9 },
                  formatter: (v) => "Rs. " + formatNumber(v),
                },
              },
              scales: { y: { beginAtZero: true, ticks: { callback: (v) => "Rs." + formatNumber(v as number) } } },
            },
          });
        }
      }
      if (pieRef.current) {
        const ctx = pieRef.current.getContext("2d");
        if (ctx) {
          new Chart(ctx, {
            type: "pie",
            data: {
              labels: inventoryByCategory.slice(0, 8).map((c) => c.name),
              datasets: [{
                data: inventoryByCategory.slice(0, 8).map((c) => c.value),
                backgroundColor: inventoryByCategory.slice(0, 8).map((c) => c.color),
              }],
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              animation: false,
              plugins: {
                legend: { position: "bottom", labels: { boxWidth: 12, padding: 8, font: { size: 9 } } },
              },
            },
          });
        }
      }
      setTimeout(captureCharts, 200);
    }, 300);
  }

  const pdfDocProps = {
    logoUrl: settings.logoUrl || "/logo.svg",
    shopName: settings.shopName || "Shop Report",
    tagline: settings.tagline || "",
    period: new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }),
    todaySale: todaySaleTotal,
    mtdSale: mtdSaleTotal,
    ytdSale: ytdSaleTotal,
    todayPurchase: todayPurchaseTotal,
    mtdPurchase: mtdPurchaseTotal,
    ytdPurchase: ytdPurchaseTotal,
    netToday,
    netMtd,
    netYtd,
    inventoryValue,
    inventoryByCategory: inventoryByCategory.map((c) => ({ name: c.name, value: c.value })),
    barChartUrl: barChartUrl || undefined,
    pieChartUrl: pieChartUrl || undefined,
  };

  async function generatePdfBlob() {
    try {
      const blob = await pdf(<PartnerReportPDF {...pdfDocProps} />).toBlob();
      setPdfBlob(blob);
    } catch (e) {
      console.error("PDF generation failed", e);
    }
  }

  const handleDownload = async () => {
    let blob = pdfBlob;
    if (!blob) {
      if (barChartUrl && pieChartUrl) {
        blob = await pdf(<PartnerReportPDF {...pdfDocProps} />).toBlob();
        setPdfBlob(blob);
      }
    }
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `partner-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSend = async () => {
    let blob = pdfBlob;
    if (!blob) {
      if (barChartUrl && pieChartUrl) {
        blob = await pdf(<PartnerReportPDF {...pdfDocProps} />).toBlob();
        setPdfBlob(blob);
      }
    }
    if (!blob || partnerEmails.length === 0) return;
    setSending(true);
    try {
      const toBase64 = (b: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(b);
        });
      const base64 = await toBase64(blob);
      const webhookUrl = settings.gasWebhookUrl || "";
      if (!webhookUrl) {
        handleDownload();
        setSent(true);
        setSending(false);
        return;
      }
      const res = await fetch(webhookUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "sendPartnerReport",
          pdfBase64: base64,
          partnerEmails,
          shopName: settings.shopName,
          period: new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }),
        }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const result = await res.json();
      if (result.status !== "ok") throw new Error(result.message || "Unknown error");
      setSent(true);
    } catch (e) {
      console.error("Send failed", e);
      alert("Failed to send report. " + (e instanceof Error ? e.message : "Check GAS webhook URL in settings."));
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-secondary">Partner Report</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="bg-white border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      <th className="text-left px-3 py-2 text-xs font-semibold">Metric</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold">Today</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold">This Month</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold">This Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border">
                      <td className="px-3 py-2 font-medium text-muted-foreground">Sales</td>
                      <td className="px-3 py-2 text-right font-semibold text-blue-700">Rs. {formatNumber(todaySaleTotal)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-blue-700">Rs. {formatNumber(mtdSaleTotal)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-blue-700">Rs. {formatNumber(ytdSaleTotal)}</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-3 py-2 font-medium text-muted-foreground">Purchases</td>
                      <td className="px-3 py-2 text-right font-semibold text-orange-700">Rs. {formatNumber(todayPurchaseTotal)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-orange-700">Rs. {formatNumber(mtdPurchaseTotal)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-orange-700">Rs. {formatNumber(ytdPurchaseTotal)}</td>
                    </tr>
                    <tr className="border-t border-border bg-muted/20">
                      <td className="px-3 py-2 font-semibold text-secondary">Net</td>
                      <td className={`px-3 py-2 text-right font-bold ${netToday >= 0 ? "text-green-700" : "text-red-700"}`}>Rs. {formatNumber(netToday)}</td>
                      <td className={`px-3 py-2 text-right font-bold ${netMtd >= 0 ? "text-green-700" : "text-red-700"}`}>Rs. {formatNumber(netMtd)}</td>
                      <td className={`px-3 py-2 text-right font-bold ${netYtd >= 0 ? "text-green-700" : "text-red-700"}`}>Rs. {formatNumber(netYtd)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div ref={reportRef} className="space-y-4">
                <div className="bg-white border border-border rounded-xl p-4">
                  <p className="text-sm font-semibold text-secondary mb-3">Sales Trend (Last 30 Days)</p>
                  <canvas ref={chartRef} height="160" />
                </div>

                <div className="bg-white border border-border rounded-xl p-4">
                  <p className="text-sm font-semibold text-secondary mb-3">Inventory by Category (at Cost)</p>
                  <div className="overflow-x-auto mb-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Category</th>
                          <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">Value</th>
                          <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryByCategory.slice(0, 10).map((c) => (
                          <tr key={c.name} className="border-t border-border">
                            <td className="px-2 py-1.5">
                              <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ backgroundColor: c.color }} />
                              {c.name}
                            </td>
                            <td className="px-2 py-1.5 text-right font-medium">Rs. {formatNumber(c.value)}</td>
                            <td className="px-2 py-1.5 text-right text-muted-foreground">{((c.value / (inventoryValue || 1)) * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-secondary font-semibold">
                          <td className="px-2 py-1.5">Total</td>
                          <td className="px-2 py-1.5 text-right text-green-700">Rs. {formatNumber(inventoryValue)}</td>
                          <td className="px-2 py-1.5 text-right">100%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <canvas ref={pieRef} height="180" />
                </div>
              </div>

              {partnerEmails.length > 0 && (
                <div className="bg-muted/30 rounded-xl p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Sending to: {partnerEmails.join(", ")}</p>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border shrink-0">
          <Button onClick={onClose} variant="outline">Close</Button>
          <Button onClick={handleDownload} disabled={!pdfBlob} variant="outline">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          {partnerEmails.length > 0 && (
            <Button onClick={handleSend} disabled={sending || !pdfBlob || sent} variant="accent">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : sent ? "Sent!" : <Send className="h-4 w-4" />}
              {sending ? " Sending..." : sent ? " Report Sent" : " Send to Partners"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
