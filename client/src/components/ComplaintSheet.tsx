import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { LIVE, type Paged } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import UnitIdCombobox from '@/components/UnitIdCombobox'
import type { Unit } from '@/types'

export default function ComplaintSheet({
  open,
  unit,
  onClose,
}: {
  open: boolean
  unit: Unit | null
  onClose: () => void
}) {
  const [unitId, setUnitId] = useState('')
  const [problem, setProblem] = useState('')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  useEffect(() => {
    if (open) {
      setUnitId(unit?.unitId ?? '')
      setProblem('')
      setError('')
    }
  }, [open, unit])

  // only the customer's own machines are offered
  const { data: mine } = useQuery({
    queryKey: ['units', 'mine-all'],
    queryFn: () => api<Paged<Unit>>('/units?limit=200'),
    enabled: open,
    ...LIVE,
  })

  const save = useMutation({
    mutationFn: () => api('/complaints', { body: { unitId, problem } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
      queryClient.invalidateQueries({ queryKey: ['units'] })
      toast.success('Complaint sent to the factory')
      onClose()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not send the complaint'),
  })

  function submit() {
    if (!unitId.trim()) return setError('Enter the serial number printed on the machine')
    if (problem.trim().length < 3) return setError('Describe the problem')
    setError('')
    save.mutate()
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" size="40%" className="flex w-full flex-col gap-0 p-0">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Report a problem</SheetTitle>
          <SheetDescription>
            The factory gate sees this straight away and takes the machine in for a quality check.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className="space-y-2">
            <Label htmlFor="cm-unit">Serial number *</Label>
            <UnitIdCombobox id="cm-unit" value={unitId} units={mine?.rows ?? []} onChange={setUnitId} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cm-problem">What is the problem? *</Label>
            <Textarea
              id="cm-problem"
              rows={4}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="e.g. not cooling, noisy compressor, gas leak"
            />
          </div>
          {error && <p className="text-[12.5px] text-destructive">{error}</p>}
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            Send complaint
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
