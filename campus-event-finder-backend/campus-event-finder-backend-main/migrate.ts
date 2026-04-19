import db from './src/db';

async function migrate() {
  try {
    await db.query('ALTER TABLE users ADD COLUMN profile_image MEDIUMTEXT NULL');
    console.log('Migration successful: profile_image column added.');
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Migration skipped: profile_image column already exists.');
    } else {
      console.error('Migration failed:', error);
    }
  }
  process.exit(0);
}

migrate();
