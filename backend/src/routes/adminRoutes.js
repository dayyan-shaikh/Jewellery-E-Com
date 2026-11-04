const express = require("express");
const { getAdminAccess } = require("../controllers/adminController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
router.get("/access", authenticateToken, authorizeRoles("admin"), getAdminAccess);

module.exports = router;
