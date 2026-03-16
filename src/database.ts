import { Pool } from 'pg';
import dotenv from 'dotenv';

// Cargar las variables secretas del archivo .env
dotenv.config();

// Crear la conexión profesional (Pool)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Configuraciones de seguridad para evitar bloqueos
  max: 20, // Máximo 20 conexiones simultáneas
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Función para probar que todo funciona al arrancar
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() AS hora_actual');
    console.log('✅ Base de datos conectada exitosamente a Supabase.');
    console.log(`⏱️  Hora del servidor DB: ${result.rows[0].hora_actual}`);
    client.release();
  } catch (error) {
    console.error('❌ Error fatal: No se pudo conectar a la base de datos.', error);
  }
};

export default pool;