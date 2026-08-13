import mongoose from 'mongoose'
import { connectDb } from '../db.js'
import { ensureSeedUsers } from './seedUsers.js'
import { CustomerModel } from '../models/Customer.js'
import { UnitModel } from '../models/Unit.js'
import { AuditLogModel } from '../models/AuditLog.js'
import { generateUnitId, partsForType, type UnitType } from '../domain/units.js'

// Demo fixtures for walking through the app — wipes units, customers and the
// activity log, never the station logins. Run `npm run seed` alone for an
// empty station.
const CUSTOMERS = [
  { name: 'Voltas Ltd', phone: '02266656565', city: 'Mumbai', address: 'Voltas House, Chinchpokli' },
  { name: 'Blue Star Ltd', phone: '02266654000', city: 'Thane', address: 'Kasturi Building, Mohan Ave' },
  { name: 'Lloyd Electric', phone: '01204567890', city: 'Noida', address: 'Sector 63, Phase III' },
  { name: 'Cool Zone Distributors', phone: '09876543210', city: 'Pune', address: 'Bhosari MIDC' },
]

const OPERATORS = ['Ravi Kumar', 'Sunil Yadav', 'Imran Shaikh', 'Anita Rao']
const DRIVERS = [
  { driverName: 'Sunil Pawar', vehicleNumber: 'MH12 AB 4471', location: 'Pune — Bhosari' },
  { driverName: 'Ramesh Gupta', vehicleNumber: 'UP16 CD 8890', location: 'Noida — Sector 63' },
  { driverName: 'Salim Khan', vehicleNumber: 'MH04 EF 2210', location: 'Thane — Wagle Estate' },
]

// 7-char VOLTAS product code + its 1-char variant, per the serial spec
const PRODUCTS = [
  { productCode: '4011571', variant: 'A' },
  { productCode: '4011572', variant: 'B' },
  { productCode: '5521330', variant: 'A' },
  { productCode: '6640210', variant: 'C' },
]
const LINE_CODES = ['K', 'L', 'M']
const TYPES: UnitType[] = ['outdoor', 'indoor', 'window', 'outdoor', 'outdoor', 'indoor']

function daysAgo(n: number, hour = 10) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, (n * 7) % 60, 0, 0)
  return d
}

await connectDb()
await ensureSeedUsers()

await Promise.all([UnitModel.deleteMany({}), CustomerModel.deleteMany({}), AuditLogModel.deleteMany({})])
const customers = await CustomerModel.insertMany(CUSTOMERS)

const audit: { user: string; action: string; unitId: string; details: string; at: Date }[] = []
// entries derive from unit timestamps, so clamp anything that would read as
// happening later today
const log = (user: string, action: string, unitId: string, details: string, at: Date) =>
  audit.push({ user, action, unitId, details, at: new Date(Math.min(at.getTime(), Date.now() - 30 * 1000)) })

// age spread: a couple past the 365-day threshold so the aged flag is visible
const AGES = [0, 0, 1, 2, 3, 6, 9, 14, 21, 40, 95, 210, 400, 430]

const units = AGES.map((age, i) => {
  const type = TYPES[i % TYPES.length]
  // shift-hour spread, but today's units must not land later than right now
  const assembledAt = new Date(Math.min(daysAgo(age, 9 + (i % 8)).getTime(), Date.now() - (i + 1) * 4 * 60 * 1000))
  const { productCode, variant } = PRODUCTS[i % PRODUCTS.length]
  const lineCode = LINE_CODES[i % LINE_CODES.length]
  const customer = customers[i % customers.length]
  const serial = String(1000 + i * 7)
  const parts = Object.fromEntries(partsForType(type).map((k) => [k, `${k.slice(0, 2).toUpperCase()}-${serial}`]))
  const loggedBy = 'Production'

  const unit: Record<string, unknown> = {
    unitId: generateUnitId({ productCode, variant, lineCode }, assembledAt),
    productCode,
    variant,
    lineCode,
    type,
    ...parts,
    operator: OPERATORS[i % OPERATORS.length],
    customerId: customer._id,
    customerName: customer.name,
    assembledAt,
    loggedBy,
    serviceRemarks: [],
    dispatch: null,
    dispatchLog: [],
    gateLog: [],
  }
  log(loggedBy, 'create', unit.unitId as string, `${type} assembly logged`, assembledAt)
  return unit
})

function unitAt(i: number) {
  return units[i] as Record<string, any>
}

// --- dispatched straight off new production
for (const [i, d] of [
  [3, DRIVERS[0]],
  [5, DRIVERS[1]],
  [9, DRIVERS[2]],
  [12, DRIVERS[0]],
] as const) {
  const u = unitAt(i)
  const at = new Date(u.assembledAt.getTime() + 26 * 60 * 60 * 1000)
  const entry = { ...d, dispatchedBy: 'Dispatch', dispatchedAt: at, afterRework: false }
  u.dispatch = entry
  u.dispatchLog = [entry]
  log('Dispatch', 'dispatch', u.unitId, `${d.driverName} · ${d.vehicleNumber} · ${d.location}`, at)
}

