import { doc, getDoc, Timestamp } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { Product } from "@/types";
import ProductDetailClient from "@/components/shop/ProductDetailClient";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";
import Link from "next/link";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      result[key] = value.toMillis();
    } else if (Array.isArray(value)) {
      result[key] = value;
    } else if (value !== null && typeof value === "object") {
      result[key] = JSON.parse(JSON.stringify(value));
    } else {
      result[key] = value;
    }
  }
  return result;
}

function fixImageUrl(url: string): string {
  const match = url.match(/images\.unsplash\.com\/photo-([^?]+)/);
  if (match) {
    return `https://unsplash.com/photos/${match[1]}/download?w=400`;
  }
  return url;
}

async function getProduct(id: string): Promise<Product | null> {
  if (!firebaseConfig.projectId) return null;
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getFirestore(app);
    const snap = await getDoc(doc(db, "products", id));
    if (snap.exists()) {
      const product = { id: snap.id, ...sanitize(snap.data()) } as Product;
      if (product.images) product.images = product.images.map(fixImageUrl);
      return product;
    }
  } catch {}
  return null;
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <ShopHeader />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-muted-foreground mb-4">Product not found</p>
          <Link href="/products" className="text-primary hover:underline">Browse all products</Link>
        </main>
        <ShopFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ShopHeader />
      <ProductDetailClient product={product} />
      <ShopFooter />
    </div>
  );
}
