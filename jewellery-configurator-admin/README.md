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
| Overview dashboard | `http://localhost:5173/admin` |
| Products | `http://localhost:5173/admin/products` |
| Inventory | `http://localhost:5173/admin/inventory` |
| Metal rates | `http://localhost:5173/admin/rates` |
| Making charges | `http://localhost:5173/admin/making-charges` |
| Orders | `http://localhost:5173/admin/orders` |

The default demo mode supplies sample catalogue, pricing rules, rates and example orders; the dashboard still verifies administrator access with the backend before it loads.

The admin interface follows the Maison Aurelia storefront design system (ivory surfaces, dark-brown navigation, antique-gold accents, DM Sans and Playfair Display) and includes:

- Overview dashboard with product, stock, making-charge and order summaries.
- Product catalogue with search, product creation and product configuration editing.
- Inventory view with low-stock / out-of-stock filters and stock adjustment.
- Gold, silver and platinum reference-rate view with rate editing.
- Making-charge rule management with create and edit flows.
- Order register with order totals and placement dates.
- Responsive desktop and mobile navigation.

### Admin API integration

The admin API adapter is in `src/services/adminApi.ts`. In demo mode (`VITE_USE_DEMO_DATA=true`, the default), the admin workspace is populated from the existing seeded products and keeps admin edits in memory for the current browser session.

When `VITE_USE_DEMO_DATA=false`, the adapter expects these admin endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/admin/products` | List products |
| POST | `/admin/products` | Create a product |
| PUT | `/admin/products/:id` | Update product configuration / stock |
| GET | `/admin/metal-rates` | Read metal rates |
| PATCH | `/admin/metal-rates/:metal` | Update a metal reference rate |
| GET | `/admin/making-charge-rules` | List making-charge rules |
| POST | `/admin/making-charge-rules` | Create a making-charge rule |
| PUT | `/admin/making-charge-rules/:id` | Update a making-charge rule |
| GET | `/admin/orders` | List orders |

**Backend integration note:** JWT login and `/api/admin/access` are connected to the shared backend. The other admin CRUD routes above are still prospective; their screens remain demo-backed until those endpoints are implemented server-side. Do not turn off demo mode expecting those operations to work yet.

### Authentication

Customer accounts are created from the customer storefront at `/register`. The admin sign-in page links to `/setup` for the one-time first administrator account. The backend requires `ADMIN_SETUP_KEY` from its ignored `.env.local` and closes bootstrap after the first admin is created. Additional admin accounts must be provisioned with `npm run provision-admin`. Both portals store the short-lived bearer token in `sessionStorage`; a refresh restores the signed-in user through `/api/auth/me`, and sign out revokes the server session.

The admin screens are UI and API-adapter work; they do not alter the customer pricing, quote-lock or checkout flows. In demo mode, changes are not persisted to PostgreSQL and are reset when the application reloads.
