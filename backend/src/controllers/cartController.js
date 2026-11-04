
const cartService = require("../services/cartService");

const addToCart = async (req, res) => {
  try {
    const sessionId = req.customerSessionId || req.get("x-session-id");
    const { lockId, quantity = 1 } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID required"
      });
    }

    if (!Number.isSafeInteger(lockId) || lockId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid lock ID required"
      });
    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid quantity required"
      });
    }

    const result = await cartService.addToCart(
      sessionId,
      lockId,
      quantity
    );

    return res.status(201).json({
      success: true,
      message: "Product added to cart",
      data: result
    });

  } catch (error) {
    const errors = {
      PRICE_LOCK_NOT_FOUND: [404, "Price lock not found"],
      PRICE_LOCK_EXPIRED: [409, "Price lock has expired"],
      PRICE_NOT_CONFIRMED: [409, "Price confirmation required"],
      INSUFFICIENT_STOCK: [409, "Insufficient stock"]
    };

    const [status, message] = errors[error.message] || [
      500,
      "Failed to add product to cart"
    ];

    console.error("Add to cart error:", error.message);

    return res.status(status).json({
      success: false,
      message
    });
  }
};


// GET CART
const getCartDetails = async (req, res) => {
  try {
    const sessionId = req.customerSessionId || req.get("x-session-id");

    if (
      !sessionId ||
      !/^[a-zA-Z0-9_-]+$/.test(sessionId) ||
      sessionId.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid x-session-id header is required"
      });
    }

    const cart = await cartService.getCart(sessionId);

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cart fetched successfully",
      data: cart
    });

  } catch (error) {
    console.error("Get cart error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch cart"
    });
  }
};


// CONFIRM INCREASED CART PRICE
const confirmCartItemPrice = async (req, res) => {
  try {
    const sessionId = req.customerSessionId || req.get("x-session-id");
    const { id } = req.params;

    if (
      !sessionId ||
      !/^[a-zA-Z0-9_-]+$/.test(sessionId) ||
      sessionId.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid session ID is required"
      });
    }

    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
      return res.status(400).json({
        success: false,
        message: "Valid cart item ID is required"
      });
    }

    const result = await cartService.confirmCartItemPrice(
      sessionId,
      Number(id)
    );

    return res.status(200).json({
      success: true,
      message: "New price accepted and locked for 10 minutes",
      data: result
    });

  } catch (error) {
    const errors = {
      CART_ITEM_NOT_FOUND: [404, "Cart item not found"],
      PRICE_CONFIRMATION_NOT_REQUIRED: [
        409,
        "This cart item does not require price confirmation"
      ],
      PRICE_LOCK_EXPIRED: [
        409,
        "Price lock expired. Please refresh the price."
      ],
      PRICE_CHANGED_RETRY: [
        409,
        "Price changed again. Fetch the cart and review the latest price."
      ]
    };

    const [status, message] = errors[error.message] || [
      500,
      "Failed to confirm cart item price"
    ];

    console.error("Cart price confirmation error:", error.message);

    return res.status(status).json({
      success: false,
      message
    });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const sessionId = req.customerSessionId || req.get("x-session-id");
    const cartItemId = Number(req.params.id);
    const { quantity } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    if (!Number.isSafeInteger(cartItemId) || cartItemId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid cart item ID is required",
      });
    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

    const result = await cartService.updateCartItemQuantity(
      sessionId,
      cartItemId,
      quantity
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.item,
    });
  } catch (error) {
    const errors = {
      CART_ITEM_NOT_FOUND: [404, "Cart item not found"],
      INSUFFICIENT_STOCK: [409, "Requested quantity exceeds available stock"],
    };

    const [status, message] = errors[error.message] || [
      500,
      "Internal server error",
    ];

    return res.status(status).json({
      success: false,
      message,
    });
  }
};


const removeCartItem = async (req, res) => {
  try {
    const sessionId = req.get("x-session-id");
    const cartItemId = Number(req.params.id);

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    if (!Number.isSafeInteger(cartItemId) || cartItemId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid cart item ID is required",
      });
    }

    const result = await cartService.removeCartItem(
      sessionId,
      cartItemId
    );

    return res.status(200).json({
      success: true,
      message: "Cart item removed successfully",
      data: result,
    });
  } catch (error) {
    const errors = {
      CART_ITEM_NOT_FOUND: [404, "Cart item not found"],
    };

    const [status, message] = errors[error.message] || [
      500,
      "Internal server error",
    ];

    return res.status(status).json({
      success: false,
      message,
    });
  }
};

module.exports = {
  addToCart,
  getCartDetails,
  confirmCartItemPrice,
  updateCartItem,
  removeCartItem
};
