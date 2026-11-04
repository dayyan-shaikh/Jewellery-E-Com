const { pool } = require("../config/db");

const getAllMetalRates = async () => {
  const query = `
    SELECT
      id,
      metal_type,
      purity,
      rate_per_gram,
      currency,
      source,
      updated_at
    FROM metal_rates
    ORDER BY metal_type, purity;
  `;

  const result = await pool.query(query);

  return result.rows;
};

module.exports = {
  getAllMetalRates,
};