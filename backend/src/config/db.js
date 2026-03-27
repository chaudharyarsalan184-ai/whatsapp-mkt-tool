import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';
import { TURSO_AUTH_TOKEN, TURSO_DATABASE_URL } from './env.js';

if (!TURSO_DATABASE_URL) {
  throw new Error('TURSO_DATABASE_URL is required (use file:./data/local.db for local SQLite)');
}

const isFile = TURSO_DATABASE_URL.startsWith('file:');

if (isFile) {
  const rel = TURSO_DATABASE_URL.replace(/^file:/, '');
  const abs = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
}

const db = createClient(
  isFile
    ? { url: TURSO_DATABASE_URL }
    : {
        url: TURSO_DATABASE_URL,
        authToken: TURSO_AUTH_TOKEN,
      }
);

export default db;
