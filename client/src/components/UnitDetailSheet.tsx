import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { LIVE, useRefreshAll } from '@/lib/queries'
import { fmtDate, fmtDateTimeSeconds } from '@/lib/format'
import GateStatusBadge from '@/components/GateStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { PART_LABELS, UNIT_TYPES, type Unit } from '@/types'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-[13px]">{children}</div>
    </div>
  )
}

export default function UnitDetailSheet({ unitId, onClose }: { unitId: string | null; onClose: () => void }) {
  const [text, setText] = useState('')
  const refreshAll = useRefreshAll()

  const { data: unit } = useQuery({
    queryKey: ['unit', unitId],
    queryFn: () => api<Unit>(`/units/${unitId}`),
    enabled: !!unitId,
    ...LIVE,
  })

  const addRemark = useMutation({
    mutationFn: () => api(`/units/${unitId}/remarks`, { body: { text: text.trim() } }),
    onSuccess: () => {
      setText('')
      refreshAll()
      toast.success('Remark added')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <Sheet open={!!unitId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" size="40%" className="flex w-full flex-col gap-0 p-0">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="font-mono">{unit?.unitId ?? unitId}</SheetTitle>
          <SheetDescription>
            {unit ? `${UNIT_TYPES[unit.type].label} · logged by ${unit.loggedBy}` : 'Loading…'}
          </SheetDescription>
        </SheetHeader>

        {unit && (
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {unit.aged && (
              <div className="rounded-lg bg-warning/10 px-3 py-2 text-[12.5px] text-warning">
                Manufactured {unit.ageDays} days ago — past the 365-day threshold.
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <Field label="Customer">{unit.customerName || '—'}</Field>
              <Field label="Assembled">{fmtDate(unit.assembledAt)}</Field>
              <Field label="Operator">{unit.operator || '—'}</Field>
              <Field label="Model">
                {unit.modelName || '—'}
                <div className="font-mono text-[11.5px] text-muted-foreground">
                  {unit.productCode}·{unit.variant}
                </div>
              </Field>
            </div>

            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Part serials
              </div>
              <div className="divide-y rounded-lg border">
                {UNIT_TYPES[unit.type].parts.map((k) => (
                  <div key={k} className="flex items-center justify-between px-3 py-2 text-[13px]">
                    <span className="text-muted-foreground">{PART_LABELS[k]}</span>
                    <span className="font-mono">{unit[k] || '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <Field label="Dispatch">
                {unit.dispatch ? (
                  <div className="space-y-1">
                    {unit.dispatch.afterRework && <Badge variant="success">Dispatched after rework</Badge>}
                    {unit.dispatch.invoiceNumber && (
                      <div>
                        Invoice <span className="font-mono">{unit.dispatch.invoiceNumber}</span>
                      </div>
                    )}
                    <div>
                      {unit.dispatch.driverName} · <span className="font-mono">{unit.dispatch.vehicleNumber}</span>
                    </div>
                    <div>{unit.dispatch.location}</div>
                    <div className="text-muted-foreground">
                      {fmtDate(unit.dispatch.dispatchedAt)} by {unit.dispatch.dispatchedBy}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not yet dispatched</span>
                )}
              </Field>

              <Field label="Gate status">
                {!unit.gate ? (
                  <span className="text-muted-foreground">No entry request</span>
                ) : (
                  <div className="space-y-1.5">
                    <GateStatusBadge gate={unit.gate} />
                    <div className="text-[12.5px] text-muted-foreground">
                      Requested {fmtDate(unit.gate.requestedAt)} by {unit.gate.requestedBy}
                    </div>
                    {unit.gate.decidedAt && (
                      <div className="text-[12.5px] text-muted-foreground">
                        Quality {unit.gate.status === 'rejected' ? 'rejected' : 'approved'}{' '}
                        {fmtDate(unit.gate.decidedAt)} by {unit.gate.decidedBy}
                      </div>
                    )}
                    {unit.gate.qualityAt && (
                      <div className="text-[12.5px] text-muted-foreground">
                        Issued to Production {fmtDate(unit.gate.qualityAt)} by {unit.gate.qualityBy}
                      </div>
                    )}
                    {unit.gate.reworkDoneAt && (
                      <div className="text-[12.5px] text-muted-foreground">
                        Rework completed {fmtDate(unit.gate.reworkDoneAt)} by {unit.gate.reworkDoneBy}
                      </div>
                    )}
                    {unit.gate.reason && (
                      <div className="text-[12.5px] text-muted-foreground">Reason: {unit.gate.reason}</div>
                    )}
                  </div>
                )}
              </Field>
            </div>

            <Separator />

            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Service remarks
              </div>
              <div className="space-y-2">
                {unit.serviceRemarks.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-4 text-center text-[12.5px] text-muted-foreground">
                    No service remarks yet.
                  </p>
                ) : (
                  [...unit.serviceRemarks].reverse().map((m, i) => (
                    <div key={i} className="rounded-lg bg-muted/60 px-3 py-2">
                      <div className="text-[11px] text-muted-foreground">
                        {fmtDateTimeSeconds(m.at)} · {m.user}
                      </div>
                      <div className="text-[13px]">{m.text}</div>
                    </div>
                  ))
                )}
              </div>
              <Textarea
                rows={2}
                className="mt-3"
                placeholder="Add a service remark…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="mt-2 flex justify-end">
                <Button size="sm" disabled={!text.trim() || addRemark.isPending} onClick={() => addRemark.mutate()}>
                  Add remark
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
