"use client";

import Link from "next/link";
import { useShopSettings } from "@/contexts/ShopSettingsContext";

export default function ShopFooter() {
  const { settings } = useShopSettings();

  return (
    <footer className="bg-secondary text-secondary-foreground py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <img src={settings.logoUrl || "/logo.svg"} alt={settings.shopName} className="h-10 mb-4" />
            <p className="text-sm text-secondary-foreground/70">{settings.tagline}</p>
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
