const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const bcrypt = require("bcryptjs");
const { pool } = require("../src/config/db");

async function run() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!name || !email || !password) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in the process environment before provisioning");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Use a valid email and an admin password between 12 and 72 bytes");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'admin', TRUE)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       role = 'admin',
       is_active = TRUE,
       updated_at = NOW()`,
    [name, email, passwordHash]
  );
  console.log(`Admin account provisioned for ${email}`);
}

run().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
