import { useRef, useState } from 'react'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { Unit } from '@/types'

// A barcode gun types the whole ID and hits Enter, so the field stays a plain
// input; the popover is only an assist for people picking by hand.
export default function UnitIdCombobox({
  id,
  value,
  units,
  onChange,
  onSelect,
  placeholder = 'Scan or pick a Unit ID…',
  ...inputProps
}: {
  id?: string
  value: string
  units: Unit[]
  onChange: (value: string) => void
  /** Fired once the ID is committed — the scanner's Enter, or a pick from the list. */
  onSelect?: (value: string) => void
  placeholder?: string
} & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'onSelect' | 'id'>) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function commit(id: string) {
    onChange(id)
    onSelect?.(id)
    setOpen(false)
  }

  const needle = value.trim().toUpperCase()
  const matches = units
    .filter((u) => !needle || u.unitId.includes(needle) || u.customerName.toUpperCase().includes(needle))
    .slice(0, 8)
  const exact = matches.length === 1 && matches[0].unitId === needle

  // open on focus even before the list has loaded — the empty state explains
  // itself, and a scanner that fills the field exactly closes it again
  return (
    <Popover open={open && !exact} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          {...inputProps}
          ref={inputRef}
          id={id}
          value={value}
          autoComplete="off"
          placeholder={placeholder}
          // uppercase without shouting the placeholder back at the operator
          className={cn('font-mono uppercase placeholder:normal-case', inputProps.className)}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase())
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !onSelect) return
            e.preventDefault()
            // one highlighted match means the gun scanned a partial the operator
            // clearly meant; otherwise take what is in the field
            commit(matches.length === 1 ? matches[0].unitId : e.currentTarget.value.trim().toUpperCase())
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        // the field keeps the caret and the keystrokes; the list is only a picker
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        // clicking the field itself is not "outside" — it is how the list opens
        onPointerDownOutside={(e) => {
          if (e.target instanceof Node && inputRef.current?.contains(e.target)) e.preventDefault()
        }}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty>No matching unit.</CommandEmpty>
            <CommandGroup>
              {matches.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.unitId}
                  onSelect={() => commit(u.unitId)}
                >
                  <span className="font-mono text-[12.5px]">{u.unitId}</span>
                  {u.customerName && (
                    <span className="ml-auto truncate text-[11.5px] text-muted-foreground">{u.customerName}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
