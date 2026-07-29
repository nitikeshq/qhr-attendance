'use client'

import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import {
  AlertTriangle, Archive, Bell, BellOff, CheckCircle2, GripVertical, Loader2, MessageSquare, Pencil,
  Plus, RefreshCw, Reply, Save, Send, Trash2, X,
} from 'lucide-react'
import {
  Badge, DataTable, Drawer, EmptyState, Field, SearchableSelect, SectionCard, TabBar, fieldClass, humanize,
  type Option,
} from './ui'

type WorkTab = 'board' | 'tasks' | 'projects'
type DrawerKind = 'task' | 'create-task' | 'create-project'

type WorkspaceEmployee = { _id: string; name: string; employeeId: string; department?: string }
type PersonRef = { _id: string; employeeId?: string; firstName?: string; lastName?: string; email?: string; name?: string }
type BoardColumn = { id: string; name: string; order: number; isDone: boolean }

type ProjectRecord = {
  _id: string
  key: string
  name: string
  description?: string
  status: string
  members: string[]
  leadEmployeeId: string | null
  startDate: string | null
  dueDate: string | null
  boardColumns: BoardColumn[]
  taskCounter: number
  lead?: PersonRef | null
}

type TaskRecord = {
  _id: string
  key: string | null
  projectId: string
  title: string
  description?: string
  assignedTo: string | null
  status: string
  priority: string
  labels: string[]
  storyPoints: number | null
  startDate: string | null
  dueDate: string | null
  rank?: number | string | null
  createdAt?: string
  watchers?: string[]
  assignee?: PersonRef | null
  project?: { _id: string; key: string; name: string } | null
}

type TaskComment = {
  _id: string
  employeeId?: string
  body: string
  parentCommentId: string | null
  mentions: string[]
  editedAt: string | null
  createdAt: string
  author?: PersonRef | null
  mentionRefs?: PersonRef[]
}

type TaskActivity = { _id?: string; field: string; from?: unknown; to?: unknown; actorName?: string; at: string }

type TaskDetail = TaskRecord & {
  comments: TaskComment[]
  activity: TaskActivity[]
  watchers: string[]
  watcherRefs?: PersonRef[]
  reporter?: PersonRef | null
}

type BoardResponse = { project: ProjectRecord; columns: Array<{ column: BoardColumn; tasks: TaskRecord[] }> }

type TaskFormState = {
  projectId: string; title: string; description: string; assignedTo: string; priority: string
  labels: string; storyPoints: string; startDate: string; dueDate: string
}
type ProjectFormState = {
  name: string; key: string; description: string; leadEmployeeId: string; members: string[]
  startDate: string; dueDate: string
}
type TaskEditState = {
  title: string; description: string; assignedTo: string; status: string; priority: string
  labels: string; storyPoints: string; startDate: string; dueDate: string
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent']
const PRIORITY_OPTIONS: Option[] = PRIORITIES.map((value) => ({ value, label: humanize(value) }))
const PRIORITY_TONE: Record<string, string> = { urgent: 'danger', high: 'warning', medium: 'info', low: 'neutral' }

const emptyTaskForm: TaskFormState = {
  projectId: '', title: '', description: '', assignedTo: '', priority: 'medium',
  labels: '', storyPoints: '', startDate: '', dueDate: '',
}
const emptyProjectForm: ProjectFormState = {
  name: '', key: '', description: '', leadEmployeeId: '', members: [], startDate: '', dueDate: '',
}
const emptyTaskEdit: TaskEditState = {
  title: '', description: '', assignedTo: '', status: '', priority: 'medium',
  labels: '', storyPoints: '', startDate: '', dueDate: '',
}

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong. Please try again.'
}

