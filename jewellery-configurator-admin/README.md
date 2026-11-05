# Maison Aurelia — Jewellery Configurator Frontend

A locally hosted React + TypeScript storefront for the Live-Rate Jewellery Configurator assignment. The interface uses a luxury / ivory visual system and is structured to connect to the Node API at `http://localhost:5000/api`.

## Run locally

Requirements: Node.js 18+ and npm.

```bash
cp .env.example .env
npm install
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

## Backend connection

Set `.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_USE_DEMO_DATA=false
```

The frontend expects the API contract documented in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md). API calls are centralized in `src/services/api.ts`; change that file if your backend uses different route names or response envelopes.

For local UI development before the backend is ready, `VITE_USE_DEMO_DATA=true` uses seeded demo products, quotes and cart state. This mode is deliberately explicit and should be turned off when integrating the real backend.

## Implemented frontend scope

- Luxury ivory storefront with responsive navigation, collection hero and product cards.
- Product detail configurator: metal, purity, weight/size, live quote breakdown, quote countdown, Add to Bag and Buy Now.
- Product quote lifecycle: quote creation, expiry refresh, automatic lower-price update, explicit acceptance of increased prices, and out-of-stock state.
- Cart with independent quote countdowns, per-item price-change messages, accept-price action, pending confirmation count and guarded checkout.
- Checkout summary and order confirmation route.
- API service layer with typed request/response contracts, loading/error handling and configurable API base URL.
- Demo data mode for running the frontend independently.

## Important integration notes

1. The backend is the source of truth for all prices, quote expiry and stock.
2. The browser countdown is informational only. Every mutating action must be validated by the server.
3. Never calculate final payable price in the browser. The UI only renders the backend-provided breakdown.
4. The frontend expects money values in INR and dates as ISO 8601 timestamps.
5. Checkout must be rejected by the backend if a quote is expired, a price increase is unconfirmed, stock is insufficient, or the inventory transaction fails.
6. No payment gateway is implemented; the checkout endpoint creates an order as a simulated order placement.

## Suggested local workflow

Start PostgreSQL and the backend on port 5000, then start this app on port 5174. Keep both terminals running. The backend CORS allowlist includes both storefront (5173) and admin (5174) origins.

## Admin UI

Open the administration portal at `http://localhost:5174/login`. After signing in with an administrator account, the workspace is at `http://localhost:5174/admin`.

Admin routes (all pages are rendered inside the dedicated administration shell):

| Page | URL |
|---|---|
| Overview dashboard | `http://localhost:5174/admin` |
| Products | `http://localhost:5174/admin/products` |
| Inventory | `http://localhost:5174/admin/inventory` |
| Metal rates | `http://localhost:5174/admin/rates` |
| Orders | `http://localhost:5174/admin/orders` |

The admin screens read and update PostgreSQL values through the authenticated backend. There is no demo-data fallback in the admin API adapter.

The admin interface follows the Maison Aurelia storefront design system (ivory surfaces, dark-brown navigation, antique-gold accents, DM Sans and Playfair Display) and includes:

- Overview dashboard with live product, stock, rate and order totals.
- Product editing for schema-backed name, description, metal, wastage, making charge, stone flag, active status and variants.
- Inventory editing for real variant stock, purity, weight and stone charges.
- View and sync live metal rates from GoldAPI (read-only).
- Read-only order register from `orders` and `order_items`.
- Responsive desktop and mobile navigation.

### Admin API integration

The admin API adapter in `src/services/adminApi.ts` uses these authenticated endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/admin/products` | List products |
| POST | `/admin/products` | Create a product |
| PUT | `/admin/products/:id` | Update product fields and variants |
| GET | `/admin/metal-rates` | Read metal rates |
| GET | `/admin/orders` | List orders |
| GET | `/admin/summary` | Read dashboard totals |

There is no `category`, `image`, or making-charge-rules table in the supplied database schema, so the admin does not invent or persist those values. Making charges are edited on the product record. Product changes feed the existing storefront endpoints; GoldAPI owns metal rate updates and the admin can only view or sync them.

### Authentication

Customer accounts are created from the customer storefront at `/register`. The admin sign-in page links to `/setup` for the one-time first administrator account. The backend requires `ADMIN_SETUP_KEY` from its ignored `.env.local` and closes bootstrap after the first admin is created. Additional admin accounts must be provisioned with `npm run provision-admin`. Both portals store the short-lived bearer token in `sessionStorage`; a refresh restores the signed-in user through `/api/auth/me`, and sign out revokes the server session.

The admin screens update the shared database. Customer checkout remains validated by the backend transaction.
