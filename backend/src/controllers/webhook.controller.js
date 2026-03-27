import db from '../config/db.js';
import { META_WEBHOOK_VERIFY_TOKEN } from '../config/env.js';
import * as compliance from '../services/compliance.service.js';
import * as whatsappService from '../services/whatsapp.service.js';

function normalizePhone(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) d = '1' + d;
  if (!d.startsWith('1') || d.length !== 11) return null;
  return `+${d}`;
}

export function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === META_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

async function findOrCreateContact(phone) {
  const { rows } = await db.execute({
    sql: `SELECT * FROM contacts WHERE phone = ?`,
    args: [phone],
  });
  if (rows.length > 0) return rows[0];
  const now = new Date().toISOString();
  const ins = await db.execute({
    sql: `INSERT INTO contacts (phone, name, email, tags, opted_in, opted_in_at) VALUES (?, NULL, NULL, '[]', 1, ?)`,
    args: [phone, now],
  });
  const id = Number(ins.lastInsertRowid);
  const { rows: out } = await db.execute({
    sql: `SELECT * FROM contacts WHERE id = ?`,
    args: [id],
  });
  return out[0];
}

export async function receiveWebhook(req, res) {
  res.sendStatus(200);
  setImmediate(() => processWebhookBody(req.body).catch((e) => console.error('webhook process', e)));
}

async function processWebhookBody(body) {
  const entries = body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const value = change.value || {};
      const statuses = value.statuses || [];
      for (const st of statuses) {
        await handleStatus(st);
      }
      const messages = value.messages || [];
      const contacts = value.contacts || [];
      const profileName = contacts[0]?.profile?.name;
      for (const msg of messages) {
        await handleInboundMessage(msg, profileName);
      }
    }
  }
}

async function handleStatus(st) {
  const metaId = st.id;
  const status = (st.status || '').toLowerCase();
  const ts = st.timestamp ? new Date(Number(st.timestamp) * 1000).toISOString() : new Date().toISOString();
  const { rows } = await db.execute({
    sql: `SELECT * FROM message_logs WHERE meta_message_id = ?`,
    args: [metaId],
  });
  if (rows.length === 0) return;
  const log = rows[0];
  if (status === 'delivered') {
    if (!log.delivered_at) {
      await db.execute({
        sql: `UPDATE message_logs SET status = 'delivered', delivered_at = ? WHERE id = ?`,
        args: [ts, log.id],
      });
      if (log.campaign_id) {
        await db.execute({
          sql: `UPDATE campaigns SET delivered_count = delivered_count + 1 WHERE id = ?`,
          args: [log.campaign_id],
        });
      }
    }
  }
  if (status === 'read') {
    if (!log.read_at) {
      await db.execute({
        sql: `UPDATE message_logs SET status = 'read', read_at = ? WHERE id = ?`,
        args: [ts, log.id],
      });
      if (log.campaign_id) {
        await db.execute({
          sql: `UPDATE campaigns SET read_count = read_count + 1 WHERE id = ?`,
          args: [log.campaign_id],
        });
      }
    }
  }
  if (status === 'failed') {
    await db.execute({
      sql: `UPDATE message_logs SET status = 'failed', error_message = ? WHERE id = ?`,
      args: [JSON.stringify(st.errors || {}), log.id],
    });
  }
}

async function handleInboundMessage(msg, profileName) {
  const from = msg.from;
  const phone = normalizePhone(from);
  if (!phone) return;
  const contact = await findOrCreateContact(phone);
  if (profileName && !contact.name) {
    await db.execute({
      sql: `UPDATE contacts SET name = ? WHERE id = ?`,
      args: [profileName, contact.id],
    });
  }
  let text = '';
  if (msg.type === 'text') {
    text = msg.text?.body || '';
  } else {
    text = `[${msg.type}]`;
  }
  const metaId = msg.id;
  const ts = msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO inbox_messages (contact_id, phone, direction, message_type, content, meta_message_id, is_read, received_at) VALUES (?, ?, 'inbound', ?, ?, ?, 0, ?)`,
    args: [contact.id, phone, msg.type || 'text', text, metaId, ts],
  });
  const upper = text.trim().toUpperCase();
  if (upper === 'STOP' || upper === 'UNSUBSCRIBE') {
    await compliance.optOut(phone);
  } else if (upper === 'START') {
    await compliance.optIn(phone);
    try {
      await whatsappService.sendTextMessage(
        phone,
        'You are subscribed to travel updates. Reply STOP to unsubscribe.'
      );
    } catch (e) {
      console.error('START reply:', e?.response?.data || e.message);
    }
  }
}
