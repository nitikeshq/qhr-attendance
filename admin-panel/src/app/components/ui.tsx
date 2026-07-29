'use client'

import { ChevronDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'

export const fieldClass = 'neu-input w-full px-3 py-2.5'

export type Option = { value: string; label: string; hint?: string; group?: string }

/** Accessible typeahead select. Replaces long native <select> lists. */
export function SearchableSelect({
  options, value, onChange, placeholder = 'Search and select', name, required = false,
  disabled = false, allowEmpty = false, emptyLabel = 'None', emptyMessage = 'No matches found', id,
}: {
  options: Option[]; value: string; onChange: (value: string) => void; placeholder?: string
  name?: string; required?: boolean; disabled?: boolean; allowEmpty?: boolean
  emptyLabel?: string; emptyMessage?: string; id?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const wrapper = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value) || null

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) => `${option.label} ${option.hint || ''}`.toLowerCase().includes(needle))
  }, [options, query])

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    return () => document.removeEventListener('mousedown', onDocumentClick)
  }, [])

  useEffect(() => { setActive(0) }, [query, open])

  function commit(next: string) {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={wrapper} className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button" id={id} disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`${fieldClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className={`truncate ${selected ? '' : 'text-slate-400'}`}>
          {selected ? selected.label : (required ? placeholder : emptyLabel)}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && !disabled && (
        <div className="animate-in absolute z-40 mt-1 w-full rounded-lg border border-line bg-white shadow-overlay">
          <label className="relative block border-b border-line p-2">
            {/* `top-[18px]` rather than `top-4.5`: 4.5 is not in the default spacing scale. */}
            <Search className="absolute left-4 top-[18px] h-4 w-4 text-ink-muted" />
            <input
              autoFocus value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder} aria-label={placeholder}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(i + 1, visible.length - 1)) }
                if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
                if (event.key === 'Enter') { event.preventDefault(); if (visible[active]) commit(visible[active].value) }
                if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
              }}
              className="w-full rounded-md border border-line py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:border-primary-500"
            />
          </label>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1 text-sm">
            {allowEmpty && !query.trim() && (
              <li>
                <button type="button" onClick={() => commit('')} className="w-full px-3 py-2 text-left text-ink-soft transition-colors hover:bg-surface-hover">
                  {emptyLabel}
                </button>
              </li>
            )}
            {visible.map((option, index) => (
              <li key={option.value}>
                <button
                  type="button" role="option" aria-selected={option.value === value}
                  onMouseEnter={() => setActive(index)} onClick={() => commit(option.value)}
                  className={`flex w-full flex-col items-start px-3 py-1.5 text-left transition-colors ${index === active ? 'bg-primary-50' : ''} ${option.value === value ? 'font-semibold text-primary-700' : ''}`}
                >
                  <span className="truncate">{option.label}</span>
                  {option.hint && <span className="truncate text-xs text-ink-soft">{option.hint}</span>}
                </button>
              </li>
            ))}
            {!visible.length && <li className="px-3 py-6 text-center text-ink-soft">{emptyMessage}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Paginated, searchable, sortable-free data table with contextual empty state. */
export function DataTable({
  headers, rows, empty = 'No records found', emptyHint, searchable = false,
  searchPlaceholder = 'Search records', toolbar, defaultPageSize = 10, stickyFirstColumn = true,
}: {
  headers: string[]; rows: ReactNode[][]; empty?: string; emptyHint?: string
  searchable?: boolean; searchPlaceholder?: string; toolbar?: ReactNode
  defaultPageSize?: number; stickyFirstColumn?: boolean
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle || !searchable) return rows
    return rows.filter((row) => rowText(row).toLowerCase().includes(needle))
  }, [rows, query, searchable])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  useEffect(() => { setPage((current) => Math.min(current, pageCount)) }, [pageCount])
  useEffect(() => { setPage(1) }, [query])
  const first = (page - 1) * pageSize
  const visible = filtered.slice(first, first + pageSize)

  return (
    <div>
      {(searchable || toolbar) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {searchable ? (
            <label className="relative min-w-56 flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={query} onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder} aria-label={searchPlaceholder}
                className={`${fieldClass} py-2 pl-9`}
              />
            </label>
          ) : <span />}
          {toolbar}
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState label={query.trim() ? 'No records match your search' : empty} hint={query.trim() ? 'Try a different term or clear the search.' : emptyHint} />
      ) : (
        <>
          {/* Negative margins match .card-body padding so the grid runs edge to edge. */}
          <div className="-mx-4 overflow-x-auto border-y border-line sm:-mx-5">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr>
                  {headers.map((header, index) => (
                    <th key={header} scope="col" className={`whitespace-nowrap px-3 py-2 first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${stickyFirstColumn && index === 0 ? 'sticky left-0 z-10 bg-surface-subtle' : ''}`}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, rowIndex) => (
                  <tr key={first + rowIndex} className="group border-t border-line hover:bg-surface-subtle">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className={`px-3 py-2.5 align-middle first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${stickyFirstColumn && cellIndex === 0 ? 'sticky left-0 z-[1] bg-white group-hover:bg-surface-subtle' : ''}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wide text-ink-muted">Rows</span>
              <select
                aria-label="Rows per page" value={pageSize}
                onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}
                className="neu-input rounded-md px-2 py-1 text-xs"
              >
                {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <span className="tabular-nums">{first + 1}-{Math.min(first + pageSize, filtered.length)} of {filtered.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="ghost-button p-1.5 disabled:cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-24 text-center font-semibold tabular-nums text-ink">Page {page} of {pageCount}</span>
              <button type="button" aria-label="Next page" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} className="ghost-button p-1.5 disabled:cursor-not-allowed">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function rowText(row: ReactNode[]): string {
  return row.map((cell) => flatten(cell)).join(' ')
}

function flatten(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(flatten).join(' ')
  const element = node as { props?: { children?: ReactNode } }
  return element?.props?.children ? flatten(element.props.children) : ''
}

export function EmptyState({ label, hint, action, icon }: { label: string; hint?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface-subtle px-6 py-12 text-center">
      {icon && <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-ink-muted">{icon}</div>}
      <p className="text-sm font-semibold text-ink">{label}</p>
      {hint && <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-ink-soft">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/**
 * Standard page card: a tinted header band with the title and actions, then the
 * body. `flush` removes body padding for tables that should run edge to edge.
 * Deliberately no `overflow-hidden` — popovers such as SearchableSelect render
 * inside these cards and would be clipped.
 */
export function SectionCard({ title, description, actions, children, className = '', flush = false, icon }: {
  title?: string; description?: string; actions?: ReactNode; children: ReactNode
  className?: string; flush?: boolean; icon?: ReactNode
}) {
  return (
    <section className={`neu-card rounded-lg ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
                {icon && <span className="shrink-0 text-ink-muted">{icon}</span>}
                <span className="min-w-0">{title}</span>
              </h2>
            )}
            {description && <p className="mt-1 text-xs leading-relaxed text-ink-soft">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? '' : 'card-body'}>{children}</div>
    </section>
  )
}

export function TabBar<T extends string>({ tabs, value, onChange }: {
  tabs: Array<{ key: T; label: string; count?: number }>; value: T; onChange: (key: T) => void
}) {
  return (
    <div role="tablist" className="flex gap-5 overflow-x-auto border-b border-line">
      {tabs.map((tab) => {
        const active = value === tab.key
        return (
          <button
            key={tab.key} role="tab" aria-selected={active} onClick={() => onChange(tab.key)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-2.5 pt-1 text-sm font-semibold transition-colors duration-150 ease-enter ${active ? 'border-primary-500 text-primary-700' : 'border-transparent text-ink-soft hover:border-line-strong hover:text-ink'}`}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className={`chip tabular-nums ${active ? 'bg-primary-50 text-primary-700' : 'bg-surface-hover text-ink-soft'}`}>{tab.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Drawer({ title, subtitle, close, children, footer, wide = false }: {
  title: string; subtitle?: string; close: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-[1px]">
      <button aria-label="Close panel" onClick={close} className="flex-1" />
      <div className={`animate-in flex h-full w-full flex-col border-l border-line bg-white shadow-overlay ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}>
        <div className="flex items-start justify-between gap-3 border-b border-line bg-surface-subtle px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-ink-soft">{subtitle}</p>}
          </div>
          <button aria-label="Close panel" onClick={close} className="ghost-button shrink-0 p-1.5"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer && <div className="border-t border-line bg-surface-subtle px-4 py-3 sm:px-5">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children, required = false }: {
  label: string; hint?: string; children: ReactNode; required?: boolean
}) {
  return (
    <label className="block text-sm font-semibold">
      <span>{label}{required && <span className="ml-0.5 text-danger">*</span>}</span>
      <div className="mt-1.5 font-normal">{children}</div>
      {hint && <p className="mt-1 text-xs font-normal leading-relaxed text-ink-soft">{hint}</p>}
    </label>
  )
}

const TONE_CLASS: Record<string, string> = {
  positive: 'bg-success-soft text-success ring-emerald-200',
  warning: 'bg-warning-soft text-warning ring-amber-200',
  danger: 'bg-danger-soft text-danger ring-red-200',
  info: 'bg-primary-50 text-primary-700 ring-primary-200',
  neutral: 'bg-slate-100 text-ink-soft ring-slate-200',
}

export function statusTone(value: string): keyof typeof TONE_CLASS {
  const text = String(value || '').toLowerCase()
  if (['approved', 'active', 'paid', 'present', 'resolved', 'available', 'done', 'verified', 'complete', 'returned'].some((token) => text.includes(token))) return 'positive'
  if (['pending', 'draft', 'review', 'progress', 'trial', 'late', 'partial', 'repair', 'hold'].some((token) => text.includes(token))) return 'warning'
  if (['reject', 'inactive', 'absent', 'suspended', 'overdue', 'lost', 'cancelled', 'damaged', 'blocked'].some((token) => text.includes(token))) return 'danger'
  if (['assigned', 'queued', 'submitted', 'forwarded'].some((token) => text.includes(token))) return 'info'
  return 'neutral'
}

export function humanize(value: string): string {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim()
}

export function Badge({ children, tone }: { children: string; tone?: keyof typeof TONE_CLASS }) {
  const resolved = tone || statusTone(children)
  return (
    <span className={`chip ring-1 ring-inset ${TONE_CLASS[resolved]}`}>
      {humanize(children)}
    </span>
  )
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-subtle px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-ink">{value ?? '-'}</p>
    </div>
  )
}

/** Dashboard metric tile. Shared so every page reports numbers identically. */
export function StatTile({ label, value, hint, icon, tone = 'neutral' }: {
  label: string; value: ReactNode; hint?: string; icon?: ReactNode
  tone?: 'neutral' | 'positive' | 'warning' | 'danger' | 'info'
}) {
  const accent: Record<string, string> = {
    neutral: 'text-ink',
    positive: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    info: 'text-primary-700',
  }
  return (
    <div className="neu-card rounded-lg px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">{label}</p>
        {icon && <span className="shrink-0 text-ink-muted">{icon}</span>}
      </div>
      <p className={`mt-1.5 truncate text-2xl font-bold tracking-tight tabular-nums ${accent[tone]}`}>{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-ink-soft">{hint}</p>}
    </div>
  )
}
