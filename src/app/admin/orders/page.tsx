"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { Order, Coupon } from "@/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Search, ChevronDown, ChevronUp, ExternalLink, MessageCircle, X } from "lucide-react";
import Link from "next/link";

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  shipped: "bg-purple-50 text-purple-700 border-purple-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

export default function AdminOrdersPage() {
  const { data: orders, loading } = useFirestore<Order>("orders", {
    constraints: [orderBy("createdAt", "desc")],
  });
  const { data: allCoupons } = useFirestore<Coupon>("coupons");
  const { settings } = useShopSettings();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [couponOrder, setCouponOrder] = useState<Order | null>(null);

  const confirmedBuyerCoupons = allCoupons.filter((c) => c.couponType === "For Confirmed Buyers" && c.isActive);

  const filtered = orders.filter((o) => {
    const matchSearch = !search ||
      o.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer?.phone?.includes(search) ||
      o.orderNumber?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const updateStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, "orders", id), { status, updatedAt: Timestamp.fromDate(new Date()) });
  };

  const sendWhatsApp = (order: Order, status: string, coupon?: Coupon) => {
    if (!order.customer?.phone) return;
    const itemsText = (order.items || [])
      .map((i) => `• ${i.productName} x${i.quantity} — Rs. ${i.subtotal.toLocaleString("ne-NP")}`)
      .join("\n");

    const lines = [
      `*Order ${order.orderNumber} — ${status.toUpperCase()}*`,
      `Hi ${order.customer.name}, your order status has been updated to *${status}*.`,
      "",
      itemsText,
      "",
      `*Total: Rs. ${order.totalAmount.toLocaleString("ne-NP")}*`,
      "",
    ];

    if (status === "delivered") {
      if (coupon) {
        const benefit = coupon.discountType === "percentage"
          ? `${coupon.discountValue}% off`
          : `Rs. ${coupon.discountValue.toLocaleString("ne-NP")} off`;
        lines.push(`Use promo code *${coupon.code}* — ${benefit} on your next purchase!`);
        lines.push("");
      }
      lines.push("Thank you for shopping with KIKS Collections! We hope to see you again!");
    } else {
      lines.push("Thank you for choosing KIKS Collections!");
    }

    const msg = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/${order.customer.phone}?text=${msg}`, "_blank");
  };

  const notifyDelivered = (order: Order) => {
    if (!order.customer?.phone) return;
    if (confirmedBuyerCoupons.length === 0) {
      sendWhatsApp(order, "delivered");
      return;
    }
    setCouponOrder(order);
  };

  const selectCoupon = async (coupon: Coupon | null) => {
    if (!couponOrder) return;
    const phone = couponOrder.customer?.phone;
    if (coupon && phone) {
      const existing = coupon.restrictedToPhones || [];
      if (existing.includes(phone)) {
        alert("This customer already has this coupon assigned.");
        setCouponOrder(null);
        return;
      }
      if (existing.length >= (coupon.usageLimit || Infinity)) {
        alert("This coupon has reached its usage limit.");
        setCouponOrder(null);
        return;
      }
      await updateDoc(doc(db, "coupons", coupon.id), {
        restrictedToPhones: [...existing, phone],
      });
    }
    sendWhatsApp(couponOrder, "delivered", coupon || undefined);
    setCouponOrder(null);
  };

  const handleNotify = (order: Order, status: string) => {
    if (status === "delivered") {
      notifyDelivered(order);
    } else {
      sendWhatsApp(order, status);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-secondary mb-6">Orders</h1>

        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search by name, phone or order #..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <LoadingSpinner text="Loading orders..." />
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No orders found.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => (
              <div key={order.id} className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                <div
                  className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-secondary text-sm">{order.orderNumber}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[order.status] || ""}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {order.customer?.name} • {order.customer?.phone}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-secondary text-sm">{formatCurrency(order.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {expandedId === order.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {expandedId === order.id && (
                  <div className="border-t border-border px-4 py-4 bg-gray-50/50 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground mb-2">CUSTOMER DETAILS</h3>
                        <p className="text-sm">{order.customer?.name}</p>
                        <p className="text-sm text-muted-foreground">{order.customer?.phone}</p>
                        {order.customer?.address && (
                          <p className="text-sm text-muted-foreground">{order.customer.address}</p>
                        )}
                      </div>
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground mb-2">UPDATE STATUS</h3>
                        <div className="flex flex-wrap gap-2">
                          {STATUSES.map((s) => (
                            <div key={s} className="flex items-center gap-0.5">
                              <button
                                onClick={() => updateStatus(order.id, s)}
                                className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition-colors ${
                                  order.status === s
                                    ? `${STATUS_COLORS[s]} border-current font-medium`
                                    : "border-border text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                {s}
                              </button>
                              {order.customer?.phone && s === order.status && (
                                <button
                                  onClick={() => handleNotify(order, s)}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Notify customer via WhatsApp"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-medium text-muted-foreground mb-2">ITEMS</h3>
                      <div className="bg-white rounded-lg border border-border divide-y divide-border">
                        {order.items?.map((item, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                            <div className="flex-1 min-w-0">
                              <p className="truncate">{item.productName}</p>
                              <p className="text-xs text-muted-foreground">{item.weight}g</p>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                              <span className="text-muted-foreground">x{item.quantity}</span>
                              <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {order.couponApplied && (
                      <p className="text-xs text-green-600">
                        Coupon applied: {order.couponApplied.code} (-{formatCurrency(order.couponApplied.discountValue)})
                      </p>
                    )}

                    <div className="flex justify-end">
                      <Link
                        href={`/admin/sales?orderId=${order.id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Create Sale from Order
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {couponOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-secondary">Select Promo Coupon</h3>
              <button onClick={() => setCouponOrder(null)} className="p-1 hover:bg-muted rounded">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Choose a coupon to offer {couponOrder.customer?.name} on delivery:
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              <button
                onClick={() => selectCoupon(null)}
                className="w-full text-left px-3 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
              >
                <span className="text-muted-foreground">No coupon — send plain message</span>
              </button>
              {confirmedBuyerCoupons.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCoupon(c)}
                  className="w-full text-left px-3 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
                >
                  <span className="font-mono font-medium text-secondary">{c.code}</span>
                  <span className="text-muted-foreground ml-2">
                    — {c.discountType === "percentage" ? `${c.discountValue}% off` : formatCurrency(c.discountValue) + " off"}
                    {c.minPurchaseAmount > 0 && ` (min ${formatCurrency(c.minPurchaseAmount)})`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
