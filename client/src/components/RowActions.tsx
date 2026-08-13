import type { ReactNode } from 'react'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function IconAction({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// One row-action bar for every list: gloves-on icon targets, destructive last.
export default function RowActions({
  onOpen,
  onEdit,
  onDelete,
  deleteTitle,
  deleteDescription,
  leading,
}: {
  onOpen?: () => void
  onEdit?: () => void
  onDelete?: () => void
  deleteTitle?: string
  deleteDescription?: string
  leading?: ReactNode
}) {
  return (
    <div className="flex items-center justify-end gap-1.5 [&_button]:shadow-none [&_button[data-variant=outline]]:border-0 [&_button[data-variant=outline]]:bg-transparent">
      {leading}
      {onOpen && (
        <IconAction label="Open details">
          <Button variant="ghost" size="icon-sm" onClick={onOpen} aria-label="Open details">
            <Eye />
          </Button>
        </IconAction>
      )}
      {onEdit && (
        <IconAction label="Edit">
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit">
            <Pencil />
          </Button>
        </IconAction>
      )}
      {onDelete && (
        <AlertDialog>
          <IconAction label="Delete">
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </AlertDialogTrigger>
          </IconAction>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteTitle ?? 'Delete this record?'}</AlertDialogTitle>
              <AlertDialogDescription>{deleteDescription ?? 'This action cannot be undone.'}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-white hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
