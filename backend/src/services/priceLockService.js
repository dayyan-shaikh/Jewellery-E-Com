const { pool } = require("../config/db");
const Decimal = require("decimal.js");
const {
  calculateProductPrice,
} = require("./priceCalculationService");

const createPriceLock = async (sessionId, variantId) => {

  // Step 1: Calculate the current product price
  const calculation = await calculateProductPrice(variantId);

  const product = calculation.product;
  const price = calculation.price_breakdown;

  // Step 2: Store the calculated price snapshot
  const query = `
    INSERT INTO price_locks (
      session_id,
      product_variant_id,
      metal_rate_id,
      rate_per_gram,
      metal_cost,
      wastage_amount,
      making_charge,
      stone_charge,
      subtotal,
      gst_amount,
      total_price,
      locked_at,
      expires_at,
      status
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
      NOW(),
      NOW() + INTERVAL '10 minutes',
      'ACTIVE'
    )
    RETURNING *;
  `;

  const values = [
    sessionId,
    product.variant_id,
    price.metal_rate_id,
    price.rate_per_gram,
    price.metal_cost,
    price.wastage_amount,
    price.making_charge,
    price.stone_charge,
    price.subtotal,
    price.gst_amount,
    price.total_price,
  ];

  const result = await pool.query(query, values);

  return {
    lock: result.rows[0],
    product,
    price_breakdown: price,
  };
};

const getPriceLockById = async (lockId, sessionId) => {
  const query = `
    UPDATE price_locks
    SET status = 'EXPIRED'
    WHERE id = $1
      AND session_id = $2
      AND status = 'ACTIVE'
      AND expires_at <= NOW();

    SELECT
      id,
      session_id,
      product_variant_id,
      total_price,
      status,
      locked_at,
      expires_at,
      GREATEST(
        0,
        CEIL(EXTRACT(EPOCH FROM (expires_at - NOW())))
      ) AS remaining_seconds
    FROM price_locks
    WHERE id = $1
      AND session_id = $2;
  `;

  // Execute the statements separately for reliable results
  await pool.query(
    `UPDATE price_locks
     SET status = 'EXPIRED'
     WHERE id = $1
       AND session_id = $2
       AND status = 'ACTIVE'
       AND expires_at <= NOW()`,
    [lockId, sessionId]
  );

  const result = await pool.query(
    `SELECT
       id,
       session_id,
       product_variant_id,
       total_price,
       status,
       locked_at,
       expires_at,
       GREATEST(
         0,
         CEIL(EXTRACT(EPOCH FROM (expires_at - NOW())))
       ) AS remaining_seconds
     FROM price_locks
     WHERE id = $1 AND session_id = $2`,
    [lockId, sessionId]
  );

  return result.rows[0] || null;
};

const refreshPriceLock = async (lockId, sessionId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Find and lock the original price-lock record
    const oldLockResult = await client.query(
      `SELECT *
       FROM price_locks
       WHERE id = $1 AND session_id = $2
       FOR UPDATE`,
      [lockId, sessionId]
    );

    if (oldLockResult.rows.length === 0) {
      const error = new Error("Price lock not found");
      error.statusCode = 404;
      throw error;
    }

    const oldLock = oldLockResult.rows[0];

    // 2. Check whether the original lock has expired
    if (oldLock.status === "ACTIVE" &&
        new Date(oldLock.expires_at) > new Date()) {
      const error = new Error("Price lock has not expired yet");
      error.statusCode = 409;
      throw error;
    }

    if (!["EXPIRED", "ACTIVE"].includes(oldLock.status)) {
      const error = new Error("Price lock cannot be refreshed");
      error.statusCode = 409;
      throw error;
    }

    if (oldLock.status === "ACTIVE") {
      await client.query(
        `UPDATE price_locks
         SET status = 'EXPIRED'
         WHERE id = $1`,
        [lockId]
      );
    }

    // 3. Calculate the latest product price
    const calculation = await calculateProductPrice(
      oldLock.product_variant_id
    );

    const price = calculation.price_breakdown;

    const oldPrice = new Decimal(oldLock.total_price);
    const newPrice = new Decimal(price.total_price);

    // 4. Compare old and new prices
    const priceIncreased = newPrice.greaterThan(oldPrice);

    const status = priceIncreased
      ? "PENDING_CONFIRMATION"
      : "ACTIVE";

    // 5. Create a new price lock
    const insertResult = await client.query(
      `INSERT INTO price_locks (
        session_id,
        product_variant_id,
        metal_rate_id,
        rate_per_gram,
        metal_cost,
        wastage_amount,
        making_charge,
        stone_charge,
        subtotal,
        gst_amount,
        total_price,
        locked_at,
        expires_at,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        NOW(),
        NOW() + INTERVAL '10 minutes',
        $12
      )
      RETURNING *`,
      [
        sessionId,
        oldLock.product_variant_id,
        price.metal_rate_id,
        price.rate_per_gram,
        price.metal_cost,
        price.wastage_amount,
        price.making_charge,
        price.stone_charge,
        price.subtotal,
        price.gst_amount,
        price.total_price,
        status
      ]
    );

    await client.query("COMMIT");

    return {
      old_price: oldPrice.toFixed(2),
      new_price: newPrice.toFixed(2),
      price_changed: !newPrice.equals(oldPrice),
      price_increased: priceIncreased,
      requires_confirmation: priceIncreased,
      lock: insertResult.rows[0],
      product: calculation.product,
      price_breakdown: price
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const confirmPriceLock = async (lockId, sessionId) => {
  const query = `
    UPDATE price_locks
    SET
      status = 'ACTIVE',
      confirmed_at = NOW()
    WHERE id = $1
      AND session_id = $2
      AND status = 'PENDING_CONFIRMATION'
      AND expires_at > NOW()
    RETURNING *;
  `;

  const result = await pool.query(query, [
    lockId,
    sessionId
  ]);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};

module.exports = {
  createPriceLock,
  getPriceLockById,
    refreshPriceLock,
    confirmPriceLock
};