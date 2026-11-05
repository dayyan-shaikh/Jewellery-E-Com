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
- Add/update rates by metal and purity
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

### 5. Start the admin portal

In terminal 3, copy `jewellery-configurator-admin/.env.example` to `.env` in that app folder. Configure it locally to use the backend API and disable demo mode, then run:

```bash
npm ci
npm run dev
```

Open `http://localhost:5174/setup` to create the first admin, using the private setup key configured for the backend. After setup, sign in through the admin portal. Add metal rates and products; each active product variant needs a matching metal/purity rate before it can be priced.

---

## 📝 Assumptions & Scope

- Metal rates are maintained by an admin; an automatic market-rate feed is not connected.
- A price lock protects the quote, but does not reserve stock. Inventory is decided at checkout.
- Checkout creates an order but does not process payment. Shipping and fulfillment are not included.
- Product images and category labels are presentation data, not currently managed in the database.
- Admin orders can be viewed but not edited in the current portal.

---

## 📚 Documentation

- [Product and technical design PDF](output/pdf/maison-aurelia-product-solution.pdf)
- [Architecture and project documentation](docs/README.md)

### Run the checkout concurrency test

The test uses a configured PostgreSQL database and verifies that only one of two simultaneous checkouts can claim the final unit:

```bash
cd backend
npm test
```



