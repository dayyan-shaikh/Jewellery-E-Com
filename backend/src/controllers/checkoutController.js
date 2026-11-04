const checkoutService = require("../services/checkoutService");

const checkout = async (req, res) => {
  try {
    const sessionId = req.get("x-session-id");
    const idempotencyKey = req.get("Idempotency-Key");

    // Validate session ID
    if (
      !sessionId ||
      !/^[a-zA-Z0-9_-]+$/.test(sessionId) ||
      sessionId.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid session ID is required",
      });
    }

    // Validate idempotency key
    if (
      !idempotencyKey ||
      idempotencyKey.length > 100 ||
      idempotencyKey.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid Idempotency-Key header is required",
      });
    }

    const result = await checkoutService.checkout(
      sessionId,
      idempotencyKey
    );

    return res.status(result.alreadyProcessed ? 200 : 201).json({
      success: true,
      message: result.alreadyProcessed
        ? "Checkout already processed. Returning existing order."
        : "Order placed successfully",
      data: result,
    });

  } catch (error) {
    console.error("Checkout error:", error);

    const errors = {
      ACTIVE_CART_NOT_FOUND: [404, "Active cart not found"],
      CART_EMPTY: [400, "Your cart is empty"],
      PRICE_LOCK_EXPIRED: [409, "Price lock has expired. Please refresh your cart"],
      PRICE_CONFIRMATION_REQUIRED: [409, "Please confirm the increased price before checkout"],
      PRICE_CHANGED_CONFIRMATION_REQUIRED: [409, "Product price has increased. Please review and confirm the new price"],
      INVALID_PRICE_LOCK: [409, "Invalid price lock"],
      INVALID_CART_PRICE_STATUS: [409, "Cart contains an invalid price status"],
      PRODUCT_NOT_AVAILABLE: [409, "One or more products are unavailable"],
      INSUFFICIENT_STOCK: [409, "Insufficient stock available"],
      INVALID_QUANTITY: [400, "Invalid product quantity"],
      IDEMPOTENCY_KEY_CONFLICT: [409, "Idempotency key belongs to another session"],
    };

    const [status, message] = errors[error.message] || [
      500,
      "Something went wrong during checkout",
    ];

    return res.status(status).json({
      success: false,
      message,
    });
  }
};

module.exports = {
  checkout,
};