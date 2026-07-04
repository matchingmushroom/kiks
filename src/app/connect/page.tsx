"use client";

import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { downloadVCard } from "@/lib/vcard";
import { Globe, Phone, MessageCircle, MapPin, UserPlus, Facebook, Instagram, Youtube, Twitter, Music2, ExternalLink } from "lucide-react";

const socialChannels = [
  { key: "facebook" as const, icon: Facebook, label: "Facebook", color: "#1877F2" },
  { key: "instagram" as const, icon: Instagram, label: "Instagram", color: "#E4405F" },
  { key: "youtube" as const, icon: Youtube, label: "YouTube", color: "#FF0000" },
  { key: "twitter" as const, icon: Twitter, label: "Twitter / X", color: "#000000" },
  { key: "tiktok" as const, icon: Music2, label: "TikTok", color: "#000000" },
];

function cleanPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export default function ConnectPage() {
  const { settings, loading } = useShopSettings();

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%)" }}>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-sm sm:max-w-md bg-white/5 backdrop-blur-xl rounded-3xl p-6 sm:p-8 space-y-6 animate-pulse border border-white/10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-full bg-white/10" />
              <div className="h-6 w-44 rounded-lg bg-white/10" />
              <div className="h-3 w-28 rounded-lg bg-white/10" />
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-2xl bg-white/10" />
            ))}
            <div className="flex justify-center gap-4 pt-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-12 h-12 rounded-full bg-white/10" />
              ))}
            </div>
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
    ? `https://www.google.com/maps/search/${encodeURIComponent(settings.shopName)}/@${settings.mapLat},${settings.mapLng},17z`
    : settings.address
      ? `https://www.google.com/maps/search/${encodeURIComponent(settings.address)}`
      : null;

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #d4a853 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #b8860b 0%, transparent 70%)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #d4a853 0%, transparent 70%)" }} />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm sm:max-w-md backdrop-blur-xl rounded-3xl border overflow-hidden transition-all duration-500" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(212,168,83,0.2)" }}>
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col items-center text-center gap-4">
              {settings.logoUrl && (
                <div className="relative">
                  <div className="absolute inset-0 rounded-full animate-pulse opacity-50" style={{ background: "radial-gradient(circle, #d4a853 0%, transparent 70%)", filter: "blur(12px)", transform: "scale(1.3)" }} />
                  <img
                    src={settings.logoUrl}
                    alt={settings.shopName}
                    className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-2 ring-accent/40 shadow-lg shadow-accent/20"
                  />
                </div>
              )}
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #d4a853, #f5e6b8, #b8860b)" }}>
                  {settings.shopName}
                </h1>
                {settings.tagline && (
                  <p className="text-sm text-white/60 font-light tracking-wide">
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
                className="group relative flex items-center justify-center gap-2.5 w-full h-13 rounded-2xl overflow-hidden font-semibold text-sm sm:text-base transition-all duration-300 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #d4a853, #b8860b)", color: "#1a1a2e" }}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "linear-gradient(135deg, #f5e6b8, #d4a853)" }} />
                <Globe className="relative h-5 w-5" />
                <span className="relative">Visit Website</span>
              </a>

              {settings.phone && (
                <a
                  href={`tel:${settings.phone}`}
                  className="group relative flex items-center justify-center gap-2.5 w-full h-13 rounded-2xl overflow-hidden font-semibold text-sm sm:text-base transition-all duration-300 active:scale-[0.98] border" style={{ borderColor: "rgba(212,168,83,0.3)", color: "#d4a853" }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "linear-gradient(135deg, rgba(212,168,83,0.15), rgba(184,134,11,0.1))" }} />
                  <Phone className="relative h-5 w-5" />
                  <span className="relative">Call Now</span>
                </a>
              )}

              {whatsappLink && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex items-center justify-center gap-2.5 w-full h-13 rounded-2xl overflow-hidden font-semibold text-sm sm:text-base transition-all duration-300 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #25D366, #128C7E)", color: "#ffffff" }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "linear-gradient(135deg, #68f0a0, #25D366)" }} />
                  <MessageCircle className="relative h-5 w-5" />
                  <span className="relative">WhatsApp</span>
                </a>
              )}

              {mapsLink && (
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex items-center justify-center gap-2.5 w-full h-13 rounded-2xl overflow-hidden font-semibold text-sm sm:text-base transition-all duration-300 active:scale-[0.98] border" style={{ borderColor: "rgba(212,168,83,0.3)", color: "#ffffff" }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "linear-gradient(135deg, rgba(212,168,83,0.15), rgba(184,134,11,0.1))" }} />
                  <MapPin className="relative h-5 w-5" style={{ color: "#d4a853" }} />
                  <span className="relative">Get Directions</span>
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
                    className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 border" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)" }}
                    title={ch.label}
                  >
                    <ch.icon className="h-5 w-5 transition-colors duration-300" style={{ color: "rgba(255,255,255,0.6)" }} />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 sm:px-8 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => downloadVCard(settings)}
              className="group relative flex items-center justify-center gap-2.5 w-full h-12 rounded-2xl overflow-hidden font-medium text-sm transition-all duration-300 active:scale-[0.98]" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "linear-gradient(135deg, rgba(212,168,83,0.2), rgba(184,134,11,0.15))" }} />
              <UserPlus className="relative h-4 w-4" />
              <span className="relative">Save to Contacts</span>
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-0 right-0 text-center z-10">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
          Tap a button above to connect
        </p>
      </div>
    </div>
  );
}
