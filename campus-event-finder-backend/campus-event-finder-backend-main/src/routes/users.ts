import { Router, Request, Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../db';

interface UserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
}

const router = Router();

export const DEMO_DEPARTMENT_ACCOUNTS = [
  { fullName: 'CS Admin', email: 'cs.admin@liceo.edu.ph', password: 'CSAdmin123', department: 'Computer Science Department', role: 'admin' },
  { fullName: 'CS Student', email: 'cs.student@liceo.edu.ph', password: 'CSStudent123', department: 'Computer Science Department', role: 'student' },
  { fullName: 'Engineering Admin', email: 'eng.admin@liceo.edu.ph', password: 'EngAdmin123', department: 'Engineering Department', role: 'admin' },
  { fullName: 'Engineering Student', email: 'eng.student@liceo.edu.ph', password: 'EngStudent123', department: 'Engineering Department', role: 'student' },
  { fullName: 'Healthcare Admin', email: 'health.admin@liceo.edu.ph', password: 'HealthAdmin123', department: 'Healthcare Department', role: 'admin' },
  { fullName: 'Healthcare Student', email: 'health.student@liceo.edu.ph', password: 'HealthStudent123', department: 'Healthcare Department', role: 'student' },
  { fullName: 'IT Admin', email: 'it.admin@liceo.edu.ph', password: 'ITAdmin123', department: 'Information Technology Department', role: 'admin' },
  { fullName: 'IT Student', email: 'it.student@liceo.edu.ph', password: 'ITStudent123', department: 'Information Technology Department', role: 'student' },
  { fullName: 'Business Admin', email: 'business.admin@liceo.edu.ph', password: 'BusinessAdmin123', department: 'Business Department', role: 'admin' },
  { fullName: 'Business Student', email: 'business.student@liceo.edu.ph', password: 'BusinessStudent123', department: 'Business Department', role: 'student' },
  { fullName: 'Sports Admin', email: 'sports.admin@liceo.edu.ph', password: 'SportsAdmin123', department: 'Sports Department', role: 'admin' },
  { fullName: 'Sports Student', email: 'sports.student@liceo.edu.ph', password: 'SportsStudent123', department: 'Sports Department', role: 'student' },
  { fullName: 'Fine Arts Admin', email: 'arts.admin@liceo.edu.ph', password: 'ArtsAdmin123', department: 'Fine Arts Department', role: 'admin' },
  { fullName: 'Fine Arts Student', email: 'arts.student@liceo.edu.ph', password: 'ArtsStudent123', department: 'Fine Arts Department', role: 'student' },
  { fullName: 'Student Affairs Admin', email: 'affairs.admin@liceo.edu.ph', password: 'AffairsAdmin123', department: 'Student Affairs Department', role: 'admin' },
  { fullName: 'Student Affairs Student', email: 'affairs.student@liceo.edu.ph', password: 'AffairsStudent123', department: 'Student Affairs Department', role: 'student' },
  { fullName: 'Main Admin', email: 'main.admin@liceo.edu.ph', password: 'MainAdmin123', department: 'Main Administration', role: 'main-admin' }
];

async function seedUsersIfEmpty(): Promise<void> {
  const insertSql = 'INSERT IGNORE INTO users (name, email, password, department, role) VALUES (?, ?, ?, ?, ?)';
  for (const user of DEMO_DEPARTMENT_ACCOUNTS) {
    await db.query(insertSql, [user.fullName, user.email, user.password, user.department, user.role]);
  }
}

// GET /api/users
router.get('/', async (_req: Request, res: Response) => {
  try {
    await seedUsersIfEmpty();
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id, name AS fullName, email, department, role FROM users ORDER BY id DESC'
    );
    return res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user id.' });
    }

    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id, name AS fullName, email, department, role FROM users WHERE id = ?',
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ message: 'Failed to fetch user.' });
  }
});

