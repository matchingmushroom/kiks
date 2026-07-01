"use client";

import { useState, useEffect, type ReactNode } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { doc, getDoc, setDoc, addDoc, collection, getDocs, deleteDoc, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Save, Image, Download, Mail, Database, Calendar } from "lucide-react";
import { getPreviousFYRange } from "@/lib/nepaliDate";
import { createJournalEntry } from "@/lib/journal";
import { useAuth } from "@/contexts/AuthContext";

interface Settings {
  shopName: string;
  tagline: string;
  logoUrl: string;
  footerLogoUrl: string;
  phone: string;
  address: string;
  whatsappNumber: string;
  currency: string;
  website: string;
  facebook: string;
  instagram: string;
  youtube: string;
  twitter: string;
  tiktok: string;
  hiddenSocialLinks: string[];
  announcementText?: string;
  useBsCalendar?: boolean;
  deliveryFeeInsideValley?: number;
  deliveryFeeOutsideValley?: number;
  freeDeliveryThreshold?: number;
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
  archiveFYStart?: number;
  archiveFYEnd?: number;
}

const defaults: Settings = {
  shopName: "KIKS Collections",
  tagline: "Exquisite Jewellery Since 2020",
  logoUrl: "/logo.svg",
  footerLogoUrl: "",
  phone: "+977-XXXXXXXXX",
  address: "Kathmandu, Nepal",
  whatsappNumber: "977XXXXXXXXX",
  currency: "NPR",
  website: "",
  facebook: "",
  instagram: "",
  youtube: "",
  twitter: "",
  tiktok: "",
  hiddenSocialLinks: [],
  announcementText: "Free shipping on orders over Rs. 1,000 \u2014 Use code PANCHAKANYA10 for 10% off!",
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
      // Compute previous FY dates
      const prevFY = getPreviousFYRange();
      const archiveStart = prevFY.start.getTime();
      const archiveEnd = prevFY.end.getTime();
      // Store FY dates in config for automatic doBackup to reference
      await setDoc(doc(db, "shop_settings", "emailBackupConfig"), { archiveFYStart: archiveStart, archiveFYEnd: archiveEnd }, { merge: true });
      setEmailConfig((prev) => ({ ...prev, archiveFYStart: archiveStart, archiveFYEnd: archiveEnd }));

      const res = await fetch(emailConfig.gasWebhookUrl, {
        method: "POST",
        body: JSON.stringify({ action: "archiveToSheet", driveFolderId: emailConfig.driveFolderId, archiveStart, archiveEnd }),
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
        // Store archive FY dates for GAS doBackup to reference
        const prevFY = getPreviousFYRange();
        const archiveStart = prevFY.start.getTime();
        const archiveEnd = prevFY.end.getTime();
        await setDoc(doc(db, "shop_settings", "emailBackupConfig"), { archiveFYStart: archiveStart, archiveFYEnd: archiveEnd }, { merge: true });
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

  const [activePill, setActivePill] = useState<"general" | "partners" | "backup">("general");

  const renderPill = (tab: "general" | "partners" | "backup", label: string, icon: ReactNode) => (
    <button key={tab} onClick={() => setActivePill(tab)}
      className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
        activePill === tab
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted text-secondary hover:bg-muted/80"
      }`}>
      {icon}{label}
    </button>
  );

  if (loading) {
    return (
      <AdminLayout>
        <LoadingSpinner text="Loading settings..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 max-w-3xl space-y-6">
        <h1 className="text-xl font-bold text-secondary">Settings</h1>

        {/* Pill Tabs */}
        <div className="flex flex-wrap gap-2">
          {renderPill("general", "General", <Image className="h-4 w-4" />)}
          {renderPill("partners", "Partners", <Save className="h-4 w-4" />)}
          {renderPill("backup", "Backup", <Mail className="h-4 w-4" />)}

        </div>

        {/* ── General Tab ── */}
        {activePill === "general" && (
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
                <input type="text" value={form.logoUrl}
                  onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                  placeholder="/logo.svg"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <p className="text-xs text-muted-foreground mt-1">Upload PNG to <code>/public/</code> or use external URL</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 pb-6 border-b border-border">
              <div className="w-20 h-20 bg-secondary rounded-xl overflow-hidden flex-shrink-0 border border-border flex items-center justify-center">
                {form.footerLogoUrl ? (
                  <img src={form.footerLogoUrl} alt="Footer Logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">No img</span>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Footer Logo URL (white variant)</label>
                <input type="text" value={form.footerLogoUrl}
                  onChange={(e) => setForm({ ...form, footerLogoUrl: e.target.value })}
                  placeholder="/footer-logo.png"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <p className="text-xs text-muted-foreground mt-1">Light/white logo for dark footer background</p>
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
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Facebook URL</label>
                <input type="url" value={form.facebook}
                  onChange={(e) => setForm({ ...form, facebook: e.target.value })}
                  placeholder="https://facebook.com/yourpage"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Instagram URL</label>
                <input type="url" value={form.instagram}
                  onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  placeholder="https://instagram.com/yourhandle"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">YouTube URL</label>
                <input type="url" value={form.youtube}
                  onChange={(e) => setForm({ ...form, youtube: e.target.value })}
                  placeholder="https://youtube.com/@yourchannel"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Twitter / X URL</label>
                <input type="url" value={form.twitter}
                  onChange={(e) => setForm({ ...form, twitter: e.target.value })}
                  placeholder="https://twitter.com/yourhandle"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">TikTok URL</label>
                <input type="url" value={form.tiktok}
                  onChange={(e) => setForm({ ...form, tiktok: e.target.value })}
                  placeholder="https://tiktok.com/@yourhandle"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Show on Footer</p>
              <div className="flex flex-wrap gap-4">
                {["facebook", "instagram", "youtube", "twitter", "tiktok"].map((p) => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox"
                      checked={!form.hiddenSocialLinks.includes(p)}
                      onChange={(e) => {
                        const hidden = e.target.checked
                          ? form.hiddenSocialLinks.filter((k) => k !== p)
                          : [...form.hiddenSocialLinks, p];
                        setForm({ ...form, hiddenSocialLinks: hidden });
                      }}
                      className="accent-primary w-4 h-4" />
                    <span className="text-sm capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <label className="block text-sm font-medium text-secondary">Announcement Bar Text</label>
              <textarea value={form.announcementText ?? ""}
                onChange={(e) => setForm({ ...form, announcementText: e.target.value })}
                rows={2} maxLength={300}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              <p className="text-xs text-muted-foreground">
                Shown at the top of every page. Supports HTML entities. Leave empty to hide.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <Calendar className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form.useBsCalendar}
                    onChange={(e) => setForm({ ...form, useBsCalendar: e.target.checked })}
                    className="accent-primary w-4 h-4" />
                  <span className="text-sm font-medium text-secondary">Bikram Sambat Calendar (BS)</span>
                </label>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Display dates in BS format. YTD filters use fiscal year (Shrawan 1 – Ashad 32).
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-secondary">Delivery Fee</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Inside Valley (Rs.)</label>
                  <input type="number" value={form.deliveryFeeInsideValley ?? ""}
                    onChange={(e) => setForm({ ...form, deliveryFeeInsideValley: e.target.value ? Number(e.target.value) : undefined })}
                    min={0} step={10}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Outside Valley (Rs.)</label>
                  <input type="number" value={form.deliveryFeeOutsideValley ?? ""}
                    onChange={(e) => setForm({ ...form, deliveryFeeOutsideValley: e.target.value ? Number(e.target.value) : undefined })}
                    min={0} step={10}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Free Delivery Above (Rs.)</label>
                  <input type="number" value={form.freeDeliveryThreshold ?? ""}
                    onChange={(e) => setForm({ ...form, freeDeliveryThreshold: e.target.value ? Number(e.target.value) : undefined })}
                    min={0} step={100}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <Button onClick={handleSave} disabled={saving} variant="accent">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Settings"}
              </Button>
              {saved && <span className="text-sm text-green-600">Settings saved!</span>}
            </div>
          </div>
        )}

        {/* ── Partners Tab ── */}
        {activePill === "partners" && (
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-secondary">Partners' Capital</h2>
            <p className="text-sm text-muted-foreground">
              Manage partners and their capital contributions. Total is used as Opening Capital in Balance Sheet.
              Add new partners or adjust existing capital as needed.
            </p>
            <PartnershipSection />
          </div>
        )}

        {/* ── Backup Tab ── */}
        {activePill === "backup" && (
          <div className="space-y-6">
            <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 pb-4 border-b border-border">
                <Mail className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-secondary">Email & Backup Config</h2>
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
                  <Download className="h-4 w-4" /> Download GAS Script
                </Button>
                {emailSaved && <span className="text-sm text-green-600">Config saved!</span>}
              </div>

              <details className="text-sm text-muted-foreground border border-border rounded-lg p-3">
                <summary className="cursor-pointer font-medium text-secondary flex items-center gap-1.5">
                  <Database className="h-4 w-4" /> How to deploy the Google Apps Script
                </summary>
                <ol className="mt-3 space-y-1.5 list-decimal list-inside">
                  <li>Click <strong>Download GAS Script</strong> above to get <code>gas-backup.gs</code></li>
                  <li>Go to <a href="https://script.google.com" target="_blank" rel="noopener" className="text-primary underline">script.google.com</a> and create a new project</li>
                  <li>Paste the entire script contents</li>
                  <li>Set <code>FIREBASE_CONFIG.projectId</code> and <code>FIREBASE_CONFIG.apiKey</code> at the top</li>
                  <li>Save → Deploy → Web App → Execute as "Me", Access "Anyone"</li>
                  <li>Copy the web app URL and paste it in the <strong>GAS Webhook URL</strong> field above</li>
                  <li>For scheduled backups: go to Triggers → Add Trigger → <code>doBackup</code> → Time-driven</li>
                </ol>
              </details>
            </div>

            <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-4 border-b border-border">
                <Database className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-secondary">Archive Old Data</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Move previous fiscal year data from Firestore to Google Sheets to reduce read costs.
                Affected collections: Sales, Purchases, Expenses, Invoices.
              </p>
              <Button onClick={runArchive} disabled={archiving || !emailConfig.gasWebhookUrl || !emailConfig.driveFolderId} variant="accent">
                <Save className="h-4 w-4" /> {archiving ? "Archiving..." : "Archive Now"}
              </Button>
              {archiveStatus && <p className="text-sm text-green-600">{archiveStatus}</p>}
              <p className="text-xs text-muted-foreground">Also runs automatically as part of the daily backup schedule.</p>
            </div>
          </div>
        )}


      </div>
    </AdminLayout>
  );
}

interface PartnerEntry {
  id: string;
  name: string;
  amount: number;
  addedAt: number;
}

function PartnershipSection() {
  const { user, profile } = useAuth();
  const [partners, setPartners] = useState<PartnerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "partnerCapitals"));
    const list: PartnerEntry[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PartnerEntry));
    setPartners(list.sort((a, b) => b.addedAt - a.addedAt));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalCapital = partners.reduce((s, p) => s + p.amount, 0);

  const handleAdd = async () => {
    if (!name.trim() || amount <= 0) return;
    setSaving(true);
    try {
      if (editId) {
        const prev = partners.find((p) => p.id === editId);
        await setDoc(doc(db, "partnerCapitals", editId), { name: name.trim(), amount, addedAt: Date.now() });
        // Delete old journal entry if amount changed, so it can be re-created
        if (prev && prev.amount !== amount) {
          const jeSnap = await getDocs(query(collection(db, "journalEntries"), where("referenceType", "==", "capital"), where("referenceId", "==", editId)));
          for (const je of jeSnap.docs) await deleteDoc(doc(db, "journalEntries", je.id));
        }
        setEditId(null);
      } else {
        const addedAt = Date.now();
        const docRef = await addDoc(collection(db, "partnerCapitals"), { name: name.trim(), amount, addedAt });
        await createJournalEntry({
          entryDate: addedAt,
          description: `Capital contribution - ${name.trim()}`,
          lines: [
            { accountCode: "1.1.2", accountName: "Bank Account", debit: amount, credit: 0 },
            { accountCode: "3.1.1", accountName: "Owner's Capital", debit: 0, credit: amount },
          ],
          referenceType: "capital",
          referenceId: docRef.id,
          recordedBy: user?.uid || "",
          recordedByName: profile?.displayName || "System",
        });
        await addDoc(collection(db, "accountTransactions"), {
          accountId: "bank_account", type: "credit", amount,
          description: `Capital contribution - ${name.trim()}`,
          date: Timestamp.fromDate(new Date()),
          referenceType: "capital", referenceId: docRef.id,
          recordedBy: user?.uid || "", createdAt: Timestamp.fromDate(new Date()),
        });
      }
      setName(""); setAmount(0);
      await load();
    } catch (e) {
      console.error("Capital save failed", e);
    }
    setSaving(false);
  };

  const handleEdit = (p: PartnerEntry) => {
    setName(p.name); setAmount(p.amount); setEditId(p.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this partner?")) return;
    await deleteDoc(doc(db, "partnerCapitals", id));
    const jeSnap = await getDocs(query(collection(db, "journalEntries"), where("referenceType", "==", "capital"), where("referenceId", "==", id)));
    for (const je of jeSnap.docs) await deleteDoc(doc(db, "journalEntries", je.id));
    const atSnap = await getDocs(query(collection(db, "accountTransactions"), where("referenceType", "==", "capital"), where("referenceId", "==", id)));
    for (const at of atSnap.docs) await deleteDoc(doc(db, "accountTransactions", at.id));
    await load();
  };

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : partners.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No partners added yet. Add the first partner below.</p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {partners.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <span className="font-medium text-secondary">{p.name}</span>
                <span className="text-muted-foreground ml-2">Rs. {p.amount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleEdit(p)} className="p-1 hover:bg-muted rounded text-xs text-muted-foreground">Edit</button>
                <button onClick={() => handleDelete(p.id)} className="p-1 hover:bg-red-50 rounded text-xs text-red-500">Remove</button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold bg-muted/30">
            <span>Total Capital</span>
            <span>Rs. {totalCapital.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="flex items-end gap-3 pt-2 border-t border-border">
        <div className="flex-1">
          <label className="block text-xs text-muted-foreground mb-1">Partner Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Enter partner name" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
        </div>
        <div className="w-36">
          <label className="block text-xs text-muted-foreground mb-1">Capital (Rs.)</label>
          <input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))}
            min={0} step={1000} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
        </div>
        <Button onClick={handleAdd} disabled={saving || !name.trim() || amount <= 0} variant="accent" size="sm">
          {editId ? "Update" : "Add"}
        </Button>
        {editId && (
          <Button onClick={() => { setName(""); setAmount(0); setEditId(null); }} variant="ghost" size="sm">Cancel</Button>
        )}
      </div>
    </div>
  );
}
