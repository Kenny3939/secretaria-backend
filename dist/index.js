"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./database");
const bot_controller_1 = require("./controllers/bot.controller");
dotenv_1.default.config();
// Encendemos el reloj de recordatorios 👇
require("./cron/reminders");
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 3000;
app.use(express_1.default.json());
app.get('/health', (_req, res) => res.status(200).json({ ok: true }));
app.get('/webhook', bot_controller_1.verifyWebhook);
app.post('/webhook', bot_controller_1.handleMessage);
app.use((err, _req, res, _next) => {
    console.error('❌ Error no manejado en Express:', err);
    res.status(500).json({ ok: false });
});
const server = app.listen(PORT, async () => {
    console.log(`🚀 Servidor de la Secretaria Virtual corriendo en el puerto ${PORT}`);
    await (0, database_1.testConnection)();
});
async function shutdown(signal) {
    console.log(`🛑 Apagando (${signal})...`);
    server.close(async () => {
        await (0, database_1.closeDatabasePool)(signal);
        process.exit(0);
    });
    // Failsafe
    setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
