"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { collection, addDoc, Timestamp, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/contexts/CartContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { generateWhatsAppLink } from "@/lib/whatsapp";
import { generateOrderNumber, formatNumber } from "@/lib/utils";
import { Coupon } from "@/types";
import { Trash2, Minus, Plus, Tag, CheckCircle, XCircle, ExternalLink, ShoppingBag, ArrowLeft, MapPin, User, Phone, Home, Percent, Sparkles } from "lucide-react";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalAmount, clearCart } = useCart();
  const { settings } = useShopSettings();
  useEffect(() => { document.title = `Cart - ${settings.shopName}`; }, [settings.shopName]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [waLink, setWaLink] = useState("");
  const [orderError, setOrderError] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState<"inside_valley" | "outside_valley" | null>(null);

  const discount = appliedCoupon
    ? appliedCoupon.discountType === "percentage"
      ? Math.min((totalAmount * appliedCoupon.discountValue) / 100, appliedCoupon.maxDiscount || Infinity)
      : appliedCoupon.discountValue
    : 0;

  const baseDeliveryFee = deliveryLocation === "inside_valley"
    ? (settings.deliveryFeeInsideValley ?? 0)
    : deliveryLocation === "outside_valley"
      ? (settings.deliveryFeeOutsideValley ?? 0)
      : 0;
  const deliveryFee = (settings.freeDeliveryThreshold && totalAmount >= settings.freeDeliveryThreshold) ? 0 : baseDeliveryFee;

  const finalTotal = Math.max(0, totalAmount - discount) + deliveryFee;

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    setAppliedCoupon(null);

    try {
      const q = query(
        collection(db, "coupons"),
        where("code", "==", couponCode.trim().toUpperCase()),
        where("isActive", "==", true)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setCouponError("Invalid coupon code");
        return;
      }

      const data = snap.docs[0].data();
      const coupon = { id: snap.docs[0].id, ...data } as Coupon;
      const now = Date.now();

      const validFrom = data.validFrom && typeof data.validFrom.toMillis === "function" ? data.validFrom.toMillis() : Number(data.validFrom) || 0;
      const validUntil = data.validUntil && typeof data.validUntil.toMillis === "function" ? data.validUntil.toMillis() : Number(data.validUntil) || 0;

      if (validFrom && now < validFrom) {
        setCouponError("Coupon is not yet valid");
        return;
      }
      if (validUntil && now > validUntil) {
        setCouponError("Coupon has expired");
        return;
      }
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        setCouponError("Coupon usage limit reached");
        return;
      }
      if (totalAmount < coupon.minPurchaseAmount) {
        setCouponError(`Minimum purchase amount is Rs. ${formatNumber(coupon.minPurchaseAmount)}`);
        return;
      }
      if ((coupon.restrictedToPhones?.length || 0) > 0 && !(coupon.restrictedToPhones || []).includes(customerPhone)) {
        setCouponError("This coupon is only valid for a specific buyer");
        return;
      }

      setAppliedCoupon(coupon);
    } catch {
      setCouponError("Failed to validate coupon");
    }
    setCouponLoading(false);
  };

  const placeOrder = async () => {
    if (!customerName || !customerPhone) return;
    setOrderError("");
    setOrdering(true);

    try {
      const orderNum = generateOrderNumber();
      const itemsData = items.map((i) => ({
        productId: i.productId,
        productName: i.name,
        sku: "",
        quantity: i.quantity,
        price: i.price,
        weight: i.weight,
        purity: i.purity ?? null,
        makingCharge: i.makingCharge ?? null,
        subtotal: i.price * i.quantity,
      }));

      const orderData: Record<string, unknown> = {
        orderNumber: orderNum,
        customer: { name: customerName, phone: customerPhone, address: customerAddress || null },
        items: itemsData,
        totalAmount: finalTotal,
        deliveryFee: deliveryFee > 0 ? deliveryFee : null,
        deliveryLocation: deliveryLocation,
        couponApplied: appliedCoupon ? { code: appliedCoupon.code, discountValue: discount } : null,
        status: "pending",
        notes: "",
        processedBy: "",
        createdAt: Timestamp.fromDate(new Date()),
      };

      const orderRef = await addDoc(collection(db, "orders"), orderData);

      if (appliedCoupon) {
        await updateDoc(doc(db, "coupons", appliedCoupon.id), {
          usedCount: (appliedCoupon.usedCount || 0) + 1,
          issuedForOrderId: orderRef.id,
        });
      }

      setOrderNumber(orderNum);

      const wLink = generateWhatsAppLink(
        settings.whatsappNumber || "977XXXXXXXXX",
        items,
        finalTotal,
        customerName,
        customerPhone,
        customerAddress,
        appliedCoupon?.code,
        discount,
        deliveryFee,
        deliveryLocation ?? undefined,
      );
      setWaLink(wLink);
      setOrderPlaced(true);
    } catch (err) {
      setOrderError("Failed to place order: " + (err instanceof Error ? err.message : "Unknown error"));
      setOrdering(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <ShopHeader />
        <main className="flex-1 flex items-center justify-center px-4 py-20">
          <div className="text-center max-w-md w-full">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-secondary mb-2">Order Placed!</h1>
            <p className="text-sm text-muted-foreground mb-1">Order #{orderNumber}</p>
            <p className="text-sm text-muted-foreground mb-8">
              Your order has been saved. Click below to send details via WhatsApp.
            </p>
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 bg-green-600 text-white rounded-full font-medium hover:bg-green-700 transition-colors mb-6"
              >
                <ExternalLink className="h-5 w-5" /> Open WhatsApp
              </a>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/products"
                className="px-6 py-2.5 bg-accent text-secondary font-semibold rounded-full hover:bg-accent/90 transition-colors text-center"
                onClick={() => clearCart()}
              >
                Continue Shopping
              </Link>
              <Link
                href="/"
                className="px-6 py-2.5 border-2 border-border rounded-full font-medium hover:bg-muted transition-colors text-center"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </main>
        <ShopFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <ShopHeader />
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 w-full">
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <Link href="/products" className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-secondary">Shopping Cart</h1>
          {items.length > 0 && (
            <span className="text-sm text-muted-foreground ml-auto sm:ml-0">
              {items.length} item{items.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-2">Your cart is empty</p>
            <p className="text-sm text-muted-foreground mb-6">Looks like you haven&apos;t added anything yet</p>
            <Link href="/products" className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent text-secondary font-semibold rounded-full hover:bg-accent/90 transition-colors">
              Browse Products <ShoppingBag className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="lg:col-span-2 space-y-3 sm:space-y-4">
              {items.map((item) => (
                <div key={item.productId} className="bg-white rounded-xl border border-border p-3 sm:p-4 flex items-center gap-3 sm:gap-4 shadow-sm">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No img</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-secondary text-sm sm:text-base truncate">{item.name}</h3>
                    <p className="text-primary font-bold text-sm sm:text-base mt-0.5">Rs. {formatNumber(item.price)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 sm:w-10 text-center font-semibold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-secondary text-sm sm:text-base">Rs. {formatNumber(item.price * item.quantity)}</p>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="mt-2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4 sm:sticky sm:top-28 sm:self-start">
              <div className="bg-white rounded-xl border border-border p-4 sm:p-5 shadow-sm">
                <h2 className="font-bold text-secondary mb-3 flex items-center gap-2">
                  <Percent className="h-4 w-4 text-accent" />
                  Have a coupon?
                </h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm uppercase"
                  />
                  <button
                    onClick={validateCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
                  >
                    {couponLoading ? "..." : "Apply"}
                  </button>
                </div>
                {couponError && (
                  <p className="flex items-center gap-1 text-xs text-red-500 mt-2">
                    <XCircle className="h-3.5 w-3.5 shrink-0" /> {couponError}
                  </p>
                )}
                {appliedCoupon && (
                  <p className="flex items-center gap-1 text-xs text-green-600 mt-2">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" /> Coupon applied! ({appliedCoupon.code})
                  </p>
                )}
              </div>

              <div className="bg-white rounded-xl border border-border p-4 sm:p-5 shadow-sm">
                <h2 className="font-bold text-secondary mb-3">Delivery Location</h2>
                <div className="flex gap-2">
                  {(["inside_valley", "outside_valley"] as const).map((loc) => (
                    <button
                      key={loc}
                      onClick={() => setDeliveryLocation(loc)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                        deliveryLocation === loc
                          ? "border-accent bg-accent/5 text-accent"
                          : "border-border text-muted-foreground hover:border-muted-foreground/30"
                      }`}
                    >
                      <MapPin className="h-4 w-4 mx-auto mb-0.5" />
                      {loc === "inside_valley" ? "Inside Valley" : "Outside Valley"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-border p-4 sm:p-5 shadow-sm">
                <h2 className="font-bold text-secondary mb-3">Your Details</h2>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      placeholder="Your Name *"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="flex-1 bg-transparent focus:outline-none text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      type="tel"
                      placeholder="Your Phone *"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      className="flex-1 bg-transparent focus:outline-none text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary">
                    <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      placeholder="Delivery Address"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="flex-1 bg-transparent focus:outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-border p-4 sm:p-5 shadow-sm">
                <h2 className="font-bold text-secondary mb-3">Order Summary</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>Rs. {formatNumber(totalAmount)}</span>
                  </div>
                  {appliedCoupon && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({appliedCoupon.code})</span>
                      <span>-Rs. {formatNumber(discount)}</span>
                    </div>
                  )}
                  {deliveryLocation && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Delivery</span>
                      <span>{deliveryFee === 0 ? <span className="text-green-600 font-medium">Free</span> : `Rs. ${formatNumber(deliveryFee)}`}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between font-bold text-secondary text-base sm:text-lg mt-3 pt-3 border-t border-border">
                  <span>Total</span>
                  <span>Rs. {formatNumber(finalTotal)}</span>
                </div>

                {orderError && (
                  <p className="flex items-center gap-1 text-sm text-red-500 mt-3">
                    <XCircle className="h-4 w-4 shrink-0" /> {orderError}
                  </p>
                )}

                <button
                  onClick={placeOrder}
                  disabled={!customerName || !customerPhone || ordering}
                  className="w-full mt-4 py-3 bg-accent text-secondary font-bold rounded-full hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  {ordering ? (
                    "Processing..."
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Confirm Your Order
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <ShopFooter />
    </div>
  );
}
