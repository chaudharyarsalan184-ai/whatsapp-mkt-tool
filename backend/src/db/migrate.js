import db from '../config/db.js';

export async function migrate() {
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        name TEXT,
        email TEXT,
        tags TEXT DEFAULT '[]',
        opted_in INTEGER DEFAULT 1,
        opted_in_at TEXT,
        opted_out_at TEXT,
        custom_fields TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        meta_template_id TEXT,
        category TEXT NOT NULL,
        language TEXT DEFAULT 'en_US',
        status TEXT DEFAULT 'PENDING',
        header_type TEXT,
        header_content TEXT,
        body TEXT NOT NULL,
        footer TEXT,
        buttons TEXT DEFAULT '[]',
        variables TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        template_id INTEGER REFERENCES templates(id),
        segment_tags TEXT DEFAULT '[]',
        variable_values TEXT DEFAULT '{}',
        status TEXT DEFAULT 'draft',
        scheduled_at TEXT,
        sent_at TEXT,
        total_contacts INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        delivered_count INTEGER DEFAULT 0,
        read_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        skipped_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS message_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER REFERENCES campaigns(id),
        contact_id INTEGER REFERENCES contacts(id),
        phone TEXT NOT NULL,
        template_id INTEGER,
        meta_message_id TEXT,
        status TEXT DEFAULT 'queued',
        error_message TEXT,
        sent_at TEXT,
        delivered_at TEXT,
        read_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS automations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        trigger_config TEXT DEFAULT '{}',
        template_id INTEGER REFERENCES templates(id),
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS inbox_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER REFERENCES contacts(id),
        phone TEXT NOT NULL,
        direction TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        content TEXT,
        meta_message_id TEXT,
        is_read INTEGER DEFAULT 0,
        received_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS opt_out_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        reason TEXT DEFAULT 'user_request',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
  ]);

  try {
    await db.execute({
      sql: `ALTER TABLE campaigns ADD COLUMN variable_values TEXT DEFAULT '{}'`,
      args: [],
    });
  } catch {
    /* column exists */
  }
  try {
    await db.execute({
      sql: `ALTER TABLE campaigns ADD COLUMN skipped_count INTEGER DEFAULT 0`,
      args: [],
    });
  } catch {
    /* column exists */
  }
}
