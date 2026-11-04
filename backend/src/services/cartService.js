
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

  const result = await pool.query(
    `SELECT
       ci.id AS cart_item_id,
       ci.product_variant_id,
       ci.locked_unit_price,
       ci.price_status,
       pl.expires_at,
       pl.status AS lock_status

     FROM carts c

     JOIN cart_items ci
       ON ci.cart_id = c.id

     LEFT JOIN price_locks pl
       ON pl.id = ci.price_lock_id

     WHERE c.session_id = $1
       AND c.status = 'ACTIVE'`,
    [sessionId]
  );

  for (const item of result.rows) {

    const isExpired =
      !item.expires_at ||
      new Date(item.expires_at).getTime() <= Date.now() ||
      item.lock_status !== "ACTIVE";

    if (isExpired) {
      continue;
    }

    // Calculate latest product price
    const latestPrice = await calculateProductPrice(
      item.product_variant_id
    );

    const newPrice = new Decimal(
      latestPrice.price_breakdown.total_price
    );

    const oldPrice = new Decimal(
      item.locked_unit_price
    );

    let priceStatus = "LOCKED";

    if (newPrice.greaterThan(oldPrice)) {
      priceStatus = "PRICE_INCREASED_PENDING";
    } else if (newPrice.lessThan(oldPrice)) {
      priceStatus = "PRICE_DECREASED";
    }

    await pool.query(
      `UPDATE cart_items
       SET current_unit_price = $1,
           price_status = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [
        newPrice.toFixed(2),
        priceStatus,
        item.cart_item_id
      ]
    );
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

      p.name AS product_name,
      p.metal_type,

      pv.sku,
      pv.purity,
      pv.weight_grams

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
      row.lock_status !== "ACTIVE";

    const payableUnitPrice =
      row.price_status === "PRICE_DECREASED"
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

      priceStatus: isExpired
        ? "PRICE_EXPIRED"
        : row.price_status,

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
      item.lock_status !== "ACTIVE" ||
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
