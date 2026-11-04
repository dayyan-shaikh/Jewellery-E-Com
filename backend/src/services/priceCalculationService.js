const { pool } = require("../config/db");
const Decimal = require("decimal.js");

const calculateProductPrice = async (variantId) => {
  // Fetch product, variant and matching metal rate
  const query = `
    SELECT
      p.id AS product_id,
      p.name,
      p.metal_type,
      p.wastage_percentage,
      p.making_charge_per_gram,

      pv.id AS variant_id,
      pv.sku,
      pv.purity,
      pv.weight_grams,
      pv.stone_charge,
      pv.stock_quantity,

      mr.id AS metal_rate_id,
      mr.rate_per_gram,
      mr.currency

    FROM product_variants pv

    JOIN products p
      ON p.id = pv.product_id

    JOIN metal_rates mr
      ON mr.metal_type = p.metal_type
      AND mr.purity = pv.purity

    WHERE pv.id = $1
      AND pv.is_active = TRUE
      AND p.is_active = TRUE;
  `;

  const result = await pool.query(query, [variantId]);

  if (result.rows.length === 0) {
    throw new Error("Product variant or matching metal rate not found");
  }

  const product = result.rows[0];

  // Convert values into Decimal objects
  const weight = new Decimal(product.weight_grams);
  const rate = new Decimal(product.rate_per_gram);
  const wastagePercentage = new Decimal(product.wastage_percentage);
  const makingRate = new Decimal(product.making_charge_per_gram);
  const stoneCharge = new Decimal(product.stone_charge || 0);

  // 1. Metal cost
  const metalCost = weight.mul(rate);

  // 2. Wastage amount
  const wastageAmount = metalCost
    .mul(wastagePercentage)
    .div(100);

  // 3. Making charges
  const makingCharge = weight.mul(makingRate);

  // 4. Subtotal
  const subtotal = metalCost
    .plus(wastageAmount)
    .plus(makingCharge)
    .plus(stoneCharge);

  // 5. GST (3%)
  const gstAmount = subtotal.mul(3).div(100);

  // 6. Final price
  const totalPrice = subtotal.plus(gstAmount);

  // Round monetary components to 2 decimal places
  const money = (value) => value.toDecimalPlaces(2).toFixed(2);

  return {
    product: {
      id: product.product_id,
      name: product.name,
      variant_id: product.variant_id,
      sku: product.sku,
      metal_type: product.metal_type,
      purity: product.purity,
      weight_grams: weight.toString(),
      stock_quantity: product.stock_quantity,
    },

    price_breakdown: {
      metal_rate_id: product.metal_rate_id,
      rate_per_gram: money(rate),
      metal_cost: money(metalCost),
      wastage_percentage: money(wastagePercentage),
      wastage_amount: money(wastageAmount),
      making_charge: money(makingCharge),
      stone_charge: money(stoneCharge),
      subtotal: money(subtotal),
      gst_percentage: "3.00",
      gst_amount: money(gstAmount),
      total_price: money(totalPrice),
      currency: product.currency,
    },
  };
};

module.exports = {
  calculateProductPrice,
};