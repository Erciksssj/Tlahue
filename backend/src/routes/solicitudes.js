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
const notifications = require("../services/notifications");

const router = express.Router();

const REQUIRED_FIELDS = ["nombre_evento", "fecha_evento", "hora_evento", "lugar", "texto_sugerido", "id_direccion", "contacto_nombre", "contacto_correo"];
const ALLOWED_TRANSITIONS = {
  "Recibida": ["En diseno", "Rechazada"],
  "En diseno": ["Publicada", "Rechazada"],
  "Publicada": [],
  "Rechazada": [],
};

// POST /solicitudes  (RF01, RF02, RF03 - registro + validacion + folio automatico)
router.post("/", async (req, res) => {
  const body = req.body;
  const faltantes = REQUIRED_FIELDS.filter((f) => !body[f]);
  if (faltantes.length > 0) {
    return res.status(400).json({ error: "campos obligatorios faltantes", campos: faltantes });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO solicitud (nombre_evento, fecha_evento, hora_evento, lugar, texto_sugerido, id_direccion, id_usuario_registro, contacto_nombre, contacto_correo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id_solicitud, folio, estatus, fecha_creacion`,
      [body.nombre_evento, body.fecha_evento, body.hora_evento, body.lugar, body.texto_sugerido, body.id_direccion, body.id_usuario_registro || null, body.contacto_nombre, body.contacto_correo]
    );
    if (body.adjunto_url) {
      await pool.query(
        "INSERT INTO adjunto (url_archivo, tipo, id_solicitud) VALUES ($1,$2,$3)",
        [body.adjunto_url, body.adjunto_tipo || "imagen", rows[0].id_solicitud]
      );
    }
    // RF04: confirmacion automatica al solicitante
    const notif = await notifications.notificarConfirmacionSolicitud({
      folio: rows[0].folio,
      nombre_evento: body.nombre_evento,
      contacto_nombre: body.contacto_nombre,
      contacto_correo: body.contacto_correo,
    });
    res.status(201).json({ mensaje: "solicitud registrada", solicitud: rows[0], notificacion: notif });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "error al registrar la solicitud" });
  }
});

// GET /solicitudes  (RF05 - panel de control, protegido para Administrador)
router.get("/", requireAuth(["Administrador"]), async (req, res) => {
  const { estatus } = req.query;
  try {
    const params = [];
    let sql = `SELECT s.*, d.nombre AS direccion_nombre, d.correo_contacto
               FROM solicitud s JOIN direccion d ON d.id_direccion = s.id_direccion`;
    if (estatus) {
      params.push(estatus);
      sql += ` WHERE s.estatus = $1`;
    }
    sql += " ORDER BY s.fecha_creacion DESC";
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "error al consultar solicitudes" });
  }
});

// GET /solicitudes/id/:id  (detalle completo con historial, para la pantalla de detalle - RF09)
router.get("/id/:id", requireAuth(["Administrador"]), async (req, res) => {
  try {
    const sol = await pool.query(
      `SELECT s.*, d.nombre AS direccion_nombre
       FROM solicitud s JOIN direccion d ON d.id_direccion = s.id_direccion
       WHERE s.id_solicitud = $1`,
      [req.params.id]
    );
    if (sol.rows.length === 0) return res.status(404).json({ error: "solicitud no encontrada" });

    const hist = await pool.query(
      `SELECT estatus_anterior, estatus_nuevo, comentario, fecha_cambio
       FROM historial_estatus WHERE id_solicitud = $1 ORDER BY fecha_cambio ASC`,
      [req.params.id]
    );
    const adj = await pool.query("SELECT url_archivo, tipo FROM adjunto WHERE id_solicitud = $1", [req.params.id]);

    res.json({ ...sol.rows[0], historial: hist.rows, adjuntos: adj.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "error al consultar el detalle de la solicitud" });
  }
});

// GET /solicitudes/:folio  (RF08 - consulta publica por folio, sin autenticacion)
router.get("/:folio", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.folio, s.nombre_evento, s.estatus, s.fecha_creacion, s.contacto_nombre, d.nombre AS direccion_nombre
       FROM solicitud s JOIN direccion d ON d.id_direccion = s.id_direccion
       WHERE s.folio = $1`,
      [req.params.folio]
    );
    if (rows.length === 0) return res.status(404).json({ error: "folio no encontrado" });

    const hist = await pool.query(
      `SELECT estatus_anterior, estatus_nuevo, comentario, fecha_cambio
       FROM historial_estatus h JOIN solicitud s ON s.id_solicitud = h.id_solicitud
       WHERE s.folio = $1 ORDER BY fecha_cambio DESC LIMIT 1`,
      [req.params.folio]
    );
    res.json({ ...rows[0], ultimo_cambio: hist.rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "error al consultar el folio" });
  }
});

// PATCH /solicitudes/:id/estatus  (RF06, RF07 - cambio de estatus + notificacion)
router.patch("/:id/estatus", requireAuth(["Administrador"]), async (req, res) => {
  const { estatus, comentario } = req.body;
  try {
    const actual = await pool.query(
      "SELECT estatus, folio, nombre_evento, contacto_nombre, contacto_correo FROM solicitud WHERE id_solicitud=$1",
      [req.params.id]
    );
    if (actual.rows.length === 0) return res.status(404).json({ error: "solicitud no encontrada" });

    const solicitud = actual.rows[0];
    const estatusActual = solicitud.estatus;
    const permitidos = ALLOWED_TRANSITIONS[estatusActual] || [];
    if (!permitidos.includes(estatus)) {
      return res.status(422).json({
        error: `transicion no permitida: ${estatusActual} -> ${estatus}`,
        permitidos,
      });
    }

    await pool.query("UPDATE solicitud SET estatus=$1 WHERE id_solicitud=$2", [estatus, req.params.id]);
    if (comentario) {
      await pool.query(
        `UPDATE historial_estatus SET comentario=$1
         WHERE id_historial = (SELECT id_historial FROM historial_estatus WHERE id_solicitud=$2 ORDER BY fecha_cambio DESC LIMIT 1)`,
        [comentario, req.params.id]
      );
    }

    // RF07: notificacion automatica al solicitante por cada cambio de estatus
    const notif = await notifications.notificarCambioEstatus(solicitud, estatus, comentario);

    res.json({ mensaje: `estatus actualizado a ${estatus}`, notificacion: notif });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "error al actualizar el estatus" });
  }
});

module.exports = router;
