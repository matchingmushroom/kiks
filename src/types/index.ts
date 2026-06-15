export type UserRole = "admin" | "manager" | "staff" | "accountant";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  phone: string;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  image: string;
  order: number;
  isActive: boolean;
}

export type ProductBadge = "none" | "limited_stock" | "out_of_stock" | "price_dropped" | "offer";

export interface Product {
  id: string;
  name: string;
  description: string;
  design: string;
  categoryId: string;
  images: string[];
  videoUrl: string;
  price: number;
  originalPrice?: number;
  badge?: ProductBadge;
  weight: number;
  purity: string;
  metalType: string;
  stoneType: string;
  stoneWeight: number;
  makingCharge: number;
  warranty: string;
  sku: string;
  quantityInStock: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CartItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  weight: number;
  purity: string;
  makingCharge: number;
  quantity: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
  weight: number;
  purity: string;
  makingCharge: number;
  subtotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: { name: string; phone: string; address: string };
  items: OrderItem[];
  totalAmount: number;
  couponApplied: { code: string; discountValue: number } | null;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  notes: string;
  createdAt: number;
  processedBy: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  weight: number;
  purity: string;
  makingCharge: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  orderId: string;
  saleType: "cash" | "credit" | "partial";
  customer: { name: string; phone: string; address: string; email: string };
  items: SaleItem[];
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  payment: { method: string; receivedAmount: number; balanceDue: number };
  warranty: { period: string; terms: string; startDate: number; endDate: number };
  couponIssued: { couponId: string; code: string; discountValue: number } | null;
  notes: string;
  saleDate: number;
  recordedBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface InvoiceItem {
  productName: string;
  description: string;
  weight: number;
  purity: string;
  quantity: number;
  unitPrice: number;
  makingCharge: number;
  subtotal: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: "invoice" | "estimate";
  status: "draft" | "sent" | "paid" | "partially_paid" | "cancelled" | "expired";
  customer: { name: string; phone: string; address: string };
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  warranty: { period: string; terms: string };
  notes: string;
  termsAndConditions: string;
  validUntil: number;
  relatedSaleId: string;
  generatedBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minPurchaseAmount: number;
  maxDiscount: number;
  validFrom: number;
  validUntil: number;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  forConfirmedBuyers?: boolean;
  restrictedToPhone?: string;
  issuedToCustomer: { name: string; phone: string };
  issuedForOrderId: string;
  createdAt: number;
  createdBy: string;
}

export interface Debtor {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: number;
  orderIds: string[];
  status: "active" | "cleared";
  paymentHistory: { date: number; amount: number; method: string; notes: string }[];
  createdAt: number;
  updatedAt: number;
}

export interface InventoryLog {
  id: string;
  productId: string;
  changeType: "add" | "remove" | "adjust";
  quantityChange: number;
  reason: string;
  performedBy: string;
  createdAt: number;
}

export interface HomeSection {
  id: string;
  type: "hero" | "featured_products" | "category_grid" | "new_arrivals" | "custom_html";
  title: string;
  subtitle: string;
  order: number;
  isVisible: boolean;
  config: Record<string, unknown>;
}

export interface ShopSettings {
  shopName: string;
  tagline: string;
  logoUrl: string;
  phone: string;
  address: string;
  whatsappNumber: string;
  currency: string;
}

export interface PaymentHistoryEntry {
  date: number;
  amount: number;
  method: string;
  notes: string;
}
