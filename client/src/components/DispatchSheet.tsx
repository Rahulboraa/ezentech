import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, ApiError } from '@/lib/api'
import { LIVE, useRefreshAll, type Paged } from '@/lib/queries'
import { fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Unit } from '@/types'

interface FormValues {
  unitId: string
  driverName: string
  vehicleNumber: string
  location: string
}

const blank: FormValues = { unitId: '', driverName: '', vehicleNumber: '', location: '' }

export default function DispatchSheet({
  open,
  presetUnitId,
  onClose,
}: {
  open: boolean
  presetUnitId?: string
  onClose: () => void
}) {
  const refreshAll = useRefreshAll()
  const [overwriteFor, setOverwriteFor] = useState<FormValues | null>(null)
  const { register, handleSubmit, reset, watch, setValue } = useForm<FormValues>({ defaultValues: blank })

  useEffect(() => {
    if (open) reset({ ...blank, unitId: presetUnitId ?? '' })
  }, [open, presetUnitId, reset])

  // the picker only offers units that are actually allowed to leave today
  const { data: eligible } = useQuery({
    queryKey: ['units', 'dispatchable'],
    queryFn: () => api<Paged<Unit>>('/units?tab=dispatchable&limit=200'),
    enabled: open,
    ...LIVE,
  })

  const typed = watch('unitId').trim().toUpperCase()
  const { data: lookup } = useQuery({
    queryKey: ['unit', typed],
    queryFn: () => api<Unit>(`/units/${typed}`).catch(() => null),
    enabled: open && typed.length > 3,
  })

  const status = (() => {
    if (!typed) return null
    if (!lookup) return { text: 'No unit found with this ID.', tone: 'err' as const }
    const who = lookup.customerName ? ` — ${lookup.customerName}` : ''
    if (lookup.dispatch)
      return {
        text: `Already dispatched with ${lookup.dispatch.driverName} (${lookup.dispatch.vehicleNumber}) → ${lookup.dispatch.location} on ${fmtDate(lookup.dispatch.dispatchedAt)}. Saving again overwrites it.`,
        tone: 'warn' as const,
      }
    if (!lookup.canDispatch) {
      const gate = lookup.gate
      if (gate?.status === 'rejected')
        return { text: `${lookup.unitId}${who} was rejected by Quality at the Gate.`, tone: 'err' as const }
      if (gate?.status === 'issued')
        return { text: `${lookup.unitId}${who} is with Production for rework, not marked complete yet.`, tone: 'err' as const }
      return { text: `${lookup.unitId}${who} is still awaiting Quality approval.`, tone: 'err' as const }
    }
    return { text: `${lookup.unitId}${who} · ready to dispatch.`, tone: 'ok' as const }
  })()

  const save = useMutation({
    mutationFn: ({ v, overwrite }: { v: FormValues; overwrite: boolean }) =>
      api<Unit>(`/units/${v.unitId.trim().toUpperCase()}/dispatch`, {
        body: {
          driverName: v.driverName,
          vehicleNumber: v.vehicleNumber,
          location: v.location,
          overwrite,
        },
      }),
    onSuccess: (unit) => {
      refreshAll()
      toast.success(unit.dispatch?.afterRework ? 'Dispatched after rework' : 'Dispatch recorded')
      onClose()
    },
    onError: (e, vars) => {
      if (e instanceof ApiError && e.status === 409 && e.message.includes('already dispatched')) {
        setOverwriteFor(vars.v)
        return
      }
      toast.error(e instanceof Error ? e.message : 'Save failed')
    },
  })

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" size="40%" className="flex w-full flex-col gap-0 p-0">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Log dispatch</SheetTitle>
            <SheetDescription>Record the driver, vehicle and destination for a unit leaving the plant.</SheetDescription>
          </SheetHeader>
          <form
            onSubmit={handleSubmit((v) => save.mutate({ v, overwrite: false }))}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <div className="space-y-2">
                <Label htmlFor="ds-unit">Unit ID *</Label>
                <Input id="ds-unit"
                  {...register('unitId', { required: true })}
                  list="dispatchable-units"
                  autoComplete="off"
                  className="font-mono uppercase"
                  placeholder="Scan or pick a Unit ID…"
                  onChange={(e) => setValue('unitId', e.target.value.toUpperCase())}
                />
                <datalist id="dispatchable-units">
                  {(eligible?.rows ?? []).map((u) => (
                    <option key={u.id} value={u.unitId}>
                      {u.customerName}
                    </option>
                  ))}
                </datalist>
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
                <Label htmlFor="ds-driver">Driver name *</Label>
                <Input id="ds-driver" {...register('driverName', { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-vehicle">Vehicle number *</Label>
                <Input id="ds-vehicle"
                  {...register('vehicleNumber', { required: true })}
                  className="font-mono uppercase"
                  placeholder="e.g. UP16 AB 1234"
                  onChange={(e) => setValue('vehicleNumber', e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-location">Location *</Label>
                <Input id="ds-location" {...register('location', { required: true })} placeholder="Destination / delivery location" />
              </div>
            </div>
            <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                Log dispatch
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!overwriteFor} onOpenChange={(o) => !o && setOverwriteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This unit was already dispatched</AlertDialogTitle>
            <AlertDialogDescription>
              Overwrite the existing driver, vehicle and destination with the new details? The earlier trip stays in the
              unit's dispatch history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const v = overwriteFor!
                setOverwriteFor(null)
                save.mutate({ v, overwrite: true })
              }}
            >
              Overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
