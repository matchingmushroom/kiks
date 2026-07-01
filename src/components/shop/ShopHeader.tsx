"use client";

import Link from "next/link";
import { Menu, X, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";

export default function ShopHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { totalItems } = useCart();
  const { settings } = useShopSettings();

  return (
    <header className="bg-white text-foreground border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link href="/" className="flex items-center gap-2">
            <img src={settings.logoUrl || "/logo.svg"} alt={settings.shopName} className="h-10 sm:h-12 w-auto object-contain" />
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium hover:text-accent transition-colors">Home</Link>
            <Link href="/products" className="text-sm font-medium hover:text-accent transition-colors">Products</Link>
            <Link href="/cart" className="relative text-sm font-medium hover:text-accent transition-colors">
              <ShoppingBag className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-accent text-secondary text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
            </Link>
          </nav>
          <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border px-4 py-4 space-y-3">
          <Link href="/" className="block text-sm hover:text-accent" onClick={() => setMobileMenuOpen(false)}>Home</Link>
          <Link href="/products" className="block text-sm hover:text-accent" onClick={() => setMobileMenuOpen(false)}>Products</Link>
          <Link href="/cart" className="block text-sm hover:text-accent" onClick={() => setMobileMenuOpen(false)}>
            Cart ({totalItems})
          </Link>
        </div>
      )}
    </header>
  );
}
