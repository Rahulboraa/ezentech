import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../lib/httpError.js';
import { ownPinSchema, resetPinSchema, userCreateSchema, userUpdateSchema } from '../validation/schemas.js';

export const usersRouter = Router();

function serialize(u: Record<string, any>) {
  return {
    id: String(u._id),
    name: u.name,
    role: u.role,
    active: u.active,
    customerId: u.customerId ? String(u.customerId) : '',
    updatedAt: u.updatedAt,
  };
}

// Anyone can rotate their own PIN — they have to prove the current one first.
usersRouter.post('/me/pin', async (req, res) => {
  const { currentPin, newPin } = ownPinSchema.parse(req.body);
  const user = await UserModel.findById(req.user.id).select('+pinHash');
  if (!user) throw new HttpError(404, 'Station not found');
  if (!(await bcrypt.compare(currentPin.toUpperCase(), user.pinHash))) {
    throw new HttpError(401, 'Current PIN is incorrect');
  }
  user.pinHash = await bcrypt.hash(newPin.toUpperCase(), 10);
  await user.save();
  res.json({ ok: true });
});

usersRouter.use(requireRole('admin'));

usersRouter.get('/', async (_req, res) => {
  const users = await UserModel.find().sort({ role: 1, name: 1 }).lean();
  res.json(users.map(serialize));
});

usersRouter.post('/', async (req, res) => {
  const body = userCreateSchema.parse(req.body);
  if (await UserModel.exists({ name: body.name })) throw new HttpError(409, 'A station with that name already exists');
  if (body.role === 'customer' && !body.customerId) {
    throw new HttpError(400, 'Pick the customer account this login belongs to');
  }
  const user = await UserModel.create({
    name: body.name,
    role: body.role,
    pinHash: await bcrypt.hash(body.pin.toUpperCase(), 10),
    customerId: body.role === 'customer' ? body.customerId : null,
    active: true,
  });
  res.status(201).json(serialize(user.toObject()));
});

async function lastActiveAdmin(id: string) {
  const admins = await UserModel.find({ role: 'admin', active: true }).select('_id').lean();
  return admins.length === 1 && String(admins[0]._id) === id;
}

usersRouter.patch('/:id', async (req, res) => {
  const body = userUpdateSchema.parse(req.body);
  const user = await UserModel.findById(req.params.id);
  if (!user) throw new HttpError(404, 'Station not found');

  const losingAdmin = (body.active === false || (body.role && body.role !== 'admin')) && user.role === 'admin';
  if (losingAdmin && (await lastActiveAdmin(String(user._id)))) {
    throw new HttpError(409, 'This is the last active admin — promote another station first');
  }
  if (String(user._id) === req.user.id && body.active === false) {
    throw new HttpError(409, 'You cannot deactivate the station you are signed in as');
  }

  if (body.name !== undefined) user.name = body.name;
  if (body.role !== undefined) user.role = body.role;
  if (body.active !== undefined) user.active = body.active;
  await user.save();
  res.json(serialize(user.toObject()));
});

usersRouter.patch('/:id/pin', async (req, res) => {
  const { pin } = resetPinSchema.parse(req.body);
  const user = await UserModel.findById(req.params.id);
  if (!user) throw new HttpError(404, 'Station not found');
  user.pinHash = await bcrypt.hash(pin.toUpperCase(), 10);
  await user.save();
  res.json({ ok: true });
});

usersRouter.delete('/:id', async (req, res) => {
  const user = await UserModel.findById(req.params.id);
  if (!user) throw new HttpError(404, 'Station not found');
  if (String(user._id) === req.user.id) throw new HttpError(409, 'You cannot delete the station you are signed in as');
  if (await lastActiveAdmin(String(user._id))) throw new HttpError(409, 'This is the last active admin');
  await user.deleteOne();
  res.json({ ok: true });
});
