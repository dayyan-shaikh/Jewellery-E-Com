const priceCalculationService = require("../services/priceCalculationService");

const calculatePrice = async (req, res) => {
  try {
    const { variantId } = req.body;

    if (!Number.isSafeInteger(variantId) || variantId <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid variantId is required",
      });
    }

    const price = await priceCalculationService.calculateProductPrice(
      variantId
    );

    return res.status(200).json({
      success: true,
      message: "Price calculated successfully",
      data: price,
    });

  } catch (error) {
    console.error("Price calculation error:", error.message);

    if (error.message === "Product variant or matching metal rate not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to calculate product price",
    });
  }
};

module.exports = {
  calculatePrice,
};