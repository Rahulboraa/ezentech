import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Loader2, X } from 'lucide-react'
import { api } from '@/lib/api'
import { LIVE, useRefreshAll, type Paged } from '@/lib/queries'
import { fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import UnitIdCombobox from '@/components/UnitIdCombobox'
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

interface Trip {
  driverName: string
  vehicleNumber: string
  location: string
  invoiceNumber: string
}

const blankTrip: Trip = { driverName: '', vehicleNumber: '', location: '', invoiceNumber: '' }

type Tone = 'ok' | 'warn' | 'err'

interface Row {
  unitId: string
  /** null while the lookup is in flight */
  unit: Unit | null
  loading: boolean
  tone: Tone
  note: string
}

interface BatchResult {
  dispatched: Unit[]
  failed: { unitId: string; error: string; alreadyDispatched: boolean }[]
}

// Reads the same rework rules the Dispatch button on the table does, so a unit
// is judged the moment it lands on the truck rather than at save time.
function describe(unit: Unit | null): { tone: Tone; note: string } {
  if (!unit) return { tone: 'err', note: 'No unit found with this ID' }
  const who = unit.customerName ? ` — ${unit.customerName}` : ''
  if (unit.dispatch) {
    return {
      tone: 'warn',
      note: `Already went out with ${unit.dispatch.driverName} (${unit.dispatch.vehicleNumber}) on ${fmtDate(unit.dispatch.dispatchedAt)} — saving overwrites it`,
    }
  }
  if (!unit.canDispatch) {
    if (unit.gate?.status === 'rejected') return { tone: 'err', note: `Rejected by Quality at the Gate${who}` }
    if (unit.gate?.status === 'issued') return { tone: 'err', note: `With Production for rework, not marked complete${who}` }
    return { tone: 'err', note: `Still awaiting Quality approval${who}` }
  }
  return { tone: 'ok', note: unit.customerName || 'Ready to load' }
}

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
  const [trip, setTrip] = useState<Trip>(blankTrip)
  const [rows, setRows] = useState<Row[]>([])
  const [scan, setScan] = useState('')
  const [error, setError] = useState('')
  const [confirmOverwrite, setConfirmOverwrite] = useState<string[] | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)

  // the picker only offers units that are actually allowed to leave today
  const { data: eligible } = useQuery({
    queryKey: ['units', 'dispatchable'],
    queryFn: () => api<Paged<Unit>>('/units?tab=dispatchable&limit=200'),
    enabled: open,
    ...LIVE,
  })

  useEffect(() => {
    if (!open) return
    setTrip(blankTrip)
    setScan('')
    setError('')
    setRows([])
    if (presetUnitId) void addUnit(presetUnitId)
  }, [open, presetUnitId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addUnit(raw: string) {
    const unitId = raw.trim().toUpperCase()
    if (!unitId) return
    let duplicate = false
    setRows((r) => {
      duplicate = r.some((x) => x.unitId === unitId)
      return duplicate ? r : [...r, { unitId, unit: null, loading: true, tone: 'ok', note: 'Looking up…' }]
    })
    if (duplicate) {
      setError(`${unitId} is already on this truck`)
      return
    }
    setError('')
    const unit = await api<Unit>(`/units/${unitId}`).catch(() => null)
    setRows((r) => r.map((x) => (x.unitId === unitId ? { ...x, unit, loading: false, ...describe(unit) } : x)))
  }

  function removeUnit(unitId: string) {
    setRows((r) => r.filter((x) => x.unitId !== unitId))
    scanRef.current?.focus()
  }

  const loadable = rows.filter((r) => !r.loading && r.tone !== 'err')
  const blocked = rows.filter((r) => !r.loading && r.tone === 'err')
  const overwriting = loadable.filter((r) => r.tone === 'warn')

  const save = useMutation({
    mutationFn: (overwrite: boolean) =>
      api<BatchResult>('/units/dispatch-batch', {
        body: { ...trip, unitIds: loadable.map((r) => r.unitId), overwrite },
      }),
    onSuccess: (result) => {
      refreshAll()
      if (result.dispatched.length) {
        const n = result.dispatched.length
        toast.success(`${n} unit${n === 1 ? '' : 's'} dispatched on invoice ${trip.invoiceNumber}`)
      }
      if (!result.failed.length) return onClose()
      // whatever the server refused stays on screen with its reason
      setRows(
        result.failed.map((f) => ({
          unitId: f.unitId,
          unit: null,
          loading: false,
          tone: 'err' as Tone,
          note: f.error,
        })),
      )
      setError(`${result.failed.length} unit${result.failed.length === 1 ? '' : 's'} could not be dispatched.`)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Save failed'),
  })

  function submit() {
    if (!trip.driverName.trim()) return setError('Driver name is required')
    if (!trip.vehicleNumber.trim()) return setError('Vehicle number is required')
    if (!trip.location.trim()) return setError('Location is required')
    if (!trip.invoiceNumber.trim()) return setError('Invoice number is required')
    if (!loadable.length) return setError('Scan at least one unit onto the truck')
    setError('')
    if (overwriting.length) return setConfirmOverwrite(overwriting.map((r) => r.unitId))
    save.mutate(false)
  }

  function field(key: keyof Trip, label: string, props: React.ComponentProps<typeof Input> = {}) {
    return (
      <div className="space-y-2">
        <Label htmlFor={`ds-${key}`}>{label} *</Label>
        <Input
          id={`ds-${key}`}
          value={trip[key]}
          onChange={(e) => setTrip((t) => ({ ...t, [key]: e.target.value }))}
          {...props}
        />
      </div>
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" size="40%" className="flex w-full flex-col gap-0 p-0">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Log dispatch</SheetTitle>
            <SheetDescription>
              One truck, one invoice. Enter the trip once, then scan every unit going on board.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {field('invoiceNumber', 'Invoice number', {
                placeholder: 'e.g. INV-2451',
                className: 'font-mono uppercase placeholder:normal-case',
                onChange: (e) => setTrip((t) => ({ ...t, invoiceNumber: e.target.value.toUpperCase() })),
              })}
              {field('vehicleNumber', 'Vehicle number', {
                placeholder: 'e.g. UP16 AB 1234',
                className: 'font-mono uppercase placeholder:normal-case',
                onChange: (e) => setTrip((t) => ({ ...t, vehicleNumber: e.target.value.toUpperCase() })),
              })}
              {field('driverName', 'Driver name')}
              {field('location', 'Location', { placeholder: 'Destination / delivery location' })}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ds-scan">Units on this truck</Label>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-medium tabular-nums text-muted-foreground">
                  {loadable.length} loaded
                  {blocked.length > 0 && ` · ${blocked.length} blocked`}
                </span>
              </div>
              <UnitIdCombobox
                id="ds-scan"
                ref={scanRef}
                value={scan}
                units={(eligible?.rows ?? []).filter((u) => !rows.some((r) => r.unitId === u.unitId))}
                placeholder="Scan a Unit ID and press Enter…"
                onChange={(v) => setScan(v)}
                onSelect={(v) => {
                  void addUnit(v)
                  setScan('')
                }}
              />
              <p className="text-[11.5px] text-muted-foreground">
                The field stays ready after each scan — keep going until the truck is full.
              </p>
            </div>

            {rows.length > 0 && (
              <ul className="divide-y overflow-hidden rounded-lg border">
                {rows.map((r) => (
                  <li key={r.unitId} className="flex items-start gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[12.5px]">{r.unitId}</div>
                      <div
                        className={cn(
                          'text-[11.5px] leading-tight',
                          r.tone === 'ok' && 'text-muted-foreground',
                          r.tone === 'warn' && 'text-warning',
                          r.tone === 'err' && 'text-destructive',
                        )}
                      >
                        {r.note}
                      </div>
                    </div>
                    {r.loading ? (
                      <Loader2 className="mt-1 size-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${r.unitId}`}
                        className="text-muted-foreground"
                        onClick={() => removeUnit(r.unitId)}
                      >
                        <X />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {blocked.length > 0 && (
              <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-[12.5px] text-destructive">
                {blocked.length} unit{blocked.length === 1 ? '' : 's'} cannot leave and will stay behind — remove
                {blocked.length === 1 ? ' it' : ' them'} from the truck or clear the block first.
              </p>
            )}

            {error && <p className="text-[12.5px] text-destructive">{error}</p>}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={save.isPending || !loadable.length}>
              {loadable.length ? `Dispatch ${loadable.length} unit${loadable.length === 1 ? '' : 's'}` : 'Dispatch'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmOverwrite} onOpenChange={(o) => !o && setConfirmOverwrite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmOverwrite?.length === 1 ? 'This unit was already dispatched' : 'Some units were already dispatched'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmOverwrite?.join(', ')} already left on an earlier trip. Overwrite the driver, vehicle, destination
              and invoice with this trip's? The earlier trips stay in each unit's dispatch history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOverwrite(null)
                save.mutate(true)
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
