import { getDocs, collection } from "firebase/firestore";
import { db } from "./firebase";
import JSZip from "jszip";
import type { Sale, Purchase, Order, Product, Debtor, Creditor, Expense } from "@/types";
import { toDate } from "@/lib/utils";

function fmt(n: unknown): string {
  if (n === null || n === undefined) return "";
  const v = typeof n === "number" ? n : Number(n);
  return isNaN(v) ? "" : v.toFixed(2);
}

function esc(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function itemsSummary(items: { productName?: string; quantity?: number }[]): string {
  return items.map((i) => `${i.quantity || 1}x${i.productName || ""}`).join("; ");
}

function toCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const lines = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(",")
    ),
  ];
  return lines.join("\n");
}

function flattenDoc(doc: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = { id: doc.id };
  for (const [key, val] of Object.entries(doc)) {
    if (key === "id") continue;
    if (val && typeof val === "object" && "toDate" in (val as object)) {
      flat[key] = (val as { toDate: () => Date }).toDate().toISOString();
    } else if (val && typeof val === "object" && "seconds" in (val as object)) {
      flat[key] = new Date((val as { seconds: number }).seconds * 1000).toISOString();
    } else if (Array.isArray(val)) {
      flat[key] = JSON.stringify(val);
    } else if (val && typeof val === "object") {
      flat[key] = JSON.stringify(val);
    } else {
      flat[key] = val;
    }
  }
  return flat;
}

export async function exportCollection(collectionName: string): Promise<string> {
  const snap = await getDocs(collection(db, collectionName));
  const data = snap.docs.map((d) => flattenDoc({ id: d.id, ...d.data() }));
  return toCSV(data);
}

