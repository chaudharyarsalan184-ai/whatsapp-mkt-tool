import db from '../config/db.js';
import { validateUSPhone } from '../middleware/usOnly.js';
import * as whatsappService from './whatsapp.service.js';

const US_REGEX = /^\+1[2-9]\d{9}$/;

export function validateUSNumber(phone) {
  const p = String(phone || '').trim();
  if (!US_REGEX.test(p)) {
    const err = new Error('Only US phone numbers (+1) are supported');
    err.status = 400;
    throw err;
  }
  return p;
}

export async function optOut(phone) {
  const p = validateUSNumber(phone);
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE contacts SET opted_in = 0, opted_out_at = ? WHERE phone = ?`,
    args: [now, p],
  });
  await db.execute({
    sql: `INSERT INTO opt_out_log (phone, reason, created_at) VALUES (?, 'user_request', ?)`,
    args: [p, now],
  });
  try {
    await whatsappService.sendTextMessage(
      p,
      "You've been unsubscribed from our messages. Reply START to opt back in."
    );
  } catch (e) {
    console.error('optOut auto-reply failed:', e?.response?.data || e.message);
  }
}

export async function optIn(phone) {
  const p = validateUSNumber(phone);
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE contacts SET opted_in = 1, opted_in_at = ?, opted_out_at = NULL WHERE phone = ?`,
    args: [now, p],
  });
}

export async function isOptedIn(phone) {
  const p = String(phone || '').trim();
  if (!validateUSPhone(p)) return false;
  const { rows } = await db.execute({
    sql: `SELECT opted_in FROM contacts WHERE phone = ?`,
    args: [p],
  });
  if (rows.length === 0) return true;
  return Number(rows[0].opted_in) === 1;
}

export async function canSendFreeText(phone) {
  const p = validateUSNumber(phone);
  const { rows } = await db.execute({
    sql: `SELECT received_at FROM inbox_messages WHERE phone = ? AND direction = 'inbound' ORDER BY received_at DESC LIMIT 1`,
    args: [p],
  });
  if (rows.length === 0) return false;
  const last = new Date(rows[0].received_at);
  const ms = Date.now() - last.getTime();
  return ms <= 24 * 60 * 60 * 1000;
}
