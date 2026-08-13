import { env } from './env.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';
import { ensureSeedUsers } from './scripts/seedUsers.js';

await connectDb();
await ensureSeedUsers();
createApp().listen(env.PORT, () => console.log(`listening on :${env.PORT}`));
