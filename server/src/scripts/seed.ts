import mongoose from 'mongoose';
import { connectDb } from '../db.js';
import { ensureSeedUsers } from './seedUsers.js';

await connectDb();
await ensureSeedUsers();
await mongoose.disconnect();
console.log('seed complete');
