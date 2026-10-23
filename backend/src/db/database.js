import { createClient } from '@libsql/client';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../../../data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'cheesy_slice.db');

let client;

export function getDb() {
  if (!client) {
    client = createClient({
      url: `file:${DB_PATH}`,
    });
  }
  return client;
}

export default getDb;
