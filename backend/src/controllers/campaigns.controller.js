import db from '../config/db.js';
import * as queueService from '../services/queue.service.js';

function parseJson(str, fallback) {
  try {
    return JSON.parse(str || (typeof fallback === 'string' ? fallback : '[]'));
  } catch {
    return fallback;
  }
}

function matchSegment(contactTags, segmentTags) {
  if (!segmentTags.length) return true;
  return segmentTags.some((s) => contactTags.includes(s));
}

export async function listCampaigns(req, res, next) {
  try {
    const { rows } = await db.execute({
      sql: `SELECT * FROM campaigns ORDER BY created_at DESC`,
      args: [],
    });
    const campaigns = rows.map((r) => ({
      ...r,
      segment_tags: parseJson(r.segment_tags, []),
      variable_values: parseJson(r.variable_values, {}),
    }));
    res.json({ campaigns });
  } catch (err) {
    next(err);
  }
}

export async function createCampaign(req, res, next) {
  try {
    const { name, template_id, segment_tags, scheduled_at, variable_values } = req.body;
    if (!name || !template_id) {
      return res.status(400).json({ error: 'name and template_id are required' });
    }
    const tags = Array.isArray(segment_tags) ? segment_tags : [];
    const vars = variable_values && typeof variable_values === 'object' ? variable_values : {};
    const status = scheduled_at ? 'scheduled' : 'draft';
    const now = new Date().toISOString();
    const ins = await db.execute({
      sql: `INSERT INTO campaigns (name, template_id, segment_tags, variable_values, status, scheduled_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [name, template_id, JSON.stringify(tags), JSON.stringify(vars), status, scheduled_at || null],
    });
    const id = Number(ins.lastInsertRowid);
    const { rows } = await db.execute({
      sql: `SELECT * FROM campaigns WHERE id = ?`,
      args: [id],
    });
    const row = rows[0];
    res.status(201).json({
      campaign: {
        ...row,
        segment_tags: parseJson(row.segment_tags, []),
        variable_values: parseJson(row.variable_values, {}),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getCampaign(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows } = await db.execute({
      sql: `SELECT * FROM campaigns WHERE id = ?`,
      args: [id],
    });
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const c = rows[0];
    const { rows: logs } = await db.execute({
      sql: `SELECT ml.*, ct.name as contact_name FROM message_logs ml LEFT JOIN contacts ct ON ct.id = ml.contact_id WHERE ml.campaign_id = ? ORDER BY ml.created_at DESC`,
      args: [id],
    });
    res.json({
      campaign: {
        ...c,
        segment_tags: parseJson(c.segment_tags, []),
        variable_values: parseJson(c.variable_values, {}),
      },
      message_logs: logs,
    });
  } catch (err) {
    next(err);
  }
}

function buildBodyParameters(template, variableValues) {
  const vars = parseJson(template.variables, []);
  const vv = typeof variableValues === 'object' && variableValues ? variableValues : {};
  return vars.map((name, idx) => {
    const key = String(name);
    const v =
      vv[key] !== undefined
        ? vv[key]
        : vv[String(idx + 1)] !== undefined
          ? vv[String(idx + 1)]
          : '';
    return { type: 'text', text: String(v) };
  });
}

export async function dispatchCampaign(campaignId) {
  const { rows: crows } = await db.execute({
    sql: `SELECT * FROM campaigns WHERE id = ?`,
    args: [campaignId],
  });
  if (crows.length === 0) return;
  const campaign = crows[0];
  if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
    return;
  }
  const { rows: trows } = await db.execute({
    sql: `SELECT * FROM templates WHERE id = ?`,
    args: [campaign.template_id],
  });
  if (trows.length === 0) {
    await db.execute({
      sql: `UPDATE campaigns SET status = 'failed' WHERE id = ?`,
      args: [campaignId],
    });
    return;
  }
  const template = trows[0];
  if (template.status !== 'APPROVED') {
    await db.execute({
      sql: `UPDATE campaigns SET status = 'failed' WHERE id = ?`,
      args: [campaignId],
    });
    return;
  }
  const segmentTags = parseJson(campaign.segment_tags, []);
  const variableValues = parseJson(campaign.variable_values, {});
  const { rows: allContacts } = await db.execute({
    sql: `SELECT * FROM contacts WHERE opted_in = 1`,
    args: [],
  });
  const matched = allContacts.filter((c) => {
    const tags = parseJson(c.tags, []);
    return matchSegment(tags, segmentTags);
  });
  if (matched.length === 0) {
    await db.execute({
      sql: `UPDATE campaigns SET status = 'failed', total_contacts = 0 WHERE id = ?`,
      args: [campaignId],
    });
    return;
  }
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE campaigns SET status = 'sending', total_contacts = ?, sent_at = ?, sent_count = 0, delivered_count = 0, read_count = 0, failed_count = 0, skipped_count = 0 WHERE id = ?`,
    args: [matched.length, now, campaignId],
  });
  const bodyParameters = buildBodyParameters(template, variableValues);
  for (const contact of matched) {
    const ins = await db.execute({
      sql: `INSERT INTO message_logs (campaign_id, contact_id, phone, template_id, status) VALUES (?, ?, ?, ?, 'queued')`,
      args: [campaignId, contact.id, contact.phone, template.id],
    });
    const messageLogId = Number(ins.lastInsertRowid);
    await queueService.enqueueTemplateJob({
      messageLogId,
      campaignId,
      phone: contact.phone,
      templateName: template.name,
      language: template.language || 'en_US',
      bodyParameters,
      templateId: template.id,
    });
  }
}

export async function sendCampaign(req, res, next) {
  try {
    const id = Number(req.params.id);
    await dispatchCampaign(id);
    const { rows } = await db.execute({
      sql: `SELECT * FROM campaigns WHERE id = ?`,
      args: [id],
    });
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const row = rows[0];
    res.json({
      campaign: {
        ...row,
        segment_tags: parseJson(row.segment_tags, []),
        variable_values: parseJson(row.variable_values, {}),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteCampaign(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows } = await db.execute({
      sql: `SELECT status FROM campaigns WHERE id = ?`,
      args: [id],
    });
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    if (rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Only draft campaigns can be deleted' });
    }
    await db.execute({
      sql: `DELETE FROM campaigns WHERE id = ?`,
      args: [id],
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
