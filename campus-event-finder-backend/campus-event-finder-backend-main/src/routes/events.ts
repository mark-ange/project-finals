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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const COMMENT_TEMPLATES = [
  'This event looks amazing!',
  'Can’t wait to join this one.',
  'Great initiative, very useful.',
  'The speakers look very professional.',
  'I hope there is a recording available.',
  'This will be a great learning opportunity.',
  'Perfect timing for this topic.',
  'I already shared this with my classmates.',
  'The venue looks perfect for the activity.',
  'Would love to see more events like this.',
  'This is exactly what our department needs.',
  'I am interested in attending this event.',
  'Looks well organized and informative.',
  'Amazing lineup of activities.',
  'The capacity should be enough for everyone.',
  'I love the design of this event poster.',
  'This is great for student engagement.',
  'I think this event will attract many students.',
  'I want to register as soon as possible.',
  'This content is so relevant to my course.',
  'Looking forward to the interactive sessions.',
  'This event has fantastic potential.',
  'Very impressed with the planning team.',
  'The campus will really benefit from this.',
  'The agenda seems well thought out.'
];

const SAMPLE_NAMES = [
  'Arielle', 'Benji', 'Cleo', 'Dante', 'Elena', 'Felix', 'Gwen', 'Harold', 'Isabel', 'Jared',
  'Kira', 'Luka', 'Maya', 'Nico', 'Olivia', 'Pablo', 'Quinn', 'Rhea', 'Simeon', 'Tara',
  'Ulani', 'Vince', 'Wren', 'Xian', 'Yara', 'Zane'
];

async function ensureMetricsRow(eventId: string): Promise<void> {
  await db.query(
    'INSERT INTO event_metrics (event_id, likes, shares) VALUES (?, 0, 0) ON DUPLICATE KEY UPDATE event_id = event_id',
    [eventId]
  );
}

async function countRows(table: string, whereClause: string, params: unknown[]): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM ${table} WHERE ${whereClause}`, params);
  return rows[0]?.count ?? 0;
}

async function seedMockEngagementForEvent(eventId: string, department: string): Promise<void> {
  await ensureMetricsRow(eventId);

  const likes = randomInt(120, 260);
  const shares = randomInt(100, 220);
  await db.query('UPDATE event_metrics SET likes = ?, shares = ? WHERE event_id = ?', [likes, shares, eventId]);

  const currentComments = await countRows('event_comments', 'event_id = ?', [eventId]);
  const targetComments = Math.max(110, currentComments);
  const topLevelCommentIds: string[] = [];

  for (let index = currentComments + 1; index <= targetComments; index += 1) {
    const commentId = `comment_${eventId}_${index}`;
    const author = SAMPLE_NAMES[randomInt(0, SAMPLE_NAMES.length - 1)];
    const role = index % 8 === 0 ? 'admin' : 'student';
    const text = COMMENT_TEMPLATES[randomInt(0, COMMENT_TEMPLATES.length - 1)];
    const createdAt = new Date(Date.now() - randomInt(0, 30) * 24 * 60 * 60 * 1000);
    const likes = randomInt(0, 18);

    await db.query(
      'INSERT IGNORE INTO event_comments (id, event_id, parent_comment_id, author, role, text, created_at, likes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [commentId, eventId, null, author, role, text, createdAt, likes]
    );
    topLevelCommentIds.push(commentId);
  }

  if (topLevelCommentIds.length === 0) {
    const [existingRows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM event_comments WHERE event_id = ? AND parent_comment_id IS NULL',
      [eventId]
    );
    topLevelCommentIds.push(...existingRows.map(row => row.id));
  }

  const replyCount = Math.min(Math.max(15, Math.floor(topLevelCommentIds.length * 0.18)), 20);
  for (let replyIndex = 1; replyIndex <= replyCount && topLevelCommentIds.length > 0; replyIndex += 1) {
    const parentCommentId = topLevelCommentIds[randomInt(0, topLevelCommentIds.length - 1)];
    const commentId = `reply_${eventId}_${replyIndex}`;
    const author = SAMPLE_NAMES[randomInt(0, SAMPLE_NAMES.length - 1)];
    const role = replyIndex % 10 === 0 ? 'admin' : 'student';
    const text = COMMENT_TEMPLATES[randomInt(0, COMMENT_TEMPLATES.length - 1)];
    const createdAt = new Date(Date.now() - randomInt(0, 15) * 24 * 60 * 60 * 1000);
    const likes = randomInt(0, 8);

    await db.query(
      'INSERT IGNORE INTO event_comments (id, event_id, parent_comment_id, author, role, text, created_at, likes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [commentId, eventId, parentCommentId, author, role, text, createdAt, likes]
    );
  }

  const currentRegistrations = await countRows('event_registrations', 'event_id = ?', [eventId]);
  const targetRegistrations = Math.max(120, currentRegistrations);
  for (let index = currentRegistrations + 1; index <= targetRegistrations; index += 1) {
    const registrationId = `registration_${eventId}_${index}`;
    const userId = `user_${eventId}_${index}`;
    const name = `${SAMPLE_NAMES[randomInt(0, SAMPLE_NAMES.length - 1)]} ${String.fromCharCode(65 + (index % 26))}.`;
    const email = `user${eventId}_${index}@liceo.edu.ph`;
    const departmentName = department || 'General Department';
    const role = index % 10 === 0 ? 'admin' : 'student';
    const registeredAt = new Date(Date.now() - randomInt(0, 30) * 24 * 60 * 60 * 1000);
    const attended = index <= Math.min(targetRegistrations, 110) ? 1 : 0;

    await db.query(
      'INSERT IGNORE INTO event_registrations (id, event_id, user_id, name, email, department, role, registered_at, attended) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [registrationId, eventId, userId, name, email, departmentName, role, registeredAt, attended]
    );
  }
}

async function seedEventsIfEmpty(): Promise<void> {
  const [rows] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS count FROM events');
  const count = rows[0]?.count ?? 0;

  const insertSql = `
    INSERT INTO events
      (id, title, date, time, image, category, description, summary, location, organizer, department, capacity, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  if (count === 0) {
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
      // Seed demo engagement only for initial default events.
      // This prevents newly created events from being populated with random likes/comments on every GET.
      await seedMockEngagementForEvent(event.id, event.department);
    }
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

router.post('/:id/likes', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const { user_email } = req.body;
    if (!user_email) return res.status(400).json({ message: 'User email required.' });

    const [eventRows] = await db.query<RowDataPacket[]>('SELECT id FROM events WHERE id = ?', [eventId]);
    if (!eventRows.length) return res.status(404).json({ message: 'Event not found.' });

    const [existingRows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM user_likes WHERE user_email = ? AND event_id = ?',
      [user_email, eventId]
    );

    if (!existingRows.length) {
      await db.query('INSERT INTO user_likes (user_email, event_id) VALUES (?, ?)', [user_email, eventId]);
      await db.query('INSERT INTO event_metrics (event_id, likes, shares) VALUES (?, 1, 0) ON DUPLICATE KEY UPDATE likes = likes + 1', [eventId]);
    }

    const [rows] = await db.query<RowDataPacket[]>('SELECT likes FROM event_metrics WHERE event_id = ?', [eventId]);
    const likes = rows[0]?.likes ?? 0;
    return res.json({ likes });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to like event.' });
  }
});

