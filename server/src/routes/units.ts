import { Router } from 'express';
import { UnitModel, type UnitDoc } from '../models/Unit.js';
import { CustomerModel } from '../models/Customer.js';
import { ProductModel } from '../models/ProductModel.js';
import { requireRole, type AuthUser } from '../middleware/auth.js';
import { HttpError } from '../lib/httpError.js';
import { logAudit } from '../lib/audit.js';
import { serializeUnit } from '../lib/sanitize.js';
import {
  dispatchBatchSchema,
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
  AGE_LIMIT_DAYS,
  isPastWarranty,
  isReadyForReworkDispatch,
  isReworkUnit,
  latestGateEntry,
  partsForType,
  unitAgeDays,
  type PartKey,
  type UnitType,
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
  // a customer login only ever lists its own machines
  if (req.user.role === 'customer') filter.customerId = req.user.customerId ?? null;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [
      { unitId: rx },
      { modelName: rx },
      { customerName: rx },
      { operator: rx },
      { loggedBy: rx },
      ...PART_KEYS.map((k) => ({ [k]: rx })),
      { 'dispatch.driverName': rx },
      { 'dispatch.vehicleNumber': rx },
      { 'dispatch.location': rx },
      { 'dispatch.invoiceNumber': rx },
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
  if (req.user.role === 'customer' && String(unit.customerId ?? '') !== (req.user.customerId ?? '')) {
    throw new HttpError(404, 'No machine found with this serial number');
  }
  res.json(serializeUnit(unit));
});

unitsRouter.post('/', requireRole('production'), async (req, res) => {
  const body = unitCreateSchema.parse(req.body);

  // the model is the single source of the serial's product code, variant and
  // assembly type — the operator only scans parts
  const productModel = await ProductModel.findById(body.modelId);
  if (!productModel) throw new HttpError(404, 'Model not found — pick it again from the list');
  if (!productModel.active) throw new HttpError(409, `${productModel.name} has been retired — pick a current model`);

  const type = productModel.type as UnitType;
  const required = partsForType(type);

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

  const { productCode, variant } = productModel;
  const lineCode = body.lineCode.toUpperCase();
  const assembledAt = new Date();

  // the 4-character tail is random, so retry the rare collision
  let unit = null;
  for (let attempt = 0; attempt < 5 && !unit; attempt++) {
    const unitId = generateUnitId({ productCode, variant, lineCode }, assembledAt);
    if (await UnitModel.exists({ unitId })) continue;
    unit = await UnitModel.create({
      unitId,
      modelId: productModel._id,
      modelName: productModel.name,
      productCode,
      variant,
      lineCode,
      type,
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

  await logAudit(req.user.name, 'create', unit.unitId, `${productModel.name} · ${UNIT_TYPES[type].label} logged`);
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

interface TripDetails {
  driverName: string;
  vehicleNumber: string;
  location: string;
  invoiceNumber: string;
  overwrite: boolean;
}

// Raised rather than returned so the single-unit route reports it as a 409 and
// the batch route can collect it per unit without aborting the rest of the truck.
function assertDispatchable(unit: UnitDoc, overwrite: boolean) {
  if (isReworkUnit(unit) && !isReadyForReworkDispatch(unit) && !unit.dispatch) {
    throw new HttpError(
      409,
      `${unit.unitId} cannot be dispatched yet — it must be approved by Quality, issued to Production, and marked reworked before Dispatch.`,
    );
  }
  if (unit.dispatch && !overwrite) {
    throw new HttpError(409, `${unit.unitId} was already dispatched. Confirm to overwrite the existing details.`);
  }
}

async function applyDispatch(unit: UnitDoc, trip: TripDetails, user: AuthUser, dispatchedAt: Date) {
  const afterRework = isReworkUnit(unit);
  const entry = {
    driverName: trip.driverName,
    vehicleNumber: trip.vehicleNumber.toUpperCase(),
    location: trip.location,
    invoiceNumber: trip.invoiceNumber,
    dispatchedBy: user.name,
    dispatchedAt,
    afterRework,
  };
  unit.dispatchLog.push(entry);
  unit.dispatch = entry;
  await unit.save();
  await logAudit(
    user.name,
    afterRework ? 'dispatch-after-rework' : 'dispatch',
    unit.unitId,
    `${entry.driverName} · ${entry.vehicleNumber} · ${entry.location} · Inv ${entry.invoiceNumber}`,
  );
  return unit;
}

// One truck, one invoice, many units: the trip is entered once and every unit on
// board is stamped with the same details and the same timestamp. A unit that
// cannot leave is reported back instead of failing the whole load, so the rest
// of the truck still goes out.
unitsRouter.post('/dispatch-batch', requireRole('dispatch'), async (req, res) => {
  const body = dispatchBatchSchema.parse(req.body);
  const wanted = [...new Set(body.unitIds.map((id) => id.trim().toUpperCase()).filter(Boolean))];
  if (!wanted.length) throw new HttpError(400, 'Scan at least one unit onto the truck');

  const dispatchedAt = new Date();
  const dispatched: ReturnType<typeof serializeUnit>[] = [];
  const failed: { unitId: string; error: string; alreadyDispatched: boolean }[] = [];

  for (const unitId of wanted) {
    const unit = await UnitModel.findOne({ unitId });
    if (!unit) {
      failed.push({ unitId, error: 'No unit found with this ID', alreadyDispatched: false });
      continue;
    }
    try {
      assertDispatchable(unit, body.overwrite);
    } catch (e) {
      failed.push({
        unitId,
        error: e instanceof HttpError ? e.message : 'Could not dispatch this unit',
        alreadyDispatched: !!unit.dispatch,
      });
      continue;
    }
    dispatched.push(serializeUnit(await applyDispatch(unit, body, req.user, dispatchedAt)));
  }

  res.status(failed.length && !dispatched.length ? 409 : 200).json({ dispatched, failed });
});

unitsRouter.post('/:unitId/dispatch', requireRole('dispatch'), async (req, res) => {
  const body = dispatchSchema.parse(req.body);
  const unit = await findUnit(req.params.unitId);
  assertDispatchable(unit, body.overwrite);
  res.json(serializeUnit(await applyDispatch(unit, body, req.user, new Date())));
});

unitsRouter.post('/:unitId/gate-request', requireRole('gate'), async (req, res) => {
  const { reason } = gateRequestSchema.parse(req.body);
  const unit = await findUnit(req.params.unitId);
  const last = latestGateEntry(unit);
  if (last && (last.status === 'pending' || last.status === 'approved')) {
    throw new HttpError(409, 'This unit already has a request in progress.');
  }
  // out-of-warranty units are refused at the gate; only an admin can force one in
  if (isPastWarranty(unit.assembledAt) && req.user.role !== 'admin') {
    throw new HttpError(
      409,
      `${unit.unitId} was manufactured ${unitAgeDays(unit.assembledAt)} days ago — past the ${AGE_LIMIT_DAYS}-day warranty window. Refuse it at the gate.`,
    );
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
