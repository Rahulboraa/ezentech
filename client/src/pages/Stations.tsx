import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { KeyRound, Users2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { LIVE } from '@/lib/queries'
import { useAuth } from '@/lib/auth'
import { fmtDate, ROLE_LABEL } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import EmptyState from '@/components/EmptyState'
import RowActions from '@/components/RowActions'
import StationSheet from '@/components/StationSheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ROLES, type Role } from '@/types'

export interface Station {
  id: string
  name: string
  role: Role
  active: boolean
  updatedAt: string
}

export default function Stations() {
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Station | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['stations'],
    queryFn: () => api<Station[]>('/users'),
    ...LIVE,
  })

  const all = data ?? []
  const rows = all.slice((page - 1) * limit, page * limit)

  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed')

  const toggleActive = useMutation({
    mutationFn: (s: Station) => api(`/users/${s.id}`, { method: 'PATCH', body: { active: !s.active } }),
    onSuccess: (_d, s) => {
      refetch()
      toast.success(`${s.name} ${s.active ? 'deactivated' : 'activated'}`)
    },
    onError,
  })

  const remove = useMutation({
    mutationFn: (id: string) => api(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      refetch()
      toast.success('Station removed')
    },
    onError,
  })

  function actions(s: Station) {
    return (
      <RowActions
        leading={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(s)
                setSheetOpen(true)
              }}
            >
              <KeyRound /> Reset PIN
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toggleActive.mutate(s)}>
              {s.active ? 'Deactivate' : 'Activate'}
            </Button>
          </>
        }
        onDelete={s.id === user?.id ? undefined : () => remove.mutate(s.id)}
        deleteTitle={`Remove ${s.name}?`}
        deleteDescription="The station can no longer sign in. Units it logged keep its name."
      />
    )
  }

  const columns: ColumnDef<Station>[] = [
    { id: 'name', header: 'Station', meta: { cellClass: 'font-medium' }, cell: ({ row }) => row.original.name },
    { id: 'role', header: 'Role', cell: ({ row }) => ROLE_LABEL[row.original.role] ?? row.original.role },
    {
      id: 'active',
      header: 'Status',
      cell: ({ row }) =>
        row.original.active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Disabled</Badge>,
    },
    {
      id: 'updated',
      header: 'Last change',
      meta: { cellClass: 'whitespace-nowrap text-muted-foreground' },
      cell: ({ row }) => fmtDate(row.original.updatedAt),
    },
    {
      id: 'actions',
      header: '',
      meta: { headClass: 'w-px', cellClass: 'text-right' },
      cell: ({ row }) => actions(row.original),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Stations"
        description="Who can sign in, what they can do, and their PINs"
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setSheetOpen(true)
            }}
          >
            New station
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={rows}
        total={all.length}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={(l) => {
          setLimit(l)
          setPage(1)
        }}
        isLoading={isLoading}
        rowClassName={(s) => (s.active ? undefined : 'opacity-60')}
        empty={
          <div className="rounded-xl border border-border/60 bg-card">
            <EmptyState icon={Users2} message="No stations yet" description="Add the logins your shop floor needs." />
          </div>
        }
        renderCard={(s) => (
          <Card className="gap-2 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2 px-4">
              <div>
                <div className="text-[13.5px] font-medium">{s.name}</div>
                <div className="text-[12px] text-muted-foreground">{ROLE_LABEL[s.role] ?? s.role}</div>
              </div>
              {s.active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Disabled</Badge>}
            </div>
            <div className="px-4">{actions(s)}</div>
          </Card>
        )}
      />

      <StationSheet
        open={sheetOpen}
        station={editing}
        roles={ROLES}
        onClose={() => setSheetOpen(false)}
        onSaved={() => refetch()}
      />
    </div>
  )
}
