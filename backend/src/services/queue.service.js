import { Queue, Worker } from 'bullmq';
import { REDIS_DISABLED } from '../config/env.js';
import { getRedisConnection } from '../config/redis.js';
import * as whatsappService from './whatsapp.service.js';
import * as compliance from './compliance.service.js';
import db from '../config/db.js';

export const MESSAGE_QUEUE_NAME = 'whatsapp-messages';

let messageQueue = null;

function getQueue() {
  if (REDIS_DISABLED) {
    throw new Error('Message queue requires Redis. Set REDIS_URL in .env');
  }
  if (!messageQueue) {
    messageQueue = new Queue(MESSAGE_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    });
  }
  return messageQueue;
}

async function tryCompleteCampaign(campaignId) {
  if (!campaignId) return;
  const { rows } = await db.execute({
    sql: `SELECT total_contacts, sent_count, failed_count, skipped_count, status FROM campaigns WHERE id = ?`,
    args: [campaignId],
  });
  const c = rows[0];
  if (!c || c.status !== 'sending') return;
  const total = Number(c.total_contacts) || 0;
  const done =
    (Number(c.sent_count) || 0) +
    (Number(c.failed_count) || 0) +
    (Number(c.skipped_count) || 0);
  if (total > 0 && done >= total) {
    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE campaigns SET status = 'sent', sent_at = COALESCE(sent_at, ?) WHERE id = ?`,
      args: [now, campaignId],
    });
  }
}

async function processSendJob(job) {
  const { messageLogId, campaignId, phone, templateName, language, bodyParameters } = job.data;

  const opted = await compliance.isOptedIn(phone);
  if (!opted) {
    await db.execute({
      sql: `UPDATE message_logs SET status = 'skipped', error_message = ? WHERE id = ?`,
      args: ['skipped_opted_out', messageLogId],
    });
    if (campaignId) {
      await db.execute({
        sql: `UPDATE campaigns SET skipped_count = skipped_count + 1 WHERE id = ?`,
        args: [campaignId],
      });
      await tryCompleteCampaign(campaignId);
    }
    return { skipped: true };
  }

  const params = (bodyParameters || []).map((p) =>
    typeof p === 'string' ? { type: 'text', text: p } : p
  );

  try {
    const res = await whatsappService.sendTemplateMessage(phone, templateName, language, params);
    const wamid = res?.messages?.[0]?.id || null;
    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE message_logs SET status = 'sent', meta_message_id = ?, sent_at = ?, error_message = NULL WHERE id = ?`,
      args: [wamid, now, messageLogId],
    });
    if (campaignId) {
      await db.execute({
        sql: `UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?`,
        args: [campaignId],
      });
      await tryCompleteCampaign(campaignId);
    }
    return { sent: true, wamid };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message || 'send failed';
    await db.execute({
      sql: `UPDATE message_logs SET status = 'failed', error_message = ? WHERE id = ?`,
      args: [String(msg).slice(0, 500), messageLogId],
    });
    if (campaignId) {
      await db.execute({
        sql: `UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?`,
        args: [campaignId],
      });
      await tryCompleteCampaign(campaignId);
    }
    throw err;
  }
}

export function startMessageWorker() {
  if (REDIS_DISABLED) {
    console.warn('[queue] Worker not started (Redis disabled)');
    return null;
  }
  const worker = new Worker(
    MESSAGE_QUEUE_NAME,
    async (job) => {
      if (job.name === 'send-template') {
        return processSendJob(job);
      }
      return processSendJob(job);
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
      limiter: { max: 80, duration: 1000 },
    }
  );
  worker.on('failed', (job, err) => {
    console.error('Queue job failed', job?.id, err?.message);
  });
  return worker;
}

export async function enqueueTemplateJob(data, opts = {}) {
  if (REDIS_DISABLED) {
    const id = data?.messageLogId;
    if (id) {
      await db.execute({
        sql: `UPDATE message_logs SET status = 'failed', error_message = ? WHERE id = ?`,
        args: ['queue_disabled_configure_redis', id],
      });
    }
    console.warn('[queue] Redis disabled — job skipped (set REDIS_URL to enable sending)');
    return null;
  }
  return getQueue().add('send-template', data, opts);
}
