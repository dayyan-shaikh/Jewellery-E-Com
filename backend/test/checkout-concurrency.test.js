const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { pool } = require("../src/config/db");
const { checkout } = require("../src/services/checkoutService");

test("concurrent checkouts cannot sell the same last unit twice", async () => {
  const suffix = randomUUID().replace(/-/g, "");
  const sessions = [`race_a_${suffix}`, `race_b_${suffix}`];
  let productId;
  let variantId;

  try {
    const rateResult = await pool.query(
      "SELECT id, metal_type, purity, rate_per_gram FROM metal_rates ORDER BY id LIMIT 1"
    );
    assert.ok(rateResult.rowCount, "the database needs at least one metal rate");
    const rate = rateResult.rows[0];

    const productResult = await pool.query(
      `INSERT INTO products (name, description, metal_type, wastage_percentage, making_charge_per_gram, is_active)
       VALUES ($1, 'temporary checkout race fixture', $2, 0, 0, TRUE) RETURNING id`,
      [`Checkout race ${suffix}`, rate.metal_type]
    );
    productId = productResult.rows[0].id;

    const variantResult = await pool.query(
      `INSERT INTO product_variants (product_id, sku, purity, weight_grams, stone_charge, stock_quantity, is_active)
       VALUES ($1, $2, $3, 1, 0, 1, TRUE) RETURNING id`,
      [productId, `RACE-${suffix}`.slice(0, 50), rate.purity]
    );
    variantId = variantResult.rows[0].id;

    const calculation = require("../src/services/priceCalculationService");
    const quote = await calculation.calculateProductPrice(Number(variantId));
    const price = quote.price_breakdown;

    for (const sessionId of sessions) {
      const lockResult = await pool.query(
        `INSERT INTO price_locks (
          session_id, product_variant_id, metal_rate_id, rate_per_gram,
          metal_cost, wastage_amount, making_charge, stone_charge,
          subtotal, gst_amount, total_price, expires_at, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()+INTERVAL '10 minutes','ACTIVE')
        RETURNING id`,
        [sessionId, variantId, price.metal_rate_id, price.rate_per_gram, price.metal_cost,
          price.wastage_amount, price.making_charge, price.stone_charge, price.subtotal,
          price.gst_amount, price.total_price]
      );
      const cartResult = await pool.query(
        "INSERT INTO carts (session_id, status) VALUES ($1, 'ACTIVE') RETURNING id",
        [sessionId]
      );
      await pool.query(
        `INSERT INTO cart_items (cart_id, product_variant_id, price_lock_id, quantity, locked_unit_price, current_unit_price, price_status)
         VALUES ($1,$2,$3,1,$4,$4,'LOCKED')`,
        [cartResult.rows[0].id, variantId, lockResult.rows[0].id, price.total_price]
      );
    }

    const results = await Promise.allSettled([
      checkout(sessions[0], `race_key_a_${suffix}`),
      checkout(sessions[1], `race_key_b_${suffix}`),
    ]);
    const succeeded = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(succeeded.length, 1, "exactly one checkout should succeed");
    assert.equal(rejected.length, 1, "the other checkout should fail");
    assert.equal(rejected[0].reason.message, "INSUFFICIENT_STOCK");

    const stockResult = await pool.query(
      "SELECT stock_quantity FROM product_variants WHERE id=$1",
      [variantId]
    );
    const ordersResult = await pool.query(
      "SELECT COUNT(*)::INTEGER AS count FROM orders WHERE session_id = ANY($1::text[])",
      [sessions]
    );
    assert.equal(stockResult.rows[0].stock_quantity, 0, "stock must not become negative");
    assert.equal(ordersResult.rows[0].count, 1, "only one order must be recorded");
  } finally {
    await pool.query(
      `DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE session_id = ANY($1::text[]))`,
      [sessions]
    );
    await pool.query("DELETE FROM orders WHERE session_id = ANY($1::text[])", [sessions]);
    await pool.query("DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE session_id = ANY($1::text[]))", [sessions]);
    await pool.query("DELETE FROM price_locks WHERE session_id = ANY($1::text[])", [sessions]);
    await pool.query("DELETE FROM carts WHERE session_id = ANY($1::text[])", [sessions]);
    if (variantId) await pool.query("DELETE FROM product_variants WHERE id=$1", [variantId]);
    if (productId) await pool.query("DELETE FROM products WHERE id=$1", [productId]);
  }
});

test.after(async () => pool.end());
