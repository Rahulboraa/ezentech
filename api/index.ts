import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server/src/app.js';
import { connectDb } from '../server/src/db.js';
import { ensureSeedUsers } from '../server/src/scripts/seedUsers.js';

const app = createApp();
let ready: Promise<void> | null = null;

async function init() {
  await connectDb();
  await ensureSeedUsers();
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= init();
  try {
    await ready;
  } catch (err) {
    ready = null;
    throw err;
  }
  return app(req, res);
}
