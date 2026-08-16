import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { LIVE, useRefreshAll, type Paged } from '@/lib/queries'
import { fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import UnitIdCombobox from '@/components/UnitIdCombobox'
import type { Unit } from '@/types'

interface FormValues {
  unitId: string
  reason: string
}

export default function GateRequestSheet({
  open,
  presetUnitId,
  onClose,
}: {
  open: boolean
  presetUnitId?: string
  onClose: () => void
}) {
  const refreshAll = useRefreshAll()
  const { register, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: { unitId: '', reason: '' },
  })

  // the combobox writes through setValue, so register the field by hand to keep
  // the required check
  useEffect(() => {
    register('unitId', { required: true })
  }, [register])

  useEffect(() => {
    if (open) reset({ unitId: presetUnitId ?? '', reason: '' })
  }, [open, presetUnitId, reset])

  const { data: known } = useQuery({
    queryKey: ['units', 'roster'],
    queryFn: () => api<Paged<Unit>>('/units?limit=200'),
    enabled: open,
    ...LIVE,
  })

  const typed = watch('unitId').trim().toUpperCase()
  const { data: lookup } = useQuery({
    queryKey: ['unit', typed],
    queryFn: () => api<Unit>(`/units/${typed}`).catch(() => null),
    // only a complete 17-character serial can resolve, so don't 404 on every keystroke
    enabled: open && typed.length === 17,
  })

  const status = (() => {
    if (!typed) return null
    if (!lookup) return { text: 'No unit found with this ID.', tone: 'err' as const }
    const gate = lookup.gate
    const who = lookup.customerName ? ` — ${lookup.customerName}` : ''
    // out of warranty is a hard stop: the unit goes back from the gate
    if (lookup.aged)
      return {
        text: `${lookup.unitId}${who} was manufactured ${lookup.ageDays} days ago — past the 365-day warranty window. Turn it away at the gate.`,
        tone: 'err' as const,
        blocked: true,
      }
    if (gate?.status === 'pending')
      return { text: `${lookup.unitId}${who} is already awaiting Quality approval.`, tone: 'warn' as const }
    if (gate?.status === 'approved')
      return { text: `${lookup.unitId}${who} was approved on ${fmtDate(gate.decidedAt)}, waiting to be issued.`, tone: 'ok' as const }
    if (gate?.status === 'issued')
      return { text: `${lookup.unitId}${who} is already with Production for rework.`, tone: 'ok' as const }
    if (gate?.status === 'rejected')
      return {
        text: `${lookup.unitId}${who} was rejected on ${fmtDate(gate.decidedAt)}. Submitting raises a fresh request.`,
        tone: 'warn' as const,
      }
    return { text: `${lookup.unitId}${who} · no entry request yet.`, tone: 'ok' as const }
  })()

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      api(`/units/${v.unitId.trim().toUpperCase()}/gate-request`, { body: { reason: v.reason } }),
    onSuccess: () => {
      refreshAll()
      toast.success('Entry request sent for Quality approval')
      onClose()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Save failed'),
  })

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" size="40%" className="flex w-full flex-col gap-0 p-0">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>New entry request</SheetTitle>
          <SheetDescription>
            A returned or rejected unit needs Quality approval before it can re-enter the factory.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <div className="space-y-2">
              <Label htmlFor="gs-unit">Unit ID *</Label>
              <UnitIdCombobox
                id="gs-unit"
                value={watch('unitId')}
                units={known?.rows ?? []}
                onChange={(v) => setValue('unitId', v, { shouldValidate: true })}
              />
              {status && (
                <p
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-[12.5px]',
                    status.tone === 'ok' && 'bg-success/10 text-success',
                    status.tone === 'warn' && 'bg-warning/10 text-warning',
                    status.tone === 'err' && 'bg-destructive/10 text-destructive',
                  )}
                >
                  {status.text}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gs-reason">Reason</Label>
              <Input id="gs-reason" {...register('reason')} placeholder="e.g. customer rejection, quality return" />
            </div>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !!status?.blocked}>
              Request approval
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
