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
import { Trash2, Minus, Plus, Tag, CheckCircle, XCircle } from "lucide-react";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalAmount, clearCart } = useCart();
  const { settings } = useShopSettings();
  useEffect(() => { document.title = "Cart - KIKS Collections"; }, []);
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

  const discount = appliedCoupon
    ? appliedCoupon.discountType === "percentage"
      ? Math.min((totalAmount * appliedCoupon.discountValue) / 100, appliedCoupon.maxDiscount || Infinity)
      : appliedCoupon.discountValue
    : 0;

  const finalTotal = Math.max(0, totalAmount - discount);

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

      const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() } as Coupon;
      const now = Date.now();

      if (coupon.validFrom && now < coupon.validFrom) {
        setCouponError("Coupon is not yet valid");
        return;
      }
      if (coupon.validUntil && now > coupon.validUntil) {
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
        purity: i.purity,
        makingCharge: i.makingCharge,
        subtotal: i.price * i.quantity,
      }));

      const orderData = {
        orderNumber: orderNum,
        customer: { name: customerName, phone: customerPhone, address: customerAddress },
        items: itemsData,
        totalAmount: finalTotal,
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
      setOrderPlaced(true);

      const waLink = generateWhatsAppLink(
        settings.whatsappNumber || "977XXXXXXXXX",
        items,
        finalTotal,
        customerName,
        customerPhone,
        customerAddress,
      );
      window.location.href = waLink;
    } catch {
      setOrdering(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <ShopHeader />
        <main className="flex-1 flex items-center justify-center px-4 py-20">
          <div className="text-center max-w-md">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-secondary mb-2">Order Placed!</h1>
            <p className="text-muted-foreground mb-2">Order #{orderNumber}</p>
            <p className="text-sm text-muted-foreground mb-6">
              Your order details have been sent via WhatsApp. Our team will contact you shortly.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/products"
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                onClick={() => clearCart()}
              >
                Continue Shopping
              </Link>
              <Link
                href="/"
                className="px-6 py-2 border border-border rounded-lg font-medium hover:bg-muted transition-colors"
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
    <div className="min-h-screen bg-white flex flex-col">
      <ShopHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <h1 className="text-3xl font-bold text-secondary mb-8">Shopping Cart</h1>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">Your cart is empty</p>
            <Link href="/products" className="text-primary hover:underline font-medium">Browse Products</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center gap-4 bg-white border border-border rounded-xl p-4">
                <div className="w-20 h-20 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No img</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-secondary truncate">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">{item.weight}g</p>
                  <p className="text-primary font-bold mt-1">Rs. {formatNumber(item.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="font-semibold text-secondary w-24 text-right">
                  Rs. {formatNumber(item.price * item.quantity)}
                </p>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <div className="bg-muted rounded-xl p-6 space-y-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal ({items.length} item{items.length > 1 ? "s" : ""})</span>
                <span>Rs. {formatNumber(totalAmount)}</span>
              </div>

              {appliedCoupon && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount ({appliedCoupon.code})</span>
                  <span>- Rs. {formatNumber(discount)}</span>
                </div>
              )}

              <div className="flex justify-between text-lg font-bold text-secondary pt-2 border-t border-border">
                <span>Total</span>
                <span>Rs. {formatNumber(finalTotal)}</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm uppercase"
                />
                <button
                  onClick={validateCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <Tag className="h-4 w-4" /> Apply
                </button>
              </div>
              {couponError && (
                <p className="flex items-center gap-1 text-sm text-red-500">
                  <XCircle className="h-4 w-4" /> {couponError}
                </p>
              )}
              {appliedCoupon && (
                <p className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" /> Coupon applied!
                </p>
              )}

              <div className="space-y-3 pt-2">
                <input
                  type="text"
                  placeholder="Your Name *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="tel"
                  placeholder="Your Phone *"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="text"
                  placeholder="Delivery Address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                onClick={placeOrder}
                disabled={!customerName || !customerPhone || ordering}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {ordering ? "Processing..." : "Order via WhatsApp"}
              </button>
            </div>
          </div>
        )}
      </main>
      <ShopFooter />
    </div>
  );
}
