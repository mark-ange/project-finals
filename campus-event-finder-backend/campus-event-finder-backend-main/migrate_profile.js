const mysql = require('mysql2/promise');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'campus_event_finder'
  });

  try {
    console.log('Running migration: Adding profile_image to users table...');
    await connection.query('ALTER TABLE users ADD COLUMN profile_image LONGTEXT NULL;');
    console.log('Migration successful!');
  } catch (error) {
    if (error.code === 'ER_DUP_COLUMN_NAME') {
      console.log('Column already exists, skipping.');
    } else {
      console.error('Migration failed:', error);
    }
  } finally {
    await connection.end();
  }
}

runMigration();
