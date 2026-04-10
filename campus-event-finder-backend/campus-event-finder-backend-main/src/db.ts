import mysql from 'mysql2/promise';

// Create a connection pool so we can reuse MySQL connections.
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campus_event_finder',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
