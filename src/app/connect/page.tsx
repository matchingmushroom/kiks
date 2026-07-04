"use client";

import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { downloadVCard } from "@/lib/vcard";
import { Globe, Phone, MessageCircle, MapPin, UserPlus, Facebook, Instagram, Youtube, Twitter, Music2, Loader2, ExternalLink } from "lucide-react";

const socialChannels = [
  { key: "facebook" as const, icon: Facebook, label: "Facebook" },
  { key: "instagram" as const, icon: Instagram, label: "Instagram" },
  { key: "youtube" as const, icon: Youtube, label: "YouTube" },
  { key: "twitter" as const, icon: Twitter, label: "Twitter / X" },
  { key: "tiktok" as const, icon: Music2, label: "TikTok" },
];

function cleanPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export default function ConnectPage() {
  const { settings, loading } = useShopSettings();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-accent/5 to-muted flex items-center justify-center p-4">
        <div className="w-full max-w-sm sm:max-w-md bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-5 animate-pulse">
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-muted" />
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-3 w-28 rounded bg-muted" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hidden = settings.hiddenSocialLinks || [];
  const visibleSocials = socialChannels.filter(
    (ch) => settings[ch.key] && !hidden.includes(ch.key)
  );

  const whatsappLink = settings.whatsappNumber
    ? `https://wa.me/${cleanPhone(settings.whatsappNumber)}?text=Hi%20${encodeURIComponent(settings.shopName)}`
    : null;

  const mapsLink = (settings.mapLat && settings.mapLng)
    ? `https://www.google.com/maps/dir/?api=1&destination=${settings.mapLat},${settings.mapLng}`
    : settings.address
      ? `https://www.google.com/maps/search/${encodeURIComponent(settings.address)}`
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-accent/5 via-white to-muted flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-sm sm:max-w-md bg-white rounded-2xl shadow-xl border border-border overflow-hidden">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center text-center gap-3">
            {settings.logoUrl && (
              <img
                src={settings.logoUrl}
                alt={settings.shopName}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-accent/20 shadow-sm"
              />
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-secondary">
                {settings.shopName}
              </h1>
              {settings.tagline && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {settings.tagline}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {settings.website && (
              <a
                href={settings.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-accent text-secondary font-semibold hover:bg-accent/90 transition-colors text-sm sm:text-base"
              >
                <Globe className="h-5 w-5" />
                Visit Website
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>
            )}

            {settings.phone && (
              <a
                href={`tel:${settings.phone}`}
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors text-sm sm:text-base"
              >
                <Phone className="h-5 w-5" />
                Call Now
              </a>
            )}

            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors text-sm sm:text-base"
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </a>
            )}

            {mapsLink && (
              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border-2 border-border bg-white text-secondary font-semibold hover:bg-muted transition-colors text-sm sm:text-base"
              >
                <MapPin className="h-5 w-5 text-accent" />
                Get Directions
                <ExternalLink className="h-3.5 w-3.5 opacity-40" />
              </a>
            )}
          </div>

          {visibleSocials.length > 0 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              {visibleSocials.map((ch) => (
                <a
                  key={ch.key}
                  href={settings[ch.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-secondary-foreground/10 flex items-center justify-center hover:bg-accent/20 hover:text-accent transition-all"
                  title={ch.label}
                >
                  <ch.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 sm:px-8 py-4">
          <button
            onClick={() => downloadVCard(settings)}
            className="flex items-center justify-center gap-2 w-full text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Save to Contacts
          </button>
        </div>
      </div>
    </div>
  );
}
