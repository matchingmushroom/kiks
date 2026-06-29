"use client";

import Link from "next/link";
import { Facebook, Instagram, Youtube, Twitter } from "lucide-react";
import { useShopSettings } from "@/contexts/ShopSettingsContext";

const socialChannels = [
  { key: "facebook" as const, icon: Facebook, label: "Facebook" },
  { key: "instagram" as const, icon: Instagram, label: "Instagram" },
  { key: "youtube" as const, icon: Youtube, label: "YouTube" },
  { key: "twitter" as const, icon: Twitter, label: "Twitter / X" },
];

export default function ShopFooter() {
  const { settings } = useShopSettings();

  const socialLinks = socialChannels.filter((ch) => settings[ch.key]);

  return (
    <footer className="bg-secondary text-secondary-foreground py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <img src={settings.logoUrl || "/logo.svg"} alt={settings.shopName} className="h-10 mb-4" />
            <p className="text-sm text-secondary-foreground/70 mb-4">{settings.tagline}</p>
            {socialLinks.length > 0 && (
              <div className="flex items-center gap-3">
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
            )}
          </div>
          <div>
            <h3 className="font-semibold mb-3">Quick Links</h3>
            <div className="space-y-2 text-sm text-secondary-foreground/70">
              <Link href="/products" className="block hover:text-accent">Products</Link>
              <Link href="/cart" className="block hover:text-accent">Cart</Link>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Contact</h3>
            <div className="space-y-2 text-sm text-secondary-foreground/70">
              <p>{settings.address}</p>
              <p>{settings.phone}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-secondary-foreground/20 mt-8 pt-8 text-center text-sm text-secondary-foreground/50">
          &copy; {new Date().getFullYear()} {settings.shopName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
