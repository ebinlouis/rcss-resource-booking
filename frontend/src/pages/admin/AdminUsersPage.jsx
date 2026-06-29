import Tooltip from '../../components/Tooltip'
import PageInfo from '../../components/PageInfo'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import adminUserService from '../../api/adminUserService'

// ─────────────────────────────────────────────────────────────
// Helpers (unchanged)
// ─────────────────────────────────────────────────────────────

const getUserName = (user) => {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return name || user.email
}

const normalizeList = (data) => Array.isArray(data) ? data : data?.results ?? []

const PAGE_SIZE = 10

const ROLE_COLOR = {
  FACULTY:        'bg-blue-50 text-blue-700 border-blue-200',
  STAFF:          'bg-slate-50 text-slate-700 border-slate-200',
  STUDENT:        'bg-violet-50 text-violet-700 border-violet-200',
  RECEPTIONIST:   'bg-sky-50 text-sky-700 border-sky-200',
  LAB_INCHARGE:   'bg-indigo-50 text-indigo-700 border-indigo-200',
  LIBRARIAN:      'bg-rose-50 text-rose-700 border-rose-200',
  HOD:            'bg-amber-50 text-amber-700 border-amber-200',
  IT_ADMIN:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  MEDIA_INCHARGE: 'bg-purple-50 text-purple-700 border-purple-200',
  FLEET_MANAGER:  'bg-orange-50 text-orange-700 border-orange-200',
  MESS_MANAGER:   'bg-teal-50 text-teal-700 border-teal-200',
}

const USER_TYPE_FILTERS = [
  { key: 'ALL',     label: 'All Users' },
  { key: 'FACULTY', label: 'Faculty' },
  { key: 'STAFF',   label: 'Staff' },
  { key: 'STUDENT', label: 'Students' },
]

const RESPONSIBILITY_FILTERS = [
  { key: 'HOD',           label: 'HOD' },
  { key: 'RECEPTIONIST',  label: 'Receptionist' },
  { key: 'LAB_INCHARGE',  label: 'Lab In-Charge' },
  { key: 'LIBRARIAN',     label: 'Librarian' },
  { key: 'MEDIA_INCHARGE',label: 'Media In-Charge' },
  { key: 'FLEET_MANAGER', label: 'Transport Manager' },
  { key: 'MESS_MANAGER',  label: 'Mess Manager' },
]

// ─────────────────────────────────────────────────────────────
// Sub-components (unchanged)
// ─────────────────────────────────────────────────────────────

function Avatar({ name, photo }) {
  const initials = (name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
  if (photo) return <img src={photo} alt={name} className="w-10 h-10 rounded-full object-cover ring-2 ring-[#e8f5ee] shrink-0" />
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#15803d] to-[#059669] text-white flex items-center justify-center text-[13px] font-bold ring-2 ring-[#e8f5ee] shrink-0">
      {initials}
    </div>
  )
}

