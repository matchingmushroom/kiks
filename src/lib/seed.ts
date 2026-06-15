import { setDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

const defaultSettings = {
  shopName: "KIKS Collections",
  tagline: "Exquisite Jewellery Since 2020",
  logoUrl: "/logo.svg",
  phone: "+977-XXXXXXXXX",
  address: "Kathmandu, Nepal",
  whatsappNumber: "977XXXXXXXXX",
  currency: "NPR",
};

const defaultCategories = [
  { name: "Rings", description: "Gold, silver & diamond rings", order: 0, isActive: true },
  { name: "Necklaces", description: "Elegant necklaces & pendants", order: 1, isActive: true },
  { name: "Earrings", description: "Studs, hoops & danglers", order: 2, isActive: true },
  { name: "Bracelets", description: "Bangles & bracelets", order: 3, isActive: true },
  { name: "Nosepins", description: "Traditional & modern nosepins", order: 4, isActive: true },
];

const defaultSections = [
  {
    type: "hero",
    title: "Exquisite Jewellery for Every Occasion",
    subtitle: "Discover our collection of handcrafted gold, silver, and diamond jewellery.",
    order: 0,
    isVisible: true,
    config: { ctaText: "Shop Now", ctaLink: "/products" },
  },
  {
    type: "category_grid",
    title: "Our Collection",
    subtitle: "Browse our curated categories",
    order: 1,
    isVisible: true,
    config: {},
  },
  {
    type: "featured_products",
    title: "Featured Products",
    subtitle: "Our most popular pieces",
    order: 2,
    isVisible: true,
    config: { maxProducts: 8 },
  },
  {
    type: "new_arrivals",
    title: "New Arrivals",
    subtitle: "Latest additions to our collection",
    order: 3,
    isVisible: true,
    config: { maxDays: 30 },
  },
];

export async function initializeShopData() {
  const results: string[] = [];

  try {
    await setDoc(doc(db, "shop_settings", "config"), defaultSettings);
    results.push("✅ Shop settings created");
  } catch (e) {
    results.push(`❌ Shop settings: ${e}`);
  }

  try {
    for (const cat of defaultCategories) {
      const id = cat.name.toLowerCase().replace(/\s+/g, "_");
      await setDoc(doc(db, "categories", id), {
        ...cat,
        image: "",
        createdAt: Timestamp.fromDate(new Date()),
      });
    }
    results.push("✅ Categories created");
  } catch (e) {
    results.push(`❌ Categories: ${e}`);
  }

  try {
    for (const section of defaultSections) {
      const id = section.type;
      await setDoc(doc(db, "sections", id), {
        ...section,
        createdAt: Timestamp.fromDate(new Date()),
      });
    }
    results.push("✅ Homepage sections created");
  } catch (e) {
    results.push(`❌ Sections: ${e}`);
  }

  return results;
}
