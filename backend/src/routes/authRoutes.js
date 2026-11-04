const express = require("express");
const { adminSetupStatus, claimCustomerSession, createFirstAdmin, login, logout, me, register } = require("../controllers/authController");
const { authenticateToken, authorizeRoles, bindCustomerCartSession } = require("../middleware/auth");

const router = express.Router();
router.post("/register", register);
router.get("/admin/setup-status", adminSetupStatus);
router.post("/admin/bootstrap", createFirstAdmin);
router.post("/login", login);
router.get("/me", authenticateToken, me);
router.post("/logout", authenticateToken, logout);
router.post("/session/claim", authenticateToken, authorizeRoles("customer"), bindCustomerCartSession, claimCustomerSession);

module.exports = router;
