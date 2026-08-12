/**
 * Proyecto: Sistema de Gestión de Solicitudes de Difusión — COMSOC Tlahuelilpan
 * Autores: Eick Trejo Resendiz, Alexis Blas Castillo
 * Universidad Tecnológica de Tula-Tepeji
 *
 * Este software fue desarrollado durante el cuatrimestre mayo-agosto 2026
 * en la asignatura de Integradora / Proyecto de Vinculación (ajustar al
 * nombre exacto de la asignatura).
 *
 * Los derechos morales pertenecen a sus autores.
 * Queda prohibida la eliminación de los créditos originales y el uso o
 * modificación del código sin autorización de los autores.
 */

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || "comsoc_app",
  password: process.env.PGPASSWORD || "comsoc_dev_2026",
  database: process.env.PGDATABASE || "comsoc_tlahuelilpan",
});

module.exports = pool;
