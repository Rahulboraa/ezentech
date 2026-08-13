import { useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { Customer } from '@/types'

// The customer list grows with every account, so a plain select becomes an
// unscannable wall — this stays type-to-filter.
export default function CustomerCombobox({
  id,
  value,
  customers,
  onChange,
  className,
}: {
  id?: string
  value: string
  customers: Customer[]
  onChange: (value: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = customers.find((c) => c.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal shadow-none', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate">{selected ? selected.name : '— None —'}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search customers…" />
          <CommandList>
            <CommandEmpty>No customer found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="— None —"
                className={cn(value === 'none' && 'font-medium')}
                onSelect={() => {
                  onChange('none')
                  setOpen(false)
                }}
              >
                — None —
              </CommandItem>
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.city} ${c.phone}`}
                  className={cn(value === c.id && 'font-medium')}
                  onSelect={() => {
                    onChange(c.id)
                    setOpen(false)
                  }}
                >
                  <span className="truncate">{c.name}</span>
                  {c.city && <span className="ml-auto text-[11.5px] text-muted-foreground">{c.city}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