function personName(person?: PersonRef | null): string {
  if (!person) return 'Unassigned'
  const full = [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
  return full || person.name || person.email || person.employeeId || 'Unknown'
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

function formatDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'
}

function toDateInput(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function describeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'empty'
  if (Array.isArray(value)) return value.length ? value.map((item) => String(item)).join(', ') : 'empty'
  if (typeof value === 'number') return String(value)
  return humanize(String(value)) || String(value)
}

function taskEditFrom(task: TaskDetail): TaskEditState {
  return {
    title: task.title || '',
    description: task.description || '',
    assignedTo: task.assignedTo || '',
    status: task.status || '',
    priority: task.priority || 'medium',
    labels: (task.labels || []).join(', '),
    storyPoints: task.storyPoints === null || task.storyPoints === undefined ? '' : String(task.storyPoints),
    startDate: toDateInput(task.startDate),
    dueDate: toDateInput(task.dueDate),
  }
}

function parseLabels(value: string): string[] {
  return value.split(',').map((label) => label.trim()).filter(Boolean)
}

function Banner({ tone, message, onDismiss }: { tone: 'error' | 'success'; message: string; onDismiss?: () => void }) {
  const styles = tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${styles}`}>
      {tone === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <span className="min-w-0 flex-1 break-words">{message}</span>
      {onDismiss && (
        <button type="button" aria-label="Dismiss message" onClick={onDismiss} className="rounded p-0.5 hover:opacity-70">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  )
}

export default function WorkWorkspace({ apiRoot, token, role, employees, onChanged }: {
  apiRoot: string
  token: string
  role: 'manager' | 'hr' | 'admin'
  employees: WorkspaceEmployee[]
  onChanged: (message: string) => Promise<void> | void
}) {
  const [tab, setTab] = useState<WorkTab>('board')
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [projectId, setProjectId] = useState('')
  const [board, setBoard] = useState<BoardResponse | null>(null)
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [boardLoading, setBoardLoading] = useState(false)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  const [statusFilter, setStatusFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  const [drawer, setDrawer] = useState<DrawerKind | null>(null)
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [taskEdit, setTaskEdit] = useState<TaskEditState>(emptyTaskEdit)

  const [commentBody, setCommentBody] = useState('')
  const [commentMentions, setCommentMentions] = useState<string[]>([])
  const [replyParentId, setReplyParentId] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState('')
  const [editingCommentBody, setEditingCommentBody] = useState('')

  const [taskForm, setTaskForm] = useState<TaskFormState>(emptyTaskForm)
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm)
  const [formError, setFormError] = useState('')
  const [dragTaskId, setDragTaskId] = useState('')

  const request = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${apiRoot}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    })
    const payload = (await response.json().catch(() => ({}))) as { success?: boolean; data?: T; message?: string }
    if (!response.ok || payload.success === false) {
      throw new ApiError(payload.message || `Request failed (${response.status})`, response.status)
    }
    return (payload.data || ({} as T))
  }, [apiRoot, token])

  useEffect(() => {
    let cancelled = false
    request<{ user?: PersonRef }>('/auth/me')
      .then((data) => { if (!cancelled) setCurrentUserId(data.user?._id || '') })
      .catch(() => { /* identity is optional, permissions are enforced by the API */ })
    return () => { cancelled = true }
  }, [request])

  useEffect(() => {
    let cancelled = false
    setProjectsLoading(true)
    request<{ projects: ProjectRecord[] }>('/projects')
      .then((data) => {
        if (cancelled) return
        const list = data.projects || []
        setProjects(list)
        setProjectId((current) => (list.some((project) => project._id === current) ? current : (list[0]?._id || '')))
      })
      .catch((failure) => { if (!cancelled) setError(errorMessage(failure)) })
      .finally(() => { if (!cancelled) setProjectsLoading(false) })
    return () => { cancelled = true }
  }, [request, reloadKey])

  useEffect(() => {
    if (!projectId) { setBoard(null); return }
    let cancelled = false
    setBoardLoading(true)
    request<BoardResponse>(`/projects/${projectId}/board`)
      .then((data) => { if (!cancelled) setBoard(data.project ? data : null) })
      .catch((failure) => { if (!cancelled) { setBoard(null); setError(errorMessage(failure)) } })
      .finally(() => { if (!cancelled) setBoardLoading(false) })
    return () => { cancelled = true }
  }, [request, projectId, reloadKey])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ limit: '100' })
    if (projectId) params.set('projectId', projectId)
    if (statusFilter) params.set('status', statusFilter)
    if (assigneeFilter) params.set('assignedTo', assigneeFilter)
    if (priorityFilter) params.set('priority', priorityFilter)
    setTasksLoading(true)
    request<{ tasks: TaskRecord[] }>(`/tasks?${params.toString()}`)
      .then((data) => { if (!cancelled) setTasks(data.tasks || []) })
      .catch((failure) => { if (!cancelled) { setTasks([]); setError(errorMessage(failure)) } })
      .finally(() => { if (!cancelled) setTasksLoading(false) })
    return () => { cancelled = true }
  }, [request, projectId, statusFilter, assigneeFilter, priorityFilter, reloadKey])

  const selectedProject = useMemo(
    () => projects.find((project) => project._id === projectId) || null,
    [projects, projectId],
  )
  const columns = useMemo<BoardColumn[]>(() => {
    if (board?.columns?.length) return board.columns.map((entry) => entry.column)
    return selectedProject?.boardColumns || []
  }, [board, selectedProject])

  const projectOptions = useMemo<Option[]>(
    () => projects.map((project) => ({ value: project._id, label: `${project.key} · ${project.name}`, hint: humanize(project.status) })),
    [projects],
  )
  const employeeOptions = useMemo<Option[]>(
    () => employees.map((employee) => ({ value: employee._id, label: employee.name, hint: [employee.employeeId, employee.department].filter(Boolean).join(' · ') })),
    [employees],
  )
  const statusOptions = useMemo<Option[]>(() => {
    const seen = new Map<string, string>()
    const source = columns.length ? columns : projects.flatMap((project) => project.boardColumns || [])
    source.forEach((column) => { if (!seen.has(column.id)) seen.set(column.id, column.name) })
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }))
  }, [columns, projects])

  const hasProjects = projects.length > 0
  const canCreateTask = hasProjects
  const canArchiveProject = role === 'admin'
  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>()
    employees.forEach((employee) => map.set(employee._id, employee.name))
    return map
  }, [employees])

  const mutate = useCallback(async (action: () => Promise<string>): Promise<boolean> => {
    setBusy(true)
    setError('')
    setFormError('')
    try {
      const message = await action()
      setReloadKey((key) => key + 1)
      setNotice(message)
      await onChanged(message)
      return true
    } catch (failure) {
      setError(errorMessage(failure))
      setFormError(errorMessage(failure))
      return false
    } finally {
      setBusy(false)
    }
  }, [onChanged])

  const openTask = useCallback(async (id: string) => {
    setDrawer('task')
    setDetail(null)
    setDetailError('')
    setCommentBody('')
    setCommentMentions([])
    setReplyParentId(null)
    setEditingCommentId('')
    setDetailLoading(true)
    try {
      const data = await request<{ task: TaskDetail }>(`/tasks/${id}`)
      setDetail(data.task)
      setTaskEdit(taskEditFrom(data.task))
    } catch (failure) {
      setDetailError(errorMessage(failure))
    } finally {
      setDetailLoading(false)
    }
  }, [request])

  const reloadDetail = useCallback(async (id: string) => {
    try {
      const data = await request<{ task: TaskDetail }>(`/tasks/${id}`)
      setDetail(data.task)
      setTaskEdit(taskEditFrom(data.task))
    } catch (failure) {
      setDetailError(errorMessage(failure))
    }
  }, [request])

  async function moveTask(taskId: string, status: string, beforeTaskId?: string, afterTaskId?: string) {
    await mutate(async () => {
      const body: Record<string, string> = { status }
      if (beforeTaskId) body.beforeTaskId = beforeTaskId
      if (afterTaskId) body.afterTaskId = afterTaskId
      await request(`/tasks/${taskId}/move`, { method: 'PATCH', body: JSON.stringify(body) })
      return 'Task moved'
    })
  }

  function onCardDragStart(event: DragEvent<HTMLElement>, taskId: string) {
    setDragTaskId(taskId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', taskId)
  }

  function allowDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function draggedId(event: DragEvent<HTMLElement>): string {
    return dragTaskId || event.dataTransfer.getData('text/plain')
  }

  function dropOnColumn(event: DragEvent<HTMLElement>, columnId: string, columnTasks: TaskRecord[]) {
    event.preventDefault()
    const id = draggedId(event)
    setDragTaskId('')
    if (!id) return
    const siblings = columnTasks.filter((task) => task._id !== id)
    const last = siblings[siblings.length - 1]
    void moveTask(id, columnId, last?._id)
  }

  function dropOnCard(event: DragEvent<HTMLElement>, columnId: string, columnTasks: TaskRecord[], target: TaskRecord) {
    event.preventDefault()
    event.stopPropagation()
    const id = draggedId(event)
    setDragTaskId('')
    if (!id || id === target._id) return
    const siblings = columnTasks.filter((task) => task._id !== id)
    const position = siblings.findIndex((task) => task._id === target._id)
    const before = position > 0 ? siblings[position - 1]?._id : undefined
    const after = position >= 0 ? siblings[position]?._id : undefined
    void moveTask(id, columnId, before, after)
  }

  async function saveTaskEdits() {
    if (!detail) return
    if (!taskEdit.title.trim()) { setDetailError('Task title is required'); return }
    const taskId = detail._id
    const done = await mutate(async () => {
      await request(`/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: taskEdit.title.trim(),
          description: taskEdit.description,
          assignedTo: taskEdit.assignedTo || null,
          status: taskEdit.status,
          priority: taskEdit.priority,
          labels: parseLabels(taskEdit.labels),
          storyPoints: taskEdit.storyPoints === '' ? null : Number(taskEdit.storyPoints),
          startDate: taskEdit.startDate || null,
          dueDate: taskEdit.dueDate || null,
        }),
      })
      return 'Task updated'
    })
    if (done) await reloadDetail(taskId)
  }

  async function deleteTask() {
    if (!detail) return
    if (!window.confirm(`Delete ${detail.key || 'this task'}? This cannot be undone.`)) return
    const done = await mutate(async () => {
      await request(`/tasks/${detail._id}`, { method: 'DELETE' })
      return 'Task deleted'
    })
    if (done) { setDrawer(null); setDetail(null) }
  }

  async function toggleWatch(watching: boolean) {
    if (!detail) return
    const taskId = detail._id
    const done = await mutate(async () => {
      await request(`/tasks/${taskId}/watch`, { method: watching ? 'DELETE' : 'POST' })
      return watching ? 'Stopped watching task' : 'Watching task'
    })
    if (done) await reloadDetail(taskId)
  }

  async function addComment() {
    if (!detail) return
    if (!commentBody.trim()) { setDetailError('Comment cannot be empty'); return }
    const taskId = detail._id
    const done = await mutate(async () => {
      await request(`/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: commentBody.trim(), parentCommentId: replyParentId, mentions: commentMentions }),
      })
      return 'Comment added'
    })
    if (done) {
      setCommentBody('')
      setCommentMentions([])
      setReplyParentId(null)
      await reloadDetail(taskId)
    }
  }

  async function saveComment(commentId: string) {
    if (!detail) return
    if (!editingCommentBody.trim()) { setDetailError('Comment cannot be empty'); return }
    const taskId = detail._id
    const done = await mutate(async () => {
      await request(`/tasks/${taskId}/comments/${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ body: editingCommentBody.trim() }),
      })
      return 'Comment updated'
    })
    if (done) {
      setEditingCommentId('')
      setEditingCommentBody('')
      await reloadDetail(taskId)
    }
  }

  async function removeComment(commentId: string) {
    if (!detail) return
    if (!window.confirm('Delete this comment?')) return
    const taskId = detail._id
    const done = await mutate(async () => {
      await request(`/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' })
      return 'Comment deleted'
    })
    if (done) await reloadDetail(taskId)
  }

  async function createProject() {
    if (!projectForm.name.trim()) { setFormError('Project name is required'); return }
    const done = await mutate(async () => {
      await request('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: projectForm.name.trim(),
          key: projectForm.key.trim() ? projectForm.key.trim().toUpperCase() : undefined,
          description: projectForm.description,
          leadEmployeeId: projectForm.leadEmployeeId || null,
          members: projectForm.members,
          startDate: projectForm.startDate || null,
          dueDate: projectForm.dueDate || null,
        }),
      })
      return `Project ${projectForm.name.trim()} created`
    })
    if (done) { setProjectForm(emptyProjectForm); setDrawer(null) }
  }

  async function createTask() {
    if (!taskForm.projectId) { setFormError('Select a project before creating a task'); return }
    if (!taskForm.title.trim()) { setFormError('Task title is required'); return }
    const done = await mutate(async () => {
      await request('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          projectId: taskForm.projectId,
          title: taskForm.title.trim(),
          description: taskForm.description,
          assignedTo: taskForm.assignedTo || null,
          priority: taskForm.priority,
          labels: parseLabels(taskForm.labels),
          storyPoints: taskForm.storyPoints === '' ? null : Number(taskForm.storyPoints),
          startDate: taskForm.startDate || null,
          dueDate: taskForm.dueDate || null,
        }),
      })
      return `Task ${taskForm.title.trim()} created`
    })
    if (done) {
      setProjectId(taskForm.projectId)
      setTaskForm({ ...emptyTaskForm, projectId: taskForm.projectId })
      setDrawer(null)
    }
  }

  async function archiveProject(project: ProjectRecord) {
    if (!window.confirm(`Archive project ${project.key}?`)) return
    await mutate(async () => {
      try {
        await request(`/projects/${project._id}`, { method: 'DELETE' })
      } catch (failure) {
        const conflict = failure instanceof ApiError && failure.status === 409
        if (!conflict) throw failure
        const message = failure instanceof Error ? failure.message : 'Project still has unfinished tasks'
        if (!window.confirm(`${message}. Archive anyway?`)) throw failure
        await request(`/projects/${project._id}?force=true`, { method: 'DELETE' })
      }
      return `Project ${project.key} archived`
    })
  }

  function openCreateTask() {
    setFormError('')
    setTaskForm({ ...emptyTaskForm, projectId: projectId || projects[0]?._id || '' })
    setDrawer('create-task')
  }

  function openCreateProject() {
    setFormError('')
    setProjectForm(emptyProjectForm)
    setDrawer('create-project')
  }

  function renderCard(task: TaskRecord, column: BoardColumn, columnTasks: TaskRecord[]): ReactNode {
    const moveOptions: Option[] = columns
      .filter((entry) => entry.id !== column.id)
      .map((entry) => ({ value: entry.id, label: entry.name }))
    return (
      <article
        key={task._id}
        draggable={!busy}
        onDragStart={(event) => onCardDragStart(event, task._id)}
        onDragEnd={() => setDragTaskId('')}
        onDragOver={allowDrop}
        onDrop={(event) => dropOnCard(event, column.id, columnTasks, task)}
        className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-opacity ${dragTaskId === task._id ? 'opacity-50' : ''}`}
      >
        <div className="flex items-start gap-2">
          <button
            type="button" onClick={() => void openTask(task._id)}
            className="min-w-0 flex-1 text-left"
            aria-label={`Open task ${task.key || task.title}`}
          >
            <span className="text-xs font-bold text-primary-700">{task.key || 'TASK'}</span>
            <p className="mt-0.5 break-words text-sm font-semibold text-slate-800">{task.title}</p>
          </button>
          <GripVertical aria-hidden className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-slate-300" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge tone={PRIORITY_TONE[task.priority] || 'neutral'}>{task.priority || 'medium'}</Badge>
          <span className="truncate">{personName(task.assignee)}</span>
          <span>Due {formatDate(task.dueDate)}</span>
        </div>
        {moveOptions.length > 0 && (
          <div className="mt-2">
            <label htmlFor={`move-${task._id}`} className="text-xs font-semibold text-slate-500">Move to</label>
            <div className="mt-1">
              <SearchableSelect
                id={`move-${task._id}`} options={moveOptions} value="" disabled={busy}
                placeholder="Search columns" emptyLabel={`In ${column.name}`}
                onChange={(next) => { if (next && next !== column.id) void moveTask(task._id, next) }}
              />
            </div>
          </div>
        )}
      </article>
    )
  }

  function renderBoard(): ReactNode {
    if (!hasProjects) {
      return (
        <EmptyState
          label="Create a project to start planning work"
          hint="Tasks always belong to a project, so the board and task creation stay locked until the first project exists."
          action={<button type="button" onClick={openCreateProject} className="neu-button rounded-md px-3 py-2 text-sm font-semibold">Create project</button>}
        />
      )
    }
    if (boardLoading && !board) return <Spinner label="Loading board" />
    if (!board || !board.columns.length) {
      return <EmptyState label="This project has no board columns" hint="Add board columns to the project to organise tasks." />
    }
    return (
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="flex min-w-full gap-3">
          {board.columns.map((entry) => (
            <section
              key={entry.column.id}
              onDragOver={allowDrop}
              onDrop={(event) => dropOnColumn(event, entry.column.id, entry.tasks)}
              className="flex w-72 shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-50/70 p-3"
              aria-label={`${entry.column.name} column`}
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <h3 className="truncate text-sm font-bold text-slate-700">{entry.column.name}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                  {entry.tasks.length}
                </span>
              </header>
              <div className="flex min-h-24 flex-col gap-2">
                {entry.tasks.length === 0
                  ? <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">Drop tasks here</p>
                  : entry.tasks.map((task) => renderCard(task, entry.column, entry.tasks))}
              </div>
            </section>
          ))}
        </div>
      </div>
    )
  }

  function renderTasks(): ReactNode {
    if (!hasProjects) {
      return (
        <EmptyState
          label="No projects yet"
          hint="Create a project first, then tasks can be created and tracked here."
          action={<button type="button" onClick={openCreateProject} className="neu-button rounded-md px-3 py-2 text-sm font-semibold">Create project</button>}
        />
      )
    }
    const rows: ReactNode[][] = tasks.map((task) => [
      <button
        key={`title-${task._id}`} type="button" onClick={() => void openTask(task._id)}
        className="block w-full text-left"
      >
        <span className="text-xs font-bold text-primary-700">{task.key || 'TASK'}</span>
        <span className="block break-words font-semibold text-slate-800">{task.title}</span>
      </button>,
      task.project?.name || projects.find((project) => project._id === task.projectId)?.name || '-',
      personName(task.assignee),
      <Badge key={`priority-${task._id}`} tone={PRIORITY_TONE[task.priority] || 'neutral'}>{task.priority || 'medium'}</Badge>,
      <Badge key={`status-${task._id}`}>{task.status}</Badge>,
      formatDate(task.dueDate),
    ])
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Status">
            <SearchableSelect
              options={statusOptions} value={statusFilter} onChange={setStatusFilter}
              allowEmpty emptyLabel="All statuses" placeholder="Search statuses"
            />
          </Field>
          <Field label="Assignee">
            <SearchableSelect
              options={employeeOptions} value={assigneeFilter} onChange={setAssigneeFilter}
              allowEmpty emptyLabel="All assignees" placeholder="Search employees"
            />
          </Field>
          <Field label="Priority">
            <SearchableSelect
              options={PRIORITY_OPTIONS} value={priorityFilter} onChange={setPriorityFilter}
              allowEmpty emptyLabel="All priorities" placeholder="Search priorities"
            />
          </Field>
        </div>
        {tasksLoading ? <Spinner label="Loading tasks" /> : (
          <DataTable
            headers={['Task', 'Project', 'Assignee', 'Priority', 'Status', 'Due']}
            rows={rows}
            searchable
            searchPlaceholder="Search tasks"
            empty="No tasks match the current filters"
            emptyHint="Adjust the filters or create a new task."
          />
        )}
      </div>
    )
  }

  function renderProjects(): ReactNode {
    const rows: ReactNode[][] = projects.map((project) => [
      <span key={`key-${project._id}`} className="font-bold text-primary-700">{project.key}</span>,
      <div key={`name-${project._id}`} className="min-w-0">
        <p className="font-semibold text-slate-800">{project.name}</p>
        {project.description && <p className="mt-0.5 break-words text-xs text-slate-500">{project.description}</p>}
      </div>,
      project.lead ? personName(project.lead) : (project.leadEmployeeId ? employeeNameById.get(project.leadEmployeeId) || '-' : '-'),
      String(project.taskCounter || 0),
      <Badge key={`status-${project._id}`}>{project.status}</Badge>,
      <div key={`actions-${project._id}`} className="flex flex-wrap gap-2">
        <button
          type="button" onClick={() => { setProjectId(project._id); setTab('board') }}
          className="neu-button rounded-md px-2.5 py-1.5 text-xs font-semibold"
        >
          Open board
        </button>
        <button
          type="button" onClick={() => void archiveProject(project)} disabled={busy || !canArchiveProject}
          title={canArchiveProject ? 'Archive project' : 'Only admins can archive projects'}
          className="neu-button flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Archive className="h-3.5 w-3.5" /> Archive
        </button>
      </div>,
    ])
    return projectsLoading ? <Spinner label="Loading projects" /> : (
      <DataTable
        headers={['Key', 'Name', 'Lead', 'Tasks', 'Status', 'Actions']}
        rows={rows}
        searchable
        searchPlaceholder="Search projects"
        empty="No projects yet"
        emptyHint="Projects group tasks, boards, and members. Create the first one to get started."
        toolbar={(
          <button type="button" onClick={openCreateProject} disabled={busy} className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50">
            <Plus className="h-4 w-4" /> New project
          </button>
        )}
      />
    )
  }

  function canManageComment(comment: TaskComment): boolean {
    if (role === 'admin') return true
    if (!currentUserId) return true
    return comment.employeeId === currentUserId || comment.author?._id === currentUserId
  }

  function renderComment(comment: TaskComment, isReply: boolean): ReactNode {
    const editing = editingCommentId === comment._id
    return (
      <div key={comment._id} className={`rounded-lg border border-slate-200 bg-white p-3 ${isReply ? 'ml-6' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">{personName(comment.author)}</p>
          <p className="text-xs text-slate-500">
            {formatDateTime(comment.createdAt)}{comment.editedAt ? ' · edited' : ''}
          </p>
        </div>
        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={editingCommentBody} onChange={(event) => setEditingCommentBody(event.target.value)}
              rows={3} aria-label="Edit comment" className={fieldClass}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => void saveComment(comment._id)} disabled={busy} className="neu-button rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Save</button>
              <button type="button" onClick={() => { setEditingCommentId(''); setEditingCommentBody('') }} className="neu-button rounded-md px-3 py-1.5 text-xs font-semibold">Cancel</button>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-700">{comment.body}</p>
        )}
        {(comment.mentionRefs && comment.mentionRefs.length > 0) && (
          <p className="mt-1.5 text-xs text-slate-500">
            Mentioned: {comment.mentionRefs.map((person) => personName(person)).join(', ')}
          </p>
        )}
        {!editing && (
          <div className="mt-2 flex flex-wrap gap-2">
            {!isReply && (
              <button
                type="button"
                onClick={() => { setReplyParentId(comment._id); setCommentBody('') }}
                className="flex items-center gap-1 text-xs font-semibold text-primary-700"
              >
                <Reply className="h-3.5 w-3.5" /> Reply
              </button>
            )}
            {canManageComment(comment) && (
              <>
                <button
                  type="button"
                  onClick={() => { setEditingCommentId(comment._id); setEditingCommentBody(comment.body) }}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  type="button" onClick={() => void removeComment(comment._id)} disabled={busy}
                  className="flex items-center gap-1 text-xs font-semibold text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderTaskDrawer(): ReactNode {
    const detailColumns = detail
      ? (projects.find((project) => project._id === detail.projectId)?.boardColumns || columns)
      : columns
    const detailStatusOptions: Option[] = detailColumns.map((column) => ({ value: column.id, label: column.name }))
    const allComments = detail?.comments || []
    const threads = allComments
      .filter((comment) => !comment.parentCommentId || !allComments.some((parent) => parent._id === comment.parentCommentId))
      .map((comment) => ({ comment, replies: allComments.filter((reply) => reply.parentCommentId === comment._id) }))
    const watching = Boolean(currentUserId && (detail?.watchers || []).includes(currentUserId))

    return (
      <Drawer
        wide
        title={detail ? `${detail.key || 'Task'} · ${detail.title}` : 'Task'}
        subtitle={detail?.project ? `${detail.project.key} · ${detail.project.name}` : undefined}
        close={() => { setDrawer(null); setDetail(null); setDetailError('') }}
        footer={detail ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button" onClick={() => void deleteTask()} disabled={busy}
              className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Delete task
            </button>
            <button
              type="button" onClick={() => void saveTaskEdits()} disabled={busy}
              className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
            </button>
          </div>
        ) : undefined}
      >
        <div className="space-y-4">
          {detailError && <Banner tone="error" message={detailError} onDismiss={() => setDetailError('')} />}
          {detailLoading && <Spinner label="Loading task" />}
          {detail && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button" onClick={() => void toggleWatch(watching)} disabled={busy}
                  className="neu-button flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {watching ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                  {watching ? 'Stop watching' : 'Watch task'}
                </button>
                <span className="text-xs text-slate-500">
                  {(detail.watcherRefs || []).length || (detail.watchers || []).length} watcher(s) · Reporter {personName(detail.reporter)}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Title" required>
                    <input
                      value={taskEdit.title} onChange={(event) => setTaskEdit({ ...taskEdit, title: event.target.value })}
                      className={fieldClass} aria-label="Task title"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Description">
                    <textarea
                      value={taskEdit.description} onChange={(event) => setTaskEdit({ ...taskEdit, description: event.target.value })}
                      rows={4} className={fieldClass} aria-label="Task description"
                    />
                  </Field>
                </div>
                <Field label="Assignee">
                  <SearchableSelect
                    options={employeeOptions} value={taskEdit.assignedTo}
                    onChange={(value) => setTaskEdit({ ...taskEdit, assignedTo: value })}
                    allowEmpty emptyLabel="Unassigned" placeholder="Search employees"
                  />
                </Field>
                <Field label="Status">
                  <SearchableSelect
                    options={detailStatusOptions} value={taskEdit.status}
                    onChange={(value) => setTaskEdit({ ...taskEdit, status: value })}
                    placeholder="Search statuses" required
                  />
                </Field>
                <Field label="Priority">
                  <SearchableSelect
                    options={PRIORITY_OPTIONS} value={taskEdit.priority}
                    onChange={(value) => setTaskEdit({ ...taskEdit, priority: value })}
                    placeholder="Search priorities" required
                  />
                </Field>
                <Field label="Story points">
                  <input
                    type="number" min={0} step={0.5} value={taskEdit.storyPoints}
                    onChange={(event) => setTaskEdit({ ...taskEdit, storyPoints: event.target.value })}
                    className={fieldClass} aria-label="Story points"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Labels" hint="Comma separated, for example: backend, api">
                    <input
                      value={taskEdit.labels} onChange={(event) => setTaskEdit({ ...taskEdit, labels: event.target.value })}
                      className={fieldClass} aria-label="Labels"
                    />
                  </Field>
                </div>
                <Field label="Start date">
                  <input
                    type="date" value={taskEdit.startDate}
                    onChange={(event) => setTaskEdit({ ...taskEdit, startDate: event.target.value })}
                    className={fieldClass} aria-label="Start date"
                  />
                </Field>
                <Field label="Due date">
                  <input
                    type="date" value={taskEdit.dueDate}
                    onChange={(event) => setTaskEdit({ ...taskEdit, dueDate: event.target.value })}
                    className={fieldClass} aria-label="Due date"
                  />
                </Field>
              </div>

              <section aria-label="Comments" className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <MessageSquare className="h-4 w-4" /> Comments ({allComments.length})
                </h3>
                {threads.length === 0
                  ? <EmptyState label="No comments yet" hint="Start the conversation with the first comment." />
                  : (
                    <div className="space-y-3">
                      {threads.map((thread) => (
                        <div key={thread.comment._id} className="space-y-2">
                          {renderComment(thread.comment, false)}
                          {thread.replies.map((reply) => renderComment(reply, true))}
                        </div>
                      ))}
                    </div>
                  )}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  {replyParentId && (
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                      Replying to a comment
                      <button type="button" onClick={() => setReplyParentId(null)} className="text-primary-700">Cancel reply</button>
                    </p>
                  )}
                  <textarea
                    value={commentBody} onChange={(event) => setCommentBody(event.target.value)}
                    rows={3} placeholder="Write a comment" aria-label="New comment" className={fieldClass}
                  />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Field label="Mention someone">
                      <SearchableSelect
                        options={employeeOptions.filter((option) => !commentMentions.includes(option.value))}
                        value="" placeholder="Search employees" emptyLabel="Add mention"
                        onChange={(value) => { if (value) setCommentMentions([...commentMentions, value]) }}
                      />
                    </Field>
                    <div className="flex flex-wrap items-end gap-2">
                      {commentMentions.map((mention) => (
                        <span key={mention} className="flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
                          {employeeNameById.get(mention) || mention}
                          <button
                            type="button" aria-label={`Remove mention ${employeeNameById.get(mention) || mention}`}
                            onClick={() => setCommentMentions(commentMentions.filter((id) => id !== mention))}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button" onClick={() => void addComment()} disabled={busy}
                    className="neu-button mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Add comment
                  </button>
                </div>
              </section>

              <section aria-label="Activity" className="space-y-2">
                <h3 className="text-sm font-bold text-slate-700">Activity</h3>
                {(detail.activity || []).length === 0
                  ? <EmptyState label="No activity recorded yet" />
                  : (
                    <ul className="space-y-2">
                      {[...(detail.activity || [])].reverse().map((entry, index) => (
                        <li key={entry._id || `${entry.field}-${index}`} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">{entry.actorName || 'Someone'}</span>
                          {' changed '}
                          <span className="font-semibold">{humanize(entry.field)}</span>
                          {' from '}
                          <span className="font-semibold">{describeValue(entry.from)}</span>
                          {' to '}
                          <span className="font-semibold">{describeValue(entry.to)}</span>
                          <span className="ml-1 text-slate-400">· {formatDateTime(entry.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
              </section>
            </>
          )}
        </div>
      </Drawer>
    )
  }

  function renderCreateTaskDrawer(): ReactNode {
    return (
      <Drawer
        title="New task"
        subtitle="Tasks must belong to a project"
        close={() => { setDrawer(null); setFormError('') }}
        footer={(
          <button
            type="button" onClick={() => void createTask()} disabled={busy || !canCreateTask}
            className="neu-button flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create task
          </button>
        )}
      >
        <div className="space-y-3">
          {formError && <Banner tone="error" message={formError} onDismiss={() => setFormError('')} />}
          <Field label="Project" required hint="The backend rejects tasks without a project.">
            <SearchableSelect
              options={projectOptions} value={taskForm.projectId} required disabled={!canCreateTask}
              onChange={(value) => setTaskForm({ ...taskForm, projectId: value })}
              placeholder="Search projects"
            />
          </Field>
          <Field label="Title" required>
            <input
              value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })}
              className={fieldClass} aria-label="Task title" placeholder="Short summary of the work"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })}
              rows={4} className={fieldClass} aria-label="Task description"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Assignee">
              <SearchableSelect
                options={employeeOptions} value={taskForm.assignedTo}
                onChange={(value) => setTaskForm({ ...taskForm, assignedTo: value })}
                allowEmpty emptyLabel="Unassigned" placeholder="Search employees"
              />
            </Field>
            <Field label="Priority">
              <SearchableSelect
                options={PRIORITY_OPTIONS} value={taskForm.priority} required
                onChange={(value) => setTaskForm({ ...taskForm, priority: value })}
                placeholder="Search priorities"
              />
            </Field>
            <Field label="Story points">
              <input
                type="number" min={0} step={0.5} value={taskForm.storyPoints}
                onChange={(event) => setTaskForm({ ...taskForm, storyPoints: event.target.value })}
                className={fieldClass} aria-label="Story points"
              />
            </Field>
            <Field label="Labels" hint="Comma separated">
              <input
                value={taskForm.labels} onChange={(event) => setTaskForm({ ...taskForm, labels: event.target.value })}
                className={fieldClass} aria-label="Labels"
              />
            </Field>
            <Field label="Start date">
              <input
                type="date" value={taskForm.startDate}
                onChange={(event) => setTaskForm({ ...taskForm, startDate: event.target.value })}
                className={fieldClass} aria-label="Start date"
              />
            </Field>
            <Field label="Due date">
              <input
                type="date" value={taskForm.dueDate}
                onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })}
                className={fieldClass} aria-label="Due date"
              />
            </Field>
          </div>
        </div>
      </Drawer>
    )
  }

  function renderCreateProjectDrawer(): ReactNode {
    return (
      <Drawer
        title="New project"
        subtitle="Projects hold the board columns tasks move through"
        close={() => { setDrawer(null); setFormError('') }}
        footer={(
          <button
            type="button" onClick={() => void createProject()} disabled={busy}
            className="neu-button flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create project
          </button>
        )}
      >
        <div className="space-y-3">
          {formError && <Banner tone="error" message={formError} onDismiss={() => setFormError('')} />}
          <Field label="Name" required>
            <input
              value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}
              className={fieldClass} aria-label="Project name" placeholder="Website revamp"
            />
          </Field>
          <Field label="Key" hint="2-10 letters or numbers. Left blank, the server derives one.">
            <input
              value={projectForm.key} onChange={(event) => setProjectForm({ ...projectForm, key: event.target.value.toUpperCase() })}
              className={fieldClass} aria-label="Project key" placeholder="WEB" maxLength={10}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })}
              rows={3} className={fieldClass} aria-label="Project description"
            />
          </Field>
          <Field label="Project lead">
            <SearchableSelect
              options={employeeOptions} value={projectForm.leadEmployeeId}
              onChange={(value) => setProjectForm({ ...projectForm, leadEmployeeId: value })}
              allowEmpty emptyLabel="No lead" placeholder="Search employees"
            />
          </Field>
          <Field label="Members">
            <SearchableSelect
              options={employeeOptions.filter((option) => !projectForm.members.includes(option.value))}
              value="" placeholder="Search employees" emptyLabel="Add member"
              onChange={(value) => { if (value) setProjectForm({ ...projectForm, members: [...projectForm.members, value] }) }}
            />
          </Field>
          {projectForm.members.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {projectForm.members.map((member) => (
                <span key={member} className="flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
                  {employeeNameById.get(member) || member}
                  <button
                    type="button" aria-label={`Remove member ${employeeNameById.get(member) || member}`}
                    onClick={() => setProjectForm({ ...projectForm, members: projectForm.members.filter((id) => id !== member) })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start date">
              <input
                type="date" value={projectForm.startDate}
                onChange={(event) => setProjectForm({ ...projectForm, startDate: event.target.value })}
                className={fieldClass} aria-label="Project start date"
              />
            </Field>
            <Field label="Due date">
              <input
                type="date" value={projectForm.dueDate}
                onChange={(event) => setProjectForm({ ...projectForm, dueDate: event.target.value })}
                className={fieldClass} aria-label="Project due date"
              />
            </Field>
          </div>
        </div>
      </Drawer>
    )
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Projects & tasks"
        description="Plan work on a board, track every task, and manage projects for your company."
        actions={(
          <>
            <button
              type="button" onClick={() => setReloadKey((key) => key + 1)} disabled={busy}
              className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${busy || boardLoading || tasksLoading || projectsLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              type="button" onClick={openCreateTask} disabled={busy || !canCreateTask}
              title={canCreateTask ? 'Create a task' : 'Create a project first'}
              className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> New task
            </button>
            <button
              type="button" onClick={openCreateProject} disabled={busy}
              className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> New project
            </button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:max-w-md">
            <Field label="Project" hint={hasProjects ? 'Board and task filters follow this project.' : 'No projects exist yet.'}>
              <SearchableSelect
                options={projectOptions} value={projectId} onChange={setProjectId}
                disabled={!hasProjects} placeholder="Search projects" emptyLabel="No project selected"
              />
            </Field>
          </div>

          {!hasProjects && !projectsLoading && (
            <EmptyState
              label="Create a project before adding tasks"
              hint="Every task needs a project, so task creation stays disabled until one exists."
              action={(
                <button type="button" onClick={openCreateProject} className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold">
                  <Plus className="h-4 w-4" /> Create project
                </button>
              )}
            />
          )}

          {error && <Banner tone="error" message={error} onDismiss={() => setError('')} />}
          {notice && <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />}

          <TabBar
            tabs={[
              { key: 'board', label: 'Board', count: board ? board.columns.reduce((total, entry) => total + entry.tasks.length, 0) : undefined },
              { key: 'tasks', label: 'All tasks', count: tasks.length },
              { key: 'projects', label: 'Projects', count: projects.length },
            ]}
            value={tab}
            onChange={setTab}
          />

          <div>
            {tab === 'board' && renderBoard()}
            {tab === 'tasks' && renderTasks()}
            {tab === 'projects' && renderProjects()}
          </div>
        </div>
      </SectionCard>

      {drawer === 'task' && renderTaskDrawer()}
      {drawer === 'create-task' && renderCreateTaskDrawer()}
      {drawer === 'create-project' && renderCreateProjectDrawer()}
    </div>
  )
}
