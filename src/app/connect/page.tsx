"use client";

import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { downloadVCard } from "@/lib/vcard";
import { Globe, Phone, MessageCircle, MapPin, UserPlus, Facebook, Instagram, Youtube, Twitter, Music2 } from "lucide-react";

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
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm sm:max-w-md bg-white rounded-xl border border-border shadow-sm p-6 sm:p-8 space-y-5 animate-pulse">
          <div className="flex flex-col items-center gap-3">
            <div className="w-36 h-16 bg-muted rounded-lg" />
            <div className="h-6 w-44 bg-muted rounded-lg" />
            <div className="h-3 w-28 bg-muted rounded-lg" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-muted rounded-full" />
          ))}
          <div className="flex justify-center gap-3 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-9 h-9 bg-muted rounded-full" />
            ))}
          </div>
          <div className="h-4 w-32 bg-muted rounded-lg mx-auto" />
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
    ? `https://www.google.com/maps/search/${encodeURIComponent(settings.shopName)}/@${settings.mapLat},${settings.mapLng},17z`
    : settings.address
      ? `https://www.google.com/maps/search/${encodeURIComponent(settings.address)}`
      : null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm sm:max-w-md">
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex flex-col items-center text-center gap-4">
                {settings.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt={settings.shopName}
                    className="max-w-[180px] h-auto object-contain"
                  />
                )}
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-secondary">
                    {settings.shopName}
                  </h1>
                  {settings.tagline && (
                    <p className="text-sm text-muted-foreground">
                      {settings.tagline}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <a
                  href="https://www.panchakanyacollections.com.np"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 w-full h-12 bg-accent text-secondary font-semibold rounded-full hover:bg-accent/90 transition-colors active:scale-[0.98]"
                >
                  <Globe className="h-5 w-5" />
                  <span>Visit Website</span>
                </a>

                {settings.phone && (
                  <a
                    href={`tel:${settings.phone}`}
                    className="flex items-center justify-center gap-2.5 w-full h-12 border-2 border-accent text-accent font-semibold rounded-full hover:bg-accent/10 transition-colors active:scale-[0.98]"
                  >
                    <Phone className="h-5 w-5" />
                    <span>Call Now</span>
                  </a>
                )}

                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2.5 w-full h-12 font-semibold rounded-full transition-colors active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg, #25D366, #128C7E)", color: "#ffffff" }}
                  >
                    <MessageCircle className="h-5 w-5" />
                    <span>WhatsApp</span>
                  </a>
                )}

                {mapsLink && (
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2.5 w-full h-12 border-2 border-accent text-accent font-semibold rounded-full hover:bg-accent/10 transition-colors active:scale-[0.98]"
                  >
                    <MapPin className="h-5 w-5" />
                    <span>Get Directions</span>
                  </a>
                )}
              </div>

              {visibleSocials.length > 0 && (
                <div className="flex items-center justify-center gap-3 pt-1">
                  {visibleSocials.map((ch) => (
                    <a
                      key={ch.key}
                      href={settings[ch.key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-secondary transition-all border border-border"
                      title={ch.label}
                    >
                      <ch.icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="text-center mt-6">
            <button
              onClick={() => downloadVCard(settings)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              <span>Save to Contacts</span>
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground/60 mt-4">
            Tap a button above to connect
          </p>
        </div>
      </div>
    </div>
  );
}
