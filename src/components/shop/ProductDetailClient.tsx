"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Product, Testimonial } from "@/types";
import { formatNumber } from "@/lib/utils";
import { ShoppingBag, Check, ChevronLeft, ChevronRight, Sparkles, ShieldCheck, Gift, Truck, Star, MessageSquare, Package } from "lucide-react";
import { collection, addDoc, getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFirestore, where } from "@/hooks/useFirestore";

function extractGoogleDriveId(url: string): string | null {
  const m = url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/?#&]+)/);
  return m ? m[1] : null;
}

function imgUrl(url: string): string {
  const gd = extractGoogleDriveId(url);
  if (gd) return `https://drive.google.com/thumbnail?id=${gd}&sz=w600`;
  return url.replace(/images\.unsplash\.com\/photo-([^?]+)/, "https://unsplash.com/photos/$1/download?w=600");
}

const usps = [
  { icon: Truck, label: "Free Shipping", desc: "On orders above Rs. 5000" },
  { icon: Gift, label: "Gift Ready", desc: "Free premium packaging" },
  { icon: ShieldCheck, label: "Authentic", desc: "100% genuine products" },
];

export default function ProductDetailClient({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [comboItemsData, setComboItemsData] = useState<Product[]>([]);
  const displayName = product.websiteName || product.name;
  const isCombo = !!product.comboItems?.length;
  const comboOriginalTotal = isCombo ? comboItemsData.reduce((sum, item) => sum + item.price, 0) : 0;
  const displayPrice = isCombo ? (product.comboPrice || product.price) : product.price;
  const comboItemImages = isCombo ? comboItemsData.flatMap((item) => item.images || []) : [];
  const images = (product.images?.length ? product.images : comboItemImages).map(imgUrl) || [];

  useEffect(() => {
    if (!product.comboItems?.length) return;
    let cancelled = false;
    (async () => {
      const items: Product[] = [];
      for (const pid of product.comboItems!) {
        const snap = await getDoc(doc(db, "products", pid));
        if (!cancelled && snap.exists()) {
          items.push({ id: snap.id, ...snap.data() } as Product);
        }
      }
      if (!cancelled) setComboItemsData(items);
    })();
    return () => { cancelled = true; };
  }, [product.comboItems]);

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: displayName,
      image: images[0] || "",
      price: displayPrice,
      weight: product.weight,
      makingCharge: product.makingCharge,
      quantity: 1,
      ...(isCombo ? { comboItems: product.comboItems } : {}),
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const specs = [
    { label: "Brand", value: product.brand },
    { label: "Model Code", value: product.modelCode || product.modelNo },
    { label: "Base Material", value: product.baseMaterial },
    { label: "Plating Type", value: product.plating },
    { label: "Color", value: product.color },
    { label: "Sub Category", value: product.productType },
    { label: "Ideal For", value: Array.isArray(product.idealFor) ? product.idealFor.join(", ") : product.idealFor },
    { label: "Occasion", value: Array.isArray(product.occasion) ? product.occasion.join(", ") : product.occasion },
    { label: "Warranty", value: product.warranty },
    { label: "Weight", value: product.weight ? `${product.weight}g` : "" },
  ].filter(s => s.value && s.value !== "");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 w-full">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-secondary mb-4 sm:mb-6 transition-colors group"
        >
          <div className="p-1 rounded-full bg-white border border-border group-hover:border-muted-foreground/30 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </div>
          Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="relative aspect-square bg-white rounded-2xl border border-border overflow-hidden mb-3 group shadow-sm">
              {images[selectedImage] ? (
                <>
                  <img
                    src={images[selectedImage]}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                  {images.length > 1 && (
                    <>
                      <button onClick={() => setSelectedImage((selectedImage - 1 + images.length) % images.length)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronLeft className="h-5 w-5 text-secondary" />
                      </button>
                      <button onClick={() => setSelectedImage((selectedImage + 1) % images.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="h-5 w-5 text-secondary" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-slate-50">
                  <div className="text-center">
                    <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <span className="text-sm">No Image Available</span>
                  </div>
                </div>
              )}
              {product.badge && product.badge !== "none" && (
                <div className={`absolute top-3 left-3 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm ${
                  product.badge === "limited_stock" ? "bg-orange-500" :
                  product.badge === "out_of_stock" ? "bg-red-500" :
                  product.badge === "price_dropped" ? "bg-emerald-600" :
                  product.badge === "offer" ? "bg-amber-500" : "bg-primary"
                }`}>
                  {product.badge === "limited_stock" ? "Limited Stock" :
                   product.badge === "out_of_stock" ? "Out of Stock" :
                   product.badge === "price_dropped" ? "Price Dropped" :
                   product.badge === "offer" ? "Offer" : product.badge}
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 overflow-hidden shrink-0 transition-all ${
                      i === selectedImage ? "border-accent shadow-sm" : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {product.videoUrl && (
              <div className="mt-4 aspect-video rounded-xl overflow-hidden no-print shadow-sm border border-border">
                <iframe
                  src={product.videoUrl.replace("watch?v=", "embed/")}
                  title="Product Video"
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )}

            <div className="hidden lg:grid grid-cols-3 gap-3 mt-6">
              {usps.map((usp) => (
                <div key={usp.label} className="flex flex-col items-center text-center gap-1.5 p-3 bg-slate-50 rounded-xl">
                  <usp.icon className="h-5 w-5 text-accent" />
                  <p className="text-xs font-semibold text-secondary">{usp.label}</p>
                  <p className="text-[10px] text-muted-foreground">{usp.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-secondary leading-tight">{displayName}</h1>
              </div>

              {isCombo ? (
                <div className="mb-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-xl sm:text-2xl text-muted-foreground line-through">
                      Rs. {formatNumber(comboOriginalTotal)}
                    </span>
                    <span className="text-2xl sm:text-3xl font-bold text-primary">
                      Rs. {formatNumber(displayPrice)}
                    </span>
                  </div>
                  <p className="text-xs text-purple-600 font-medium mt-1">Combo Deal — Save Rs. {formatNumber(comboOriginalTotal - displayPrice)}</p>
                </div>
              ) : product.badge === "price_dropped" || product.badge === "offer" ? (
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-xl sm:text-2xl text-muted-foreground line-through">
                    Rs. {formatNumber(product.originalPrice || product.price)}
                  </span>
                  <span className="text-2xl sm:text-3xl font-bold text-primary">
                    Rs. {formatNumber(product.price)}
                  </span>
                </div>
              ) : (
                <p className="text-2xl sm:text-3xl font-bold text-primary mb-4">
                  Rs. {formatNumber(product.price)}
                </p>
              )}

              {isCombo && comboItemsData.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-purple-600" />
                    <h3 className="text-sm font-semibold text-purple-700">This Combo Includes</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {comboItemsData.map((item) => (
                      <li key={item.id} className="flex justify-between text-sm">
                        <span className="text-purple-800">{item.name}</span>
                        <span className="text-purple-600 font-medium">Rs. {formatNumber(item.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-6">
                {product.description || "No description available."}
              </p>

              <div className="flex gap-3 mb-6">
                <button
                  onClick={handleAddToCart}
                  disabled={product.quantityInStock <= 0}
                  className="flex-1 py-3 bg-accent text-secondary font-bold rounded-xl hover:bg-accent/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm hover:shadow-md text-sm sm:text-base"
                >
                  {added ? (
                    <><Check className="h-5 w-5 text-green-700" /> Added to Cart</>
                  ) : (
                    <><ShoppingBag className="h-5 w-5" /> Add to Cart</>
                  )}
                </button>
                <button
                  onClick={() => {
                    handleAddToCart();
                    router.push("/cart");
                  }}
                  disabled={product.quantityInStock <= 0}
                  className="flex-1 py-3 border-2 border-accent text-accent font-bold rounded-xl hover:bg-accent/5 transition-all disabled:opacity-50 text-sm sm:text-base"
                >
                  Buy Now
                </button>
              </div>

              {product.quantityInStock <= 0 && (
                <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl text-center font-medium mb-4">
                  This product is currently out of stock
                </p>
              )}

            </div>

            {specs.length > 0 && (
              <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-sm mt-4">
                <h2 className="text-base font-bold text-secondary mb-4">Product Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 divide-y sm:divide-y-0 sm:divide-x-0 border-border/60">
                  {specs.map((spec) => (
                    <div key={spec.label} className="flex justify-between py-3 sm:py-2.5 sm:border-b sm:border-border/40 sm:last:border-b-0">
                      <span className="text-sm text-muted-foreground">{spec.label}</span>
                      <span className="text-sm font-medium text-secondary text-right">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ProductReviews productId={product.id} />
            <ProductReviewForm product={product} />

            <div className="lg:hidden grid grid-cols-3 gap-3 mt-4">
              {usps.map((usp) => (
                <div key={usp.label} className="flex flex-col items-center text-center gap-1.5 p-3 bg-white rounded-xl border border-border">
                  <usp.icon className="h-5 w-5 text-accent" />
                  <p className="text-xs font-semibold text-secondary">{usp.label}</p>
                  <p className="text-[10px] text-muted-foreground">{usp.desc}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

function ProductReviews({ productId }: { productId: string }) {
  const { data: reviews, loading } = useFirestore<Testimonial>("testimonials", {
    constraints: [where("productId", "==", productId), where("isActive", "==", true)],
    realtime: false,
  });

  if (loading) return null;
  if (reviews.length === 0) return null;

  const avgRating = Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10;

  return (
    <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-sm mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
          <h2 className="text-base font-bold text-secondary">Customer Reviews</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold text-secondary">{avgRating}</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((r) => (
              <Star key={r} className={`h-3.5 w-3.5 ${r <= Math.round(avgRating) ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-1">({reviews.length})</span>
        </div>
      </div>
      <div className="space-y-4 divide-y divide-border/60">
        {reviews.sort((a, b) => b.createdAt - a.createdAt).map((review) => (
          <div key={review.id} className="pt-4 first:pt-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-xs">
                {review.customerName.charAt(0)}
              </div>
              <span className="text-sm font-semibold text-secondary">{review.customerName}</span>
              <div className="flex gap-0.5 ml-1">
                {[1, 2, 3, 4, 5].map((r) => (
                  <Star key={r} className={`h-3 w-3 ${r <= review.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />
                ))}
              </div>
            </div>
            <p className="text-sm text-secondary leading-relaxed">&ldquo;{review.text}&rdquo;</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductReviewForm({ product }: { product: Product }) {
  const { user, signInWithGoogle } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [customerName, setCustomerName] = useState(user?.displayName || "");
  const [customerPhone, setCustomerPhone] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pendingReview, setPendingReview] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !text.trim() || rating === 0) return;
    if (!user && !customerPhone.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await addDoc(collection(db, "testimonials"), {
        customerName: customerName.trim(),
        customerPhone: user ? (customerPhone.trim() || "") : customerPhone.trim(),
        rating,
        text: text.trim(),
        productId: product.id,
        productName: product.name,
        isActive: rating >= 4,
        order: 0,
        createdAt: Date.now(),
      });
      setSubmitted(true);
      if (rating < 4) setPendingReview(true);
    } catch {
      setError("Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-sm mt-4">
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
            <Check className="h-7 w-7 text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-secondary mb-1">Thank You!</h3>
          <p className="text-sm text-muted-foreground">
            {pendingReview
              ? "Your review has been submitted and is pending approval."
              : "Your review has been published. Thank you for your feedback!"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-sm mt-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-accent" />
        <h2 className="text-base font-bold text-secondary">Write a Review</h2>
      </div>

      {!user && (
        <div className="mb-4 pb-4 border-b border-border">
          <p className="text-xs text-muted-foreground mb-2">Sign in to auto-fill your name:</p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-sm"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Google
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rating *</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRating(r)}
                onMouseEnter={() => setHoverRating(r)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-0.5 transition-colors"
              >
                <Star
                  className={`h-6 w-6 ${
                    r <= (hoverRating || rating) ? "text-amber-400 fill-amber-400" : "text-gray-200"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Your Name {!user && "*"}
            </label>
            <input
              type="text"
              value={user ? (user.displayName || customerName) : customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={user ? user.displayName || "Enter your name" : "Enter your name"}
              required={!user}
              readOnly={!!user}
              className={`w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent ${user ? "bg-muted/50 text-muted-foreground" : ""}`}
            />
            {user && <p className="text-[10px] text-muted-foreground mt-0.5">Signed in as {user.displayName || user.email}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Mobile Number {!user && "*"}
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder={user ? "Optional" : "98XXXXXXXX"}
              required={!user}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Your Review *</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share your experience with this product..."
            rows={3}
            required
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !customerName.trim() || !text.trim() || rating === 0 || (!user && !customerPhone.trim())}
          className="w-full py-2.5 bg-accent text-secondary font-semibold rounded-xl hover:bg-accent/90 transition-all disabled:opacity-50 text-sm"
        >
          {submitting ? "Submitting..." : "Submit Review"}
        </button>

        {rating > 0 && rating < 4 && (
          <p className="text-xs text-amber-600 text-center">
            Reviews with 1-3 stars will be reviewed before publishing.
          </p>
        )}
      </form>
    </div>
  );
}
