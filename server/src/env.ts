import { z } from 'zod';

try {
  process.loadEnvFile(new URL('../../.env', import.meta.url).pathname);
} catch {
  /* no .env */
}

const schema = z.object({
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/ezentech-assembly'),
  JWT_SECRET: z.string().default('dev-secret'),
  // 5100, not 5000 — saratoga-villa's dev server already owns 5000 on this machine
  PORT: z.coerce.number().default(5100),
  NODE_ENV: z.string().default('development'),
});

export const env = schema.parse(process.env);

// a placeholder copied out of .env.example would sign real sessions, so refuse
// to boot on anything guessable
const WEAK_SECRETS = new Set(['dev-secret', 'change-me-in-production', 'changeme', 'secret']);
if (env.NODE_ENV === 'production' && (WEAK_SECRETS.has(env.JWT_SECRET) || env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be a strong, unique value in production (32+ characters)');
}
