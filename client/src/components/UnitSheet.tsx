import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useCustomers, useRefreshAll } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CustomerCombobox from '@/components/CustomerCombobox'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Unit } from '@/types'

interface FormValues {
  customerId: string
  operator: string
}

export default function UnitSheet({ unit, onClose }: { unit: Unit | null; onClose: () => void }) {
  const { data: customers } = useCustomers()
  const refreshAll = useRefreshAll()
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
    defaultValues: { customerId: 'none', operator: '' },
  })

  useEffect(() => {
    if (unit) reset({ customerId: unit.customerId || 'none', operator: unit.operator })
  }, [unit, reset])

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      api(`/units/${unit!.unitId}`, {
        method: 'PATCH',
        body: { customerId: v.customerId === 'none' ? null : v.customerId, operator: v.operator },
      }),
    onSuccess: () => {
      refreshAll()
      toast.success(`Unit ${unit!.unitId} updated`)
      onClose()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Save failed'),
  })

  return (
    <Sheet open={!!unit} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" size="40%" className="flex w-full flex-col gap-0 p-0">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Reassign unit</SheetTitle>
          <SheetDescription className="font-mono">{unit?.unitId}</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <div className="space-y-2">
              <Label htmlFor="us-customer">Customer</Label>
              <CustomerCombobox
                id="us-customer"
                value={watch('customerId')}
                customers={customers ?? []}
                onChange={(v) => setValue('customerId', v)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="us-operator">Operator</Label>
              <Input id="us-operator" {...register('operator')} placeholder="Name or badge #" />
            </div>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Save changes
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
