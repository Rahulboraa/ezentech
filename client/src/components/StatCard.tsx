import type { ReactNode, ComponentType, SVGProps } from 'react'
import { cn } from '@/lib/utils'

const tintBg: Record<string, string> = {
  info: 'bg-info/10 text-info',
  purple: 'bg-purple/10 text-purple',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  foreground: 'bg-muted text-foreground',
}

export default function StatCard({ icon: Icon, tint = 'foreground', label, value, hint, className }: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  tint?: keyof typeof tintBg
  label: string
  value: ReactNode
  hint?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-border/60 bg-card p-4 shadow-sm md:p-5', className)}>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tintBg[tint])}>
            <Icon className="size-5" strokeWidth={2} />
          </span>
        )}
        <span className="text-[13px] font-medium text-foreground">{label}</span>
      </div>
      <div className="mt-3 truncate text-xl font-semibold leading-none tracking-tight tabular-nums md:text-[26px]">{value}</div>
      <div className="mt-3 text-[12px] text-muted-foreground">{hint ?? ''}</div>
    </div>
  )
}
