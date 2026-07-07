"use client";

import { useState, useEffect, type ReactNode } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { doc, getDoc, setDoc, addDoc, collection, getDocs, deleteDoc, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Save, Image, Download, Mail, Database, Calendar, FileText, UserPlus, Plus, X, TrendingUp, MessageSquare, Smartphone, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { getPreviousFYRange } from "@/lib/nepaliDate";
import { createJournalEntry } from "@/lib/journal";
import { useAuth } from "@/contexts/AuthContext";
import PartnerReport from "@/components/admin/PartnerReport";
import { generateVCard, downloadVCard } from "@/lib/vcard";
import type { ShopSettings, SmsConfig as SmsConfigType } from "@/types";

const settingNavItems = [
  { label: "Dashboard", href: "/admin" },
  { label: "POS", href: "/admin/pos" },
  { label: "Sales", href: "/admin/sales" },
  { label: "Invoices", href: "/admin/invoices" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Coupons", href: "/admin/coupons" },
  { label: "Offers", href: "/admin/offers" },
  { label: "Testimonials", href: "/admin/testimonials" },
  { label: "Debtors", href: "/admin/debtors" },
  { label: "Morning Dashboard", href: "/admin/morning" },
  { label: "Products", href: "/admin/products" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Inventory", href: "/admin/inventory" },
  { label: "Reconciliation", href: "/admin/reconciliation" },
  { label: "Purchases", href: "/admin/purchases" },
  { label: "Suppliers", href: "/admin/suppliers" },
  { label: "Creditors", href: "/admin/creditors" },
  { label: "Expenses", href: "/admin/expenses" },
  { label: "Reports", href: "/admin/reports" },
  { label: "Finance", href: "/admin/finance" },
  { label: "Accounting", href: "/admin/accounting" },
  { label: "Customers", href: "/admin/customers" },
  { label: "Staff", href: "/admin/staff" },
  { label: "Homepage", href: "/admin/homepage" },
  { label: "Access Control", href: "/admin/access-control" },
  { label: "Backup", href: "/admin/backup" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Setup", href: "/admin/setup" },
];

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
  emailTo?: string;
  mapLat?: number;
  mapLng?: number;
  mapEmbedUrl?: string;
  loyaltyEnabled?: boolean;
  pointsPerRupee?: number;
  pointValue?: number;
  minRedemptionPoints?: number;
  gasLoyaltyUrl?: string;
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
  announcementText: "Free shipping on orders over Rs. 1,000 — Use code PANCHAKANYA10 for 10% off!",
  emailTo: "",
  mapLat: undefined,
  mapLng: undefined,
  mapEmbedUrl: "",
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

interface SmsConfigForm {
  provider: "sparrowsms" | "smsfactory";
  apiKey: string;
  senderId: string;
}

const smsDefaults: SmsConfigForm = {
  provider: "sparrowsms",
  apiKey: "",
  senderId: "KIKSCL",
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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [smsConfig, setSmsConfig] = useState<SmsConfigForm>(smsDefaults);
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsSaved, setSmsSaved] = useState(false);
  const [smsTestStatus, setSmsTestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!form.shopName) return;
    let cancelled = false;
    const settingsForVCard: ShopSettings = {
      shopName: form.shopName,
      tagline: form.tagline || "",
      logoUrl: form.logoUrl,
      phone: form.phone,
      address: form.address,
      whatsappNumber: form.whatsappNumber,
      currency: form.currency,
      website: form.website,
      facebook: form.facebook,
      instagram: form.instagram,
      youtube: form.youtube,
      twitter: form.twitter,
      tiktok: form.tiktok,
      hiddenSocialLinks: form.hiddenSocialLinks,
      mapLat: form.mapLat,
      mapLng: form.mapLng,
      mapEmbedUrl: form.mapEmbedUrl,
    };
    import("qrcode").then((QRCode) => {
      const connectUrl = `${window.location.origin}/connect`;
      QRCode.default.toDataURL(connectUrl, { width: 400, margin: 2, color: { dark: "#b8860b", light: "#ffffff" } }).then((url: string) => {
        if (!cancelled) setQrDataUrl(url);
      });
    });
    return () => { cancelled = true; };
  }, [form.shopName, form.phone, form.address, form.whatsappNumber, form.website, form.facebook, form.instagram, form.youtube, form.twitter, form.tiktok, form.hiddenSocialLinks, form.mapLat, form.mapLng, form.mapEmbedUrl, form.tagline, form.logoUrl, form.currency]);

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${form.shopName.replace(/\s+/g, "_")}_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadVCardBtn = () => {
    const settingsForVCard: ShopSettings = {
      shopName: form.shopName,
      tagline: form.tagline || "",
      logoUrl: form.logoUrl,
      phone: form.phone,
      address: form.address,
      whatsappNumber: form.whatsappNumber,
      currency: form.currency,
      website: form.website,
      facebook: form.facebook,
      instagram: form.instagram,
      youtube: form.youtube,
      twitter: form.twitter,
      tiktok: form.tiktok,
      hiddenSocialLinks: form.hiddenSocialLinks,
      mapLat: form.mapLat,
      mapLng: form.mapLng,
      mapEmbedUrl: form.mapEmbedUrl,
    };
    downloadVCard(settingsForVCard);
  };

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
          const data = snap.data() as Settings;
          setForm({ ...defaults, ...data } as Settings);
          if (data.gasLoyaltyUrl) {
            import("@/lib/loyalty-gas").then((m) => m.setGasUrl(data.gasLoyaltyUrl!));
          }
        }
        const emailSnap = await getDoc(doc(db, "shop_settings", "emailBackupConfig"));
        if (emailSnap.exists()) {
          setEmailConfig({ ...emailDefaults, ...emailSnap.data() } as EmailBackupConfig);
        }
        const smsSnap = await getDoc(doc(db, "shop_settings", "smsConfig"));
        if (smsSnap.exists()) {
          setSmsConfig({ ...smsDefaults, ...smsSnap.data() } as SmsConfigForm);
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
      if (form.gasLoyaltyUrl) {
        import("@/lib/loyalty-gas").then((m) => m.setGasUrl(form.gasLoyaltyUrl!));
      }
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

  const handleSmsSave = async () => {
    setSmsSaving(true);
    setSmsSaved(false);
    try {
      await setDoc(doc(db, "shop_settings", "smsConfig"), smsConfig);
      setSmsSaved(true);
      setTimeout(() => setSmsSaved(false), 3000);
    } catch (e) {
      console.error("SMS config save failed", e);
    }
    setSmsSaving(false);
  };

  const testSms = async () => {
    setSmsTestStatus(null);
    if (!smsConfig.apiKey) { setSmsTestStatus("Enter an API key first."); return; }
    const { sendSMS } = await import("@/lib/sms");
    const result = await sendSMS(form.phone.replace(/[^0-9]/g, ""), `Test SMS from ${form.shopName} — SMS is working!`);
    setSmsTestStatus(result.ok ? "Test SMS sent!" : `Failed: ${result.error}`);
  };

  const downloadGASScript = () => {
    const link = document.createElement("a");
    link.href = "/scripts/gas-backup.gs";
    link.download = "gas-backup.gs";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [activePill, setActivePill] = useState<"general" | "loyalty" | "partners" | "backup">("general");
  const [bottomNavHrefs, setBottomNavHrefs] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("pc_bottom_nav");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) setBottomNavHrefs(parsed.slice(0, 5));
        else setBottomNavHrefs(["/admin/pos", "/admin/sales", "/admin", "/admin/products", "/admin/purchases"]);
      } else {
        setBottomNavHrefs(["/admin/pos", "/admin/sales", "/admin", "/admin/products", "/admin/purchases"]);
      }
    } catch { setBottomNavHrefs(["/admin/pos", "/admin/sales", "/admin", "/admin/products", "/admin/purchases"]); }
  }, []);

  const saveBottomNav = (hrefs: string[]) => {
    const items = hrefs.slice(0, 5);
    setBottomNavHrefs(items);
    localStorage.setItem("pc_bottom_nav", JSON.stringify(items));
  };

  const renderPill = (tab: "general" | "loyalty" | "partners" | "backup", label: string, icon: ReactNode) => (
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
          {renderPill("loyalty", "Loyalty", <TrendingUp className="h-4 w-4" />)}
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                <input type="email" value={form.emailTo ?? ""}
                  onChange={(e) => setForm({ ...form, emailTo: e.target.value })}
                  placeholder="shop@example.com"
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
                <textarea value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">Google Maps Embed URL</label>
                <input type="url" value={form.mapEmbedUrl}
                  onChange={(e) => setForm({ ...form, mapEmbedUrl: e.target.value })}
                  placeholder="https://www.google.com/maps/embed?pb=..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <p className="text-xs text-muted-foreground mt-1">Paste the iframe <code className="bg-muted px-1 rounded">src</code> URL from Google Maps &quot;Share → Embed a map&quot;. Used in footer map.</p>
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

            <div className="pt-4 border-t border-border">
              <div className="relative overflow-hidden rounded-xl p-5" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0c29 100%)" }}>
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #d4a853 0%, transparent 70%)" }} />
                  <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #b8860b 0%, transparent 70%)" }} />
                </div>
                <div className="relative z-10">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: "#d4a853" }}>
                    <Download className="h-4 w-4" /> QR Code — Connect Page
                  </h3>
                  {qrDataUrl ? (
                    <div className="flex flex-col sm:flex-row items-center gap-5">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-xl animate-pulse opacity-30" style={{ background: "radial-gradient(circle, #d4a853 0%, transparent 70%)", filter: "blur(16px)", transform: "scale(1.2)" }} />
                        <img src={qrDataUrl} alt="QR Code" className="relative w-36 h-36 rounded-xl border" style={{ borderColor: "rgba(212,168,83,0.3)" }} />
                      </div>
                      <div className="space-y-3 flex-1 text-center sm:text-left">
                        <p className="text-sm font-medium" style={{ color: "#f5e6b8" }}>
                          Scan to Connect
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                          Customers scan this QR to instantly save your contact and access the premium connect page.
                        </p>
                        <p className="text-xs font-mono break-all px-3 py-1.5 rounded-lg inline-block" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                          {typeof window !== "undefined" && `${window.location.origin}/connect`}
                        </p>
                        <div className="flex gap-2 pt-1">
                          <Button onClick={downloadQR} size="sm" className="text-xs" style={{ background: "linear-gradient(135deg, #d4a853, #b8860b)", color: "#1a1a2e", border: "none" }}>
                            <Download className="h-3.5 w-3.5" /> Download QR
                          </Button>
                          <Button onClick={downloadVCardBtn} size="sm" variant="outline" className="text-xs" style={{ borderColor: "rgba(212,168,83,0.3)", color: "#d4a853" }}>
                            <UserPlus className="h-3.5 w-3.5" /> Download VCF
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-20 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Save settings below to generate QR code...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-secondary">SMS Configuration</h3>
              </div>
              <p className="text-xs text-muted-foreground">Used for debtor reminders and notifications via SparrowSMS or SMSFactory.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Provider</label>
                  <select value={smsConfig.provider}
                    onChange={(e) => setSmsConfig({ ...smsConfig, provider: e.target.value as "sparrowsms" | "smsfactory" })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="sparrowsms">SparrowSMS</option>
                    <option value="smsfactory">SMSFactory</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">API Key / Token</label>
                  <input type="text" value={smsConfig.apiKey}
                    onChange={(e) => setSmsConfig({ ...smsConfig, apiKey: e.target.value })}
                    placeholder="Your API key or token"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Sender ID</label>
                  <input type="text" value={smsConfig.senderId}
                    onChange={(e) => setSmsConfig({ ...smsConfig, senderId: e.target.value })}
                    placeholder="KIKSCL"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleSmsSave} disabled={smsSaving} size="sm" variant="outline">
                  <Save className="h-3.5 w-3.5" /> {smsSaving ? "Saving..." : "Save SMS Config"}
                </Button>
                <Button onClick={testSms} disabled={!smsConfig.apiKey} size="sm" variant="ghost">
                  <MessageSquare className="h-3.5 w-3.5" /> Test SMS
                </Button>
                {smsSaved && <span className="text-xs text-green-600">Saved!</span>}
                {smsTestStatus && <span className={`text-xs ${smsTestStatus.startsWith("Test SMS sent") ? "text-green-600" : "text-red-600"}`}>{smsTestStatus}</span>}
              </div>
            </div>

            {/* Mobile Bottom Nav */}
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-secondary">Mobile Navigation (Personal)</h3>
              </div>
              <p className="text-xs text-muted-foreground">Choose up to 5 modules to show in the mobile bottom nav bar. Drag or use arrows to reorder.</p>
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {settingNavItems.map((item, idx) => {
                  const selectedIndex = bottomNavHrefs.indexOf(item.href!);
                  const isSelected = selectedIndex !== -1;
                  return (
                    <div key={item.href} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isSelected ? "bg-accent/5 border border-accent/20" : "bg-muted/20 border border-transparent"}`}>
                      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                        <input type="checkbox" checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              saveBottomNav(bottomNavHrefs.filter((h) => h !== item.href));
                            } else if (bottomNavHrefs.length < 5) {
                              saveBottomNav([...bottomNavHrefs, item.href!]);
                            }
                          }}
                          className="accent-primary w-4 h-4 shrink-0" />
                        <span className="font-medium truncate">{item.label}</span>
                      </label>
                      {isSelected && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button disabled={selectedIndex === 0}
                            onClick={() => { const a = [...bottomNavHrefs]; [a[selectedIndex - 1], a[selectedIndex]] = [a[selectedIndex], a[selectedIndex - 1]]; saveBottomNav(a); }}
                            className="p-1 hover:bg-muted rounded disabled:opacity-20">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button disabled={selectedIndex === bottomNavHrefs.length - 1}
                            onClick={() => { const a = [...bottomNavHrefs]; [a[selectedIndex], a[selectedIndex + 1]] = [a[selectedIndex + 1], a[selectedIndex]]; saveBottomNav(a); }}
                            className="p-1 hover:bg-muted rounded disabled:opacity-20">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{bottomNavHrefs.length}/5 selected</p>
              {bottomNavHrefs.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Preview:</span>
                  <div className="flex gap-1.5">
                    {bottomNavHrefs.map((h) => {
                      const ni = settingNavItems.find((n) => n.href === h);
                      return ni ? <span key={h} className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">{ni.label}</span> : null;
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <Button onClick={handleSave} disabled={saving} variant="accent">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Settings"}
              </Button>
              {saved && <span className="text-sm text-green-600">Settings saved!</span>}
            </div>
          </div>
        )}

        {/* ── Loyalty Tab ── */}
        {activePill === "loyalty" && (
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 pb-4 border-b border-border">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-secondary">Loyalty Points</h2>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.loyaltyEnabled}
                onChange={(e) => setForm({ ...form, loyaltyEnabled: e.target.checked })}
                className="accent-primary w-4 h-4" />
              <span className="text-sm font-medium text-secondary">Enable Loyalty Points</span>
            </label>

            {form.loyaltyEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Points per Rs. 1</label>
                  <input type="number" value={form.pointsPerRupee ?? 0.01}
                    onChange={(e) => setForm({ ...form, pointsPerRupee: Number(e.target.value) })}
                    min={0} step={0.001}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <p className="text-xs text-muted-foreground mt-0.5">e.g., 0.01 = 1 point per Rs. 100</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Rs. per Point</label>
                  <input type="number" value={form.pointValue ?? 0.5}
                    onChange={(e) => setForm({ ...form, pointValue: Number(e.target.value) })}
                    min={0} step={0.1}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <p className="text-xs text-muted-foreground mt-0.5">e.g., 0.5 = 100 points = Rs. 50</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Min Redemption</label>
                  <input type="number" value={form.minRedemptionPoints ?? 100}
                    onChange={(e) => setForm({ ...form, minRedemptionPoints: Number(e.target.value) })}
                    min={1} step={10}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <p className="text-xs text-muted-foreground mt-0.5">Minimum points to redeem</p>
                </div>
              </div>
            )}

            {form.loyaltyEnabled && (
              <div className="pt-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">GAS Loyalty Web App URL</label>
                <div className="flex gap-2">
                  <input type="url" value={form.gasLoyaltyUrl ?? ""}
                    onChange={(e) => setForm({ ...form, gasLoyaltyUrl: e.target.value })}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <Button onClick={async () => {
                    if (!form.gasLoyaltyUrl) return;
                    const { setGasUrl, ping } = await import("@/lib/loyalty-gas");
                    setGasUrl(form.gasLoyaltyUrl!);
                    const res = await ping();
                    alert(res.ok ? "Connected!" : `Failed: ${res.error}`);
                  }} size="sm" variant="outline" type="button">Test</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Deploy the loyalty-gas.gs script and paste the web app URL here</p>
              </div>
            )}

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

interface InvestmentRecord {
  amount: number;
  date: number;
  note?: string;
}

interface PartnerEntry {
  id: string;
  name: string;
  email: string;
  designation: string;
  amount: number;
  addedAt: number;
  investments: InvestmentRecord[];
}

function PartnershipSection() {
  const { user, profile } = useAuth();
  const [partners, setPartners] = useState<PartnerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<PartnerEntry | null>(null);
  const [showAddInvestment, setShowAddInvestment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerEntry | null>(null);

  // Add partner form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDesignation, setFormDesignation] = useState("");
  const [formAmount, setFormAmount] = useState(0);

  // Add investment form
  const [invAmount, setInvAmount] = useState(0);
  const [invDate, setInvDate] = useState(new Date().toISOString().split("T")[0]);
  const [invNote, setInvNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "partnerCapitals"));
      const list: PartnerEntry[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name || "",
          email: data.email || "",
          designation: data.designation || "",
          amount: data.amount || 0,
          addedAt: data.addedAt || Date.now(),
          investments: data.investments || (data.amount ? [{ amount: data.amount, date: data.addedAt || Date.now(), note: "Initial contribution" }] : []),
        } as PartnerEntry;
      });
      setPartners(list.sort((a, b) => b.addedAt - a.addedAt));
    } catch (e) {
      console.error("Failed to load partners", e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalCapital = partners.reduce((s, p) => s + p.amount, 0);
  const partnerEmails = partners.flatMap((p) => (p.email || "").split(";").map((e) => e.trim()).filter(Boolean));

  const resetAddForm = (partner?: PartnerEntry | null) => {
    if (partner) {
      setFormName(partner.name); setFormEmail(partner.email); setFormDesignation(partner.designation); setFormAmount(0);
    } else {
      setFormName(""); setFormEmail(""); setFormDesignation(""); setFormAmount(0);
    }
  };

  const openEditModal = (partner: PartnerEntry) => {
    setEditingPartner(partner);
    resetAddForm(partner);
    setShowAddModal(true);
  };

  const handleAddPartner = async () => {
    if (!formName.trim()) return;
    if (!editingPartner && formAmount <= 0) return;
    setSaving(true);
    try {
      if (editingPartner) {
        await setDoc(doc(db, "partnerCapitals", editingPartner.id), {
          name: formName.trim(), email: formEmail.trim(), designation: formDesignation.trim(),
          amount: editingPartner.amount, addedAt: editingPartner.addedAt, investments: editingPartner.investments,
        });
        setEditingPartner(null);
        resetAddForm();
        setShowAddModal(false);
        await load();
      } else {
        const now = Date.now();
        const inv = [{ amount: formAmount, date: now, note: "Initial contribution" }];
        const docRef = await addDoc(collection(db, "partnerCapitals"), {
          name: formName.trim(), email: formEmail.trim(), designation: formDesignation.trim(),
          amount: formAmount, addedAt: now, investments: inv,
        });
        await createJournalEntry({
          entryDate: now,
          description: `Capital contribution - ${formName.trim()}`,
          lines: [
            { accountCode: "1.1.2", accountName: "Bank Account", debit: formAmount, credit: 0 },
            { accountCode: "3.1.1", accountName: "Owner's Capital", debit: 0, credit: formAmount },
          ],
          referenceType: "capital",
          referenceId: docRef.id,
          recordedBy: user?.uid || "",
          recordedByName: profile?.displayName || "System",
        });
        await addDoc(collection(db, "accountTransactions"), {
          accountId: "bank_account", type: "credit", amount: formAmount,
          description: `Capital contribution - ${formName.trim()}`,
          date: Timestamp.fromDate(new Date()),
          referenceType: "capital", referenceId: docRef.id,
          recordedBy: user?.uid || "", createdAt: Timestamp.fromDate(new Date()),
        });
        resetAddForm();
        setShowAddModal(false);
        await load();
      }
    } catch (e) {
      console.error("Save partner failed", e);
    }
    setSaving(false);
  };

  const handleAddInvestment = async () => {
    if (!selectedPartner || invAmount <= 0) return;
    setSaving(true);
    try {
      const newInv = { amount: invAmount, date: new Date(invDate).getTime(), note: invNote.trim() || undefined };
      const updatedInvestments = [...(selectedPartner.investments || []), newInv];
      const updatedAmount = updatedInvestments.reduce((s, i) => s + i.amount, 0);
      await setDoc(doc(db, "partnerCapitals", selectedPartner.id), {
        name: selectedPartner.name, email: selectedPartner.email,
        designation: selectedPartner.designation,
        amount: updatedAmount, addedAt: selectedPartner.addedAt,
        investments: updatedInvestments,
      });
      await createJournalEntry({
        entryDate: newInv.date,
        description: `Additional capital contribution - ${selectedPartner.name}`,
        lines: [
          { accountCode: "1.1.2", accountName: "Bank Account", debit: invAmount, credit: 0 },
          { accountCode: "3.1.1", accountName: "Owner's Capital", debit: 0, credit: invAmount },
        ],
        referenceType: "capital",
        referenceId: selectedPartner.id,
        recordedBy: user?.uid || "",
        recordedByName: profile?.displayName || "System",
      });
      await addDoc(collection(db, "accountTransactions"), {
        accountId: "bank_account", type: "credit", amount: invAmount,
        description: `Additional capital contribution - ${selectedPartner.name}`,
        date: Timestamp.fromDate(new Date()),
        referenceType: "capital", referenceId: selectedPartner.id,
        recordedBy: user?.uid || "", createdAt: Timestamp.fromDate(new Date()),
      });
      setShowAddInvestment(false);
      setInvAmount(0); setInvNote(""); setInvDate(new Date().toISOString().split("T")[0]);
      await load();
      // Re-select partner with updated data
      const updated = partners.find((p) => p.id === selectedPartner.id);
      if (updated) setSelectedPartner(updated);
    } catch (e) {
      console.error("Add investment failed", e);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this partner?")) return;
    await deleteDoc(doc(db, "partnerCapitals", id));
    const jeSnap = await getDocs(query(collection(db, "journalEntries"), where("referenceType", "==", "capital"), where("referenceId", "==", id)));
    for (const je of jeSnap.docs) await deleteDoc(doc(db, "journalEntries", je.id));
    const atSnap = await getDocs(query(collection(db, "accountTransactions"), where("referenceType", "==", "capital"), where("referenceId", "==", id)));
    for (const at of atSnap.docs) await deleteDoc(doc(db, "accountTransactions", at.id));
    setSelectedPartner(null);
    await load();
  };

  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("en-NP", { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Partners & Capital</h3>
        </div>
        <div className="flex items-center gap-2">
          {partnerEmails.length > 0 && (
            <Button onClick={() => setShowReport(true)} size="sm" variant="outline" className="text-xs">
              <FileText className="h-3.5 w-3.5" /> Send Report
            </Button>
          )}
          <Button onClick={() => { resetAddForm(); setEditingPartner(null); setShowAddModal(true); }} size="sm" variant="accent" className="text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Partner
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : partners.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No partners added yet. Click "Add Partner" to get started.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 font-medium text-right">% Ownership</th>
                <th className="px-4 py-3 font-medium text-right">Total Capital</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {partners.map((p) => (
                <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedPartner(p)} className="font-medium text-primary hover:underline text-left">
                      {p.name}
                    </button>
                    {p.email && <span className="block text-xs text-muted-foreground mt-0.5">{p.email.split(";").join(", ")}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.designation || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {totalCapital > 0 ? `${((p.amount / totalCapital) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">Rs. {p.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEditModal(p)} className="p-1 hover:bg-muted rounded text-xs text-muted-foreground mr-1">Edit</button>
                    <button onClick={() => handleDelete(p.id)} className="p-1 hover:bg-red-50 rounded text-xs text-red-500">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 font-semibold text-xs">
                <td className="px-4 py-3" colSpan={2}>Total ({partners.length} partner{partners.length !== 1 ? "s" : ""})</td>
                <td className="px-4 py-3 text-right">100%</td>
                <td className="px-4 py-3 text-right">Rs. {totalCapital.toLocaleString()}</td>
                <td className="px-4 py-3 text-right" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {showReport && (
        <PartnerReport partnerEmails={partnerEmails} onClose={() => setShowReport(false)} />
      )}

      {/* ── Add Partner Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => { setShowAddModal(false); setEditingPartner(null); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-bold text-secondary">{editingPartner ? "Edit Partner" : "Add Partner"}</h2>
              <button onClick={() => { setShowAddModal(false); setEditingPartner(null); }} className="p-1 hover:bg-muted rounded-lg"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Partner Name *</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Ram Sharma" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Designation</label>
                <input type="text" value={formDesignation} onChange={(e) => setFormDesignation(e.target.value)}
                  placeholder="e.g. Managing Partner" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Email (use ; for multiple)</label>
                <input type="text" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="ram@email.com; sita@email.com" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{editingPartner ? "Total Capital (change via Add Investment)" : "Initial Capital (Rs.) *"}</label>
                <input type="number" value={formAmount || ""} onChange={(e) => setFormAmount(Number(e.target.value))}
                  min={0} step={1000} disabled={!!editingPartner}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
              {editingPartner && (
                <p className="text-xs text-muted-foreground">To change capital, use <strong>Add Investment</strong> in the partner detail view.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-border">
              <Button onClick={() => { setShowAddModal(false); setEditingPartner(null); }} variant="ghost" size="sm">Cancel</Button>
              <Button onClick={handleAddPartner} disabled={saving || !formName.trim() || (!editingPartner && formAmount <= 0)} variant="accent" size="sm">
                {saving ? "Saving..." : editingPartner ? "Update Partner" : "Add Partner"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Partner Detail Modal ── */}
      {selectedPartner && !showAddInvestment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedPartner(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-bold text-secondary">{selectedPartner.name}</h2>
              <button onClick={() => setSelectedPartner(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Designation:</span> <span className="font-medium">{selectedPartner.designation || "—"}</span></div>
                <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{selectedPartner.email || "—"}</span></div>
                <div><span className="text-muted-foreground">Total Capital:</span> <span className="font-medium">Rs. {selectedPartner.amount.toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Partner Since:</span> <span className="font-medium">{fmtDate(selectedPartner.addedAt)}</span></div>
              </div>

              <div className="border-t border-border pt-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Investment History</h4>
                {(selectedPartner.investments || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No investment records</p>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium text-right">Amount</th>
                          <th className="px-3 py-2 font-medium">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(selectedPartner.investments || []).map((inv, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">{fmtDate(inv.date)}</td>
                            <td className="px-3 py-2 text-right font-medium">Rs. {inv.amount.toLocaleString()}</td>
                            <td className="px-3 py-2 text-muted-foreground">{inv.note || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center gap-2 p-4 border-t border-border">
              <Button onClick={() => handleDelete(selectedPartner.id)} size="sm" variant="outline" className="text-xs text-red-500 border-red-200 hover:bg-red-50">
                Remove Partner
              </Button>
                <div className="flex gap-2">
                  <Button onClick={() => { openEditModal(selectedPartner); setSelectedPartner(null); }} size="sm" variant="outline" className="text-xs">
                    Edit Details
                  </Button>
                  <Button onClick={() => { setInvAmount(0); setInvNote(""); setInvDate(new Date().toISOString().split("T")[0]); setShowAddInvestment(true); }} size="sm" variant="accent" className="text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add Investment
                  </Button>
                  <Button onClick={() => setSelectedPartner(null)} size="sm" variant="ghost" className="text-xs">Close</Button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Investment Modal ── */}
      {selectedPartner && showAddInvestment && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowAddInvestment(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-bold text-secondary">Add Investment — {selectedPartner.name}</h2>
              <button onClick={() => setShowAddInvestment(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Amount (Rs.) *</label>
                <input type="number" value={invAmount || ""} onChange={(e) => setInvAmount(Number(e.target.value))}
                  min={0} step={1000} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
                <input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Note (optional)</label>
                <input type="text" value={invNote} onChange={(e) => setInvNote(e.target.value)}
                  placeholder="e.g. Q2 2026 additional capital" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <p className="text-xs text-muted-foreground">
                This will create a journal entry and update the total capital for {selectedPartner.name}.
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-border">
              <Button onClick={() => setShowAddInvestment(false)} variant="ghost" size="sm">Cancel</Button>
              <Button onClick={handleAddInvestment} disabled={saving || invAmount <= 0} variant="accent" size="sm">
                {saving ? "Saving..." : "Add Investment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
