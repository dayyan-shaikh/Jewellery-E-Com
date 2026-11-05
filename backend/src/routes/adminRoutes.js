const express = require("express");
const { createProduct, getAdminAccess, getDashboardSummary, getMetalRateHistory, getMetalRates, getOrders, getProducts, updateProduct } = require("../controllers/adminController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateToken, authorizeRoles("admin"));
router.get("/access", getAdminAccess);
router.get("/summary", getDashboardSummary);
router.get("/products", getProducts);
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.get("/metal-rates", getMetalRates);
router.get("/metal-rates/history", getMetalRateHistory);
router.get("/orders", getOrders);

module.exports = router;
