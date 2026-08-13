import type { UnitDoc } from '../models/Unit.js';
import type { UnitType } from '../domain/units.js';
import {
  AGE_LIMIT_DAYS,
  canDispatch,
  isReadyForReworkDispatch,
  isReworkUnit,
  latestGateEntry,
  unitAgeDays,
} from '../domain/units.js';

function base(doc: Record<string, any>) {
  const { _id, __v, ...rest } = doc;
  return { id: String(_id), ...rest };
}

export interface SerializedCustomer {
  id: string
  name: string
  phone: string
  city: string
  address: string
  createdAt?: Date
  updatedAt?: Date
}

export function serializeCustomer(doc: Record<string, any>): SerializedCustomer {
  return base(doc) as SerializedCustomer;
}

export function serializeAudit(doc: Record<string, any>) {
  return base(doc);
}

export interface SerializedUnit {
  id: string
  unitId: string
  productCode: string
  variant: string
  lineCode: string
  type: UnitType
  compressor: string
  motor: string
  controller: string
  heatExchanger: string
  operator: string
  customerId: string
  customerName: string
  assembledAt: Date
  loggedBy: string
  serviceRemarks: { user: string; text: string; at: Date }[]
  dispatch: Record<string, any> | null
  dispatchLog: Record<string, any>[]
  gateLog: Record<string, any>[]
  gate: Record<string, any> | null
  isRework: boolean
  canDispatch: boolean
  readyForReworkDispatch: boolean
  ageDays: number | null
  aged: boolean
}

// Every panel reads the same derived flags, so they are computed once here
// instead of being re-derived — and drifting — in each client view.
export function serializeUnit(unit: UnitDoc | Record<string, any>): SerializedUnit {
  const plain = typeof (unit as UnitDoc).toObject === 'function' ? (unit as UnitDoc).toObject() : { ...(unit as any) };
  const ageDays = unitAgeDays(plain.assembledAt);
  return {
    ...base(plain),
    customerId: plain.customerId ? String(plain.customerId) : '',
    gate: latestGateEntry(plain),
    isRework: isReworkUnit(plain),
    canDispatch: canDispatch(plain),
    readyForReworkDispatch: isReadyForReworkDispatch(plain),
    ageDays,
    aged: ageDays !== null && ageDays > AGE_LIMIT_DAYS,
  } as SerializedUnit;
}

