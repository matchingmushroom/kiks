"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy } from "@/hooks/useFirestore";
import { useShopSettings } from "@/contexts/ShopSettingsContext";
import { Order, Coupon } from "@/types";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";
import { updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Search, ChevronDown, ChevronUp, ExternalLink, MessageCircle, X, LayoutGrid, List, Edit2, Save } from "lucide-react";
import Link from "next/link";
import { openWhatsApp } from "@/lib/whatsapp";

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
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState({ customerName: "", customerPhone: "", customerAddress: "", notes: "" });
  const [editSaving, setEditSaving] = useState(false);

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
      .map((i) => `• ${i.productName} x${i.quantity} — Rs. ${formatNumber(i.subtotal)}`)
      .join("\n");

    const lines = [
      `*Order ${order.orderNumber} — ${status.toUpperCase()}*`,
      `Hi ${order.customer.name}, your order status has been updated to *${status}*.`,
      "",
      itemsText,
      "",
      `*Total: Rs. ${formatNumber(order.totalAmount)}*`,
      "",
    ];

    if (status === "delivered") {
      if (coupon) {
        const benefit = coupon.discountType === "percentage"
          ? `${coupon.discountValue}% off`
          : `Rs. ${formatNumber(coupon.discountValue)} off`;
        lines.push(`Use promo code *${coupon.code}* — ${benefit} on your next purchase!`);
        lines.push("");
      }
      lines.push("Thank you for shopping with KIKS Collections! We hope to see you again!");
    } else {
      lines.push("Thank you for choosing KIKS Collections!");
    }

    const msg = encodeURIComponent(lines.join("\n"));
    openWhatsApp(`https://wa.me/${order.customer.phone}?text=${msg}`);
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

  const openEdit = (order: Order) => {
    setEditOrder(order);
    setEditForm({
      customerName: order.customer?.name || "",
      customerPhone: order.customer?.phone || "",
      customerAddress: order.customer?.address || "",
      notes: order.notes || "",
    });
  };

  const handleEditSave = async () => {
    if (!editOrder) return;
    setEditSaving(true);
    try {
      await updateDoc(doc(db, "orders", editOrder.id), {
        customer: { name: editForm.customerName, phone: editForm.customerPhone, address: editForm.customerAddress },
        notes: editForm.notes,
        updatedAt: Timestamp.fromDate(new Date()),
      });
      setEditOrder(null);
    } catch (e) {
      console.error("Edit failed", e);
    }
    setEditSaving(false);
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
          <div className="flex items-center gap-1">
            <button onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("list")}
              className={`p-1.5 rounded ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner text="Loading orders..." />
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No orders found.</p>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((order) => (
              <div key={order.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2">
                <div onClick={() => setSelectedOrder(order)} className="cursor-pointer space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-secondary text-sm">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{order.customer?.name} • {order.customer?.phone}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize shrink-0 ${STATUS_COLORS[order.status] || ""}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-secondary">{formatCurrency(order.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                </div>
                <button onClick={() => openEdit(order)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                  <Edit2 className="h-3 w-3" /> Edit
                </button>
              </div>
            ))}
          </div>
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

                    <div className="flex items-center justify-between">
                      <button onClick={() => openEdit(order)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                        <Edit2 className="h-3 w-3" /> Edit
                      </button>
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

        {/* Grid Detail Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedOrder(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-secondary">Order Details</h2>
                <button onClick={() => setSelectedOrder(null)} className="p-1 hover:bg-muted rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-secondary">{selectedOrder.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">{selectedOrder.customer?.name} • {selectedOrder.customer?.phone}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize shrink-0 ${STATUS_COLORS[selectedOrder.status] || ""}`}>
                    {selectedOrder.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2">CUSTOMER DETAILS</h3>
                    <p className="text-sm">{selectedOrder.customer?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedOrder.customer?.phone}</p>
                    {selectedOrder.customer?.address && (
                      <p className="text-sm text-muted-foreground">{selectedOrder.customer.address}</p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2">UPDATE STATUS</h3>
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.map((s) => (
                        <div key={s} className="flex items-center gap-0.5">
                          <button
                            onClick={() => { updateStatus(selectedOrder.id, s); setSelectedOrder({ ...selectedOrder, status: s }); }}
                            className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition-colors ${
                              selectedOrder.status === s
                                ? `${STATUS_COLORS[s]} border-current font-medium`
                                : "border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {s}
                          </button>
                          {selectedOrder.customer?.phone && s === selectedOrder.status && (
                            <button
                              onClick={() => handleNotify(selectedOrder, s)}
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
                    {selectedOrder.items?.map((item, i) => (
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

                <div className="flex items-center justify-between">
                  <p className="font-semibold text-lg text-secondary">{formatCurrency(selectedOrder.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(selectedOrder.createdAt)}</p>
                </div>

                {selectedOrder.couponApplied && (
                  <p className="text-xs text-green-600">
                    Coupon applied: {selectedOrder.couponApplied.code} (-{formatCurrency(selectedOrder.couponApplied.discountValue)})
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <button onClick={() => { setSelectedOrder(null); openEdit(selectedOrder); }}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                    <Edit2 className="h-4 w-4" /> Edit
                  </button>
                  <Link
                    href={`/admin/sales?orderId=${selectedOrder.id}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" /> Create Sale from Order
                  </Link>
                </div>
              </div>
            </div>
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

      {/* Edit Order Modal */}
      {editOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditOrder(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-secondary">Edit Order {editOrder.orderNumber}</h2>
              <button onClick={() => setEditOrder(null)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Customer Name</label>
                <input type="text" value={editForm.customerName}
                  onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
                <input type="text" value={editForm.customerPhone}
                  onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })}
                  minLength={10}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Address</label>
                <input type="text" value={editForm.customerAddress}
                  onChange={(e) => setEditForm({ ...editForm, customerAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <textarea value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="flex gap-3 pt-4">
                <Button onClick={handleEditSave} disabled={editSaving || !editForm.customerName} variant="accent">
                  <Save className="h-4 w-4" /> {editSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button onClick={() => setEditOrder(null)} variant="outline">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
