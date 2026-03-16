// src/index.ts
import express from 'express';
import { testConnection } from './database';
import { verifyWebhook, handleMessage } from './controllers/bot.controller';

// Encendemos el reloj de recordatorios 👇
import './cron/reminders'; 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/webhook', verifyWebhook);
app.post('/webhook', handleMessage);

app.listen(PORT, async () => {
  console.log(`🚀 Servidor de la Secretaria Virtual corriendo en el puerto ${PORT}`);
  await testConnection();
});