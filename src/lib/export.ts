import { getDocs, collection } from "firebase/firestore";
import { db } from "./firebase";
import JSZip from "jszip";

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
