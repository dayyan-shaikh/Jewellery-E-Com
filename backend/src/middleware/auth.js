const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const { AuthError, TOKEN_ISSUER, bindCustomerSession, jwtSecret, publicUser } = require("../services/authService");

async function authenticateToken(req, res, next) {
  try {
    const [scheme, token] = (req.get("authorization") || "").split(" ");
    if (scheme !== "Bearer" || !token) throw new AuthError("Authentication required", 401);
    const claims = jwt.verify(token, jwtSecret(), { algorithms: ["HS256"], issuer: TOKEN_ISSUER });
    const userId = Number(claims.sub);
    if (!Number.isSafeInteger(userId) || userId < 1 || !claims.jti || !["customer", "admin"].includes(claims.role)) {
      throw new AuthError("Invalid authentication token", 401);
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active
       FROM users u
       JOIN auth_sessions s ON s.user_id = u.id
       WHERE u.id = $1 AND s.jti = $2 AND s.revoked_at IS NULL
         AND s.expires_at > NOW()`,
      [userId, claims.jti]
    );
    const user = result.rows[0];
    if (!user || !user.is_active || user.role !== claims.role) {
      throw new AuthError("Authentication token is no longer valid", 401);
    }
    req.user = publicUser(user);
    req.authJti = claims.jti;
    next();
  } catch (error) {
    const authError = error instanceof AuthError
      ? error
      : new AuthError(error.name === "TokenExpiredError" ? "Authentication token has expired" : "Invalid authentication token", 401);
    res.status(authError.statusCode).json({ success: false, message: authError.message });
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, message: "You do not have permission to access this resource" });
    next();
  };
}

async function bindCustomerCartSession(req, res, next) {
  try {
    const sessionId = req.get("x-session-id");
    if (!sessionId || sessionId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      throw new AuthError("Valid x-session-id header is required", 400);
    }
    await bindCustomerSession(req.user.id, sessionId);
    req.customerSessionId = sessionId;
    next();
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: statusCode === 500 ? "Could not validate customer session" : error.message });
  }
}

module.exports = { authenticateToken, authorizeRoles, bindCustomerCartSession };
