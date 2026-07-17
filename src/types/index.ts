export type UserRole = "admin" | "manager" | "staff" | "accountant";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  phone: string;
  createdAt: number;
  permissions?: string[];
  isActive?: boolean;
}

export interface Category {
  id: string;
  name: string;
  shortCode: string;
  subCategories: string[];
  description: string;
  image: string;
  order: number;
  isActive: boolean;
  showOnHomepage: boolean;
}

export type ProductBadge = "none" | "limited_stock" | "out_of_stock" | "price_dropped" | "offer";

export interface Product {
  id: string;
  name: string;
  websiteName?: string;
  description: string;
  design: string;
  categoryId: string;
  images: string[];
  videoUrl: string;
  price: number;
  originalPrice?: number;
  badge?: ProductBadge;
  costPrice?: number;
  weight: number;
  purity?: string;
  metalType: string;
  stoneType: string;
  stoneWeight: number;
  makingCharge: number;
  warranty: string;
  sku: string;
  modelCode: string;
  legacySku?: string;
  quantityInStock: number;
  isActive: boolean;
  isFeatured: boolean;
  showOnWebsite?: boolean;
  brand: string;
  modelNo: string;
  baseMaterial: string;
  plating: string;
  color: string;
  productType: string;
  idealFor: string[];
  netQuantity: number;
  occasion: string[];
  barcodeId?: string;
  shortCode?: string;
  comboItems?: string[];
  comboPrice?: number;
  isOnSale?: boolean;
  collection?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CartItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  weight: number;
  purity?: string;
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
  purity?: string;
  makingCharge: number;
  subtotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: { name: string; phone: string; address: string };
  items: OrderItem[];
  totalAmount: number;
  deliveryFee?: number;
  deliveryLocation?: "inside_valley" | "outside_valley";
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
  purity?: string;
  makingCharge: number;
  subtotal: number;
  costPriceAtSale?: number;
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
  recordedByName: string;
  createdAt: number;
  updatedAt: number;
  returned?: boolean;
  archived?: boolean;
}

