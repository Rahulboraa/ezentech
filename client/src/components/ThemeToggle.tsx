import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

const listeners = new Set<() => void>()

function isDark() {
  return document.documentElement.classList.contains('dark')
}

function toggleTheme() {
  const next = !isDark()
  document.documentElement.classList.toggle('dark', next)
  localStorage.setItem('ez_theme', next ? 'dark' : 'light')
  listeners.forEach((fn) => fn())
}

function useTheme() {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force((n) => n + 1)
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])
  return isDark()
}

export default function ThemeToggle() {
  const dark = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      className="text-muted-foreground hover:text-foreground"
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  )
}

export function ThemeToggleRow() {
  const dark = useTheme()
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-foreground/75 transition-colors hover:bg-accent hover:text-foreground"
    >
      {dark ? <Sun className="size-5 shrink-0 text-muted-foreground/70" /> : <Moon className="size-5 shrink-0 text-muted-foreground/70" />}
      <span className="flex-1 text-left">{dark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  )
}
