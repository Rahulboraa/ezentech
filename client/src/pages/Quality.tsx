import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowRightLeft, Check, ShieldCheck, X } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { useRefreshAll, useUnitStats, useUnits } from '@/lib/queries'
import { fmtDate } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import EmptyState from '@/components/EmptyState'
import RowActions from '@/components/RowActions'
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
  { value: 'open-quality', label: 'Needs action' },
  { value: 'pending-quality', label: 'Awaiting decision' },
  { value: 'rework', label: 'All rework' },
  { value: 'new', label: 'New production' },
]

export default function Quality() {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('open-quality')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [detail, setDetail] = useState<string | null>(null)
  const refreshAll = useRefreshAll()

  const params = new URLSearchParams({ page: String(page), limit: String(limit), tab })
  if (q) params.set('q', q)
  const { data, isLoading } = useUnits(params)
  const { data: stats } = useUnitStats()

  const resetPage = () => setPage(1)

  const decide = useMutation({
    mutationFn: ({ unitId, decision }: { unitId: string; decision: 'approved' | 'rejected' }) =>
      api(`/units/${unitId}/quality-decision`, { body: { decision } }),
    onSuccess: (_d, { unitId, decision }) => {
      refreshAll()
      toast.success(
        decision === 'approved' ? `${unitId} approved — ready to issue to Production` : `${unitId} rejected`,
      )
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const issue = useMutation({
    mutationFn: (unitId: string) => api(`/units/${unitId}/issue`, { body: {} }),
    onSuccess: (_d, unitId) => {
      refreshAll()
      toast.success(`${unitId} issued to Production`)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  function actions(u: Unit) {
    return (
      <RowActions
        leading={
          <>
            {u.gate?.status === 'pending' && (
              <>
                <Button size="sm" onClick={() => decide.mutate({ unitId: u.unitId, decision: 'approved' })}>
                  <Check /> Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => decide.mutate({ unitId: u.unitId, decision: 'rejected' })}
                >
                  <X /> Reject
                </Button>
              </>
            )}
            {u.gate?.status === 'approved' && (
              <Button size="sm" onClick={() => issue.mutate(u.unitId)}>
                <ArrowRightLeft /> Issue to Production
              </Button>
            )}
          </>
        }
        onOpen={() => setDetail(u.unitId)}
      />
    )
  }

  function whenText(u: Unit) {
    const gate = u.gate
    if (!gate) return fmtDate(u.assembledAt)
    if (gate.status === 'pending') return `${fmtDate(gate.requestedAt)} · ${gate.requestedBy}`
    return gate.decidedAt ? `${fmtDate(gate.decidedAt)} · ${gate.decidedBy}` : '—'
  }

  const columns: ColumnDef<Unit>[] = [
    { id: 'unitId', header: 'Unit ID', cell: ({ row }) => <UnitIdCell unit={row.original} /> },
    { id: 'customer', header: 'Customer', cell: ({ row }) => row.original.customerName || '—' },
    { id: 'reason', header: 'Reason', cell: ({ row }) => row.original.gate?.reason || '—' },
    {
      id: 'when',
      header: 'Requested / decision',
      meta: { cellClass: 'whitespace-nowrap text-muted-foreground' },
      cell: ({ row }) => whenText(row.original),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.gate ? (
          <GateStatusBadge gate={row.original.gate} />
        ) : (
          <span className="text-muted-foreground">New production</span>
        ),
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
        title="Quality Release"
        description="Clear gate returns, then issue them back to Production"
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={ShieldCheck} tint="warning" label="Awaiting decision" value={stats?.awaitingQuality ?? '—'} />
        <StatCard label="Rework units" value={stats?.rework ?? '—'} />
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
        rowClassName={(u) => (u.gate?.status === 'pending' ? 'bg-warning/5' : undefined)}
        empty={
          <div className="rounded-xl border border-border/60 bg-card">
            <EmptyState
              icon={ShieldCheck}
              message="Nothing waiting"
              description="Gate requests land here the moment they are raised."
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
              {u.gate && <GateStatusBadge gate={u.gate} />}
            </div>
            <div className="px-4 text-[12px] text-muted-foreground">{whenText(u)}</div>
            <div className="px-4">{actions(u)}</div>
          </Card>
        )}
      />

      <UnitDetailSheet unitId={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