export interface InvoiceItem {
  productName: string;
  description: string;
  weight: number;
  purity?: string;
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
  paymentStatus?: "full" | "partial";
  cashReceived?: number;
  balanceDue?: number;
  warranty: { period: string; terms: string };
  notes: string;
  termsAndConditions: string;
  validUntil: number;
  relatedSaleId: string;
  generatedBy: string;
  createdByName: string;
  couponIssued?: { code: string; discountValue: number; discountType?: string; terms?: string };
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
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
  couponType?: string;
  restrictedToPhones?: string[];
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

export interface FifoLayer {
  id: string;
  productId: string;
  purchaseId: string;
  purchaseDate: number;
  quantity: number;
  remainingQty: number;
  unitCost: number;
  createdAt: number;
}

export interface InventoryLog {
  id: string;
  productId: string;
  changeType: "add" | "remove" | "adjust" | "sale" | "purchase" | "purchase_return" | "sales_return";
  quantityChange: number;
  reason: string;
  performedBy: string;
  createdAt: number;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  salesPrice: number;
  subtotal: number;
  serialNo?: string;
}

export interface Purchase {
  id: string;
  supplierName: string;
  supplierPhone?: string;
  purchaseDate: number;
  items: PurchaseItem[];
  totalAmount: number;
  paymentStatus: "paid" | "unpaid" | "partially_paid" | "advance";
  paymentMethod?: string;
  paidAmount?: number;
  discountAmount?: number;
  billNo?: string;
  billDate?: string;
  billImageUrl?: string;
  notes?: string;
  recordedBy: string;
  recordedByName: string;
  createdAt: number;
  updatedAt: number;
  returned?: boolean;
  archived?: boolean;
}

export type ExpenseHead =
  | "Rent" | "Salary" | "Electricity" | "Water" | "Internet"
  | "Marketing" | "Travel" | "Maintenance" | "Packaging"
  | "Bank Charges" | "Taxes" | "Miscellaneous" | "Other";

export interface Expense {
  id: string;
  title: string;
  amount: number;
  head: ExpenseHead | string;
  customHead?: string;
  description?: string;
  date: number;
  paymentMethod: "cash" | "bank" | "other";
  receiptUrl?: string;
  recordedBy: string;
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
}

export interface RecurringExpenseTemplate {
  id: string;
  title: string;
  amount: number;
  head: ExpenseHead | string;
  customHead?: string;
  frequency: "weekly" | "monthly" | "yearly";
  nextDueDate: number;
  description?: string;
  paymentMethod: "cash" | "bank" | "other";
  isActive: boolean;
  recordedBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface Account {
  id: string;
  name: string;
  type: "cash" | "bank";
  openingBalance: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AccountTransaction {
  id: string;
  accountId: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  date: number;
  referenceType: "sale" | "expense" | "purchase" | "purchase_return" | "manual" | "transfer" | "debtor_payment" | "creditor_payment" | "sales_return" | "capital";
  referenceId?: string;
  recordedBy: string;
  createdAt: number;
}

export interface Transfer {
  id: string;
  type: "bank_deposit" | "advance";
  amount: number;
  description: string;
  date: number;
  fromAccountId: string;
  toAccountId?: string;
  recipientName?: string;
  recipientPhone?: string;
  notes?: string;
  recordedBy: string;
  recordedByName?: string;
  settledAmount?: number;
  status?: "active" | "settled";
  createdAt: number;
  updatedAt: number;
}

export interface Creditor {
  id: string;
  supplierName: string;
  supplierPhone?: string;
  purchaseIds: string[];
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: number;
  status: "active" | "cleared";
  paymentHistory: { date: number; amount: number; method: string; notes: string }[];
  lastTransactionDate: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreditorPayment {
  id: string;
  creditorId: string;
  amount: number;
  date: number;
  accountId: string;
  paymentMethod: string;
  notes?: string;
  recordedBy: string;
  createdAt: number;
}

export interface Supplier {
  id: string;
  name: string;
  shortCode: string;
  phone: string;
  landline?: string;
  address: string;
  contactPerson: string;
  contactPersonPhone: string;
  website: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  loyaltyPoints?: number;
  lifetimePoints?: number;
  createdAt: number;
  updatedAt: number;
}

export interface HomeSection {
  id: string;
  type: "hero" | "featured_products" | "category_grid" | "new_arrivals" | "combo_deals" | "custom_html";
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
  footerLogoUrl?: string;
  phone: string;
  address: string;
  whatsappNumber: string;
  currency: string;
  website?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  twitter?: string;
  tiktok?: string;
  hiddenSocialLinks?: string[];
  mapLat?: number;
  mapLng?: number;
  mapEmbedUrl?: string;
  announcementText?: string;
  gasWebhookUrl?: string;
  emailTo?: string;
  driveFolderId?: string;
  useBsCalendar?: boolean;
  deliveryFeeInsideValley?: number;
  deliveryFeeOutsideValley?: number;
  freeDeliveryThreshold?: number;
  loyaltyEnabled?: boolean;
  pointsPerRupee?: number;
  pointValue?: number;
  minRedemptionPoints?: number;
  gasLoyaltyUrl?: string;
  liteMode?: boolean;
}

export interface SmsConfig {
  provider: "sparrowsms" | "smsfactory";
  apiKey: string;
  senderId: string;
}

export interface PaymentHistoryEntry {
  date: number;
  amount: number;
  method: string;
  notes: string;
}

export interface Offer {
  id: string;
  title: string;
  badgeType: "offer" | "price_dropped";
  discountType: "percentage" | "fixed";
  discountValue: number;
  scope: "all" | "category" | "individual";
  categoryId?: string;
  productIds?: string[];
  startDate: number;
  endDate: number;
  isActive: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface Testimonial {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerPhoto?: string;
  rating: number;
  text: string;
  productId?: string;
  productName?: string;
  isActive: boolean;
  order: number;
  createdAt: number;
}

export interface AccountHead {
  id: string;
  code: string;
  name: string;
  category: "asset" | "liability" | "equity" | "income" | "expense";
  subCategory: string;
  isActive: boolean;
  openingBalance: number;
  parentId?: string;
}

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: number;
  description: string;
  lines: JournalLine[];
  referenceType: "sale" | "purchase" | "expense" | "receipt" | "payment" | "transfer" | "advance" | "adjustment" | "debtor_payment" | "creditor_payment" | "sales_return" | "capital";
  referenceId?: string;
  recordedBy: string;
  recordedByName: string;
  isPosted: boolean;
  createdAt: number;
}

export interface LoyaltyTransaction {
  txnId: string;
  phone: string;
  type: "earn" | "redeem" | "refund" | "adjust";
  points: number;
  referenceId: string;
  refType: string;
  note: string;
  createdAt: string;
}
