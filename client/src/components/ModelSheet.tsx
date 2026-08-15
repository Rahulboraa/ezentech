import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { PRODUCT_CODE_LENGTH, UNIT_TYPES, UNIT_TYPE_KEYS, type ProductModel, type UnitType } from '@/types'

const alnum = (raw: string, max: number) =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, max)

// The one place the 7-character product code is ever typed. Everything the line
// issues afterwards is derived from what is saved here, so it is worth the extra
// keystrokes to get right — and it is only entered when a product is introduced.
export default function ModelSheet({
  open,
  model,
  onClose,
  onSaved,
}: {
  open: boolean
  model: ProductModel | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [productCode, setProductCode] = useState('')
  const [variant, setVariant] = useState('')
  const [type, setType] = useState<UnitType>('outdoor')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(model?.name ?? '')
    setProductCode(model?.productCode ?? '')
    setVariant(model?.variant ?? '')
    setType(model?.type ?? 'outdoor')
    setError('')
  }, [open, model])

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), productCode, variant, type }
      return model ? api(`/product-models/${model.id}`, { method: 'PATCH', body }) : api('/product-models', { body })
    },
    onSuccess: () => {
      onSaved()
      toast.success(model ? `${name.trim()} updated` : `${name.trim()} added`)
      onClose()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Save failed'),
  })

  function submit() {
    if (!name.trim()) return setError('Model name is required')
    if (productCode.length !== PRODUCT_CODE_LENGTH) {
      return setError(`Product code must be exactly ${PRODUCT_CODE_LENGTH} characters`)
    }
    if (!variant) return setError('Variant is required')
    setError('')
    save.mutate()
  }

  const preview = productCode.length === PRODUCT_CODE_LENGTH && variant ? `${productCode}${variant}` : null

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" size="40%" className="flex w-full flex-col gap-0 p-0">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{model ? `Edit ${model.name}` : 'New model'}</SheetTitle>
          <SheetDescription>
            What the line runs. The operator picks this at changeover and never types a product code.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className="space-y-2">
            <Label htmlFor="md-name">Model name *</Label>
            <Input
              id="md-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 1.5T 3-Star Split ODU"
            />
            <p className="text-[11.5px] text-muted-foreground">How the shop floor refers to it.</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="md-code">Product code *</Label>
              <Input
                id="md-code"
                value={productCode}
                maxLength={PRODUCT_CODE_LENGTH}
                placeholder="4011571"
                className="font-mono uppercase tracking-[0.08em]"
                onChange={(e) => setProductCode(alnum(e.target.value, PRODUCT_CODE_LENGTH))}
              />
              <p className="text-[11.5px] text-muted-foreground">Chars 1–{PRODUCT_CODE_LENGTH} of the serial</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="md-variant">Variant *</Label>
              <Input
                id="md-variant"
                value={variant}
                maxLength={1}
                placeholder="A"
                className="font-mono uppercase"
                onChange={(e) => setVariant(alnum(e.target.value, 1))}
              />
              <p className="text-[11.5px] text-muted-foreground">Char 8 · part change</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="md-type">Assembly type *</Label>
            <Select value={type} onValueChange={(v) => setType(v as UnitType)}>
              <SelectTrigger id="md-type" className="w-full">
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
            <p className="text-[11.5px] text-muted-foreground">
              Decides which part slots the tray asks for — {UNIT_TYPES[type].parts.length} on this type.
            </p>
          </div>

          {preview && (
            <div className="rounded-lg bg-muted/60 px-3 py-2.5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Serials will start
              </div>
              <div className="mt-1 font-mono text-[15px] font-semibold tracking-[0.04em]">
                {preview}
                <span className="text-muted-foreground/40">•••••••••</span>
              </div>
            </div>
          )}

          {model && (
            <p className="text-[11.5px] text-muted-foreground">
              Units already built keep the code they were stamped with — editing this only affects units logged from now
              on.
            </p>
          )}

          {error && <p className="text-[12.5px] text-destructive">{error}</p>}
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {model ? 'Save model' : 'Add model'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
