"use client";

import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { downloadVCard } from "@/lib/vcard";
import { Globe, Phone, MessageCircle, MapPin, UserPlus, Gift, Award, Sparkles, ArrowUpRight } from "lucide-react";
import { FaFacebook, FaInstagram, FaYoutube, FaTwitter } from "react-icons/fa";
import { FaTiktok } from "react-icons/fa6";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";

const socialChannels = [
  { key: "facebook" as const, icon: FaFacebook, label: "Facebook" },
  { key: "instagram" as const, icon: FaInstagram, label: "Instagram" },
  { key: "youtube" as const, icon: FaYoutube, label: "YouTube" },
  { key: "twitter" as const, icon: FaTwitter, label: "Twitter / X" },
  { key: "tiktok" as const, icon: FaTiktok, label: "TikTok" },
];

function cleanPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export default function ConnectPage() {
  const { settings, loading } = useShopSettings();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="h-16 bg-white border-b border-border/60" />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm sm:max-w-md space-y-5 animate-pulse">
            <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 bg-muted rounded-full" />
              <div className="h-7 w-44 bg-muted rounded-lg" />
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
          </div>
        </div>
      </div>
    );
  }

  const hidden = settings.hiddenSocialLinks || [];
  const visibleSocials = socialChannels.filter(
    (ch) => settings[ch.key] && !hidden.includes(ch.key)
  );

  const websiteUrl = settings.website
    ? settings.website.match(/^https?:\/\//)
      ? settings.website
      : `https://${settings.website}`
    : null;

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
      <ShopHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-b from-amber-50/80 via-white to-white pb-16 pt-8 sm:pt-16">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-amber-100/30 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-lg mx-auto px-4 sm:px-6">
            <div className="text-center mb-8 sm:mb-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent/10 rounded-full text-accent text-xs font-semibold tracking-wide mb-4">
                <Sparkles className="h-3.5 w-3.5" />
                CONNECT WITH US
              </div>
              <div className="flex flex-col items-center gap-4 mb-4">
                {settings.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt={settings.shopName}
                    className="max-w-[200px] sm:max-w-[240px] h-auto object-contain"
                  />
                )}
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-secondary">
                    {settings.shopName}
                  </h1>
                  {settings.tagline && (
                    <p className="text-sm text-muted-foreground mt-1">{settings.tagline}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-black/5 border border-border/60 p-5 sm:p-8 space-y-3">
              {websiteUrl && (
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center gap-4 w-full p-3.5 sm:p-4 rounded-xl border border-border/60 hover:border-accent/30 hover:bg-accent/5 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Globe className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-secondary">Visit Website</p>
                    <p className="text-xs text-muted-foreground/60 truncate">{websiteUrl.replace(/^https?:\/\//, "")}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-accent transition-colors shrink-0" />
                </a>
              )}

              {settings.phone && (
                <a href={`tel:${settings.phone}`}
                  className="group flex items-center gap-4 w-full p-3.5 sm:p-4 rounded-xl border border-border/60 hover:border-accent/30 hover:bg-accent/5 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Phone className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-secondary">Call Now</p>
                    <p className="text-xs text-muted-foreground/60">{settings.phone}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-accent transition-colors shrink-0" />
                </a>
              )}

              {whatsappLink && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center gap-4 w-full p-3.5 sm:p-4 rounded-xl border border-border/60 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <MessageCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-secondary">WhatsApp</p>
                    <p className="text-xs text-muted-foreground/60">Chat with us</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-emerald-600 transition-colors shrink-0" />
                </a>
              )}

              {mapsLink && (
                <a href={mapsLink} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center gap-4 w-full p-3.5 sm:p-4 rounded-xl border border-border/60 hover:border-accent/30 hover:bg-accent/5 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <MapPin className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-secondary">Get Directions</p>
                    <p className="text-xs text-muted-foreground/60 truncate">{settings.address || "Find us on Maps"}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-accent transition-colors shrink-0" />
                </a>
              )}

              <div className="border-t border-border/40 pt-3 mt-3">
                {settings.loyaltyEnabled && (
                  <>
                    <a href="/loyalty/register"
                      className="group flex items-center gap-4 w-full p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20 hover:from-accent/20 hover:to-primary/20 transition-all mb-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-lg shadow-accent/20">
                        <Gift className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-secondary">Join Loyalty Program</p>
                        <p className="text-xs text-muted-foreground/60">Earn points on every purchase</p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-accent/60 group-hover:text-accent transition-colors shrink-0" />
                    </a>
                    <a href="/loyalty/check"
                      className="group flex items-center gap-4 w-full p-3.5 sm:p-4 rounded-xl border border-border/60 hover:border-accent/30 hover:bg-accent/5 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Award className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-secondary">Check Loyalty Points</p>
                        <p className="text-xs text-muted-foreground/60">View your balance &amp; history</p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-accent transition-colors shrink-0" />
                    </a>
                  </>
                )}
              </div>

              {visibleSocials.length > 0 && (
                <div className="border-t border-border/40 pt-4 sm:pt-5 mt-2">
                  <p className="text-xs font-semibold text-muted-foreground tracking-wide uppercase text-center mb-3">Follow Us</p>
                  <div className="flex items-center justify-center gap-2.5">
                    {visibleSocials.map((ch) => (
                      <a key={ch.key} href={settings[ch.key]} target="_blank" rel="noopener noreferrer"
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-secondary transition-all border border-border/60 hover:border-accent/40 active:scale-90"
                        title={ch.label}>
                        <ch.icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="text-center mt-6 space-y-3">
              <button onClick={() => downloadVCard(settings)}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors">
                <UserPlus className="h-4 w-4" />
                <span>Save to Contacts</span>
              </button>
              <p className="text-xs text-muted-foreground/40">Tap a link above to connect</p>
            </div>
          </div>
        </section>
      </main>
      <ShopFooter />
    </div>
  );
}
