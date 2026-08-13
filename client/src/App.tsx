import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppLayout from '@/components/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Station from '@/pages/Station'
import Units from '@/pages/Units'
import Dispatch from '@/pages/Dispatch'
import Gate from '@/pages/Gate'
import Quality from '@/pages/Quality'
import Customers from '@/pages/Customers'
import Activity from '@/pages/Activity'
import { useAuth } from '@/lib/auth'
import type { Role } from '@/types'

function RequireRole({ roles }: { roles: Role[] }) {
  const { user, loading } = useAuth()
  if (loading)
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin' && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireRole roles={['production', 'dispatch', 'gate', 'quality']} />}>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/activity" element={<Activity />} />
          <Route element={<RequireRole roles={['production']} />}>
            <Route path="/station" element={<Station />} />
            <Route path="/units" element={<Units />} />
            <Route path="/customers" element={<Customers />} />
          </Route>
          <Route element={<RequireRole roles={['dispatch']} />}>
            <Route path="/dispatch" element={<Dispatch />} />
          </Route>
          <Route element={<RequireRole roles={['gate']} />}>
            <Route path="/gate" element={<Gate />} />
          </Route>
          <Route element={<RequireRole roles={['quality']} />}>
            <Route path="/quality" element={<Quality />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
