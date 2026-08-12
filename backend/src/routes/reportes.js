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

const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /reportes/mensual?anio=2026&mes=8  (RF10 - modulo de reportes)
router.get("/mensual", requireAuth(["Administrador"]), async (req, res) => {
  const anio = parseInt(req.query.anio, 10) || new Date().getFullYear();
  const mes = parseInt(req.query.mes, 10) || new Date().getMonth() + 1;
  try {
    const { rows } = await pool.query("SELECT * FROM sp_reporte_mensual($1,$2)", [anio, mes]);

    const topDirecciones = await pool.query(
      `SELECT d.nombre, COUNT(*) AS total
       FROM solicitud s JOIN direccion d ON d.id_direccion = s.id_direccion
       WHERE EXTRACT(YEAR FROM s.fecha_creacion)=$1 AND EXTRACT(MONTH FROM s.fecha_creacion)=$2
       GROUP BY d.nombre ORDER BY total DESC LIMIT 3`,
      [anio, mes]
    );

    res.json({ periodo: `${anio}-${String(mes).padStart(2, "0")}`, resumen: rows[0], top_direcciones: topDirecciones.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "error al generar el reporte" });
  }
});

module.exports = router;
