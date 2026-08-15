import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PackageCheck, Users2, Wrench } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { useCustomers, useProductModels, useUnitStats, useUnits } from '@/lib/queries'
import { fmtDate } from '@/lib/format'
import { PageHeader, SectionHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import AssemblyTray from '@/components/AssemblyTray'
import EmptyState from '@/components/EmptyState'
import RowActions from '@/components/RowActions'
import StatCard from '@/components/StatCard'
import UnitDetailSheet from '@/components/UnitDetailSheet'
import UnitIdCell from '@/components/UnitIdCell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { UNIT_TYPES, UNIT_TYPE_KEYS, type Unit } from '@/types'

export default function Station() {
  const { data: customers } = useCustomers()
  const { data: models, isSuccess: modelsLoaded } = useProductModels()
  const { data: stats } = useUnitStats()
  const [detail, setDetail] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  const params = new URLSearchParams({ page: String(page), limit: String(limit), tab: 'new' })
  const { data, isLoading } = useUnits(params)

  const columns: ColumnDef<Unit>[] = [
    { id: 'unitId', header: 'Unit ID', cell: ({ row }) => <UnitIdCell unit={row.original} /> },
    { id: 'customer', header: 'Customer', cell: ({ row }) => row.original.customerName || '—' },
    {
      id: 'model',
      header: 'Model',
      cell: ({ row }) => (
        <div>
          <div>{row.original.modelName || '—'}</div>
          <div className="font-mono text-[11.5px] text-muted-foreground">{UNIT_TYPES[row.original.type].prefix}</div>
        </div>
      ),
    },
    { id: 'operator', header: 'Operator', cell: ({ row }) => row.original.operator || '—' },
    {
      id: 'assembled',
      header: 'Assembled',
      meta: { cellClass: 'whitespace-nowrap text-muted-foreground' },
      cell: ({ row }) => fmtDate(row.original.assembledAt),
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
        title="Assembly Station"
        description={`${stats?.today ?? 0} logged today · ${stats?.total ?? 0} units on record`}
        actions={
          <Button variant="outline" asChild>
            <Link to="/customers">
              <Users2 /> Customers
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Wrench} tint="info" label="Logged today" value={stats?.today ?? '—'} hint="All types" />
        {UNIT_TYPE_KEYS.map((t) => (
          <StatCard
            key={t}
            label={UNIT_TYPES[t].label}
            value={stats?.byType?.[t]?.today ?? '—'}
            hint={`${stats?.byType?.[t]?.total ?? 0} total · ${UNIT_TYPES[t].prefix}`}
          />
        ))}
      </div>

      <AssemblyTray customers={customers ?? []} models={models ?? []} modelsLoaded={modelsLoaded} />

      <div className="mt-8">
        <SectionHeader
          title="Recently logged"
          description="New production off this station"
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to="/units">All units</Link>
            </Button>
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
              <EmptyState
                icon={PackageCheck}
                message="Nothing logged yet"
                description="Fill the tray above to log the first unit."
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
                <span className="font-mono text-[12px] text-muted-foreground">{UNIT_TYPES[u.type].prefix}</span>
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
