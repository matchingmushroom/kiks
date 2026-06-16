"use client";

import { useState, useEffect } from "react";
import { Product } from "@/types";
import { getDocument } from "@/lib/firestoreRest";
import ProductDetailClient from "@/components/shop/ProductDetailClient";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";
import Link from "next/link";
import { useParams } from "next/navigation";

function fixImageUrl(url: string): string {
  const match = url.match(/images\.unsplash\.com\/photo-([^?]+)/);
  if (match) return `https://unsplash.com/photos/${match[1]}/download?w=400`;
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    (async () => {
      try {
        const p = await getDocument<Product>("products", id, controller.signal);
        if (cancelled) return;
        if (p) {
          if (p.images) p.images = p.images.map(fixImageUrl);
          setProduct(p);
        } else {
          setError("Product not found");
        }
      } catch (e: any) {
        if (cancelled) return;
        if (e.name === "AbortError") {
          setError("Product data is taking longer than expected. Please check your connection and try again.");
        } else {
          console.error("Product fetch failed", e);
          setError("Failed to load product. Please try again later.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
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
