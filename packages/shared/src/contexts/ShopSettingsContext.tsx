"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShopSettings } from "@/types";
import { setUseBsCalendar } from "@/lib/utils";

const defaultSettings: ShopSettings = {
  shopName: "KIKS Collections",
  tagline: "Exquisite Jewellery",
  logoUrl: "/logo.svg",
  phone: "+977-XXXXXXXXX",
  address: "Kathmandu, Nepal",
  whatsappNumber: "977XXXXXXXXX",
  currency: "NPR",
  facebook: "",
  instagram: "",
  youtube: "",
  twitter: "",
  tiktok: "",
  hiddenSocialLinks: [],
};

interface ShopSettingsContextType {
  settings: ShopSettings;
  loading: boolean;
}

const ShopSettingsContext = createContext<ShopSettingsContextType>({
  settings: defaultSettings,
  loading: true,
});

export function ShopSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ShopSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "shop_settings", "config"),
      (docSnap) => {
        if (docSnap.exists()) {
          const s = docSnap.data() as ShopSettings;
          setSettings(s);
          setUseBsCalendar(!!s.useBsCalendar);
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return (
    <ShopSettingsContext.Provider value={{ settings, loading }}>
      {children}
    </ShopSettingsContext.Provider>
  );
}

export function useShopSettings() {
  return useContext(ShopSettingsContext);
}
