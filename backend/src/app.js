const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Database connection
const { connectDB } = require("./config/db");

// Import routes
const metalRateRoutes = require("./routes/metalRateRoutes");
const productRoutes = require("./routes/productRoutes");
const priceCalculationRoutes = require("./routes/priceCalculationRoutes");
const priceLockRoutes = require("./routes/priceLockRoutes");
const cartRoutes = require("./routes/cartRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Register API routes
app.use("/api/metal-rates", metalRateRoutes);
app.use("/api/products", productRoutes);
app.use("/api/pricing", priceCalculationRoutes);
app.use("/api/price-locks", priceLockRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);

// Health check API
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Jewellery API is running",
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();