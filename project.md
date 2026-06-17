# KIKS Collections — Project Document

> **Shop**: KIKS Collections (also AS Collection) — Jewellery e-commerce for Nepal  
> **Stack**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Firebase  
> **Deploy**: Static export to GitHub Pages via GitHub Actions  
> **Currency**: NPR (Nepalese Rupee)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, `output: "export"`) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4, shadcn/ui, Lucide icons |
| Database | Firestore (NoSQL) — dual approach |
| Auth | Firebase Authentication (email/password) |
| Charts | Recharts (line, pie, bar) |
| PDF | @react-pdf/renderer |
| Cart | React Context + localStorage |
| Other | JSZip, clsx, tailwind-merge, class-variance-authority |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin dashboard (26+ pages)
│   ├── cart/               # Shopping cart
│   ├── invoice/[id]/       # Public invoice view
│   ├── product/[id]/       # Product detail
│   ├── products/           # All products listing
│   ├── products/[category]/# Category-filtered products
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Homepage
├── components/
│   ├── admin/AdminLayout.tsx   # Sidebar layout + auth guard
│   ├── invoice/InvoicePDF.tsx  # PDF document component
│   ├── shop/                   # ShopHeader, ShopFooter, ProductCard, ProductDetailClient
│   └── ui/                     # Button, LoadingSpinner
├── contexts/               # AuthContext, CartContext, ShopSettingsContext
├── hooks/                  # useFirestore (SDK), useCollection (REST)
├── lib/                    # firebase, firestoreRest, db, utils, roles, whatsapp, export, accounts, seed, dummyProducts
└── types/                  # 30+ TypeScript interfaces
```

---

## Public Pages

| Route | Description |
|---|---|
| `/` | Dynamic homepage — sections from Firestore (hero, categories, featured, new arrivals, custom HTML). Falls back to defaults. |
| `/products` | All active products with category filter |
| `/products/[category]` | Products filtered by category |
| `/product/[id]` | Product detail — gallery, specs, badges, add-to-cart |
| `/cart` | Cart management, coupon validation, WhatsApp order |
| `/invoice/[id]` | Public invoice/estimate view (no auth) |

---

## Admin Pages (26+)

| Route | Description |
|---|---|
| `/admin` | Dashboard — KPIs, charts, top products, recent orders, overdue debtors |
| `/admin/login` | Firebase Auth email/password login |
| `/admin/products` | Products CRUD (30+ fields, images, badges, search, dummy seed) |
| `/admin/categories` | Categories CRUD (reorder, active toggle) |
| `/admin/orders` | Order management (status workflow, WhatsApp messages, create sale) |
| `/admin/sales` | Sales recording (product search, auto-invoice, inventory deduction) |
| `/admin/invoices` | Invoices & estimates list |
| `/admin/invoices/new` | Create invoice/estimate (auto-numbering, payment status) |
| `/admin/invoices/[id]` | Invoice detail (print, PDF, WhatsApp, convert estimate) |
| `/admin/coupons` | Coupons CRUD (percentage/fixed, usage limits, phone restrictions) |
| `/admin/debtors` | Debtors management (payments, overdue tracking, auto-clear) |
| `/admin/creditors` | Creditors management (supplier credit, payments) |
| `/admin/inventory` | Stock management (adjustments, audit log, low-stock alerts) |
| `/admin/purchases` | Purchase recording (supplier credit, returns) |
| `/admin/expenses` | Expense recording (categorized, recurring templates) |
| `/admin/finance` | P&L, Balance Sheet, Cash/Bank accounts |
| `/admin/offers` | Time-bound promotions (badge auto-apply, price drops) |
| `/admin/homepage` | Drag-to-reorder homepage sections builder |
| `/admin/suppliers` | Suppliers CRUD |
| `/admin/customers` | Customers CRUD |
| `/admin/staff` | Staff management (Firebase Auth user creation, roles) |
| `/admin/access-control` | Per-user permission overrides |
| `/admin/reconciliation` | Stock reconciliation (system vs physical qty) |
| `/admin/backup` | CSV export (single/ZIP), sales/product/debtor reports |
| `/admin/settings` | Shop settings (name, logo, WhatsApp number, etc.) |
| `/admin/setup` | One-click Firestore initializer |
| `/admin/error` | Error boundary |

---

## Firestore Integration (Dual Approach)

### 1. Firebase SDK v11 (`useFirestore` hook + `db.ts`)
- **Used in**: All admin pages, AuthContext, ShopSettingsContext, cart page
- **Capabilities**: Full CRUD, real-time `onSnapshot`, Auth, Storage
- **Collections**: All 20+ Firestore collections

### 2. Firestore REST API (`useCollection` hook + `firestoreRest.ts`)
- **Used in**: Public pages (homepage, products, product detail)
- **Why**: Firebase SDK doesn't work in static exports; REST API uses plain `fetch()`
- **Capabilities**: getDocument, queryDocuments (where filters only — no orderBy), getAllDocuments, addDocument, updateDocument
- **Limitation**: One-time fetch only, no real-time, no orderBy with where filters (requires composite indexes)

---

## Key Features Built

- Cart system (Context + localStorage)
- WhatsApp ordering (order save + wa.me link with formatted message)
- Coupon system (percentage/fixed, usage limits, validity dates, phone restrictions)
- Full admin CRUD (products, categories, coupons, suppliers, customers)
- Order management (status workflow, WhatsApp status updates)
- Sales recording (auto-invoice, inventory deduction, account transactions)
- Invoices & estimates (auto-numbering, print, PDF, WhatsApp share)
- Debtors management (payments, overdue tracking)
- Creditors management (supplier credit tracking)
- Inventory management (adjustments, audit log)
- Purchases (supplier credit, returns)
- Expenses (categorized, recurring templates)
- Finance dashboard (P&L, balance sheet, accounts)
- Role-based access control (4 roles, 20 permissions, per-user overrides)
- Staff management (Firebase Auth user management)
- Homepage builder (reorderable sections)
- Offers/promotions (time-bound, auto badge/price)
- Stock reconciliation
- Backup & reports (CSV export)
- Product badges (Limited Stock, Out of Stock, Price Dropped, Offer)
- Public invoice view (no auth, print, PDF)

---

## Known Issues & Limitations

1. **`admin/sales/[id]` missing `generateStaticParams()`** — Build fails with `output: "export"`. Needs to be added for static export compatibility.
2. **Firebase SDK in static export** — Only client-side operations work; real-time listeners work in browser but not at build time.
3. **Firestore REST API** — No real-time, no composite queries with `orderBy` (requires index creation in Firebase Console).
4. **Image handling** — Unsplash URL rewrite hack is fragile and rate-limited.
5. **Auth flash** — Route protection is client-side; unauthenticated users may briefly see admin content before redirect.
6. **API routes** — `src/app/api/` exists but is empty (not usable with static export).
7. **PROMPT.txt** — Contains feature requests/bug reports; some may already be addressed.

---

## Build & Deploy

```bash
npm run dev       # Development server
npm run build     # Static export to out/
npm run lint      # ESLint
```

Deployed via GitHub Actions to `https://matchingmushroom.github.io/kiks/`
