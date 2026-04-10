import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import mysql from 'mysql2/promise';
import usersRoutes from './routes/users';
import eventsRoutes from './routes/events';
import db from './db';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);

/*
  Example table:
  CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL
  );
*/

// Enable CORS so the Angular frontend can call this API.
app.use(cors());

// Parse incoming JSON bodies.
app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Campus Event Finder API is running.' });
});

app.use('/api/users', usersRoutes);
app.use('/api/events', eventsRoutes);

const run = async (): Promise<void> => {
  try {
    const dbName = process.env.DB_NAME || 'campus_event_finder';
    const dbHost = process.env.DB_HOST || '127.0.0.1';
    const dbPort = Number(process.env.DB_PORT || 3306);
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';

    const adminConnection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword
    });
    await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await adminConnection.end();

    const schemaPath = path.resolve(__dirname, '..', 'schema.auto.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf-8');
    const statements = schemaSql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0 && !statement.startsWith('--'));

    for (const statement of statements) {
      await db.query(statement);
    }
    console.log('Database schema ready.');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
  }

  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
};

void run();
