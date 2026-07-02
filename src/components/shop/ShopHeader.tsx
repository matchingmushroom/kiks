"use client";

import Link from "next/link";
import { Menu, X, ShoppingBag, Search, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useCart } from "@/contexts/CartContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { useFirestore, where, orderBy } from "@/hooks/useFirestore";
import { Category } from "@/types";

export default function ShopHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { totalItems } = useCart();
  const { settings } = useShopSettings();
  const { data: categories } = useFirestore<Category>("categories", {
    constraints: [where("isActive", "==", true), orderBy("order", "asc")],
    realtime: false,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <header className="bg-white text-foreground border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link href="/" className="flex items-center gap-2 shrink-0 bg-muted/30 px-3 py-1.5 rounded-xl">
            <img src={settings.logoUrl || "/logo.svg"} alt={settings.shopName} className="h-14 sm:h-20 w-auto object-contain drop-shadow-sm" />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/" className="px-3 py-2 text-sm font-medium hover:text-accent transition-colors rounded-lg hover:bg-muted">Home</Link>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium hover:text-accent transition-colors rounded-lg hover:bg-muted"
              >
                Shop <ChevronDown className={`h-3.5 w-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && categories.length > 0 && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-border rounded-xl shadow-lg py-2 min-w-[200px] z-50">
                  <Link href="/products" className="block px-4 py-2 text-sm font-medium text-accent hover:bg-muted" onClick={() => setDropdownOpen(false)}>
                    All Products
                  </Link>
                  <div className="border-t border-border my-1" />
                  {categories.filter((c) => c.showOnHomepage !== false).map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/products/${cat.id}`}
                      className="block px-4 py-2 text-sm hover:bg-muted hover:text-accent transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link href="/products" className="px-3 py-2 text-sm font-medium hover:text-accent transition-colors rounded-lg hover:bg-muted">Products</Link>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearch(!showSearch)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Search">
              <Search className="h-5 w-5 text-muted-foreground" />
            </button>
            <Link href="/cart" className="relative p-2 hover:bg-muted rounded-lg transition-colors">
              <ShoppingBag className="h-5 w-5 text-muted-foreground" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-accent text-secondary text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
            </Link>
            <button className="md:hidden p-2 hover:bg-muted rounded-lg" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
      {showSearch && (
        <div className="border-t border-border bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button type="submit" className="px-4 py-2 bg-accent text-secondary font-medium rounded-lg text-sm hover:bg-accent/90 transition-colors">
                Search
              </button>
            </form>
          </div>
        </div>
      )}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border px-4 py-4 space-y-1 bg-white">
          <Link href="/" className="block px-3 py-2 text-sm hover:text-accent rounded-lg hover:bg-muted" onClick={() => setMobileMenuOpen(false)}>Home</Link>
          <Link href="/products" className="block px-3 py-2 text-sm font-medium text-accent rounded-lg hover:bg-muted" onClick={() => setMobileMenuOpen(false)}>All Products</Link>
          {categories.filter((c) => c.showOnHomepage !== false).map((cat) => (
            <Link
              key={cat.id}
              href={`/products/${cat.id}`}
              className="block px-3 py-2 text-sm hover:text-accent rounded-lg hover:bg-muted"
              onClick={() => setMobileMenuOpen(false)}
            >
              {cat.name}
            </Link>
          ))}
          <Link href="/cart" className="block px-3 py-2 text-sm hover:text-accent rounded-lg hover:bg-muted" onClick={() => setMobileMenuOpen(false)}>
            Cart ({totalItems})
          </Link>
        </div>
      )}
    </header>
  );
}
