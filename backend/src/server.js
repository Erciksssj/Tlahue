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
