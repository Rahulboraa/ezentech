import { useState } from 'react'
import { Truck } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { useUnits, useUnitStats } from '@/lib/queries'
import { fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import DispatchSheet from '@/components/DispatchSheet'
import EmptyState from '@/components/EmptyState'
import RowActions from '@/components/RowActions'
import StatCard from '@/components/StatCard'
import UnitDetailSheet from '@/components/UnitDetailSheet'
import UnitIdCell from '@/components/UnitIdCell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Unit } from '@/types'

const TABS = [
  { value: 'dispatchable', label: 'Ready to dispatch' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'all', label: 'All units' },
]

export default function Dispatch() {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('dispatchable')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [preset, setPreset] = useState<string | undefined>()
  const [detail, setDetail] = useState<string | null>(null)

  const params = new URLSearchParams({ page: String(page), limit: String(limit), tab })
  if (q) params.set('q', q)
  const { data, isLoading } = useUnits(params)
  const { data: stats } = useUnitStats()

  const resetPage = () => setPage(1)

  function openFor(unitId?: string) {
    setPreset(unitId)
    setSheetOpen(true)
  }

  function dispatchedCell(u: Unit) {
    if (!u.dispatch) return <span className="text-muted-foreground">Not dispatched</span>
    return (
      <div className="space-y-1">
        {u.dispatch.afterRework && <Badge variant="success">After rework</Badge>}
        <div className="whitespace-nowrap text-muted-foreground">{fmtDate(u.dispatch.dispatchedAt)}</div>
      </div>
    )
  }

  const columns: ColumnDef<Unit>[] = [
    { id: 'unitId', header: 'Unit ID', cell: ({ row }) => <UnitIdCell unit={row.original} /> },
    { id: 'customer', header: 'Customer', cell: ({ row }) => row.original.customerName || '—' },
    { id: 'driver', header: 'Driver', cell: ({ row }) => row.original.dispatch?.driverName ?? '—' },
    {
      id: 'vehicle',
      header: 'Vehicle no.',
      meta: { cellClass: 'font-mono text-[12px]' },
      cell: ({ row }) => row.original.dispatch?.vehicleNumber ?? '—',
    },
    { id: 'location', header: 'Location', cell: ({ row }) => row.original.dispatch?.location ?? '—' },
    { id: 'dispatched', header: 'Dispatched', cell: ({ row }) => dispatchedCell(row.original) },
    {
      id: 'actions',
      header: '',
      meta: { headClass: 'w-px', cellClass: 'text-right' },
      cell: ({ row }) => (
        <RowActions
          leading={
            row.original.canDispatch ? (
              <Button size="sm" onClick={() => openFor(row.original.unitId)}>
                <Truck /> {row.original.dispatch ? 'Re-dispatch' : 'Dispatch'}
              </Button>
            ) : undefined
          }
          onOpen={() => setDetail(row.original.unitId)}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Dispatch"
        description="Record the driver, vehicle and destination as units leave the plant"
        actions={<Button onClick={() => openFor(undefined)}>Log dispatch</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Truck} tint="success" label="Ready to dispatch" value={stats?.awaitingDispatch ?? '—'} />
        <StatCard label="Dispatched" value={stats?.dispatched ?? '—'} hint="All time" />
        <StatCard label="Rework units" value={stats?.rework ?? '—'} hint="Been through the gate" />
        <StatCard label="Total units" value={stats?.total ?? '—'} />
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <Input
          placeholder="Search unit ID, driver, vehicle or location…"
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
              icon={Truck}
              message="Nothing here"
              description="No units match this filter — try 'All units' or a different search."
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
              {dispatchedCell(u)}
            </div>
            {u.dispatch && (
              <div className="px-4 text-[12px] text-muted-foreground">
                {u.dispatch.driverName} · {u.dispatch.vehicleNumber} · {u.dispatch.location}
              </div>
            )}
            <div className="px-4">
              <RowActions
                leading={
                  u.canDispatch ? (
                    <Button size="sm" onClick={() => openFor(u.unitId)}>
                      <Truck /> {u.dispatch ? 'Re-dispatch' : 'Dispatch'}
                    </Button>
                  ) : undefined
                }
                onOpen={() => setDetail(u.unitId)}
              />
            </div>
          </Card>
        )}
      />

      <DispatchSheet open={sheetOpen} presetUnitId={preset} onClose={() => setSheetOpen(false)} />
      <UnitDetailSheet unitId={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
