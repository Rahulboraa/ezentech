import { TriangleAlert } from 'lucide-react'
import { agedTitle } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Unit } from '@/types'

// A unit older than the manufacturing-age threshold has to stand out in every
// panel, so the Unit ID itself carries the warning.
export default function UnitIdCell({ unit, className }: { unit: Unit; className?: string }) {
  return (
    <span
      title={agedTitle(unit.ageDays)}
      className={cn('inline-flex items-center gap-1.5 font-mono text-[12.5px] font-medium', className)}
    >
      {unit.aged && <TriangleAlert className="size-3.5 shrink-0 text-warning" />}
      <span className={cn(unit.aged && 'text-warning')}>{unit.unitId}</span>
    </span>
  )
}
