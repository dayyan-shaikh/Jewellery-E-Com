const { Pool } = require("pg");
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../../.env.local") });
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error);
});

const connectDB = async () => {
  try {
    const result = await pool.query("SELECT NOW()");

    console.log("PostgreSQL connected successfully");
    console.log("Database time:", result.rows[0].now);
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
    throw error;
  }
};

module.exports = { pool, connectDB };
