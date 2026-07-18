import type { Metadata } from "next";
import { Playfair_Display, Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ShopSettingsProvider } from "@/contexts/ShopSettingsContext";
import DynamicTitle from "@/components/DynamicTitle";

const playfair = Playfair_Display({
  variable: "--font-heading", subsets: ["latin"], display: "swap",
});
const poppins = Poppins({
  variable: "--font-sans", subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"], display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono", subsets: ["latin"], display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Admin - Jewellery Shop", template: "%s - Admin" },
  icons: { icon: "/logo.svg", apple: "/logo.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${poppins.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ShopSettingsProvider>
            <DynamicTitle />
            {children}
          </ShopSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
