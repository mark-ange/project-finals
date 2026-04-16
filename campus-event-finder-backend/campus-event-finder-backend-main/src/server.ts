import express, { NextFunction, Request, Response } from 'express';
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
const JSON_BODY_LIMIT = '10mb';

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
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Campus Event Finder API is running.' });
});

app.use('/api/users', usersRoutes);
app.use('/api/events', eventsRoutes);

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if ((error as { type?: string } | null)?.type === 'entity.too.large') {
    return res.status(413).json({
      message: 'Image upload is too large. Please use a smaller image or paste an image URL instead.'
    });
  }

  return next(error);
});

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

    const migrationStatements = [
      'ALTER TABLE events MODIFY COLUMN image MEDIUMTEXT NULL',
      'ALTER TABLE event_comments ADD COLUMN IF NOT EXISTS parent_comment_id VARCHAR(50) NULL',
      'ALTER TABLE event_comments ADD COLUMN IF NOT EXISTS likes INT NOT NULL DEFAULT 0'
    ];

    for (const statement of [...statements, ...migrationStatements]) {
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
