const { pool } = require("../config/db");
const Decimal = require("decimal.js");

// ==========================================
// 1. CALCULATE PRICE USING TRANSACTION CLIENT
// ==========================================

const calculatePriceWithClient = async (client, variantId) => {
    const query = `
    SELECT
      p.id AS product_id,
      p.name,
      p.metal_type,
      p.wastage_percentage,
      p.making_charge_per_gram,

      pv.id AS variant_id,
      pv.sku,
      pv.purity,
      pv.weight_grams,
      pv.stone_charge,
      pv.stock_quantity,

      mr.id AS metal_rate_id,
      mr.rate_per_gram,
      mr.currency

    FROM product_variants pv

    JOIN products p
      ON p.id = pv.product_id

    JOIN metal_rates mr
      ON mr.metal_type = p.metal_type
      AND mr.purity = pv.purity

    WHERE pv.id = $1
      AND pv.is_active = TRUE
      AND p.is_active = TRUE

    FOR SHARE OF p, pv, mr;
  `;

    const result = await client.query(query, [variantId]);

    if (!result.rows.length) {
        throw new Error("PRODUCT_NOT_AVAILABLE");
    }

    const product = result.rows[0];

    const weight = new Decimal(product.weight_grams);
    const rate = new Decimal(product.rate_per_gram);
    const wastagePercentage = new Decimal(product.wastage_percentage);
    const makingRate = new Decimal(product.making_charge_per_gram);
    const stoneCharge = new Decimal(product.stone_charge || 0);

    const metalCost = weight.mul(rate);

    const wastageAmount = metalCost
        .mul(wastagePercentage)
        .div(100);

    const makingCharge = weight.mul(makingRate);

    const subtotal = metalCost
        .plus(wastageAmount)
        .plus(makingCharge)
        .plus(stoneCharge);

    const gstAmount = subtotal.mul(3).div(100);

    const totalPrice = subtotal.plus(gstAmount);

    const money = (value) =>
        value.toDecimalPlaces(2).toFixed(2);

    return {
        product: {
            id: product.product_id,
            name: product.name,
            variant_id: product.variant_id,
            sku: product.sku,
            metal_type: product.metal_type,
            purity: product.purity,
            weight_grams: weight.toString(),
        },

        price_breakdown: {
            metal_rate_id: product.metal_rate_id,
            rate_per_gram: money(rate),
            metal_cost: money(metalCost),
            wastage_amount: money(wastageAmount),
            making_charge: money(makingCharge),
            stone_charge: money(stoneCharge),
            subtotal: money(subtotal),
            gst_amount: money(gstAmount),
            total_price: money(totalPrice),
            currency: product.currency,
        },
    };
};


// ==========================================
// 2. CHECK EXISTING IDEMPOTENT ORDER
// ==========================================

const findExistingOrder = async (client, sessionId, idempotencyKey) => {
    const result = await client.query(
        `
    SELECT
      o.id,
      o.cart_id,
      o.session_id,
      o.total_amount,
      o.status,
      o.idempotency_key,
      o.created_at
    FROM orders o
    WHERE o.idempotency_key = $1
    `,
        [idempotencyKey]
    );

    if (!result.rows.length) {
        return null;
    }

    const order = result.rows[0];

    if (order.session_id !== sessionId) {
        throw new Error("IDEMPOTENCY_KEY_CONFLICT");
    }

    const itemsResult = await client.query(
        `
    SELECT *
    FROM order_items
    WHERE order_id = $1
    ORDER BY id
    `,
        [order.id]
    );

    return {
        ...order,
        items: itemsResult.rows,
        alreadyProcessed: true,
    };
};


// ==========================================
// 3. CHECKOUT
// ==========================================

