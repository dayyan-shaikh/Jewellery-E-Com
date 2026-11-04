const express = require("express");
const cors = require("cors");
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Database connection
const { connectDB } = require("./config/db");

// Import routes
const metalRateRoutes = require("./routes/metalRateRoutes");
const productRoutes = require("./routes/productRoutes");
const priceCalculationRoutes = require("./routes/priceCalculationRoutes");
const priceLockRoutes = require("./routes/priceLockRoutes");
const cartRoutes = require("./routes/cartRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { jwtSecret } = require("./services/authService");

const app = express();

// Middlewares
const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174")
    .split(",").map((origin) => origin.trim()).filter(Boolean)
);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  // Product edits use PUT; omitting it lets OPTIONS return 204 while the
  // browser blocks the actual update request.
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-session-id", "Idempotency-Key"],
  credentials: false,
  maxAge: 600,
}));
app.use(express.json());

// Register API routes
app.use("/api/metal-rates", metalRateRoutes);
app.use("/api/products", productRoutes);
app.use("/api/pricing", priceCalculationRoutes);
app.use("/api/price-locks", priceLockRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

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
    jwtSecret();
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

if (require.main === module) startServer();

module.exports = { app, startServer };
