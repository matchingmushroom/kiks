"use client";

import Link from "next/link";
import { Product, ProductBadge } from "@/types";
import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { ShoppingBag } from "lucide-react";

interface ProductCardProps {
  product: Product;
}

const BADGE_STYLES: Record<ProductBadge, { bg: string; label: string }> = {
  none: { bg: "", label: "" },
  limited_stock: { bg: "bg-orange-500", label: "Limited Stock" },
  out_of_stock: { bg: "bg-red-500", label: "Out of Stock" },
  price_dropped: { bg: "bg-emerald-600", label: "Price Dropped" },
  offer: { bg: "bg-amber-500", label: "Offer" },
};

function imgUrl(url: string): string {
  return url.replace(/images\.unsplash\.com\/photo-([^?]+)/, "unsplash.com/photos/$1/download?w=400");
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const badge = product.badge || "none";
  const style = BADGE_STYLES[badge];
  const showBadge = badge !== "none";

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: product.id,
      name: product.name,
      image: imgUrl(product.images?.[0] || ""),
      price: product.price,
      weight: product.weight,
      makingCharge: product.makingCharge,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const imageSrc = product.images?.[0] ? imgUrl(product.images[0]) : null;

  return (
    <Link
      href={`/product/${product.id}`}
      className="group bg-white rounded-xl border border-border overflow-hidden hover:shadow-md transition-all"
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            No Image
          </div>
        )}
        {showBadge && (
          <div className={`absolute top-2 left-2 ${style.bg} text-white text-xs px-2 py-1 rounded font-medium`}>
            {style.label}
          </div>
        )}
        {badge === "none" && product.quantityInStock <= 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
            Out of Stock
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-secondary group-hover:text-primary transition-colors truncate">
          {product.name}
        </h3>
        <p className="text-sm text-muted-foreground">{product.weight}g</p>
        <div className="flex items-center justify-between mt-2">
          <div>
            {badge === "price_dropped" || badge === "offer" ? (
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-muted-foreground line-through">
                  Rs. {(product.originalPrice || product.price).toLocaleString("ne-NP")}
                </span>
                <span className="text-primary font-bold">
                  Rs. {product.price.toLocaleString("ne-NP")}
                </span>
              </div>
            ) : (
              <p className="text-primary font-bold">Rs. {product.price.toLocaleString("ne-NP")}</p>
            )}
          </div>
          {product.quantityInStock > 0 && (
            <button
              onClick={handleAddToCart}
              className="p-2 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors"
            >
              <ShoppingBag className={`h-4 w-4 ${added ? "text-green-600" : ""}`} />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
