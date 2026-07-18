import { Timestamp } from "firebase/firestore";

const JEWELLERY_IMAGES = [
  "/images/jewellery-1.jpg", "/images/jewellery-2.jpg", "/images/jewellery-3.jpg",
  "/images/jewellery-4.jpg", "/images/jewellery-5.jpg", "/images/jewellery-6.jpg",
  "/images/jewellery-7.jpg", "/images/jewellery-8.jpg", "/images/jewellery-9.jpg",
  "/images/jewellery-10.jpg",
];

interface SampleProduct {
  name: string; description: string; design: string; categoryId: string;
  images: string[]; videoUrl: string; price: number; originalPrice?: number;
  badge: string; costPrice: number; weight: number; purity: string;
  metalType: string; stoneType: string; stoneWeight: number;
  makingCharge: number; warranty: string; sku: string;
  quantityInStock: number; isActive: boolean; isFeatured: boolean;
  brand: string; modelNo: string; baseMaterial: string;
  plating: string; color: string; productType: string;
  idealFor: string[]; netQuantity: number; occasion: string[];
  createdAt: unknown; updatedAt: unknown;
}

const brands = ["TONOLIKA JEWELLERY", "Vivanta", "TAGADO", "RIENTA JWL", "J B JEWELLS", "OChori", "brado jewellery", "KEYMAX", "TheSanga", "BRILLIANT BEADS JEWELS", "Shree Ju", "OmKrishiv", "evashoppy", "AVR JEWELS", "MAME CREATION", "KONASA", "ZENEME", "Soumi store", "RARE ONE STUDIO", "Divine rudras"];
const baseMaterials = ["Brass", "Alloy", "Copper", "Stainless Steel", "Silver", "Gold", "Plastic", "Steel"];
const platings = ["Gold-plated", "Silver-plated", "Rhodium", "Rose Gold-plated", "Sterling Silver", "Antique", "Matte", "Polished"];
const colors = ["Gold", "Silver", "Multicolor", "White", "Pink", "Green", "Red", "Blue", "Black", "Rose Gold", "Purple", "Peach", "Cream", "Brown", "Copper"];
const productTypes = ["Jewel Set", "Necklace", "Earrings", "Bracelet", "Ring", "Mangalsutra Set", "Pendant Set", "Chain", "Bangles", "Nosepin", "Anklet", "Brooch", "Hair Accessory"];
const idealFor = ["Women", "Men", "Girls", "Boys", "Unisex", "Women & Girls", "Men & Boys"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN<T>(arr: T[], n: number = 3): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }

const descriptions = [
  "Beautifully crafted artificial jewellery set perfect for weddings and festive occasions. Lightweight and comfortable for daily wear.",
  "Elegant design with intricate detailing. Made from premium quality materials that ensure long-lasting shine and durability.",
  "Add a touch of tradition to your outfit with this stunning piece. Great craftsmanship at an affordable price.",
  "Versatile jewellery piece that complements both traditional and modern attire. A must-have for your collection.",
  "Stylish and trendy design featuring fine finish and attention to detail. Ideal for parties and celebrations.",
  "Exquisite piece with a timeless appeal. The perfect accessory to elevate any look effortlessly.",
  "Handcrafted with precision and care. Features a beautiful blend of traditional and contemporary elements.",
  "Eye-catching design that adds glamour to any ensemble. Lightweight construction ensures all-day comfort.",
  "Gorgeous jewellery set with sparkling stones and elegant patterns. Makes a great gift for loved ones.",
  "Premium quality artificial jewellery designed to impress. Combines classic beauty with modern aesthetics.",
];

function img(id: number, i: number): string {
  return `https://picsum.photos/seed/jewellery${id}-${i}/400/400`;
}

export function generateSampleProducts(categoryId: string): SampleProduct[] {
  const products: SampleProduct[] = [];

  for (let i = 1; i <= 100; i++) {
    const brand = pick(brands);
    const base = pick(baseMaterials);
    const plate = pick(platings);
    const col = pick(colors);
    const type = pick(productTypes);
    const forWhom = pick(idealFor);
    const desc = pick(descriptions);
    const price = randInt(89, 999);
    const stock = randInt(0, 50);
    const now = Timestamp.fromDate(new Date());

    products.push({
      name: `${brand} ${base} ${plate} ${col} ${type}`,
      description: desc,
      design: `DS-${String(1000 + i).slice(-4)}`,
      categoryId,
      images: [img(i, 1), img(i, 2), img(i, 3), img(i, 4)],
      videoUrl: "",
      price,
      badge: "none",
      costPrice: Math.round(price * 0.5),
      weight: parseFloat((Math.random() * 20 + 2).toFixed(1)),
      purity: pick(["24K", "22K", "18K", "14K", "92.5% Silver"]),
      metalType: pick(["Gold", "Silver", "Rose Gold", "White Gold"]),
      stoneType: pick(["None", "Cubic Zirconia", "Pearl", "Ruby", "Emerald"]),
      stoneWeight: parseFloat((Math.random() * 3).toFixed(2)),
      makingCharge: randInt(0, 500),
      warranty: pick(["No warranty", "3 months", "6 months", "1 year"]),
      sku: `SKU-ART-${String(1000 + i).slice(-4)}`,
      quantityInStock: stock,
      isActive: true,
      isFeatured: Math.random() > 0.85,
      brand,
      modelNo: `MOD-ART-${String(2024 + i).slice(-4)}`,
      baseMaterial: base,
      plating: plate,
      color: col,
      productType: type,
      idealFor: [forWhom],
      netQuantity: randInt(1, 5),
      occasion: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  return products;
}
