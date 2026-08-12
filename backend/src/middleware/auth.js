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

const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "comsoc-dev-secret-2026";

function requireAuth(rolesPermitidos) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "token requerido" });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (rolesPermitidos && !rolesPermitidos.includes(payload.rol)) {
        return res.status(403).json({ error: "rol no autorizado para esta accion" });
      }
      req.user = payload;
      next();
    } catch (err) {
      return res.status(401).json({ error: "token invalido o expirado" });
    }
  };
}

module.exports = { requireAuth };
