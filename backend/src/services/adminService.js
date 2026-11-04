const { pool } = require("../config/db");

const METALS = new Set(["GOLD", "SILVER", "PLATINUM"]);
const invalid = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const text = (value, label, max, required = false) => {
  if (value == null && !required) return value;
  if (typeof value !== "string") throw invalid(`${label} must be text`);
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > max) throw invalid(`${label} is required and must be at most ${max} characters`);
  return normalized;
};
const numeric = (value, label, { min = 0, max = 9999999999.99, integer = false } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    throw invalid(`${label} must be between ${min} and ${max}${integer ? " as a whole number" : ""}`);
  }
  return parsed;
};
function productInput(input, { requireVariants = true } = {}) {
  if (!input || typeof input !== "object") throw invalid("Product details are required");
  const name = text(input.name, "Product name", 150, true);
  const description = text(input.description ?? "", "Description", 5000);
  const metalType = String(input.metalType ?? input.metal ?? "").trim().toUpperCase();
  if (!METALS.has(metalType)) throw invalid("Metal must be Gold, Silver, or Platinum");
  const wastagePercentage = numeric(input.wastagePercentage ?? input.wastagePercent, "Wastage percentage", { max: 999.99 });
  const makingChargePerGram = numeric(input.makingChargePerGram, "Making charge per gram");
  const variants = input.variants;
  if (requireVariants && (!Array.isArray(variants) || variants.length === 0)) throw invalid("Add at least one product variant");
  if (variants != null && (!Array.isArray(variants) || variants.length > 100)) throw invalid("Product variants must be a list of at most 100 items");
  const normalizedVariants = (variants || []).map((variant) => ({
    id: variant.id == null || String(variant.id).startsWith("new-") ? null : numeric(variant.id, "Variant id", { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true }),
    sku: text(variant.sku, "SKU", 50, true),
    purity: text(variant.purity, "Purity", 10, true),
    weightGrams: numeric(variant.weightGrams ?? variant.weight_grams, "Weight", { min: 0.001, max: 9999999.999 }),
    stoneCharge: numeric(variant.stoneCharge ?? variant.stone_charge ?? 0, "Stone charge"),
    stockQuantity: numeric(variant.stockQuantity ?? variant.stock ?? variant.stock_quantity, "Stock", { max: 2147483647, integer: true }),
    isActive: variant.isActive !== false,
  }));
  return { name, description, metalType, wastagePercentage, makingChargePerGram, hasStones: Boolean(input.hasStones) || normalizedVariants.some((variant) => variant.stoneCharge > 0), isActive: input.isActive !== false, variants: normalizedVariants };
}

const productSelect = `
  SELECT p.id, p.name, p.description, p.metal_type, p.wastage_percentage,
         p.making_charge_per_gram, p.has_stones, p.is_active,
         pv.id AS variant_id, pv.sku, pv.purity, pv.weight_grams,
         pv.stone_charge, pv.stock_quantity, pv.is_active AS variant_is_active,
         CASE WHEN mr.id IS NULL THEN NULL ELSE ROUND((
           pv.weight_grams * mr.rate_per_gram * (1 + p.wastage_percentage / 100)
           + pv.weight_grams * p.making_charge_per_gram + pv.stone_charge
         ) * 1.03, 2) END AS current_price
  FROM products p
  LEFT JOIN product_variants pv ON pv.product_id = p.id
  LEFT JOIN metal_rates mr ON mr.metal_type = p.metal_type AND mr.purity = pv.purity
  ORDER BY p.id, pv.id`;

function groupProductRows(rows) {
  const products = new Map();
  for (const row of rows) {
    const key = String(row.id);
    let product = products.get(key);
    if (!product) {
      product = {
        id: key, name: row.name, description: row.description || "", metalType: row.metal_type,
        wastagePercentage: Number(row.wastage_percentage), makingChargePerGram: Number(row.making_charge_per_gram),
        hasStones: row.has_stones, isActive: row.is_active, variants: [],
      };
      products.set(key, product);
    }
    if (row.variant_id != null) product.variants.push({
      id: String(row.variant_id), sku: row.sku, purity: row.purity, weightGrams: Number(row.weight_grams),
      stoneCharge: Number(row.stone_charge), stockQuantity: row.stock_quantity, isActive: row.variant_is_active,
      currentPrice: row.current_price == null ? null : Number(row.current_price),
    });
  }
  return [...products.values()];
}

