import db from './src/db';
async function listUsers() {
  const [rows] = await db.query('SELECT email FROM users');
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
listUsers();
