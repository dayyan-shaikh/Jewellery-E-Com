const express = require("express");
const router = express.Router();

const {
  checkout,
} = require("../controllers/checkoutController");
const { authenticateToken, authorizeRoles, bindCustomerCartSession } = require("../middleware/auth");

router.use(authenticateToken, authorizeRoles("customer"), bindCustomerCartSession);

router.post("/", checkout);

module.exports = router;
