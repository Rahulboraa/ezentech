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
import { UNIT_TYPES, type ProductModel } from '@/types'

// Picked once at changeover and then left alone all shift, so the trigger shows
// the code and variant it will stamp — the operator can eyeball that the right
// model is loaded without opening anything.
export default function ModelCombobox({
  id,
  value,
  models,
  onChange,
  className,
}: {
  id?: string
  value: string
  models: ProductModel[]
  onChange: (value: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = models.find((m) => m.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-auto w-full justify-between py-2 font-normal shadow-none',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          {selected ? (
            <span className="min-w-0 text-left">
              <span className="block truncate text-[13.5px] font-medium">{selected.name}</span>
              <span className="block truncate font-mono text-[11.5px] text-muted-foreground">
                {selected.productCode}·{selected.variant} · {UNIT_TYPES[selected.type].prefix}
              </span>
            </span>
          ) : (
            <span className="truncate">Pick the model this line is running…</span>
          )}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search models…" />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup>
              {models.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.name} ${m.productCode} ${m.variant} ${UNIT_TYPES[m.type].prefix}`}
                  className={cn(value === m.id && 'font-medium')}
                  onSelect={() => {
                    onChange(m.id)
                    setOpen(false)
                  }}
                >
                  <span className="truncate">{m.name}</span>
                  <span className="ml-auto shrink-0 font-mono text-[11.5px] text-muted-foreground">
                    {m.productCode}·{m.variant}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
