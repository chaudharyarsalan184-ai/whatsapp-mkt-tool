import db from '../config/db.js';
import * as whatsappService from '../services/whatsapp.service.js';
import * as compliance from '../services/compliance.service.js';

function normalizePhoneParam(phone) {
  let p = decodeURIComponent(phone).trim();
  if (!p.startsWith('+')) {
    const d = p.replace(/\D/g, '');
    p = d.length === 11 && d.startsWith('1') ? `+${d}` : d.length === 10 ? `+1${d}` : p;
  }
  return p;
}

export async function listConversations(req, res, next) {
  try {
    const { rows } = await db.execute({
      sql: `
        SELECT im.phone, im.content as last_message, im.received_at as last_at, ct.name as contact_name,
          (SELECT COUNT(*) FROM inbox_messages u WHERE u.phone = im.phone AND u.direction = 'inbound' AND u.is_read = 0) as unread
        FROM inbox_messages im
        LEFT JOIN contacts ct ON ct.phone = im.phone
        WHERE im.id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY phone ORDER BY received_at DESC, id DESC) AS rn
            FROM inbox_messages
          ) t WHERE rn = 1
        )
        ORDER BY im.received_at DESC
      `,
      args: [],
    });
    res.json({ conversations: rows });
  } catch (err) {
    next(err);
  }
}

export async function getThread(req, res, next) {
  try {
    const phone = normalizePhoneParam(req.params.phone);
    const { rows } = await db.execute({
      sql: `SELECT * FROM inbox_messages WHERE phone = ? ORDER BY received_at ASC`,
      args: [phone],
    });
    res.json({ messages: rows });
  } catch (err) {
    next(err);
  }
}

export async function reply(req, res, next) {
  try {
    const phone = normalizePhoneParam(req.params.phone);
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'text is required' });
    }
    const can = await compliance.canSendFreeText(phone);
    if (!can) {
      return res.status(403).json({ error: '24-hour messaging window has expired' });
    }
    const data = await whatsappService.sendTextMessage(phone, String(text).trim());
    const wamid = data?.messages?.[0]?.id;
    const now = new Date().toISOString();
    const { rows: c } = await db.execute({
      sql: `SELECT id FROM contacts WHERE phone = ?`,
      args: [phone],
    });
    const contactId = c[0]?.id || null;
    await db.execute({
      sql: `INSERT INTO inbox_messages (contact_id, phone, direction, message_type, content, meta_message_id, is_read, received_at) VALUES (?, ?, 'outbound', 'text', ?, ?, 1, ?)`,
      args: [contactId, phone, String(text).trim(), wamid, now],
    });
    res.json({ success: true, meta_message_id: wamid });
  } catch (err) {
    next(err);
  }
}

export async function markRead(req, res, next) {
  try {
    const phone = normalizePhoneParam(req.params.phone);
    await db.execute({
      sql: `UPDATE inbox_messages SET is_read = 1 WHERE phone = ? AND direction = 'inbound'`,
      args: [phone],
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function unreadCount(req, res, next) {
  try {
    const { rows } = await db.execute({
      sql: `SELECT COUNT(*) as n FROM inbox_messages WHERE direction = 'inbound' AND is_read = 0`,
      args: [],
    });
    res.json({ count: rows[0]?.n || 0 });
  } catch (err) {
    next(err);
  }
}
