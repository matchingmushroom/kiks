"use client";

import { useEffect } from "react";
import { useShopSettings } from "@/contexts/ShopSettingsContext";

export default function DynamicTitle() {
  const { settings } = useShopSettings();
  useEffect(() => {
    const name = settings.shopName || "KIKS Collections";
    const tagline = settings.tagline || "Exquisite Jewellery";
    document.title = `${name} - ${tagline}`;
  }, [settings.shopName, settings.tagline]);
  return null;
}
