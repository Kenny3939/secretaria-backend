import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pool from './database';
import { runMigrations } from './migrate';

dotenv.config();

async function main() {
  await runMigrations();

  const email = (process.env.SEED_SUPERADMIN_EMAIL || 'admin@local.test').toLowerCase();
  const password = process.env.SEED_SUPERADMIN_PASSWORD || 'admin1234';
  const businessWhatsApp = process.env.SEED_BUSINESS_WHATSAPP || '0000';
  const businessName = process.env.SEED_BUSINESS_NAME || 'Mi Negocio';

  const biz = await pool.query('SELECT id FROM businesses WHERE whatsapp_number = $1 LIMIT 1', [businessWhatsApp]);
  let businessId: string;
  if (biz.rows[0]?.id) {
    businessId = biz.rows[0].id;
  } else {
    const created = await pool.query(
      'INSERT INTO businesses (name, whatsapp_number) VALUES ($1, $2) RETURNING id',
      [businessName, businessWhatsApp],
    );
    businessId = created.rows[0].id;
    await pool.query('INSERT INTO business_settings (business_id) VALUES ($1) ON CONFLICT (business_id) DO NOTHING', [businessId]);
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
  if (existing.rows[0]?.id) {
    console.log('✅ Seed: usuario ya existe:', email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (business_id, email, name, role, password_hash)
     VALUES ($1, $2, $3, 'superadmin', $4)`,
    [businessId, email, 'Super Admin', passwordHash],
  );

  console.log('✅ Seed listo.');
  console.log('   email:', email);
  console.log('   password:', password);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });

