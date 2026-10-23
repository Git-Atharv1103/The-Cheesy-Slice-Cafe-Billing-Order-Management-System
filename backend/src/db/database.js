import { createClient } from '@libsql/client';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isServerless = process.env.VERCEL === '1' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
const dataDir = isServerless ? '/tmp/data' : path.join(__dirname, '../../../data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'cheesy_slice.db');

let client;

export function getDb() {
  if (!client) {
    const cloudUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

    if (cloudUrl && (cloudUrl.startsWith('libsql://') || cloudUrl.startsWith('https://') || cloudUrl.startsWith('wss://'))) {
      client = createClient({
        url: cloudUrl,
        authToken: authToken || undefined,
      });
    } else {
      client = createClient({
        url: `file:${DB_PATH}`,
      });
    }
  }
  return client;
}

export default getDb;
