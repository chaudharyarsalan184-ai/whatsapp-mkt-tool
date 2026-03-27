import cron from 'node-cron';
import db from '../config/db.js';
import * as queueService from './queue.service.js';
import { dispatchCampaign } from '../controllers/campaigns.controller.js';

const scheduledJobs = [];

export async function initScheduler() {
  scheduledJobs.forEach((j) => j.stop());
  scheduledJobs.length = 0;

  scheduledJobs.push(
    cron.schedule('* * * * *', async () => {
      try {
        const now = new Date().toISOString();
        const { rows } = await db.execute({
          sql: `SELECT id FROM campaigns WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?`,
          args: [now],
        });
        for (const r of rows) {
          await dispatchCampaign(r.id);
        }
      } catch (e) {
        console.error('scheduled campaigns cron:', e);
      }
    })
  );

  scheduledJobs.push(
    cron.schedule('0 8 * * *', async () => {
      try {
        await runInactivityAutomations();
      } catch (e) {
        console.error('inactivity cron:', e);
      }
    })
  );

  await loadScheduleAutomations();
}


export async function reloadScheduler() {
  await initScheduler();
}

function parseJson(s, fb) {
  try {
    return JSON.parse(s || fb);
  } catch {
    return {};
  }
}

async function runInactivityAutomations() {
  const { rows: autos } = await db.execute({
    sql: `SELECT * FROM automations WHERE is_active = 1 AND trigger_type = 'inactivity'`,
    args: [],
  });
  for (const auto of autos) {
    const cfg = parseJson(auto.trigger_config, '{}');
    const days = Number(cfg.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { rows: contacts } = await db.execute({
      sql: `SELECT c.* FROM contacts c WHERE c.opted_in = 1 AND NOT EXISTS (
        SELECT 1 FROM message_logs ml WHERE ml.phone = c.phone AND ml.sent_at IS NOT NULL AND ml.sent_at >= ?
      )`,
      args: [since],
    });
    const { rows: trows } = await db.execute({
      sql: `SELECT * FROM templates WHERE id = ? AND status = 'APPROVED'`,
      args: [auto.template_id],
    });
    if (trows.length === 0) continue;
    const t = trows[0];
    const vars = parseJson(t.variables, '[]');
    const bodyParameters = vars.map(() => ({ type: 'text', text: '' }));
    for (const contact of contacts) {
      const ins = await db.execute({
        sql: `INSERT INTO message_logs (campaign_id, contact_id, phone, template_id, status) VALUES (NULL, ?, ?, ?, 'queued')`,
        args: [contact.id, contact.phone, t.id],
      });
      const messageLogId = Number(ins.lastInsertRowid);
      await queueService.enqueueTemplateJob({
        messageLogId,
        campaignId: null,
        phone: contact.phone,
        templateName: t.name,
        language: t.language || 'en_US',
        bodyParameters,
        templateId: t.id,
      });
    }
  }
}

async function runScheduleAutomation(auto) {
  const cfg = parseJson(auto.trigger_config, '{}');
  const tag = cfg.tag || '';
  const { rows: trows } = await db.execute({
    sql: `SELECT * FROM templates WHERE id = ? AND status = 'APPROVED'`,
    args: [auto.template_id],
  });
  if (trows.length === 0) return;
  const t = trows[0];
  const vars = parseJson(t.variables, '[]');
  const bodyParameters = vars.map(() => ({ type: 'text', text: '' }));
  const { rows: all } = await db.execute({
    sql: `SELECT * FROM contacts WHERE opted_in = 1`,
    args: [],
  });
  const contacts = tag
    ? all.filter((c) => {
        const tags = parseJson(c.tags, '[]');
        return tags.includes(tag);
      })
    : all;
  for (const contact of contacts) {
    const ins = await db.execute({
      sql: `INSERT INTO message_logs (campaign_id, contact_id, phone, template_id, status) VALUES (NULL, ?, ?, ?, 'queued')`,
      args: [contact.id, contact.phone, t.id],
    });
    const messageLogId = Number(ins.lastInsertRowid);
    await queueService.enqueueTemplateJob({
      messageLogId,
      campaignId: null,
      phone: contact.phone,
      templateName: t.name,
      language: t.language || 'en_US',
      bodyParameters,
      templateId: t.id,
    });
  }
}

async function loadScheduleAutomations() {
  const { rows } = await db.execute({
    sql: `SELECT * FROM automations WHERE is_active = 1 AND trigger_type = 'schedule'`,
    args: [],
  });
  for (const auto of rows) {
    const cfg = parseJson(auto.trigger_config, '{}');
    const expr = cfg.cron || '0 9 * * 1';
    try {
      const job = cron.schedule(
        expr,
        async () => {
          try {
            await runScheduleAutomation(auto);
          } catch (e) {
            console.error('schedule automation', auto.id, e);
          }
        },
        { timezone: cfg.timezone || 'America/New_York' }
      );
      scheduledJobs.push(job);
    } catch (e) {
      console.error('Invalid cron for automation', auto.id, e);
    }
  }
}
