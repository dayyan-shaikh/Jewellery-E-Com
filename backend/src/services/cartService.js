
const { pool } = require("../config/db");
const Decimal = require("decimal.js");

const {
  calculateProductPrice
} = require("./priceCalculationService");


// ==========================================
// 1. ADD PRODUCT TO CART
// ==========================================

const addToCart = async (sessionId, lockId, quantity) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Validate price lock
    // Validate price lock and prevent reuse
    const lockResult = await client.query(
      `
    SELECT *
    FROM price_locks
    WHERE id = $1
      AND session_id = $2
      AND status = 'ACTIVE'
      AND expires_at > NOW()

      AND NOT EXISTS (
        SELECT 1
        FROM cart_items ci
        JOIN carts c ON c.id = ci.cart_id
        WHERE ci.price_lock_id = price_locks.id
          AND c.status = 'CONVERTED'
      )

    FOR UPDATE
  `,
      [lockId, sessionId]
    );

    if (lockResult.rows.length === 0) {
      throw new Error("PRICE_LOCK_NOT_FOUND_OR_EXPIRED");
    }

    const lock = lockResult.rows[0];

    // Get or create active cart
    let cartResult = await client.query(
      `SELECT id
       FROM carts
       WHERE session_id = $1
         AND status = 'ACTIVE'
       FOR UPDATE`,
      [sessionId]
    );

    let cartId;

    if (cartResult.rows.length === 0) {
      cartResult = await client.query(
        `INSERT INTO carts (session_id)
         VALUES ($1)
         RETURNING id`,
        [sessionId]
      );
    }

    cartId = cartResult.rows[0].id;

    // Validate stock
    const stockResult = await client.query(
      `SELECT stock_quantity
       FROM product_variants
       WHERE id = $1
       FOR UPDATE`,
      [lock.product_variant_id]
    );

    if (
      stockResult.rows.length === 0 ||
      stockResult.rows[0].stock_quantity < quantity
    ) {
      throw new Error("INSUFFICIENT_STOCK");
    }

    // Find existing cart lines for the same variant
    const existingItems = await client.query(
      `SELECT id, price_lock_id
       FROM cart_items
       WHERE cart_id = $1
         AND product_variant_id = $2
       ORDER BY id DESC
       FOR UPDATE`,
      [cartId, lock.product_variant_id]
    );

    let itemResult;

    if (existingItems.rows.length > 0) {
      // Keep the newest cart line
      const existingItem = existingItems.rows[0];

      // Update existing line instead of inserting a duplicate
      itemResult = await client.query(
        `UPDATE cart_items
         SET price_lock_id = $1,
             quantity = $2,
             locked_unit_price = $3,
             current_unit_price = $3,
             price_status = 'LOCKED',
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [
          lock.id,
          quantity,
          lock.total_price,
          existingItem.id
        ]
      );

      // Remove older duplicate lines
      await client.query(
        `DELETE FROM cart_items
         WHERE cart_id = $1
           AND product_variant_id = $2
           AND id <> $3`,
        [cartId, lock.product_variant_id, existingItem.id]
      );

    } else {
      // No existing line: insert a new cart item
      itemResult = await client.query(
        `INSERT INTO cart_items (
          cart_id,
          product_variant_id,
          price_lock_id,
          quantity,
          locked_unit_price,
          current_unit_price,
          price_status
        )
        VALUES ($1, $2, $3, $4, $5, $5, 'LOCKED')
        RETURNING *`,
        [
          cartId,
          lock.product_variant_id,
          lock.id,
          quantity,
          lock.total_price
        ]
      );
    }

    await client.query("COMMIT");

    return {
      cart_id: cartId,
      item: itemResult.rows[0]
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};


// ==========================================
// 2. REVALIDATE CART PRICES
// ==========================================

const revalidateCart = async (sessionId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT ci.id AS cart_item_id, ci.product_variant_id, ci.quantity,
              ci.locked_unit_price, ci.price_status, pl.id AS price_lock_id,
              pl.expires_at, pl.status AS lock_status, pv.stock_quantity
       FROM carts c
       JOIN cart_items ci ON ci.cart_id = c.id
       JOIN product_variants pv ON pv.id = ci.product_variant_id
       LEFT JOIN price_locks pl ON pl.id = ci.price_lock_id
       WHERE c.session_id = $1 AND c.status = 'ACTIVE'
       ORDER BY ci.id
       FOR UPDATE OF ci, pv`,
      [sessionId]
    );

    for (const item of result.rows) {
      const inStock = Number(item.stock_quantity) >= Number(item.quantity);
      if (!inStock) {
        await client.query(
          `UPDATE cart_items SET price_status = 'OUT_OF_STOCK', updated_at = NOW() WHERE id = $1`,
          [item.cart_item_id]
        );
        continue;
      }

      const lockExpired = !item.expires_at || new Date(item.expires_at).getTime() <= Date.now() || !["ACTIVE", "PENDING_CONFIRMATION"].includes(item.lock_status);
      const hasPendingLock = item.lock_status === "PENDING_CONFIRMATION" && !lockExpired;
      const latestPrice = await calculateProductPrice(item.product_variant_id);
      const current = new Decimal(latestPrice.price_breakdown.total_price);
      const locked = new Decimal(item.locked_unit_price);

      // An already offered higher price stays available for the remainder of
      // its own quote window; do not silently replace the customer's offer.
      if (hasPendingLock && current.greaterThan(locked)) {
        await client.query(
          `UPDATE cart_items SET current_unit_price = $1, price_status = 'PRICE_INCREASED_PENDING', updated_at = NOW() WHERE id = $2`,
          [current.toFixed(2), item.cart_item_id]
        );
        continue;
      }

      // If the market falls back to the accepted price before confirmation,
      // replace the pending increase with an automatically accepted lower quote.
      const pendingIncreaseFell = hasPendingLock && !current.greaterThan(locked);
      if (!lockExpired && !pendingIncreaseFell) {
        const status = current.lessThan(locked) ? "PRICE_DECREASED" : "LOCKED";
        await client.query(
          `UPDATE cart_items SET current_unit_price = $1, price_status = $2, updated_at = NOW() WHERE id = $3`,
          [current.toFixed(2), status, item.cart_item_id]
        );
        continue;
      }

      // Expired items get their own replacement quote. A higher price is
      // staged for customer approval; an equal or lower price is accepted.
      const increased = current.greaterThan(locked);
      const breakdown = latestPrice.price_breakdown;
      const lockStatus = increased ? "PENDING_CONFIRMATION" : "ACTIVE";
      const newLock = await client.query(
        `INSERT INTO price_locks (
           session_id, product_variant_id, metal_rate_id, rate_per_gram,
           metal_cost, wastage_amount, making_charge, stone_charge, subtotal,
           gst_amount, total_price, locked_at, expires_at, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                   NOW(), NOW() + INTERVAL '10 minutes', $12)
         RETURNING id`,
        [sessionId, item.product_variant_id, breakdown.metal_rate_id,
          breakdown.rate_per_gram, breakdown.metal_cost, breakdown.wastage_amount,
          breakdown.making_charge, breakdown.stone_charge, breakdown.subtotal,
          breakdown.gst_amount, breakdown.total_price, lockStatus]
      );

      if (item.price_lock_id) {
        await client.query(`UPDATE price_locks SET status = 'REPLACED' WHERE id = $1 AND status IN ('ACTIVE', 'PENDING_CONFIRMATION', 'EXPIRED')`, [item.price_lock_id]);
      }
      await client.query(
        `UPDATE cart_items
         SET price_lock_id = $1, locked_unit_price = $2, current_unit_price = $3,
             price_status = $4, updated_at = NOW()
         WHERE id = $5`,
        [newLock.rows[0].id, increased ? item.locked_unit_price : current.toFixed(2),
          current.toFixed(2),
          increased ? "PRICE_INCREASED_PENDING" : (current.lessThan(locked) ? "PRICE_DECREASED" : "LOCKED"),
          item.cart_item_id]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};


// ==========================================
// 3. GET CART
// ==========================================

const getCart = async (sessionId) => {

  await revalidateCart(sessionId);

  const query = `
    SELECT
      c.id AS cart_id,
      c.session_id,
      c.status AS cart_status,

      ci.id AS cart_item_id,
      ci.product_variant_id,
      ci.price_lock_id,
      ci.quantity,
      ci.locked_unit_price,
      ci.current_unit_price,
      ci.price_status,

      pl.expires_at AS price_lock_expires_at,
      pl.status AS lock_status,
      pl.rate_per_gram AS lock_rate_per_gram,
      pl.metal_cost AS lock_metal_cost,
      pl.wastage_amount AS lock_wastage_amount,
      pl.making_charge AS lock_making_charge,
      pl.stone_charge AS lock_stone_charge,
      pl.subtotal AS lock_subtotal,
      pl.gst_amount AS lock_gst_amount,

      p.name AS product_name,
      p.metal_type,

      pv.sku,
      pv.purity,
      pv.weight_grams,
      pv.stock_quantity

    FROM carts c

    LEFT JOIN cart_items ci
      ON c.id = ci.cart_id

    LEFT JOIN price_locks pl
      ON ci.price_lock_id = pl.id

    LEFT JOIN product_variants pv
      ON ci.product_variant_id = pv.id

    LEFT JOIN products p
      ON pv.product_id = p.id

    WHERE c.session_id = $1
      AND c.status = 'ACTIVE'

    ORDER BY ci.created_at DESC;
  `;

  const result = await pool.query(query, [sessionId]);

  if (result.rows.length === 0) {
    return null;
  }

  const cart = {
    id: result.rows[0].cart_id,
    sessionId: result.rows[0].session_id,
    status: result.rows[0].cart_status,
    items: [],
    total: "0.00"
  };

  let total = new Decimal(0);

  for (const row of result.rows) {

    if (!row.cart_item_id) {
      continue;
    }

    const isExpired =
      !row.price_lock_expires_at ||
      new Date(row.price_lock_expires_at).getTime() <= Date.now() ||
      !["ACTIVE", "PENDING_CONFIRMATION"].includes(row.lock_status);

    const payableUnitPrice =
      ["PRICE_DECREASED", "PRICE_INCREASED_PENDING"].includes(row.price_status)
        ? row.current_unit_price
        : row.locked_unit_price;

    const itemTotal = new Decimal(payableUnitPrice)
      .times(row.quantity);

    total = total.plus(itemTotal);

    cart.items.push({
      id: row.cart_item_id,
      productVariantId: row.product_variant_id,
      priceLockId: row.price_lock_id,
      productName: row.product_name,
      metalType: row.metal_type,
      sku: row.sku,
      purity: row.purity,
      weightGrams: row.weight_grams,
      quantity: row.quantity,

      lockedUnitPrice: row.locked_unit_price,
      currentUnitPrice: row.current_unit_price,
      payableUnitPrice,

      stockQuantity: row.stock_quantity,
      lockRatePerGram: row.lock_rate_per_gram,
      lockMetalCost: row.lock_metal_cost,
      lockWastageAmount: row.lock_wastage_amount,
      lockMakingCharge: row.lock_making_charge,
      lockStoneCharge: row.lock_stone_charge,
      lockSubtotal: row.lock_subtotal,
      lockGstAmount: row.lock_gst_amount,
      priceStatus: row.price_status === "OUT_OF_STOCK" ? "OUT_OF_STOCK" : (isExpired
        ? "PRICE_EXPIRED"
        : row.price_status),

      priceLockExpiresAt: row.price_lock_expires_at,
      priceLockExpired: isExpired,
      requiresNewPriceLock: isExpired,

      canCheckout:
        !isExpired &&
        row.price_status !== "PRICE_INCREASED_PENDING",

      itemTotal: itemTotal.toFixed(2)
    });
  }

  cart.total = total.toFixed(2);

  return cart;
};


// ==========================================
// 4. CONFIRM INCREASED CART PRICE
// ==========================================

const confirmCartItemPrice = async (sessionId, cartItemId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find and lock cart item
    const itemResult = await client.query(
      `SELECT
         ci.*,
         c.session_id,
         pl.status AS lock_status,
         pl.expires_at
       FROM cart_items ci
       JOIN carts c ON c.id = ci.cart_id
       JOIN price_locks pl ON pl.id = ci.price_lock_id
       WHERE ci.id = $1
         AND c.session_id = $2
         AND c.status = 'ACTIVE'
       FOR UPDATE OF ci, pl`,
      [cartItemId, sessionId]
    );

    if (itemResult.rows.length === 0) {
      throw new Error("CART_ITEM_NOT_FOUND");
    }

    const item = itemResult.rows[0];

    if (item.price_status !== "PRICE_INCREASED_PENDING") {
      throw new Error("PRICE_CONFIRMATION_NOT_REQUIRED");
    }

    if (
      item.lock_status !== "PENDING_CONFIRMATION" ||
      new Date(item.expires_at) <= new Date()
    ) {
      throw new Error("PRICE_LOCK_EXPIRED");
    }

    // Recalculate latest price
    const calculation = await calculateProductPrice(
      item.product_variant_id
    );

    const price = calculation.price_breakdown;

    const latestPrice = new Decimal(price.total_price);
    const displayedPrice = new Decimal(item.current_unit_price);

    if (!latestPrice.equals(displayedPrice)) {
      throw new Error("PRICE_CHANGED_RETRY");
    }

    // Create a new 10-minute confirmed price lock
    const lockResult = await client.query(
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
        status,
        confirmed_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        NOW(),
        NOW() + INTERVAL '10 minutes',
        'ACTIVE',
        NOW()
      )
      RETURNING *`,
      [
        sessionId,
        item.product_variant_id,
        price.metal_rate_id,
        price.rate_per_gram,
        price.metal_cost,
        price.wastage_amount,
        price.making_charge,
        price.stone_charge,
        price.subtotal,
        price.gst_amount,
        price.total_price
      ]
    );

    const newLock = lockResult.rows[0];

    // Replace old price lock
    await client.query(
      `UPDATE price_locks
       SET status = 'REPLACED'
       WHERE id = $1`,
      [item.price_lock_id]
    );

    // Update cart item
    const updatedItemResult = await client.query(
      `UPDATE cart_items
       SET price_lock_id = $1,
           locked_unit_price = $2,
           current_unit_price = $2,
           price_status = 'LOCKED',
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [
        newLock.id,
        newLock.total_price,
        cartItemId
      ]
    );

    await client.query("COMMIT");

    return {
      item: updatedItemResult.rows[0],
      lock: newLock,
      message: "New price accepted. Price locked for 10 minutes."
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updateCartItemQuantity = async (sessionId, cartItemId, quantity) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find the cart item and lock its row and product stock row.
    const itemResult = await client.query(
      `
      SELECT
        ci.id,
        ci.cart_id,
        ci.product_variant_id,
        ci.price_lock_id,
        ci.quantity,
        ci.locked_unit_price,
        ci.current_unit_price,
        ci.price_status,
        pv.stock_quantity
      FROM cart_items ci
      JOIN carts c ON c.id = ci.cart_id
      JOIN product_variants pv ON pv.id = ci.product_variant_id
      WHERE ci.id = $1
        AND c.session_id = $2
        AND c.status = 'ACTIVE'
      FOR UPDATE OF ci, pv;
      `,
      [cartItemId, sessionId]
    );

    if (!itemResult.rows.length) {
      throw new Error("CART_ITEM_NOT_FOUND");
    }

    const item = itemResult.rows[0];

    // Check available stock.
    if (quantity > item.stock_quantity) {
      throw new Error("INSUFFICIENT_STOCK");
    }

    // Update only the quantity.
    // The existing price lock and locked price remain unchanged.
    const updateResult = await client.query(
      `
      UPDATE cart_items
      SET quantity = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *;
      `,
      [quantity, cartItemId]
    );

    await client.query("COMMIT");

    return {
      message: "Cart item quantity updated successfully",
      item: updateResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const removeCartItem = async (sessionId, cartItemId) => {
  const result = await pool.query(
    `
    DELETE FROM cart_items ci
    USING carts c
    WHERE ci.cart_id = c.id
      AND ci.id = $1
      AND c.session_id = $2
      AND c.status = 'ACTIVE'
    RETURNING ci.*;
    `,
    [cartItemId, sessionId]
  );

  if (!result.rows.length) {
    throw new Error("CART_ITEM_NOT_FOUND");
  }

  return result.rows[0];
};

// ==========================================
// EXPORT FUNCTIONS
// ==========================================

module.exports = {
  addToCart,
  getCart,
  confirmCartItemPrice,
  updateCartItemQuantity,
  removeCartItem
};
