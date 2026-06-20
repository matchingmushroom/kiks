"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Save, Image, Download, Mail, Database } from "lucide-react";

interface Settings {
  shopName: string;
  tagline: string;
  logoUrl: string;
  phone: string;
  address: string;
  whatsappNumber: string;
  currency: string;
  website: string;
}

interface EmailBackupConfig {
  emailTo: string;
  schedule: "daily" | "weekly" | "monthly" | "manual";
  enabledModules: string[];
  driveBackup: boolean;
  driveFolderId: string;
  gasWebhookUrl: string;
  imageDriveFolderId: string;
  billDriveFolderId: string;
}

const defaults: Settings = {
  shopName: "KIKS Collections",
  tagline: "Exquisite Jewellery Since 2020",
  logoUrl: "/logo.svg",
  phone: "+977-XXXXXXXXX",
  address: "Kathmandu, Nepal",
  whatsappNumber: "977XXXXXXXXX",
  currency: "NPR",
  website: "",
};

const emailDefaults: EmailBackupConfig = {
  emailTo: "",
  schedule: "manual",
  enabledModules: ["sales", "purchases", "orders", "inventory", "debtors", "creditors", "expenses"],
  driveBackup: false,
  driveFolderId: "",
  gasWebhookUrl: "",
  imageDriveFolderId: "",
  billDriveFolderId: "",
};

const ALL_MODULES = [
  { key: "sales", label: "Sales" },
  { key: "purchases", label: "Purchases" },
  { key: "orders", label: "Orders" },
  { key: "inventory", label: "Inventory" },
  { key: "debtors", label: "Debtors" },
  { key: "creditors", label: "Creditors" },
  { key: "expenses", label: "Expenses" },
];

const SCHEDULES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "manual", label: "Manual (trigger only)" },
];

function toggleModule(modules: string[], key: string): string[] {
  return modules.includes(key) ? modules.filter((m) => m !== key) : [...modules, key];
}

