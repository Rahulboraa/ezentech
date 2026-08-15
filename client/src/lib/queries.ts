import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { Customer, ProductModel, Unit } from '@/types'

// Gate, Quality, Production and Dispatch each sit at their own screen. The
// offline build kept them in sync with the localStorage 'storage' event; here a
// short poll plays that role, so a unit logged at the Gate shows up everywhere
// without anyone pressing refresh.
export const LIVE = { refetchInterval: 5_000, refetchOnWindowFocus: true } as const

export interface Paged<T> {
  rows: T[]
  total: number
  page: number
  limit: number
}

export interface UnitTypeStat {
  total: number
  today: number
}

export interface UnitStats {
  today: number
  total: number
  parts: number
  rework: number
  awaitingQuality: number
  awaitingDispatch: number
  dispatched: number
  aged: number
  byType: Record<string, UnitTypeStat>
}

export function useUnitStats() {
  return useQuery({ queryKey: ['unit-stats'], queryFn: () => api<UnitStats>('/units/stats'), ...LIVE })
}

export function useUnits(params: URLSearchParams) {
  const qs = params.toString()
  return useQuery({ queryKey: ['units', qs], queryFn: () => api<Paged<Unit>>(`/units?${qs}`), ...LIVE })
}

// pickers need the whole roster, the Customers page runs its own filtered query
export function useCustomers() {
  return useQuery({
    queryKey: ['customers', 'all'],
    queryFn: async () => (await api<Paged<Customer>>('/customers?limit=500')).rows,
    ...LIVE,
  })
}

// The tray only offers models the line may actually run; the Models screen asks
// for the retired ones too.
export function useProductModels(includeInactive = false) {
  return useQuery({
    queryKey: ['product-models', includeInactive],
    queryFn: () => api<ProductModel[]>(`/product-models${includeInactive ? '?includeInactive=1' : ''}`),
    ...LIVE,
  })
}

// Any write touches counters and at least one list, so invalidation is broad.
export function useRefreshAll() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['units'] })
    // the open detail sheet reads ['unit', unitId] — without this a new remark
    // or decision only shows up on the next poll
    queryClient.invalidateQueries({ queryKey: ['unit'] })
    queryClient.invalidateQueries({ queryKey: ['unit-stats'] })
    queryClient.invalidateQueries({ queryKey: ['customers'] })
    queryClient.invalidateQueries({ queryKey: ['product-models'] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }
}
