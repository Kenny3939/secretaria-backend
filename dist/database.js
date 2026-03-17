"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testConnection = void 0;
exports.closeDatabasePool = closeDatabasePool;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
// Cargar las variables secretas del archivo .env
dotenv_1.default.config();
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    // No lanzamos aquí para permitir que el proceso levante y muestre un error claro en logs;
    // pero cualquier query fallará hasta que exista la variable.
    console.warn('⚠️  Falta DATABASE_URL en variables de entorno.');
}
// Crear la conexión profesional (Pool)
const pool = new pg_1.Pool({
    connectionString: DATABASE_URL,
    // Configuraciones de seguridad para evitar bloqueos
    max: 20, // Máximo 20 conexiones simultáneas
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
// Función para probar que todo funciona al arrancar
const testConnection = async () => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() AS hora_actual');
        console.log('✅ Base de datos conectada exitosamente a Supabase.');
        console.log(`⏱️  Hora del servidor DB: ${result.rows[0].hora_actual}`);
        client.release();
    }
    catch (error) {
        console.error('❌ Error fatal: No se pudo conectar a la base de datos.', error);
    }
};
exports.testConnection = testConnection;
async function closeDatabasePool(signal) {
    try {
        await pool.end();
        if (signal)
            console.log(`🛑 Pool de DB cerrado (${signal}).`);
    }
    catch (e) {
        console.error('❌ Error cerrando el pool de DB:', e);
    }
}
exports.default = pool;
