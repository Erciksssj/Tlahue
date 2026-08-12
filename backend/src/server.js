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
const cors = require("cors");

const authRoutes = require("./routes/auth");
const solicitudesRoutes = require("./routes/solicitudes");
const reportesRoutes = require("./routes/reportes");

const app = express();
app.use(cors());
app.use(express.json());

// Health check - usado en la Subfase 4.1 (verificacion del entorno)
app.get("/health", (req, res) => res.json({ status: "ok", servicio: "comsoc-tlahuelilpan-api" }));

app.use("/auth", authRoutes);
app.use("/solicitudes", solicitudesRoutes);
app.use("/reportes", reportesRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API COMSOC Tlahuelilpan escuchando en puerto ${PORT}`));
