import type { Metadata } from "next";
import { Playfair_Display, Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { ShopSettingsProvider } from "@/contexts/ShopSettingsContext";
import DynamicTitle from "@/components/DynamicTitle";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const playfair = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteName = process.env.NEXT_PUBLIC_SHOP_NAME || "Jewellery Shop";

export const metadata: Metadata = {
  title: {
    default: `${siteName} - Premium Jewellery`,
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
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${poppins.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <CartProvider>
            <ShopSettingsProvider>
              <DynamicTitle />
              <ServiceWorkerRegister />
              {children}
            </ShopSettingsProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
