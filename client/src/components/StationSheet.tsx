import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { ROLE_LABEL } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Role } from '@/types'
import type { Station } from '@/pages/Stations'

// Editing an existing station is only ever a PIN reset — renaming one would
// orphan the name already stamped on its units.
export default function StationSheet({
  open,
  station,
  roles,
  onClose,
  onSaved,
}: {
  open: boolean
  station: Station | null
  roles: readonly Role[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('production')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(station?.name ?? '')
      setRole(station?.role ?? 'production')
      setPin('')
      setError('')
    }
  }, [open, station])

  const save = useMutation({
    mutationFn: () =>
      station
        ? api(`/users/${station.id}/pin`, { method: 'PATCH', body: { pin } })
        : api('/users', { body: { name, role, pin } }),
    onSuccess: () => {
      onSaved()
      toast.success(station ? `PIN reset for ${station.name}` : `${name} added`)
      onClose()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Save failed'),
  })

  function submit() {
    if (!station && !name.trim()) return setError('Station name is required')
    if (pin.trim().length < 4) return setError('PIN must be at least 4 characters')
    setError('')
    save.mutate()
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" size="40%" className="flex w-full flex-col gap-0 p-0">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{station ? `Reset PIN — ${station.name}` : 'New station'}</SheetTitle>
          <SheetDescription>
            {station ? 'The station signs in with the new PIN immediately.' : 'A login for one place on the line.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {!station && (
            <>
              <div className="space-y-2">
                <Label htmlFor="st-name">Station name *</Label>
                <Input
                  id="st-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production 2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger id="st-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r] ?? r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11.5px] text-muted-foreground">
                  Admin manages stations; the rest only see their own screen.
                </p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="st-pin">{station ? 'New PIN *' : 'PIN *'}</Label>
            <Input id="st-pin" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <p className="text-[11.5px] text-muted-foreground">At least 4 characters.</p>
          </div>

          {error && <p className="text-[12.5px] text-destructive">{error}</p>}
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {station ? 'Reset PIN' : 'Add station'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
