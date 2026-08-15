import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Boxes } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { useProductModels } from '@/lib/queries'
import { fmtDate } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import EmptyState from '@/components/EmptyState'
import ModelSheet from '@/components/ModelSheet'
import RowActions from '@/components/RowActions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { UNIT_TYPES, type ProductModel } from '@/types'

export default function Models() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ProductModel | null>(null)

  const { data, isLoading, refetch } = useProductModels(true)

  const all = data ?? []
  const rows = all.slice((page - 1) * limit, page * limit)

  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed')

  const toggleActive = useMutation({
    mutationFn: (m: ProductModel) => api(`/product-models/${m.id}`, { method: 'PATCH', body: { active: !m.active } }),
    onSuccess: (_d, m) => {
      refetch()
      toast.success(`${m.name} ${m.active ? 'retired' : 'brought back'}`)
    },
    onError,
  })

  const remove = useMutation({
    mutationFn: (id: string) => api(`/product-models/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      refetch()
      toast.success('Model removed')
    },
    onError,
  })

  function open(m: ProductModel | null) {
    setEditing(m)
    setSheetOpen(true)
  }

  function actions(m: ProductModel) {
    return (
      <RowActions
        leading={
          <>
            <Button variant="ghost" size="sm" onClick={() => open(m)}>
              <Pencil /> Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toggleActive.mutate(m)}>
              {m.active ? 'Retire' : 'Bring back'}
            </Button>
          </>
        }
        onDelete={() => remove.mutate(m.id)}
        deleteTitle={`Remove ${m.name}?`}
        deleteDescription="Only possible while no unit has been built from it — retire it instead once it has run."
      />
    )
  }

  const columns: ColumnDef<ProductModel>[] = [
    { id: 'name', header: 'Model', meta: { cellClass: 'font-medium' }, cell: ({ row }) => row.original.name },
    {
      id: 'code',
      header: 'Product code',
      meta: { cellClass: 'font-mono text-[12.5px]' },
      cell: ({ row }) => (
        <>
          {row.original.productCode}
          <span className="text-muted-foreground">·{row.original.variant}</span>
        </>
      ),
    },
    {
      id: 'type',
      header: 'Assembly',
      cell: ({ row }) => (
        <>
          <span className="font-mono text-[12px]">{UNIT_TYPES[row.original.type].prefix}</span>
          <span className="text-muted-foreground"> · {UNIT_TYPES[row.original.type].parts.length} parts</span>
        </>
      ),
    },
    {
      id: 'active',
      header: 'Status',
      cell: ({ row }) =>
        row.original.active ? <Badge variant="success">Running</Badge> : <Badge variant="muted">Retired</Badge>,
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
        title="Models"
        description="The products the line can run — the operator picks one and never types a product code"
        actions={<Button onClick={() => open(null)}>New model</Button>}
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
        rowClassName={(m) => (m.active ? undefined : 'opacity-60')}
        empty={
          <div className="rounded-xl border border-border/60 bg-card">
            <EmptyState
              icon={Boxes}
              message="No models yet"
              description="Add one per product the line builds, with its VOLTAS product code and variant."
            />
          </div>
        }
        renderCard={(m) => (
          <Card className="gap-2 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2 px-4">
              <div>
                <div className="text-[13.5px] font-medium">{m.name}</div>
                <div className="font-mono text-[12px] text-muted-foreground">
                  {m.productCode}·{m.variant} · {UNIT_TYPES[m.type].prefix}
                </div>
              </div>
              {m.active ? <Badge variant="success">Running</Badge> : <Badge variant="muted">Retired</Badge>}
            </div>
            <div className="px-4">{actions(m)}</div>
          </Card>
        )}
      />

      <ModelSheet open={sheetOpen} model={editing} onClose={() => setSheetOpen(false)} onSaved={() => refetch()} />
    </div>
  )
}
