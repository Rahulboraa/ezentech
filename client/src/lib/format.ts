import { AGE_LIMIT_DAYS, type GateStatus } from '@/types'

export function todayYmd() {
  return new Date().toLocaleDateString('en-CA')
}

export function fmtDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  )
}

export function fmtDateTimeSeconds(value: string | Date) {
  const d = new Date(value)
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  )
}

export function agedTitle(ageDays: number | null) {
  return ageDays !== null && ageDays > AGE_LIMIT_DAYS
    ? `Manufactured ${ageDays} days ago — exceeds the ${AGE_LIMIT_DAYS}-day threshold`
    : undefined
}

export const GATE_BADGE: Record<GateStatus | 'reworked', 'warning' | 'info' | 'success' | 'destructive'> = {
  pending: 'warning',
  approved: 'info',
  issued: 'info',
  rejected: 'destructive',
  reworked: 'success',
}

export const ROLE_LABEL: Record<string, string> = {
  production: 'Production',
  dispatch: 'Dispatch',
  gate: 'Gate',
  quality: 'Quality',
  admin: 'Admin',
}
