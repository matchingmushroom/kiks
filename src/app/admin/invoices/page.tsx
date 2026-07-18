"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { Invoice } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Plus, FileText, Eye, Search, LayoutGrid, List, X } from "lucide-react";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-50 text-gray-700 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-green-50 text-green-700 border-green-200",
  partially_paid: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-red-50 text-red-700 border-red-200",
};

export default function AdminInvoicesPage() {
  const { data: invoices, loading, error } = useFirestore<Invoice>("invoices", {
    constraints: [orderBy("createdAt", "desc"), limit(200)],
    realtime: true,
  });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);

  const filtered = invoices.filter((inv) => {
    const matchSearch = !search ||
      inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer?.name?.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || inv.type === typeFilter;
    const matchStatus = !statusFilter || inv.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Invoices</h1>
            <p className="text-sm text-muted-foreground">{invoices.length} total</p>
          </div>
          <Link href="/admin/invoices/new">
            <Button variant="accent"><Plus className="h-4 w-4" /> New Invoice</Button>
          </Link>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search by number or customer..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {(["", "invoice", "estimate"] as const).map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  typeFilter === t
                    ? "bg-white text-secondary shadow-sm border border-border"
                    : "text-muted-foreground hover:text-secondary"
                }`}>
                {t === "" ? "All" : t === "invoice" ? "Invoices" : "Estimates"}
              </button>
            ))}
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
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
          <LoadingSpinner />
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            Failed to load invoices: {error}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No invoices found.</p>
        ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-3">
              {filtered.map((inv) => (
                <div key={inv.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-2 cursor-pointer" onClick={() => setDetailInvoice(inv)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-secondary text-sm">{inv.invoiceNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                          inv.type === "invoice" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                        }`}>{inv.type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{inv.customer?.name || "—"}</p>
                    </div>
                    <Link href={`/admin/invoice-viewer?id=${inv.id}`} onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0">
                      <Eye className="h-3 w-3" /> View
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="font-semibold text-secondary">{formatCurrency(inv.totalAmount)}</span>
                    <span className={`px-2 py-0.5 rounded-full capitalize border ${STATUS_COLORS[inv.status] || ""}`}>
                      {inv.status?.replace("_", " ")}
                    </span>
                    <span className="text-muted-foreground">{formatDate(inv.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-left">
                    <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Invoice #</th>
                    <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Type</th>
                    <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Customer</th>
                    <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Amount</th>
                    <th className="px-4 py-2.5 text-xs text-muted-foreground text-center">Status</th>
                    <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Date</th>
                    <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setDetailInvoice(inv)}>
                      <td className="px-4 py-2.5 text-sm font-medium text-secondary">{inv.invoiceNumber}</td>
                      <td className="px-4 py-2.5 text-sm">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                          inv.type === "invoice" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                        }`}>{inv.type}</span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{inv.customer?.name || "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-medium">{formatCurrency(inv.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-sm text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize border ${STATUS_COLORS[inv.status] || ""}`}>
                          {inv.status?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-right text-muted-foreground">{formatDate(inv.createdAt)}</td>
                      <td className="px-4 py-2.5 text-sm text-right">
                        <Link href={`/admin/invoice-viewer?id=${inv.id}`} onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <Eye className="h-3 w-3" /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {detailInvoice && (
        <DetailModal title={`Invoice - ${detailInvoice.invoiceNumber}`} onClose={() => setDetailInvoice(null)}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Invoice #</span><p className="font-medium">{detailInvoice.invoiceNumber}</p></div>
              <div><span className="text-muted-foreground">Type</span><p className="font-medium capitalize">{detailInvoice.type}</p></div>
              <div><span className="text-muted-foreground">Customer</span><p className="font-medium">{detailInvoice.customer?.name || "—"}</p></div>
              <div><span className="text-muted-foreground">Status</span><p className="font-medium capitalize">{detailInvoice.status?.replace("_", " ")}</p></div>
              <div><span className="text-muted-foreground">Grand Total</span><p className="font-medium">{formatCurrency(detailInvoice.totalAmount)}</p></div>
              <div><span className="text-muted-foreground">Date</span><p className="font-medium">{formatDate(detailInvoice.createdAt)}</p></div>
              <div><span className="text-muted-foreground">Discount</span><p className="font-medium">{formatCurrency(detailInvoice.discountAmount)}</p></div>
              <div><span className="text-muted-foreground">Created By</span><p className="font-medium">{detailInvoice.createdByName || "—"}</p></div>
            </div>
            {detailInvoice.notes && (
              <div><span className="text-muted-foreground">Notes</span><p className="mt-0.5">{detailInvoice.notes}</p></div>
            )}
            {detailInvoice.items && detailInvoice.items.length > 0 && (
              <div>
                <span className="text-muted-foreground">Items ({detailInvoice.items.length})</span>
                <div className="mt-1 divide-y divide-border border border-border rounded-lg">
                  {detailInvoice.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="font-medium">{item.productName}</span>
                      <span>{item.quantity} × {formatCurrency(item.unitPrice)} = {formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DetailModal>
      )}
    </AdminLayout>
  );
}

function DetailModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-secondary">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
