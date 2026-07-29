'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Segment error boundary.
 *
 * Without this, one component throwing during render blanks the entire console
 * with the browser's own "this page couldn't load" message and no way back.
 * Here the shell survives, the reason is visible, and recovery is one click.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep the detail in the console for whoever is debugging.
    console.error('Admin console render error:', error)
  }, [error])

  return (
    <main className="grid min-h-screen place-items-center bg-neu-bg p-5">
      <div className="neu-card w-full max-w-lg rounded-lg p-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger-soft text-danger">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-lg font-bold tracking-tight">This screen hit an error</h1>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          The rest of the console is fine. Try again, and if it keeps happening tell us what you were doing —
          the details below help us find it quickly.
        </p>

        <pre className="mt-4 max-h-40 overflow-auto rounded-md border border-line bg-surface-subtle p-3 text-xs leading-5 text-ink-soft">
          {error.message || 'Unknown error'}
          {error.digest ? `\n\nReference: ${error.digest}` : ''}
        </pre>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="gradient-button flex items-center gap-2 rounded-md px-4 py-2 text-sm">
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
          <button type="button" onClick={() => window.location.reload()} className="neu-button rounded-md px-4 py-2 text-sm">
            Reload the console
          </button>
        </div>
      </div>
    </main>
  )
}
