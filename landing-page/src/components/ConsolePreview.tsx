import { Building2, CalendarCheck, CheckCircle2, KanbanSquare, MapPin, Users } from 'lucide-react'

const kpis = [
  { value: '214', label: 'Present', tone: 'text-slate-900' },
  { value: '18', label: 'Work from home', tone: 'text-slate-900' },
  { value: '07', label: 'Awaiting approval', tone: 'text-blue-700' },
]

const stream = [
  { name: 'Anita Rao', detail: 'Head office · within 40m', time: '09:08', state: 'On time' },
  { name: 'Rahul Mehta', detail: 'Work from home · approved', time: '09:21', state: 'Remote' },
  { name: 'Maya Iyer', detail: 'Warehouse · queued offline', time: '09:42', state: 'Synced' },
]

const railIcons = [Users, CalendarCheck, Building2, KanbanSquare, MapPin]

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
}

/**
 * Static, non-interactive illustration of the admin console. Deliberately a light
 * surface so it reads as the real product rather than a decorative dark graphic.
 */
export default function ConsolePreview() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2.5">
          <span aria-hidden="true" className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          </span>
          <p className="mx-auto rounded-md bg-white px-3 py-1 text-[11px] font-medium text-slate-500">
            Attendance overview
          </p>
        </div>

        <div className="flex">
          {/* Module rail */}
          <div aria-hidden="true" className="hidden w-12 shrink-0 flex-col items-center gap-4 border-r border-slate-200 bg-slate-50 py-4 sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            {railIcons.map((Icon, index) => (
              <Icon className={`h-4 w-4 ${index === 0 ? 'text-blue-600' : 'text-slate-400'}`} key={index} />
            ))}
          </div>

          <div className="min-w-0 flex-1 p-4 sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  People · Attendance
                </p>
                <p className="mt-1 text-base font-bold tracking-tight text-slate-900">Today at a glance</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2.5">
              {kpis.map((kpi) => (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5" key={kpi.label}>
                  <dd className={`text-xl font-bold tabular-nums ${kpi.tone}`}>{kpi.value}</dd>
                  <dt className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {kpi.label}
                  </dt>
                </div>
              ))}
            </dl>

            <div className="mt-3 grid gap-2.5 lg:grid-cols-[1fr_10rem]">
              <div className="rounded-lg border border-slate-200">
                <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Check-in stream
                  </p>
                </div>
                <ul>
                  {stream.map((row) => (
                    <li
                      className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0"
                      key={row.name}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[10px] font-bold text-blue-700">
                          {initials(row.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-slate-900">{row.name}</span>
                          <span className="block truncate text-[10px] text-slate-500">{row.detail}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-semibold tabular-nums text-slate-700">{row.time}</span>
                        <span className="block text-[10px] text-slate-400">{row.state}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-2.5">
                <div className="rounded-lg bg-blue-600 p-3 text-white">
                  <MapPin className="h-4 w-4 text-blue-200" />
                  <p className="mt-4 text-[10px] uppercase tracking-wider text-blue-100">Office radius</p>
                  <p className="text-xl font-bold">450m</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Approvals</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">5 leave · 2 WFH</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Escalates to HR after 3 days</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Companion mobile surface, kept inside the panel's visual footprint. */}
      <div className="absolute -bottom-6 -left-4 hidden w-36 rounded-xl border border-slate-200 bg-white p-2 shadow-soft md:block">
        <div className="rounded-lg bg-slate-900 p-2.5 text-white">
          <div className="mx-auto mb-2.5 h-1 w-8 rounded-full bg-white/25" />
          <div className="rounded-md bg-blue-600 p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-blue-100">Location</p>
            <p className="text-xs font-bold">Inside office</p>
          </div>
          <p className="mt-2 text-center text-[9px] text-slate-400">Head office · 09:08</p>
          <div className="mt-2 rounded-md bg-white py-1.5 text-center text-[10px] font-bold text-slate-900">
            Checked in
          </div>
        </div>
      </div>
    </div>
  )
}