const checkout = async (sessionId, idempotencyKey) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // --------------------------------------
        // A. Check existing idempotent order
        // --------------------------------------

        let existingOrder = await findExistingOrder(
            client,
            sessionId,
            idempotencyKey
        );

        if (existingOrder) {
            await client.query("COMMIT");

            return existingOrder;
        }

        // --------------------------------------
        // B. Lock active cart
        // --------------------------------------

        const cartResult = await client.query(
            `
      SELECT *
      FROM carts
      WHERE session_id = $1
        AND status = 'ACTIVE'
      FOR UPDATE
      `,
            [sessionId]
        );

        // A concurrent request may have completed
        // checkout while this request was waiting.
        if (!cartResult.rows.length) {
            existingOrder = await findExistingOrder(
                client,
                sessionId,
                idempotencyKey
            );

            if (existingOrder) {
                await client.query("COMMIT");
                return existingOrder;
            }

            throw new Error("ACTIVE_CART_NOT_FOUND");
        }

        const cart = cartResult.rows[0];

        // --------------------------------------
        // C. Lock cart items and price locks
        // --------------------------------------

        const itemsResult = await client.query(
            `
      SELECT
        ci.id AS cart_item_id,
        ci.product_variant_id,
        ci.price_lock_id,
        ci.quantity,
        ci.locked_unit_price,
        ci.current_unit_price,
        ci.price_status,

        pl.session_id AS lock_session_id,
        pl.product_variant_id AS lock_variant_id,
        pl.total_price AS lock_total_price,
        pl.status AS lock_status,
        pl.expires_at

      FROM cart_items ci

      JOIN price_locks pl
        ON pl.id = ci.price_lock_id

      WHERE ci.cart_id = $1

      ORDER BY ci.product_variant_id, ci.id

      FOR UPDATE OF ci, pl
      `,
            [cart.id]
        );

        if (!itemsResult.rows.length) {
            throw new Error("CART_EMPTY");
        }

        const cartItems = itemsResult.rows;

        // --------------------------------------
        // D. Validate all price locks
        // --------------------------------------

        for (const item of cartItems) {
            if (
                item.lock_session_id !== sessionId ||
                Number(item.lock_variant_id) !==
                Number(item.product_variant_id)
            ) {
                throw new Error("INVALID_PRICE_LOCK");
            }

            if (item.price_status === "PRICE_INCREASED_PENDING" || item.lock_status === "PENDING_CONFIRMATION") {
                throw new Error("PRICE_CONFIRMATION_REQUIRED");
            }

            if (
                item.lock_status !== "ACTIVE" ||
                new Date(item.expires_at).getTime() <= Date.now()
            ) {
                throw new Error("PRICE_LOCK_EXPIRED");
            }

            if (
                ![
                    "LOCKED",
                    "PRICE_DECREASED",
                ].includes(item.price_status)
            ) {
                if (item.price_status === "OUT_OF_STOCK") {
                    throw new Error("INSUFFICIENT_STOCK");
                }

                if (item.price_status === "PRICE_INCREASED_PENDING") {
                    throw new Error("PRICE_CONFIRMATION_REQUIRED");
                }

                throw new Error("INVALID_CART_PRICE_STATUS");
            }

            // Ensure the cart's locked price matches its price-lock snapshot.
            if (
                !new Decimal(item.locked_unit_price).equals(
                    new Decimal(item.lock_total_price)
                )
            ) {
                throw new Error("INVALID_PRICE_LOCK");
            }

            if (
                !Number.isSafeInteger(Number(item.quantity)) ||
                Number(item.quantity) <= 0
            ) {
                throw new Error("INVALID_QUANTITY");
            }
        }

        // --------------------------------------
        // E. Lock inventory rows in consistent order
        // --------------------------------------

        const variantIds = [
            ...new Set(
                cartItems.map((item) => Number(item.product_variant_id))
            ),
        ].sort((a, b) => a - b);

        const stockResult = await client.query(
            `
      SELECT
        id,
        stock_quantity
      FROM product_variants
      WHERE id = ANY($1::bigint[])
      ORDER BY id
      FOR UPDATE
      `,
            [variantIds]
        );

        const stockMap = new Map(
            stockResult.rows.map((row) => [
                Number(row.id),
                Number(row.stock_quantity),
            ])
        );

        if (stockMap.size !== variantIds.length) {
            throw new Error("PRODUCT_NOT_AVAILABLE");
        }

        // --------------------------------------
        // F. Recalculate prices and validate stock
        // --------------------------------------

        const orderItems = [];
        let orderTotal = new Decimal(0);

        for (const item of cartItems) {
            const variantId = Number(item.product_variant_id);
            const quantity = Number(item.quantity);

            const availableStock = stockMap.get(variantId);

            if (availableStock < quantity) {
                throw new Error("INSUFFICIENT_STOCK");
            }

            const calculation = await calculatePriceWithClient(
                client,
                variantId
            );

            const product = calculation.product;
            const price = calculation.price_breakdown;

            const latestPrice = new Decimal(price.total_price);
            const lockedPrice = new Decimal(item.locked_unit_price);

            // A valid lock protects the customer from increases through
            // checkout. Any lower live price is passed through automatically.
            const payableUnitPrice = latestPrice.lessThan(lockedPrice)
                ? latestPrice
                : lockedPrice;

            const itemTotal = payableUnitPrice.mul(quantity);

            orderTotal = orderTotal.plus(itemTotal);

            orderItems.push({
                product_variant_id: variantId,
                product_name: product.name,
                metal_type: product.metal_type,
                purity: product.purity,
                weight_grams: product.weight_grams,
                quantity,
                unit_price: payableUnitPrice.toFixed(2),
                total_price: itemTotal.toFixed(2),
            });
        }

        // --------------------------------------
        // G. Create order
        // --------------------------------------

        const orderResult = await client.query(
            `
      INSERT INTO orders (
        cart_id,
        session_id,
        total_amount,
        status,
        idempotency_key
      )
      VALUES ($1, $2, $3, 'PLACED', $4)
      RETURNING *
      `,
            [
                cart.id,
                sessionId,
                orderTotal.toFixed(2),
                idempotencyKey,
            ]
        );

        const order = orderResult.rows[0];

        // --------------------------------------
        // H. Create order items
        // --------------------------------------

        const createdOrderItems = [];

        for (const item of orderItems) {
            const result = await client.query(
                `
        INSERT INTO order_items (
          order_id,
          product_variant_id,
          product_name,
          metal_type,
          purity,
          weight_grams,
          quantity,
          unit_price,
          total_price
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
                [
                    order.id,
                    item.product_variant_id,
                    item.product_name,
                    item.metal_type,
                    item.purity,
                    item.weight_grams,
                    item.quantity,
                    item.unit_price,
                    item.total_price,
                ]
            );

            createdOrderItems.push(result.rows[0]);
        }

        // --------------------------------------
        // I. Deduct stock
        // --------------------------------------

        for (const item of orderItems) {
            const stockUpdate = await client.query(
                `
        UPDATE product_variants
        SET stock_quantity = stock_quantity - $1
        WHERE id = $2
          AND stock_quantity >= $1
        RETURNING id, stock_quantity
        `,
                [
                    item.quantity,
                    item.product_variant_id,
                ]
            );

            if (!stockUpdate.rows.length) {
                throw new Error("INSUFFICIENT_STOCK");
            }
        }

        // --------------------------------------
        // J. Convert cart
        // --------------------------------------

        // --------------------------------------
        // J. Mark price locks as consumed
        // --------------------------------------

        const usedLockIds = cartItems.map(
            (item) => item.price_lock_id
        );

        const lockUpdateResult = await client.query(
            `
                UPDATE price_locks
                SET status = 'CONFIRMED'
                WHERE id = ANY($1::bigint[])
                AND status = 'ACTIVE'
                RETURNING id
  `,
            [usedLockIds]
        );

        if (lockUpdateResult.rowCount !== usedLockIds.length) {
            throw new Error("INVALID_PRICE_LOCK");
        }

        // --------------------------------------
        // K. Convert cart
        // --------------------------------------

        await client.query(
            `
    UPDATE carts
    SET status = 'CONVERTED',
        updated_at = NOW()
    WHERE id = $1
  `,
            [cart.id]
        );

        // --------------------------------------
        // K. Commit transaction
        // --------------------------------------

        await client.query("COMMIT");

        return {
            ...order,
            items: createdOrderItems,
            alreadyProcessed: false,
        };

    } catch (error) {
        await client.query("ROLLBACK");

        // Handle concurrent requests using the same
        // unique idempotency key.
        if (
            error.code === "23505" &&
            error.constraint === "orders_idempotency_key_key"
        ) {
            const existingOrder = await pool.query(
                `
        SELECT *
        FROM orders
        WHERE idempotency_key = $1
        `,
                [idempotencyKey]
            );

            if (existingOrder.rows.length) {
                const order = existingOrder.rows[0];

                if (order.session_id !== sessionId) {
                    throw new Error("IDEMPOTENCY_KEY_CONFLICT");
                }

                const itemsResult = await pool.query(
                    `
          SELECT *
          FROM order_items
          WHERE order_id = $1
          ORDER BY id
          `,
                    [order.id]
                );

                return {
                    ...order,
                    items: itemsResult.rows,
                    alreadyProcessed: true,
                };
            }
        }

        throw error;

    } finally {
        client.release();
    }
};


// ==========================================
// EXPORT
// ==========================================

module.exports = {
    checkout,
};
