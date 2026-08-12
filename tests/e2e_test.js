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

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const shots = '/home/claude/comsoc-app/evidencia/screenshots/';

  // 1. Cargar el formulario
  await page.goto('http://localhost:8080/index.html');
  await page.waitForTimeout(300);
  await page.screenshot({ path: shots + '01_formulario.png' });

  // 2. Llenar y enviar una nueva solicitud (E2E: frontend -> API -> BD)
  await page.fill('input[name="evento"]', 'Concierto de Aniversario Municipal');
  await page.fill('input[name="fecha"]', '2026-09-15');
  await page.fill('input[name="hora"]', '19:00');
  await page.fill('input[name="lugar"]', 'Plaza Principal de Tlahuelilpan');
  await page.selectOption('select[name="direccion"]', '3');
  await page.fill('input[name="contacto"]', 'Ivan Salazar');
  await page.fill('input[name="correo"]', 'ivan.salazar@tlahuelilpan.gob.mx');
  await page.fill('textarea[name="texto"]', 'Concierto gratuito por el aniversario del municipio, con la Banda Sinfonica de Hidalgo.');

  // adjuntar un archivo de prueba
  const fs = require('fs');
  fs.writeFileSync('/tmp/flyer_prueba.png', Buffer.from([137,80,78,71,13,10,26,10]));
  await page.setInputFiles('#file-input', '/tmp/flyer_prueba.png');

  await page.screenshot({ path: shots + '02_formulario_lleno.png' });
  await page.click('button[type="submit"]');
  await page.waitForSelector('#confirm-card', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(300);
  const folioTexto = await page.textContent('#confirm-folio');
  console.log('FOLIO_GENERADO:', folioTexto.trim());
  await page.screenshot({ path: shots + '03_confirmacion_folio.png' });

  // 3. Consultar el folio recien creado (RF08)
  await page.click('button[data-view="consulta"]');
  await page.fill('#consulta-input', folioTexto.trim());
  await page.click('#btn-consultar');
  await page.waitForTimeout(600);
  await page.screenshot({ path: shots + '04_consulta_folio.png' });

  // 4. Iniciar sesion en el panel (RF12) y ver el Kanban (RF05)
  await page.click('button[data-view="panel"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: shots + '05_login_panel.png' });
  await page.click('#btn-login');
  await page.waitForSelector('#kanban .kcard', { timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: shots + '06_panel_kanban.png', fullPage: true });

  // 5. Abrir la solicitud recien creada y cambiar su estatus (RF06/RF07)
  const cards = await page.$$('#kanban .kcard');
  await cards[0].click();
  await page.waitForSelector('#overlay.active');
  await page.waitForTimeout(300);
  await page.screenshot({ path: shots + '07_modal_detalle.png' });
  await page.fill('#modal-comment', 'Turnada al diseñador grafico para su elaboracion.');
  await page.click('#modal-actions button:has-text("Mover a En diseño")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: shots + '08_panel_actualizado.png', fullPage: true });

  await browser.close();
  console.log('E2E_OK');
})().catch(e => { console.error('E2E_ERROR', e); process.exit(1); });
