const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "comsoc-dev-secret-2026";

// POST /auth/login  (RF12 - Autenticacion de usuarios)
router.post("/login", async (req, res) => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) {
    return res.status(400).json({ error: "correo y contrasena son requeridos" });
  }
  try {
    const { rows } = await pool.query(
      "SELECT id_usuario, nombre, correo, contrasena_hash, rol FROM usuario WHERE correo = $1",
      [correo]
    );
    if (rows.length === 0) return res.status(401).json({ error: "credenciales invalidas" });

    const user = rows[0];
    const ok = await bcrypt.compare(contrasena, user.contrasena_hash);
    if (!ok) return res.status(401).json({ error: "credenciales invalidas" });

    const token = jwt.sign(
      { id_usuario: user.id_usuario, rol: user.rol, correo: user.correo },
      JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.json({ token, usuario: { id: user.id_usuario, nombre: user.nombre, rol: user.rol } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "error interno" });
  }
});

module.exports = router;
