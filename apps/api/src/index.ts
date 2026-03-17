import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { closeDatabasePool, testConnection } from './database';
import { verifyWebhook, handleMessage } from './controllers/bot.controller';
import { runMigrations } from './migrate';
import { authRouter } from './routes/auth.routes';
import { notificationsRouter } from './routes/notifications.routes';
import { servicesRouter } from './routes/services.routes';
import { appointmentsRouter } from './routes/appointments.routes';
import { clientsRouter } from './routes/clients.routes';
import { settingsRouter } from './routes/settings.routes';

dotenv.config();

// Encendemos el reloj de recordatorios 👇
import './cron/reminders';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((x) => x.trim()) : true,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

app.get('/webhook', verifyWebhook);
app.post('/webhook', handleMessage);

app.use('/api/auth', authRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/settings', settingsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ Error no manejado en Express:', err);
  res.status(500).json({ ok: false });
});

const server = app.listen(PORT, async () => {
  console.log(`🚀 Servidor de la Secretaria Virtual corriendo en el puerto ${PORT}`);
  await runMigrations().catch((e) => console.error('❌ Error ejecutando migraciones:', e));
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

