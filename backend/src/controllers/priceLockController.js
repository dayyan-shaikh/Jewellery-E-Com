const priceLockService = require("../services/priceLockService");

const createPriceLock = async (req, res) => {
  try {
    const { variantId } = req.body;
    const sessionId = req.customerSessionId || req.get("x-session-id");

    // Validate session ID
    if (
      !sessionId ||
      sessionId.length > 100 ||
      !/^[a-zA-Z0-9_-]+$/.test(sessionId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid session ID is required",
      });
    }

    // Validate variant ID
    if (
      !Number.isSafeInteger(variantId) ||
      variantId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid variantId is required",
      });
    }

    const result = await priceLockService.createPriceLock(
      sessionId,
      variantId
    );

    return res.status(201).json({
      success: true,
      message: "Price locked successfully for 10 minutes",
      data: result,
    });

  } catch (error) {
    console.error("Price lock error:", error.message);

    if (
      error.message ===
      "Product variant or matching metal rate not found"
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create price lock",
    });
  }
};

const getPriceLock = async (req, res) => {
  try {
    const { id } = req.params;
    const sessionId = req.customerSessionId || req.get("x-session-id");

    if (!/^\d+$/.test(id) || Number(id) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid lock ID",
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    const lock = await priceLockService.getPriceLockById(
      id,
      sessionId
    );

    if (!lock) {
      return res.status(404).json({
        success: false,
        message: "Price lock not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...lock,
        is_active: lock.status === "ACTIVE",
      },
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch price lock",
    });
  }
};

const refreshPriceLock = async (req, res) => {
  try {
    const { id } = req.params;
    const sessionId = req.customerSessionId || req.get("x-session-id");

    if (!/^\d+$/.test(id) || Number(id) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid lock ID"
      });
    }

    if (
      !sessionId ||
      sessionId.length > 100 ||
      !/^[a-zA-Z0-9_-]+$/.test(sessionId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid session ID is required"
      });
    }

    const result = await priceLockService.refreshPriceLock(
      id,
      sessionId
    );

    return res.status(200).json({
      success: true,
      message: result.requires_confirmation
        ? "Price increased. Customer confirmation required."
        : "Price refreshed successfully.",
      data: result
    });

  } catch (error) {
    console.error("Price refresh error:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to refresh price"
    });
  }
};

const confirmPriceLock = async (req, res) => {
  try {
    const { id } = req.params;
    const sessionId = req.customerSessionId || req.get("x-session-id");

    if (!/^\d+$/.test(id) || Number(id) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid lock ID"
      });
    }

    if (
      !sessionId ||
      sessionId.length > 100 ||
      !/^[a-zA-Z0-9_-]+$/.test(sessionId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid session ID is required"
      });
    }

    const lock = await priceLockService.confirmPriceLock(
      id,
      sessionId
    );

    if (!lock) {
      return res.status(409).json({
        success: false,
        message: "Price lock expired or confirmation is not allowed"
      });
    }

    return res.status(200).json({
      success: true,
      message: "New price accepted successfully",
      data: lock
    });

  } catch (error) {
    console.error("Price confirmation error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to confirm price"
    });
  }
};

module.exports = {
  createPriceLock,
    getPriceLock,
    refreshPriceLock,
    confirmPriceLock
};
