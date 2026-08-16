import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Inbox } from 'lucide-react'
import { api } from '@/lib/api'
import { LIVE } from '@/lib/queries'
import { fmtDate } from '@/lib/format'
import { SectionHeader } from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Complaint } from '@/types'

// Complaints the customers raised — the gate works from this list when a
// machine physically turns up.
export default function ComplaintsPanel({ onReceive }: { onReceive: (unitId: string) => void }) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['complaints', 'open'],
    queryFn: () => api<Complaint[]>('/complaints?status=open'),
    ...LIVE,
  })

  const receive = useMutation({
    mutationFn: (c: Complaint) => api(`/complaints/${c.id}/received`, { body: {} }),
    onSuccess: (_d, c) => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
      toast.success(`${c.unitId} received at the gate`)
      onReceive(c.unitId)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const rows = data ?? []

  return (
    <div className="mb-8">
      <SectionHeader
        title="Customer complaints"
        description="Raised by customers against a serial — receive one when the machine arrives"
      />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card">
          <EmptyState icon={Inbox} message="No open complaints" description="Customers' reports land here." />
        </div>
      ) : (
        <div className="scrollbar-thin overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Serial number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-[12.5px]">{c.unitId}</TableCell>
                  <TableCell>{c.customerName || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.problem}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(c.raisedAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Badge variant="warning">Open</Badge>
                      <Button size="sm" onClick={() => receive.mutate(c)}>
                        Receive at gate
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