function RoleBadge({ role }) {
  const color = ROLE_COLOR[role.name] ?? 'bg-gray-50 text-gray-600 border-gray-200'
  const displayName = role.name === 'FLEET_MANAGER' ? 'Transport Manager' : (role.display_name || role.name)
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${color}`}>
      {displayName}
    </span>
  )
}

function getRoleDescription(roleName) {
  const descriptions = {
    STUDENT: "Standard booking requester access.",
    FACULTY: "In-charge of student requests and schedules venues.",
    STAFF: "Requests resources and coordinates events.",
    RECEPTIONIST: "Manages front desk check-ins and spaces.",
    LAB_INCHARGE: "Approves laboratory and resource use.",
    LIBRARIAN: "Manages library halls and study spaces.",
    MESS_MANAGER: "Catering services and meal approvals.",
    MEDIA_INCHARGE: "Media team and equipment scheduling.",
    FLEET_MANAGER: "Vehicle scheduling and transport manager.",
    IT_ADMIN: "Global system configuration and administration.",
    HOD: "Departmental academic and resource permissions.",
    PRINCIPAL: "Ultimate institutional oversight and approvals."
  }
  return descriptions[roleName.toUpperCase()] || ""
}

// ─────────────────────────────────────────────────────────────
// Edit Roles Modal (improved responsiveness)
// ─────────────────────────────────────────────────────────────

function UserRoleModal({ user, roles, onClose, onSave, isSaving }) {
  const [selectedRoles, setSelectedRoles] = useState(() =>
    (user.roles || []).map((roleId) => Number(roleId))
  )

  const roleGroups = useMemo(() => {
    const scoped = new Set(['RECEPTIONIST', 'LAB_INCHARGE', 'LIBRARIAN'])
    const system = new Set(['IT_ADMIN'])
    const module = new Set(['MESS_MANAGER', 'MEDIA_INCHARGE', 'FLEET_MANAGER'])
    return [
      { title: 'User Type', items: roles.filter((r) => ['STUDENT', 'FACULTY', 'STAFF'].includes(r.name)) },
      { title: 'Venue Responsibilities', items: roles.filter((r) => scoped.has(r.name)) },
      { title: 'Module Managers', items: roles.filter((r) => module.has(r.name)) },
      { title: 'Institution Roles', items: roles.filter((r) => ['HOD', 'PRINCIPAL'].includes(r.name) || system.has(r.name)) },
    ].filter((g) => g.items.length > 0)
  }, [roles])

  const toggleRole = (roleId) =>
    setSelectedRoles((cur) => cur.includes(roleId) ? cur.filter((id) => id !== roleId) : [...cur, roleId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-green-100 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-green-100 px-6 py-5">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-green-700">Manage User Roles</p>
            <h2 className="mt-1 text-[20px] font-bold text-gray-950">{getUserName(user)}</h2>
            <p className="mt-1 text-[14px] text-gray-500">{user.email}</p>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[62vh] space-y-5 overflow-y-auto px-6 py-5">
          {roleGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.1em] text-gray-500">{group.title}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {group.items.map((role) => {
                  const isChecked = selectedRoles.includes(role.id)
                  return (
                    <label key={role.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${isChecked ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white hover:border-green-100 hover:bg-green-50/40'}`}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleRole(role.id)}
                        className="mt-1 h-4 w-4 accent-green-700" />
                      <span>
                        <span className="block text-[14.5px] font-bold text-gray-950">
                          {role.name === 'FLEET_MANAGER' ? 'Transport Manager' : (role.display_name || role.name)}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] font-medium text-gray-500">{getRoleDescription(role.name)}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 border-t border-green-100 px-6 py-5">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-[14px] font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={() => onSave(user.id, selectedRoles)} disabled={isSaving}
            className="rounded-xl bg-green-700 px-5 py-2.5 text-[14px] font-bold text-white transition hover:bg-green-800 disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Page (IMPROVED LAYOUT)
// ─────────────────────────────────────────────────────────────

