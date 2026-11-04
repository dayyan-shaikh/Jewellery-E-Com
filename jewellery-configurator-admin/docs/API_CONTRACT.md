# Frontend ↔ Backend API Contract

Base URL: `http://localhost:5000/api` (overridable using `VITE_API_BASE_URL`).

## Admin endpoints

All `/admin/*` endpoints require `Authorization: Bearer <JWT>` for an admin user. The admin client sends this token for each request.

- `GET /admin/summary` returns product, variant stock, metal-rate and order totals.
- `GET /admin/products` returns product rows with their variants, including database IDs and active flags.
- `POST /admin/products` creates one product and one or more variants in a transaction.
- `PUT /admin/products/:id` updates schema-backed product and variant fields in a transaction.
- `GET /admin/metal-rates` returns each metal/purity rate row.
- `POST /admin/metal-rates` adds a unique metal/purity rate row.
- `PATCH /admin/metal-rates/:id` updates a rate and marks its source as `ADMIN`.
- `GET /admin/orders` returns read-only orders and their stored order items.

Product writes map to `products` (`name`, `description`, `metal_type`, `wastage_percentage`, `making_charge_per_gram`, `has_stones`, `is_active`) and `product_variants` (`sku`, `purity`, `weight_grams`, `stone_charge`, `stock_quantity`, `is_active`). A variant can only be saved when a matching `(metal_type, purity)` rate exists. Updating product or rate data affects future storefront reads and quotes; existing price locks retain their stored price snapshot.

The schema has no product category, image URL, or separate making-charge-rule table, so those fields are not presented as editable database values.

The frontend service layer accepts either a direct response object or a `{ data: ... }` envelope. Field names below are the canonical frontend contract. If the backend differs, adapt `src/services/api.ts` rather than scattering mapping logic across components.

## Product

`GET /products`

```json
{
  "data": [
    {
      "id": "ring-01",
      "name": "The Solenne Ring",
      "subtitle": "A study in quiet brilliance",
      "description": "A sculptural gold ring...",
      "category": "Rings",
      "metal": "gold",
      "purities": ["18K", "22K"],
      "defaultPurity": "18K",
      "weightOptions": [3.5, 4, 4.5, 5],
      "defaultWeight": 4,
      "wastagePercent": 5,
      "makingChargePerGram": 850,
      "stoneCost": 0,
      "stock": 3,
      "imageUrl": "https://...",
      "tag": "Bestseller"
    }
  ]
}
```

`GET /products/:id` returns one product.

## Pricing

`POST /pricing/quote`

Request:
```json
{ "productId": "ring-01", "purity": "18K", "weightGrams": 4 }
```

Response:
```json
{
  "data": {
    "id": "quote-uuid",
    "productId": "ring-01",
    "purity": "18K",
    "weightGrams": 4,
    "currency": "INR",
    "metalRatePerGram": 6800,
    "metalValue": 19584,
    "wastage": 979.2,
    "makingCharges": 3400,
    "stoneCost": 0,
    "subtotal": 23963.2,
    "gst": 718.9,
    "total": 24682.1,
    "createdAt": "2026-11-04T09:00:00.000Z",
    "expiresAt": "2026-11-04T09:10:00.000Z"
  }
}
```

`POST /pricing/quotes/:id/refresh` refreshes an expired quote. Expected response includes `change`: `INCREASED | DECREASED | UNCHANGED | OUT_OF_STOCK` and `previousTotal` when applicable.

## Cart

- `GET /cart`
- `POST /cart/items` body `{ "productId": "...", "quoteId": "...", "quantity": 1 }`
- `DELETE /cart/items/:itemId`
- `POST /cart/items/:itemId/refresh-price`
- `POST /cart/items/:itemId/accept-price` body `{ "quoteId": "new-quote-id" }`

A cart item should include `id`, `product`, `quantity`, `quote`, `status` (`CONFIRMED`, `AWAITING_CONFIRMATION`, `OUT_OF_STOCK`), `previousTotal`, and `priceChange`.

## Checkout

`POST /orders/checkout`

Request:
```json
{ "idempotencyKey": "client-generated-uuid" }
```

Response:
```json
{ "data": { "id": "order-uuid", "orderNumber": "MA-10428", "total": 24682.1, "createdAt": "..." } }
```

The backend must perform all quote/stock checks and atomic inventory deduction inside a database transaction. The frontend's disabled button is only a usability guard, not a security boundary.

## Error shape

Recommended:
```json
{ "error": { "code": "PRICE_CONFIRMATION_REQUIRED", "message": "Please confirm the updated price." } }
```

Useful codes: `QUOTE_EXPIRED`, `PRICE_CONFIRMATION_REQUIRED`, `OUT_OF_STOCK`, `INSUFFICIENT_STOCK`, `VALIDATION_ERROR`.

## Proposed Admin API contract (frontend adapter)

The admin frontend adapter uses the following proposed endpoints when `VITE_USE_DEMO_DATA=false`:

- `GET /admin/products`
- `POST /admin/products`
- `PUT /admin/products/:id`
- `GET /admin/metal-rates`
- `PATCH /admin/metal-rates/:metal`
- `GET /admin/making-charge-rules`
- `POST /admin/making-charge-rules`
- `PUT /admin/making-charge-rules/:id`
- `GET /admin/orders`

These endpoints are not part of the original customer API contract and must be implemented or mapped to existing backend routes. All endpoints must enforce server-side administrator authentication and authorization. Do not rely on frontend route visibility for access control.
