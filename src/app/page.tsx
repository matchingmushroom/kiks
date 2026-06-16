"use client";

import Link from "next/link";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { HomeSection, Product as ProductType, Category } from "@/types";
import { useCollection } from "@/hooks/useCollection";
import ProductCard from "@/components/shop/ProductCard";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

function HeroSection({ section }: { section: HomeSection }) {
  const { settings } = useShopSettings();
  return (
    <section className="relative bg-gradient-to-br from-secondary via-secondary to-primary/20 min-h-[70vh] flex items-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
            {section.title || `Exquisite Jewellery for Every Occasion`}
          </h1>
          <p className="text-lg sm:text-xl text-secondary-foreground/80 mb-8">
            {section.subtitle || `Discover our collection at ${settings.shopName}`}
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/products"
              className="inline-flex items-center px-6 py-3 bg-accent text-secondary font-semibold rounded-lg hover:bg-accent/90 transition-colors"
            >
              Shop Now
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center px-6 py-3 border border-accent text-accent font-semibold rounded-lg hover:bg-accent/10 transition-colors"
            >
              View Collection
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoryGridSection() {
  const { data: categories, loading } = useCollection<Category>("categories", {
    where: [["isActive", "==", true]],
    orderBy: ["order", "asc"],
  });

  if (loading || categories.length === 0) return null;

  return (
    <section className="py-16 bg-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-secondary mb-4">Our Collection</h2>
        <p className="text-muted-foreground mb-12">Browse our curated categories</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products/${cat.id}`}
              className="group relative bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-8 border border-border"
            >
              <h3 className="text-xl font-semibold text-secondary group-hover:text-primary transition-colors">
                {cat.name}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">{cat.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedProductsSection() {
  const { data: products, loading } = useCollection<ProductType>("products", {
    where: [
      ["isActive", "==", true],
      ["isFeatured", "==", true],
    ],
    orderBy: ["createdAt", "desc"],
    limit: 8,
  });

  if (loading || products.length === 0) return null;

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-secondary">Featured Products</h2>
          <p className="text-muted-foreground mt-2">Our most popular pieces</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.slice(0, 8).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

function NewArrivalsSection() {
  const { data: products, loading } = useCollection<ProductType>("products", {
    where: [["isActive", "==", true]],
    orderBy: ["createdAt", "desc"],
    limit: 4,
  });

  if (loading || products.length === 0) return null;

  return (
    <section className="py-16 bg-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-secondary">New Arrivals</h2>
          <p className="text-muted-foreground mt-2">Latest additions to our collection</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CustomHtmlSection({ section }: { section: HomeSection }) {
  const html = (section.config?.htmlContent as string) || "";
  if (!html) return null;
  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

function SectionRenderer({ section }: { section: HomeSection }) {
  switch (section.type) {
    case "hero":
      return <HeroSection section={section} />;
    case "category_grid":
      return <CategoryGridSection />;
    case "featured_products":
      return <FeaturedProductsSection />;
    case "new_arrivals":
      return <NewArrivalsSection />;
    case "custom_html":
      return <CustomHtmlSection section={section} />;
    default:
      return null;
  }
}

function HomeContent() {
  const { data: sections, loading } = useCollection<HomeSection>("sections", {
    where: [["isVisible", "==", true]],
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  const sorted = [...sections].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  return (
    <main>
      {sorted.length > 0 ? (
        sorted.map((section) => (
          <SectionRenderer key={section.id} section={section} />
        ))
      ) : (
        <>
          <HeroSection
            section={{
              id: "default-hero",
              type: "hero",
              title: "Exquisite Jewellery for Every Occasion",
              subtitle: "Discover our collection of handcrafted pieces.",
              order: 0,
              isVisible: true,
              config: {},
            }}
          />
          <CategoryGridSection />
        </>
      )}
    </main>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ShopHeader />
      <HomeContent />
      <ShopFooter />
    </div>
  );
}