// --- gate returns in every state of the approval chain
function gateEntry(u: Record<string, any>, reason: string, offsetDays: number) {
  const requestedAt = daysAgo(Math.max(offsetDays - 1, 0), 11)
  log('Gate', 'gate-request', u.unitId, reason, requestedAt)
  return {
    status: 'pending' as string,
    reason,
    requestedBy: 'Gate',
    requestedAt,
    decidedBy: '',
    decidedAt: null as Date | null,
    qualityBy: '',
    qualityAt: null as Date | null,
    reworkDone: false,
    reworkDoneBy: '',
    reworkDoneAt: null as Date | null,
  }
}

// pending with Quality
const pending = unitAt(1)
pending.gateLog = [gateEntry(pending, 'Customer rejection — noisy compressor', 0)]

// approved, waiting to be issued
const approved = unitAt(4)
const gApproved = gateEntry(approved, 'Cooling below spec on install', 2)
gApproved.status = 'approved'
gApproved.decidedBy = 'Quality'
gApproved.decidedAt = daysAgo(1, 15)
approved.gateLog = [gApproved]
log('Quality', 'gate-quality-approved', approved.unitId, gApproved.reason, gApproved.decidedAt)

// issued to Production, rework still open
const issued = unitAt(7)
const gIssued = gateEntry(issued, 'Gas leak reported by dealer', 5)
Object.assign(gIssued, {
  status: 'issued',
  decidedBy: 'Quality',
  decidedAt: daysAgo(4, 12),
  qualityBy: 'Quality',
  qualityAt: daysAgo(4, 16),
})
issued.gateLog = [gIssued]
log('Quality', 'gate-quality-approved', issued.unitId, gIssued.reason, gIssued.decidedAt!)
log('Quality', 'gate-issued', issued.unitId, gIssued.reason, gIssued.qualityAt!)

// reworked and dispatched again
const reworked = unitAt(10)
const gRework = gateEntry(reworked, 'Panel dent in transit', 30)
Object.assign(gRework, {
  status: 'issued',
  decidedBy: 'Quality',
  decidedAt: daysAgo(28, 11),
  qualityBy: 'Quality',
  qualityAt: daysAgo(28, 14),
  reworkDone: true,
  reworkDoneBy: 'Production',
  reworkDoneAt: daysAgo(26, 10),
})
reworked.gateLog = [gRework]
const reDispatch = { ...DRIVERS[1], dispatchedBy: 'Dispatch', dispatchedAt: daysAgo(25, 9), afterRework: true }
reworked.dispatch = reDispatch
reworked.dispatchLog = [reDispatch]
log('Quality', 'gate-quality-approved', reworked.unitId, gRework.reason, gRework.decidedAt!)
log('Quality', 'gate-issued', reworked.unitId, gRework.reason, gRework.qualityAt!)
log('Production', 'rework-completed', reworked.unitId, '', gRework.reworkDoneAt!)
log('Dispatch', 'dispatch-after-rework', reworked.unitId, `${reDispatch.driverName} · ${reDispatch.vehicleNumber}`, reDispatch.dispatchedAt)

// rejected by Quality — stays blocked from dispatch
const rejected = unitAt(11)
const gRejected = gateEntry(rejected, 'Physical damage beyond repair', 60)
Object.assign(gRejected, { status: 'rejected', decidedBy: 'Quality', decidedAt: daysAgo(58, 13) })
rejected.gateLog = [gRejected]
log('Quality', 'gate-quality-rejected', rejected.unitId, gRejected.reason, gRejected.decidedAt!)

// --- service remarks
const remarks: [number, string, string][] = [
  [7, 'Quality', 'Leak traced to service valve; new valve fitted.'],
  [7, 'Production', 'Pressure test held for 30 min — no drop.'],
  [10, 'Production', 'Panel replaced, repainted and re-inspected.'],
  [1, 'Gate', 'Unit received at gate with dealer paperwork.'],
]
for (const [i, user, text] of remarks) {
  const u = unitAt(i)
  // a remark lands two days after assembly, but never in the future
  const at = new Date(Math.min(u.assembledAt.getTime() + 48 * 60 * 60 * 1000, Date.now() - 60 * 1000))
  u.serviceRemarks.push({ user, text, at })
  log(user, 'remark', u.unitId, text.length > 60 ? `${text.slice(0, 60)}…` : text, at)
}

await UnitModel.insertMany(units)
await AuditLogModel.insertMany(audit)

console.log(`demo seed: ${customers.length} customers, ${units.length} units, ${audit.length} activity entries`)
await mongoose.disconnect()
