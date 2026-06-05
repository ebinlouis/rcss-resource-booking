import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAdminSpacesCatalog, useAdminBlocks } from "../../hooks/useSpaceQueries"
import spaceAdminService from "../../api/spaceAdminService"
import roleOverrideService from "../../api/roleOverrideService"
import adminUserService from "../../api/adminUserService"
import { parseSpaceLocation } from "../../utils/spaceLocation"
import toast from "react-hot-toast"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

// Only roles that the backend serializer accepts as SpaceApprover roles
const SCOPED_APPROVER_ROLES = ["RECEPTIONIST", "LAB_INCHARGE", "LIBRARIAN"]

const ROLE_LABEL = {
  RECEPTIONIST: "Receptionist",
  LAB_INCHARGE: "Lab In-Charge",
  LIBRARIAN: "Librarian",
}

const normalise = (data) => Array.isArray(data) ? data : data?.results ?? []

// ─────────────────────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────────────────────

function Svg({ d, className = "w-5 h-5", strokeWidth = 2 }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <path d={d} />
    </svg>
  )
}

function Avatar({ name, photo }) {
  const initials = (name || "?").split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("")
  if (photo) {
    return <img src={photo} alt={name} className="w-11 h-11 rounded-full object-cover ring-2 ring-[#e8f5ee] shrink-0" />
  }
  return (
    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#15803d] to-[#059669] text-white
      flex items-center justify-center text-[13px] font-bold ring-2 ring-[#e8f5ee] shrink-0">
      {initials}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Confirmation Dialog
// ─────────────────────────────────────────────────────────────

function ConfirmDialog({ venueName, user, roleName, onCancel, onConfirm, isSubmitting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-[#f1f5f9] bg-[#f6fbf8]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#15803d] mb-1">Confirm Assignment</p>
          <h3 className="text-[18px] font-bold text-[#0f172a]">Assign Venue Manager</h3>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-[13.5px] text-[#6b7280]">
            You are about to assign a venue manager for:
          </p>

          {/* Venue row */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f0fdf4] border border-[#d1fae5]">
            <div className="w-8 h-8 rounded-lg bg-[#15803d]/10 flex items-center justify-center text-[#15803d]">
              <Svg d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 8h.01M15 8h.01M9 13h.01M15 13h.01" className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">Venue</p>
              <p className="text-[14px] font-bold text-[#0f172a]">{venueName}</p>
            </div>
          </div>

          {/* User row */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
            <Avatar name={user?.name || user?.first_name} photo={user?.profile_image} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">User</p>
              <p className="text-[14px] font-bold text-[#0f172a] truncate">
                {[user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email}
              </p>
              <p className="text-[12px] text-[#6b7280] truncate">{user?.email}</p>
            </div>
          </div>

          {/* Role row */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
              <Svg d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">Role</p>
              <p className="text-[14px] font-bold text-[#0f172a]">{roleName}</p>
            </div>
          </div>

          {/* Scope note */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
            <Svg d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[12px] text-blue-700 font-medium">
              Scope will be set to <strong>Venue Specific</strong> — this manager will only approve bookings for this venue.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-[#f9fafb] border-t border-[#f1f5f9]">
          <button onClick={onCancel} disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl border border-[#e2e8f0] text-[13.5px] font-semibold
              text-[#374151] hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-[13.5px]
              font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-2">
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Assigning…
              </>
            ) : "Confirm Assignment"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Success Banner
// ─────────────────────────────────────────────────────────────

function SuccessBanner({ venueName, userName, onDismiss, onAssignAnother }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-5 mb-6 flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
        <Svg d="M5 13l4 4L19 7" className="w-5 h-5" strokeWidth={2.5} />
      </div>
      <div className="flex-1">
        <p className="text-[15px] font-bold text-emerald-900">Venue Manager Assigned Successfully</p>
        <p className="text-[13px] text-emerald-700 mt-0.5">
          <strong>{userName}</strong> can now manage approvals for <strong>{venueName}</strong>.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={onAssignAnother}
          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-[12.5px] font-bold hover:bg-emerald-700 transition">
          Assign Another
        </button>
        <button onClick={onDismiss}
          className="px-3.5 py-1.5 rounded-xl border border-emerald-200 text-[12.5px] font-semibold text-emerald-800 hover:bg-emerald-100 transition">
          Done
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// User Row (in the search results table)
// ─────────────────────────────────────────────────────────────

function UserRow({ user, selectedRole, onAdd }) {
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email

  return (
    <tr className="hover:bg-[#f6fbf8] transition border-b border-[#f1f5f9] last:border-0">
      {/* User info */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={displayName} photo={user.profile_image} />
          <div>
            <p className="text-[14.5px] font-bold text-[#0f172a]">{displayName}</p>
            <p className="text-[12.5px] text-[#6b7280]">{user.email}</p>
            {user.employee_student_id && (
              <p className="text-[11.5px] text-[#94a3b8]">ID: {user.employee_student_id}</p>
            )}
          </div>
        </div>
      </td>

      {/* Department */}
      <td className="px-5 py-4 text-[13.5px] font-semibold text-[#374151]">
        {user.department_name || "—"}
      </td>

      {/* Current roles */}
      <td className="px-5 py-4">
        <div className="flex flex-wrap gap-1.5">
          {user.role_details?.length > 0
            ? user.role_details.map(r => (
              <span key={r.id}
                className="inline-flex px-2 py-0.5 rounded-full bg-[#f0fdf4] text-[11px] font-bold text-[#15803d] border border-[#d1fae5]">
                {r.display_name || r.name}
              </span>
            ))
            : <span className="text-[12.5px] text-[#94a3b8]">No roles</span>
          }
        </div>
      </td>

      {/* Add button */}
      <td className="px-5 py-4 text-right">
        <button
          onClick={() => onAdd(user)}
          disabled={!selectedRole}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#15803d]
            hover:bg-[#166534] text-white text-[13px] font-bold transition
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Svg d="M12 4v16m8-8H4" className="w-3.5 h-3.5" strokeWidth={2.5} />
          Add
        </button>
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function VenueManagerAssignPage() {
  const { venueId } = useParams()
  const navigate = useNavigate()

  // ── Data ──────────────────────────────────────────────────────
  const { data: spacesData } = useAdminSpacesCatalog()
  const { data: blocksData } = useAdminBlocks()

  const spaces = normalise(spacesData)
  const blocks = normalise(blocksData)
  const space = spaces.find(s => String(s.id) === String(venueId))

  // ── UI state ──────────────────────────────────────────────────
  const [search, setSearch] = useState("")
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState("")
  const [pendingUser, setPendingUser] = useState(null)   // user to confirm
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastAssigned, setLastAssigned] = useState(null)   // {user, role} for success banner
  const [roles, setRoles] = useState([])
  const [rolesLoading, setRolesLoading] = useState(true)

  // ── Derived: resolved role object from selectedRole PK string ─────────────
  const selectedRoleObj = roles.find(r => String(r.id) === String(selectedRole)) ?? null

  // ── Load roles once ────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    roleOverrideService.getRoles()
      .then(data => {
        if (!alive) return
        const all = normalise(data)
        setRoles(all.filter(r => SCOPED_APPROVER_ROLES.includes(r.name)))
      })
      .catch(() => toast.error("Could not load roles."))
      .finally(() => { if (alive) setRolesLoading(false) })
    return () => { alive = false }
  }, [])

  // ── Debounced user search ──────────────────────────────────────
  useEffect(() => {
    let alive = true
    setUsersLoading(true)
    const timer = setTimeout(async () => {
      try {
        const data = await adminUserService.getUsers(search.trim() ? { q: search.trim() } : {})
        if (alive) setUsers(normalise(data))
      } catch {
        if (alive) toast.error("Failed to load users.")
      } finally {
        if (alive) setUsersLoading(false)
      }
    }, 250)
    return () => { alive = false; clearTimeout(timer) }
  }, [search])

  // ── Confirm assignment ─────────────────────────────────────────
  const handleConfirm = async () => {
    if (!pendingUser || !selectedRole || !selectedRoleObj || !space) {
      toast.error("Please select a user and role.")
      return
    }
    setIsSubmitting(true)
    try {
      // Payload matches AssignApproverModal exactly:
      //   role       → integer PK (as string, coerced to int by DRF)
      //   user       → user PK
      //   scope_type → 'SPACE'
      //   space      → venue PK
      await spaceAdminService.createApprover({
        user: pendingUser.id,
        role: parseInt(selectedRole, 10),         // PK string, e.g. "3" — NOT the name
        scope_type: "SPACE",
        space: space.id,
      })
      const assignedName = [pendingUser.first_name, pendingUser.last_name].filter(Boolean).join(" ") || pendingUser.email
      const displayRole = selectedRoleObj ? (selectedRoleObj.display_name || ROLE_LABEL[selectedRoleObj.name] || selectedRoleObj.name) : selectedRole
      setLastAssigned({ userName: assignedName, roleName: displayRole })
      setPendingUser(null)
    } catch (err) {
      const data = err?.response?.data
      const rawErr = data?.non_field_errors?.[0] || data?.user?.[0] || data?.error
      const msg = rawErr?.includes("unique set")
        ? "This user is already assigned to this role for this venue."
        : rawErr || "Failed to assign manager. Please try again."
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAssignAnother = () => {
    setLastAssigned(null)
  }

  const handleDone = () => {
    navigate(`/admin/spaces/venues/${venueId}`)
  }

  // ── Parsed location ────────────────────────────────────────────
  const { blockName } = space ? parseSpaceLocation(space.location, blocks) : {}

  // ── Loading state ──────────────────────────────────────────────
  if (!space) {
    return (
      <div className="min-h-full bg-[#f6fbf8] flex items-center justify-center p-10">
        <div className="text-center">
          <p className="text-[15px] font-bold text-[#0f172a]">Venue not found</p>
          <button onClick={() => navigate("/admin/spaces")}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d] text-white text-[13.5px] font-bold hover:bg-[#166534] transition">
            ← Back to Venues
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#f6fbf8] p-6 md:p-8">

      {/* ── Confirm dialog ── */}
      {pendingUser && (
        <ConfirmDialog
          venueName={space.name}
          user={pendingUser}
          roleName={selectedRoleObj?.display_name ?? ROLE_LABEL[selectedRoleObj?.name] ?? selectedRoleObj?.name ?? "Selected Role"}
          onCancel={() => setPendingUser(null)}
          onConfirm={handleConfirm}
          isSubmitting={isSubmitting}
        />
      )}

      <div className="max-w-[1100px] mx-auto">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => navigate("/admin/spaces")}
            className="text-[13px] font-semibold text-[#6b7280] hover:text-[#15803d] transition flex items-center gap-1.5">
            <Svg d="M15 18l-6-6 6-6" className="w-4 h-4" />
            Venue Management
          </button>
          <span className="text-[#d1d5db]">/</span>
          <button onClick={() => navigate(`/admin/spaces/venues/${venueId}`)}
            className="text-[13px] font-semibold text-[#6b7280] hover:text-[#15803d] transition truncate max-w-[180px]">
            {space.name}
          </button>
          <span className="text-[#d1d5db]">/</span>
          <span className="text-[13px] font-semibold text-[#0f172a]">Add Venue Manager</span>
        </div>

        {/* ── Page header ── */}
        <div className="mb-7">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#15803d] mb-1">
            Rajagiri College · System Admin
          </p>
          <h1 className="text-[26px] font-bold text-[#0f172a] tracking-tight">Add Venue Manager</h1>
          <p className="text-[14.5px] text-[#6b7280] mt-1.5">
            Select a staff member to manage approvals at{" "}
            <strong className="text-[#374151]">
              {space.name}{blockName ? ` · ${blockName}` : ""}
            </strong>
          </p>
        </div>

        {/* ── Success banner ── */}
        {lastAssigned && (
          <SuccessBanner
            venueName={space.name}
            userName={lastAssigned.userName}
            onDismiss={handleDone}
            onAssignAnother={handleAssignAnother}
          />
        )}

        {/* ── Step 1: Select role ── */}
        <div className="bg-white rounded-2xl border border-[#e8f5ee] px-6 py-5 mb-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#94a3b8] mb-3">
            Step 1 — Choose a Role
          </p>
          <p className="text-[13.5px] text-[#374151] mb-4">
            Select the responsibility this manager will hold at this venue.
          </p>
          {rolesLoading ? (
            <div className="flex gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 w-36 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {roles.map(role => {
                const pkStr = String(role.id)      // PK — what we store & send
                const isActive = selectedRole === pkStr
                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(pkStr)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[13.5px] font-semibold transition
                      ${isActive
                        ? "bg-[#15803d] text-white border-[#15803d] shadow-sm"
                        : "bg-white text-[#374151] border-[#e2e8f0] hover:border-[#15803d] hover:text-[#15803d]"
                      }`}
                  >
                    {isActive && (
                      <Svg d="M5 13l4 4L19 7" className="w-3.5 h-3.5" strokeWidth={2.5} />
                    )}
                    {role.display_name || ROLE_LABEL[role.name] || role.name}
                  </button>
                )
              })}
            </div>
          )}
          {!selectedRole && !rolesLoading && (
            <p className="text-[12.5px] text-[#94a3b8] mt-3">
              Please select a role before adding a manager.
            </p>
          )}
        </div>

        {/* ── Step 2: Search users ── */}
        <div className="bg-white rounded-2xl border border-[#e8f5ee] overflow-hidden">

          {/* Table header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b border-[#f1f5f9]">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#94a3b8] mb-0.5">
                Step 2 — Select a Staff Member
              </p>
              <p className="text-[13.5px] text-[#374151]">
                Search by name, email or employee ID.
              </p>
            </div>
            <div className="relative w-full sm:w-[340px]">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]"
                viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, employee ID…"
                className="w-full pl-10 pr-4 py-2.5 text-[13.5px] border border-[#e2e8f0] rounded-xl
                  outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]
                  text-[#0f172a] placeholder:text-[#94a3b8]"
              />
            </div>
          </div>

          {/* Users table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left border-collapse">
              <thead>
                <tr className="bg-[#f6fbf8] border-b border-[#e8f5ee]">
                  <th className="px-5 py-3.5 text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-[#6b7280]">User</th>
                  <th className="px-5 py-3.5 text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-[#6b7280]">Department</th>
                  <th className="px-5 py-3.5 text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-[#6b7280]">Current Roles</th>
                  <th className="px-5 py-3.5 text-right text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-[#6b7280]">Action</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr>
                    <td colSpan="4" className="py-12 text-center text-[13.5px] font-medium text-[#94a3b8]">
                      Loading users…
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-12 text-center text-[13.5px] font-medium text-[#94a3b8]">
                      {search.trim() ? `No users found for "${search}"` : "No users found."}
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <UserRow
                      key={user.id}
                      user={user}
                      selectedRole={selectedRole}
                      onAdd={setPendingUser}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Role-not-selected hint */}
          {!selectedRole && users.length > 0 && (
            <div className="px-6 py-4 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
              <Svg d="M12 9v3m0 3h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-[12.5px] font-semibold text-amber-800">
                Please select a role in Step 1 before adding a manager.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer: back button ── */}
        <div className="mt-6 flex">
          <button
            onClick={() => navigate(`/admin/spaces/venues/${venueId}`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#e2e8f0]
              text-[13.5px] font-semibold text-[#374151] hover:bg-white transition"
          >
            <Svg d="M15 18l-6-6 6-6" className="w-4 h-4" />
            Back to Venue Details
          </button>
        </div>
      </div>
    </div>
  )
}
