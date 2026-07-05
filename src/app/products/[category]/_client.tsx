"use client";

import { useParams } from "next/navigation";
import { useFirestore, where } from "@/hooks/useFirestore";
import { Product, Category } from "@/types";
import ProductCard from "@/components/shop/ProductCard";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";

export default function CategoryProductsPage() {
  const params = useParams();
  const categoryId = params.category as string;

  const { data: categories, error: catError } = useFirestore<Category>("categories", {
    constraints: [where("isActive", "==", true)],
    realtime: false,
  });
  const category = categories.find((c) => c.id === categoryId);

  const { data: products, loading, error: prodError } = useFirestore<Product>("products", {
    constraints: [
      where("showOnWebsite", "==", true),
      where("isActive", "==", true),
      where("categoryId", "==", categoryId),
    ],
    realtime: false,
  });

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ShopHeader />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <h1 className="text-3xl font-bold text-secondary capitalize mb-2">
          {category?.name || categoryId}
        </h1>
        <p className="text-muted-foreground mb-8">
          {products.length} product{products.length !== 1 ? "s" : ""} found
        </p>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading products...</div>
        ) : prodError || catError ? (
          <div className="text-center py-16">
            <p className="text-red-500">Failed to load products. Please try again later.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No products found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
      <ShopFooter />
    </div>
  );
}
