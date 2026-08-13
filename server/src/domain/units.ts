export const PART_KEYS = ['compressor', 'motor', 'controller', 'heatExchanger'] as const;
export type PartKey = (typeof PART_KEYS)[number];

export const PART_LABELS: Record<PartKey, string> = {
  compressor: 'Compressor',
  motor: 'Motor',
  controller: 'Controller',
  heatExchanger: 'Heat Exchanger',
};

export const UNIT_TYPES = {
  outdoor: { label: 'Outdoor Assy', prefix: 'ODU', parts: ['compressor', 'motor', 'controller', 'heatExchanger'] },
  indoor: { label: 'Indoor Assy', prefix: 'IDU', parts: ['motor', 'controller', 'heatExchanger'] },
  window: { label: 'Window Assy', prefix: 'WAC', parts: ['compressor', 'motor', 'controller', 'heatExchanger'] },
} as const satisfies Record<string, { label: string; prefix: string; parts: readonly PartKey[] }>;

export type UnitType = keyof typeof UNIT_TYPES;
export const UNIT_TYPE_KEYS = Object.keys(UNIT_TYPES) as UnitType[];

export function partsForType(type: UnitType): readonly PartKey[] {
  return UNIT_TYPES[type].parts;
}

// VOLTAS 17-character serial format
//  1-7:  VOLTAS product code
//  8:    product variant — the critical-part-change code (motor, PCB, compressor…)
//  9-10: 2-digit year (2026 → 26)
//  11:   month code Jan=A … Dec=L
//  12:   Amber WAC code / manufacturing line
//  13:   time slot, one letter per hour of the shift (09:00–09:59 = A, 10:00–10:59 = B…)
//  14-17: 4-character random alphanumeric serial
const MONTH_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const PRODUCT_CODE_LENGTH = 7;
export const SERIAL_SUFFIX_LENGTH = 4;
export const SHIFT_START_HOUR = 9;

function alnumOnly(raw: string): string {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizeProductCode(raw: string): string {
  return alnumOnly(raw).slice(0, PRODUCT_CODE_LENGTH);
}

export function randomAlnum(len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ALNUM[Math.floor(Math.random() * ALNUM.length)];
  return s;
}

export function monthCode(at: Date): string {
  return MONTH_CODES[at.getMonth()];
}

// The shift starts at 9 AM, so that hour is A and each later hour steps a letter.
// Hours before the shift wrap around rather than falling off the alphabet.
export function timeSlotCode(at: Date): string {
  return LETTERS[(at.getHours() - SHIFT_START_HOUR + 24) % 24];
}

export interface UnitIdParts {
  productCode: string;
  variant: string;
  lineCode: string;
}

export function generateUnitId(
  { productCode, variant, lineCode }: UnitIdParts,
  at: Date = new Date(),
  suffix = randomAlnum(SERIAL_SUFFIX_LENGTH),
): string {
  const code = normalizeProductCode(productCode).padEnd(PRODUCT_CODE_LENGTH, 'X');
  const yy = String(at.getFullYear()).slice(-2);
  return (
    code +
    alnumOnly(variant).slice(0, 1) +
    yy +
    monthCode(at) +
    alnumOnly(lineCode).slice(0, 1) +
    timeSlotCode(at) +
    suffix
  );
}

// Everything up to the random tail is deterministic, so the station can preview it.
export function unitIdPrefix(parts: UnitIdParts, at: Date = new Date()): string {
  return generateUnitId(parts, at, '');
}

// A unit's date of manufacturing is the moment it was logged at the assembly
// station. Anything past this threshold is flagged across every panel.
export const AGE_LIMIT_DAYS = 365;

export function unitAgeDays(assembledAt: Date | string | undefined | null): number | null {
  if (!assembledAt) return null;
  const ms = Date.now() - new Date(assembledAt).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export type GateStatus = 'pending' | 'approved' | 'issued' | 'rejected';

export function gateStatusLabel(status: GateStatus): string {
  if (status === 'approved') return 'Approved — Ready for Production';
  if (status === 'issued') return 'Issued to Production';
  if (status === 'rejected') return 'Rejected by Quality';
  return 'Pending Quality';
}

export interface GateEntryLike {
  status: GateStatus;
  reworkDone?: boolean;
}

export interface UnitLike {
  gateLog?: GateEntryLike[];
  dispatch?: unknown;
}

export function latestGateEntry<T extends GateEntryLike>(unit: { gateLog?: T[] }): T | null {
  const log = unit.gateLog;
  return log && log.length ? log[log.length - 1] : null;
}

// A unit becomes "Rework" the moment it has ever been raised at the Gate.
// Everything else is "New Production".
export function isReworkUnit(unit: UnitLike): boolean {
  return !!(unit.gateLog && unit.gateLog.length);
}

export function isIssuedToProduction(unit: UnitLike): boolean {
  const last = latestGateEntry(unit);
  return !!(last && last.status === 'issued');
}

export function isReworkDone(unit: UnitLike): boolean {
  const last = latestGateEntry(unit);
  return !!(last && last.reworkDone);
}

// Only issued rework units that Production has finished may move to Dispatch.
export function isReadyForReworkDispatch(unit: UnitLike): boolean {
  return isIssuedToProduction(unit) && isReworkDone(unit);
}

export function canDispatch(unit: UnitLike): boolean {
  return !isReworkUnit(unit) || isReadyForReworkDispatch(unit);
}
