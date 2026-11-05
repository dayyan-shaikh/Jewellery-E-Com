# 💎 Maison Aurelia

A live-rate **jewellery e-commerce application** built with **React, TypeScript, Node.js, Express, and PostgreSQL**. Customers configure a piece, see an itemized price, hold a quote for ten minutes, and check out against current inventory. A separate admin portal manages catalogue data, stock, and metal rates.

---

## ✨ Features

### Customer storefront
- Customer registration and sign-in
- Browse products and select purity and weight variants
- Live price breakdown: metal value, wastage, making charge, stone charge, and 3% GST
- Independent ten-minute quote and countdown for each cart item
- Automatic lower-price updates; customer approval required for higher prices after quote expiry
- Stock availability, cart quantity updates, and item removal
- Checkout validation and order confirmation

### Admin portal
- Admin registration/setup and sign-in
- Database-backed dashboard, products, variants, and inventory
- Create/edit products and variants, including purity, weight, stone charge, and stock
- View live rates by metal and purity
- Fetch live Gold, Silver, and Platinum rates from GoldAPI, with current INR-per-gram rates and recorded history
- View placed orders and customer totals (read-only)

### Checkout safeguards
- Checkout rechecks each quote, price approval, and requested quantity
- Stock deduction and order creation occur together in a database transaction
- Concurrent buyers cannot purchase the same final unit; one checkout succeeds and the other is rejected
- Idempotency key prevents duplicate orders from a retried checkout request

---

## 🛠️ Tech Stack

### Frontend
- **React + TypeScript + Vite** — customer storefront and separate admin portal
- **React Router** — page navigation
- **Lucide React** — interface icons

### Backend
- **Node.js + Express** — REST API
- **JWT** — customer/admin authentication and role checks
- **Decimal.js** — monetary calculations

### Database
- **PostgreSQL** — users, products, variants, metal rates, price locks, carts, inventory, and orders

---

## ⚙️ Installation & Setup

### Requirements

- Node.js 18+ and npm
- PostgreSQL
- `psql` command-line tool, or pgAdmin

### 1. Create the database

From the project root, create the database and load the schema:

```bash
createdb -U postgres jewellery_configurator
psql -U postgres -d jewellery_configurator -f backend/database/schema.sql
```

If `createdb` is unavailable, create a database named `jewellery_configurator` in pgAdmin, then run the `psql` command.

### 2. Configure the backend

Copy `backend/.env.example` to `backend/.env.local` and configure your local database connection and private authentication/setup secrets there. Keep `.env.local` private and do not commit it.

### 3. Install and start the backend

In terminal 1:

```bash
cd backend
npm ci
npm run dev
```

The API runs at `http://localhost:5000`.

### 4. Start the customer storefront

In terminal 2, copy `jewellery-configurator-frontend/.env.example` to `.env` in that app folder. Configure it locally to use the backend API and disable demo mode, then run:

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`.

### 5. Apply the rate-history migration to an existing database

If the database was created before live-rate support, apply the migration before starting the updated backend:

```bash
psql -U postgres -d jewellery_configurator -f backend/database/migrations/2026-11-06-goldapi-metal-rate-history.sql
```

For a new database, the main schema already includes the rate-history table and precision update. Add your GoldAPI key to `GOLD_API_KEY` in the backend local environment file; set `GOLD_RATE_FETCH_INTERVAL_MINUTES` there to choose the schedule. The default is once per day (three provider requests per run).

### 6. Start the admin portal

In terminal 3, copy `jewellery-configurator-admin/.env.example` to `.env` in that app folder. Configure it locally to use the backend API and disable demo mode, then run:

```bash
npm ci
npm run dev
```

Open `http://localhost:5174/setup` to create the first admin, using the private setup key configured for the backend. After setup, sign in through the admin portal. Add products; each active product variant needs a matching metal/purity rate before it can be priced. Metal rates are read-only in the admin portal and come from GoldAPI.

---

## 📝 Assumptions & Scope

- GoldAPI spot prices are normalized from INR per troy ounce to INR per gram; configured purity rates are derived from the corresponding fine-metal price.
- The backend refreshes all three metals together on a configurable schedule (daily by default), and preserves the last successful rates if a provider response fails.
- Rate refresh needs three provider requests per successful sync. The API credential stays in the backend and is never sent to either frontend.
- Metal rate history records scheduled GoldAPI updates; admins cannot change or trigger rate updates.
- A price lock protects the quote, but does not reserve stock. Inventory is decided at checkout.
- Checkout creates an order but does not process payment. Shipping and fulfillment are not included.
- Product images and category labels are presentation data, not currently managed in the database.
- Admin orders can be viewed but not edited in the current portal.

---

## 🧪 Test the live-rate integration

1. Add a valid GoldAPI key to `GOLD_API_KEY` in the backend local environment file, then start the backend.
2. Wait for the backend scheduler to fetch the rates (it checks immediately at startup when there is no prior successful sync, then follows the configured interval).
3. Confirm Gold, Silver, and Platinum values appear in INR per gram and that their source is `GOLDAPI`.
4. Open the customer storefront and confirm the market-rate strip shows the same database values.
5. Check the stored history through the admin endpoint `GET /api/admin/metal-rates/history`. Rate changes are read-only for admins and are made only by the GoldAPI sync.
6. To verify failure handling, temporarily use an invalid provider key and restart the backend. The scheduler logs the failed refresh while leaving the last successful database rates intact. Restore the valid key afterward.

## 📚 Documentation

- [Product and technical design PDF](output/pdf/maison-aurelia-product-solution.pdf)
- [Architecture and project documentation](docs/README.md)

### Run the checkout concurrency test

The test uses a configured PostgreSQL database and verifies that only one of two simultaneous checkouts can claim the final unit:

```bash
cd backend
npm test
```



