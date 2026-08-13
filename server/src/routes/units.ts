import { Router } from 'express';
import { UnitModel } from '../models/Unit.js';
import { CustomerModel } from '../models/Customer.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../lib/httpError.js';
import { logAudit } from '../lib/audit.js';
import { serializeUnit } from '../lib/sanitize.js';
import {
  dispatchSchema,
  gateRequestSchema,
  qualityDecisionSchema,
  remarkSchema,
  unitCreateSchema,
  unitEditSchema,
} from '../validation/schemas.js';
import {
  PART_KEYS,
  PART_LABELS,
  UNIT_TYPES,
  UNIT_TYPE_KEYS,
  generateUnitId,
  isReadyForReworkDispatch,
  isReworkUnit,
  latestGateEntry,
  normalizeProductCode,
  partsForType,
  type PartKey,
} from '../domain/units.js';

export const unitsRouter = Router();

async function findUnit(unitId: string | string[]) {
  const unit = await UnitModel.findOne({ unitId: String(unitId).trim().toUpperCase() });
  if (!unit) throw new HttpError(404, 'No unit found with this ID');
  return unit;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// tab mirrors the panel the operator is looking at; the rework rules live in
// domain/units.ts, so filtering happens after hydration rather than in Mongo.
const TABS = ['all', 'new', 'rework', 'dispatched', 'pending-quality', 'open-quality', 'dispatchable'] as const;
type Tab = (typeof TABS)[number];

function matchesTab(unit: ReturnType<typeof serializeUnit>, tab: Tab) {
  if (tab === 'new') return !unit.isRework;
  if (tab === 'rework') return unit.isRework;
  if (tab === 'dispatched') return !!unit.dispatch;
  if (tab === 'pending-quality') return unit.gate?.status === 'pending';
  // everything still on Quality's desk: waiting for a decision, or approved and
  // waiting to be issued back to Production
  if (tab === 'open-quality') return unit.gate?.status === 'pending' || unit.gate?.status === 'approved';
  if (tab === 'dispatchable') return !unit.dispatch && unit.canDispatch;
  return true;
}

unitsRouter.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const tab = (TABS as readonly string[]).includes(String(req.query.tab)) ? (req.query.tab as Tab) : 'all';
  const page = Math.max(parseInt(String(req.query.page)) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 20, 1), 200);

  const filter: Record<string, unknown> = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [
      { unitId: rx },
      { customerName: rx },
      { operator: rx },
      { loggedBy: rx },
      ...PART_KEYS.map((k) => ({ [k]: rx })),
      { 'dispatch.driverName': rx },
      { 'dispatch.vehicleNumber': rx },
      { 'dispatch.location': rx },
      { 'serviceRemarks.text': rx },
    ];
  }

  const all = (await UnitModel.find(filter).sort({ assembledAt: -1 })).map(serializeUnit);
  const rows = all.filter((u) => matchesTab(u, tab));
  res.json({ rows: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit });
});

// Header/dashboard counters — cheap enough to recompute on each poll.
unitsRouter.get('/stats', async (_req, res) => {
  const units = (await UnitModel.find().sort({ assembledAt: -1 })).map(serializeUnit);
  const today = new Date().toDateString();
  res.json({
    today: units.filter((u) => new Date(u.assembledAt).toDateString() === today).length,
    total: units.length,
    parts: units.reduce((sum, u) => sum + partsForType(u.type).length, 0),
    rework: units.filter((u) => u.isRework).length,
    awaitingQuality: units.filter((u) => u.gate?.status === 'pending').length,
    awaitingDispatch: units.filter((u) => !u.dispatch && u.canDispatch).length,
    dispatched: units.filter((u) => u.dispatch).length,
    aged: units.filter((u) => u.aged).length,
    byType: Object.fromEntries(
      UNIT_TYPE_KEYS.map((t) => [
        t,
        {
          total: units.filter((u) => u.type === t).length,
          today: units.filter((u) => u.type === t && new Date(u.assembledAt).toDateString() === today).length,
        },
      ]),
    ),
  });
});

