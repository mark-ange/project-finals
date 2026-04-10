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
}

interface EventPayload {
  title?: string;
  date?: string;
  time?: string;
  image?: string;
  category?: string;
  description?: string;
  summary?: string;
  location?: string;
  organizer?: string;
  department?: string;
  capacity?: number;
  status?: 'active' | 'inactive' | 'draft';
}

interface EventCommentRow extends RowDataPacket {
  id: string;
  event_id: string;
  author: string;
  role: string;
  text: string;
  created_at: string;
}

interface RegistrationRow extends RowDataPacket {
  id: string;
  event_id: string;
  user_id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  registered_at: string;
  attended: number;
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
      event.image,
      event.category,
      event.description,
      event.summary,
      event.location,
      event.organizer,
      event.department,
      event.capacity,
      event.status
    ]);
    await db.query('INSERT INTO event_metrics (event_id, likes, shares) VALUES (?, 0, 0)', [
      event.id
    ]);
  }
}

function validateEventPayload(payload: EventPayload): string | null {
  if (!payload.title?.trim()) return 'Title is required.';
  if (!payload.date?.trim()) return 'Date is required.';
  if (!payload.time?.trim()) return 'Time is required.';
  if (!payload.category?.trim()) return 'Category is required.';
  if (!payload.description?.trim()) return 'Description is required.';
  if (!payload.summary?.trim()) return 'Summary is required.';
  if (!payload.location?.trim()) return 'Location is required.';
  if (!payload.organizer?.trim()) return 'Organizer is required.';
  if (!payload.department?.trim()) return 'Department is required.';
  if (!payload.capacity || payload.capacity < 1) return 'Capacity must be at least 1.';
  return null;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    await seedEventsIfEmpty();
    const [rows] = await db.query<EventRow[]>(`${EVENT_SELECT} ORDER BY e.created_at DESC`);
    return res.json(rows);
  } catch (error) {
    console.error('Error fetching events:', error);
    return res.status(500).json({ message: 'Failed to fetch events.' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const [rows] = await db.query<EventRow[]>(`${EVENT_SELECT} WHERE e.id = ?`, [eventId]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Event not found.' });
    }
    return res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching event:', error);
    return res.status(500).json({ message: 'Failed to fetch event.' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const payload = req.body as EventPayload;
    const errorMessage = validateEventPayload(payload);
    if (errorMessage) {
      return res.status(400).json({ message: errorMessage });
    }

    const id = `ev-${Date.now()}`;
    const status = payload.status ?? 'active';

    await db.query(
      `
        INSERT INTO events
          (id, title, date, time, image, category, description, summary, location, organizer, department, capacity, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        payload.title!.trim(),
        payload.date!.trim(),
        payload.time!.trim(),
        payload.image?.trim() ?? '',
        payload.category!.trim(),
        payload.description!.trim(),
        payload.summary!.trim(),
        payload.location!.trim(),
        payload.organizer!.trim(),
        payload.department!.trim(),
        payload.capacity!,
        status
      ]
    );

    await db.query('INSERT INTO event_metrics (event_id, likes, shares) VALUES (?, 0, 0)', [id]);

    const [rows] = await db.query<EventRow[]>(`${EVENT_SELECT} WHERE e.id = ?`, [id]);
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating event:', error);
    return res.status(500).json({ message: 'Failed to create event.' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const payload = req.body as EventPayload;
    const errorMessage = validateEventPayload(payload);
    if (errorMessage) {
      return res.status(400).json({ message: errorMessage });
    }

    const status = payload.status ?? 'active';
    const [result] = await db.query<ResultSetHeader>(
      `
        UPDATE events
        SET title = ?, date = ?, time = ?, image = ?, category = ?, description = ?, summary = ?,
            location = ?, organizer = ?, department = ?, capacity = ?, status = ?
        WHERE id = ?
      `,
      [
        payload.title!.trim(),
        payload.date!.trim(),
        payload.time!.trim(),
        payload.image?.trim() ?? '',
        payload.category!.trim(),
        payload.description!.trim(),
        payload.summary!.trim(),
        payload.location!.trim(),
        payload.organizer!.trim(),
        payload.department!.trim(),
        payload.capacity!,
        status,
        eventId
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const [rows] = await db.query<EventRow[]>(`${EVENT_SELECT} WHERE e.id = ?`, [eventId]);
    return res.json(rows[0]);
  } catch (error) {
    console.error('Error updating event:', error);
    return res.status(500).json({ message: 'Failed to update event.' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const [result] = await db.query<ResultSetHeader>('DELETE FROM events WHERE id = ?', [eventId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Event not found.' });
    }
    return res.json({ message: 'Event deleted.' });
  } catch (error) {
    console.error('Error deleting event:', error);
    return res.status(500).json({ message: 'Failed to delete event.' });
  }
});

router.post('/:id/likes', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    await db.query(
      `INSERT INTO event_metrics (event_id, likes, shares)
       VALUES (?, 1, 0)
       ON DUPLICATE KEY UPDATE likes = likes + 1`,
      [eventId]
    );

    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT likes FROM event_metrics WHERE event_id = ?',
      [eventId]
    );
    return res.json({ likes: rows[0]?.likes ?? 0 });
  } catch (error) {
    console.error('Error updating likes:', error);
    return res.status(500).json({ message: 'Failed to update likes.' });
  }
});

router.post('/:id/shares', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    await db.query(
      `INSERT INTO event_metrics (event_id, likes, shares)
       VALUES (?, 0, 1)
       ON DUPLICATE KEY UPDATE shares = shares + 1`,
      [eventId]
    );

    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT shares FROM event_metrics WHERE event_id = ?',
      [eventId]
    );
    return res.json({ shares: rows[0]?.shares ?? 0 });
  } catch (error) {
    console.error('Error updating shares:', error);
    return res.status(500).json({ message: 'Failed to update shares.' });
  }
});

router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const [rows] = await db.query<EventCommentRow[]>(
      'SELECT id, author, role, text, created_at FROM event_comments WHERE event_id = ? ORDER BY created_at DESC',
      [eventId]
    );
    return res.json(
      rows.map(row => ({
        id: row.id,
        author: row.author,
        role: row.role,
        text: row.text,
        createdAt: row.created_at
      }))
    );
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({ message: 'Failed to fetch comments.' });
  }
});

router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const { author, role, text } = req.body as { author?: string; role?: string; text?: string };

    if (!author?.trim() || !role?.trim() || !text?.trim()) {
      return res.status(400).json({ message: 'Author, role, and text are required.' });
    }

    const commentId = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date().toISOString();

    await db.query(
      'INSERT INTO event_comments (id, event_id, author, role, text, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [commentId, eventId, author.trim(), role.trim(), text.trim(), createdAt]
    );

    return res.status(201).json({
      id: commentId,
      author: author.trim(),
      role: role.trim(),
      text: text.trim(),
      createdAt
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return res.status(500).json({ message: 'Failed to create comment.' });
  }
});

router.delete('/:eventId/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const { eventId, commentId } = req.params;
    const [result] = await db.query<ResultSetHeader>(
      'DELETE FROM event_comments WHERE id = ? AND event_id = ?',
      [commentId, eventId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Comment not found.' });
    }

    return res.json({ message: 'Comment deleted.' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return res.status(500).json({ message: 'Failed to delete comment.' });
  }
});

router.get('/:id/registrations', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const [rows] = await db.query<RegistrationRow[]>(
      `
        SELECT id, user_id, name, email, department, role, registered_at, attended
        FROM event_registrations
        WHERE event_id = ?
        ORDER BY registered_at DESC
      `,
      [eventId]
    );

    return res.json(
      rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        email: row.email,
        department: row.department,
        role: row.role,
        registeredAt: row.registered_at,
        attended: Boolean(row.attended)
      }))
    );
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return res.status(500).json({ message: 'Failed to fetch registrations.' });
  }
});

router.post('/:id/registrations', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const { userId, name, email, department, role } = req.body as {
      userId?: string;
      name?: string;
      email?: string;
      department?: string;
      role?: string;
    };

    if (!userId || !name?.trim() || !email?.trim()) {
      return res.status(400).json({ message: 'Missing registration details.' });
    }

    const [eventRows] = await db.query<RowDataPacket[]>(
      'SELECT capacity FROM events WHERE id = ?',
      [eventId]
    );
    if (!eventRows.length) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const capacity = eventRows[0].capacity as number;
    const [countRows] = await db.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM event_registrations WHERE event_id = ?',
      [eventId]
    );

    const currentCount = countRows[0]?.count ?? 0;
    if (currentCount >= capacity) {
      return res.status(400).json({ message: 'Event is at full capacity.' });
    }

    const [existingRows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM event_registrations WHERE event_id = ? AND user_id = ?',
      [eventId, userId]
    );

    if (existingRows.length) {
      return res.status(409).json({ message: 'You are already registered for this event.' });
    }

    const registrationId = `reg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const registeredAt = new Date().toISOString();

    await db.query(
      `
        INSERT INTO event_registrations
          (id, event_id, user_id, name, email, department, role, registered_at, attended)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `,
      [
        registrationId,
        eventId,
        userId,
        name.trim(),
        email.trim(),
        department?.trim() ?? '',
        role?.trim() ?? 'student',
        registeredAt
      ]
    );

    return res.status(201).json({
      id: registrationId,
      userId,
      name: name.trim(),
      email: email.trim(),
      department: department?.trim() ?? '',
      role: role?.trim() ?? 'student',
      registeredAt,
      attended: false
    });
  } catch (error) {
    console.error('Error creating registration:', error);
    return res.status(500).json({ message: 'Failed to register for this event.' });
  }
});

router.patch('/:eventId/registrations/:registrationId', async (req: Request, res: Response) => {
  try {
    const { eventId, registrationId } = req.params;
    const { attended } = req.body as { attended?: boolean };

    const [result] = await db.query<ResultSetHeader>(
      `
        UPDATE event_registrations
        SET attended = ?
        WHERE id = ? AND event_id = ?
      `,
      [attended ? 1 : 0, registrationId, eventId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Registration not found.' });
    }

    return res.json({ attended: Boolean(attended) });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return res.status(500).json({ message: 'Failed to update attendance.' });
  }
});

export default router;
