'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  Cake,
  CalendarDays,
  CheckCheck,
  FileText,
  Gift,
  Laptop,
  Loader2,
  PartyPopper,
  Receipt,
  Sun,
  Wallet,
  X,
} from 'lucide-react'

export type NotificationRecord = {
  _id: string
  kind: string
  title: string
  body?: string
  severity: 'info' | 'success' | 'warning' | 'critical'
  link?: { page: string; id?: string | null } | null
  readAt?: string | null
  createdAt: string
}

/**
 * One entry per kind: a short label and a colour. The label is what makes a
 * notification identifiable at a glance, so it is rendered before the title.
 */
const KIND_META: Record<string, { label: string; icon: typeof Bell; tint: string }> = {
  birthday_self: { label: 'Birthday', icon: Cake, tint: 'bg-warning-soft text-warning' },
  birthday_team: { label: 'Birthday', icon: Cake, tint: 'bg-warning-soft text-warning' },
  anniversary_self: { label: 'Anniversary', icon: Gift, tint: 'bg-success-soft text-success' },
  anniversary_team: { label: 'Anniversary', icon: Gift, tint: 'bg-success-soft text-success' },
  company_anniversary: { label: 'Company', icon: PartyPopper, tint: 'bg-primary-50 text-primary-700' },
  holiday_announced: { label: 'Holiday', icon: Sun, tint: 'bg-danger-soft text-danger' },
  holiday_reminder: { label: 'Holiday', icon: Sun, tint: 'bg-danger-soft text-danger' },
  event_announced: { label: 'Event', icon: CalendarDays, tint: 'bg-primary-50 text-primary-700' },
  leave_decision: { label: 'Leave', icon: FileText, tint: 'bg-primary-50 text-primary-700' },
  leave_request: { label: 'Leave', icon: FileText, tint: 'bg-primary-50 text-primary-700' },
  wfh_decision: { label: 'Work from home', icon: Laptop, tint: 'bg-primary-50 text-primary-700' },
  reimbursement_decision: { label: 'Expense', icon: Receipt, tint: 'bg-primary-50 text-primary-700' },
  payslip_published: { label: 'Payslip', icon: Wallet, tint: 'bg-success-soft text-success' },
  asset_assigned: { label: 'Asset', icon: Laptop, tint: 'bg-slate-100 text-ink-soft' },
  onboarding_reminder: { label: 'Setup', icon: Bell, tint: 'bg-warning-soft text-warning' },
  announcement: { label: 'Announcement', icon: Bell, tint: 'bg-primary-50 text-primary-700' },
}

const FALLBACK_META = { label: 'Update', icon: Bell, tint: 'bg-slate-100 text-ink-soft' }

function metaFor(kind: string) {
  return KIND_META[kind] || FALLBACK_META
}

function relativeTime(iso: string) {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ''
  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(then).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/**
 * Notification inbox in the app bar. Replaces the previous static dropdown that
 * only ever rendered one computed sentence and had no read state.
 */
export default function NotificationCentre({ apiRoot, token, onNavigate }: {
  apiRoot: string
  token: string
  onNavigate: (page: string, id?: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRecord[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const wrapper = useRef<HTMLDivElement>(null)

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${apiRoot}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.message || 'Request failed')
    return (body?.data || {}) as T
  }, [apiRoot, token])

  const loadCount = useCallback(async () => {
    try {
      const data = await request<{ unread: number }>('/notifications/unread-count')
      setUnread(data.unread || 0)
    } catch {
      // A failed badge poll must never surface as a page error.
    }
  }, [request])

  const loadInbox = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await request<{ notifications: NotificationRecord[]; unread: number }>('/notifications?limit=50')
      setItems(data.notifications || [])
      setUnread(data.unread || 0)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load notifications')
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => {
    if (!token) return
    void loadCount()
    // Light poll so a greeting or approval shows up without a manual refresh.
    const timer = window.setInterval(() => { void loadCount() }, 60_000)
    return () => window.clearInterval(timer)
  }, [token, loadCount])

  useEffect(() => {
    if (open) void loadInbox()
  }, [open, loadInbox])

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocumentClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const visible = useMemo(
    () => (filter === 'unread' ? items.filter((item) => !item.readAt) : items),
    [items, filter],
  )

  async function markRead(notification: NotificationRecord) {
    if (notification.readAt) return
    setItems((current) => current.map((item) => (
      item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item
    )))
    setUnread((current) => Math.max(0, current - 1))
    try {
      await request(`/notifications/${notification._id}/read`, { method: 'PATCH' })
    } catch {
      void loadInbox()
    }
  }

  async function markAll() {
    setBusy(true)
    try {
      await request('/notifications/read-all', { method: 'POST' })
      await loadInbox()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not mark all as read')
    } finally {
      setBusy(false)
    }
  }

  function activate(notification: NotificationRecord) {
    void markRead(notification)
    if (notification.link?.page) {
      onNavigate(notification.link.page, notification.link.id)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={wrapper}>
      <button
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className="ghost-button relative p-2"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-0 top-0 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold tabular-nums text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="neu-card animate-in fixed left-3 right-3 top-16 z-50 rounded-lg shadow-overlay sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-subtle px-3.5 py-2.5">
            <p className="text-sm font-bold">Notifications</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilter((current) => (current === 'all' ? 'unread' : 'all'))}
                className="ghost-button px-2 py-1 text-xs font-semibold"
              >
                {filter === 'all' ? 'Unread only' : 'Show all'}
              </button>
              <button
                type="button"
                aria-label="Mark all as read"
                disabled={busy || unread === 0}
                onClick={() => void markAll()}
                className="ghost-button p-1.5 disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              </button>
              <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="ghost-button p-1.5 sm:hidden">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {error && <p role="alert" className="border-b border-line bg-danger-soft px-3.5 py-2 text-xs font-medium text-danger">{error}</p>}

          <div className="max-h-[26rem] overflow-y-auto">
            {loading ? (
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-ink-soft">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading
              </p>
            ) : visible.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Bell className="mx-auto h-6 w-6 text-ink-muted" />
                <p className="mt-2.5 text-sm font-semibold">{filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-ink-soft">
                  Birthdays, work anniversaries, holidays and approval decisions land here automatically.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {visible.map((notification) => {
                  const meta = metaFor(notification.kind)
                  const Icon = meta.icon
                  return (
                    <li key={notification._id}>
                      <button
                        type="button"
                        onClick={() => activate(notification)}
                        className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-subtle ${
                          notification.readAt ? '' : 'bg-primary-50/40'
                        }`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${meta.tint}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          {/* Type first: this is the line that answers "what is
                              this?" without reading the rest. */}
                          <span className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold uppercase tracking-[0.06em] ${meta.tint.split(' ')[1]}`}>
                              {meta.label}
                            </span>
                            <span className="text-[10px] text-ink-muted">· {relativeTime(notification.createdAt)}</span>
                          </span>
                          <span className={`mt-0.5 block truncate text-sm ${notification.readAt ? 'font-medium text-ink' : 'font-bold text-ink'}`}>
                            {notification.title}
                          </span>
                        </span>
                        {!notification.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
