"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/cron/reminders.ts
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = __importDefault(require("../database"));
const whatsapp_service_1 = require("../services/whatsapp.service");
// El cron revisa cada minuto
let running = false;
node_cron_1.default.schedule('* * * * *', async () => {
    if (running)
        return;
    running = true;
    try {
        const ahora = new Date();
        const limite24h = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
        const limite2h = new Date(ahora.getTime() + 2 * 60 * 60 * 1000);
        const limite15min = new Date(ahora.getTime() + 15 * 60 * 1000);
        // ✅ NOTA DE SEGURIDAD: Todos los queries filtran ESTRICTAMENTE por status = 'scheduled'.
        // Esto garantiza que nunca se envíe un recordatorio sobre una cita que el dueño
        // ya marcó como 'completed', 'no-show' o 'cancelled' desde el panel admin.
        // ==========================================================
        // 🔔 1. RECORDATORIOS DE 24 HORAS
        // ==========================================================
        const query24h = await database_1.default.query(`
      SELECT 
        a.id, a.start_datetime, 
        s.name AS service_name, 
        c.name AS client_name, c.phone_number, 
        b.name AS business_name
      FROM appointments a
      JOIN clients    c ON a.client_id    = c.id
      JOIN services   s ON a.service_id   = s.id
      JOIN businesses b ON a.business_id  = b.id
      WHERE a.status = 'scheduled'
        AND a.reminder_24h_sent = false
        AND a.start_datetime <= $1
        AND a.start_datetime >  NOW()
    `, [limite24h.toISOString()]);
        for (const cita of query24h.rows) {
            const fechaObj = new Date(cita.start_datetime);
            const fechaFmt = fechaObj.toLocaleString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric' });
            const horaFmt = fechaObj.toLocaleString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit' });
            const mensaje = `Hola *${cita.client_name}* 👋\n\nTe recordamos que tienes una cita mañana en *${cita.business_name}*:\n\n💅 Servicio: ${cita.service_name}\n📅 Fecha: ${fechaFmt}\n⏰ Hora: ${horaFmt}\n\n_(Si deseas reprogramar o cancelar, escríbeme *hola* para abrir el menú)_`;
            await (0, whatsapp_service_1.enviarMensajeWhatsApp)(cita.phone_number, mensaje);
            await database_1.default.query('UPDATE appointments SET reminder_24h_sent = true WHERE id = $1', [cita.id]);
            console.log(`🔔 Recordatorio 24h enviado a ${cita.client_name}`);
        }
        // ==========================================================
        // 🔔 2. RECORDATORIOS DE 2 HORAS
        // ==========================================================
        const query2h = await database_1.default.query(`
      SELECT 
        a.id, a.start_datetime, 
        s.name AS service_name, 
        c.name AS client_name, c.phone_number, 
        b.name AS business_name
      FROM appointments a
      JOIN clients    c ON a.client_id    = c.id
      JOIN services   s ON a.service_id   = s.id
      JOIN businesses b ON a.business_id  = b.id
      WHERE a.status = 'scheduled'
        AND a.reminder_2h_sent = false
        AND a.start_datetime <= $1
        AND a.start_datetime >  NOW()
    `, [limite2h.toISOString()]);
        for (const cita of query2h.rows) {
            const horaFmt = new Date(cita.start_datetime).toLocaleString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit' });
            const mensaje = `¡Te esperamos pronto, *${cita.client_name}*! ⏳\n\nTu cita de *${cita.service_name}* es hoy a las *${horaFmt}* en *${cita.business_name}*.\n\n¡Nos vemos! 💕`;
            await (0, whatsapp_service_1.enviarMensajeWhatsApp)(cita.phone_number, mensaje);
            await database_1.default.query('UPDATE appointments SET reminder_2h_sent = true WHERE id = $1', [cita.id]);
            console.log(`🔔 Recordatorio 2h enviado a ${cita.client_name}`);
        }
        // ==========================================================
        // 🔔 3. ADVERTENCIA DE PUNTUALIDAD (15 MINUTOS ANTES)
        // ==========================================================
        const query15min = await database_1.default.query(`
      SELECT 
        a.id, a.start_datetime, 
        c.name AS client_name, c.phone_number
      FROM appointments a
      JOIN clients c ON a.client_id = c.id
      WHERE a.status = 'scheduled'
        AND a.reminder_15min_sent = false
        AND a.start_datetime <= $1
        AND a.start_datetime >  NOW()
    `, [limite15min.toISOString()]);
        for (const cita of query15min.rows) {
            const mensaje = `¡Hola *${cita.client_name}*! Estás a pocos minutos de tu cita. ⏱️\n\nTe recordamos que la puntualidad es muy importante. *Si llegas tarde, existe la posibilidad de que ya no podamos atenderte* para no retrasar a los siguientes clientes.\n\n¡Gracias por tu comprensión! 🙏`;
            await (0, whatsapp_service_1.enviarMensajeWhatsApp)(cita.phone_number, mensaje);
            await database_1.default.query('UPDATE appointments SET reminder_15min_sent = true WHERE id = $1', [cita.id]);
            console.log(`⚠️ Advertencia 15min enviada a ${cita.client_name}`);
        }
    }
    catch (error) {
        console.error('❌ Error en el motor de recordatorios:', error);
    }
    finally {
        running = false;
    }
});
