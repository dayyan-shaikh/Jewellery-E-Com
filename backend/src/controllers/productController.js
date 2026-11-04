const productService = require("../services/productService");

const getAllProducts = async (req, res) => {
  try {
    const products = await productService.getAllProducts();

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id) || Number(id) < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const products = await productService.getProductById(id);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product: {
        id: products[0].id,
        name: products[0].name,
        description: products[0].description,
        metal_type: products[0].metal_type,
        wastage_percentage: products[0].wastage_percentage,
        making_charge_per_gram: products[0].making_charge_per_gram,
        has_stones: products[0].has_stones,
        variants: products.map((item) => ({
          id: item.variant_id,
          sku: item.sku,
          purity: item.purity,
          weight_grams: item.weight_grams,
          stone_charge: item.stone_charge,
          stock_quantity: item.stock_quantity,
        })).filter((variant) => variant.id !== null),
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
};