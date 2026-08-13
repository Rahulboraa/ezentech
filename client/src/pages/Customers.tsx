import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Download, Users2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api, apiDownload } from '@/lib/api'
import { LIVE, useRefreshAll, type Paged } from '@/lib/queries'
import { todayYmd } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import RowActions from '@/components/RowActions'
import CustomerSheet from '@/components/CustomerSheet'
import EmptyState from '@/components/EmptyState'
import ExportButton from '@/components/ExportButton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Customer } from '@/types'

type CustomerRow = Customer & { unitCount: number }
type CustomersResponse = Paged<CustomerRow> & { cities: string[] }

const UNIT_FILTERS = [
  { value: 'all', label: 'All customers' },
  { value: 'with', label: 'With units' },
  { value: 'without', label: 'No units yet' },
]

const SORTS = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'units', label: 'Most units' },
  { value: 'recent', label: 'Recently added' },
]

export default function Customers() {
  const [q, setQ] = useState('')
  const [city, setCity] = useState('all')
  const [units, setUnits] = useState('all')
  const [sort, setSort] = useState('name')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const refreshAll = useRefreshAll()

  const resetPage = () => setPage(1)

  const params = new URLSearchParams({ page: String(page), limit: String(limit), sort })
  if (q) params.set('q', q)
  if (city !== 'all') params.set('city', city)
  if (units !== 'all') params.set('units', units)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', params.toString()],
    queryFn: () => api<CustomersResponse>(`/customers?${params}`),
    ...LIVE,
  })

  const filtered = q !== '' || city !== 'all' || units !== 'all'

  const remove = useMutation({
    mutationFn: (id: string) => api(`/customers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      refreshAll()
      toast.success('Customer deleted')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  async function downloadFor(name: string) {
    try {
      await apiDownload(
        `/reports/customers.xlsx?customer=${encodeURIComponent(name)}`,
        `units-${name.replace(/[^a-z0-9]+/gi, '_')}-${todayYmd()}.xlsx`,
      )
      toast.success('Excel downloaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    }
  }

  function actions(c: CustomerRow) {
    return (
      <RowActions
        leading={
          <Button
            variant="ghost"
            size="sm"
            disabled={c.unitCount === 0}
            title={c.unitCount === 0 ? 'No units logged for this customer yet' : undefined}
            onClick={() => downloadFor(c.name)}
          >
            <Download /> Report
          </Button>
        }
        onEdit={() => {
          setEditing(c)
          setSheetOpen(true)
        }}
        onDelete={() => remove.mutate(c.id)}
        deleteTitle={`Delete ${c.name}?`}
        deleteDescription="Units already logged keep the customer name, but lose the link."
      />
    )
  }

  const columns: ColumnDef<CustomerRow>[] = [
    { id: 'name', header: 'Customer', meta: { cellClass: 'font-medium' }, cell: ({ row }) => row.original.name },
    { id: 'phone', header: 'Phone', cell: ({ row }) => row.original.phone || '—' },
    { id: 'city', header: 'City', cell: ({ row }) => row.original.city || '—' },
    {
      id: 'address',
      header: 'Address / notes',
      meta: { cellClass: 'text-muted-foreground' },
      cell: ({ row }) => row.original.address || '—',
    },
    {
      id: 'units',
      header: 'Units',
      meta: { headClass: 'text-right', cellClass: 'text-right tabular-nums' },
      cell: ({ row }) => row.original.unitCount,
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
        title="Customers"
        description="Units are logged and reported against these accounts"
        actions={
          <>
            <ExportButton path="/reports/customers.xlsx?customer=__ALL__" name="units-by-customer" />
            <Button
              onClick={() => {
                setEditing(null)
                setSheetOpen(true)
              }}
            >
              New customer
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <Input
          placeholder="Search name, phone, city or notes…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            resetPage()
          }}
          className="h-9 w-full sm:w-72"
        />
        <Select
          value={city}
          onValueChange={(v) => {
            setCity(v)
            resetPage()
          }}
        >
          <SelectTrigger className="h-9 w-[calc(50%-6px)] sm:w-44">
            <SelectValue placeholder="All cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cities</SelectItem>
            {(data?.cities ?? []).map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={units}
          onValueChange={(v) => {
            setUnits(v)
            resetPage()
          }}
        >
          <SelectTrigger className="h-9 w-[calc(50%-6px)] sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNIT_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(v) => {
            setSort(v)
            resetPage()
          }}
        >
          <SelectTrigger className="h-9 w-[calc(50%-6px)] sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
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
              setCity('all')
              setUnits('all')
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
              icon={Users2}
              message={filtered ? 'No matching customers' : 'No customers yet'}
              description={
                filtered ? 'Try a different city or clear the filters.' : 'Add the accounts you assemble units for.'
              }
            />
          </div>
        }
        renderCard={(c) => (
          <Card className="gap-2 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2 px-4">
              <div>
                <div className="text-[13.5px] font-medium">{c.name}</div>
                <div className="text-[12px] text-muted-foreground">
                  {[c.phone, c.city].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <div className="text-[12px] tabular-nums text-muted-foreground">{c.unitCount} units</div>
            </div>
            <div className="px-4">{actions(c)}</div>
          </Card>
        )}
      />

      <CustomerSheet open={sheetOpen} customer={editing} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
