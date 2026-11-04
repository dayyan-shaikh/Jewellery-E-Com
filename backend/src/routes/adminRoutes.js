const express = require("express");
const { createMetalRate, createProduct, getAdminAccess, getDashboardSummary, getMetalRates, getOrders, getProducts, updateMetalRate, updateProduct } = require("../controllers/adminController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateToken, authorizeRoles("admin"));
router.get("/access", getAdminAccess);
router.get("/summary", getDashboardSummary);
router.get("/products", getProducts);
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.get("/metal-rates", getMetalRates);
router.post("/metal-rates", createMetalRate);
router.patch("/metal-rates/:id", updateMetalRate);
router.get("/orders", getOrders);

module.exports = router;
