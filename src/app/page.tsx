"use client";

import Link from "next/link";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { HomeSection, Product as ProductType, Category, Testimonial } from "@/types";
import { useFirestore, where, orderBy } from "@/hooks/useFirestore";
import ProductCard from "@/components/shop/ProductCard";
import Carousel from "@/components/shop/Carousel";
import TrustBar from "@/components/shop/TrustBar";
import { formatNumber } from "@/lib/utils";
import { ShoppingBag, ChevronRight, Sparkles, ArrowRight, Star, X, Circle, Diamond, Ear, Infinity, Gem, Heart } from "lucide-react";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useState } from "react";

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

function AnnouncementBar() {
  const { settings } = useShopSettings();
  const text = settings?.announcementText;
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !text) return null;
  return (
    <div className="bg-accent text-secondary text-xs sm:text-sm text-center py-2 px-4 relative">
      <span className="font-medium">{text}</span>
      <button onClick={() => setDismissed(true)} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:opacity-70">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function HeroSection() {
  const { settings } = useShopSettings();
  const slides = heroSlides.map((s) => ({
    ...s,
    subtitle: s.subtitle || `Discover our collection at ${settings.shopName}`,
  }));

  const slidesContent = slides.map((slide, i) => (
    <section key={i} className={`relative w-full min-h-[45vh] sm:min-h-[70vh] flex items-center overflow-hidden ${slide.bg}`}>
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-10 sm:py-20 pb-16 sm:pb-20 w-full relative z-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent text-xs font-semibold px-3 py-1.5 rounded-full mb-3 sm:mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            New Collection
          </div>
          <h1 className="text-2xl sm:text-4xl lg:text-6xl font-bold text-secondary mb-3 sm:mb-6 leading-tight break-words">
            {slide.title}
          </h1>
          <p className="text-sm sm:text-lg text-muted-foreground mb-5 sm:mb-8 max-w-lg break-words">
            {slide.subtitle}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 sm:py-3 bg-accent text-secondary font-semibold rounded-full hover:bg-accent/90 transition-all text-sm sm:text-base"
            >
              Shop Now
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 sm:py-3 border-2 border-accent text-accent font-semibold rounded-full hover:bg-accent/10 transition-all text-sm sm:text-base"
            >
              View Collection
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden sm:block absolute right-0 top-0 h-full w-1/3 opacity-5 pointer-events-none">
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

function CategoryGridSection({ products: allProducts, categories }: { products: ProductType[]; categories: Category[] }) {
  const visible = categories.filter((c) => c.showOnHomepage !== false);
  if (visible.length === 0) return null;

  const productCounts: Record<string, number> = {};
  allProducts.forEach((p) => {
    if (p.categoryId) productCounts[p.categoryId] = (productCounts[p.categoryId] || 0) + 1;
  });

  const sortedCategories = [...visible].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  return (
    <section className="py-12 sm:py-16 bg-muted/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title="Our Collection" subtitle="Browse by category" link="/products" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {sortedCategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products/${cat.id}`}
              className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-5 sm:p-6 border border-border text-center"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <span className="text-accent font-bold text-xl sm:text-2xl">{cat.name.charAt(0)}</span>
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-secondary group-hover:text-primary transition-colors">
                {cat.name}
              </h3>
              {cat.description && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{cat.description}</p>
              )}
              <p className="text-xs text-accent font-medium mt-2">{productCounts[cat.id] || 0} products</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function PromoCardSection({ products }: { products: ProductType[] }) {
  const activeProducts = products.filter((p) => p.isActive);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const sortedByNewest = [...activeProducts].sort((a, b) => ((b.createdAt as number) ?? 0) - ((a.createdAt as number) ?? 0));
  const newArrivals = sortedByNewest.slice(0, 15);

  const onSale = activeProducts.filter((p) => p.badge === "offer" || p.badge === "price_dropped" || (p.originalPrice && p.originalPrice > p.price));

  const bestSellers = [...activeProducts].filter((p) => p.price > 500);

  const cards = [
    {
      key: "new_arrivals", title: "New Arrivals",
      subtitle: "Latest jewellery designs of the season",
      cta: "Shop Now", gradient: "from-amber-100 to-amber-50", icon: Sparkles,
    },
    {
      key: "on_sale", title: "On Sale",
      subtitle: "Special discounts on selected jewelry",
      cta: "View Offers", gradient: "from-rose-100 to-rose-50", icon: Star,
    },
    {
      key: "best_sellers", title: "Best Sellers",
      subtitle: "Most popular jewellery styles",
      cta: "Shop Bestsellers", gradient: "from-purple-100 to-purple-50", icon: ShoppingBag,
    },
  ];

  const activeProductsToShow = activeTab === "new_arrivals" ? newArrivals
    : activeTab === "on_sale" ? onSale
    : activeTab === "best_sellers" ? bestSellers
    : [];

  const showEmptyMessage = activeTab === "on_sale" && onSale.length === 0;

  return (
    <section className="py-12 sm:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title="Featured Collections" subtitle="Curated just for you" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {cards.map((card) => {
            const isActive = activeTab === card.key;
            return (
              <button
                key={card.key}
                onClick={() => setActiveTab(isActive ? null : card.key)}
                className={`group relative bg-gradient-to-br ${card.gradient} rounded-xl p-6 sm:p-8 border text-left w-full ${
                  isActive ? "border-accent ring-2 ring-accent/20" : "border-border"
                } overflow-hidden hover:shadow-md transition-all cursor-pointer`}
              >
                <div className="relative z-10">
                  <card.icon className="h-8 w-8 text-accent mb-3" />
                  <h3 className="text-lg sm:text-xl font-bold text-secondary mb-1">{card.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{card.subtitle}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-accent group-hover:gap-2 transition-all">
                    {isActive ? "Close" : card.cta} <ArrowRight className={`h-3.5 w-3.5 transition-transform ${isActive ? "rotate-90" : ""}`} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {activeTab && (
          <div className="mt-8">
            {showEmptyMessage ? (
              <div className="text-center py-12 bg-muted/30 rounded-xl border border-border">
                <Star className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-base text-muted-foreground max-w-md mx-auto">
                  Use our coupon codes and existing discounts and continue shopping.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {activeProductsToShow.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const { data: testimonials, loading, error } = useFirestore<Testimonial>("testimonials", {
    constraints: [where("isActive", "==", true)],
    realtime: false,
  });

  if (loading) return null;
  if (error || testimonials.length === 0) return null;

  const sorted = [...testimonials].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const slides = sorted.map((t, i) => (
    <div key={t.id} className="px-4 py-8 sm:py-12 text-center max-w-2xl mx-auto">
      <div className="flex justify-center gap-1 mb-4">
        {Array.from({ length: 5 }, (_, j) => (
          <Star key={j} className={`h-5 w-5 ${j < t.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />
        ))}
      </div>
      <p className="text-base sm:text-lg text-secondary italic leading-relaxed mb-6">&ldquo;{t.text}&rdquo;</p>
      <div className="flex items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm">
          {t.customerName.charAt(0)}
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-secondary">{t.customerName}</p>
          {t.productName && <p className="text-xs text-muted-foreground">{t.productName}</p>}
        </div>
      </div>
    </div>
  ));

  return (
    <section className="py-12 sm:py-16 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title="What Our Customers Say" subtitle="Hear from our happy customers" />
        <Carousel autoPlay interval={4000} showDots showArrows={false}>
          {slides}
        </Carousel>
      </div>
    </section>
  );
}

function AffordableCategorySection({ products: allProducts, categories }: { products: ProductType[]; categories: Category[] }) {
  const visible = categories.filter((c) => c.showOnHomepage !== false).slice(0, 5);
  if (visible.length === 0) return null;

  const minPriceInCategory: Record<string, number> = {};
  allProducts.forEach((p) => {
    if (p.categoryId && p.isActive) {
      const current = minPriceInCategory[p.categoryId];
      if (current === undefined || p.price < current) {
        minPriceInCategory[p.categoryId] = p.price;
      }
    }
  });

  return (
    <section className="py-12 sm:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title="Shop by Category" subtitle="Find your perfect piece" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {visible.map((cat) => {
            const Icon = categoryIcon(cat.name, cat.shortCode);
            return (
            <Link
              key={cat.id}
              href={`/products/${cat.id}`}
              className="group bg-muted/50 rounded-xl p-5 sm:p-6 border border-border text-center hover:bg-accent/5 hover:border-accent/30 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform overflow-hidden">
                {cat.image ? (
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  <Icon className="w-6 h-6 text-accent" />
                )}
              </div>
              <h3 className="text-sm font-semibold text-secondary">{cat.name}</h3>
              {minPriceInCategory[cat.id] !== undefined && (
                <p className="text-xs text-accent font-medium mt-1">From Rs. {formatNumber(minPriceInCategory[cat.id])}</p>
              )}
            </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function categoryIcon(name: string, shortCode: string): React.ComponentType<{ className?: string }> {
  const n = name.toLowerCase();
  const c = shortCode?.toLowerCase() || "";
  if (n.includes("ring") || c === "rl") return Circle;
  if (n.includes("earring") || c === "er") return Ear;
  if (n.includes("nosepin") || n.includes("nose pin") || c === "np") return Gem;
  if (n.includes("necklace") || n.includes("chain") || c === "nl" || c === "ch") return Infinity;
  if (n.includes("mangalsutra") || c === "ms") return Heart;
  if (n.includes("bangle") || n.includes("bracelet") || n.includes("anklet") || c === "bg" || c === "br" || c === "ak") return Circle;
  if (n.includes("pendant") || c === "ps") return Diamond;
  if (n.includes("jewel set") || n.includes("set") || c === "js") return Sparkles;
  if (n.includes("brooch") || c === "bo") return Star;
  if (n.includes("cufflink") || c === "cf") return Circle;
  if (n.includes("hair") || c === "ha") return Sparkles;
  return Diamond;
}

function CategoryProductSection({ category, products }: { category: Category; products: ProductType[] }) {
  const catProducts = products
    .filter((p) => p.isActive && p.categoryId === category.id)
    .sort((a, b) => ((b.createdAt as number) ?? 0) - ((a.createdAt as number) ?? 0))
    .slice(0, 4);

  if (catProducts.length === 0) return null;

  const uniqueOccasions = [...new Set(catProducts.flatMap((p) => (Array.isArray(p.occasion) ? p.occasion : []).filter(Boolean)))];

  return (
    <section className="py-10 sm:py-14 bg-white border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={category.name} subtitle={category.description || undefined} link={`/products/${category.id}`} />
        {uniqueOccasions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {uniqueOccasions.map((occ) => (
              <Link
                key={occ}
                href={`/products/${category.id}?occasion=${encodeURIComponent(occ)}`}
                className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors"
              >
                {occ}
              </Link>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {catProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

function extractGoogleDriveId(url: string): string | null {
  const m = url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/?#&]+)/);
  return m ? m[1] : null;
}

function imgUrl(url: string): string {
  const gd = extractGoogleDriveId(url);
  if (gd) return `https://drive.google.com/thumbnail?id=${gd}&sz=w400`;
  return url.replace(/images\.unsplash\.com\/photo-([^?]+)/, "https://unsplash.com/photos/$1/download?w=400");
}

function ComboSection({ products }: { products: ProductType[] }) {
  const combos = products.filter((p) => p.comboItems?.length);
  if (combos.length === 0) return null;

  function computeOriginalTotal(combo: ProductType): number {
    if (!combo.comboItems?.length) return combo.price;
    return combo.comboItems.reduce((sum, id) => {
      const item = products.find((p) => p.id === id);
      return sum + (item?.price || 0);
    }, 0);
  }

  return (
    <section className="py-12 sm:py-16 bg-gradient-to-br from-purple-50/50 to-pink-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title="Combo Deals" subtitle="Curated sets at special prices" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {combos.slice(0, 4).map((product) => (
            <Link key={product.id} href={`/product-viewer?id=${product.id}`} className="group bg-white rounded-xl border border-border overflow-hidden hover:shadow-md transition-all block">
              <div className="aspect-square bg-gradient-to-br from-purple-50 to-pink-50 relative overflow-hidden flex items-center justify-center">
                {(product.images?.[0]) ? (
                  <img src={imgUrl(product.images[0])} alt={product.websiteName || product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (product.comboItems || []).map((id) => products.find((p) => p.id === id)).filter(Boolean).slice(0, 4).length > 0 ? (
                  <div className="grid grid-cols-2 w-full h-full">
                    {(product.comboItems || []).map((id) => products.find((p) => p.id === id)).filter(Boolean).slice(0, 4).map((item, i) => (
                      <div key={item!.id} className={`overflow-hidden ${i < 2 ? "" : ""}`}>
                        <img src={imgUrl(item!.images?.[0] || "")} alt={item!.websiteName || item!.name} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">Combo Set</span>
                )}
                <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded font-medium">
                  Save {formatNumber(computeOriginalTotal(product) - (product.comboPrice || product.price))}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-secondary truncate">{product.websiteName || product.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-sm text-muted-foreground line-through">Rs. {formatNumber(computeOriginalTotal(product))}</p>
                  <p className="text-primary font-bold text-lg">Rs. {formatNumber(product.comboPrice || product.price)}</p>
                </div>
              </div>
            </Link>
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
      return null;
    case "custom_html":
      return <CustomHtmlSection section={section} />;
    default:
      return null;
  }
}

function HomeContent() {
  const { data: products, loading: productsLoading } = useFirestore<ProductType>("products", {
    constraints: [where("isActive", "==", true), where("showOnWebsite", "==", true)],
    realtime: false,
  });

  const { data: categories, loading: catsLoading } = useFirestore<Category>("categories", {
    constraints: [where("isActive", "==", true)],
    realtime: false,
  });

  const { data: sections } = useFirestore<HomeSection>("sections", {
    constraints: [where("isVisible", "==", true)],
    realtime: false,
  });

  if (productsLoading || catsLoading) {
    return <LoadingSpinner />;
  }

  const sortedProducts = [...products].sort((a, b) => ((b.createdAt as number) ?? 0) - ((a.createdAt as number) ?? 0));
  const sortedCategories = [...categories].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const topCategories = sortedCategories.filter((c) => c.showOnHomepage !== false).slice(0, 4);

  return (
    <main>
      <AnnouncementBar />
      <HeroSection />
      <TrustBar />
      <PromoCardSection products={sortedProducts} />
      <TestimonialsSection />
      <AffordableCategorySection products={sortedProducts} categories={sortedCategories} />
      {topCategories.map((cat) => (
        <CategoryProductSection key={cat.id} category={cat} products={sortedProducts} />
      ))}
      <ComboSection products={sortedProducts} />
      {sections.length > 0 && (
        <div className="max-w-7xl mx-auto px-4">
          {sections.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map((section) => (
            <SectionRenderer key={section.id} section={section} />
          ))}
        </div>
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
