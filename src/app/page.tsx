"use client";

import Link from "next/link";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { HomeSection, Product as ProductType, Category } from "@/types";
import { useFirestore, where } from "@/hooks/useFirestore";
import ProductCard from "@/components/shop/ProductCard";
import Carousel from "@/components/shop/Carousel";
import TrustBar from "@/components/shop/TrustBar";
import { formatNumber } from "@/lib/utils";
import { ShoppingBag, ChevronRight, Sparkles, ArrowRight } from "lucide-react";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const heroSlides = [
  {
    title: "Exquisite Jewellery for Every Occasion",
    subtitle: "Discover handcrafted pieces that tell your story",
    bg: "bg-gradient-to-br from-amber-50 to-white",
    accent: "bg-accent",
  },
  {
    title: "Timeless Elegance, Modern Craft",
    subtitle: "Explore our latest collection of fine jewellery",
    bg: "bg-gradient-to-br from-pink-50 to-white",
    accent: "bg-accent",
  },
  {
    title: "Celebrate with Sparkle",
    subtitle: "Find the perfect piece for your special moments",
    bg: "bg-gradient-to-br from-purple-50 to-white",
    accent: "bg-accent",
  },
];

function HeroSection() {
  const { settings } = useShopSettings();
  const slides = heroSlides.map((s) => ({
    ...s,
    subtitle: s.subtitle || `Discover our collection at ${settings.shopName}`,
  }));

  const slidesContent = slides.map((slide, i) => (
    <section key={i} className={`relative min-h-[60vh] sm:min-h-[70vh] flex items-center ${slide.bg}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 w-full">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            New Collection
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-secondary mb-4 sm:mb-6 leading-tight">
            {slide.title}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-lg">
            {slide.subtitle}
          </p>
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-accent text-secondary font-semibold rounded-full hover:bg-accent/90 transition-all text-sm sm:text-base"
            >
              Shop Now
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 border-2 border-accent text-accent font-semibold rounded-full hover:bg-accent/10 transition-all text-sm sm:text-base"
            >
              View Collection
            </Link>
          </div>
        </div>
      </div>
      <div className="absolute right-0 top-0 h-full w-1/3 opacity-5 pointer-events-none">
        <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--accent)_0%,_transparent_70%)]" />
      </div>
    </section>
  ));

  return (
    <Carousel autoPlay interval={5000} showDots showArrows={false}>
      {slidesContent}
    </Carousel>
  );
}

function CategoryGridSection() {
  const { data: categories, loading, error } = useFirestore<Category>("categories", {
    constraints: [where("isActive", "==", true)],
    realtime: false,
  });

  if (loading) return null;
  if (error) return <p className="text-red-500 text-center py-4">Failed to load categories.</p>;
  const visible = categories.filter((c) => c.showOnHomepage !== false);
  if (visible.length === 0) return null;

  const sortedCategories = [...visible].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  return (
    <section className="py-12 sm:py-16 bg-muted/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-secondary">Our Collection</h2>
            <p className="text-sm text-muted-foreground mt-1">Browse by category</p>
          </div>
          <Link href="/products" className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            View All <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 overflow-x-auto snap-x snap-mandatory sm:overflow-visible pb-2 sm:pb-0 no-scrollbar" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {sortedCategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products/${cat.id}`}
              className="group snap-start shrink-0 w-[180px] sm:w-auto bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-5 sm:p-8 border border-border"
            >
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <span className="text-accent font-bold text-lg">{cat.name.charAt(0)}</span>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary group-hover:text-primary transition-colors">
                {cat.name}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{cat.description}</p>
            </Link>
          ))}
        </div>
        <div className="mt-4 text-center sm:hidden">
          <Link href="/products" className="inline-flex items-center gap-1 text-sm font-medium text-accent">
            View All Categories <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ title, subtitle, link }: { title: string; subtitle?: string; link?: string }) {
  return (
    <div className="flex items-end justify-between mb-6 sm:mb-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-secondary">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {link && (
        <Link href={link} className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline shrink-0">
          View All <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function FeaturedProductsSection() {
  const { data: products, loading, error } = useFirestore<ProductType>("products", {
    constraints: [
      where("isActive", "==", true),
      where("isFeatured", "==", true),
    ],
    realtime: false,
  });

  if (loading) return null;
  if (error) return <p className="text-red-500 text-center py-4">Failed to load featured products.</p>;
  if (products.length === 0) return null;

  const sortedProducts = [...products].sort((a, b) => ((b.createdAt as number) ?? 0) - ((a.createdAt as number) ?? 0)).slice(0, 10);

  const cards = sortedProducts.map((product) => (
    <ProductCard key={product.id} product={product} />
  ));

  return (
    <section className="py-12 sm:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title="Featured Products" subtitle="Our most popular pieces" link="/products" />
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {sortedProducts.slice(0, 8).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <div className="sm:hidden">
          <Carousel autoPlay showDots showArrows={false} interval={3000}>
            {cards}
          </Carousel>
        </div>
      </div>
    </section>
  );
}

function NewArrivalsSection() {
  const { data: products, loading, error } = useFirestore<ProductType>("products", {
    constraints: [where("isActive", "==", true)],
    realtime: false,
  });

  if (loading) return null;
  if (error) return <p className="text-red-500 text-center py-4">Failed to load products.</p>;
  if (products.length === 0) return null;

  const sortedProducts = [...products].sort((a, b) => ((b.createdAt as number) ?? 0) - ((a.createdAt as number) ?? 0)).slice(0, 10);

  const cards = sortedProducts.map((product) => (
    <ProductCard key={product.id} product={product} />
  ));

  return (
    <section className="py-12 sm:py-16 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title="New Arrivals" subtitle="Latest additions to our collection" link="/products" />
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {sortedProducts.slice(0, 8).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <div className="sm:hidden">
          <Carousel autoPlay showDots showArrows={false} interval={3000}>
            {cards}
          </Carousel>
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

function ComboSection() {
  const { data: products, loading, error } = useFirestore<ProductType>("products", {
    constraints: [where("isActive", "==", true)],
    realtime: false,
  });

  if (loading) return null;
  if (error) return <p className="text-red-500 text-center py-4">Failed to load combos.</p>;
  const combos = products.filter((p) => p.comboItems?.length);
  if (combos.length === 0) return null;

  function computeOriginalTotal(combo: ProductType): number {
    if (!combo.comboItems?.length) return combo.price;
    return combo.comboItems.reduce((sum, id) => {
      const item = products.find((p) => p.id === id);
      return sum + (item?.price || 0);
    }, 0);
  }

  const cards = combos.map((product) => (
    <div key={product.id} className="group bg-white rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
      <div className="aspect-square bg-gradient-to-br from-purple-50 to-pink-50 relative overflow-hidden flex items-center justify-center">
        <span className="text-muted-foreground text-sm">Combo Set</span>
        <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded font-medium">
          Save {formatNumber(computeOriginalTotal(product) - (product.comboPrice || product.price))}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-secondary truncate">{product.name}</h3>
        <div className="flex items-center gap-2 mt-2">
          <p className="text-sm text-muted-foreground line-through">Rs. {formatNumber(computeOriginalTotal(product))}</p>
          <p className="text-primary font-bold text-lg">Rs. {formatNumber(product.comboPrice || product.price)}</p>
        </div>
      </div>
    </div>
  ));

  return (
    <section className="py-12 sm:py-16 bg-gradient-to-br from-purple-50/50 to-pink-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title="Combo Deals" subtitle="Curated sets at special prices" />
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {combos.map((product) => (
            <div key={product.id} className="group bg-white rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
              <div className="aspect-square bg-gradient-to-br from-purple-50 to-pink-50 relative overflow-hidden flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Combo Set</span>
                <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded font-medium">
                  Save {formatNumber(computeOriginalTotal(product) - (product.comboPrice || product.price))}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-secondary truncate">{product.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-sm text-muted-foreground line-through">Rs. {formatNumber(computeOriginalTotal(product))}</p>
                  <p className="text-primary font-bold text-lg">Rs. {formatNumber(product.comboPrice || product.price)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="sm:hidden">
          <Carousel autoPlay showDots showArrows={false} interval={3000}>
            {cards}
          </Carousel>
        </div>
      </div>
    </section>
  );
}

function NewsletterSection() {
  return (
    <section className="py-12 sm:py-16 bg-secondary">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Stay in Touch</h2>
        <p className="text-white/70 mb-6 text-sm sm:text-base">Subscribe to get updates on new arrivals and exclusive offers</p>
        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-1 px-4 py-2.5 rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
          />
          <button className="px-6 py-2.5 bg-accent text-secondary font-semibold rounded-full hover:bg-accent/90 transition-colors text-sm whitespace-nowrap">
            Subscribe
          </button>
        </div>
      </div>
    </section>
  );
}

function SectionRenderer({ section }: { section: HomeSection }) {
  switch (section.type) {
    case "hero":
      return null;
    case "category_grid":
      return <CategoryGridSection />;
    case "featured_products":
      return <FeaturedProductsSection />;
    case "new_arrivals":
      return <NewArrivalsSection />;
    case "combo_deals":
      return <ComboSection />;
    case "custom_html":
      return <CustomHtmlSection section={section} />;
    default:
      return null;
  }
}

function HomeContent() {
  const { data: sections, loading } = useFirestore<HomeSection>("sections", {
    constraints: [where("isVisible", "==", true)],
    realtime: false,
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  const sorted = [...sections].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const hasHero = sorted.some((s) => s.type === "hero");

  return (
    <main>
      <HeroSection />
      <TrustBar />
      {sorted.length > 0 ? (
        sorted.map((section) => (
          <SectionRenderer key={section.id} section={section} />
        ))
      ) : (
        <>
          <CategoryGridSection />
          <FeaturedProductsSection />
          <ComboSection />
          <NewArrivalsSection />
        </>
      )}
      <NewsletterSection />
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
