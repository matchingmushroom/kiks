"use client";

import { useState, useEffect } from "react";
import { useFirestore, where } from "@/hooks/useFirestore";
import { Product, Category } from "@/types";
import ProductCard from "@/components/shop/ProductCard";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";

export default function ProductsPage() {
  useEffect(() => { document.title = "Products - KIKS Collections"; }, []);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { data: categories } = useFirestore<Category>("categories", {
    constraints: [where("isActive", "==", true)],
  });
  const { data: products, loading } = useFirestore<Product>("products", {
    constraints: [where("isActive", "==", true)],
  });

  const catSorted = [...categories].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const sorted = [...products].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const filtered = selectedCategory === "all"
    ? sorted
    : sorted.filter((p) => p.categoryId === selectedCategory);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ShopHeader />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <h1 className="text-3xl font-bold text-secondary mb-2">All Products</h1>
        <p className="text-muted-foreground mb-8">
          {filtered.length} product{filtered.length !== 1 ? "s" : ""} found
        </p>

        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All
          </button>
          {catSorted.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading products...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No products found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
      <ShopFooter />
    </div>
  );
}
