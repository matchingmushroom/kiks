"use client";

import Link from "next/link";
import { Product } from "@/types";
import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { ShoppingBag } from "lucide-react";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: product.id,
      name: product.name,
      image: product.images?.[0] || "",
      price: product.price,
      weight: product.weight,
      purity: product.purity,
      makingCharge: product.makingCharge,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Link
      href={`/product/${product.id}`}
      className="group bg-white rounded-xl border border-border overflow-hidden hover:shadow-md transition-all"
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            No Image
          </div>
        )}
        {product.quantityInStock <= 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
            Out of Stock
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-secondary group-hover:text-primary transition-colors truncate">
          {product.name}
        </h3>
        <p className="text-sm text-muted-foreground">
          {product.purity} • {product.weight}g
        </p>
        <div className="flex items-center justify-between mt-2">
          <p className="text-primary font-bold">Rs. {product.price.toLocaleString("ne-NP")}</p>
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
