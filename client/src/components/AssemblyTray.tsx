import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, CircleAlert, X } from 'lucide-react'
import { api } from '@/lib/api'
import { useRefreshAll } from '@/lib/queries'
import { beep } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import CustomerCombobox from '@/components/CustomerCombobox'
import {
  PART_LABELS,
  PRODUCT_CODE_LENGTH,
  UNIT_TYPES,
  UNIT_TYPE_KEYS,
  unitIdPrefix,
  type Customer,
  type PartKey,
  type Unit,
  type UnitType,
} from '@/types'

// the line the station is running on — the 12th character of every serial it issues
const LINE_KEY = 'ez_line_code'

type SlotState = { value: string; dup: string | null }

const emptySlot: SlotState = { value: '', dup: null }

export default function AssemblyTray({ customers }: { customers: Customer[] }) {
  const [type, setType] = useState<UnitType>('outdoor')
  const [productCode, setProductCode] = useState('')
  const [variant, setVariant] = useState('')
  const [lineCode, setLineCode] = useState(() => localStorage.getItem(LINE_KEY) ?? '')
  const [operator, setOperator] = useState('')
  const [customerId, setCustomerId] = useState('none')
  const [slots, setSlots] = useState<Record<string, SlotState>>({})
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
  const refreshAll = useRefreshAll()

  const keys: readonly PartKey[] = UNIT_TYPES[type].parts

  useEffect(() => {
    setSlots(Object.fromEntries(keys.map((k) => [k, emptySlot])))
  }, [type]) // eslint-disable-line react-hooks/exhaustive-deps

  const filledCount = keys.filter((k) => slots[k]?.value).length
  const complete =
    filledCount === keys.length && productCode.length === PRODUCT_CODE_LENGTH && !!variant && !!lineCode
  const hasDup = keys.some((k) => slots[k]?.dup)

  // Year, month, line and time slot are derived; only the 4-character tail is
  // allocated by the server when the unit is logged.
  const platePreview = useMemo(
    () => unitIdPrefix({ productCode, variant, lineCode }),
    [productCode, variant, lineCode],
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

  function clearTray() {
    setSlots(Object.fromEntries(keys.map((k) => [k, emptySlot])))
    setProductCode('')
    setVariant('')
    setOperator('')
    inputs.current[keys[0]]?.focus()
  }

  const logUnit = useMutation({
    mutationFn: () =>
      api<Unit>('/units', {
        body: {
          type,
          productCode,
          variant,
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
          {filledCount} of {keys.length} parts
        </span>
      </div>

      <div className="grid gap-4 border-b px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="tray-customer">Customer</Label>
          <CustomerCombobox id="tray-customer" value={customerId} customers={customers} onChange={setCustomerId} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tray-code">Product code</Label>
          <Input
            id="tray-code"
            value={productCode}
            maxLength={PRODUCT_CODE_LENGTH}
            placeholder="4011571"
            className="font-mono uppercase tracking-[0.08em]"
            onChange={(e) =>
              setProductCode(
                e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, PRODUCT_CODE_LENGTH),
              )
            }
          />
          <p className="text-[11.5px] text-muted-foreground">
            {PRODUCT_CODE_LENGTH} characters (chars 1–7)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="tray-variant">Variant</Label>
            <Input
              id="tray-variant"
              value={variant}
              maxLength={1}
              placeholder="A"
              className="font-mono uppercase"
              onChange={(e) => setVariant(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1))}
            />
            <p className="text-[11.5px] text-muted-foreground">Char 8 · part change</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tray-line">Line</Label>
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
            <p className="text-[11.5px] text-muted-foreground">Char 12 · WAC line</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tray-type">Assembly type</Label>
          <Select value={type} onValueChange={(v) => setType(v as UnitType)}>
            <SelectTrigger id="tray-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_TYPE_KEYS.map((tk) => (
                <SelectItem key={tk} value={tk}>
                  <span className="font-mono">{UNIT_TYPES[tk].prefix}</span>
                  <span className="text-muted-foreground"> · {UNIT_TYPES[tk].label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11.5px] text-muted-foreground">{keys.length} parts required</p>
        </div>
      </div>

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
              'Awaiting product code, variant and line'
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="tray-operator">Operator</Label>
            <Input
              id="tray-operator"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="Name or badge #"
              className="w-48"
            />
          </div>
          <Button variant="outline" onClick={clearTray}>
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
