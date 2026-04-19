import db from './src/db';

async function reset() {
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  await db.query('TRUNCATE TABLE events');
  await db.query('TRUNCATE TABLE event_metrics');
  await db.query('TRUNCATE TABLE event_comments');
  await db.query('TRUNCATE TABLE event_registrations');
  await db.query('TRUNCATE TABLE user_likes');
  await db.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('Database truncated');
  process.exit(0);
}
reset();