// Hit on every scan — reports which unit a serial is already committed to.
unitsRouter.get('/serial-lookup', async (req, res) => {
  const value = String(req.query.value ?? '').trim();
  if (!value) return res.json({ used: false });
  const unit = await UnitModel.findOne({ $or: PART_KEYS.map((k) => ({ [k]: value })) }).lean();
  if (!unit) return res.json({ used: false });
  const part = PART_KEYS.find((k) => (unit as Record<string, any>)[k] === value) as PartKey;
  res.json({ used: true, unitId: unit.unitId, part: PART_LABELS[part] });
});

unitsRouter.get('/:unitId', async (req, res) => {
  const unit = await findUnit(req.params.unitId);
  res.json(serializeUnit(unit));
});

unitsRouter.post('/', requireRole('production'), async (req, res) => {
  const body = unitCreateSchema.parse(req.body);
  const required = partsForType(body.type);

  const missing = required.filter((k) => !body[k]);
  if (missing.length) {
    throw new HttpError(400, `Missing serial for ${missing.map((k) => PART_LABELS[k]).join(', ')}`);
  }

  // a serial may not repeat inside the tray…
  const serials = required.map((k) => body[k]);
  const clash = serials.find((s, i) => serials.indexOf(s) !== i);
  if (clash) throw new HttpError(409, `Serial ${clash} is entered twice on this unit`);

  // …nor may it already belong to a unit on the floor
  const taken = await UnitModel.findOne({ $or: serials.flatMap((s) => PART_KEYS.map((k) => ({ [k]: s }))) }).lean();
  if (taken) {
    const part = PART_KEYS.find((k) => serials.includes((taken as Record<string, any>)[k]))!;
    throw new HttpError(409, `Serial already used in ${taken.unitId} as ${PART_LABELS[part]}`);
  }

  let customerId: string | null = null;
  let customerName = '';
  if (body.customerId) {
    const customer = await CustomerModel.findById(body.customerId);
    if (!customer) throw new HttpError(404, 'Customer not found');
    customerId = String(customer._id);
    customerName = customer.name;
  }

  const productCode = normalizeProductCode(body.productCode);
  const variant = body.variant.toUpperCase();
  const lineCode = body.lineCode.toUpperCase();
  const assembledAt = new Date();

  // the 4-character tail is random, so retry the rare collision
  let unit = null;
  for (let attempt = 0; attempt < 5 && !unit; attempt++) {
    const unitId = generateUnitId({ productCode, variant, lineCode }, assembledAt);
    if (await UnitModel.exists({ unitId })) continue;
    unit = await UnitModel.create({
      unitId,
      productCode,
      variant,
      lineCode,
      type: body.type,
      compressor: body.compressor,
      motor: body.motor,
      controller: body.controller,
      heatExchanger: body.heatExchanger,
      operator: body.operator,
      customerId,
      customerName,
      assembledAt,
      loggedBy: req.user.name,
      serviceRemarks: [],
    });
  }
  if (!unit) throw new HttpError(500, 'Could not allocate a unique Unit ID — try again');

  await logAudit(req.user.name, 'create', unit.unitId, `${UNIT_TYPES[body.type].label} logged`);
  res.status(201).json(serializeUnit(unit));
});

unitsRouter.patch('/:unitId', requireRole('production'), async (req, res) => {
  const body = unitEditSchema.parse(req.body);
  const unit = await findUnit(req.params.unitId);
  if (body.customerId) {
    const customer = await CustomerModel.findById(body.customerId);
    if (!customer) throw new HttpError(404, 'Customer not found');
    unit.customerId = customer._id;
    unit.customerName = customer.name;
  } else {
    unit.customerId = null;
    unit.customerName = '';
  }
  unit.operator = body.operator;
  await unit.save();
  await logAudit(req.user.name, 'edit', unit.unitId, 'Customer / operator reassigned');
  res.json(serializeUnit(unit));
});

unitsRouter.delete('/:unitId', requireRole('production'), async (req, res) => {
  const unit = await findUnit(req.params.unitId);
  await unit.deleteOne();
  await logAudit(req.user.name, 'delete', unit.unitId, 'Unit record deleted');
  res.json({ ok: true });
});

unitsRouter.post('/:unitId/remarks', async (req, res) => {
  const { text } = remarkSchema.parse(req.body);
  const unit = await findUnit(req.params.unitId);
  unit.serviceRemarks.push({ user: req.user.name, text, at: new Date() });
  await unit.save();
  await logAudit(req.user.name, 'remark', unit.unitId, text.length > 60 ? `${text.slice(0, 60)}…` : text);
  res.status(201).json(serializeUnit(unit));
});

