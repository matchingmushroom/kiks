"use client";

import { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import { Chart, BarController, BarElement, CategoryScale, LinearScale, PieController, ArcElement, Tooltip, Legend } from "chart.js";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { Sale, Purchase, Product, Category } from "@/types";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FileText, Send, Loader2, X, Download } from "lucide-react";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, PieController, ArcElement, Tooltip, Legend);

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
    generatePdf();
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

  const inventoryValue = products.reduce((sum, p) => sum + (p.price || 0) * (p.quantityInStock || 0), 0);

  const inventoryByCategory: { name: string; value: number; color: string }[] = [];
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];
  let catIdx = 0;
  for (const p of products) {
    const cat = catMap.get(p.categoryId);
    const catName = cat?.name || "Uncategorized";
    const existing = inventoryByCategory.find((c) => c.name === catName);
    const val = (p.price || 0) * (p.quantityInStock || 0);
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

  function renderCharts() {
    setTimeout(async () => {
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
              plugins: { legend: { display: false } },
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
    }, 300);
  }

  async function generatePdf() {
    await new Promise((r) => setTimeout(r, 1500));
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = 190;
    let y = 20;

    const addHeader = () => {
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(settings.shopName || "Shop Report", pageW / 2, y, { align: "center" });
      y += 7;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Partner Report — ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}`, pageW / 2, y, { align: "center" });
      y += 12;
    };
    addHeader();

    const addSection = (title: string) => {
      if (y > 250) { pdf.addPage(); y = 20; addHeader(); }
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 64, 175);
      pdf.text(title, 10, y);
      y += 8;
      pdf.setDrawColor(30, 64, 175);
      pdf.setLineWidth(0.5);
      pdf.line(10, y, pageW + 10, y);
      y += 6;
      pdf.setTextColor(0, 0, 0);
    };

    const addKpi = (label: string, value: string, x: number) => {
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(label, x, y);
      y += 4;
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text(value, x, y);
      y += 8;
    };

    addSection("Sales Summary");
    const kpiX = [10, 75, 140];
    addKpi("Today", `Rs. ${formatNumber(todaySaleTotal)}`, kpiX[0]);
    y = 38;
    addKpi("This Month (MTD)", `Rs. ${formatNumber(mtdSaleTotal)}`, kpiX[1]);
    y = 38;
    addKpi("This Year (YTD)", `Rs. ${formatNumber(ytdSaleTotal)}`, kpiX[2]);
    y = 50;

    if (chartRef.current) {
      const chartImg = chartRef.current.toDataURL("image/png");
      if (y + 55 > 270) { pdf.addPage(); y = 20; }
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("Last 30 Days Sales Trend", 10, y);
      y += 3;
      pdf.addImage(chartImg, "PNG", 10, y, pageW, 50);
      y += 58;
    }

    addSection("Purchase Summary");
    y += 2;
    const kpy2 = y;
    addKpi("Today", `Rs. ${formatNumber(todayPurchaseTotal)}`, kpiX[0]);
    y = kpy2;
    addKpi("This Month (MTD)", `Rs. ${formatNumber(mtdPurchaseTotal)}`, kpiX[1]);
    y = kpy2;
    addKpi("This Year (YTD)", `Rs. ${formatNumber(ytdPurchaseTotal)}`, kpiX[2]);
    y = kpy2 + 14;

    addSection("Inventory Summary");
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Total Inventory Value: Rs. ${formatNumber(inventoryValue)}`, 10, y);
    y += 8;

    if (pieRef.current && inventoryByCategory.length > 0) {
      const pieImg = pieRef.current.toDataURL("image/png");
      if (y + 70 > 270) { pdf.addPage(); y = 20; }
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("Inventory by Category", 10, y);
      y += 3;
      pdf.addImage(pieImg, "PNG", 45, y, 110, 65);
      y += 72;
    }

    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Generated on ${new Date().toLocaleString("en-IN")} | ${settings.shopName}`, pageW / 2, 290, { align: "center" });

    const blob = pdf.output("blob");
    setPdfBlob(blob);
  }

  const handleSend = async () => {
    if (!pdfBlob || partnerEmails.length === 0) return;
    setSending(true);
    try {
      const toBase64 = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      const base64 = await toBase64(pdfBlob);
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

  const handleDownload = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `partner-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
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
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium uppercase">Today Sales</p>
                  <p className="text-xl font-bold text-blue-800 mt-1">Rs. {formatNumber(todaySaleTotal)}</p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
                  <p className="text-xs text-indigo-600 font-medium uppercase">MTD Sales</p>
                  <p className="text-xl font-bold text-indigo-800 mt-1">Rs. {formatNumber(mtdSaleTotal)}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                  <p className="text-xs text-purple-600 font-medium uppercase">YTD Sales</p>
                  <p className="text-xl font-bold text-purple-800 mt-1">Rs. {formatNumber(ytdSaleTotal)}</p>
                </div>
              </div>

              <div ref={reportRef} className="space-y-4">
                <div className="bg-white border border-border rounded-xl p-4">
                  <p className="text-sm font-semibold text-secondary mb-3">Last 30 Days Sales Trend</p>
                  <canvas ref={chartRef} height="180" />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                    <p className="text-xs text-orange-600 font-medium uppercase">Today Purchases</p>
                    <p className="text-xl font-bold text-orange-800 mt-1">Rs. {formatNumber(todayPurchaseTotal)}</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <p className="text-xs text-amber-600 font-medium uppercase">MTD Purchases</p>
                    <p className="text-xl font-bold text-amber-800 mt-1">Rs. {formatNumber(mtdPurchaseTotal)}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                    <p className="text-xs text-yellow-600 font-medium uppercase">YTD Purchases</p>
                    <p className="text-xl font-bold text-yellow-800 mt-1">Rs. {formatNumber(ytdPurchaseTotal)}</p>
                  </div>
                </div>

                <div className="bg-white border border-border rounded-xl p-4">
                  <p className="text-sm font-semibold text-secondary mb-1">Inventory Value</p>
                  <p className="text-2xl font-bold text-green-700">Rs. {formatNumber(inventoryValue)}</p>
                </div>

                <div className="bg-white border border-border rounded-xl p-4">
                  <p className="text-sm font-semibold text-secondary mb-3">Inventory by Category</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {inventoryByCategory.slice(0, 8).map((c) => (
                      <div key={c.name} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="text-muted-foreground">{c.name}</span>
                        <span className="font-medium">Rs. {formatNumber(c.value)}</span>
                      </div>
                    ))}
                  </div>
                  <canvas ref={pieRef} height="200" />
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
