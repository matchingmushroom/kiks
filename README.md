# KIKS Collections — Jewellery E-Commerce

A full-static e-commerce website for KIKS Collections jeweller shop with public product browsing, WhatsApp ordering, and an admin dashboard for inventory, sales, invoices, debtors, staff management, and backups.

Built with **Next.js 16 (App Router)** + **Firebase Auth + Firestore** + **Tailwind CSS v4** + **shadcn/ui**, deployed as a **static export on GitHub Pages**.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, static export) |
| Styling | Tailwind CSS v4, shadcn/ui, Lucide icons |
| Database | Firestore (NoSQL), client-only CRUD |
| Auth | Firebase Authentication (email/password) |
| Charts | Recharts |
| PDF | @react-pdf/renderer (client-side) |
| Cart | React Context + localStorage |
| Payments | WhatsApp-based (no payment gateway) |
| Deployment | GitHub Pages via GitHub Actions |

## Features

### Public Shop (no login required)
- **Homepage** — Dynamic sections: Hero banner, Category grid, Featured products, New arrivals, Custom HTML
- **All Products** — Category filter buttons, responsive grid
- **Product Detail** — Image gallery with thumbnails, YouTube video, full specs table, stock badge, Add to Cart / Buy Now
- **Cart** — Item qty adjustment, coupon validation (Firestore-backed), customer form, order via WhatsApp
- **Invoice View** — Public read-only invoice with Print + PDF download

### Admin Dashboard (auth required)
- **Dashboard** — 6 KPI cards (YTD/MTD/Total Sales, Debtors, Low Stock, Active Debtors), Sales trend line chart, Sales by Category donut chart, Inventory bar chart, Top Products, Recent Orders, Overdue Debtors
- **Products** — Full CRUD with inline form, search + category filter, active/featured toggles, delete confirmation
- **Categories** — CRUD with up/down reorder, active/inactive toggle
- **Orders** — List with search + status filter, expandable rows, status transitions, create sale from order
- **Sales** — Record Sale form with inventory item search, auto-calc totals, discount, warranty, coupon issue
- **Invoices / Estimates** — Create with auto-numbering, item search, warranty, discount. Detail page with Print, PDF download, WhatsApp share, Convert Estimate to Invoice
- **Coupons** — CRUD, auto-generate code, percentage/fixed, usage limits, validity dates
- **Debtors** — Active count + total outstanding, payment recording (auto-clear when $0), overdue day counter, payment history timeline
- **Inventory** — Stock overview with low-stock/out-of-stock filters, inline Adjust Stock (Add/Remove/Set Exact), full audit log with change history
- **Staff** — User management: add (creates Firebase Auth user), edit role, delete
- **Backup & Reports** — CSV export (single/ZIP of 11 collections), YTD/MTD/Custom reports (Sales Summary, Product Performance, Debtors Aging)
- **Homepage Builder** — Section list with reorder, visibility toggle, add/edit modal per type
- **Settings** — Editable shop name, tagline, logo, phone, WhatsApp number, address
- **Setup** — One-click Firestore initializer (default settings, categories, sections)

### Role-Based Access
| Role | Permissions |
|------|-------------|
| **admin** | Full access to everything |
| **manager** | Products, Categories, Orders, Sales, Invoices, Coupons, Inventory |
| **staff** | Orders, Sales, Invoices, Inventory |
| **accountant** | Invoices, Coupons, Debtors, Backup |

## Getting Started

### Prerequisites
- Node.js 18+
- Firebase project (Blaze plan for Firestore + Auth)
- npm

### 1. Clone & Install
```bash
git clone <repo-url>
cd as-collection
npm install
```

### 2. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Authentication** → Sign-in method → Email/Password
4. Create **Firestore Database** (start in test mode, then set up security rules)
5. Register a **Web App** to get the Firebase config

### 3. Environment Variables
Copy `.env.local` and fill in your Firebase config:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Initial Setup
1. Navigate to `/admin/setup` — click "Initialize Shop Data" to create default settings, categories, and homepage sections
2. Register the first admin user via Firebase Console → Authentication → Add User
3. Set the user's role to `admin` in Firestore → `users/{uid}` → add field `role: "admin"`
4. Log in at `/admin/login`

### 6. Build for Production
```bash
npm run build
```

## Deployment (GitHub Pages)

1. Push to a GitHub repository
2. Go to repo Settings → Pages → Source: **GitHub Actions**
3. Add Firebase config as **GitHub Actions secrets**:
   - `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, etc.
4. Push to the `main` branch — the `.github/workflows/deploy.yml` workflow automatically builds and deploys

Alternatively, deploy to any static host (Vercel, Netlify, Cloudflare Pages) by pointing to the `out/` directory.

## Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin pages (protected)
│   ├── cart/               # Shopping cart
│   ├── invoice/[id]/       # Public invoice view
│   ├── product/[id]/       # Product detail
│   ├── products/           # Product listing
│   ├── products/[category] # Category-filtered
│   ├── globals.css         # Tailwind + CSS variables
│   ├── layout.tsx          # Root layout (providers)
│   └── page.tsx            # Homepage
├── components/
│   ├── admin/AdminLayout.tsx    # Sidebar + auth guard
│   ├── invoice/InvoicePDF.tsx   # @react-pdf document
│   ├── shop/                     # ShopHeader, ShopFooter, ProductCard
│   └── ui/                      # Button, LoadingSpinner
├── contexts/               # AuthContext, CartContext, ShopSettingsContext
├── hooks/                  # useFirestore (real-time collection hook)
├── lib/                    # firebase, db, utils, roles, whatsapp, export, seed
└── types/                  # TypeScript interfaces
```

## Firestore Data Model
- `users/{uid}` — User profiles with role
- `shop_settings/config` — Single shop settings document
- `categories/{id}` — Product categories
- `products/{id}` — Product inventory
- `orders/{id}` — Customer orders
- `sales/{id}` — Completed sales
- `invoices/{id}` — Invoices & estimates (type field)
- `debtors/{id}` — Credit accounts with payment history
- `coupons/{id}` — Discount coupons
- `inventory_logs/{id}` — Stock adjustment audit trail
- `homepage_sections/{id}` — Homepage content sections
- `counters/{name}` — Auto-increment counters for order/invoice/estimate numbers

## Security Rules (Firestore)
Lock down Firestore with these rules in production:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Backup
- **CSV Export**: Download individual collections or bundled ZIP from `/admin/backup`
- **Reports**: Generate YTD/MTD/Custom period sales, product, and debtor reports
- **Email**: Use the mail client integration or set up EmailJS for automated backup
- **Google Drive**: Optional — use Google Apps Script or rclone (setup guide in-app)
