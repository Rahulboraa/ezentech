import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useRefreshAll } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Customer } from '@/types'

interface FormValues {
  name: string
  phone: string
  city: string
  address: string
}

const blank: FormValues = { name: '', phone: '', city: '', address: '' }

export default function CustomerSheet({
  open,
  customer,
  onClose,
}: {
  open: boolean
  customer?: Customer | null
  onClose: () => void
}) {
  const refreshAll = useRefreshAll()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: blank })

  useEffect(() => {
    if (open) reset(customer ? { ...blank, ...customer } : blank)
  }, [open, customer, reset])

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      customer ? api(`/customers/${customer.id}`, { method: 'PUT', body: v }) : api('/customers', { body: v }),
    onSuccess: () => {
      refreshAll()
      toast.success(customer ? 'Customer updated' : 'Customer added')
      onClose()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Save failed'),
  })

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" size="40%" className="flex w-full flex-col gap-0 p-0">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{customer ? 'Edit customer' : 'New customer'}</SheetTitle>
          <SheetDescription>
            {customer ? `Editing ${customer.name}` : 'Units are logged against this customer'}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="flex min-h-0 flex-1 flex-col">
          <div className="grid flex-1 grid-cols-1 gap-x-4 gap-y-5 overflow-y-auto px-6 py-6 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cs-name">Name *</Label>
              <Input id="cs-name"
                {...register('name', { required: true })}
                aria-invalid={!!errors.name}
                placeholder="Customer or company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs-phone">Phone</Label>
              <Input id="cs-phone" {...register('phone')} inputMode="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs-city">City</Label>
              <Input id="cs-city" {...register('city')} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cs-address">Address / notes</Label>
              <Input id="cs-address" {...register('address')} />
            </div>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {customer ? 'Save changes' : 'Add customer'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
