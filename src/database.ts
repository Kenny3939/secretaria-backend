import { Pool } from 'pg';
import dotenv from 'dotenv';

// Cargar las variables secretas del archivo .env
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  // No lanzamos aquí para permitir que el proceso levante y muestre un error claro en logs;
  // pero cualquier query fallará hasta que exista la variable.
  console.warn('⚠️  Falta DATABASE_URL en variables de entorno.');
}

// Crear la conexión profesional (Pool)
const pool = new Pool({
  connectionString: DATABASE_URL,
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

export async function closeDatabasePool(signal?: string) {
  try {
    await pool.end();
    if (signal) console.log(`🛑 Pool de DB cerrado (${signal}).`);
  } catch (e) {
    console.error('❌ Error cerrando el pool de DB:', e);
  }
}

export default pool;