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
  { name: "Earrings", shortCode: "ER", subCategories: ["Tops/Stud", "Jhumka", "Chandbali", "Bali (Hoop)", "Hanging", "Drop", "Ear Cuff", "Pearl", "AD", "Kundan", "Oxidized", "Clip-on"], description: "Studs, jhumka, hoops & more", order: 0, isActive: true },
  { name: "Necklace", shortCode: "NC", subCategories: ["Choker", "Necklace Set", "Long Haar", "Short Necklace", "Pendant Necklace", "Layered Necklace", "Statement Necklace", "Pearl Necklace", "AD Necklace", "Kundan Necklace", "Temple Necklace", "Oxidized Necklace"], description: "Chokers, sets & pendants", order: 1, isActive: true },
  { name: "Chain", shortCode: "CH", subCategories: ["Plain Chain", "Fancy Chain", "Box Chain", "Rope Chain", "Snake Chain", "Beaded Chain", "Pendant Chain"], description: "Plain, fancy & designer chains", order: 2, isActive: true },
  { name: "Pendant", shortCode: "PN", subCategories: ["Religious", "Alphabet", "Heart", "Floral", "Pearl", "AD", "CZ", "Couple Pendant", "Modern Pendant"], description: "Religious, alphabet & designer pendants", order: 3, isActive: true },
  { name: "Ring", shortCode: "RG", subCategories: ["Adjustable Ring", "Band Ring", "Cocktail Ring", "Solitaire Style", "Couple Ring", "Pearl Ring", "AD Ring", "Kundan Ring", "Statement Ring"], description: "Adjustable, band & cocktail rings", order: 4, isActive: true },
  { name: "Bracelet", shortCode: "BR", subCategories: ["Chain Bracelet", "Charm Bracelet", "Tennis Bracelet", "Pearl Bracelet", "Beaded Bracelet", "Kada Bracelet", "Thread Bracelet", "Adjustable Bracelet"], description: "Chains, charms & adjustable", order: 5, isActive: true },
  { name: "Bangles", shortCode: "BG", subCategories: ["Plain Bangles", "Stone Bangles", "Bridal Bangles", "Openable Bangles", "Kada Style", "Stack Bangles", "Designer Bangles"], description: "Plain, stone & bridal bangles", order: 6, isActive: true },
  { name: "Mangalsutra", shortCode: "MS", subCategories: ["Short Mangalsutra", "Long Mangalsutra", "Pendant Mangalsutra", "AD Mangalsutra", "Daily Wear Mangalsutra"], description: "Short, long & pendant mangalsutras", order: 7, isActive: true },
  { name: "Tika & Head Jewellery", shortCode: "TJ", subCategories: ["Maang Tikka", "Bridal Tikka", "Matha Patti", "Passa", "Borla"], description: "Tikka, matha patti & head ornaments", order: 8, isActive: true },
  { name: "Nose Jewellery", shortCode: "NP", subCategories: ["Nose Pin", "Nose Stud", "Nose Ring", "Nath", "Clip-on Nath"], description: "Nose pins, studs & nath", order: 9, isActive: true },
  { name: "Anklets", shortCode: "AK", subCategories: ["Plain Anklet", "Charm Anklet", "Pearl Anklet", "Stone Anklet", "Oxidized Anklet", "Adjustable Anklet"], description: "Plain, charm & pearl anklets", order: 10, isActive: true },
  { name: "Toe Rings", shortCode: "TR", subCategories: ["Plain", "Stone", "Adjustable", "Pearl", "Oxidized"], description: "Plain, stone & adjustable toe rings", order: 11, isActive: true },
  { name: "Hair Accessories", shortCode: "HA", subCategories: ["Juda Pin", "Hair Clip", "Hair Comb", "Hair Pin", "Tiara", "Hair Vine"], description: "Hair pins, clips & tiaras", order: 12, isActive: true },
  { name: "Jewellery Sets", shortCode: "JS", subCategories: ["Necklace Set", "Choker Set", "AD Set", "Pearl Set", "Kundan Set", "Temple Set", "Oxidized Set", "Party Set"], description: "Complete jewellery sets", order: 13, isActive: true },
  { name: "Bridal Collection", shortCode: "BC", subCategories: ["Bridal Necklace", "Bridal Earrings", "Bridal Bangles", "Bridal Nath", "Bridal Tikka", "Bridal Set"], description: "Bridal essentials", order: 14, isActive: true },
  { name: "Men's Jewellery", shortCode: "MJ", subCategories: ["Chain", "Bracelet", "Kada", "Ring", "Pendant"], description: "Men's chains, kada & rings", order: 15, isActive: true },
  { name: "Kids Jewellery", shortCode: "KJ", subCategories: ["Earrings", "Necklace", "Bracelet", "Ring", "Jewellery Set"], description: "Jewellery for kids", order: 16, isActive: true },
  { name: "Accessories", shortCode: "AC", subCategories: ["Jewellery Box", "Gift Box", "Jewellery Organizer", "Cleaning Cloth", "Travel Case"], description: "Storage, boxes & organizers", order: 17, isActive: true },
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
        showOnHomepage: true,
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
