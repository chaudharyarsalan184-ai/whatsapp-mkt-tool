import fs from 'fs';
import csv from 'csv-parser';
import db from '../config/db.js';
import { validateUSPhone } from '../middleware/usOnly.js';
import * as compliance from '../services/compliance.service.js';
import * as queueService from '../services/queue.service.js';

function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try {
    const j = JSON.parse(tags);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

export async function listContacts(req, res, next) {
  try {
    const tag = req.query.tag;
    const optedIn = req.query.opted_in;
    let sql = `SELECT * FROM contacts WHERE 1=1`;
    const args = [];
    if (tag) {
      sql += ` AND tags LIKE ?`;
      args.push(`%"${tag}"%`);
    }
    if (opted_in !== undefined && opted_in !== '') {
      sql += ` AND opted_in = ?`;
      args.push(opted_in === '1' || opted_in === 'true' ? 1 : 0);
    }
    sql += ` ORDER BY created_at DESC`;
    const { rows } = await db.execute({ sql, args });
    const contacts = rows.map((r) => ({
      ...r,
      tags: parseTags(r.tags),
      custom_fields: JSON.parse(r.custom_fields || '{}'),
    }));
    res.json({ contacts });
  } catch (err) {
    next(err);
  }
}

export async function createContact(req, res, next) {
  try {
    const { phone, name, email, tags } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone is required' });
    }
    const p = String(phone).trim();
    if (!validateUSPhone(p)) {
      return res.status(400).json({ error: 'Only US phone numbers (+1) are supported' });
    }
    const tagArr = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    const now = new Date().toISOString();
    const optedIn = req.body.opted_in !== undefined ? (req.body.opted_in ? 1 : 0) : 1;
    await db.execute({
      sql: `INSERT INTO contacts (phone, name, email, tags, opted_in, opted_in_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [p, name || null, email || null, JSON.stringify(tagArr), optedIn, optedIn ? now : null],
    });
    const { rows } = await db.execute({
      sql: `SELECT * FROM contacts WHERE phone = ?`,
      args: [p],
    });
    const row = rows[0];
    if (optedIn === 1) {
      await triggerOptInAutomations(row);
    }
    res.status(201).json({
      contact: {
        ...row,
        tags: parseTags(row.tags),
        custom_fields: JSON.parse(row.custom_fields || '{}'),
      },
    });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Contact with this phone already exists' });
    }
    next(err);
  }
}

async function triggerOptInAutomations(contact) {
  const { rows } = await db.execute({
    sql: `SELECT * FROM automations WHERE is_active = 1 AND trigger_type = 'opt_in'`,
    args: [],
  });
  for (const auto of rows) {
    const cfg = JSON.parse(auto.trigger_config || '{}');
    const delayMs = (Number(cfg.delay_hours) || 0) * 60 * 60 * 1000;
    const { rows: trows } = await db.execute({
      sql: `SELECT * FROM templates WHERE id = ? AND status = 'APPROVED'`,
      args: [auto.template_id],
    });
    if (trows.length === 0) continue;
    const t = trows[0];
    const vars = JSON.parse(t.variables || '[]');
    const varVals = {};
    vars.forEach((v, i) => {
      varVals[String(i + 1)] = '';
    });
    const bodyParameters = vars.map((_, i) => ({
      type: 'text',
      text: varVals[String(i + 1)] ?? '',
    }));
    const ins = await db.execute({
      sql: `INSERT INTO message_logs (campaign_id, contact_id, phone, template_id, status) VALUES (NULL, ?, ?, ?, 'queued')`,
      args: [contact.id, contact.phone, auto.template_id],
    });
    const messageLogId = Number(ins.lastInsertRowid);
    await queueService.enqueueTemplateJob(
      {
        messageLogId,
        campaignId: null,
        phone: contact.phone,
        templateName: t.name,
        language: t.language || 'en_US',
        bodyParameters,
        templateId: t.id,
      },
      { delay: delayMs }
    );
  }
}

export async function updateContact(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows: cur } = await db.execute({
      sql: `SELECT * FROM contacts WHERE id = ?`,
      args: [id],
    });
    if (cur.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    const prev = cur[0];
    const prevTags = parseTags(prev.tags);
    const { name, email, tags, custom_fields, opted_in } = req.body;
    let phone = prev.phone;
    if (req.body.phone !== undefined) {
      phone = String(req.body.phone).trim();
      if (!validateUSPhone(phone)) {
        return res.status(400).json({ error: 'Only US phone numbers (+1) are supported' });
      }
    }
    const tagArr =
      tags !== undefined
        ? Array.isArray(tags)
          ? tags
          : typeof tags === 'string'
            ? JSON.parse(tags || '[]')
            : []
        : prevTags;
    const newOpted = opted_in !== undefined ? (opted_in ? 1 : 0) : Number(prev.opted_in);
    const now = new Date().toISOString();
    let opted_in_at = prev.opted_in_at;
    let opted_out_at = prev.opted_out_at;
    if (newOpted === 1 && Number(prev.opted_in) === 0) opted_in_at = now;
    if (newOpted === 0) opted_out_at = now;
    if (newOpted === 1) opted_out_at = null;
    await db.execute({
      sql: `UPDATE contacts SET phone = ?, name = ?, email = ?, tags = ?, custom_fields = ?, opted_in = ?, opted_in_at = ?, opted_out_at = ? WHERE id = ?`,
      args: [
        phone,
        name !== undefined ? name : prev.name,
        email !== undefined ? email : prev.email,
        JSON.stringify(tagArr),
        custom_fields !== undefined ? JSON.stringify(custom_fields) : prev.custom_fields,
        newOpted,
        opted_in_at,
        opted_out_at,
        id,
      ],
    });
    const addedTags = tagArr.filter((t) => !prevTags.includes(t));
    for (const tname of addedTags) {
      await triggerTagAddedAutomations({ ...prev, phone, tags: tagArr }, tname);
    }
    const { rows } = await db.execute({
      sql: `SELECT * FROM contacts WHERE id = ?`,
      args: [id],
    });
    const row = rows[0];
    res.json({
      contact: {
        ...row,
        tags: parseTags(row.tags),
        custom_fields: JSON.parse(row.custom_fields || '{}'),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function triggerTagAddedAutomations(contact, tagName) {
  const { rows } = await db.execute({
    sql: `SELECT * FROM automations WHERE is_active = 1 AND trigger_type = 'tag_added'`,
    args: [],
  });
  for (const auto of rows) {
    const cfg = JSON.parse(auto.trigger_config || '{}');
    if ((cfg.tag || '').toLowerCase() !== tagName.toLowerCase()) continue;
    const delayMs = (Number(cfg.delay_hours) || 0) * 60 * 60 * 1000;
    const { rows: trows } = await db.execute({
      sql: `SELECT * FROM templates WHERE id = ? AND status = 'APPROVED'`,
      args: [auto.template_id],
    });
    if (trows.length === 0) continue;
    const t = trows[0];
    const vars = JSON.parse(t.variables || '[]');
    const bodyParameters = vars.map(() => ({ type: 'text', text: '' }));
    const ins = await db.execute({
      sql: `INSERT INTO message_logs (campaign_id, contact_id, phone, template_id, status) VALUES (NULL, ?, ?, ?, 'queued')`,
      args: [contact.id, contact.phone, auto.template_id],
    });
    const messageLogId = Number(ins.lastInsertRowid);
    await queueService.enqueueTemplateJob(
      {
        messageLogId,
        campaignId: null,
        phone: contact.phone,
        templateName: t.name,
        language: t.language || 'en_US',
        bodyParameters,
        templateId: t.id,
      },
      { delay: delayMs }
    );
  }
}

export async function deleteContact(req, res, next) {
  try {
    const id = Number(req.params.id);
    const r = await db.execute({
      sql: `DELETE FROM contacts WHERE id = ?`,
      args: [id],
    });
    if (r.rowsAffected === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function optOutContact(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows } = await db.execute({
      sql: `SELECT phone FROM contacts WHERE id = ?`,
      args: [id],
    });
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    await compliance.optOut(rows[0].phone);
    const { rows: updated } = await db.execute({
      sql: `SELECT * FROM contacts WHERE id = ?`,
      args: [id],
    });
    const row = updated[0];
    res.json({
      contact: {
        ...row,
        tags: parseTags(row.tags),
        custom_fields: JSON.parse(row.custom_fields || '{}'),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getTags(req, res, next) {
  try {
    const { rows } = await db.execute({
      sql: `SELECT tags FROM contacts`,
      args: [],
    });
    const set = new Set();
    for (const r of rows) {
      parseTags(r.tags).forEach((t) => set.add(t));
    }
    res.json({ tags: [...set].sort() });
  } catch (err) {
    next(err);
  }
}

export async function importCsv(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file required' });
  }
  const results = [];
  let total = 0;
  let imported = 0;
  let skipped = 0;
  let invalid = 0;
  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => {
          total++;
          results.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    for (const row of results) {
      let phone = (row.phone || row.Phone || '').trim();
      if (!phone.startsWith('+')) {
        const d = phone.replace(/\D/g, '');
        phone = d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith('1') ? `+${d}` : phone;
      }
      if (!validateUSPhone(phone)) {
        invalid++;
        continue;
      }
      const name = row.name || row.Name || null;
      const email = row.email || row.Email || null;
      const tagStr = row.tags || row.Tags || '';
      const tagArr = tagStr
        ? tagStr
            .split(',')
            .map((t) => t.trim().replace(/^"|"$/g, ''))
            .filter(Boolean)
        : [];
      try {
        const now = new Date().toISOString();
        const r = await db.execute({
          sql: `INSERT OR IGNORE INTO contacts (phone, name, email, tags, opted_in, opted_in_at) VALUES (?, ?, ?, ?, 1, ?)`,
          args: [phone, name, email, JSON.stringify(tagArr), now],
        });
        if (r.rowsAffected > 0) {
          imported++;
          const { rows: crow } = await db.execute({
            sql: `SELECT * FROM contacts WHERE phone = ?`,
            args: [phone],
          });
          if (crow.length) await triggerOptInAutomations(crow[0]);
        } else {
          skipped++;
        }
      } catch {
        invalid++;
      }
    }
    fs.unlink(req.file.path, () => {});
    res.json({ total, imported, skipped, invalid });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    next(err);
  }
}
