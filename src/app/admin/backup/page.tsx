"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import {
  Download, FileSpreadsheet, FileArchive, Mail, FolderOpen,
  ChevronDown, ChevronUp, Calendar,
} from "lucide-react";
import {
  exportCollection, exportCollectionsAsZip, downloadBlob,
  generateSalesReport, generateProductReport, generateDebtorReport,
  reportToCSV, type ReportData,
} from "@/lib/export";
import { getDocs, collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";


const COLLECTIONS = [
  { id: "users", label: "Users" },
  { id: "products", label: "Products" },
  { id: "categories", label: "Categories" },
  { id: "orders", label: "Orders" },
  { id: "sales", label: "Sales" },
  { id: "invoices", label: "Invoices" },
  { id: "debtors", label: "Debtors" },
  { id: "coupons", label: "Coupons" },
  { id: "inventory_logs", label: "Inventory Logs" },
  { id: "sections", label: "Homepage Sections" },
  { id: "shop_settings", label: "Shop Settings" },
];

const today = new Date();
const startOfYear = new Date(today.getFullYear(), 0, 1);
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

export default function AdminBackupPage() {
  const [selected, setSelected] = useState<string[]>(["products", "orders", "sales", "invoices", "debtors"]);
  const [exporting, setExporting] = useState("");
  const [reportType, setReportType] = useState<"ytd" | "mtd" | "custom">("ytd");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState(today.toISOString().slice(0, 10));
  const [report, setReport] = useState<ReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [showDriveGuide, setShowDriveGuide] = useState(false);

  const toggleColl = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSingleExport = async (name: string, label: string) => {
    setExporting(name);
    try {
      const csv = await exportCollection(name);
      downloadBlob(new Blob([csv], { type: "text/csv" }), `${name}.csv`);
    } catch (e) {
      console.error(e);
    }
    setExporting("");
  };

  const handleZipExport = async () => {
    if (selected.length === 0) return;
    setExporting("zip");
    try {
      const blob = await exportCollectionsAsZip(selected);
      const date = today.toISOString().slice(0, 10);
      downloadBlob(blob, `as-collection-backup-${date}.zip`);
    } catch (e) {
      console.error(e);
    }
    setExporting("");
  };

  useEffect(() => {
    if (customStart && customEnd) {
      setReportType("custom");
    }
  }, [customStart, customEnd]);

  const generateReport = async () => {
    setLoadingReport(true);
    setReport(null);
    try {
      let start: number;
      let end = today.getTime();

      if (reportType === "ytd") {
        start = startOfYear.getTime();
      } else if (reportType === "mtd") {
        start = startOfMonth.getTime();
      } else {
        start = new Date(customStart).getTime();
        end = new Date(customEnd).getTime() + 86400000;
      }

      const q = query(collection(db, "sales"), orderBy("saleDate", "desc"));
      const snap = await getDocs(q);
      const salesRaw = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];

      const salesReport = generateSalesReport(salesRaw, start, end);
      const productReport = generateProductReport(salesRaw.filter((s) => {
        const date = s.saleDate as number;
        return date >= start && date <= end;
      }));

      const debtSnap = await getDocs(collection(db, "debtors"));
      const debtors = debtSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const debtorReport = generateDebtorReport(debtors);

      const combined: ReportData = {
        title: `${process.env.NEXT_PUBLIC_SHOP_NAME || "KIKS Collections"} Report - ${new Date(start).toISOString().slice(0, 10)} to ${new Date(end).toISOString().slice(0, 10)}`,
        headers: [],
        rows: [],
      };

      combined.headers = [""];
      combined.rows = [
        ["--- SALES SUMMARY ---", ""],
        ...salesReport.headers.map((h, i) => [h, salesReport.rows[i]?.[1] || ""]),
        [],
        ["--- PRODUCT PERFORMANCE ---", "", ""],
        ...productReport.headers.map((h) => [h]),
        ...productReport.rows,
        [],
        ["--- DEBTORS ---", "", ""],
        ...debtorReport.headers.map((h) => [h]),
        ...debtorReport.rows,
      ];

      setReport(combined);
    } catch (e) {
      console.error(e);
    }
    setLoadingReport(false);
  };

  const handleDownloadReport = () => {
    if (!report) return;
    const csv = reportToCSV(report);
    const date = today.toISOString().slice(0, 10);
    downloadBlob(new Blob([csv], { type: "text/csv" }), `as-collection-report-${date}.csv`);
  };

  const handleEmailBackup = () => {
    const subject = encodeURIComponent(`${process.env.NEXT_PUBLIC_SHOP_NAME || "KIKS Collections"} Backup`);
    const body = encodeURIComponent(
      "Please run CSV backup from the admin dashboard and attach the generated files.\n\n" +
      "To set up automated email backup:\n" +
      "1. Create an EmailJS account (https://www.emailjs.com/)\n" +
      "2. Add your SMTP or email service\n" +
      "3. Update the .env.local with EmailJS credentials\n" +
      "4. The backup page will then support one-click email sending."
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-secondary mb-6">Backup & Reports</h1>

        {/* ============ CSV BACKUP ============ */}
        <section className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-secondary mb-4 flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-primary" /> CSV Backup
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Select collections to export. Download individually or as a single ZIP file.
          </p>

          <div className="flex flex-wrap gap-2 mb-5">
            {COLLECTIONS.map((c) => (
              <button key={c.id}
                onClick={() => toggleColl(c.id)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  selected.includes(c.id)
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-muted-foreground border-border hover:border-primary"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleZipExport} disabled={exporting === "zip" || selected.length === 0} variant="accent">
              <FileArchive className="h-4 w-4" /> {exporting === "zip" ? "Zipping..." : "Download ZIP"}
            </Button>
            {COLLECTIONS.map((c) => (
              <Button key={c.id} onClick={() => handleSingleExport(c.id, c.label)}
                disabled={exporting === c.id} variant="outline" size="sm">
                <FileSpreadsheet className="h-3.5 w-3.5" /> {exporting === c.id ? "..." : c.label}
              </Button>
            ))}
          </div>
        </section>

        {/* ============ REPORTS ============ */}
        <section className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-secondary mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Reports
          </h2>

          <div className="flex flex-wrap items-center gap-3 mb-5">
            {(["ytd", "mtd", "custom"] as const).map((t) => (
              <button key={t}
                onClick={() => { setReportType(t); setReport(null); }}
                className={`px-3 py-1.5 text-xs rounded-full border capitalize ${
                  reportType === t
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-muted-foreground border-border"
                }`}
              >
                {t === "ytd" ? "Year to Date" : t === "mtd" ? "Month to Date" : "Custom Range"}
              </button>
            ))}
            {reportType === "custom" && (
              <>
                <input type="date" value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-1.5 border border-border rounded-lg text-sm" />
                <span className="text-muted-foreground text-sm">to</span>
                <input type="date" value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-1.5 border border-border rounded-lg text-sm" />
              </>
            )}
          </div>

          <Button onClick={generateReport} disabled={loadingReport || (reportType === "custom" && !customStart)} variant="accent">
            <Calendar className="h-4 w-4" /> {loadingReport ? "Generating..." : "Generate Report"}
          </Button>

          {report && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-secondary">{report.title}</h3>
                <Button onClick={handleDownloadReport} variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5" /> Download CSV
                </Button>
              </div>
              <div className="max-h-96 overflow-auto border border-border rounded-lg">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-border">
                    {report.rows.map((row, i) => {
                      if (row.length === 0) return <tr key={i} className="h-2" />;
                      const isSection = row[0].startsWith("---");
                      return (
                        <tr key={i} className={isSection ? "bg-muted font-semibold" : "hover:bg-muted/50"}>
                          {row.map((cell, j) => (
                            <td key={j} className={`px-3 py-1.5 ${isSection ? "text-secondary" : ""}`}>{cell}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ============ EMAIL BACKUP ============ */}
        <section className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-secondary mb-4 flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Email Backup
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Download the ZIP backup from above, then send it via email. For one-click automated email backup,
            set up <a href="https://www.emailjs.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">EmailJS</a> and add your credentials to <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.local</code>.
          </p>
          <Button onClick={handleEmailBackup} variant="outline">
            <Mail className="h-4 w-4" /> Open Email Client
          </Button>
        </section>

        {/* ============ GOOGLE DRIVE ============ */}
        <section className="bg-white border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-secondary mb-4 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" /> Google Drive Backup
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Optional: automatically sync CSV backups to Google Drive.
          </p>

          <button onClick={() => setShowDriveGuide(!showDriveGuide)}
            className="flex items-center gap-1 text-sm text-primary hover:underline mb-3">
            {showDriveGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showDriveGuide ? "Hide Setup Guide" : "Show Setup Guide"}
          </button>

          {showDriveGuide && (
            <div className="bg-muted/50 p-4 rounded-lg text-xs text-secondary space-y-2 leading-relaxed">
              <p><strong>Option 1: Google Apps Script (Recommended)</strong></p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Go to <a href="https://script.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">script.google.com</a> and create a new project</li>
                <li>Deploy as a web app (Execute as: Me, Access: Anyone)</li>
                <li>Copy the web app URL</li>
                <li>Run the ZIP export from this page</li>
                <li>Upload the ZIP to the script URL programmatically</li>
              </ol>
              <p className="mt-2"><strong>Option 2: rclone (Manual Sync)</strong></p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Install <a href="https://rclone.org/" target="_blank" rel="noopener noreferrer" className="text-primary underline">rclone</a></li>
                <li>Configure Google Drive: <code className="bg-muted px-1 rounded">rclone config</code></li>
                <li>Create a sync script to upload <code className="bg-muted px-1 rounded">*.zip</code> files to Drive</li>
              </ol>
              <p className="mt-3 text-muted-foreground">
                Full walkthrough: <a href="https://opencode.ai" target="_blank" rel="noopener noreferrer" className="text-primary underline">View Docs</a>
              </p>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
