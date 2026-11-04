
const express = require("express");
const router = express.Router();

const {
  addToCart,
  getCartDetails,
  confirmCartItemPrice,
    updateCartItem,
    removeCartItem
} = require("../controllers/cartController");

router.post("/items", addToCart);

router.get("/", getCartDetails);

router.post(
  "/items/:id/confirm-price",
  confirmCartItemPrice
);

router.patch("/items/:id", updateCartItem);

router.delete("/items/:id", removeCartItem);

module.exports = router;
