import { Router } from 'express';
import { CustomerModel } from '../models/Customer.js';
import { UnitModel } from '../models/Unit.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../lib/httpError.js';
import { customerSchema } from '../validation/schemas.js';
import { serializeCustomer } from '../lib/sanitize.js';

export const customersRouter = Router();

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SORTS = ['name', 'units', 'recent'] as const;
type Sort = (typeof SORTS)[number];

customersRouter.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const city = String(req.query.city ?? '').trim();
  const units = String(req.query.units ?? '').trim(); // with | without
  const sort = (SORTS as readonly string[]).includes(String(req.query.sort)) ? (req.query.sort as Sort) : 'name';
  const page = Math.max(parseInt(String(req.query.page)) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 20, 1), 500);

  const filter: Record<string, unknown> = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { phone: rx }, { city: rx }, { address: rx }];
  }
  if (city) filter.city = city;

  const [all, cities, counts] = await Promise.all([
    CustomerModel.find(filter).lean(),
    CustomerModel.distinct('city', { city: { $ne: '' } }),
    // unit totals per customer, so the list never has to load every unit
    UnitModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { customerId: { $ne: null } } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } },
    ]),
  ]);

  const byId = new Map(counts.map((c) => [String(c._id), c.count]));
  let rows = all.map((c) => ({ ...serializeCustomer(c), unitCount: byId.get(String(c._id)) ?? 0 }));

  if (units === 'with') rows = rows.filter((c) => c.unitCount > 0);
  if (units === 'without') rows = rows.filter((c) => c.unitCount === 0);

  rows.sort((a, b) => {
    if (sort === 'units') return b.unitCount - a.unitCount || a.name.localeCompare(b.name);
    if (sort === 'recent') return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
    return a.name.localeCompare(b.name);
  });

  res.json({
    rows: rows.slice((page - 1) * limit, page * limit),
    total: rows.length,
    page,
    limit,
    cities: (cities as string[]).sort(),
  });
});

customersRouter.post('/', requireRole('production'), async (req, res) => {
  const body = customerSchema.parse(req.body);
  const customer = await CustomerModel.create(body);
  res.status(201).json(serializeCustomer(customer.toObject()));
});

customersRouter.put('/:id', requireRole('production'), async (req, res) => {
  const body = customerSchema.parse(req.body);
  const customer = await CustomerModel.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!customer) throw new HttpError(404, 'Customer not found');
  // keep the historical snapshot on past units in sync with the display name
  await UnitModel.updateMany({ customerId: customer._id }, { customerName: customer.name });
  res.json(serializeCustomer(customer.toObject()));
});

customersRouter.delete('/:id', requireRole('production'), async (req, res) => {
  const customer = await CustomerModel.findById(req.params.id);
  if (!customer) throw new HttpError(404, 'Customer not found');
  // the name stays on the record, only the link is dropped
  await UnitModel.updateMany({ customerId: customer._id }, { customerId: null });
  await customer.deleteOne();
  res.json({ ok: true });
});
