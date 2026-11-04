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

Start PostgreSQL and the backend on port 5000, then start this app on port 5173. Keep both terminals running. If using Vite's proxy instead of CORS, configure it in `vite.config.ts`; currently the API base URL is direct, so the backend should allow `http://localhost:5173` in CORS.
