import db from '../config/db.js';
import * as whatsappService from '../services/whatsapp.service.js';

function parseJson(str, fb) {
  try {
    return JSON.parse(str || fb);
  } catch {
    return typeof fb === 'string' ? JSON.parse(fb) : fb;
  }
}

function extractVariablesFromBody(body) {
  if (!body) return [];
  const re = /\{\{(\d+)\}\}/g;
  const set = new Set();
  let m;
  while ((m = re.exec(body)) !== null) {
    set.add(m[1]);
  }
  return [...set].sort((a, b) => Number(a) - Number(b));
}

export async function listTemplates(req, res, next) {
  try {
    const { rows } = await db.execute({
      sql: `SELECT * FROM templates ORDER BY created_at DESC`,
      args: [],
    });
    const templates = rows.map((r) => ({
      ...r,
      buttons: parseJson(r.buttons, '[]'),
      variables: parseJson(r.variables, '[]'),
    }));
    res.json({ templates });
  } catch (err) {
    next(err);
  }
}

export async function createTemplate(req, res, next) {
  try {
    const {
      name,
      category,
      language,
      header_type,
      header_content,
      body,
      footer,
      buttons,
    } = req.body;
    if (!name || !category || !body) {
      return res.status(400).json({ error: 'name, category, and body are required' });
    }
    const vars = extractVariablesFromBody(body);
    const btnJson = JSON.stringify(Array.isArray(buttons) ? buttons : []);
    const row = {
      name: name.trim().toLowerCase().replace(/\s+/g, '_'),
      category,
      language: language || 'en_US',
      header_type: header_type || null,
      header_content: header_content || null,
      body,
      footer: footer || null,
      buttons: btnJson,
      variables: JSON.stringify(vars),
      status: 'PENDING',
    };
    let metaId = null;
    try {
      const metaRes = await whatsappService.submitTemplate(row);
      metaId = metaRes.id || metaRes.submittedName || row.name;
    } catch (e) {
      console.error('Meta submitTemplate failed, saving draft locally:', e);
    }
    const ins = await db.execute({
      sql: `INSERT INTO templates (name, meta_template_id, category, language, status, header_type, header_content, body, footer, buttons, variables) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        row.name,
        metaId,
        row.category,
        row.language,
        metaId ? 'PENDING' : 'PENDING',
        row.header_type,
        row.header_content,
        row.body,
        row.footer,
        row.buttons,
        row.variables,
      ],
    });
    const id = Number(ins.lastInsertRowid);
    const { rows } = await db.execute({
      sql: `SELECT * FROM templates WHERE id = ?`,
      args: [id],
    });
    const t = rows[0];
    res.status(201).json({
      template: {
        ...t,
        buttons: parseJson(t.buttons, '[]'),
        variables: parseJson(t.variables, '[]'),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function syncTemplates(req, res, next) {
  try {
    const data = await whatsappService.listTemplatesFromMeta();
    const list = data.data || [];
    for (const w of list) {
      const name = w.name;
      const lang = (w.language || 'en_US').replace('-', '_');
      const category = w.category || 'MARKETING';
      const status = w.status || 'PENDING';
      let body = '';
      let headerType = null;
      let headerContent = null;
      let footer = null;
      const buttons = [];
      for (const c of w.components || []) {
        if (c.type === 'BODY') body = c.text || '';
        if (c.type === 'HEADER') {
          headerType = c.format || 'TEXT';
          if (c.text) headerContent = c.text;
          if (c.example?.header_handle?.[0]) headerContent = c.example.header_handle[0];
        }
        if (c.type === 'FOOTER') footer = c.text || '';
        if (c.type === 'BUTTONS') {
          for (const b of c.buttons || []) {
            if (b.type === 'URL') buttons.push({ type: 'URL', label: b.text, value: b.url });
            else buttons.push({ type: 'QUICK_REPLY', label: b.text, value: b.text });
          }
        }
      }
      const vars = extractVariablesFromBody(body);
      const { rows: existing } = await db.execute({
        sql: `SELECT id FROM templates WHERE name = ? AND language = ?`,
        args: [name, lang],
      });
      if (existing.length > 0) {
        await db.execute({
          sql: `UPDATE templates SET meta_template_id = ?, category = ?, status = ?, header_type = ?, header_content = ?, body = ?, footer = ?, buttons = ?, variables = ? WHERE id = ?`,
          args: [
            w.id || name,
            category,
            status,
            headerType,
            headerContent,
            body,
            footer,
            JSON.stringify(buttons),
            JSON.stringify(vars),
            existing[0].id,
          ],
        });
      } else {
        await db.execute({
          sql: `INSERT INTO templates (name, meta_template_id, category, language, status, header_type, header_content, body, footer, buttons, variables) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            name,
            w.id || name,
            category,
            lang,
            status,
            headerType,
            headerContent,
            body,
            footer,
            JSON.stringify(buttons),
            JSON.stringify(vars),
          ],
        });
      }
    }
    const { rows } = await db.execute({
      sql: `SELECT * FROM templates ORDER BY created_at DESC`,
      args: [],
    });
    res.json({
      synced: list.length,
      templates: rows.map((r) => ({
        ...r,
        buttons: parseJson(r.buttons, '[]'),
        variables: parseJson(r.variables, '[]'),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function getTemplate(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows } = await db.execute({
      sql: `SELECT * FROM templates WHERE id = ?`,
      args: [id],
    });
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    const t = rows[0];
    res.json({
      template: {
        ...t,
        buttons: parseJson(t.buttons, '[]'),
        variables: parseJson(t.variables, '[]'),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req, res, next) {
  try {
    const id = Number(req.params.id);
    const r = await db.execute({
      sql: `DELETE FROM templates WHERE id = ?`,
      args: [id],
    });
    if (r.rowsAffected === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
