"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Product } from "@/types";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProductDetailClient from "@/components/shop/ProductDetailClient";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";
import Link from "next/link";

function extractGoogleDriveId(url: string): string | null {
  const m = url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/?#&]+)/);
  return m ? m[1] : null;
}

function fixImageUrl(url: string): string {
  const gd = extractGoogleDriveId(url);
  if (gd) return `https://drive.google.com/thumbnail?id=${gd}&sz=w400`;
  const match = url.match(/images\.unsplash\.com\/photo-([^?]+)/);
  if (match) return `https://unsplash.com/photos/${match[1]}/download?w=400`;
  return url;
}

function ProductViewerContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) { setLoading(false); setError("No product ID specified"); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "products", id));
        if (cancelled) return;
        if (snap.exists()) {
          const p = { id: snap.id, ...snap.data() } as Product;
          if (p.images) p.images = p.images.map(fixImageUrl);
          setProduct(p);
        } else {
          setError("Product not found");
        }
      } catch (e: any) {
        if (cancelled) return;
        console.error("Product fetch failed", e);
        setError("Failed to load product. Please try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
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

export default function ProductViewerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex flex-col">
        <ShopHeader />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-muted-foreground">Loading...</p>
        </main>
        <ShopFooter />
      </div>
    }>
      <ProductViewerContent />
    </Suspense>
  );
}
