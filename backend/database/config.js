// =========================
// Imports
// =========================
const { Pool } = require("pg");

// =========================
// Pool Creation
// =========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// =========================
// Export
// =========================
module.exports = pool;
