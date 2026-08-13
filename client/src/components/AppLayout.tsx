import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  DoorOpen,
  Home,
  LogOut,
  Menu,
  PackageCheck,
  ScrollText,
  ShieldCheck,
  Truck,
  Users2,
  Wrench,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import ThemeToggle, { ThemeToggleRow } from '@/components/ThemeToggle'
import { ROLE_LABEL } from '@/lib/format'
import type { Role } from '@/types'

interface NavEntry {
  to: string
  label: string
  icon: typeof Home
  roles: Role[]
}

const NAV_MAIN: NavEntry[] = [
  { to: '/', label: 'Dashboard', icon: Home, roles: ['production', 'dispatch', 'gate', 'quality'] },
  { to: '/station', label: 'Assembly Station', icon: Wrench, roles: ['production'] },
  { to: '/units', label: 'Units', icon: PackageCheck, roles: ['production'] },
  { to: '/dispatch', label: 'Dispatch', icon: Truck, roles: ['dispatch'] },
  { to: '/gate', label: 'Gate Entry', icon: DoorOpen, roles: ['gate'] },
  { to: '/quality', label: 'Quality Release', icon: ShieldCheck, roles: ['quality'] },
]

const NAV_SECONDARY: NavEntry[] = [
  { to: '/customers', label: 'Customers', icon: Users2, roles: ['production'] },
  { to: '/activity', label: 'Activity Log', icon: ScrollText, roles: ['production', 'dispatch', 'gate', 'quality'] },
]

export function navFor(role: Role, entries: NavEntry[]) {
  return role === 'admin' ? entries : entries.filter((n) => n.roles.includes(role))
}

function NavItem({ to, label, icon: Icon, onNavigate }: NavEntry & { onNavigate?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-all',
          isActive
            ? 'bg-[#eff6ff] font-bold text-[#2563eb] dark:bg-primary/15 dark:text-primary'
            : 'font-medium text-foreground/75 hover:bg-accent hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn('size-5 shrink-0', isActive ? 'text-[#2563eb] dark:text-primary' : 'text-muted-foreground/70')}
            strokeWidth={isActive ? 2.5 : 2}
          />
          <span className="flex-1">{label}</span>
        </>
      )}
    </NavLink>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  if (!user) return null
  const main = navFor(user.role, NAV_MAIN)
  const secondary = navFor(user.role, NAV_SECONDARY)
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 [scrollbar-width:none]">
      <div className="mb-2 px-2">
        <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Shop floor</p>
        {main.map((n) => (
          <NavItem key={n.to} {...n} onNavigate={onNavigate} />
        ))}
      </div>
      {secondary.length > 0 && (
        <div className="px-2 pt-4">
          <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Records</p>
          {secondary.map((n) => (
            <NavItem key={n.to} {...n} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </nav>
  )
}

function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/logo-mark.png" alt="" className="h-7 w-7 object-contain" />
      <span className="text-[17px] font-semibold tracking-tight text-foreground">Ezentech India</span>
    </span>
  )
}

function UserFooter() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const initials = user?.name?.slice(0, 2).toUpperCase() ?? '?'
  return (
    <div className="border-t border-border bg-background p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent/60"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-medium text-background">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold leading-tight text-foreground">{user?.name ?? '—'}</div>
              <div className="truncate text-[11px] leading-tight text-muted-foreground">
                {user ? ROLE_LABEL[user.role] : ''} station
              </div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="truncate text-[13px] font-medium">{user?.name ?? '—'}</div>
            <div className="truncate text-[11px] text-muted-foreground">{user ? ROLE_LABEL[user.role] : ''}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            <LogOut className="mr-2 size-5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

const PAGE_LABELS: Record<string, string> = {
  '': 'Dashboard',
  station: 'Assembly Station',
  units: 'Units',
  dispatch: 'Dispatch',
  gate: 'Gate Entry',
  quality: 'Quality Release',
  customers: 'Customers',
  activity: 'Activity Log',
}

function TopBar() {
  const { pathname } = useLocation()
  const key = pathname.split('/').filter(Boolean)[0] ?? ''
  return (
    <div className="sticky top-0 z-30 hidden h-16 items-center gap-2 border-b border-border/60 bg-background px-6 md:flex">
      <nav className="flex items-center gap-2 text-[13px]">
        <NavLink to="/" className="text-muted-foreground transition-colors hover:text-foreground">
          Unit Assembly Station
        </NavLink>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
        <span className="font-medium text-foreground">{PAGE_LABELS[key] ?? 'Dashboard'}</span>
      </nav>
      <div className="ml-auto flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <ClipboardList className="size-4" />
        Air Conditioner · Serial Traceability
      </div>
    </div>
  )
}

function BottomNav({ onMore }: { onMore: () => void }) {
  const { user } = useAuth()
  if (!user) return null
  const items = navFor(user.role, NAV_MAIN).slice(0, 4)
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                isActive ? 'text-[#2563eb] dark:text-primary' : 'text-muted-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onMore}
          className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground"
        >
          <Menu className="size-5" />
          More
        </button>
      </div>
    </nav>
  )
}

export default function AppLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-border bg-[#f8fafc] dark:bg-sidebar md:flex">
        <div className="px-5 pb-3 pt-5">
          <div className="mb-6">
            <Brand />
          </div>
        </div>
        <SidebarNav />
        <div className="px-3 pb-4">
          <ThemeToggleRow />
        </div>
        <UserFooter />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-[280px] flex-col bg-[#f8fafc] p-0 dark:bg-sidebar">
            <SheetTitle className="px-5 pb-1 pt-5 text-left">
              <Brand />
            </SheetTitle>
            <SidebarNav onNavigate={() => setOpen(false)} />
            <div className="px-3 pb-4">
              <ThemeToggleRow />
            </div>
            <UserFooter />
          </SheetContent>
        </Sheet>
        <Brand />
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </header>

      <main className="min-h-screen bg-slate-50/50 dark:bg-background md:pl-[260px]">
        <TopBar />
        <div className="mx-auto px-4 py-5 pb-24 sm:px-5 sm:py-6 md:px-6 md:py-6 md:pb-6">
          <Outlet />
        </div>
      </main>

      <BottomNav onMore={() => setOpen(true)} />
    </div>
  )
}
