import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CheckCircle2, PackageCheck } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { useUnits, useRefreshAll } from '@/lib/queries'
import { fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import EmptyState from '@/components/EmptyState'
import RowActions from '@/components/RowActions'
import ExportButton from '@/components/ExportButton'
import GateStatusBadge from '@/components/GateStatusBadge'
import UnitDetailSheet from '@/components/UnitDetailSheet'
import UnitIdCell from '@/components/UnitIdCell'
import UnitSheet from '@/components/UnitSheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UNIT_TYPES, type Unit } from '@/types'

const TABS = [
  { value: 'all', label: 'All units' },
  { value: 'new', label: 'New production' },
  { value: 'rework', label: 'Rework' },
  { value: 'dispatched', label: 'Dispatched' },
]

export default function Units() {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [detail, setDetail] = useState<string | null>(null)
  const [editing, setEditing] = useState<Unit | null>(null)
  const refreshAll = useRefreshAll()

  const params = new URLSearchParams({ page: String(page), limit: String(limit), tab })
  if (q) params.set('q', q)
  const { data, isLoading } = useUnits(params)

  const resetPage = () => setPage(1)

  const deleteUnit = useMutation({
    mutationFn: (unitId: string) => api(`/units/${unitId}`, { method: 'DELETE' }),
    onSuccess: () => {
      refreshAll()
      toast.success('Unit deleted')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const markRework = useMutation({
    mutationFn: (unitId: string) => api(`/units/${unitId}/rework-complete`, { body: {} }),
    onSuccess: (_d, unitId) => {
      refreshAll()
      toast.success(`${unitId} marked reworked — now visible in Dispatch`)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  function statusCell(u: Unit) {
    if (u.gate) return <GateStatusBadge gate={u.gate} />
    if (u.dispatch) return <span className="text-muted-foreground">Dispatched</span>
    return <span className="text-muted-foreground">In plant</span>
  }

  function actions(u: Unit) {
    return (
      <RowActions
        leading={
          u.gate?.status === 'issued' && !u.gate.reworkDone ? (
            <Button size="sm" onClick={() => markRework.mutate(u.unitId)}>
              <CheckCircle2 /> Rework done
            </Button>
          ) : undefined
        }
        onOpen={() => setDetail(u.unitId)}
        onEdit={() => setEditing(u)}
        onDelete={() => deleteUnit.mutate(u.unitId)}
        deleteTitle={`Delete unit ${u.unitId}?`}
        deleteDescription="The unit and its serial history are removed. This cannot be undone."
      />
    )
  }

  const columns: ColumnDef<Unit>[] = [
    { id: 'unitId', header: 'Unit ID', cell: ({ row }) => <UnitIdCell unit={row.original} /> },
    { id: 'customer', header: 'Customer', cell: ({ row }) => row.original.customerName || '—' },
    {
      id: 'type',
      header: 'Type',
      meta: { cellClass: 'font-mono text-[12px]' },
      cell: ({ row }) => UNIT_TYPES[row.original.type].prefix,
    },
    {
      id: 'serials',
      header: 'Part serials',
      meta: { cellClass: 'font-mono text-[12px] text-muted-foreground' },
      cell: ({ row }) => {
        // four serials per unit would push the row actions off screen — one line
        // here, the full set lives in the detail sheet
        const serials = UNIT_TYPES[row.original.type].parts
          .map((k) => row.original[k])
          .filter(Boolean)
          .join(' · ')
        return (
          <span className="block max-w-[130px] truncate" title={serials}>
            {serials}
          </span>
        )
      },
    },
    {
      id: 'operator',
      header: 'Operator',
      meta: { cellClass: 'max-w-[110px] truncate' },
      cell: ({ row }) => row.original.operator || '—',
    },
    {
      id: 'assembled',
      header: 'Assembled',
      meta: { cellClass: 'whitespace-nowrap text-muted-foreground' },
      cell: ({ row }) => fmtDate(row.original.assembledAt),
    },
    {
      id: 'status',
      header: 'Status',
      meta: { cellClass: 'whitespace-nowrap' },
      cell: ({ row }) => statusCell(row.original),
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
        title="Units"
        description="Every assembled unit with its part serials, gate history and dispatch"
        actions={
          <>
            <ExportButton path="/reports/customers.xlsx?customer=__ALL__" name="units-by-customer" />
            <Button asChild>
              <Link to="/station">Log a unit</Link>
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <Input
          placeholder="Search unit ID, serial, customer, driver…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            resetPage()
          }}
          className="h-9 w-full sm:w-80"
        />
        <Select
          value={tab}
          onValueChange={(v) => {
            setTab(v)
            resetPage()
          }}
        >
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.rows}
        total={data?.total ?? 0}
        page={data?.page ?? page}
        limit={data?.limit ?? limit}
        onPageChange={setPage}
        onLimitChange={(l) => {
          setLimit(l)
          resetPage()
        }}
        isLoading={isLoading}
        rowClassName={(u) => cn(u.aged && 'border-l-2 border-l-warning')}
        empty={
          <div className="rounded-xl border border-border/60 bg-card">
            <EmptyState
              icon={PackageCheck}
              message="No units found"
              description="Try a different search or filter, or log a new unit at the station."
            />
          </div>
        }
        renderCard={(u) => (
          <Card className={cn('gap-2 py-3', u.aged && 'border-l-2 border-l-warning')}>
            <div className="flex flex-wrap items-start justify-between gap-2 px-4">
              <div>
                <UnitIdCell unit={u} />
                <div className="mt-0.5 text-[12px] text-muted-foreground">{u.customerName || 'No customer'}</div>
              </div>
              {statusCell(u)}
            </div>
            <div className="px-4 text-[12px] text-muted-foreground">{fmtDate(u.assembledAt)}</div>
            <div className="px-4">{actions(u)}</div>
          </Card>
        )}
      />

      <UnitDetailSheet unitId={detail} onClose={() => setDetail(null)} />
      <UnitSheet unit={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