export async function exportCollectionsAsZip(
  names: string[]
): Promise<Blob> {
  const zip = new JSZip();
  for (const name of names) {
    try {
      const csv = await exportCollection(name);
      if (csv) {
        zip.file(`${name}.csv`, csv);
      }
    } catch {
      zip.file(`${name}.csv`, "Error exporting this collection");
    }
  }
  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ReportData {
  title: string;
  headers: string[];
  rows: string[][];
}

export function generateSalesReport(
  sales: Record<string, unknown>[],
  startDate: number,
  endDate: number
): ReportData {
  const filtered = sales.filter((s) => {
    const date = s.saleDate as number;
    return date >= startDate && date <= endDate;
  });

  const totalRevenue = filtered.reduce((sum, s) => sum + ((s.finalAmount as number) || 0), 0);
  const totalDiscount = filtered.reduce((sum, s) => sum + ((s.discountAmount as number) || 0), 0);
  const orderCount = filtered.length;

  const headers = ["Metric", "Value"];
  const rows = [
    ["Period Start", new Date(startDate).toISOString().slice(0, 10)],
    ["Period End", new Date(endDate).toISOString().slice(0, 10)],
    ["Total Sales", totalRevenue.toFixed(2)],
    ["Total Discount", totalDiscount.toFixed(2)],
    ["Net Revenue", (totalRevenue - totalDiscount).toFixed(2)],
    ["Number of Orders", orderCount.toString()],
    ["Avg Order Value", orderCount > 0 ? (totalRevenue / orderCount).toFixed(2) : "0"],
  ];

  return { title: "Sales Summary Report", headers, rows };
}

export function generateProductReport(
  sales: Record<string, unknown>[]
): ReportData {
  const productMap = new Map<string, { qty: number; revenue: number }>();

  for (const sale of sales) {
    const items = sale.items as Array<{
      productName: string;
      quantity: number;
      subtotal: number;
    }> | undefined;
    if (items) {
      for (const item of items) {
        const prev = productMap.get(item.productName) || { qty: 0, revenue: 0 };
        productMap.set(item.productName, {
          qty: prev.qty + (item.quantity || 0),
          revenue: prev.revenue + (item.subtotal || 0),
        });
      }
    }
  }

  const sorted = Array.from(productMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  const headers = ["Product", "Quantity Sold", "Revenue"];
  const rows = sorted.map((p) => [p.name, p.qty.toString(), p.revenue.toFixed(2)]);

  return { title: "Product Performance Report", headers, rows };
}

export function generateDebtorReport(
  debtors: Record<string, unknown>[]
): ReportData {
  const active = debtors.filter((d) => d.status === "active");
  const headers = ["Customer", "Phone", "Total Amount", "Paid", "Balance Due", "Status"];
  const rows = active.map((d) => [
    (d.customerName as string) || "",
    (d.customerPhone as string) || "",
    ((d.totalAmount as number) || 0).toFixed(2),
    ((d.amountPaid as number) || 0).toFixed(2),
    ((d.balanceDue as number) || 0).toFixed(2),
    (d.status as string) || "",
  ]);

  return { title: "Debtors Report", headers, rows };
}

export function reportToCSV(report: ReportData): string {
  const lines = [
    report.title,
    "",
    report.headers.join(","),
    ...report.rows.map((r) =>
      r.map((v) => (v.includes(",") ? `"${v}"` : v)).join(",")
    ),
  ];
  return lines.join("\n");
}

// ── Full-data CSV generators (for per-module download / email) ──

export function exportSalesCSV(sales: Sale[]): string {
  const headers = "id,saleDate,Customer Name,Customer Phone,Items,Total Amount,Discount,Final Amount,Payment Method,Received,Balance Due,Warranty,Coupon Code,Notes,Recorded By";
  const rows = sales.map((s) => [
    esc(s.id),
    esc(toDate(s.saleDate).toISOString().slice(0, 10)),
    esc(s.customer?.name),
    esc(s.customer?.phone),
    esc(itemsSummary(s.items)),
    fmt(s.totalAmount),
    fmt(s.discountAmount),
    fmt(s.finalAmount),
    esc(s.payment?.method),
    fmt(s.payment?.receivedAmount),
    fmt(s.payment?.balanceDue),
    esc(s.warranty?.period),
    esc(s.couponIssued?.code),
    esc(s.notes),
    esc(s.recordedByName),
  ].join(",")).join("\n");
  return `${headers}\n${rows}`;
}

export function exportPurchasesCSV(purchases: Purchase[]): string {
  const headers = "id,purchaseDate,Supplier,Phone,Items,Total Amount,Paid,Balance Due,Payment Status,Notes,Recorded By";
  const rows = purchases.map((p) => [
    esc(p.id),
    esc(toDate(p.purchaseDate).toISOString().slice(0, 10)),
    esc(p.supplierName),
    esc(p.supplierPhone),
    esc(itemsSummary(p.items)),
    fmt(p.totalAmount),
    fmt(p.paidAmount),
    fmt((p.totalAmount || 0) - (p.paidAmount || 0)),
    esc(p.paymentStatus),
    esc(p.notes),
    esc(p.recordedByName),
  ].join(",")).join("\n");
  return `${headers}\n${rows}`;
}

export function exportOrdersCSV(orders: Order[]): string {
  const headers = "id,orderNumber,Date,Customer Name,Phone,Items,Total Amount,Status,Coupon Code,Notes,Processed By";
  const rows = orders.map((o) => [
    esc(o.id),
    esc(o.orderNumber),
    esc(toDate(o.createdAt).toISOString().slice(0, 10)),
    esc(o.customer?.name),
    esc(o.customer?.phone),
    esc(itemsSummary(o.items)),
    fmt(o.totalAmount),
    esc(o.status),
    esc(o.couponApplied?.code),
    esc(o.notes),
    esc(o.processedBy),
  ].join(",")).join("\n");
  return `${headers}\n${rows}`;
}

export function exportInventoryCSV(products: Product[]): string {
  const headers = "id,Name,SKU,Model Code,Brand,Quantity In Stock,Cost Price,Sales Price,Weight,Purity,Metal Type,Is Active";
  const rows = products.map((p) => [
    esc(p.id),
    esc(p.name),
    esc(p.sku),
    esc(p.modelCode),
    esc(p.brand),
    String(p.quantityInStock ?? 0),
    fmt(p.costPrice),
    fmt(p.price),
    fmt(p.weight),
    esc(p.purity),
    esc(p.metalType),
    p.isActive ? "Yes" : "No",
  ].join(",")).join("\n");
  return `${headers}\n${rows}`;
}

export function exportDebtorsCSV(debtors: Debtor[]): string {
  const headers = "id,Customer Name,Phone,Total Amount,Amount Paid,Balance Due,Due Date,Status";
  const rows = debtors.map((d) => [
    esc(d.id),
    esc(d.customerName),
    esc(d.customerPhone),
    fmt(d.totalAmount),
    fmt(d.amountPaid),
    fmt(d.balanceDue),
    esc(toDate(d.dueDate).toISOString().slice(0, 10)),
    esc(d.status),
  ].join(",")).join("\n");
  return `${headers}\n${rows}`;
}

export function exportCreditorsCSV(creditors: Creditor[]): string {
  const headers = "id,Supplier Name,Phone,Total Amount,Amount Paid,Balance Due,Due Date,Status,Last Transaction Date";
  const rows = creditors.map((c) => [
    esc(c.id),
    esc(c.supplierName),
    esc(c.supplierPhone),
    fmt(c.totalAmount),
    fmt(c.amountPaid),
    fmt(c.balanceDue),
    esc(toDate(c.dueDate).toISOString().slice(0, 10)),
    esc(c.status),
    esc(c.lastTransactionDate ? toDate(c.lastTransactionDate).toISOString().slice(0, 10) : ""),
  ].join(",")).join("\n");
  return `${headers}\n${rows}`;
}

export function exportExpensesCSV(expenses: Expense[]): string {
  const headers = "id,Date,Title,Amount,Head,Payment Method,Description,Recorded By";
  const rows = expenses.map((e) => [
    esc(e.id),
    esc(toDate(e.date).toISOString().slice(0, 10)),
    esc(e.title),
    fmt(e.amount),
    esc(e.head),
    esc(e.paymentMethod),
    esc(e.description),
    esc(e.recordedBy),
  ].join(",")).join("\n");
  return `${headers}\n${rows}`;
}
