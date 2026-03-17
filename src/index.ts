import express from 'express';
import dotenv from 'dotenv';
import { closeDatabasePool, testConnection } from './database';
import { verifyWebhook, handleMessage } from './controllers/bot.controller';

dotenv.config();

// Encendemos el reloj de recordatorios 👇
import './cron/reminders'; 

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

app.get('/webhook', verifyWebhook);
app.post('/webhook', handleMessage);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ Error no manejado en Express:', err);
  res.status(500).json({ ok: false });
});

const server = app.listen(PORT, async () => {
  console.log(`🚀 Servidor de la Secretaria Virtual corriendo en el puerto ${PORT}`);
  await testConnection();
});

async function shutdown(signal: string) {
  console.log(`🛑 Apagando (${signal})...`);
  server.close(async () => {
    await closeDatabasePool(signal);
    process.exit(0);
  });
  // Failsafe
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));