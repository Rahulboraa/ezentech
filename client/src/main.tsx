import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import App from './App'
import { AuthProvider } from './lib/auth'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <App />
          </TooltipProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                fontSize: '13px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
                padding: '10px 14px',
                background: 'var(--popover)',
                color: 'var(--popover-foreground)',
              },
              success: { iconTheme: { primary: 'hsl(142 65% 40%)', secondary: 'white' } },
              error: { iconTheme: { primary: 'hsl(0 72% 51%)', secondary: 'white' } },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
