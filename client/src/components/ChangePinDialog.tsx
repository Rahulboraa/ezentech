import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ChangePinDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth()
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      setError('')
    }
  }, [open])

  const save = useMutation({
    mutationFn: () => api('/users/me/pin', { body: { currentPin, newPin } }),
    onSuccess: () => {
      toast.success('PIN changed')
      onOpenChange(false)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not change PIN'),
  })

  function submit() {
    if (newPin.length < 4) return setError('New PIN must be at least 4 characters')
    if (newPin !== confirmPin) return setError('The two new PINs do not match')
    setError('')
    save.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change PIN</DialogTitle>
          <DialogDescription>For the {user?.name} station on this device and every other.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cp-current">Current PIN</Label>
            <Input
              id="cp-current"
              type="password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-new">New PIN</Label>
            <Input id="cp-new" type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
            <p className="text-[11.5px] text-muted-foreground">At least 4 characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-confirm">Confirm new PIN</Label>
            <Input
              id="cp-confirm"
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          {error && <p className="text-[12.5px] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!currentPin || !newPin || save.isPending}>
            Change PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
