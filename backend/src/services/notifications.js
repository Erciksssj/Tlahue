const fs = require("fs");
const path = require("path");

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || null;
const FROM_EMAIL = process.env.NOTIFICACIONES_FROM || "comunicacion.social@tlahuelilpan.gob.mx";
const FROM_NAME = "Comunicación Social — Ayuntamiento de Tlahuelilpan";
const LOG_PATH = process.env.NOTIFICACIONES_LOG || path.join(__dirname, "..", "..", "notificaciones.log");

let sgMail = null;
let modo = "simulado";

if (SENDGRID_API_KEY) {
  try {
    sgMail = require("@sendgrid/mail");
    sgMail.setApiKey(SENDGRID_API_KEY);
    modo = "real";
  } catch (err) {
    console.warn("No se pudo inicializar @sendgrid/mail, se usará el modo simulado:", err.message);
  }
} else {
  console.warn(
    "[notificaciones] SENDGRID_API_KEY no configurada. " +
    "El módulo operará en modo SIMULADO: los correos se registrarán en " + LOG_PATH +
    " en lugar de enviarse realmente. Para envíos reales, configure la variable de entorno " +
    "SENDGRID_API_KEY con una API key válida de una cuenta de SendGrid con el remitente verificado."
  );
}

function registrarSimulado(msg) {
  const linea =
    "\n" + "=".repeat(70) +
    `\nFecha: ${new Date().toISOString()}` +
    `\nPara: ${msg.to}` +
    `\nDe: ${msg.from.email} (${msg.from.name})` +
    `\nAsunto: ${msg.subject}` +
    `\n${"-".repeat(70)}\n${msg.text}\n`;
  fs.appendFileSync(LOG_PATH, linea);
  console.log(`[notificaciones:simulado] correo registrado para ${msg.to} — asunto: "${msg.subject}"`);
}

/**
 * Envia (o simula) un correo. Devuelve { enviado: bool, modo: 'real'|'simulado', error?: string }
 */
async function enviarCorreo({ to, subject, text, html }) {
  const msg = {
    to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject,
    text,
    html: html || `<p>${text.replace(/\n/g, "<br>")}</p>`,
  };

  if (modo === "real" && sgMail) {
    try {
      await sgMail.send(msg);
      return { enviado: true, modo: "real" };
    } catch (err) {
      console.error("[notificaciones] error al enviar via SendGrid, se registra en log de respaldo:", err.message);
      registrarSimulado(msg);
      return { enviado: false, modo: "real", error: err.message };
    }
  }

  registrarSimulado(msg);
  return { enviado: true, modo: "simulado" };
}

// RF04 — Confirmacion automatica al registrar una solicitud
async function notificarConfirmacionSolicitud(solicitud) {
  const subject = `Solicitud de difusión recibida — Folio ${solicitud.folio}`;
  const text =
    `Hola ${solicitud.contacto_nombre},\n\n` +
    `Tu solicitud de difusión "${solicitud.nombre_evento}" fue registrada correctamente ` +
    `en el sistema de Comunicación Social del Ayuntamiento de Tlahuelilpan.\n\n` +
    `Folio de seguimiento: ${solicitud.folio}\n` +
    `Estatus actual: Recibida\n\n` +
    `Puedes consultar el estatus de tu solicitud en cualquier momento usando este folio ` +
    `en la sección "Consultar folio" de la plataforma.\n\n` +
    `— Comunicación Social, Ayuntamiento de Tlahuelilpan`;
  return enviarCorreo({ to: solicitud.contacto_correo, subject, text });
}

// RF07 — Notificacion automatica al cambiar el estatus de una solicitud
async function notificarCambioEstatus(solicitud, nuevoEstatus, comentario) {
  const subject = `Actualización de tu solicitud ${solicitud.folio}: ${nuevoEstatus}`;
  const text =
    `Hola ${solicitud.contacto_nombre},\n\n` +
    `El estatus de tu solicitud "${solicitud.nombre_evento}" (folio ${solicitud.folio}) ` +
    `cambió a: ${nuevoEstatus}.\n` +
    (comentario ? `\nComentario del encargado: ${comentario}\n` : "") +
    `\n— Comunicación Social, Ayuntamiento de Tlahuelilpan`;
  return enviarCorreo({ to: solicitud.contacto_correo, subject, text });
}

module.exports = { enviarCorreo, notificarConfirmacionSolicitud, notificarCambioEstatus, modoActual: () => modo, LOG_PATH };
