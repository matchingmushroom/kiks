"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { collection, addDoc, Timestamp, getDocs, query, where, doc, updateDoc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/contexts/CartContext";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { generateWhatsAppLink } from "@/lib/whatsapp";
import { generateOrderNumber, formatNumber } from "@/lib/utils";
import { Coupon } from "@/types";
import {
  Trash2, Minus, Plus, Tag, CheckCircle, XCircle, ExternalLink,
  ShoppingBag, ArrowLeft, MapPin, User, Phone, Home, Sparkles,
  Package, ShieldCheck, Clock, Award, Loader2, Gift
} from "lucide-react";
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
  const [loyaltyData, setLoyaltyData] = useState<{ name: string; points: number } | null>(null);
  const [redeemAmount, setRedeemAmount] = useState(0);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltyError, setLoyaltyError] = useState("");
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);

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

  const finalTotal = Math.max(0, totalAmount - discount - loyaltyDiscount) + deliveryFee;
  const [comboIds, setComboIds] = useState<string[]>([]);

  useEffect(() => {
    const q = query(collection(db, "products"), where("comboItems", "!=", null));
    getDocs(q).then((snap) => setComboIds(snap.docs.map((d) => d.id))).catch(() => {});
  }, []);

  const hasCombo = items.some((i) => (i.comboItems?.length ?? 0) > 0 || comboIds.includes(i.productId));

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    if (hasCombo) { setCouponError("Coupon codes cannot be used with combo deals"); return; }
    setCouponLoading(true);
    setCouponError("");
    setAppliedCoupon(null);
    try {
      const q = query(collection(db, "coupons"), where("code", "==", couponCode.trim().toUpperCase()), where("isActive", "==", true));
      const snap = await getDocs(q);
      if (snap.empty) { setCouponError("Invalid coupon code"); return; }
      const data = snap.docs[0].data();
      const coupon = { id: snap.docs[0].id, ...data } as Coupon;
      const now = Date.now();
      const validFrom = data.validFrom && typeof data.validFrom.toMillis === "function" ? data.validFrom.toMillis() : Number(data.validFrom) || 0;
      const validUntil = data.validUntil && typeof data.validUntil.toMillis === "function" ? data.validUntil.toMillis() : Number(data.validUntil) || 0;
      if (validFrom && now < validFrom) { setCouponError("Coupon is not yet valid"); return; }
      if (validUntil && now > validUntil) { setCouponError("Coupon has expired"); return; }
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) { setCouponError("Coupon usage limit reached"); return; }
      if (totalAmount < coupon.minPurchaseAmount) { setCouponError(`Minimum purchase is Rs. ${formatNumber(coupon.minPurchaseAmount)}`); return; }
      if ((coupon.restrictedToPhones?.length || 0) > 0 && !(coupon.restrictedToPhones || []).includes(customerPhone)) { setCouponError("This coupon is for a specific buyer"); return; }
      setAppliedCoupon(coupon);
    } catch { setCouponError("Failed to validate coupon"); }
    setCouponLoading(false);
  };

  const checkLoyalty = async () => {
    if (!customerPhone) { setLoyaltyError("Enter your phone number first"); return; }
    setLoyaltyLoading(true);
    setLoyaltyError("");
    setLoyaltyData(null);
    try {
      const { getBalance, setGasUrl } = await import("@/lib/loyalty-gas");
      if (settings.gasLoyaltyUrl) setGasUrl(settings.gasLoyaltyUrl);
      const res = await getBalance(customerPhone);
      if (res.ok && res.data) {
        setLoyaltyData({ name: res.data.name, points: res.data.currentPoints });
      } else {
        setLoyaltyError(res.error || "Phone not registered in loyalty program");
      }
    } catch {
      setLoyaltyError("Failed to check loyalty. Try again.");
    }
    setLoyaltyLoading(false);
  };

  const applyLoyaltyRedeem = () => {
    if (!loyaltyData || redeemAmount <= 0) return;
    const maxRedeem = Math.min(redeemAmount, loyaltyData.points, Math.floor(totalAmount));
    setLoyaltyDiscount(maxRedeem);
    setRedeemAmount(maxRedeem);
  };

  const removeLoyalty = () => {
    setLoyaltyDiscount(0);
    setRedeemAmount(0);
    setLoyaltyData(null);
  };

  useEffect(() => {
    if (hasCombo && appliedCoupon) {
      setAppliedCoupon(null);
      setCouponCode("");
      setCouponError("");
    }
  }, [hasCombo]);

  const placeOrder = async () => {
    if (!customerName || !customerPhone || !customerAddress) return;
    setOrderError(""); setOrdering(true);
    try {
      const orderNum = generateOrderNumber();
      const itemsData = items.map((i) => ({
        productId: i.productId, productName: i.name, sku: "", quantity: i.quantity,
        price: i.price, weight: i.weight, purity: i.purity ?? null,
        makingCharge: i.makingCharge ?? null, subtotal: i.price * i.quantity,
      }));
      const orderData: Record<string, unknown> = {
        orderNumber: orderNum,
        customer: { name: customerName, phone: customerPhone, address: customerAddress || null },
        items: itemsData, totalAmount: finalTotal,
        deliveryFee: deliveryFee > 0 ? deliveryFee : null,
        deliveryLocation, status: "pending", notes: "", processedBy: "",
        createdAt: Timestamp.fromDate(new Date()),
        ...(loyaltyDiscount > 0 ? { loyaltyRedeemed: loyaltyDiscount, loyaltyPhone: customerPhone } : {}),
      };
      let orderRef;
      if (appliedCoupon) {
        orderRef = await runTransaction(db, async (transaction) => {
          const couponRef = doc(db, "coupons", appliedCoupon.id);
          const couponSnap = await transaction.get(couponRef);
          if (!couponSnap.exists()) throw new Error("Coupon no longer valid");
          const couponData = couponSnap.data();
          if (couponData.usageLimit && (couponData.usedCount || 0) >= couponData.usageLimit) {
            throw new Error("Coupon usage limit reached");
          }
          const ref = await addDoc(collection(db, "orders"), orderData);
          transaction.update(couponRef, { usedCount: (couponData.usedCount || 0) + 1, issuedForOrderId: ref.id });
          return ref;
        });
      } else {
        orderRef = await addDoc(collection(db, "orders"), orderData);
      }
      setOrderNumber(orderNum);
      const totalDiscount = discount + loyaltyDiscount;
      const wLink = generateWhatsAppLink(settings.whatsappNumber || "977XXXXXXXXX", items, finalTotal, customerName, customerPhone, customerAddress, appliedCoupon?.code, totalDiscount, deliveryFee, deliveryLocation ?? undefined);
      setWaLink(wLink); setOrderPlaced(true);
    } catch (err) {
      setOrderError("Failed to place order. Please try again.");
      setOrdering(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-emerald-50 flex flex-col">
        <ShopHeader />
        <main className="flex-1 flex items-center justify-center px-4 py-16 sm:py-24">
          <div className="text-center max-w-lg w-full">
            <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6 shadow-lg">
              <CheckCircle className="h-12 w-12 text-emerald-600" />
            </div>
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <Sparkles className="h-3.5 w-3.5" /> Order Confirmed
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-secondary mb-2">Thank You!</h1>
            <p className="text-muted-foreground text-sm mb-1">Order #{orderNumber}</p>
            <p className="text-muted-foreground text-sm mb-8 max-w-sm mx-auto">
              Your order has been saved. Share it via WhatsApp to confirm.
            </p>
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 bg-emerald-600 text-white rounded-full font-semibold hover:bg-emerald-700 transition-all shadow-md hover:shadow-lg mb-8"
              >
                <ExternalLink className="h-5 w-5" /> Share on WhatsApp
              </a>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/products" onClick={() => clearCart()}
                className="px-6 py-2.5 bg-accent text-secondary font-semibold rounded-full hover:bg-accent/90 transition-colors text-center"
              >Continue Shopping</Link>
              <Link href="/"
                className="px-6 py-2.5 border-2 border-border rounded-full font-medium hover:bg-muted transition-colors text-center"
              >Back to Home</Link>
            </div>
          </div>
        </main>
        <ShopFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      <ShopHeader />
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full">
        <div className="flex items-center gap-3 mb-6 sm:mb-10">
          <Link href="/products" className="p-2 -ml-2 hover:bg-white rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-secondary">Shopping Cart</h1>
            <p className="text-sm text-muted-foreground hidden sm:block mt-0.5">Review and confirm your order</p>
          </div>
          {items.length > 0 && (
            <span className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground bg-white border border-border px-3 py-1.5 rounded-full">
              <Package className="h-4 w-4" /> {items.length} item{items.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20 sm:py-28 max-w-md mx-auto">
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="h-10 w-10 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-secondary mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground text-sm mb-8">Looks like you haven&apos;t added anything to your cart yet.</p>
            <Link href="/products"
              className="inline-flex items-center gap-2 px-8 py-3 bg-accent text-secondary font-semibold rounded-full hover:bg-accent/90 transition-colors shadow-sm"
            >
              <ShoppingBag className="h-4 w-4" /> Start Shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="lg:hidden space-y-3 mb-6">
              {items.map((item) => (
                <div key={item.productId} className="bg-white rounded-xl border border-border p-4 shadow-sm">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-lg flex-shrink-0 overflow-hidden border border-border">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No img</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-secondary text-sm truncate">{item.name}</h3>
                        <button onClick={() => removeItem(item.productId)} className="p-1.5 text-red-400 hover:text-red-600 shrink-0 -mr-1 -mt-1">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-primary font-bold text-sm mt-0.5">Rs. {formatNumber(item.price)}</p>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-slate-50 transition-colors"
                          ><Minus className="h-3.5 w-3.5" /></button>
                          <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-slate-50 transition-colors"
                          ><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                        <p className="font-bold text-secondary">Rs. {formatNumber(item.price * item.quantity)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <CustomerDetailsSection
                customerName={customerName} setCustomerName={setCustomerName}
                customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
                customerAddress={customerAddress} setCustomerAddress={setCustomerAddress}
              />

              <DeliverySection deliveryLocation={deliveryLocation} setDeliveryLocation={setDeliveryLocation} />

              <CouponSection
                couponCode={couponCode} setCouponCode={setCouponCode}
                couponLoading={couponLoading} couponError={couponError}
                appliedCoupon={appliedCoupon} validateCoupon={validateCoupon} hasCombo={hasCombo}
              />

              <LoyaltySection
                customerPhone={customerPhone}
                loyaltyData={loyaltyData}
                loyaltyLoading={loyaltyLoading}
                loyaltyError={loyaltyError}
                redeemAmount={redeemAmount}
                loyaltyDiscount={loyaltyDiscount}
                setRedeemAmount={setRedeemAmount}
                checkLoyalty={checkLoyalty}
                applyLoyaltyRedeem={applyLoyaltyRedeem}
                removeLoyalty={removeLoyalty}
              />

              <SummarySection
                totalAmount={totalAmount} discount={discount} appliedCoupon={appliedCoupon}
                deliveryLocation={deliveryLocation} deliveryFee={deliveryFee}
                finalTotal={finalTotal} orderError={orderError}
                ordering={ordering} placeOrder={placeOrder}
                customerName={customerName} customerPhone={customerPhone} customerAddress={customerAddress}
              />
            </div>

            <div className="hidden lg:grid lg:grid-cols-12 gap-8">
              <div className="col-span-7 space-y-6">
                <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-secondary mb-5 flex items-center gap-2">
                    <Package className="h-5 w-5 text-accent" /> Cart Items
                  </h2>
                  <div className="divide-y divide-border/60">
                    {items.map((item) => (
                      <div key={item.productId} className="flex items-center gap-5 py-5 first:pt-0 last:pb-0">
                        <div className="w-24 h-24 bg-slate-50 rounded-xl flex-shrink-0 overflow-hidden border border-border">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No img</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-secondary text-base truncate">{item.name}</h3>
                          <p className="text-primary font-bold mt-1">Rs. {formatNumber(item.price)}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <button onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border hover:bg-slate-50 transition-colors"
                            ><Minus className="h-4 w-4" /></button>
                            <span className="w-10 text-center font-semibold">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border hover:bg-slate-50 transition-colors"
                            ><Plus className="h-4 w-4" /></button>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-secondary text-base">Rs. {formatNumber(item.price * item.quantity)}</p>
                          <button onClick={() => removeItem(item.productId)}
                            className="mt-2 text-sm text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
                          ><Trash2 className="h-4 w-4" /> Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-secondary mb-5 flex items-center gap-2">
                    <User className="h-5 w-5 text-accent" /> Customer Details
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <InputWithIcon icon={User} placeholder="Your Name *" value={customerName} onChange={setCustomerName} />
                    <InputWithIcon icon={Phone} placeholder="Your Phone *" value={customerPhone} onChange={(v) => setCustomerPhone(v.replace(/\D/g, "").slice(0, 10))} />
                    <div className="col-span-2">
                      <InputWithIcon icon={Home} placeholder="Delivery Address *" value={customerAddress} onChange={setCustomerAddress} />
                    </div>
                  </div>
                </div>
                <DeliverySection deliveryLocation={deliveryLocation} setDeliveryLocation={setDeliveryLocation} />
              </div>

              <div className="col-span-5 space-y-5">
                <CouponSection
                  couponCode={couponCode} setCouponCode={setCouponCode}
                  couponLoading={couponLoading} couponError={couponError}
                  appliedCoupon={appliedCoupon} validateCoupon={validateCoupon} hasCombo={hasCombo}
                />

                <LoyaltySection
                  customerPhone={customerPhone}
                  loyaltyData={loyaltyData}
                  loyaltyLoading={loyaltyLoading}
                  loyaltyError={loyaltyError}
                  redeemAmount={redeemAmount}
                  loyaltyDiscount={loyaltyDiscount}
                  setRedeemAmount={setRedeemAmount}
                  checkLoyalty={checkLoyalty}
                  applyLoyaltyRedeem={applyLoyaltyRedeem}
                  removeLoyalty={removeLoyalty}
                />

                <SummarySection
                  totalAmount={totalAmount} discount={discount} appliedCoupon={appliedCoupon}
                  deliveryLocation={deliveryLocation} deliveryFee={deliveryFee}
                  finalTotal={finalTotal} orderError={orderError}
                  ordering={ordering} placeOrder={placeOrder}
                  customerName={customerName} customerPhone={customerPhone} customerAddress={customerAddress}
                />

                <div className="flex items-center gap-4 text-xs text-muted-foreground justify-center">
                  <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Secure Checkout</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Instant Confirmation</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      <ShopFooter />
    </div>
  );
}

function InputWithIcon({ icon: Icon, placeholder, value, onChange }: { icon: any; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border border-border rounded-xl focus-within:ring-2 focus-within:ring-accent/40 focus-within:border-accent transition-all bg-white">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <input type="text" placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent focus:outline-none text-sm placeholder:text-muted-foreground/60"
      />
    </div>
  );
}

function CouponSection({ couponCode, setCouponCode, couponLoading, couponError, appliedCoupon, validateCoupon, hasCombo }: any) {
  const [showInput, setShowInput] = useState(false);
  if (appliedCoupon && !showInput) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Coupon Applied</p>
              <p className="text-xs text-emerald-600">{appliedCoupon.code} — Rs. {formatNumber(appliedCoupon.discountType === "percentage" ? 0 : appliedCoupon.discountValue)} off</p>
            </div>
          </div>
          <button onClick={() => { setShowInput(true); setCouponCode(""); }} className="text-xs text-red-500 hover:underline">Remove</button>
        </div>
      </div>
    );
  }
  if (hasCombo) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">Coupon codes not applicable on combo deals. Use loyalty points instead.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-border p-4 sm:p-5 shadow-sm">
      <h2 className="font-semibold text-secondary mb-3 flex items-center gap-2 text-sm">
        <Tag className="h-4 w-4 text-accent" /> Have a coupon?
      </h2>
      <div className="flex gap-2">
        <input type="text" placeholder="Enter coupon code" value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          className="flex-1 px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/40 text-sm uppercase"
        />
        <button onClick={validateCoupon} disabled={couponLoading || !couponCode.trim()}
          className="px-5 py-2.5 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
        >{couponLoading ? "..." : "Apply"}</button>
      </div>
      {couponError && <p className="flex items-center gap-1.5 text-xs text-red-500 mt-2"><XCircle className="h-3.5 w-3.5 shrink-0" /> {couponError}</p>}
    </div>
  );
}

function DeliverySection({ deliveryLocation, setDeliveryLocation }: any) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 sm:p-5 shadow-sm">
      <h2 className="font-semibold text-secondary mb-3 flex items-center gap-2 text-sm">
        <MapPin className="h-4 w-4 text-accent" /> Delivery Location
      </h2>
      <div className="flex gap-3">
        {(["inside_valley", "outside_valley"] as const).map((loc) => (
          <button key={loc} onClick={() => setDeliveryLocation(loc)}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
              deliveryLocation === loc
                ? "border-accent bg-accent/5 text-accent shadow-sm"
                : "border-border text-muted-foreground hover:border-muted-foreground/30"
            }`}
          >
            <MapPin className="h-5 w-5 mx-auto mb-1" />
            {loc === "inside_valley" ? "Inside Valley" : "Outside Valley"}
          </button>
        ))}
      </div>
    </div>
  );
}

function CustomerDetailsSection({ customerName, setCustomerName, customerPhone, setCustomerPhone, customerAddress, setCustomerAddress }: any) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 sm:p-5 shadow-sm">
      <h2 className="font-semibold text-secondary mb-3 flex items-center gap-2 text-sm">
        <User className="h-4 w-4 text-accent" /> Your Details
      </h2>
      <div className="space-y-3">
        <InputWithIcon icon={User} placeholder="Your Name *" value={customerName} onChange={setCustomerName} />
        <InputWithIcon icon={Phone} placeholder="Your Phone *" value={customerPhone} onChange={(v: string) => setCustomerPhone(v.replace(/\D/g, "").slice(0, 10))} />
        <InputWithIcon icon={Home} placeholder="Delivery Address *" value={customerAddress} onChange={setCustomerAddress} />
      </div>
    </div>
  );
}

function SummarySection({ totalAmount, discount, appliedCoupon, deliveryLocation, deliveryFee, finalTotal, orderError, ordering, placeOrder, customerName, customerPhone, customerAddress, loyaltyDiscount }: any) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 sm:p-5 shadow-sm lg:sticky lg:top-28">
      <h2 className="font-bold text-secondary mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" /> Order Summary
      </h2>
      <div className="space-y-3 text-sm">
        <SummaryRow label="Subtotal" value={`Rs. ${formatNumber(totalAmount)}`} />
        {appliedCoupon && (
          <SummaryRow label="Discount" value={`-Rs. ${formatNumber(discount)}`} valueClass="text-emerald-600" />
        )}
        {loyaltyDiscount > 0 && (
          <SummaryRow label="Loyalty Points" value={`-Rs. ${formatNumber(loyaltyDiscount)}`} valueClass="text-purple-600" />
        )}
        {deliveryLocation && (
          <SummaryRow label="Delivery" value={deliveryFee === 0 ? "Free" : `Rs. ${formatNumber(deliveryFee)}`} valueClass={deliveryFee === 0 ? "text-emerald-600 font-medium" : ""} />
        )}
      </div>
      <div className="flex justify-between items-center py-3 mt-3 border-t border-border">
        <span className="text-base font-bold text-secondary">Total</span>
        <span className="text-xl font-bold text-secondary">Rs. {formatNumber(finalTotal)}</span>
      </div>
      {orderError && (
        <p className="flex items-center gap-1.5 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-3">
          <XCircle className="h-4 w-4 shrink-0" /> {orderError}
        </p>
      )}
      <button onClick={placeOrder} disabled={!customerName || !customerPhone || !customerAddress || ordering}
        className="w-full mt-1 py-3.5 bg-accent text-secondary font-bold rounded-xl hover:bg-accent/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-base shadow-sm hover:shadow-md"
      >
        {ordering ? (
          <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /> Processing...</span>
        ) : (
          <><Sparkles className="h-5 w-5" /> Confirm Your Order</>
        )}
      </button>
    </div>
  );
}

function SummaryRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium text-secondary ${valueClass || ""}`}>{value}</span>
    </div>
  );
}

function LoyaltySection({
  customerPhone, loyaltyData, loyaltyLoading, loyaltyError,
  redeemAmount, loyaltyDiscount,
  setRedeemAmount, checkLoyalty, applyLoyaltyRedeem, removeLoyalty,
}: any) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 sm:p-5 shadow-sm">
      <h2 className="font-semibold text-secondary mb-3 flex items-center gap-2 text-sm">
        <Award className="h-4 w-4 text-accent" /> Redeem Points
      </h2>
      {loyaltyDiscount > 0 ? (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-semibold text-purple-800">Points Redeemed</p>
                <p className="text-xs text-purple-600">Rs. {formatNumber(loyaltyDiscount)} discount applied</p>
              </div>
            </div>
            <button onClick={removeLoyalty} className="text-xs text-red-500 hover:underline">Remove</button>
          </div>
        </div>
      ) : loyaltyData ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Welcome, <span className="font-semibold text-secondary">{loyaltyData.name}</span></p>
            <p className="text-sm font-bold text-purple-700">{loyaltyData.points} pts</p>
          </div>
          <div className="flex gap-2">
            <input type="number" placeholder="Points to redeem" value={redeemAmount || ""}
              onChange={(e) => setRedeemAmount(Math.min(Number(e.target.value) || 0, loyaltyData.points))}
              max={loyaltyData.points}
              className="flex-1 px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/40 text-sm" />
            <button onClick={applyLoyaltyRedeem} disabled={!redeemAmount || redeemAmount <= 0}
              className="px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50">
              Apply
            </button>
          </div>
          <p className="text-xs text-muted-foreground">1 point = Rs. 1 discount. Max {loyaltyData.points} pts available.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Check your loyalty points balance and redeem for discounts.</p>
          <button onClick={checkLoyalty} disabled={loyaltyLoading || !customerPhone}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-50 border border-purple-200">
            {loyaltyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
            {loyaltyLoading ? "Checking..." : "Check My Points"}
          </button>
          {loyaltyError && <p className="flex items-center gap-1.5 text-xs text-red-500"><XCircle className="h-3.5 w-3.5 shrink-0" /> {loyaltyError}</p>}
        </div>
      )}
    </div>
  );
}