function AdminUsersPage() {
  const navigate  = useNavigate()
  const location  = useLocation()

  const [allUsers, setAllUsers]       = useState([])
  const [totalCount, setTotalCount]   = useState(null)
  const [roles, setRoles]             = useState([])
  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState('ALL')
  const [respFilter, setRespFilter]   = useState('')
  const [sortBy, setSortBy]           = useState('')
  const [page, setPage]               = useState(1)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isLoading, setIsLoading]     = useState(true)
  const [isSaving, setIsSaving]       = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    if (location.state?.editUserId && allUsers.length > 0) {
      const u = allUsers.find(x => String(x.id) === String(location.state.editUserId))
      if (u) {
        setSelectedUser(u)
        navigate(location.pathname, { replace: true, state: {} })
      }
    }
  }, [location.state, allUsers, navigate, location.pathname])

  useEffect(() => { setPage(1) }, [search, typeFilter, respFilter, sortBy])

  useEffect(() => {
    adminUserService.getRoles()
      .then(data => setRoles(normalizeList(data)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let isMounted = true
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const params = { page, page_size: PAGE_SIZE }
        if (search.trim()) params.q = search.trim()
        if (typeFilter !== 'ALL') params.role = typeFilter
        if (respFilter) params.role = respFilter
        const data = await adminUserService.getUsers(params)
        if (isMounted) {
          setAllUsers(normalizeList(data))
          setTotalCount(typeof data?.count === 'number' ? data.count : null)
          setError('')
        }
      } catch {
        if (isMounted) setError('Could not load users. Please try again.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }, 250)
    return () => { isMounted = false; clearTimeout(timer) }
  }, [search, typeFilter, respFilter, page])

  const handleSaveRoles = async (userId, roleIds) => {
    setIsSaving(true)
    setError('')
    try {
      const updated = await adminUserService.setRoles(userId, roleIds)
      setAllUsers((cur) => cur.map((u) => u.id === userId ? updated : u))
      setSelectedUser(null)
    } catch (err) {
      setError(err.response?.data?.roles || 'Could not update user roles. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const stats = useMemo(() => {
    const count = totalCount ?? allUsers.length
    const faculty  = allUsers.filter(u => u.role_details?.some(r => r.name === 'FACULTY')).length
    const staff    = allUsers.filter(u => u.role_details?.some(r => r.name === 'STAFF')).length
    const students = allUsers.filter(u => u.role_details?.some(r => r.name === 'STUDENT')).length
    return { count, faculty, staff, students }
  }, [allUsers, totalCount])

  const sortedUsers = useMemo(() => {
    if (!sortBy) return allUsers
    const sorted = [...allUsers]
    sorted.sort((a, b) => {
      const deptA = a.department_name || ''
      const deptB = b.department_name || ''
      if (sortBy === 'dept_asc') {
        return deptA.localeCompare(deptB)
      } else if (sortBy === 'dept_desc') {
        return deptB.localeCompare(deptA)
      }
      return 0
    })
    return sorted
  }, [allUsers, sortBy])

  const totalPages = totalCount !== null ? Math.ceil(totalCount / PAGE_SIZE) : 1
  const showFrom   = (page - 1) * PAGE_SIZE + 1
  const showTo     = Math.min(page * PAGE_SIZE, totalCount ?? allUsers.length)

  const paginationRange = (() => {
    const range = []
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) range.push(p)
      else if (range[range.length - 1] !== '…') range.push('…')
    }
    return range
  })()

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      {selectedUser && (
        <UserRoleModal
          user={selectedUser}
          roles={roles}
          onClose={() => setSelectedUser(null)}
          onSave={handleSaveRoles}
          isSaving={isSaving}
        />
      )}

      {/* ═══ Page header ═══ */}
      <div className="mb-8">
        <p className="mb-1 text-[11.5px] font-bold uppercase tracking-[0.12em] text-green-700">
          Rajagiri College · IT Admin
        </p>
        <div className="flex items-center gap-2">
          <h1 className="text-[28px] font-bold tracking-tight text-gray-950">User Management</h1>
          <PageInfo text="View all registered users and assign or remove system roles." />
        </div>
        <p className="mt-2 text-[14.5px] text-gray-600">Manage user permissions, responsibilities, and venue assignments.</p>
      </div>

      {/* ═══ IMPROVED Stat cards ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Users',  value: stats.count,    icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z', color: 'bg-blue-50 text-blue-600 border-blue-200' },
          { label: 'Faculty',      value: stats.faculty,  icon: 'M12 14l9-5-9-5-9 5 9 5z',                                                  color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
          { label: 'Staff',        value: stats.staff,    icon: 'M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z',      color: 'bg-amber-50 text-amber-600 border-amber-200' },
          { label: 'Students',     value: stats.students, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', color: 'bg-violet-50 text-violet-600 border-violet-200' },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-[#e8f5ee] rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center border shrink-0 ${s.color}`}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
                <path d={s.icon} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#94a3b8] mb-1">{s.label}</p>
              <p className="text-[22px] font-black text-[#0f172a] leading-tight">
                {isLoading ? <span className="inline-block w-10 h-6 rounded bg-gray-200 animate-pulse" /> : s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ IMPROVED Search + Filter section ═══ */}
      <div className="bg-white rounded-xl border border-[#e8f5ee] px-5 py-4 mb-4 shadow-sm">
        {/* Search */}
        <div className="relative w-full mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, email, department, role…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-[14px] font-medium text-gray-800 outline-none transition focus:border-green-300 focus:ring-2 focus:ring-green-100"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* IMPROVED Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
          
          {/* User Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">User Type</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                setRespFilter('')
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-gray-700 outline-none transition focus:border-green-300 focus:ring-2 focus:ring-green-50 shadow-sm cursor-pointer"
            >
              {USER_TYPE_FILTERS.map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Responsibility Role */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">Role</label>
            <select
              value={respFilter}
              onChange={(e) => {
                setRespFilter(e.target.value)
                setTypeFilter('ALL')
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-gray-700 outline-none transition focus:border-green-300 focus:ring-2 focus:ring-green-50 shadow-sm cursor-pointer"
            >
              <option value="">All Roles</option>
              {RESPONSIBILITY_FILTERS.map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-gray-700 outline-none transition focus:border-green-300 focus:ring-2 focus:ring-green-50 shadow-sm cursor-pointer"
            >
              <option value="">Default</option>
              <option value="dept_asc">Department (A-Z)</option>
              <option value="dept_desc">Department (Z-A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* ═══ User list ═══ */}
      <div className="bg-white rounded-xl border border-[#e8f5ee] overflow-hidden shadow-sm">
        
        {/* Result count bar */}
        <div className="px-6 py-3 border-b border-[#f1f5f9] bg-[#fafafa]">
          {isLoading
            ? <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
            : <p className="text-[12px] font-semibold text-[#6b7280]">
                {search.trim()
                  ? <><span className="text-[#0f172a] font-bold">{totalCount ?? allUsers.length}</span> results for &ldquo;{search}&rdquo;</>
                  : <>Showing <span className="text-[#0f172a] font-bold">{totalCount ?? allUsers.length}</span> users</>
                }
              </p>
          }
        </div>

        {/* User rows */}
        <div className="divide-y divide-[#f1f5f9]">
          {isLoading ? (
            [1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
                  <div className="h-3 w-56 rounded bg-gray-100 animate-pulse" />
                </div>
                <div className="hidden sm:flex gap-2">
                  <div className="h-9 w-28 rounded-lg bg-gray-200 animate-pulse" />
                  <div className="h-9 w-28 rounded-lg bg-gray-200 animate-pulse" />
                </div>
              </div>
            ))
          ) : sortedUsers.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3 text-green-600">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              </div>
              <p className="text-[14px] font-bold text-gray-700">No users found</p>
              <p className="text-[12.5px] text-gray-400 mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            sortedUsers.map((user) => {
              const name = getUserName(user)
              const roles = user.role_details ?? []
              return (
                <div key={user.id} className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-4 hover:bg-green-50/30 transition group">
                  
                  {/* Avatar + identity */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar name={name} photo={user.profile_image} />
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => navigate(`/admin/users/${user.id}`, { state: { from: window.location.pathname + window.location.search, fromLabel: name + "'s Profile" } })}
                        className="text-[15px] font-bold text-gray-950 hover:text-green-700 transition truncate block text-left w-full"
                      >
                        {name}
                      </button>
                      <div className="flex flex-col sm:flex-row sm:gap-2 sm:items-baseline mt-0.5">
                        <p className="text-[12.5px] text-gray-500 truncate">{user.email}</p>
                        {user.department_name && (
                          <p className="text-[12px] text-gray-400 truncate">· {user.department_name}</p>
                        )}
                      </div>
                      
                      {/* Role badges */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {roles.length > 0
                          ? roles.map(r => <RoleBadge key={r.id} role={r} />)
                          : <span className="text-[11.5px] text-gray-400">No roles</span>
                        }
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => navigate(`/admin/users/${user.id}`, { state: { from: window.location.pathname + window.location.search, fromLabel: name + "'s Profile" } })}
                      className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg border border-[#e2e8f0] text-[12.5px] font-bold text-[#374151] bg-white hover:bg-gray-50 transition"
                    >
                      View Profile
                    </button>
                    <Tooltip text="Assign or remove system roles for this user." position="left">
                      <button
                        type="button"
                        onClick={() => setSelectedUser(user)}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-green-700 text-[12.5px] font-bold text-white hover:bg-green-800 transition"
                      >
                        Edit Roles
                      </button>
                    </Tooltip>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {!isLoading && totalCount !== null && totalCount > PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-[#f1f5f9] bg-[#fafafa]">
            <p className="text-[12px] text-[#6b7280] font-medium order-2 sm:order-1">
              Showing <span className="font-bold text-[#0f172a]">{showFrom}–{showTo}</span> of <span className="font-bold text-[#0f172a]">{totalCount}</span> users
            </p>
            <div className="flex items-center gap-1.5 order-1 sm:order-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-[12px] font-semibold text-[#374151] hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
                Previous
              </button>
              <div className="flex items-center gap-1">
                {paginationRange.map((p, i) =>
                  p === '…'
                    ? <span key={`e${i}`} className="px-1.5 text-[12px] text-[#94a3b8]">…</span>
                    : <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-[12px] font-bold border transition ${page === p ? 'bg-green-700 text-white border-green-700' : 'bg-white text-[#374151] border-[#e2e8f0] hover:bg-gray-50'}`}>
                        {p}
                      </button>
                )}
              </div>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-[12px] font-semibold text-[#374151] hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminUsersPage