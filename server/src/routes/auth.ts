import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { UserModel } from '../models/User.js';
import { requireAuth, signToken, type AuthUser } from '../middleware/auth.js';
import { loginSchema } from '../validation/schemas.js';

export const authRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

// The login screen shows the station roster, the same way the shop-floor tablet did.
authRouter.get('/users', async (_req, res) => {
  const users = await UserModel.find({ active: true }).sort({ role: 1, name: 1 }).lean();
  res.json(users.map((u) => ({ id: String(u._id), name: u.name, role: u.role })));
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { userId, pin } = loginSchema.parse(req.body);
  const user = await UserModel.findById(userId).where({ active: true }).select('+pinHash');
  if (!user || !(await bcrypt.compare(pin.toUpperCase(), user.pinHash))) {
    return res.status(401).json({ error: 'Incorrect PIN. Try again.' });
  }
  const authUser: AuthUser = { id: String(user._id), name: user.name, role: user.role };
  res.json({ token: signToken(authUser), user: authUser });
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
