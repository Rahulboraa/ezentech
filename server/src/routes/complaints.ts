import { Router } from 'express';
import { ComplaintModel } from '../models/Complaint.js';
import { UnitModel } from '../models/Unit.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../lib/httpError.js';
import { logAudit } from '../lib/audit.js';
import { complaintCreateSchema } from '../validation/schemas.js';
import { AGE_LIMIT_DAYS, isPastWarranty, latestGateEntry, unitAgeDays } from '../domain/units.js';

export const complaintsRouter = Router();

function serialize(c: Record<string, any>) {
  const { _id, __v, customerId, ...rest } = c;
  return { id: String(_id), customerId: customerId ? String(customerId) : '', ...rest };
}

complaintsRouter.get('/', async (req, res) => {
  const status = String(req.query.status ?? '').trim();
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  // a customer only ever sees the complaints raised against its own account
  if (req.user.role === 'customer') filter.customerId = req.user.customerId ?? null;

  const rows = await ComplaintModel.find(filter).sort({ raisedAt: -1 }).limit(300).lean();
  res.json(rows.map(serialize));
});

complaintsRouter.post('/', requireRole('customer'), async (req, res) => {
  const { unitId, problem } = complaintCreateSchema.parse(req.body);
  const unit = await UnitModel.findOne({ unitId: unitId.trim().toUpperCase() });
  if (!unit) throw new HttpError(404, 'No machine found with this serial number');

  // customers may only complain about their own machines
  if (req.user.customerId && String(unit.customerId ?? '') !== req.user.customerId) {
    throw new HttpError(403, 'This serial number is not registered to your account');
  }
  if (isPastWarranty(unit.assembledAt)) {
    throw new HttpError(
      409,
      `${unit.unitId} was manufactured ${unitAgeDays(unit.assembledAt)} days ago — past the ${AGE_LIMIT_DAYS}-day warranty window, so it cannot be sent back.`,
    );
  }
  if (await ComplaintModel.exists({ unitId: unit.unitId, status: 'open' })) {
    throw new HttpError(409, 'A complaint for this machine is already open');
  }
  const gate = latestGateEntry(unit);
  if (gate && gate.status !== 'rejected' && !gate.reworkDone) {
    throw new HttpError(409, 'This machine is already in the rework cycle');
  }

  const complaint = await ComplaintModel.create({
    unitId: unit.unitId,
    customerId: unit.customerId,
    customerName: unit.customerName,
    problem,
    raisedBy: req.user.name,
  });
  await logAudit(req.user.name, 'complaint-raised', unit.unitId, problem);
  res.status(201).json(serialize(complaint.toObject()));
});

// The gate marks a complaint received when the machine physically arrives; the
// entry request itself is raised from the Gate screen straight after.
complaintsRouter.post('/:id/received', requireRole('gate'), async (req, res) => {
  const complaint = await ComplaintModel.findById(req.params.id);
  if (!complaint) throw new HttpError(404, 'Complaint not found');
  if (complaint.status !== 'open') throw new HttpError(409, 'This complaint is no longer open');
  complaint.status = 'received';
  complaint.receivedBy = req.user.name;
  complaint.receivedAt = new Date();
  await complaint.save();
  await logAudit(req.user.name, 'complaint-received', complaint.unitId, complaint.problem);
  res.json(serialize(complaint.toObject()));
});
