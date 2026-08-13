import { Badge } from '@/components/ui/badge'
import { GATE_BADGE } from '@/lib/format'
import { gateStatusLabel, type GateEntry, type GateStatus } from '@/types'

// Tables get the one-word state so the column never squeezes the row actions;
// the full sentence stays on hover and in the detail sheet.
const SHORT: Record<GateStatus | 'reworked', string> = {
  pending: 'Pending',
  approved: 'Approved',
  issued: 'Issued',
  rejected: 'Rejected',
  reworked: 'Reworked',
}

export default function GateStatusBadge({ gate, short = true }: { gate: GateEntry | null; short?: boolean }) {
  if (!gate) return <span className="text-muted-foreground">—</span>
  const key = gate.reworkDone ? 'reworked' : gate.status
  const full = gate.reworkDone ? 'Reworked — Ready for Dispatch' : gateStatusLabel(gate.status)
  return (
    <Badge variant={GATE_BADGE[key]} title={full}>
      {short ? SHORT[key] : full}
    </Badge>
  )
}
