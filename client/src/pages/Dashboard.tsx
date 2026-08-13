import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert, Layers, PackageCheck, ShieldCheck, Truck, Wrench } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { useUnitStats, useUnits } from '@/lib/queries'
import { useAuth } from '@/lib/auth'
import { fmtDate, ROLE_LABEL } from '@/lib/format'
import { PageHeader, SectionHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import StatCard from '@/components/StatCard'
import EmptyState from '@/components/EmptyState'
import GateStatusBadge from '@/components/GateStatusBadge'
import RowActions from '@/components/RowActions'
import UnitIdCell from '@/components/UnitIdCell'
import UnitDetailSheet from '@/components/UnitDetailSheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { UNIT_TYPES, UNIT_TYPE_KEYS, type Unit } from '@/types'

export default function Dashboard() {
  const { user } = useAuth()
  const { data: stats } = useUnitStats()
  const [detail, setDetail] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  const params = new URLSearchParams({ page: String(page), limit: String(limit), tab: 'all' })
  const { data, isLoading } = useUnits(params)

  const role = user?.role ?? 'production'
  const primary =
    role === 'dispatch'
      ? { to: '/dispatch', label: 'Go to Dispatch' }
      : role === 'gate'
        ? { to: '/gate', label: 'Go to Gate Entry' }
        : role === 'quality'
          ? { to: '/quality', label: 'Go to Quality Release' }
          : { to: '/station', label: 'Open Assembly Station' }

  function statusCell(u: Unit) {
    if (u.gate) return <GateStatusBadge gate={u.gate} />
    if (u.dispatch) return <span className="text-muted-foreground">Dispatched</span>
    return <span className="text-muted-foreground">In plant</span>
  }

  const columns: ColumnDef<Unit>[] = [
    { id: 'unitId', header: 'Unit ID', cell: ({ row }) => <UnitIdCell unit={row.original} /> },
    { id: 'customer', header: 'Customer', cell: ({ row }) => row.original.customerName || '—' },
    { id: 'operator', header: 'Operator', cell: ({ row }) => row.original.operator || '—' },
    {
      id: 'assembled',
      header: 'Assembled',
      meta: { cellClass: 'whitespace-nowrap text-muted-foreground' },
      cell: ({ row }) => fmtDate(row.original.assembledAt),
    },
    { id: 'status', header: 'Status', cell: ({ row }) => statusCell(row.original) },
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
        title="Dashboard"
        description={`${ROLE_LABEL[role]} station · live view of the line`}
        actions={
          <Button asChild>
            <Link to={primary.to}>{primary.label}</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Wrench} tint="info" label="Logged today" value={stats?.today ?? '—'} hint="All assembly types" />
        {UNIT_TYPE_KEYS.map((t) => (
          <StatCard
            key={t}
            label={UNIT_TYPES[t].label}
            value={stats?.byType?.[t]?.today ?? '—'}
            hint={`${stats?.byType?.[t]?.total ?? 0} total · ${UNIT_TYPES[t].prefix}`}
          />
        ))}
        <StatCard icon={PackageCheck} label="Total units" value={stats?.total ?? '—'} hint="On record" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={ShieldCheck}
          tint="warning"
          label="Awaiting Quality"
          value={stats?.awaitingQuality ?? '—'}
          hint="Gate requests open"
        />
        <StatCard
          icon={Truck}
          tint="success"
          label="Ready to dispatch"
          value={stats?.awaitingDispatch ?? '—'}
          hint="Cleared to leave"
        />
        <StatCard icon={Layers} tint="purple" label="Dispatched" value={stats?.dispatched ?? '—'} hint="All time" />
        <StatCard
          icon={CircleAlert}
          tint="destructive"
          label="Aged units"
          value={stats?.aged ?? '—'}
          hint="Over 365 days"
        />
      </div>

      <div className="mt-8">
        <SectionHeader
          title="Latest units"
          description="Newest assemblies across the line"
          actions={
            role === 'production' || role === 'admin' ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/units">View all</Link>
              </Button>
            ) : undefined
          }
        />
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
              <EmptyState icon={PackageCheck} message="No units yet" description="Log the first unit at the station." />
            </div>
          }
          renderCard={(u) => (
            <Card className="gap-2 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2 px-4">
                <div>
                  <UnitIdCell unit={u} />
                  <div className="mt-0.5 text-[12px] text-muted-foreground">{u.customerName || 'No customer'}</div>
                </div>
                {statusCell(u)}
              </div>
              <div className="px-4 text-[12px] text-muted-foreground">{fmtDate(u.assembledAt)}</div>
              <div className="px-4">
                <RowActions onOpen={() => setDetail(u.unitId)} />
              </div>
            </Card>
          )}
        />
      </div>

      <UnitDetailSheet unitId={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
