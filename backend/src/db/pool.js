const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || "comsoc_app",
  password: process.env.PGPASSWORD || "comsoc_dev_2026",
  database: process.env.PGDATABASE || "comsoc_tlahuelilpan",
});

module.exports = pool;
