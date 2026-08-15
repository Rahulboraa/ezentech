import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, CircleAlert, Settings2, X } from 'lucide-react'
import { api } from '@/lib/api'
import { useRefreshAll } from '@/lib/queries'
import { beep } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import CustomerCombobox from '@/components/CustomerCombobox'
import ModelCombobox from '@/components/ModelCombobox'
import {
  PART_LABELS,
  UNIT_TYPES,
  unitIdPrefix,
  type Customer,
  type PartKey,
  type ProductModel,
  type Unit,
} from '@/types'

// The line the station is running on — the 12th character of every serial it
// issues. Set once when the station is commissioned, not per unit.
const LINE_KEY = 'ez_line_code'
// The model and the operator outlast a single unit: the line runs one model for
// a whole batch and one person mans the station for a whole shift, so both
// survive a log, a page reload and a shift handover.
const MODEL_KEY = 'ez_model_id'
const OPERATOR_KEY = 'ez_operator'

type SlotState = { value: string; dup: string | null }

const emptySlot: SlotState = { value: '', dup: null }

export default function AssemblyTray({
  customers,
  models,
  modelsLoaded,
}: {
  customers: Customer[]
  models: ProductModel[]
  modelsLoaded: boolean
}) {
  const [modelId, setModelId] = useState(() => localStorage.getItem(MODEL_KEY) ?? '')
  const [lineCode, setLineCode] = useState(() => localStorage.getItem(LINE_KEY) ?? '')
  const [operator, setOperator] = useState(() => localStorage.getItem(OPERATOR_KEY) ?? '')
  const [customerId, setCustomerId] = useState('none')
  const [slots, setSlots] = useState<Record<string, SlotState>>({})
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
  const refreshAll = useRefreshAll()

  const model = models.find((m) => m.id === modelId) ?? null
  const keys: readonly PartKey[] = model ? UNIT_TYPES[model.type].parts : []

  // A retired or deleted model must not stay silently selected — the server
  // would reject the log with an error the operator cannot act on.
  useEffect(() => {
    if (modelsLoaded && modelId && !model) selectModel('')
  }, [modelsLoaded, modelId, model]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSlots(Object.fromEntries(keys.map((k) => [k, emptySlot])))
  }, [model?.type, model?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectModel(id: string) {
    setModelId(id)
    if (id) localStorage.setItem(MODEL_KEY, id)
    else localStorage.removeItem(MODEL_KEY)
  }

  const filledCount = keys.filter((k) => slots[k]?.value).length
  const complete = !!model && !!lineCode && keys.length > 0 && filledCount === keys.length
  const hasDup = keys.some((k) => slots[k]?.dup)

  // Year, month, line and time slot are derived; only the 4-character tail is
  // allocated by the server when the unit is logged.
  const platePreview = useMemo(
    () => (model ? unitIdPrefix({ productCode: model.productCode, variant: model.variant, lineCode }) : null),
    [model, lineCode],
  )

  function focusNextEmpty(from: PartKey, current: Record<string, SlotState>) {
    const idx = keys.indexOf(from)
    for (let i = 1; i <= keys.length; i++) {
      const next = keys[(idx + i) % keys.length]
      if (!current[next]?.value) {
        inputs.current[next]?.focus()
        return
      }
    }
  }

  async function commit(key: PartKey, raw: string) {
    const value = raw.trim()
    if (!value) return
    if (slots[key]?.value === value && slots[key]?.dup !== undefined) return

    const clash = keys.find((k) => k !== key && slots[k]?.value === value)
    if (clash) {
      setSlots((s) => ({ ...s, [key]: { value, dup: `Also entered as ${PART_LABELS[clash]}` } }))
      beep(false)
      return
    }

    const hit = await api<{ used: boolean; unitId?: string; part?: string }>(
      `/units/serial-lookup?value=${encodeURIComponent(value)}`,
    ).catch(() => ({ used: false }) as const)

    setSlots((s) => {
      const next = {
        ...s,
        [key]: { value, dup: hit.used ? `Already used in ${hit.unitId} as ${hit.part}` : null },
      }
      if (!hit.used) focusNextEmpty(key, next)
      return next
    })
    beep(!hit.used)
  }

  function clearSlot(key: PartKey) {
    setSlots((s) => ({ ...s, [key]: emptySlot }))
    inputs.current[key]?.focus()
  }

  // The line keeps running the same model with the same operator, so only the
  // part serials are wiped and the first slot takes focus for the next scan.
  function clearTray() {
    setSlots(Object.fromEntries(keys.map((k) => [k, emptySlot])))
    inputs.current[keys[0]]?.focus()
  }

  const logUnit = useMutation({
    mutationFn: () =>
      api<Unit>('/units', {
        body: {
          modelId,
          lineCode,
          operator,
          customerId: customerId === 'none' ? null : customerId,
          ...Object.fromEntries(keys.map((k) => [k, slots[k].value])),
        },
      }),
    onSuccess: (unit) => {
      refreshAll()
      toast.success(`Unit ${unit.unitId} logged`)
      clearTray()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not log unit'),
  })

  if (modelsLoaded && models.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center">
        <h2 className="text-[15px] font-semibold tracking-tight">No models set up yet</h2>
        <p className="mx-auto mt-1.5 max-w-md text-[12.5px] text-muted-foreground">
          A model holds the product code, variant and assembly type for one product, so the operator only scans parts.
          Add the first one before logging a unit.
        </p>
        <Button className="mt-4" asChild>
          <Link to="/models">Set up models</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Assembly tray</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Scan each part serial with the barcode scanner or type it and press Enter. The Unit ID is issued when you
            log the unit.
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[12px] font-medium tabular-nums text-muted-foreground">
          {filledCount} of {keys.length || '—'} parts
        </span>
      </div>

      <div className="grid gap-4 border-b px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="tray-model">Model on the line</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-my-1 h-7 gap-1.5 px-2 text-[11.5px] font-normal text-muted-foreground"
                >
                  <Settings2 className="size-3.5" />
                  Line {lineCode || '— not set'}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-2">
                <Label htmlFor="tray-line">Manufacturing line</Label>
                <Input
                  id="tray-line"
                  value={lineCode}
                  maxLength={1}
                  placeholder="K"
                  className="font-mono uppercase"
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1)
                    setLineCode(v)
                    localStorage.setItem(LINE_KEY, v)
                  }}
                />
                <p className="text-[11.5px] text-muted-foreground">
                  A station setting, not a per-unit one — set it once when the station is commissioned. It becomes the
                  12th character of every serial this station issues.
                </p>
              </PopoverContent>
            </Popover>
          </div>
          <ModelCombobox id="tray-model" value={modelId} models={models} onChange={selectModel} />
          <p className="text-[11.5px] text-muted-foreground">
            {model
              ? `${UNIT_TYPES[model.type].label} · ${keys.length} parts required`
              : 'Stays selected until the line changes over.'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tray-customer">Customer</Label>
          <CustomerCombobox id="tray-customer" value={customerId} customers={customers} onChange={setCustomerId} />
          <p className="text-[11.5px] text-muted-foreground">Optional — carried over to the next unit.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tray-operator">Operator</Label>
          <Input
            id="tray-operator"
            value={operator}
            placeholder="Name or badge #"
            onChange={(e) => {
              setOperator(e.target.value)
              localStorage.setItem(OPERATOR_KEY, e.target.value)
            }}
          />
          <p className="text-[11.5px] text-muted-foreground">Remembered for the whole shift.</p>
        </div>
      </div>

      {!lineCode && (
        <p className="border-b bg-warning/10 px-5 py-2.5 text-[12.5px] text-warning">
          This station has no manufacturing line set. Open the line setting above and enter it before logging a unit.
        </p>
      )}

      {model ? (
        <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
          {keys.map((key) => {
            const slot = slots[key] ?? emptySlot
            const filled = !!slot.value && !slot.dup
            return (
              <div
                key={key}
                className={cn(
                  'rounded-lg border p-3 transition-colors',
                  filled && 'border-success/50 bg-success/5',
                  slot.dup && 'border-destructive/60 bg-destructive/5',
                )}
              >
                <div className="flex h-6 items-center justify-between">
                  <Label htmlFor={`slot-${key}`} className="flex items-center gap-1.5 text-[12.5px] font-medium">
                    {filled && <Check className="size-3.5 text-success" />}
                    {slot.dup && <CircleAlert className="size-3.5 text-destructive" />}
                    {PART_LABELS[key]}
                  </Label>
                  {slot.value && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Clear ${PART_LABELS[key]}`}
                      className="text-muted-foreground"
                      onClick={() => clearSlot(key)}
                    >
                      <X />
                    </Button>
                  )}
                </div>
                <Input
                  id={`slot-${key}`}
                  ref={(el) => {
                    inputs.current[key] = el
                  }}
                  className="mt-2 font-mono"
                  placeholder="Serial number"
                  autoComplete="off"
                  defaultValue={slot.value}
                  key={`${key}-${slot.value}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void commit(key, e.currentTarget.value)
                    }
                  }}
                  onBlur={(e) => void commit(key, e.currentTarget.value)}
                />
                {slot.dup && <p className="mt-1.5 text-[11.5px] leading-tight text-destructive">{slot.dup}</p>}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">
          Pick the model this line is running to open the part slots.
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 border-t bg-muted/30 px-5 py-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Unit ID</div>
          <div
            className={cn(
              'mt-1 font-mono text-[18px] font-semibold tracking-[0.04em]',
              !complete && 'text-muted-foreground/60',
            )}
          >
            {platePreview ? (
              <>
                {platePreview}
                <span className="text-muted-foreground/40">••••</span>
              </>
            ) : (
              'Issued automatically when you log the unit'
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Button variant="outline" onClick={clearTray} disabled={!model}>
            Clear tray
          </Button>
          <Button disabled={!complete || hasDup || logUnit.isPending} onClick={() => logUnit.mutate()}>
            Log unit
          </Button>
        </div>
      </div>
    </section>
  )
}
