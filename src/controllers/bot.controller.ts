// src/controllers/bot.controller.ts
import { Request, Response } from 'express';
import pool from '../database';
import { 
  enviarMensajeWhatsApp, 
  enviarBotonesWhatsApp, 
  enviarListaWhatsApp 
} from '../services/whatsapp.service';
import { 
  procesarFechaHora, 
  generarHorariosDisponibles 
} from '../utils/time.utils';

const VERIFY_TOKEN = "Secretaria_Virtual_Token_2026";

export const verifyWebhook = (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) { res.status(200).send(challenge); }
  else { res.sendStatus(403); }
};

export const handleMessage = async (req: Request, res: Response) => {
  const body = req.body;

  if (body.object && body.entry?.[0].changes?.[0].value.messages) {
    const messageInfo = body.entry[0].changes[0].value.messages[0];
    const numeroCliente = messageInfo.from;
    const numeroBot = body.entry[0].changes[0].value.metadata.display_phone_number;

    // ✅ Responder 200 a WhatsApp primero para evitar reintentos
    res.status(200).send('EVENT_RECEIVED');

    try {
      const businessQuery = await pool.query('SELECT * FROM businesses WHERE whatsapp_number = $1', [numeroBot]);
      if (businessQuery.rows.length === 0) return;
      const negocio = businessQuery.rows[0];

      const empleados: number = negocio.capacity ?? 1;

      // ─── Buscar/crear cliente y conversación ──────────────────────────────
      let clientQuery = await pool.query(
        'SELECT id, name FROM clients WHERE phone_number = $1 AND business_id = $2',
        [numeroCliente, negocio.id]
      );
      let clienteId: string;
      let nombreCliente: string | null;

      if (clientQuery.rows.length > 0) {
        clienteId    = clientQuery.rows[0].id;
        nombreCliente = clientQuery.rows[0].name;
      } else {
        const newC = await pool.query(
          'INSERT INTO clients (business_id, phone_number) VALUES ($1, $2) RETURNING id',
          [negocio.id, numeroCliente]
        );
        clienteId    = newC.rows[0].id;
        nombreCliente = null;
        await pool.query(
          'INSERT INTO conversations (business_id, client_id, current_step) VALUES ($1, $2, $3)',
          [negocio.id, clienteId, 'welcome']
        );
      }

      const convQuery = await pool.query('SELECT current_step, last_off_hours_alert FROM conversations WHERE client_id = $1', [clienteId]);
      let pasoActual = convQuery.rows.length > 0 ? convQuery.rows[0].current_step : 'welcome';

      // =====================================================================
      // 🌙 AVISO FUERA DE HORARIO (solo texto, una vez por hora)
      // =====================================================================
      const settingsQuery = await pool.query(
        'SELECT off_hours_message, buffer_minutes FROM business_settings WHERE business_id = $1',
        [negocio.id]
      );
      const settings = settingsQuery.rows[0];
      const bufferMinutos: number = settings?.buffer_minutes ?? 0;

      const ahoraGT      = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
      const minutosAhora = ahoraGT.getHours() * 60 + ahoraGT.getMinutes();
      const [openH, openM]   = (negocio.open_time  || '08:00').split(':').map(Number);
      const [closeH, closeM] = (negocio.close_time || '18:00').split(':').map(Number);
      const minutosAbre   = openH  * 60 + openM;
      const minutosCierra = closeH * 60 + closeM;
      const fueraDeHorario = minutosAhora < minutosAbre || minutosAhora >= minutosCierra;

      if (fueraDeHorario && messageInfo.type === 'text') {
        const ultimaAlerta = convQuery.rows[0]?.last_off_hours_alert;
        const haceUnaHora  = new Date(ahoraGT.getTime() - 60 * 60 * 1000);
        const debeAvisar   = !ultimaAlerta || new Date(ultimaAlerta) < haceUnaHora;

        if (debeAvisar) {
          const msgFH = settings?.off_hours_message ||
            `🌙 ¡Hola! Estamos fuera de horario (${negocio.open_time?.slice(0,5)} - ${negocio.close_time?.slice(0,5)}). Puedes agendar tu cita igualmente y te confirmaremos cuando abramos. 😊`;
          await enviarMensajeWhatsApp(numeroCliente, msgFH);
          await pool.query(
            'UPDATE conversations SET last_off_hours_alert = NOW() WHERE client_id = $1',
            [clienteId]
          );
          // ✅ NO hacemos return — el flujo continúa normalmente
        }
      }

      // ─── Entrada del usuario ──────────────────────────────────────────────
      let entradaUsuario = "";
      if (messageInfo.type === 'text') {
        entradaUsuario = messageInfo.text.body.trim().toLowerCase();
      } else if (messageInfo.type === 'interactive') {
        entradaUsuario = messageInfo.interactive.button_reply?.id || messageInfo.interactive.list_reply?.id;
      } else { return; }

      // =====================================================================
      // 🛡️ REGLA DE ORO: "HOLA" SIEMPRE MANDA AL MENÚ
      // =====================================================================
      if (entradaUsuario === 'hola' || entradaUsuario === 'menu' || entradaUsuario === 'btn_inicio') {
        await pool.query("UPDATE conversations SET current_step = 'esperando_opcion', last_message = null WHERE client_id = $1", [clienteId]);
        const saludo = nombreCliente ? `🌸 ¡Hola, *${nombreCliente}*! 💕` : `🌸 ¡Bienvenida a *${negocio.name}*! 💕`;
        await enviarBotonesWhatsApp(numeroCliente, `${saludo}\n¿En qué puedo ayudarte hoy?`, [
          { id: 'opt_agendar', title: '📅 Agendar Cita' },
          { id: 'opt_gestion', title: '⚙️ Mis Citas' },
          { id: 'opt_catalogo', title: '📖 Catálogo' }
        ]);
        return;
      }

      // =====================================================================
      // 1. FLUJO AGENDAR
      // =====================================================================
      if (entradaUsuario === 'opt_agendar') {
        const srvs = (await pool.query('SELECT * FROM services WHERE business_id = $1 AND is_active = true ORDER BY name ASC', [negocio.id])).rows;
        const filas = srvs.map((s: any) => ({ id: `srv_${s.id}`, title: s.name.substring(0, 24), description: `Q${s.price} | ${s.duration_minutes} min` }));
        await enviarListaWhatsApp(numeroCliente, "Servicios", "Elige un servicio:", "Ver Lista", [{ title: "Disponibles", rows: filas }]);
        await pool.query("UPDATE conversations SET current_step = 'eligiendo_servicio' WHERE client_id = $1", [clienteId]);
      }

      else if (pasoActual === 'eligiendo_servicio' && entradaUsuario.startsWith('srv_')) {
        const srvId = entradaUsuario.replace('srv_', '');
        const srv = (await pool.query('SELECT name FROM services WHERE id = $1', [srvId])).rows[0];
        await pool.query("UPDATE conversations SET current_step = 'eligiendo_fecha', last_message = $1 WHERE client_id = $2", [JSON.stringify({ servicio_id: srvId, nombre_servicio: srv.name }), clienteId]);
        await enviarMensajeWhatsApp(numeroCliente, `Elegiste *${srv.name}*.\n\n📅 ¿Para qué fecha? (ej: "mañana" o "15/03")`);
      }

      else if (pasoActual === 'eligiendo_fecha' && messageInfo.type === 'text') {
        const mem = JSON.parse((await pool.query('SELECT last_message FROM conversations WHERE client_id = $1', [clienteId])).rows[0].last_message);
        const srv = (await pool.query('SELECT duration_minutes FROM services WHERE id = $1', [mem.servicio_id])).rows[0];
        const fechaBase = procesarFechaHora(entradaUsuario, "00:00");
        const fechaStr  = new Date(fechaBase).toISOString().split('T')[0];

        const citas = (await pool.query(
          `SELECT start_datetime, end_datetime FROM appointments WHERE business_id = $1 AND status = 'scheduled' AND start_datetime::date = $2::date`,
          [negocio.id, fechaBase]
        )).rows;

        const bloqueados = (await pool.query(
          `SELECT start_date, end_date, start_time, end_time, is_full_day FROM blocked_dates WHERE business_id = $1 AND start_date <= $2 AND end_date >= $2`,
          [negocio.id, fechaStr]
        )).rows;

        const hors = generarHorariosDisponibles(fechaBase, srv.duration_minutes, negocio.open_time, negocio.close_time, citas, empleados, bloqueados, bufferMinutos);
        if (hors.length === 0) {
          await enviarMensajeWhatsApp(numeroCliente, "Sin espacios disponibles. Prueba con otra fecha:");
          return;
        }
        mem.fecha = entradaUsuario; mem.horarios_disponibles = hors;
        await pool.query("UPDATE conversations SET current_step = 'eligiendo_hora', last_message = $1 WHERE client_id = $2", [JSON.stringify(mem), clienteId]);
        const filasH = hors.slice(0, 10).map((h: string, i: number) => ({ id: `hr_${i}`, title: h }));
        await enviarListaWhatsApp(numeroCliente, "Horarios", "Elige una hora:", "Ver Horas", [{ title: "Disponibles", rows: filasH }]);
      }

      else if (pasoActual === 'eligiendo_hora' && entradaUsuario.startsWith('hr_')) {
        const idx = parseInt(entradaUsuario.replace('hr_', ''));
        const mem = JSON.parse((await pool.query('SELECT last_message FROM conversations WHERE client_id = $1', [clienteId])).rows[0].last_message);
        mem.hora = mem.horarios_disponibles[idx];
        if (!nombreCliente) {
          await pool.query("UPDATE conversations SET current_step = 'pidiendo_nombre', last_message = $1 WHERE client_id = $2", [JSON.stringify(mem), clienteId]);
          await enviarMensajeWhatsApp(numeroCliente, `¡Listo a las ${mem.hora}! 🎉 ¿Cuál es tu nombre?`);
        } else {
          await pool.query("UPDATE conversations SET current_step = 'confirmando_cita', last_message = $1 WHERE client_id = $2", [JSON.stringify(mem), clienteId]);
          await enviarBotonesWhatsApp(numeroCliente, `📝 *Confirmar cita:*\n\n💅 ${mem.nombre_servicio}\n📅 ${mem.fecha}\n⏰ ${mem.hora}`, [
            { id: 'conf_si', title: '✅ Confirmar' },
            { id: 'conf_no', title: '❌ Cancelar' }
          ]);
        }
      }

      else if (pasoActual === 'pidiendo_nombre' && messageInfo.type === 'text') {
        const n = messageInfo.text.body.trim();
        await pool.query('UPDATE clients SET name = $1 WHERE id = $2', [n, clienteId]);
        nombreCliente = n;
        const mem = JSON.parse((await pool.query('SELECT last_message FROM conversations WHERE client_id = $1', [clienteId])).rows[0].last_message);
        await pool.query("UPDATE conversations SET current_step = 'confirmando_cita' WHERE client_id = $1", [clienteId]);
        await enviarBotonesWhatsApp(numeroCliente, `📝 *Confirmar cita:*\n\n💅 ${mem.nombre_servicio}\n📅 ${mem.fecha}\n⏰ ${mem.hora}`, [
          { id: 'conf_si', title: '✅ Confirmar' },
          { id: 'conf_no', title: '❌ Cancelar' }
        ]);
      }

      else if (pasoActual === 'confirmando_cita' && entradaUsuario === 'conf_si') {
        const mem = JSON.parse((await pool.query('SELECT last_message FROM conversations WHERE client_id = $1', [clienteId])).rows[0].last_message);
        const ini = procesarFechaHora(mem.fecha, mem.hora);
        const dur = (await pool.query('SELECT duration_minutes FROM services WHERE id = $1', [mem.servicio_id])).rows[0].duration_minutes;
        const fin = new Date(new Date(ini).getTime() + dur * 60000).toISOString();
        await pool.query(
          'INSERT INTO appointments (business_id, client_id, service_id, start_datetime, end_datetime, status) VALUES ($1, $2, $3, $4, $5, $6)',
          [negocio.id, clienteId, mem.servicio_id, ini, fin, 'scheduled']
        );
        await pool.query("UPDATE conversations SET current_step = 'welcome', last_message = null WHERE client_id = $1", [clienteId]);
        await enviarMensajeWhatsApp(numeroCliente, "🎉 ¡Agendada! Te esperamos. 💕");
      }

      else if (pasoActual === 'confirmando_cita' && entradaUsuario === 'conf_no') {
        await pool.query("UPDATE conversations SET current_step = 'welcome', last_message = null WHERE client_id = $1", [clienteId]);
        await enviarBotonesWhatsApp(numeroCliente, "Cita cancelada. ¿En qué más puedo ayudarte?", [
          { id: 'opt_agendar', title: '📅 Agendar Cita' },
          { id: 'opt_gestion', title: '⚙️ Mis Citas' },
          { id: 'opt_catalogo', title: '📖 Catálogo' }
        ]);
      }

      // =====================================================================
      // 2. GESTIÓN DE CITAS
      // =====================================================================
      else if (entradaUsuario === 'opt_gestion') {
        await pool.query("UPDATE conversations SET current_step = 'esperando_opcion_gestion' WHERE client_id = $1", [clienteId]);
        await enviarBotonesWhatsApp(numeroCliente, "¿Qué deseas hacer con tus citas?", [
          { id: 'gest_ver', title: '📅 Ver Próximas' },
          { id: 'gest_repro', title: '🔄 Reprogramar' },
          { id: 'gest_can', title: '❌ Cancelar' }
        ]);
      }

      else if (entradaUsuario === 'gest_ver') {
        const cs = (await pool.query(
          `SELECT a.start_datetime, s.name FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.client_id = $1 AND a.status = 'scheduled' AND a.start_datetime > NOW() ORDER BY a.start_datetime ASC LIMIT 3`,
          [clienteId]
        )).rows;
        let m = cs.length ? "📅 *Tus próximas citas:*\n\n" : "No tienes citas próximas.";
        cs.forEach((c: any) => m += `• ${c.name}: ${new Date(c.start_datetime).toLocaleString('es-GT', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}\n`);
        await pool.query("UPDATE conversations SET current_step = 'welcome' WHERE client_id = $1", [clienteId]);
        await enviarBotonesWhatsApp(numeroCliente, m, [{ id: 'btn_inicio', title: '⬅️ Menú' }]);
      }

      else if (entradaUsuario === 'gest_can' || entradaUsuario === 'gest_repro') {
        const modo = entradaUsuario === 'gest_can' ? 'can' : 'rep';
        const cs = (await pool.query(
          `SELECT a.id, a.start_datetime, s.name FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.client_id = $1 AND a.status = 'scheduled' AND a.start_datetime > NOW() ORDER BY a.start_datetime ASC`,
          [clienteId]
        )).rows;
        if (!cs.length) {
          await enviarMensajeWhatsApp(numeroCliente, "No tienes citas activas.");
          return;
        }
        const filas = cs.map((c: any) => ({ id: `${modo}_${c.id}`, title: c.name.substring(0,24), description: new Date(c.start_datetime).toLocaleString('es-GT', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) }));
        await enviarListaWhatsApp(numeroCliente, "Tus Citas", "Selecciona una cita:", "Elegir", [{ title: "Citas", rows: filas }]);
        await pool.query("UPDATE conversations SET current_step = 'esperando_seleccion_gestion' WHERE client_id = $1", [clienteId]);
      }

      else if (pasoActual === 'esperando_seleccion_gestion') {
        if (entradaUsuario.startsWith('can_')) {
          const citaIdCan = entradaUsuario.replace('can_','');
          await pool.query("UPDATE appointments SET status = 'cancelled' WHERE id = $1", [citaIdCan]);

          // ✅ Notificar al panel admin
          const citaCan = (await pool.query(
            `SELECT a.start_datetime, s.name FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.id = $1`,
            [citaIdCan]
          )).rows[0];
          const fechaCan = citaCan ? new Date(citaCan.start_datetime).toLocaleString('es-GT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
          const msgNoti  = `❌ ${nombreCliente || 'Un cliente'} canceló su cita de *${citaCan?.name || 'servicio'}* del ${fechaCan}.`;
          await pool.query(
            `INSERT INTO notifications (business_id, type, message, appointment_id) VALUES ($1, 'cancellation', $2, $3)`,
            [negocio.id, msgNoti, citaIdCan]
          );

          await pool.query("UPDATE conversations SET current_step = 'welcome' WHERE client_id = $1", [clienteId]);
          await enviarMensajeWhatsApp(numeroCliente, "✅ Cita cancelada.");
        } else if (entradaUsuario.startsWith('rep_')) {
          const citaId = entradaUsuario.replace('rep_','');
          const cita = (await pool.query('SELECT a.service_id, s.name, s.duration_minutes FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.id = $1', [citaId])).rows[0];
          await pool.query("UPDATE conversations SET current_step = 'eligiendo_fecha_repro', last_message = $1 WHERE client_id = $2", [JSON.stringify({ cita_id: citaId, servicio_id: cita.service_id, nombre_servicio: cita.name, duracion: cita.duration_minutes }), clienteId]);
          await enviarMensajeWhatsApp(numeroCliente, `🔄 Reprogramando *${cita.name}*.\n\n📅 ¿Para qué nueva fecha?`);
        }
      }

      // =====================================================================
      // 3. FLUJO REPROGRAMAR
      // =====================================================================
      else if (pasoActual === 'eligiendo_fecha_repro' && messageInfo.type === 'text') {
        const mem = JSON.parse((await pool.query('SELECT last_message FROM conversations WHERE client_id = $1', [clienteId])).rows[0].last_message);
        const fechaBase     = procesarFechaHora(entradaUsuario, "00:00");
        const fechaStrRepro = new Date(fechaBase).toISOString().split('T')[0];

        const citas = (await pool.query(
          `SELECT start_datetime, end_datetime FROM appointments WHERE business_id = $1 AND status = 'scheduled' AND id != $2 AND start_datetime::date = $3::date`,
          [negocio.id, mem.cita_id, fechaBase]
        )).rows;

        const bloqueadosRepro = (await pool.query(
          `SELECT start_date, end_date, start_time, end_time, is_full_day FROM blocked_dates WHERE business_id = $1 AND start_date <= $2 AND end_date >= $2`,
          [negocio.id, fechaStrRepro]
        )).rows;

        const hors = generarHorariosDisponibles(fechaBase, mem.duracion, negocio.open_time, negocio.close_time, citas, empleados, bloqueadosRepro, bufferMinutos);
        if (!hors.length) {
          await enviarMensajeWhatsApp(numeroCliente, "Sin espacios disponibles. Prueba con otra fecha:");
          return;
        }
        mem.fecha = entradaUsuario; mem.horarios_disponibles = hors;
        await pool.query("UPDATE conversations SET current_step = 'eligiendo_hora_repro', last_message = $1 WHERE client_id = $2", [JSON.stringify(mem), clienteId]);
        const filasH = hors.slice(0, 10).map((h: string, i: number) => ({ id: `hrep_${i}`, title: h }));
        await enviarListaWhatsApp(numeroCliente, "Nuevos Horarios", "Elige la nueva hora:", "Ver Horas", [{ title: "Disponibles", rows: filasH }]);
      }

      else if (pasoActual === 'eligiendo_hora_repro' && entradaUsuario.startsWith('hrep_')) {
        const idx = parseInt(entradaUsuario.replace('hrep_', ''));
        const mem = JSON.parse((await pool.query('SELECT last_message FROM conversations WHERE client_id = $1', [clienteId])).rows[0].last_message);
        const nuevaHora = mem.horarios_disponibles[idx];
        const ini = procesarFechaHora(mem.fecha, nuevaHora);
        const fin = new Date(new Date(ini).getTime() + mem.duracion * 60000).toISOString();
        await pool.query('UPDATE appointments SET start_datetime = $1, end_datetime = $2 WHERE id = $3', [ini, fin, mem.cita_id]);
        await pool.query("UPDATE conversations SET current_step = 'welcome', last_message = null WHERE client_id = $1", [clienteId]);
        await enviarMensajeWhatsApp(numeroCliente, `✅ ¡Cita reprogramada para el ${mem.fecha} a las ${nuevaHora}!`);
      }

      // =====================================================================
      // 4. CATÁLOGO
      // =====================================================================
      else if (entradaUsuario === 'opt_catalogo') {
        const srvs = (await pool.query('SELECT name, price FROM services WHERE business_id = $1 AND is_active = true', [negocio.id])).rows;
        let t = `📖 *Catálogo de ${negocio.name}*\n\n`;
        srvs.forEach((s: any) => t += `• ${s.name}: Q${s.price}\n`);
        await pool.query("UPDATE conversations SET current_step = 'welcome' WHERE client_id = $1", [clienteId]);
        await enviarBotonesWhatsApp(numeroCliente, t, [{ id: 'opt_agendar', title: '📅 Agendar' }, { id: 'btn_inicio', title: '⬅️ Menú' }]);
      }

    } catch (e) { console.error('❌ Error:', e); }

  } else { res.sendStatus(404); }
};