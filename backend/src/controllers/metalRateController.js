const metalRateService = require("../services/metalRateService");

const getMetalRates = async (req, res) => {
  try {
    const rates = await metalRateService.getAllMetalRates();

    return res.status(200).json({
      success: true,
      count: rates.length,
      rates,
    });
  } catch (error) {
    console.error("Get metal rates error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch metal rates",
    });
  }
};

module.exports = {
  getMetalRates,
};