// POST /api/users/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, department, role } = req.body;

    if (!name || !email || !password || !department) {
      return res.status(400).json({ message: 'Name, email, password, and department are required.' });
    }

    const assignedRole = role || 'student';

    const [existing] = await db.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const [result] = await db.query<ResultSetHeader>(
      'INSERT INTO users (name, email, password, department, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, password, department, assignedRole]
    );

    return res.status(201).json({
      id: result.insertId,
      name,
      email,
      department,
      role: assignedRole
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({ message: 'Failed to create user.' });
  }
});

// POST /api/users/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    await seedUsersIfEmpty();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id, name AS fullName, email, password, department, role, created_at AS createdAt FROM users WHERE email = ? AND password = ? LIMIT 1',
      [email, password]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ message: 'Failed to log in.' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user id.' });
    }

    const { name, email } = req.body as { name?: string; email?: string };

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required.' });
    }

    const [result] = await db.query<ResultSetHeader>(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({ id: userId, name, email });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ message: 'Failed to update user.' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user id.' });
    }

    const [result] = await db.query<ResultSetHeader>(
      'DELETE FROM users WHERE id = ?',
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({ message: 'User deleted.' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ message: 'Failed to delete user.' });
  }
});

// POST /api/users/admin-codes
router.post('/admin-codes', async (req: Request, res: Response) => {
  try {
    const { created_by } = req.body;
    if (!created_by) return res.status(400).json({ message: 'Created by is required.' });

    let code: string;
    let exists = true;
    do {
      code = `ADMIN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const [rows] = await db.query<RowDataPacket[]>('SELECT id FROM admin_codes WHERE code = ? AND used = 0', [code]);
      exists = rows.length > 0;
    } while (exists);

    await db.query('INSERT INTO admin_codes (code, created_by) VALUES (?, ?)', [code, created_by]);
    return res.json({ code });
  } catch (error) {
    console.error('Error generating admin code:', error);
    return res.status(500).json({ message: 'Failed to generate admin code.' });
  }
});

// GET /api/users/admin-codes
router.get('/admin-codes', async (_req: Request, res: Response) => {
  try {
    const [rows] = await db.query<RowDataPacket[]>('SELECT code, created_by, created_at FROM admin_codes WHERE used = 0 ORDER BY created_at DESC');
    return res.json({ codes: rows });
  } catch (error) {
    console.error('Error fetching admin codes:', error);
    return res.status(500).json({ message: 'Failed to fetch admin codes.' });
  }
});

// POST /api/users/reset-tokens
router.post('/reset-tokens', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    let token: string;
    let exists = true;
    do {
      token = `RESET-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const [rows] = await db.query<RowDataPacket[]>('SELECT id FROM reset_tokens WHERE token = ? AND used = 0', [token]);
      exists = rows.length > 0;
    } while (exists);

    await db.query('INSERT INTO reset_tokens (email, token) VALUES (?, ?)', [email, token]);
    const link = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
    return res.json({ token, link });
  } catch (error) {
    console.error('Error generating reset token:', error);
    return res.status(500).json({ message: 'Failed to generate reset token.' });
  }
});

// POST /api/users/validate-admin-code
router.post('/validate-admin-code', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Code is required.' });

    const [rows] = await db.query<RowDataPacket[]>('SELECT id FROM admin_codes WHERE code = ? AND used = 0', [code.toUpperCase()]);
    if (!rows.length) return res.status(400).json({ message: 'Invalid or used admin code.' });

    await db.query('UPDATE admin_codes SET used = 1 WHERE id = ?', [rows[0].id]);
    return res.json({ valid: true });
  } catch (error) {
    console.error('Error validating admin code:', error);
    return res.status(500).json({ message: 'Failed to validate admin code.' });
  }
});

// POST /api/users/validate-reset-token
router.post('/validate-reset-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token is required.' });

    const [rows] = await db.query<RowDataPacket[]>('SELECT email FROM reset_tokens WHERE token = ? AND used = 0', [token]);
    if (!rows.length) return res.status(400).json({ message: 'Invalid or used reset token.' });

    return res.json({ valid: true, email: rows[0].email });
  } catch (error) {
    console.error('Error validating reset token:', error);
    return res.status(500).json({ message: 'Failed to validate reset token.' });
  }
});

export default router;
