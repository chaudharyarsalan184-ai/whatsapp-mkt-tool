import db from '../config/db.js';
import { reloadScheduler } from '../services/scheduler.service.js';

function parseJson(s, fb) {
  try {
    return JSON.parse(s || fb);
  } catch {
    return typeof fb === 'string' ? JSON.parse(fb) : fb;
  }
}

export async function listAutomations(req, res, next) {
  try {
    const { rows } = await db.execute({
      sql: `SELECT a.*, t.name as template_name FROM automations a LEFT JOIN templates t ON t.id = a.template_id ORDER BY a.created_at DESC`,
      args: [],
    });
    res.json({
      automations: rows.map((r) => ({
        ...r,
        trigger_config: parseJson(r.trigger_config, '{}'),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function createAutomation(req, res, next) {
  try {
    const { name, trigger_type, trigger_config, template_id, is_active } = req.body;
    if (!name || !trigger_type || !template_id) {
      return res.status(400).json({ error: 'name, trigger_type, and template_id are required' });
    }
    const cfg =
      typeof trigger_config === 'object' && trigger_config
        ? trigger_config
        : {};
    const ins = await db.execute({
      sql: `INSERT INTO automations (name, trigger_type, trigger_config, template_id, is_active) VALUES (?, ?, ?, ?, ?)`,
      args: [name, trigger_type, JSON.stringify(cfg), template_id, is_active === false ? 0 : 1],
    });
    const id = Number(ins.lastInsertRowid);
    await reloadScheduler();
    const { rows } = await db.execute({
      sql: `SELECT * FROM automations WHERE id = ?`,
      args: [id],
    });
    const r = rows[0];
    res.status(201).json({
      automation: { ...r, trigger_config: parseJson(r.trigger_config, '{}') },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAutomation(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { name, trigger_type, trigger_config, template_id, is_active } = req.body;
    const { rows: cur } = await db.execute({
      sql: `SELECT * FROM automations WHERE id = ?`,
      args: [id],
    });
    if (cur.length === 0) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    const prev = cur[0];
    const cfg =
      trigger_config !== undefined
        ? typeof trigger_config === 'object'
          ? trigger_config
          : parseJson(String(trigger_config), '{}')
        : parseJson(prev.trigger_config, '{}');
    await db.execute({
      sql: `UPDATE automations SET name = ?, trigger_type = ?, trigger_config = ?, template_id = ?, is_active = ? WHERE id = ?`,
      args: [
        name !== undefined ? name : prev.name,
        trigger_type !== undefined ? trigger_type : prev.trigger_type,
        JSON.stringify(cfg),
        template_id !== undefined ? template_id : prev.template_id,
        is_active !== undefined ? (is_active ? 1 : 0) : prev.is_active,
        id,
      ],
    });
    await reloadScheduler();
    const { rows } = await db.execute({
      sql: `SELECT * FROM automations WHERE id = ?`,
      args: [id],
    });
    const r = rows[0];
    res.json({
      automation: { ...r, trigger_config: parseJson(r.trigger_config, '{}') },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAutomation(req, res, next) {
  try {
    const id = Number(req.params.id);
    const r = await db.execute({
      sql: `DELETE FROM automations WHERE id = ?`,
      args: [id],
    });
    if (r.rowsAffected === 0) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    await reloadScheduler();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function toggleAutomation(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows } = await db.execute({
      sql: `SELECT is_active FROM automations WHERE id = ?`,
      args: [id],
    });
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    const nextVal = rows[0].is_active ? 0 : 1;
    await db.execute({
      sql: `UPDATE automations SET is_active = ? WHERE id = ?`,
      args: [nextVal, id],
    });
    await reloadScheduler();
    const { rows: out } = await db.execute({
      sql: `SELECT * FROM automations WHERE id = ?`,
      args: [id],
    });
    const r = out[0];
    res.json({
      automation: { ...r, trigger_config: parseJson(r.trigger_config, '{}') },
    });
  } catch (err) {
    next(err);
  }
}
