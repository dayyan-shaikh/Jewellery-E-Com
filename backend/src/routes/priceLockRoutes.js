const express = require("express");
const router = express.Router();

const {
  createPriceLock,
  getPriceLock,
  refreshPriceLock,
  confirmPriceLock
} = require("../controllers/priceLockController");


router.post("/", createPriceLock);
router.get("/:id", getPriceLock);
router.post("/:id/refresh", refreshPriceLock);
router.post("/:id/confirm", confirmPriceLock);

module.exports = router;