import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { JWT_EXPIRES_IN, JWT_SECRET } from '../config/env.js';

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    const hash = await bcrypt.hash(password, 10);
    await db.execute({
      sql: `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`,
      args: [name.trim(), email.trim().toLowerCase(), hash],
    });
    const { rows } = await db.execute({
      sql: `SELECT id, name, email, role, created_at FROM users WHERE email = ?`,
      args: [email.trim().toLowerCase()],
    });
    const user = rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.status(201).json({ user, token });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const { rows } = await db.execute({
      sql: `SELECT id, name, email, password, role FROM users WHERE email = ?`,
      args: [email.trim().toLowerCase()],
    });
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    delete user.password;
    res.json({ user, token });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const { rows } = await db.execute({
      sql: `SELECT id, name, email, role, created_at FROM users WHERE id = ?`,
      args: [req.user.id],
    });
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
}