export default function SettingsPage() {
  const [form, setForm] = useState<Settings>(defaults);
  const [emailConfig, setEmailConfig] = useState<EmailBackupConfig>(emailDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveStatus, setArchiveStatus] = useState<string | null>(null);

  const runArchive = async () => {
    if (!emailConfig.gasWebhookUrl) { alert("Configure GAS Webhook URL first."); return; }
    if (!emailConfig.driveFolderId) { alert("Configure Drive Folder ID first."); return; }
    setArchiving(true);
    setArchiveStatus(null);
    try {
      const res = await fetch(emailConfig.gasWebhookUrl, {
        method: "POST",
        body: JSON.stringify({ action: "archiveToSheet", driveFolderId: emailConfig.driveFolderId }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        const counts = Object.entries(data.archived || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
        setArchiveStatus(`Archived: ${counts || "0 records"}`);
      } else {
        setArchiveStatus("Archive failed: " + (data.message || "Unknown error"));
      }
    } catch (e: any) {
      setArchiveStatus("Error: " + (e.message || e));
    }
    setArchiving(false);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "shop_settings", "config"));
        if (snap.exists()) {
          setForm({ ...defaults, ...snap.data() } as Settings);
        }
        const emailSnap = await getDoc(doc(db, "shop_settings", "emailBackupConfig"));
        if (emailSnap.exists()) {
          setEmailConfig({ ...emailDefaults, ...emailSnap.data() } as EmailBackupConfig);
        }
      } catch {
        /* use defaults */
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, "shop_settings", "config"), form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error("Save failed", e);
    }
    setSaving(false);
  };

  const handleEmailSave = async () => {
    setEmailSaving(true);
    setEmailSaved(false);
    try {
      await setDoc(doc(db, "shop_settings", "emailBackupConfig"), emailConfig);
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 3000);
    } catch (e) {
      console.error("Email config save failed", e);
    }
    setEmailSaving(false);
  };

  const downloadGASScript = () => {
    const link = document.createElement("a");
    link.href = "/scripts/gas-backup.gs";
    link.download = "gas-backup.gs";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <AdminLayout>
        <LoadingSpinner text="Loading settings..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold text-secondary">Shop Settings</h1>

        {/* ── Shop Settings ── */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 pb-6 border-b border-border">
            <div className="w-20 h-20 bg-muted rounded-xl overflow-hidden flex-shrink-0 border border-border">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Image className="h-6 w-6" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Logo URL</label>
              <input
                type="text" value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                placeholder="/logo.svg"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">Upload PNG to <code>/public/</code> or use external URL</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Shop Name</label>
              <input type="text" value={form.shopName}
                onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tagline</label>
              <input type="text" value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
              <input type="text" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                minLength={6}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">WhatsApp Number</label>
              <input type="text" value={form.whatsappNumber}
                onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                minLength={10}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="977XXXXXXXXX" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
              <input type="text" value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Address</label>
              <input type="text" value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Website URL</label>
              <input type="url" value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <p className="text-xs text-muted-foreground mt-1">Used in coupon terms and public links</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <Button onClick={handleSave} disabled={saving} variant="accent">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Settings"}
            </Button>
            {saved && (
              <span className="text-sm text-green-600">Settings saved!</span>
            )}
          </div>
        </div>

        {/* ── Email & Backup ── */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-secondary">Email & Backup</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Send Report To</label>
            <input type="email" value={emailConfig.emailTo}
              onChange={(e) => setEmailConfig({ ...emailConfig, emailTo: e.target.value })}
              placeholder="admin@example.com"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Schedule</label>
            <div className="flex flex-wrap gap-3">
              {SCHEDULES.map((s) => (
                <label key={s.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="schedule" value={s.value}
                    checked={emailConfig.schedule === s.value}
                    onChange={(e) => setEmailConfig({ ...emailConfig, schedule: e.target.value as EmailBackupConfig["schedule"] })}
                    className="accent-primary" />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Modules to Include</label>
            <div className="flex flex-wrap gap-3">
              {ALL_MODULES.map((m) => (
                <label key={m.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={emailConfig.enabledModules.includes(m.key)}
                    onChange={() => setEmailConfig({ ...emailConfig, enabledModules: toggleModule(emailConfig.enabledModules, m.key) })}
                    className="accent-primary" />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="driveBackup" checked={emailConfig.driveBackup}
              onChange={(e) => setEmailConfig({ ...emailConfig, driveBackup: e.target.checked })}
              className="accent-primary" />
            <label htmlFor="driveBackup" className="text-sm font-medium text-secondary cursor-pointer">
              Google Drive Backup
            </label>
          </div>

          {emailConfig.driveBackup && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Drive Folder ID</label>
              <input type="text" value={emailConfig.driveFolderId}
                onChange={(e) => setEmailConfig({ ...emailConfig, driveFolderId: e.target.value })}
                placeholder="1ABC... (from Drive folder URL)"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Image Upload Folder ID</label>
            <input type="text" value={emailConfig.imageDriveFolderId}
              onChange={(e) => setEmailConfig({ ...emailConfig, imageDriveFolderId: e.target.value })}
              placeholder="1ABC... (separate folder for product images)"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Bill Upload Folder ID</label>
            <input type="text" value={emailConfig.billDriveFolderId}
              onChange={(e) => setEmailConfig({ ...emailConfig, billDriveFolderId: e.target.value })}
              placeholder="1ABC... (separate folder for bill copies)"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">GAS Webhook URL</label>
            <input type="url" value={emailConfig.gasWebhookUrl}
              onChange={(e) => setEmailConfig({ ...emailConfig, gasWebhookUrl: e.target.value })}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <p className="text-xs text-muted-foreground mt-1">
              Deploy the GAS script to Google Apps Script and paste the web app URL here.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <Button onClick={handleEmailSave} disabled={emailSaving} variant="accent">
              <Save className="h-4 w-4" /> {emailSaving ? "Saving..." : "Save Config"}
            </Button>
            <Button onClick={downloadGASScript} variant="outline">
              <Download className="h-4 w-4" /> Download GAS Script Template
            </Button>
            {emailSaved && (
              <span className="text-sm text-green-600">Config saved!</span>
            )}
          </div>

          <details className="text-sm text-muted-foreground border border-border rounded-lg p-3">
            <summary className="cursor-pointer font-medium text-secondary flex items-center gap-1.5">
              <Database className="h-4 w-4" /> How to deploy the Google Apps Script
            </summary>
            <ol className="mt-3 space-y-1.5 list-decimal list-inside">
              <li>Click <strong>Download GAS Script Template</strong> above to get <code>gas-backup.gs</code></li>
              <li>Go to <a href="https://script.google.com" target="_blank" rel="noopener" className="text-primary underline">script.google.com</a> and create a new project</li>
              <li>Paste the entire script contents</li>
              <li>Set <code>FIREBASE_CONFIG.projectId</code> and <code>FIREBASE_CONFIG.apiKey</code> at the top</li>
              <li>Save → Deploy → Web App → Execute as "Me", Access "Anyone"</li>
              <li>Copy the web app URL and paste it in the <strong>GAS Webhook URL</strong> field above</li>
              <li>For scheduled backups: go to Triggers → Add Trigger → <code>doBackup</code> → Time-driven (e.g., 8 AM daily)</li>
            </ol>
          </details>
        </div>

        {/* ── Archive Old Data ── */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-secondary">Archive Old Data</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Move data older than 12 months from Firestore to Google Sheets to reduce read costs.
            Archived data remains accessible in the app (marked with "Archived" badge).
            Affected collections: Sales, Purchases, Expenses, Invoices.
          </p>
          <Button onClick={runArchive} disabled={archiving || !emailConfig.gasWebhookUrl || !emailConfig.driveFolderId} variant="accent">
            <Save className="h-4 w-4" /> {archiving ? "Archiving..." : "Archive Now"}
          </Button>
          {archiveStatus && (
            <p className="text-sm text-green-600">{archiveStatus}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Also runs automatically as part of the daily backup schedule.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
