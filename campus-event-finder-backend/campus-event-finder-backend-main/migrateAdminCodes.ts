import db from './src/db';

async function migrateAdminCodes() {
  try {
    await db.query('ALTER TABLE admin_codes ADD COLUMN is_used BOOLEAN NOT NULL DEFAULT FALSE');
    console.log('Migration successful: is_used column added to admin_codes.');
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Migration skipped: is_used column already exists.');
    } else {
      console.error('Migration failed:', error);
    }
  }
  process.exit(0);
}

migrateAdminCodes();
