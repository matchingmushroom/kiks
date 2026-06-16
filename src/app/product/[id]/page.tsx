"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/contexts/CartContext";
import { Product } from "@/types";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";
import { ShoppingBag, Check, ChevronLeft, ChevronRight } from "lucide-react";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchProduct = async () => {
      const timeoutId = setTimeout(() => {
        if (!cancelled) {
          setError("Request timed out — Firestore not reachable from this domain");
          setLoading(false);
        }
      }, 15000);
      try {
        const docSnap = await getDoc(doc(db, "products", params.id as string));
        if (!cancelled) {
          if (docSnap.exists()) {
            const p = { id: docSnap.id, ...docSnap.data() } as Product;
            setProduct(p);
            document.title = `${p.name} - KIKS Collections`;
          }
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          const msg = e?.message || e?.code || String(e);
          setError(msg);
          setLoading(false);
        }
      }
      clearTimeout(timeoutId);
    };
    fetchProduct();
    return () => { cancelled = true; };
  }, [params.id]);

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      productId: product.id,
      name: product.name,
      image: product.images?.[0] || "",
      price: product.price,
      weight: product.weight,
      makingCharge: product.makingCharge,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <ShopHeader />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center text-muted-foreground">
          Loading product details...
        </main>
        <ShopFooter />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <ShopHeader />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-lg mx-auto">
            <p className="text-red-800 font-medium mb-2">Failed to load product</p>
            <pre className="text-sm text-red-600 whitespace-pre-wrap">{error}</pre>
            <Link href="/products" className="inline-block mt-4 text-primary hover:underline font-medium">Browse all products</Link>
          </div>
        </main>
        <ShopFooter />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <ShopHeader />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-muted-foreground mb-4">Product not found</p>
          <Link href="/products" className="text-primary hover:underline">Browse all products</Link>
        </main>
        <ShopFooter />
      </div>
    );
  }

  const specs = [
    { label: "Brand", value: product.brand || "—" },
    { label: "Model Number", value: product.modelNo || "—" },
    { label: "Base Material", value: product.baseMaterial || "—" },
    { label: "Plating Type", value: product.plating || "—" },
    { label: "Color", value: product.color || "—" },
    { label: "Type", value: product.productType || "—" },
    { label: "Ideal For", value: product.idealFor || "—" },
    { label: "Occasion", value: product.occasion || "—" },
    { label: "Net Quantity", value: product.netQuantity ? String(product.netQuantity) : "—" },
    { label: "Warranty", value: product.warranty || "No warranty" },
  ].filter(s => s.value !== "—");

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ShopHeader />
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
              {product.images?.[selectedImage] ? (
                <>
                  <img
                    src={product.images[selectedImage]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  {product.images.length > 1 && (
                    <>
                      <button onClick={() => setSelectedImage((selectedImage - 1 + product.images.length) % product.images.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button onClick={() => setSelectedImage((selectedImage + 1) % product.images.length)}
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
            {product.images && product.images.length > 1 && (
              <div className="flex gap-2">
                {product.images.map((img, i) => (
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
                  Rs. {(product.originalPrice || product.price).toLocaleString("ne-NP")}
                </span>
                <span className="text-3xl font-bold text-primary">
                  Rs. {product.price.toLocaleString("ne-NP")}
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
                Rs. {product.price.toLocaleString("ne-NP")}
              </p>
            )}

            <p className="text-muted-foreground mb-6 leading-relaxed">
              {product.description || "No description available."}
            </p>

            <div className="border border-border rounded-xl divide-y divide-border mb-8">
              {specs.map((spec) => (
                <div key={spec.label} className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{spec.label}</span>
                  <span className="font-medium text-secondary">{spec.value}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-6 flex-wrap">
              {product.badge === "limited_stock" && (
                <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded font-medium">Limited Stock</span>
              )}
              {product.badge === "out_of_stock" && (
                <span className="text-xs bg-red-500 text-white px-2 py-1 rounded font-medium">Out of Stock</span>
              )}
              <span className={`inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full ${
                product.quantityInStock > 0
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  product.quantityInStock > 0 ? "bg-green-500" : "bg-red-500"
                }`} />
                {product.quantityInStock > 0 ? `In Stock (${product.quantityInStock})` : "Out of Stock"}
              </span>
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
      <ShopFooter />
    </div>
  );
}
