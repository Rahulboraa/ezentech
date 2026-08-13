import { useState } from 'react'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiDownload } from '@/lib/api'
import { todayYmd } from '@/lib/format'
import { Button } from '@/components/ui/button'

export default function ExportButton({ path, name, params }: { path: string; name: string; params?: URLSearchParams }) {
  const [busy, setBusy] = useState(false)
  const qs = params?.toString()
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await apiDownload(`${path}${qs ? `?${qs}` : ''}`, `${name}-${todayYmd()}.xlsx`)
          toast.success('Excel downloaded')
        } catch {
          toast.error('Export failed')
        } finally {
          setBusy(false)
        }
      }}
    >
      <Download className="size-5" /> {busy ? 'Exporting…' : 'Export'}
    </Button>
  )
}
