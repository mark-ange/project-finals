import { Router, Request, Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../db';
import { DEFAULT_EVENTS } from '../data/default-events';

const router = Router();

interface EventRow extends RowDataPacket {
  id: string;
  title: string;
  date: string;
  time: string;
  image: string;
  category: string;
  description: string;
  summary: string;
  location: string;
  organizer: string;
  department: string;
  capacity: number;
  status: 'active' | 'inactive' | 'draft';
  likes: number;
  shares: number;
  commentsCount: number;
  registrations: number;
  attendance: number;
  created_at: string;
}

const EVENT_SELECT = `
  SELECT
    e.id,
    e.title,
    e.date,
    e.time,
    e.image,
    e.category,
    e.description,
    e.summary,
    e.location,
    e.organizer,
    e.department,
    e.capacity,
    e.status,
    e.created_at,
    COALESCE(m.likes, 0) AS likes,
    COALESCE(m.shares, 0) AS shares,
    (SELECT COUNT(*) FROM event_comments c WHERE c.event_id = e.id) AS commentsCount,
    (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) AS registrations,
    (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.attended = 1) AS attendance
  FROM events e
  LEFT JOIN event_metrics m ON m.event_id = e.id
`;

async function seedEventsIfEmpty(): Promise<void> {
  const [rows] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS count FROM events');
  const count = rows[0]?.count ?? 0;
  if (count > 0) return;

  const insertSql = `
    INSERT INTO events
      (id, title, date, time, image, category, description, summary, location, organizer, department, capacity, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  for (const event of DEFAULT_EVENTS) {
    await db.query(insertSql, [
      event.id,
      event.title,
      event.date,
      event.time,
      event.image ?? null,
      event.category,
      event.description ?? null,
      event.summary ?? null,
      event.location,
      event.organizer,
      event.department,
      event.capacity ?? null,
      event.status
    ]);
    await db.query('INSERT INTO event_metrics (event_id, likes, shares) VALUES (?, 0, 0)', [event.id]);
  }
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    await seedEventsIfEmpty();
    const [rows] = await db.query<EventRow[]>(`${EVENT_SELECT} ORDER BY e.created_at DESC`);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch events.' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows] = await db.query<EventRow[]>(`${EVENT_SELECT} WHERE e.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Event not found.' });
    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch event.' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      title, date, time, category, description,
      summary, location, organizer, department,
      capacity, image, status
    } = req.body;

    const eventId = Date.now().toString();
    const query = `
      INSERT INTO events 
      (id, title, date, time, category, description, summary, location, organizer, department, capacity, image, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.execute(query, [
      eventId,
      title || 'Untitled Event',
      date || new Date().toISOString().split('T')[0],
      time || '12:00',
      category || 'General',
      description || '',
      summary || '',
      location || 'TBA',
      organizer || 'Admin',
      department || 'General',
      capacity ?? 0,
      image || '',
      status || 'draft'
    ]);

    await db.query('INSERT INTO event_metrics (event_id, likes, shares) VALUES (?, 0, 0)', [eventId]);

    const [rows] = await db.query<EventRow[]>(`${EVENT_SELECT} WHERE e.id = ?`, [eventId]);
    return res.status(201).json(rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const p = req.body;

    await db.query(
      `UPDATE events SET title=?, date=?, time=?, image=?, category=?, description=?, summary=?, 
       location=?, organizer=?, department=?, capacity=?, status=? WHERE id=?`,
      [
        p.title || 'Untitled', p.date || new Date().toISOString().split('T')[0], p.time || '12:00', 
        p.image || null, p.category || 'General', 
        p.description || null, p.summary || null,
        p.location || 'TBA', p.organizer || 'Admin', p.department || 'General',
        p.capacity ?? 0, p.status || 'draft', eventId
      ]
    );

    const [rows] = await db.query<EventRow[]>(`${EVENT_SELECT} WHERE e.id = ?`, [eventId]);
    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update event.' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await db.query('DELETE FROM event_metrics WHERE event_id = ?', [req.params.id]);
    const [result] = await db.query<ResultSetHeader>('DELETE FROM events WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Event not found.' });
    return res.json({ message: 'Event deleted.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete event.' });
  }
});

export default router;