unitsRouter.post('/:unitId/dispatch', requireRole('dispatch'), async (req, res) => {
  const body = dispatchSchema.parse(req.body);
  const unit = await findUnit(req.params.unitId);
  const afterRework = isReworkUnit(unit);

  if (afterRework && !isReadyForReworkDispatch(unit) && !unit.dispatch) {
    throw new HttpError(
      409,
      `${unit.unitId} cannot be dispatched yet — it must be approved by Quality, issued to Production, and marked reworked before Dispatch.`,
    );
  }
  if (unit.dispatch && !body.overwrite) {
    throw new HttpError(409, `${unit.unitId} was already dispatched. Confirm to overwrite the existing details.`);
  }

  const vehicleNumber = body.vehicleNumber.toUpperCase();
  const entry = {
    driverName: body.driverName,
    vehicleNumber,
    location: body.location,
    dispatchedBy: req.user.name,
    dispatchedAt: new Date(),
    afterRework,
  };
  unit.dispatchLog.push(entry);
  unit.dispatch = entry;
  await unit.save();
  await logAudit(
    req.user.name,
    afterRework ? 'dispatch-after-rework' : 'dispatch',
    unit.unitId,
    `${body.driverName} · ${vehicleNumber} · ${body.location}`,
  );
  res.json(serializeUnit(unit));
});

unitsRouter.post('/:unitId/gate-request', requireRole('gate'), async (req, res) => {
  const { reason } = gateRequestSchema.parse(req.body);
  const unit = await findUnit(req.params.unitId);
  const last = latestGateEntry(unit);
  if (last && (last.status === 'pending' || last.status === 'approved')) {
    throw new HttpError(409, 'This unit already has a request in progress.');
  }
  unit.gateLog.push({
    status: 'pending',
    reason,
    requestedBy: req.user.name,
    requestedAt: new Date(),
    decidedBy: '',
    decidedAt: null,
    qualityBy: '',
    qualityAt: null,
    reworkDone: false,
    reworkDoneBy: '',
    reworkDoneAt: null,
  });
  await unit.save();
  await logAudit(req.user.name, 'gate-request', unit.unitId, reason || 'Entry approval requested');
  res.status(201).json(serializeUnit(unit));
});

unitsRouter.post('/:unitId/quality-decision', requireRole('quality'), async (req, res) => {
  const { decision } = qualityDecisionSchema.parse(req.body);
  const unit = await findUnit(req.params.unitId);
  const last = latestGateEntry(unit);
  if (!last || last.status !== 'pending') throw new HttpError(409, 'No pending gate request on this unit');
  last.status = decision;
  last.decidedBy = req.user.name;
  last.decidedAt = new Date();
  await unit.save();
  await logAudit(
    req.user.name,
    decision === 'approved' ? 'gate-quality-approved' : 'gate-quality-rejected',
    unit.unitId,
    last.reason || '',
  );
  res.json(serializeUnit(unit));
});

unitsRouter.post('/:unitId/issue', requireRole('quality'), async (req, res) => {
  const unit = await findUnit(req.params.unitId);
  const last = latestGateEntry(unit);
  if (!last || last.status !== 'approved') throw new HttpError(409, 'Only an approved unit can be issued');
  last.status = 'issued';
  last.qualityBy = req.user.name;
  last.qualityAt = new Date();
  await unit.save();
  await logAudit(req.user.name, 'gate-issued', unit.unitId, last.reason || '');
  res.json(serializeUnit(unit));
});

unitsRouter.post('/:unitId/rework-complete', requireRole('production'), async (req, res) => {
  const unit = await findUnit(req.params.unitId);
  const last = latestGateEntry(unit);
  if (!last || last.status !== 'issued' || last.reworkDone) {
    throw new HttpError(409, 'This unit is not waiting on rework');
  }
  last.reworkDone = true;
  last.reworkDoneBy = req.user.name;
  last.reworkDoneAt = new Date();
  await unit.save();
  await logAudit(req.user.name, 'rework-completed', unit.unitId, '');
  res.json(serializeUnit(unit));
});
