import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { LIVE, type Paged } from '@/lib/queries'
import { fmtDateTimeSeconds, ROLE_LABEL } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import EmptyState from '@/components/EmptyState'
import UnitDetailSheet from '@/components/UnitDetailSheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AuditRow } from '@/types'

const TONE: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'muted'> = {
  create: 'success',
  edit: 'info',
  delete: 'destructive',
  remark: 'muted',
  dispatch: 'info',
  'dispatch-after-rework': 'info',
  'gate-request': 'warning',
  'gate-quality-approved': 'success',
  'gate-quality-rejected': 'destructive',
  'gate-issued': 'info',
  'rework-completed': 'success',
  'model-create': 'success',
  'model-edit': 'info',
  'model-delete': 'destructive',
}

const RANGES = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]

const actionLabel = (a: string) => a.replace(/-/g, ' ')

type AuditResponse = Paged<AuditRow> & { actions: string[]; users: string[] }

export default function Activity() {
  const [q, setQ] = useState('')
  const [action, setAction] = useState('all')
  const [user, setUser] = useState('all')
  const [range, setRange] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [detail, setDetail] = useState<string | null>(null)

  const resetPage = () => setPage(1)

  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (q) params.set('search', q)
  if (action !== 'all') params.set('action', action)
  if (user !== 'all') params.set('user', user)
  if (range !== 'all') params.set('range', range)

  const { data, isLoading } = useQuery({
    queryKey: ['audit', params.toString()],
    queryFn: () => api<AuditResponse>(`/audit?${params}`),
    ...LIVE,
  })

  const filtered = q !== '' || action !== 'all' || user !== 'all' || range !== 'all'

  const columns: ColumnDef<AuditRow>[] = [
    {
      id: 'when',
      header: 'When',
      meta: { cellClass: 'whitespace-nowrap text-muted-foreground' },
      cell: ({ row }) => fmtDateTimeSeconds(row.original.at),
    },
    { id: 'user', header: 'Station', cell: ({ row }) => row.original.user },
    {
      id: 'action',
      header: 'Action',
      cell: ({ row }) => (
        <Badge variant={TONE[row.original.action] ?? 'muted'}>{actionLabel(row.original.action)}</Badge>
      ),
    },
    {
      id: 'unit',
      header: 'Unit ID',
      cell: ({ row }) =>
        row.original.unitId ? (
          <Button variant="link" size="xs" className="px-0 font-mono" onClick={() => setDetail(row.original.unitId)}>
            {row.original.unitId}
          </Button>
        ) : (
          '—'
        ),
    },
    {
      id: 'details',
      header: 'Details',
      meta: { cellClass: 'text-muted-foreground' },
      cell: ({ row }) => row.original.details || '—',
    },
  ]

  return (
    <div>
      <PageHeader title="Activity Log" description="Every action taken on the line, newest first" />

      <div className="mb-5 flex flex-wrap gap-3">
        <Input
          placeholder="Search unit ID, details or station…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            resetPage()
          }}
          className="h-9 w-full sm:w-72"
        />
        <Select
          value={action}
          onValueChange={(v) => {
            setAction(v)
            resetPage()
          }}
        >
          <SelectTrigger className="h-9 w-[calc(50%-6px)] sm:w-52">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {(data?.actions ?? []).map((a) => (
              <SelectItem key={a} value={a}>
                {actionLabel(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={user}
          onValueChange={(v) => {
            setUser(v)
            resetPage()
          }}
        >
          <SelectTrigger className="h-9 w-[calc(50%-6px)] sm:w-44">
            <SelectValue placeholder="All stations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stations</SelectItem>
            {(data?.users ?? []).map((u) => (
              <SelectItem key={u} value={u}>
                {ROLE_LABEL[u.toLowerCase()] ?? u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={range}
          onValueChange={(v) => {
            setRange(v)
            resetPage()
          }}
        >
          <SelectTrigger className="h-9 w-[calc(50%-6px)] sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => {
              setQ('')
              setAction('all')
              setUser('all')
              setRange('all')
              resetPage()
            }}
          >
            Clear filters
          </Button>
        )}
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
              icon={ScrollText}
              message={filtered ? 'No matching activity' : 'No activity yet'}
              description={filtered ? 'Try a wider period or clear the filters.' : 'Actions appear here as they happen.'}
            />
          </div>
        }
        renderCard={(r) => (
          <Card className="gap-1.5 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2 px-4">
              <Badge variant={TONE[r.action] ?? 'muted'}>{actionLabel(r.action)}</Badge>
              <span className="text-[11.5px] text-muted-foreground">{fmtDateTimeSeconds(r.at)}</span>
            </div>
            <div className="px-4 text-[13px]">
              {r.unitId && (
                <Button variant="link" size="xs" className="px-0 font-mono" onClick={() => setDetail(r.unitId)}>
                  {r.unitId}
                </Button>
              )}
              <span className="text-muted-foreground"> {r.details}</span>
            </div>
            <div className="px-4 text-[12px] text-muted-foreground">{r.user}</div>
          </Card>
        )}
      />

      <UnitDetailSheet unitId={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
