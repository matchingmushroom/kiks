"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Product } from "@/types";
import ProductDetailClient from "@/components/shop/ProductDetailClient";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";
import Link from "next/link";
import { useParams } from "next/navigation";

function fixImageUrl(url: string): string {
  const match = url.match(/images\.unsplash\.com\/photo-([^?]+)/);
  if (match) {
    return `https://unsplash.com/photos/${match[1]}/download?w=400`;
  }
  return url;
}

export default function ProductPage() {
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const timer = setTimeout(() => {
      if (!cancelled) {
        setError("Product data is taking longer than expected. Please check your connection and try again.");
      }
    }, 15000);

    (async () => {
      try {
        const snap = await getDoc(doc(db, "products", id));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          const result: Record<string, unknown> = { id: snap.id };
          for (const [key, value] of Object.entries(data)) {
            if (value instanceof Timestamp) {
              result[key] = value.toMillis();
            } else {
              result[key] = value;
            }
          }
          const p = result as unknown as Product;
          if (p.images) p.images = p.images.map(fixImageUrl);
          if (!cancelled) setProduct(p);
        } else {
          if (!cancelled) setError("Product not found");
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Product fetch failed", e);
          setError("Failed to load product. Please try again later.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <ShopHeader />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-muted-foreground">Loading product...</p>
        </main>
        <ShopFooter />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <ShopHeader />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-muted-foreground mb-4">{error || "Product not found"}</p>
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