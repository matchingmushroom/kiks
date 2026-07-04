"use client";

import { Facebook, Instagram, Youtube, Twitter, Music2, Mail, MapPin, Phone } from "lucide-react";
import { useShopSettings } from "@/contexts/ShopSettingsContext";

const socialChannels = [
  { key: "facebook" as const, icon: Facebook, label: "Facebook" },
  { key: "instagram" as const, icon: Instagram, label: "Instagram" },
  { key: "youtube" as const, icon: Youtube, label: "YouTube" },
  { key: "twitter" as const, icon: Twitter, label: "Twitter / X" },
  { key: "tiktok" as const, icon: Music2, label: "TikTok" },
];

export default function ShopFooter() {
  const { settings } = useShopSettings();
  const hidden = settings.hiddenSocialLinks || [];

  const socialLinks = socialChannels.filter(
    (ch) => settings[ch.key] && !hidden.includes(ch.key)
  );

  return (
    <footer className="bg-secondary text-secondary-foreground pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          <div>
            <img src={settings.footerLogoUrl || settings.logoUrl || "/logo.svg"} alt={settings.shopName} className="h-12 sm:h-16 mb-4" />
            <p className="text-sm text-secondary-foreground/70 mb-4 leading-relaxed">{settings.tagline}</p>
          </div>
          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-secondary-foreground/60">Follow Us</h3>
            {socialLinks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {socialLinks.map((ch) => (
                  <a
                    key={ch.key}
                    href={settings[ch.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-secondary-foreground/10 flex items-center justify-center hover:bg-accent hover:text-secondary transition-all"
                    title={ch.label}
                  >
                    <ch.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-secondary-foreground/50">No social links configured</p>
            )}
          </div>
          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-secondary-foreground/60">Store Address</h3>
            <div className="space-y-3 text-sm text-secondary-foreground/70">
              {settings.address && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-secondary-foreground/40" />
                  <span className="whitespace-pre-line">{settings.address}</span>
                </div>
              )}
              {settings.phone && (
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 shrink-0 text-secondary-foreground/40" />
                  <span>{settings.phone}</span>
                </div>
              )}
              {settings.emailTo && (
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-secondary-foreground/40" />
                  <span>{settings.emailTo}</span>
                </div>
              )}
            </div>
          </div>

          {(settings.mapLat && settings.mapLng) || settings.address ? (
            <div>
              <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-secondary-foreground/60">Find Us</h3>
              <div className="rounded-lg overflow-hidden border border-secondary-foreground/10">
                <iframe
                  src={settings.mapLat && settings.mapLng
                    ? `https://maps.google.com/maps?q=${settings.mapLat},${settings.mapLng}&z=15&output=embed`
                    : `https://maps.google.com/maps?q=${encodeURIComponent(settings.address)}&output=embed`
                  }
                  width="100%"
                  height="180"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Google Maps"
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="border-t border-secondary-foreground/20 mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-secondary-foreground/50">
          <p>&copy; {new Date().getFullYear()} {settings.shopName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
