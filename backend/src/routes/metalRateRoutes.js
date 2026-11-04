const express = require("express");

const router = express.Router();

const {
  getMetalRates,
} = require("../controllers/metalRateController");

router.get("/", getMetalRates);

module.exports = router;