router.delete('/:id/likes', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const { user_email } = req.body;
    if (!user_email) return res.status(400).json({ message: 'User email required.' });

    const [existingRows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM user_likes WHERE user_email = ? AND event_id = ?',
      [user_email, eventId]
    );

    if (existingRows.length) {
      await db.query('DELETE FROM user_likes WHERE user_email = ? AND event_id = ?', [user_email, eventId]);
      await db.query('UPDATE event_metrics SET likes = GREATEST(0, likes - 1) WHERE event_id = ?', [eventId]);
    }

    const [rows] = await db.query<RowDataPacket[]>('SELECT likes FROM event_metrics WHERE event_id = ?', [eventId]);
    const likes = rows[0]?.likes ?? 0;
    return res.json({ likes });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to unlike event.' });
  }
});

router.get('/:id/liked', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const user_email = req.query.user_email as string;
    if (!user_email) return res.status(400).json({ message: 'User email required.' });

    const [rows] = await db.query<RowDataPacket[]>('SELECT COUNT(*) as liked FROM user_likes WHERE user_email = ? AND event_id = ?', [user_email, eventId]);
    return res.json({ liked: rows[0].liked > 0 });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to check like status.' });
  }
});

router.get('/user/:email/likes', async (req: Request, res: Response) => {
  try {
    const user_email = req.params.email;
    const [rows] = await db.query<RowDataPacket[]>('SELECT event_id FROM user_likes WHERE user_email = ?', [user_email]);
    const likedEventIds = rows.map(row => row.event_id);
    return res.json({ likedEvents: likedEventIds });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to get user likes.' });
  }
});

router.post('/:id/shares', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    await db.query(
      'INSERT INTO event_metrics (event_id, likes, shares) VALUES (?, 0, 1) ON DUPLICATE KEY UPDATE shares = shares + 1',
      [eventId]
    );
    const [rows] = await db.query<RowDataPacket[]>('SELECT shares FROM event_metrics WHERE event_id = ?', [eventId]);
    if (!rows.length) return res.status(404).json({ message: 'Event not found.' });
    return res.json({ shares: rows[0].shares });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to share event.' });
  }
});

router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id, parent_comment_id AS parentCommentId, author, role, text, likes, created_at AS createdAt FROM event_comments WHERE event_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    return res.json(rows.map(row => ({
      id: row.id,
      parentCommentId: row.parentCommentId,
      author: row.author,
      role: row.role,
      text: row.text,
      likes: row.likes,
      createdAt: row.createdAt
    })));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch comments.' });
  }
});

