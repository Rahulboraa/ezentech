import type { Unit } from '@/types'

// What the machine is doing right now, in the words a customer would use.
export function machineStatus(u: Unit): {
  key: 'in-plant' | 'dispatched' | 'rework' | 'rejected'
  label: string
  tone: 'muted' | 'success' | 'warning' | 'destructive'
} {
  const gate = u.gate
  if (gate && gate.status === 'rejected') return { key: 'rejected', label: 'Rejected by Quality', tone: 'destructive' }
  // a gate entry that has not been dispatched again is still in the rework cycle
  if (gate && !u.dispatch) return { key: 'rework', label: 'In rework', tone: 'warning' }
  if (gate && u.dispatch?.afterRework === false) return { key: 'rework', label: 'In rework', tone: 'warning' }
  if (u.dispatch) return { key: 'dispatched', label: u.dispatch.afterRework ? 'Dispatched after rework' : 'Dispatched', tone: 'success' }
  return { key: 'in-plant', label: 'In plant', tone: 'muted' }
}
