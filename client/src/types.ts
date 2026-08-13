export const ROLES = ['production', 'dispatch', 'gate', 'quality', 'admin'] as const
export type Role = (typeof ROLES)[number]

export interface AuthUser {
  id: string
  name: string
  role: Role
}

export const PART_KEYS = ['compressor', 'motor', 'controller', 'heatExchanger'] as const
export type PartKey = (typeof PART_KEYS)[number]

export const PART_LABELS: Record<PartKey, string> = {
  compressor: 'Compressor',
  motor: 'Motor',
  controller: 'Controller',
  heatExchanger: 'Heat Exchanger',
}

export const UNIT_TYPES = {
  outdoor: { label: 'Outdoor Assy', prefix: 'ODU', parts: ['compressor', 'motor', 'controller', 'heatExchanger'] },
  indoor: { label: 'Indoor Assy', prefix: 'IDU', parts: ['motor', 'controller', 'heatExchanger'] },
  window: { label: 'Window Assy', prefix: 'WAC', parts: ['compressor', 'motor', 'controller', 'heatExchanger'] },
} as const satisfies Record<string, { label: string; prefix: string; parts: readonly PartKey[] }>

export type UnitType = keyof typeof UNIT_TYPES
export const UNIT_TYPE_KEYS = Object.keys(UNIT_TYPES) as UnitType[]

export type GateStatus = 'pending' | 'approved' | 'issued' | 'rejected'

export interface GateEntry {
  status: GateStatus
  reason: string
  requestedBy: string
  requestedAt: string
  decidedBy: string
  decidedAt: string | null
  qualityBy: string
  qualityAt: string | null
  reworkDone: boolean
  reworkDoneBy: string
  reworkDoneAt: string | null
}

export interface DispatchEntry {
  driverName: string
  vehicleNumber: string
  location: string
  dispatchedBy: string
  dispatchedAt: string
  afterRework: boolean
}

export interface ServiceRemark {
  user: string
  text: string
  at: string
}

export interface Unit {
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
  assembledAt: string
  loggedBy: string
  serviceRemarks: ServiceRemark[]
  dispatch: DispatchEntry | null
  dispatchLog: DispatchEntry[]
  gateLog: GateEntry[]
  /* derived server-side */
  gate: GateEntry | null
  isRework: boolean
  canDispatch: boolean
  readyForReworkDispatch: boolean
  ageDays: number | null
  aged: boolean
}

export interface Customer {
  id: string
  name: string
  phone: string
  city: string
  address: string
}

export interface AuditRow {
  id: string
  user: string
  action: string
  unitId: string
  details: string
  at: string
}

export function gateStatusLabel(status: GateStatus): string {
  if (status === 'approved') return 'Approved — Ready for Production'
  if (status === 'issued') return 'Issued to Production'
  if (status === 'rejected') return 'Rejected by Quality'
  return 'Pending Quality'
}

export const AGE_LIMIT_DAYS = 365

// VOLTAS 17-character serial: 7-char product code, variant, 2-digit year, month
// letter, manufacturing line, hourly time slot, then a 4-character random tail.
export const PRODUCT_CODE_LENGTH = 7
export const SHIFT_START_HOUR = 9
const MONTH_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function unitIdPrefix(
  { productCode, variant, lineCode }: { productCode: string; variant: string; lineCode: string },
  at: Date = new Date(),
) {
  if (productCode.length !== PRODUCT_CODE_LENGTH || !variant || !lineCode) return null
  const yy = String(at.getFullYear()).slice(-2)
  const slot = LETTERS[(at.getHours() - SHIFT_START_HOUR + 24) % 24]
  return productCode + variant + yy + MONTH_CODES[at.getMonth()] + lineCode + slot
}