router.get('/:id/comment-likes', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const user_email = req.query.user_email as string;
    if (!user_email) return res.status(400).json({ message: 'User email required.' });

    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT comment_id FROM comment_likes WHERE user_email = ? AND comment_id IN (SELECT id FROM event_comments WHERE event_id = ?)',
      [user_email, eventId]
    );
    const likedCommentIds = rows.map(row => row.comment_id);
    return res.json({ likedCommentIds });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch liked comments.' });
  }
});

router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const { author, role, text, parentCommentId } = req.body as { author: string; role: string; text: string; parentCommentId?: string };

    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = new Date();

    await db.query(
      'INSERT INTO event_comments (id, event_id, parent_comment_id, author, role, text, created_at, likes) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
      [commentId, eventId, parentCommentId || null, author, role, text, createdAt]
    );

    return res.status(201).json({
      id: commentId,
      parentCommentId: parentCommentId || null,
      author,
      role,
      text,
      likes: 0,
      createdAt: createdAt.toISOString()
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add comment.' });
  }
});

router.delete('/:id/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const [result] = await db.query<ResultSetHeader>(
      'DELETE FROM event_comments WHERE id = ? AND event_id = ?',
      [req.params.commentId, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Comment not found.' });
    return res.json({ message: 'Comment deleted.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete comment.' });
  }
});

router.post('/:id/comments/:commentId/likes', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const commentId = req.params.commentId;
    const { user_email } = req.body;
    if (!user_email) return res.status(400).json({ message: 'User email required.' });

    const [existingRows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM comment_likes WHERE user_email = ? AND comment_id = ?',
      [user_email, commentId]
    );

    if (!existingRows.length) {
      await db.query('INSERT INTO comment_likes (user_email, comment_id) VALUES (?, ?)', [user_email, commentId]);
      await db.query('UPDATE event_comments SET likes = likes + 1 WHERE id = ?', [commentId]);
    }

    const [commentRows] = await db.query<RowDataPacket[]>('SELECT likes FROM event_comments WHERE id = ?', [commentId]);
    const likes = commentRows[0]?.likes ?? 0;
    return res.json({ likes });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to like comment.' });
  }
});

router.delete('/:id/comments/:commentId/likes', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const commentId = req.params.commentId;
    const { user_email } = req.body;
    if (!user_email) return res.status(400).json({ message: 'User email required.' });

    const [existingRows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM comment_likes WHERE user_email = ? AND comment_id = ?',
      [user_email, commentId]
    );

    if (existingRows.length) {
      await db.query('DELETE FROM comment_likes WHERE user_email = ? AND comment_id = ?', [user_email, commentId]);
      await db.query('UPDATE event_comments SET likes = GREATEST(0, likes - 1) WHERE id = ?', [commentId]);
    }

    const [commentRows] = await db.query<RowDataPacket[]>('SELECT likes FROM event_comments WHERE id = ?', [commentId]);
    const likes = commentRows[0]?.likes ?? 0;
    return res.json({ likes });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to unlike comment.' });
  }
});

router.get('/:id/registrations', async (req: Request, res: Response) => {
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id, user_id AS userId, name, email, department, role, registered_at AS registeredAt, attended FROM event_registrations WHERE event_id = ? ORDER BY registered_at DESC',
      [req.params.id]
    );
    return res.json(rows.map(row => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      email: row.email,
      department: row.department,
      role: row.role,
      registeredAt: row.registeredAt,
      attended: !!row.attended
    })));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch registrations.' });
  }
});

router.post('/:id/registrations', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const { userId, name, email, department, role } = req.body as {
      userId: string;
      name: string;
      email: string;
      department: string;
      role: string;
    };

    const registrationId = `registration_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const registeredAt = new Date();

    await db.query(
      'INSERT INTO event_registrations (id, event_id, user_id, name, email, department, role, registered_at, attended) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [registrationId, eventId, userId, name, email, department, role, registeredAt, 0]
    );

    return res.status(201).json({
      id: registrationId,
      userId,
      name,
      email,
      department,
      role,
      registeredAt: registeredAt.toISOString(),
      attended: false
    });
  } catch (error) {
    if ((error as any)?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'You are already registered for this event.' });
    }
    return res.status(500).json({ message: 'Failed to register for event.' });
  }
});

router.patch('/:id/registrations/:registrationId', async (req: Request, res: Response) => {
  try {
    // Attendance can only be updated once the event is marked inactive/done.
    const eventId = req.params.id;
    const [eventRows] = await db.query<RowDataPacket[]>(
      'SELECT status FROM events WHERE id = ?',
      [eventId]
    );

    if (!eventRows.length) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const eventStatus = eventRows[0]?.status as 'active' | 'inactive' | 'draft' | undefined;
    if (eventStatus !== 'inactive') {
      return res.status(400).json({
        message: 'Attendance is locked until the event is marked inactive/done.'
      });
    }

    const attended = req.body.attended ? 1 : 0;
    const [result] = await db.query<ResultSetHeader>(
      'UPDATE event_registrations SET attended = ? WHERE id = ? AND event_id = ?',
      [attended, req.params.registrationId, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Registration not found.' });
    }

    return res.json({ attended: Boolean(attended) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update attendance.' });
  }
});

export default router;