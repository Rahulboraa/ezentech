import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export interface Paged<T> {
  rows: T[]
  total: number
  page: number
  limit: number
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[] | undefined
  total: number
  page: number
  limit: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  isLoading?: boolean
  rowClassName?: (row: T) => string | undefined
  renderCard: (row: T) => ReactNode
  empty: ReactNode
}

export function DataTable<T>({
  columns, data, total, page, limit, onPageChange, onLimitChange,
  isLoading, rowClassName, renderCard, empty,
}: DataTableProps<T>) {
  const snoColumn: ColumnDef<T> = {
    id: 'sno',
    header: 'S.No',
    meta: { headClass: 'w-14', cellClass: 'text-muted-foreground tabular-nums' },
    cell: ({ row }) => (page - 1) * limit + row.index + 1,
  }

  const table = useReactTable({
    data: data ?? [],
    columns: [snoColumn, ...columns],
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  })

  const pageCount = Math.max(Math.ceil(total / limit), 1)
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
  }

  if (!data?.length) return <>{empty}</>

  return (
    <div className="space-y-3">
      <div className="scrollbar-thin hidden overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className={cn((h.column.columnDef.meta as { headClass?: string } | undefined)?.headClass)}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={rowClassName?.(row.original)}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={cn((cell.column.columnDef.meta as { cellClass?: string } | undefined)?.cellClass)}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 md:hidden">
        {data.map((row, i) => <div key={i}>{renderCard(row)}</div>)}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-muted-foreground">
          Showing <span className="font-medium text-foreground">{from}–{to}</span> of{' '}
          <span className="font-medium text-foreground">{total}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-[13px] text-muted-foreground">Rows per page</span>
            <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
              <SelectTrigger className="h-8 w-[70px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="text-[13px] font-medium">Page {page} of {pageCount}</div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(1)}>
              <ChevronsLeft className="size-5" />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="size-5" />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
              <ChevronRight className="size-5" />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={page >= pageCount} onClick={() => onPageChange(pageCount)}>
              <ChevronsRight className="size-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
