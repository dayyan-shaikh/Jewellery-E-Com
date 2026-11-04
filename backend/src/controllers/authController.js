const { AuthError, adminBootstrapStatus, bootstrapAdmin, login, publicUser, registerCustomer, revokeToken } = require("../services/authService");

const adminSetupStatus = async (req, res) => {
  try { return res.status(200).json({ success: true, data: await adminBootstrapStatus() }); }
  catch { return res.status(500).json({ success: false, message: "Could not check admin setup availability" }); }
};

const createFirstAdmin = async (req, res) => {
  try {
    const user = await bootstrapAdmin(req.body || {});
    return res.status(201).json({ success: true, data: { user } });
  } catch (error) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return res.status(status).json({ success: false, message: error instanceof AuthError ? error.message : "Could not create administrator account" });
  }
};

const register = async (req, res) => {
  try {
    const user = await registerCustomer(req.body || {});
    return res.status(201).json({ success: true, data: { user } });
  } catch (error) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return res.status(status).json({ success: false, message: error instanceof AuthError ? error.message : "Could not register account" });
  }
};

const loginUser = async (req, res) => {
  try {
    const session = await login(req.body || {});
    return res.status(200).json({ success: true, data: session });
  } catch (error) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return res.status(status).json({ success: false, message: error instanceof AuthError ? error.message : "Could not sign in" });
  }
};

const me = (req, res) => res.status(200).json({ success: true, data: { user: publicUser(req.user) } });

const logout = async (req, res) => {
  try {
    await revokeToken(req.authJti, req.user.id);
    return res.status(200).json({ success: true, message: "Signed out" });
  } catch {
    return res.status(500).json({ success: false, message: "Could not sign out" });
  }
};

const claimCustomerSession = (req, res) => res.status(200).json({ success: true, data: { sessionId: req.customerSessionId } });

module.exports = { adminSetupStatus, claimCustomerSession, createFirstAdmin, login: loginUser, logout, me, register };
