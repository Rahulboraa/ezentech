import { useState } from 'react'
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
  placeholder = 'Scan or pick a Unit ID…',
  ...inputProps
}: {
  id?: string
  value: string
  units: Unit[]
  onChange: (value: string) => void
  placeholder?: string
} & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'id'>) {
  const [open, setOpen] = useState(false)

  const needle = value.trim().toUpperCase()
  const matches = units
    .filter((u) => !needle || u.unitId.includes(needle) || u.customerName.toUpperCase().includes(needle))
    .slice(0, 8)
  const exact = matches.length === 1 && matches[0].unitId === needle

  return (
    <Popover open={open && matches.length > 0 && !exact} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          {...inputProps}
          id={id}
          value={value}
          autoComplete="off"
          placeholder={placeholder}
          className={cn('font-mono uppercase', inputProps.className)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase())
            setOpen(true)
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty>No matching unit.</CommandEmpty>
            <CommandGroup>
              {matches.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.unitId}
                  onSelect={() => {
                    onChange(u.unitId)
                    setOpen(false)
                  }}
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
