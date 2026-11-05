const adminService = require("../services/adminService");
const metalRateService = require("../services/metalRateService");

const getAdminAccess = (req, res) => res.status(200).json({
  success: true,
  data: { allowed: true, user: req.user },
});

const respond = (handler) => async (req, res) => {
  try {
    const data = await handler(req);
    return res.status(data?.status || 200).json({ success: true, ...(data?.count != null ? { count: data.count } : {}), data: data?.body ?? data });
  } catch (error) {
    const status = error.statusCode || (error.code === "23505" ? 409 : 500);
    return res.status(status).json({ success: false, message: status === 500 ? "Admin request failed" : error.message });
  }
};

const getDashboardSummary = respond(() => adminService.getDashboardSummary());
const getProducts = respond(() => adminService.getAdminProducts());
const createProduct = respond(async (req) => ({ status: 201, body: await adminService.createProduct(req.body) }));
const updateProduct = respond((req) => adminService.updateProduct(req.params.id, req.body));
const getMetalRates = respond(() => adminService.getAdminRates());
const getMetalRateHistory = respond((req) => metalRateService.getMetalRateHistory(req.query.limit));
const getOrders = respond(() => adminService.getAdminOrders());

module.exports = { createProduct, getAdminAccess, getDashboardSummary, getMetalRateHistory, getMetalRates, getOrders, getProducts, updateProduct };
