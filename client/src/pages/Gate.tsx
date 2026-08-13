import { useState } from 'react'
import { DoorOpen } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { useUnits, useUnitStats } from '@/lib/queries'
import { fmtDate } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import EmptyState from '@/components/EmptyState'
import RowActions from '@/components/RowActions'
import GateRequestSheet from '@/components/GateRequestSheet'
import GateStatusBadge from '@/components/GateStatusBadge'
import StatCard from '@/components/StatCard'
import UnitDetailSheet from '@/components/UnitDetailSheet'
import UnitIdCell from '@/components/UnitIdCell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Unit } from '@/types'

const TABS = [
  { value: 'rework', label: 'Gate history' },
  { value: 'pending-quality', label: 'Awaiting Quality' },
  { value: 'all', label: 'All units' },
]

export default function Gate() {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('rework')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)

  const params = new URLSearchParams({ page: String(page), limit: String(limit), tab })
  if (q) params.set('q', q)
  const { data, isLoading } = useUnits(params)
  const { data: stats } = useUnitStats()

  const resetPage = () => setPage(1)

  function decisionText(u: Unit) {
    const gate = u.gate
    if (!gate) return '—'
    if (gate.qualityAt) return `Issued ${fmtDate(gate.qualityAt)} by ${gate.qualityBy}`
    if (gate.decidedAt)
      return `${gate.status === 'rejected' ? 'Rejected' : 'Approved'} ${fmtDate(gate.decidedAt)} by ${gate.decidedBy}`
    return '—'
  }

  const columns: ColumnDef<Unit>[] = [
    { id: 'unitId', header: 'Unit ID', cell: ({ row }) => <UnitIdCell unit={row.original} /> },
    { id: 'customer', header: 'Customer', cell: ({ row }) => row.original.customerName || '—' },
    { id: 'status', header: 'Status', cell: ({ row }) => <GateStatusBadge gate={row.original.gate} /> },
    { id: 'reason', header: 'Reason', cell: ({ row }) => row.original.gate?.reason || '—' },
    {
      id: 'requested',
      header: 'Requested',
      meta: { cellClass: 'whitespace-nowrap text-muted-foreground' },
      cell: ({ row }) => (row.original.gate ? fmtDate(row.original.gate.requestedAt) : '—'),
    },
    {
      id: 'decision',
      header: 'Decision',
      meta: { cellClass: 'text-muted-foreground' },
      cell: ({ row }) => decisionText(row.original),
    },
    {
      id: 'actions',
      header: '',
      meta: { headClass: 'w-px', cellClass: 'text-right' },
      cell: ({ row }) => <RowActions onOpen={() => setDetail(row.original.unitId)} />,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Gate Entry"
        description="Log units arriving back at the gate so Quality can clear them"
        actions={<Button onClick={() => setSheetOpen(true)}>New entry request</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={DoorOpen} tint="warning" label="Awaiting Quality" value={stats?.awaitingQuality ?? '—'} />
        <StatCard label="Rework units" value={stats?.rework ?? '—'} hint="Been through the gate" />
        <StatCard label="Total units" value={stats?.total ?? '—'} />
        <StatCard tint="destructive" label="Aged units" value={stats?.aged ?? '—'} hint="Over 365 days" />
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <Input
          placeholder="Search unit ID or customer…"
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
        empty={
          <div className="rounded-xl border border-border/60 bg-card">
            <EmptyState
              icon={DoorOpen}
              message="No gate entries"
              description="Raise a request when a rejected or returned unit reaches the gate."
            />
          </div>
        }
        renderCard={(u) => (
          <Card className="gap-2 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2 px-4">
              <div>
                <UnitIdCell unit={u} />
                <div className="mt-0.5 text-[12px] text-muted-foreground">{u.customerName || 'No customer'}</div>
              </div>
              <GateStatusBadge gate={u.gate} />
            </div>
            <div className="px-4 text-[12px] text-muted-foreground">{decisionText(u)}</div>
            <div className="px-4">
              <RowActions onOpen={() => setDetail(u.unitId)} />
            </div>
          </Card>
        )}
      />

      <GateRequestSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <UnitDetailSheet unitId={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
