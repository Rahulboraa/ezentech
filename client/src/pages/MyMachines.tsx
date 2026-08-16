import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PackageCheck, ShieldAlert } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { LIVE, useUnits, type Paged } from '@/lib/queries'
import { useAuth } from '@/lib/auth'
import { fmtDate } from '@/lib/format'
import { machineStatus } from '@/lib/machineStatus'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import ComplaintSheet from '@/components/ComplaintSheet'
import EmptyState from '@/components/EmptyState'
import RowActions from '@/components/RowActions'
import StatCard from '@/components/StatCard'
import UnitDetailSheet from '@/components/UnitDetailSheet'
import UnitIdCell from '@/components/UnitIdCell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { UNIT_TYPES, type Complaint, type Unit } from '@/types'

export default function MyMachines() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [detail, setDetail] = useState<string | null>(null)
  const [complaintFor, setComplaintFor] = useState<Unit | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (q) params.set('q', q)
  const { data, isLoading } = useUnits(params)

  const { data: complaints } = useQuery({
    queryKey: ['complaints', 'mine'],
    queryFn: () => api<Complaint[]>('/complaints'),
    ...LIVE,
  })
  const { data: all } = useQuery({
    queryKey: ['units', 'mine-all'],
    queryFn: () => api<Paged<Unit>>('/units?limit=200'),
    ...LIVE,
  })

  const rows = all?.rows ?? []
  const openComplaints = (complaints ?? []).filter((c) => c.status !== 'closed')
  const inRework = rows.filter((u) => machineStatus(u).key === 'rework').length

  function raise(unit: Unit | null) {
    setComplaintFor(unit)
    setSheetOpen(true)
  }

  // a machine already on its way back to the factory cannot be reported again
  function canReport(u: Unit) {
    const s = machineStatus(u).key
    return !u.aged && s !== 'rework' && !openComplaints.some((c) => c.unitId === u.unitId)
  }

  function reportHint(u: Unit) {
    if (u.aged) return 'Past the 1-year warranty window'
    if (machineStatus(u).key === 'rework') return 'Already with the factory for rework'
    if (openComplaints.some((c) => c.unitId === u.unitId)) return 'A complaint is already open'
    return undefined
  }

  function statusCell(u: Unit) {
    const s = machineStatus(u)
    return <Badge variant={s.tone}>{s.label}</Badge>
  }

  const columns: ColumnDef<Unit>[] = [
    { id: 'unitId', header: 'Serial number', cell: ({ row }) => <UnitIdCell unit={row.original} /> },
    {
      id: 'model',
      header: 'Model',
      cell: ({ row }) => row.original.modelName || UNIT_TYPES[row.original.type].label,
    },
    { id: 'status', header: 'Status', cell: ({ row }) => statusCell(row.original) },
    {
      id: 'dispatched',
      header: 'Dispatched',
      meta: { cellClass: 'whitespace-nowrap text-muted-foreground' },
      cell: ({ row }) =>
        row.original.dispatch
          ? `${fmtDate(row.original.dispatch.dispatchedAt)}${row.original.dispatch.invoiceNumber ? ` · ${row.original.dispatch.invoiceNumber}` : ''}`
          : '—',
    },
    {
      id: 'actions',
      header: '',
      meta: { headClass: 'w-px', cellClass: 'text-right' },
      cell: ({ row }) => (
        <RowActions
          leading={
            <Button
              variant="ghost"
              size="sm"
              disabled={!canReport(row.original)}
              title={reportHint(row.original)}
              onClick={() => raise(row.original)}
            >
              <ShieldAlert /> Report problem
            </Button>
          }
          onOpen={() => setDetail(row.original.unitId)}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="My machines"
        description={`Every unit supplied to ${user?.name ?? 'your account'} — status, dispatch and complaints`}
        actions={<Button onClick={() => raise(null)}>Report a problem</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={PackageCheck} label="Machines" value={all?.total ?? '—'} hint="Supplied to you" />
        <StatCard label="Dispatched" value={rows.filter((u) => u.dispatch).length} hint="Left the plant" />
        <StatCard tint="warning" label="In rework" value={inRework} hint="Back with the factory" />
        <StatCard tint="info" label="Open complaints" value={openComplaints.length} hint="Awaiting the gate" />
      </div>

      <div className="mb-5">
        <Input
          placeholder="Search a serial number…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          className="h-9 w-full sm:w-80"
        />
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
          setPage(1)
        }}
        isLoading={isLoading}
        empty={
          <div className="rounded-xl border border-border/60 bg-card">
            <EmptyState
              icon={PackageCheck}
              message="No machines yet"
              description="Units show up here once the factory logs them against your account."
            />
          </div>
        }
        renderCard={(u) => (
          <Card className="gap-2 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2 px-4">
              <div>
                <UnitIdCell unit={u} />
                <div className="mt-0.5 text-[12px] text-muted-foreground">{u.modelName || UNIT_TYPES[u.type].label}</div>
              </div>
              {statusCell(u)}
            </div>
            <div className="px-4">
              <RowActions
                leading={
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canReport(u)}
                    title={reportHint(u)}
                    onClick={() => raise(u)}
                  >
                    <ShieldAlert /> Report problem
                  </Button>
                }
                onOpen={() => setDetail(u.unitId)}
              />
            </div>
          </Card>
        )}
      />

      <ComplaintSheet open={sheetOpen} unit={complaintFor} onClose={() => setSheetOpen(false)} />
      <UnitDetailSheet unitId={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
