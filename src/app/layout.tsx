import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { ShopSettingsProvider } from "@/contexts/ShopSettingsContext";
import DynamicTitle from "@/components/DynamicTitle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteName = process.env.NEXT_PUBLIC_SHOP_NAME || "KIKS Collections";

export const metadata: Metadata = {
  title: {
    default: `${siteName} - Exquisite Jewellery`,
    template: `%s - ${siteName}`,
  },
  description: "Premium jewellery shop in Nepal — Rings, Necklaces, Earrings, Bracelets and more. Handcrafted gold and silver jewellery with purity certification.",
  keywords: ["jewellery", "gold", "rings", "necklaces", "Nepal", siteName, "earrings", "bracelets"],
  openGraph: {
    title: `${siteName} - Exquisite Jewellery`,
    description: "Premium jewellery shop in Nepal — Rings, Necklaces, Earrings, Bracelets and more.",
    siteName,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <CartProvider>
            <ShopSettingsProvider>
              <DynamicTitle />
              {children}
            </ShopSettingsProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
