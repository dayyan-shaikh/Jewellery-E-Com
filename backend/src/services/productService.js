const { pool } = require("../config/db");

const getAllProducts = async () => {
  const query = `
    SELECT
      p.id,
      p.name,
      p.description,
      p.metal_type,
      p.wastage_percentage,
      p.making_charge_per_gram,
      p.has_stones,
      pv.id AS variant_id,
      pv.sku,
      pv.purity,
      pv.weight_grams,
      pv.stone_charge,
      pv.stock_quantity
    FROM products p
    LEFT JOIN product_variants pv
      ON p.id = pv.product_id
      AND pv.is_active = TRUE
    WHERE p.is_active = TRUE
    ORDER BY p.id;
  `;

  const result = await pool.query(query);

  return result.rows;
};

const getProductById = async (productId) => {
  const query = `
    SELECT
      p.id,
      p.name,
      p.description,
      p.metal_type,
      p.wastage_percentage,
      p.making_charge_per_gram,
      p.has_stones,
      pv.id AS variant_id,
      pv.sku,
      pv.purity,
      pv.weight_grams,
      pv.stone_charge,
      pv.stock_quantity
    FROM products p
    LEFT JOIN product_variants pv
      ON p.id = pv.product_id
      AND pv.is_active = TRUE
    WHERE p.id = $1
      AND p.is_active = TRUE
    ORDER BY pv.id;
  `;

  const result = await pool.query(query, [productId]);

  return result.rows;
};

module.exports = {
  getAllProducts,
  getProductById,
};