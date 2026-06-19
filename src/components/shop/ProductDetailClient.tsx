"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { Product } from "@/types";
import { formatNumber } from "@/lib/utils";
import { ShoppingBag, Check, ChevronLeft, ChevronRight } from "lucide-react";

function imgUrl(url: string): string {
  const gd = url.match(/drive\.google\.com\/file\/d\/([^/?#&]+)/);
  if (gd) return `https://drive.google.com/uc?export=view&id=${gd[1]}`;
  return url.replace(/images\.unsplash\.com\/photo-([^?]+)/, "https://unsplash.com/photos/$1/download?w=400");
}

export default function ProductDetailClient({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const images = product.images?.map(imgUrl) || [];

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      image: images[0] || "",
      price: product.price,
      weight: product.weight,
      makingCharge: product.makingCharge,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const specs = [
    { label: "Brand", value: product.brand },
    { label: "Model Number", value: product.modelNo },
    { label: "Base Material", value: product.baseMaterial },
    { label: "Plating Type", value: product.plating },
    { label: "Color", value: product.color },
    { label: "Type", value: product.productType },
    { label: "Ideal For", value: Array.isArray(product.idealFor) ? product.idealFor.join(", ") : product.idealFor },
    { label: "Occasion", value: Array.isArray(product.occasion) ? product.occasion.join(", ") : product.occasion },
    { label: "Net Quantity", value: product.netQuantity ? String(product.netQuantity) : null },
    { label: "Warranty", value: product.warranty },
  ].filter(s => s.value && s.value !== "");

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-secondary mb-6"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          <div>
            <div className="relative aspect-square bg-muted rounded-xl overflow-hidden mb-3 group">
              {images[selectedImage] ? (
                <>
                  <img
                    src={images[selectedImage]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  {images.length > 1 && (
                    <>
                      <button onClick={() => setSelectedImage((selectedImage - 1 + images.length) % images.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button onClick={() => setSelectedImage((selectedImage + 1) % images.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  No Image
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded-lg border-2 overflow-hidden ${
                      i === selectedImage ? "border-primary" : "border-border"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {product.videoUrl && (
              <div className="mt-4 aspect-video rounded-xl overflow-hidden no-print">
                <iframe
                  src={product.videoUrl.replace("watch?v=", "embed/")}
                  title="Product Video"
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-bold text-secondary mb-2">{product.name}</h1>
            {product.badge === "price_dropped" || product.badge === "offer" ? (
              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-2xl text-muted-foreground line-through">
                  Rs. {formatNumber(product.originalPrice || product.price)}
                </span>
                <span className="text-3xl font-bold text-primary">
                  Rs. {formatNumber(product.price)}
                </span>
                {product.badge === "price_dropped" && (
                  <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded font-medium">Price Dropped</span>
                )}
                {product.badge === "offer" && (
                  <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded font-medium">Offer</span>
                )}
              </div>
            ) : (
              <p className="text-3xl font-bold text-primary mb-6">
                Rs. {formatNumber(product.price)}
              </p>
            )}

            <p className="text-muted-foreground mb-6 leading-relaxed">
              {product.description || "No description available."}
            </p>

            {specs.length > 0 && (
              <div className="border border-border rounded-xl divide-y divide-border mb-8">
                {specs.map((spec) => (
                  <div key={spec.label} className="flex justify-between px-4 py-2.5 text-sm">
                    <span className="text-muted-foreground">{spec.label}</span>
                    <span className="font-medium text-secondary">{spec.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 mb-6 flex-wrap">
              {product.badge === "limited_stock" && (
                <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded font-medium">Limited Stock</span>
              )}
              {product.badge === "out_of_stock" && (
                <span className="text-xs bg-red-500 text-white px-2 py-1 rounded font-medium">Out of Stock</span>
              )}
              {product.quantityInStock <= 0 && (
                <span className="text-xs bg-red-500 text-white px-2 py-1 rounded font-medium">Out of Stock</span>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddToCart}
                disabled={product.quantityInStock <= 0}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {added ? (
                  <><Check className="h-5 w-5" /> Added to Cart</>
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
                className="flex-1 py-3 border border-primary text-primary rounded-lg font-medium hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
