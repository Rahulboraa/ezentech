import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { ROLE_LABEL } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { AuthUser, Role } from '@/types'

const ROLE_ORDER: Role[] = ['production', 'dispatch', 'gate', 'quality', 'admin']

export default function Login() {
  const { user, login, logoutMessage } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<AuthUser | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: roster } = useQuery({ queryKey: ['roster'], queryFn: () => api<AuthUser[]>('/auth/users') })

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await login(selected.id, pin)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  const stations = ROLE_ORDER.flatMap((role) => (roster ?? []).filter((u) => u.role === role))

  return (
    <div className="flex min-h-screen w-full">
      <div className="relative hidden items-end overflow-hidden bg-slate-950 lg:flex lg:w-[60%]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,#1e40af_0%,transparent_55%),radial-gradient(circle_at_80%_75%,#312e81_0%,transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, #fff 0 2px, transparent 2px 14px), repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 22px)',
          }}
        />
        <img
          src="/logo-mark.png"
          alt=""
          className="absolute -right-16 top-1/2 w-[46%] -translate-y-1/2 opacity-20"
        />
        <div className="relative z-10 p-12">
          <h2 className="text-4xl font-bold tracking-tight text-white">Ezentech India</h2>
          <p className="mt-2 text-lg text-white/80">Unit Assembly Station</p>
          <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.18em] text-white/50">
            Air Conditioner · Serial Traceability
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-background p-8 sm:p-12 lg:w-[40%]">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col gap-2">
            <img src="/logo-mark.png" alt="" className="mb-2 h-9 w-9 object-contain lg:hidden" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Pick your station and enter its PIN to open the line.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="station">Station</Label>
              <Select
                value={selected?.id ?? ''}
                onValueChange={(id) => {
                  setSelected(stations.find((u) => u.id === id) ?? null)
                  setError('')
                  setPin('')
                }}
              >
                <SelectTrigger id="station" className="h-11 w-full">
                  <SelectValue placeholder="Select your station" />
                </SelectTrigger>
                <SelectContent>
                  {stations.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                      {u.name !== ROLE_LABEL[u.role] && (
                        <span className="text-muted-foreground"> · {ROLE_LABEL[u.role]}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                type="password"
                maxLength={6}
                placeholder="••••"
                className="h-11 font-mono tracking-[0.35em]"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                disabled={!selected}
              />
            </div>

            {(error || logoutMessage) && (
              <p className={cn('text-sm', error ? 'text-destructive' : 'text-warning')}>{error || logoutMessage}</p>
            )}

            <Button type="submit" className="h-11 w-full" disabled={busy || !selected || !pin}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