const getAdminProducts = async () => groupProductRows((await pool.query(productSelect)).rows);
const getAdminProduct = async (id) => {
  const query = productSelect.replace("ORDER BY p.id, pv.id", "WHERE p.id = $1 ORDER BY p.id, pv.id");
  const result = await pool.query(query, [id]);
  if (!result.rowCount) throw invalid("Product was not found", 404);
  return groupProductRows(result.rows)[0];
};

async function validateRateRows(client, metalType, variants) {
  for (const variant of variants) {
    const result = await client.query("SELECT 1 FROM metal_rates WHERE metal_type = $1 AND purity = $2", [metalType, variant.purity]);
    if (!result.rowCount) throw invalid(`Add a ${metalType} ${variant.purity} rate before saving this variant`);
  }
}

async function createProduct(input) {
  const product = productInput(input);
  const client = await pool.connect();
  let productId;
  try {
    await client.query("BEGIN");
    await validateRateRows(client, product.metalType, product.variants.filter((variant) => variant.isActive));
    const inserted = await client.query(
      `INSERT INTO products (name, description, metal_type, wastage_percentage, making_charge_per_gram, has_stones, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE) RETURNING id`,
      [product.name, product.description, product.metalType, product.wastagePercentage, product.makingChargePerGram, product.hasStones]
    );
    productId = inserted.rows[0].id;
    for (const variant of product.variants) {
      await client.query(
        `INSERT INTO product_variants (product_id, sku, purity, weight_grams, stone_charge, stock_quantity, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE)`,
        [productId, variant.sku, variant.purity, variant.weightGrams, variant.stoneCharge, variant.stockQuantity]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") throw invalid("That SKU or product already exists", 409);
    throw error;
  } finally { client.release(); }
  return getAdminProduct(productId);
}

async function updateProduct(id, input) {
  const productId = numeric(id, "Product id", { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true });
  const product = productInput(input);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query("SELECT id, metal_type FROM products WHERE id=$1 FOR UPDATE", [productId]);
    if (!current.rowCount) throw invalid("Product was not found", 404);
    const existingRows = await client.query("SELECT id, purity, is_active FROM product_variants WHERE product_id=$1", [productId]);
    const existingById = new Map(existingRows.rows.map((row) => [String(row.id), row]));
    const requiresRate = product.variants.filter((variant) => {
      const existing = variant.id ? existingById.get(String(variant.id)) : null;
      if (variant.id && !existing) throw invalid("A variant does not belong to this product");
      return variant.isActive && (!existing || !existing.is_active || current.rows[0].metal_type !== product.metalType || existing.purity !== variant.purity);
    });
    await validateRateRows(client, product.metalType, requiresRate);
    await client.query(
      `UPDATE products SET name=$2, description=$3, metal_type=$4, wastage_percentage=$5,
       making_charge_per_gram=$6, has_stones=$7, is_active=$8, updated_at=NOW() WHERE id=$1`,
      [productId, product.name, product.description, product.metalType, product.wastagePercentage, product.makingChargePerGram, product.hasStones, product.isActive]
    );
    const existingIds = new Set(existingById.keys());
    for (const variant of product.variants) {
      if (variant.id && !existingIds.has(String(variant.id))) throw invalid("A variant does not belong to this product");
      if (variant.id) {
        await client.query(
          `UPDATE product_variants SET sku=$2, purity=$3, weight_grams=$4, stone_charge=$5, stock_quantity=$6, is_active=$8
           WHERE id=$1 AND product_id=$7`,
          [variant.id, variant.sku, variant.purity, variant.weightGrams, variant.stoneCharge, variant.stockQuantity, productId, variant.isActive]
        );
      } else {
        await client.query(
          `INSERT INTO product_variants (product_id, sku, purity, weight_grams, stone_charge, stock_quantity, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [productId, variant.sku, variant.purity, variant.weightGrams, variant.stoneCharge, variant.stockQuantity, variant.isActive]
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") throw invalid("That SKU or product already exists", 409);
    throw error;
  } finally { client.release(); }
  return getAdminProduct(productId);
}

async function getAdminRates() {
  const result = await pool.query("SELECT id, metal_type, purity, rate_per_gram, currency, source, updated_at FROM metal_rates ORDER BY metal_type, purity");
  return result.rows.map((row) => ({ id: String(row.id), metalType: row.metal_type, purity: row.purity, ratePerGram: Number(row.rate_per_gram), currency: row.currency, source: row.source, updatedAt: row.updated_at }));
}

async function createMetalRate(input) {
  const metalType = String(input?.metalType ?? input?.metal_type ?? "").trim().toUpperCase();
  if (!METALS.has(metalType)) throw invalid("Metal must be Gold, Silver, or Platinum");
  const purity = text(input.purity, "Purity", 10, true);
  const rate = numeric(input.ratePerGram, "Rate per gram", { min: 0.01 });
  const currency = input.currency == null ? "INR" : text(input.currency, "Currency", 3, true).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw invalid("Currency must be a three-letter code");
  try {
    const result = await pool.query(
      `INSERT INTO metal_rates (metal_type, purity, rate_per_gram, currency, source)
       VALUES ($1,$2,$3,$4,'ADMIN')
       RETURNING id, metal_type, purity, rate_per_gram, currency, source, updated_at`,
      [metalType, purity, rate, currency]
    );
    const row = result.rows[0];
    return { id: String(row.id), metalType: row.metal_type, purity: row.purity, ratePerGram: Number(row.rate_per_gram), currency: row.currency, source: row.source, updatedAt: row.updated_at };
  } catch (error) {
    if (error.code === "23505") throw invalid("A rate already exists for this metal and purity", 409);
    throw error;
  }
}

async function updateMetalRate(id, ratePerGram) {
  const rateId = numeric(id, "Rate id", { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true });
  const rate = numeric(ratePerGram, "Rate per gram", { min: 0.01 });
  const result = await pool.query(
    `UPDATE metal_rates SET rate_per_gram=$2, source='ADMIN', updated_at=NOW()
     WHERE id=$1 RETURNING id, metal_type, purity, rate_per_gram, currency, source, updated_at`,
    [rateId, rate]
  );
  if (!result.rowCount) throw invalid("Metal rate was not found", 404);
  const row = result.rows[0];
  return { id: String(row.id), metalType: row.metal_type, purity: row.purity, ratePerGram: Number(row.rate_per_gram), currency: row.currency, source: row.source, updatedAt: row.updated_at };
}

async function getAdminOrders() {
  const result = await pool.query(`
    SELECT o.id, o.total_amount, o.status, o.created_at,
      u.name AS customer_name, u.email AS customer_email,
      COUNT(oi.id)::INTEGER AS item_count,
      COALESCE(json_agg(json_build_object('productName', oi.product_name, 'quantity', oi.quantity, 'total', oi.total_price)) FILTER (WHERE oi.id IS NOT NULL), '[]'::json) AS items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id=o.id
    LEFT JOIN customer_sessions cs ON cs.session_id=o.session_id
    LEFT JOIN users u ON u.id=cs.user_id
    GROUP BY o.id, u.name, u.email
    ORDER BY o.created_at DESC`);
  return result.rows.map((row) => ({ id: String(row.id), totalAmount: Number(row.total_amount), status: row.status, createdAt: row.created_at, customerName: row.customer_name, customerEmail: row.customer_email, itemCount: row.item_count, items: row.items }));
}

async function getDashboardSummary() {
  const [products, variants, rates, orders] = await Promise.all([
    pool.query("SELECT COUNT(*)::INTEGER AS total, COUNT(*) FILTER (WHERE is_active)::INTEGER AS active FROM products"),
    pool.query("SELECT COUNT(*) FILTER (WHERE pv.is_active AND p.is_active)::INTEGER AS total, COALESCE(SUM(pv.stock_quantity) FILTER (WHERE pv.is_active AND p.is_active),0)::INTEGER AS stock, COUNT(*) FILTER (WHERE pv.is_active AND p.is_active AND pv.stock_quantity <= 2)::INTEGER AS low_stock FROM product_variants pv JOIN products p ON p.id=pv.product_id"),
    pool.query("SELECT COUNT(*)::INTEGER AS total FROM metal_rates"),
    pool.query("SELECT COUNT(*)::INTEGER AS total, COALESCE(SUM(total_amount),0)::NUMERIC AS value FROM orders"),
  ]);
  return { products: products.rows[0], variants: variants.rows[0], rates: rates.rows[0], orders: orders.rows[0] };
}

module.exports = { createMetalRate, createProduct, getAdminOrders, getAdminProduct, getAdminProducts, getAdminRates, getDashboardSummary, updateMetalRate, updateProduct };
