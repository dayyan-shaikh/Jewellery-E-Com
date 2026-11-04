const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomUUID, timingSafeEqual } = require("node:crypto");
const { pool } = require("../config/db");

const TOKEN_TTL = "30m";
const TOKEN_ISSUER = "jewellery-api";
const BCRYPT_ROUNDS = 12;

class AuthError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 bytes");
  }
  return secret;
}

function publicUser(user) {
  return { id: Number(user.id), name: user.name, email: user.email, role: user.role };
}

function validateCredentials({ name, email, password }, includeName) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    throw new AuthError("Enter a valid email address");
  }
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw new AuthError("Password must be between 8 and 72 bytes");
  }
  let cleanName;
  if (includeName) {
    cleanName = typeof name === "string" ? name.trim() : "";
    if (cleanName.length < 2 || cleanName.length > 120) {
      throw new AuthError("Name must be between 2 and 120 characters");
    }
  }
  return { name: cleanName, email: normalizedEmail, password };
}

async function registerCustomer(input) {
  const { name, email, password } = validateCredentials(input, true);
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'customer')
       RETURNING id, name, email, role`,
      [name, email, passwordHash]
    );
    return publicUser(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") throw new AuthError("An account with this email already exists", 409);
    throw error;
  }
}

function adminBootstrapConfigured() {
  const key = process.env.ADMIN_SETUP_KEY;
  return typeof key === "string" && Buffer.byteLength(key, "utf8") >= 24;
}

async function adminBootstrapStatus() {
  if (!adminBootstrapConfigured()) return { available: false };
  const result = await pool.query("SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin') AS exists");
  return { available: !result.rows[0].exists };
}

async function bootstrapAdmin(input) {
  const { name, email, password } = validateCredentials(input, true);
  if (Buffer.byteLength(password, "utf8") < 12) throw new AuthError("Administrator password must be at least 12 bytes");
  const configuredKey = process.env.ADMIN_SETUP_KEY || "";
  const suppliedKey = typeof input.setupKey === "string" ? input.setupKey : "";
  const expected = Buffer.from(configuredKey, "utf8");
  const supplied = Buffer.from(suppliedKey, "utf8");
  if (expected.length < 24 || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new AuthError("Admin setup is unavailable or the setup key is invalid", 403);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [728261104]);
    const existing = await client.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
    if (existing.rowCount) throw new AuthError("An administrator account already exists; ask an administrator to provision another account", 409);
    const result = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin') RETURNING id, name, email, role`,
      [name, email, passwordHash]
    );
    await client.query("COMMIT");
    return publicUser(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") throw new AuthError("An account with this email already exists", 409);
    throw error;
  } finally {
    client.release();
  }
}

async function createTokenSession(user) {
  const jti = randomUUID();
  const token = jwt.sign(
    { role: user.role }, jwtSecret(),
    { algorithm: "HS256", subject: String(user.id), jwtid: jti, expiresIn: TOKEN_TTL, issuer: TOKEN_ISSUER }
  );
  const decoded = jwt.decode(token);
  await pool.query(
    "INSERT INTO auth_sessions (jti, user_id, expires_at) VALUES ($1, $2, to_timestamp($3))",
    [jti, user.id, decoded.exp]
  );
  return { token, expiresAt: new Date(decoded.exp * 1000).toISOString() };
}

async function login(input) {
  const { email, password } = validateCredentials(input, false);
  const result = await pool.query(
    "SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = $1",
    [email]
  );
  const user = result.rows[0];
  const passwordMatches = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !passwordMatches) throw new AuthError("Invalid email or password", 401);
  if (!user.is_active) throw new AuthError("This account is inactive", 403);
  const session = await createTokenSession(user);
  return { ...session, user: publicUser(user) };
}

async function revokeToken(jti, userId) {
  await pool.query(
    "UPDATE auth_sessions SET revoked_at = NOW() WHERE jti = $1 AND user_id = $2 AND revoked_at IS NULL",
    [jti, userId]
  );
}

async function bindCustomerSession(userId, sessionId) {
  await pool.query(
    "INSERT INTO customer_sessions (session_id, user_id) VALUES ($1, $2) ON CONFLICT (session_id) DO NOTHING",
    [sessionId, userId]
  );
  const result = await pool.query("SELECT user_id FROM customer_sessions WHERE session_id = $1", [sessionId]);
  if (!result.rows.length || Number(result.rows[0].user_id) !== Number(userId)) {
    throw new AuthError("This cart session belongs to another customer", 403);
  }
}

module.exports = { AuthError, TOKEN_ISSUER, adminBootstrapConfigured, adminBootstrapStatus, bindCustomerSession, bootstrapAdmin, jwtSecret, login, publicUser, registerCustomer, revokeToken };
