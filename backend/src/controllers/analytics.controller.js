import db from '../config/db.js';

export async function overview(req, res, next) {
  try {
    const { rows: c1 } = await db.execute({
      sql: `SELECT COUNT(*) as n FROM contacts`,
      args: [],
    });
    const { rows: c2 } = await db.execute({
      sql: `SELECT COUNT(*) as n FROM contacts WHERE opted_in = 1`,
      args: [],
    });
    const total = c1[0]?.n || 0;
    const optedIn = c2[0]?.n || 0;
    const optedInPct = total > 0 ? Math.round((optedIn / total) * 1000) / 10 : 0;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const iso = startOfMonth.toISOString();
    const { rows: c3 } = await db.execute({
      sql: `SELECT COUNT(*) as n FROM campaigns WHERE status = 'sent' AND sent_at >= ?`,
      args: [iso],
    });
    const { rows: c4 } = await db.execute({
      sql: `SELECT AVG(
        CASE WHEN sent_count > 0 THEN (read_count * 100.0 / sent_count) ELSE NULL END
      ) as avg_read FROM campaigns WHERE sent_count > 0`,
      args: [],
    });
    const avgRead = c4[0]?.avg_read != null ? Math.round(Number(c4[0].avg_read) * 10) / 10 : 0;
    res.json({
      total_contacts: total,
      opted_in_percent: optedInPct,
      campaigns_sent_this_month: c3[0]?.n || 0,
      average_read_rate: avgRead,
    });
  } catch (err) {
    next(err);
  }
}

export async function campaignStats(req, res, next) {
  try {
    const { rows } = await db.execute({
      sql: `SELECT id, name, sent_count, delivered_count, read_count, failed_count,
        CASE WHEN sent_count > 0 THEN ROUND(delivered_count * 100.0 / sent_count, 2) ELSE 0 END as delivered_rate,
        CASE WHEN sent_count > 0 THEN ROUND(read_count * 100.0 / sent_count, 2) ELSE 0 END as read_rate
      FROM campaigns WHERE sent_count > 0 OR status = 'sent' ORDER BY created_at DESC`,
      args: [],
    });
    res.json({ campaigns: rows });
  } catch (err) {
    next(err);
  }
}

export async function messagesPerDay(req, res, next) {
  try {
    const { rows } = await db.execute({
      sql: `SELECT date(sent_at) as day, COUNT(*) as count FROM message_logs
        WHERE sent_at IS NOT NULL AND sent_at >= datetime('now', '-30 days')
        GROUP BY date(sent_at) ORDER BY day ASC`,
      args: [],
    });
    res.json({ series: rows });
  } catch (err) {
    next(err);
  }
}

export async function funnel(req, res, next) {
  try {
    const { rows: s } = await db.execute({
      sql: `SELECT COUNT(*) as n FROM message_logs WHERE status IN ('sent','delivered','read','failed','skipped')`,
      args: [],
    });
    const { rows: d } = await db.execute({
      sql: `SELECT COUNT(*) as n FROM message_logs WHERE status IN ('delivered','read')`,
      args: [],
    });
    const { rows: r } = await db.execute({
      sql: `SELECT COUNT(*) as n FROM message_logs WHERE status = 'read'`,
      args: [],
    });
    const { rows: rep } = await db.execute({
      sql: `SELECT COUNT(DISTINCT phone) as n FROM inbox_messages WHERE direction = 'inbound'`,
      args: [],
    });
    res.json({
      sent: s[0]?.n || 0,
      delivered: d[0]?.n || 0,
      read: r[0]?.n || 0,
      replied: rep[0]?.n || 0,
    });
  } catch (err) {
    next(err);
  }
}
