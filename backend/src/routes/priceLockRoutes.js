const express = require("express");
const router = express.Router();

const {
  createPriceLock,
  getPriceLock,
  refreshPriceLock,
  confirmPriceLock
} = require("../controllers/priceLockController");
const { authenticateToken, authorizeRoles, bindCustomerCartSession } = require("../middleware/auth");

router.use(authenticateToken, authorizeRoles("customer"), bindCustomerCartSession);

router.post("/", createPriceLock);
router.get("/:id", getPriceLock);
router.post("/:id/refresh", refreshPriceLock);
router.post("/:id/confirm", confirmPriceLock);

module.exports = router;
