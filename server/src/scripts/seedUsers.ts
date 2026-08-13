import bcrypt from 'bcryptjs';
import { UserModel, type Role } from '../models/User.js';

// The station roster the shop floor already knows. PINs are the originals from
// the offline tablet — rotate them from the Users screen after go-live.
const SEED_USERS: { name: string; role: Role; pin: string }[] = [
  { name: 'Production', role: 'production', pin: 'PROD' },
  { name: 'Dispatch', role: 'dispatch', pin: 'DISP' },
  { name: 'Gate', role: 'gate', pin: 'GATE' },
  { name: 'Quality', role: 'quality', pin: 'QUAL' },
];

// Runs on every boot: creates anything missing, never resets an existing PIN.
export async function ensureSeedUsers() {
  for (const seed of SEED_USERS) {
    if (await UserModel.exists({ name: seed.name })) continue;
    await UserModel.create({
      name: seed.name,
      role: seed.role,
      pinHash: await bcrypt.hash(seed.pin, 10),
      active: true,
    });
    console.log(`seeded user ${seed.name}`);
  }
}
