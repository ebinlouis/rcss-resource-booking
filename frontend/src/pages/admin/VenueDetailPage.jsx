import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAdminSpacesCatalog, useAdminBlocks } from "../../hooks/useSpaceQueries"
import spaceAdminService from "../../api/spaceAdminService"
import roleOverrideService from "../../api/roleOverrideService"
import { parseSpaceLocation } from "../../utils/spaceLocation"
import toast from "react-hot-toast"

// ─────────────────────────────────────────────────────────────
// Helpers / design tokens
// ─────────────────────────────────────────────────────────────

const SPACE_TYPE_META = {
  GENERAL_HALL: { label: "General Hall", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  LAB:          { label: "Laboratory",   color: "bg-blue-50 text-blue-700 border-blue-200" },
  GUEST_ROOM:   { label: "Guest Room",   color: "bg-amber-50 text-amber-700 border-amber-200" },
}

const ROLE_COLOR = {
  RECEPTIONIST: "bg-sky-50 text-sky-700 border-sky-200",
  LAB_INCHARGE: "bg-violet-50 text-violet-700 border-violet-200",
  LIBRARIAN:    "bg-rose-50 text-rose-700 border-rose-200",
}

function formatDate(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric", month: "short", day: "numeric",
  })
}

function formatDateTime(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-IN", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  })
}

const STATUS_META = {
  PENDING:           { label: "Pending",          color: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED:          { label: "Approved",          color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED:          { label: "Rejected",          color: "bg-red-50 text-red-700 border-red-200" },
  CANCELLED:         { label: "Cancelled",         color: "bg-gray-100 text-gray-500 border-gray-200" },
  EXPIRED:           { label: "Expired",           color: "bg-purple-50 text-purple-700 border-purple-200" },
  COMPLETED:         { label: "Completed",         color: "bg-blue-50 text-blue-700 border-blue-200" },
  AWAITING_FACULTY:  { label: "Awaiting Faculty",  color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  FACULTY_ESCALATED: { label: "Escalated",         color: "bg-orange-50 text-orange-700 border-orange-200" },
}

const normalise = (data) => Array.isArray(data) ? data : data?.results ?? []

// ─────────────────────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────────────────────

function Svg({ d, className = "w-5 h-5", viewBox = "0 0 24 24", fill = "none", strokeWidth = 2 }) {
  return (
    <svg className={className} viewBox={viewBox} fill={fill} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <path d={d} />
    </svg>
  )
}

function CompactInfoTile({ label, value, icon }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-3 p-3.5 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
      {icon && (
        <div className="w-8.5 h-8.5 rounded-lg bg-[#f0fdf4] flex items-center justify-center text-[#15803d] shrink-0 border border-[#d1fae5]">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10.5px] font-bold text-[#94a3b8] uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-[13.5px] font-semibold text-[#0f172a] leading-tight truncate">{value}</p>
      </div>
    </div>
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
// Confirm Remove Dialog
// ─────────────────────────────────────────────────────────────

function ConfirmRemoveDialog({ approver, onCancel, onConfirm, isRemoving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-[#f1f5f9] bg-red-50/20">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-red-600 mb-1">Remove Manager</p>
          <h3 className="text-[18px] font-bold text-[#0f172a]">Remove Assignment?</h3>
        </div>
        <div className="px-6 py-5">
          <p className="text-[14px] text-[#374151] leading-relaxed">
            {approver.is_last_assignment_for_role
              ? <>This is <strong>{approver.user_name || "this user"}'s</strong> last assignment for this role. Removing it will also strip the role badge from their account.</>
              : <>Remove <strong>{approver.user_name || "this user"}</strong> as a venue manager for this venue?</>
            }
          </p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-[#f9fafb] border-t border-[#f1f5f9]">
          <button onClick={onCancel} disabled={isRemoving}
            className="px-5 py-2 rounded-xl border border-[#e2e8f0] text-[13.5px] font-semibold text-[#374151] hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isRemoving}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[13.5px] font-bold transition disabled:opacity-50">
            {isRemoving ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Edit Manager Dialog
// ─────────────────────────────────────────────────────────────

function EditManagerDialog({ approver, roles, onCancel, onConfirm, isSubmitting }) {
  const [selectedRole, setSelectedRole] = useState(String(approver.role))
  const [isActive, setIsActive] = useState(approver.is_active)

  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm({
      role: parseInt(selectedRole, 10),
      is_active: isActive
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-[#f1f5f9] bg-[#f6fbf8]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#15803d] mb-1">Edit Assignment</p>
          <h3 className="text-[18px] font-bold text-[#0f172a]">Edit Venue Manager</h3>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            {/* User row */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <Avatar name={approver.user_name || approver.user_email} photo={approver.profile_image} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">User</p>
                <p className="text-[14px] font-bold text-[#0f172a] truncate">
                  {approver.user_name || "Unknown"}
                </p>
                <p className="text-[12px] text-[#6b7280] truncate">{approver.user_email}</p>
              </div>
            </div>

            {/* Role dropdown */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1.5">
                Approval Role <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] transition"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                {roles.map(r => (
                  <option key={r.id} value={String(r.id)}>
                    {r.display_name || r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status toggle checkbox */}
            <div className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                id="edit-active-toggle"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4.5 h-4.5 text-[#15803d] border-gray-300 rounded focus:ring-[#15803d]"
              />
              <label htmlFor="edit-active-toggle" className="text-sm font-semibold text-[#374151] select-none cursor-pointer">
                Active Assignment
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 bg-[#f9fafb] border-t border-[#f1f5f9]">
            <button type="button" onClick={onCancel} disabled={isSubmitting}
              className="px-5 py-2 rounded-xl border border-[#e2e8f0] text-[13.5px] font-semibold text-[#374151] hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-[13.5px] font-bold transition disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Manager Card
// ─────────────────────────────────────────────────────────────

function ManagerCard({ approver, onEdit, onRemove }) {
  const roleKey = String(approver.role || "").toUpperCase()
  const roleColor = ROLE_COLOR[roleKey] ?? "bg-gray-50 text-gray-600 border-gray-200"

  const scopeLabel =
    approver.scope_type === "BLOCK"   ? `Block: ${approver.block_name || "—"}` :
    approver.scope_type === "SPACE"   ? "Venue Specific" : "—"

  return (
    <div className="flex items-center gap-4 px-5 py-4 bg-white rounded-2xl border border-[#e8f5ee]
      hover:shadow-sm transition group">
      <Avatar name={approver.user_name || approver.user_email} photo={approver.profile_image} />
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-bold text-[#0f172a] leading-tight truncate">
          {approver.user_name || "Unknown"}
        </p>
        <p className="text-[12.5px] text-[#6b7280] truncate">{approver.user_email}</p>
        {approver.department_name && (
          <p className="text-[12px] text-[#94a3b8] mt-0.5">{approver.department_name}</p>
        )}
        <p className="text-[11.5px] text-[#94a3b8] mt-0.5">{scopeLabel}</p>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${roleColor}`}>
          {approver.role_display || approver.role}
        </span>
        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
          approver.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
          {approver.is_active ? "Active" : "Inactive"}
        </span>
        <p className="text-[11px] text-[#94a3b8]">Since {formatDate(approver.created_at)}</p>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition ml-2 flex gap-1.5 shrink-0">
        <button
          onClick={() => onEdit(approver)}
          className="px-3 py-1.5 rounded-xl bg-slate-50 text-slate-700 text-[12px] font-bold hover:bg-slate-100 border border-slate-100 transition"
        >
          Edit
        </button>
        <button
          onClick={() => onRemove(approver)}
          className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-[12px] font-bold hover:bg-red-100 border border-red-100 transition"
        >
          Remove
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

const EMPTY_ARRAY = []

export default function VenueDetailPage() {
  const { venueId } = useParams()
  const navigate    = useNavigate()

  // ── Data ──────────────────────────────────────────────────────
  const { data: spacesData, isLoading: spacesLoading } = useAdminSpacesCatalog()
  const { data: blocksData }                           = useAdminBlocks()

  const spaces = normalise(spacesData)
  const blocks = normalise(blocksData)
  const space  = spaces.find(s => String(s.id) === String(venueId))

  const [approvers, setApprovers]       = useState(EMPTY_ARRAY)
  const [approversLoading, setLoading]  = useState(true)
  const [removingApprover, setRemoving] = useState(null)
  const [isRemoving, setIsRemoving]     = useState(false)

  // Editing state for managers
  const [editingApprover, setEditingApprover] = useState(null)
  const [isEditing, setIsEditing]             = useState(false)
  const [roles, setRoles]                     = useState(EMPTY_ARRAY)
  const [rolesLoading, setRolesLoading]       = useState(true)

  // ── Booking history state ─────────────────────────────────────────
  const [activeTab, setActiveTab]             = useState("managers")
  const [bookings, setBookings]               = useState(EMPTY_ARRAY)
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [bookingsFetched, setBookingsFetched] = useState(false)
  const [historyFilter, setHistoryFilter]     = useState("ALL")
  const [bookingSearchTerm, setBookingSearchTerm] = useState("")

  // Pagination states
  const [managersPage, setManagersPage]       = useState(1)
  const [bookingsPage, setBookingsPage]       = useState(1)
  const managersPerPage = 5
  const bookingsPerPage = 5

  // Fetch roles on mount
  useEffect(() => {
    let alive = true
    roleOverrideService.getRoles()
      .then(data => {
        if (!alive) return
        const all = normalise(data)
        const SCOPED_APPROVER_ROLES = ["RECEPTIONIST", "LAB_INCHARGE", "LIBRARIAN"]
        setRoles(all.filter(r => SCOPED_APPROVER_ROLES.includes(r.name)))
      })
      .catch(() => {})
      .finally(() => { if (alive) setRolesLoading(false) })
    return () => { alive = false }
  }, [])

  const fetchApprovers = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    try {
      const data = await spaceAdminService.getApprovers({ space: venueId })
      setApprovers(normalise(data))
    } catch {
      toast.error("Could not load venue managers.")
    } finally {
      setLoading(false)
    }
  }, [venueId])

  useEffect(() => { fetchApprovers() }, [fetchApprovers])

  // Fetch booking history on mount to feed quick statistics cards immediately
  const fetchBookings = useCallback(async () => {
    if (!venueId) return
    setBookingsLoading(true)
    try {
      const data = await spaceAdminService.getVenueBookings(venueId)
      setBookings(normalise(data))
      setBookingsFetched(true)
    } catch {
      toast.error("Could not load booking history.")
    } finally {
      setBookingsLoading(false)
    }
  }, [venueId])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  // Reset page indices on list length / filter / search adjustments
  useEffect(() => {
    const maxPage = Math.ceil(approvers.length / managersPerPage) || 1
    if (managersPage > maxPage) {
      setManagersPage(maxPage)
    }
  }, [approvers, managersPage])

  useEffect(() => {
    setBookingsPage(1)
  }, [bookingSearchTerm, historyFilter])

  // ── Derived ────────────────────────────────────────────────────
  const { blockName, locationDetails } = space
    ? parseSpaceLocation(space.location, blocks)
    : { blockName: "", locationDetails: "" }

  const typeMeta = SPACE_TYPE_META[space?.space_type] ?? {
    label: space?.space_type ?? "Unknown",
    color: "bg-gray-100 text-gray-600 border-gray-200",
  }

  const equipment = space?.built_in_equipment ?? []

  // ── Remove handler ─────────────────────────────────────────────
  const handleRemove = async () => {
    if (!removingApprover) return
    setIsRemoving(true)
    try {
      await spaceAdminService.deleteApprover(removingApprover.id)
      toast.success("Manager assignment removed.")
      setRemoving(null)
      fetchApprovers()
    } catch {
      toast.error("Failed to remove assignment.")
    } finally {
      setIsRemoving(false)
    }
  }

  // ── Edit handler ───────────────────────────────────────────────
  const handleEdit = async (updatedData) => {
    if (!editingApprover) return
    setIsEditing(true)
    try {
      await spaceAdminService.updateApprover(editingApprover.id, updatedData)
      toast.success("Manager assignment updated.")
      setEditingApprover(null)
      fetchApprovers()
    } catch {
      toast.error("Failed to update assignment.")
    } finally {
      setIsEditing(false)
    }
  }

  // Helper text mapping for approval state details
  const getApprovalStateText = (booking) => {
    if (booking.status === "AWAITING_FACULTY") {
      return `Awaiting Faculty Sponsor (${booking.faculty_sponsor_name || "Sponsor"})`
    }
    if (booking.status === "FACULTY_ESCALATED") {
      return "Escalated to In-Charge (Sponsor Timeout)"
    }
    if (booking.status === "PENDING") {
      return "Awaiting Venue Manager / HOD Approval"
    }
    if (booking.status === "APPROVED") {
      return "Approved & Confirmed"
    }
    if (booking.status === "REJECTED") {
      return booking.remarks_by_admin ? `Rejected: ${booking.remarks_by_admin}` : "Rejected"
    }
    if (booking.status === "CANCELLED") {
      return "Cancelled by User"
    }
    return booking.status
  }

  // Managers pagination slice
  const totalManagersPages = Math.ceil(approvers.length / managersPerPage)
  const paginatedApprovers = approvers.slice(
    (managersPage - 1) * managersPerPage,
    managersPage * managersPerPage
  )

  // Bookings filtering and pagination slice
  const filteredBookings = bookings.filter(b => {
    const term = bookingSearchTerm.toLowerCase().trim()
    const matchesSearch = !term ||
      (b.reference_code && b.reference_code.toLowerCase().includes(term)) ||
      (b.purpose_of_booking && b.purpose_of_booking.toLowerCase().includes(term)) ||
      (b.booked_by_name && b.booked_by_name.toLowerCase().includes(term)) ||
      (b.booked_by_email && b.booked_by_email.toLowerCase().includes(term))

    if (historyFilter === "ALL") return matchesSearch
    if (historyFilter === "PENDING") {
      return matchesSearch && ["PENDING", "AWAITING_FACULTY", "FACULTY_ESCALATED"].includes(b.status)
    }
    if (historyFilter === "APPROVED") {
      return matchesSearch && ["APPROVED", "COMPLETED"].includes(b.status)
    }
    return matchesSearch && b.status === historyFilter
  })

  const totalBookingsPages = Math.ceil(filteredBookings.length / bookingsPerPage)
  const paginatedBookings = filteredBookings.slice(
    (bookingsPage - 1) * bookingsPerPage,
    bookingsPage * bookingsPerPage
  )

  // ── Loading / not-found states ─────────────────────────────────
  if (spacesLoading) {
    return (
      <div className="min-h-full bg-[#f6fbf8] flex items-center justify-center p-10">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-[#15803d]/20 border-t-[#15803d] animate-spin" />
          <p className="text-[14px] font-semibold text-[#6b7280]">Loading venue details…</p>
        </div>
      </div>
    )
  }

  if (!space) {
    return (
      <div className="min-h-full bg-[#f6fbf8] flex items-center justify-center p-10">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Svg d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-[16px] font-bold text-[#0f172a]">Venue not found</p>
          <p className="text-[13.5px] text-[#94a3b8] mt-1">This venue may have been removed or doesn't exist.</p>
          <button onClick={() => navigate("/admin/spaces")}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d] text-white text-[13.5px] font-bold hover:bg-[#166534] transition">
            ← Back to Venues
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#f6fbf8] p-6 md:p-8">

      {/* ── Confirm remove dialog ── */}
      {removingApprover && (
        <ConfirmRemoveDialog
          approver={removingApprover}
          onCancel={() => setRemoving(null)}
          onConfirm={handleRemove}
          isRemoving={isRemoving}
        />
      )}

      {/* ── Edit manager dialog ── */}
      {editingApprover && (
        <EditManagerDialog
          approver={editingApprover}
          roles={roles}
          onCancel={() => setEditingApprover(null)}
          onConfirm={handleEdit}
          isSubmitting={isEditing}
        />
      )}

      <div className="max-w-[1100px] mx-auto space-y-6">

        {/* ── Back breadcrumb ── */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/spaces")}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#6b7280]
              hover:text-[#15803d] transition"
          >
            <Svg d="M15 18l-6-6 6-6" className="w-4 h-4" />
            Venue Management
          </button>
          <span className="text-[#d1d5db]">/</span>
          <span className="text-[13px] font-semibold text-[#0f172a] truncate max-w-[260px]">
            {space.name}
          </span>
        </div>

        {/* ── Top Hero Section ── */}
        <div className="bg-white rounded-2xl border border-[#e8f5ee] p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#f1f5f9]">
            {/* Left side: Image and details */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative w-36 h-24 bg-[#e8f5ee] rounded-xl overflow-hidden shrink-0 border border-[#d1fae5]">
                {space.image_1 ? (
                  <img src={space.image_1} alt={space.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#90d7ad]">
                    <Svg d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 8h.01M15 8h.01M9 13h.01M15 13h.01" className="w-10 h-10" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${typeMeta.color}`}>
                    {typeMeta.label}
                  </span>
                  {space.is_special_purpose && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-yellow-50 text-yellow-700 border-yellow-200">
                      Special Approval
                    </span>
                  )}
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    space.is_active
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-gray-100 text-gray-500 border-gray-200"
                  }`}>
                    {space.is_active ? "Available" : "Unavailable"}
                  </span>
                </div>
                <h1 className="text-[24px] font-extrabold text-[#0f172a] leading-tight tracking-tight">{space.name}</h1>
                <div className="flex items-center gap-1.5 text-[13px] text-[#475569] font-medium">
                  <Svg d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16M9 21V11h6v10" className="w-3.5 h-3.5 text-[#94a3b8]" />
                  <span>{blockName || "—"}</span>
                  <span className="text-gray-300">•</span>
                  <Svg d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 7a3 3 0 100 6 3 3 0 000-6z" className="w-3.5 h-3.5 text-[#94a3b8]" />
                  <span>{locationDetails || "—"}</span>
                </div>
              </div>
            </div>

            {/* Right side: Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                onClick={() => navigate(`/admin/spaces`, { state: { editId: space.id } })}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl
                  border border-[#e2e8f0] text-[13.5px] font-bold text-[#374151] bg-white
                  hover:bg-gray-50 hover:border-gray-300 transition"
              >
                <Svg d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z" className="w-4 h-4 text-gray-500" />
                Edit Venue
              </button>
              <button
                onClick={() => navigate(`/admin/spaces/venues/${space.id}/assign-manager`)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d]
                  hover:bg-[#166534] text-white text-[13.5px] font-bold transition shadow-sm"
              >
                <Svg d="M12 4v16m8-8H4" className="w-4 h-4" strokeWidth={2.5} />
                Assign Manager
              </button>
            </div>
          </div>

          {/* Quick Statistics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-[#15803d] border border-green-100 shrink-0">
                <Svg d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#94a3b8] mb-0.5">Capacity</p>
                <p className="text-[18px] font-black text-[#0f172a] leading-tight">{space.capacity_hard ? `${space.capacity_hard} seats` : "—"}</p>
              </div>
            </div>

            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
                <Svg d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#94a3b8] mb-0.5">Managers</p>
                <p className="text-[18px] font-black text-[#0f172a] leading-tight">
                  {approversLoading ? (
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-[#15803d]/20 border-t-[#15803d] animate-spin" />
                  ) : approvers.length}
                </p>
              </div>
            </div>

            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shrink-0">
                <Svg d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#94a3b8] mb-0.5">Total Bookings</p>
                <p className="text-[18px] font-black text-[#0f172a] leading-tight">
                  {bookingsLoading ? (
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
                  ) : bookings.length}
                </p>
              </div>
            </div>

            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100 shrink-0">
                <Svg d="M9 12l2 2 4-4" className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#94a3b8] mb-0.5">Current Status</p>
                <p className="text-[18px] font-black text-[#0f172a] leading-tight">{space.is_active ? "Available" : "Unavailable"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Venue Details Section ── */}
        <div className="bg-white rounded-2xl border border-[#e8f5ee] p-6 shadow-sm">
          <h2 className="text-[16px] font-bold text-[#0f172a] mb-4">Venue Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <CompactInfoTile label="Venue Type" value={typeMeta.label} icon={<Svg d="M4 6h16M4 12h16M4 18h16" className="w-4.5 h-4.5" />} />
            <CompactInfoTile label="Block" value={blockName} icon={<Svg d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16M9 21V11h6v10" className="w-4.5 h-4.5" />} />
            <CompactInfoTile label="Location" value={locationDetails} icon={<Svg d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 7a3 3 0 100 6 3 3 0 000-6z" className="w-4.5 h-4.5" />} />
            <CompactInfoTile label="Capacity" value={space.capacity_hard ? `${space.capacity_hard} seats` : "—"} icon={<Svg d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" className="w-4.5 h-4.5" />} />
            <CompactInfoTile label="Approval Workflow" value={space.approval_workflow_type === "HOD_FALLBACK" ? "HOD with Fallback" : "Direct Approver"} icon={<Svg d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4.5 h-4.5" />} />
            <CompactInfoTile label="Status" value={space.is_active ? "Available" : "Unavailable"} icon={<Svg d="M9 12l2 2 4-4" className="w-4.5 h-4.5" />} />
            <CompactInfoTile label="Created Date" value={formatDate(space.created_at)} icon={<Svg d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" className="w-4.5 h-4.5" />} />
            <CompactInfoTile label="Updated Date" value={formatDate(space.updated_at)} icon={<Svg d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" className="w-4.5 h-4.5" />} />
          </div>
          
          {space.description && (
            <div className="mt-4 p-3.5 bg-[#f8fafc] rounded-xl border border-gray-100 text-[13px] text-[#475569]">
              <span className="font-bold text-[#334155] block mb-1 text-[11px] uppercase tracking-wider">Description</span>
              {space.description}
            </div>
          )}

          {equipment.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#f1f5f9]">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#94a3b8] mb-2.5">
                Facilities & Equipment
              </p>
              <div className="flex flex-wrap gap-2">
                {equipment.map((eq) => (
                  <span key={eq.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#d1fae5]
                      bg-[#f0fdf4] text-[12.5px] font-semibold text-[#15803d]">
                    <Svg d="M5 13l4 4L19 7" className="w-3.5 h-3.5" />
                    {eq.equipment_name} × {eq.quantity}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Tabbed Section (Managers + Booking History) ── */}
        <div>
          {/* ── Tab bar ── */}
          <div className="flex bg-white rounded-t-2xl border border-[#e8f5ee] overflow-hidden">
            {[
              { id: "managers", label: "Venue Managers",  icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" },
              { id: "history",  label: "Booking History", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-5 py-4
                  text-[13px] font-bold transition border-b-2
                  ${ activeTab === tab.id
                    ? "border-[#15803d] text-[#15803d] bg-white"
                    : "border-transparent text-[#6b7280] hover:text-[#374151] hover:bg-[#f6fbf8]"
                  }`}
              >
                <Svg d={tab.icon} className="w-4 h-4" />
                {tab.label}
                {tab.id === "managers" && approvers.length > 0 && !approversLoading && (
                  <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full
                    bg-[#15803d] text-white text-[10px] font-bold">
                    {approvers.length}
                  </span>
                )}
                {tab.id === "history" && bookings.length > 0 && !bookingsLoading && (
                  <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full
                    bg-[#475569] text-white text-[10px] font-bold">
                    {bookings.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab content wrapper ── */}
          <div className="bg-white rounded-b-2xl border border-[#e8f5ee] border-t-0 overflow-hidden shadow-sm">

            {/* ── MANAGERS TAB ── */}
            {activeTab === "managers" && (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-[#f1f5f9]">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#94a3b8] mb-0.5">
                      Assigned Staff
                    </p>
                    <h2 className="text-[17px] font-bold text-[#0f172a]">Venue Managers</h2>
                    <p className="text-[12.5px] text-[#6b7280] mt-0.5">
                      Staff responsible for approving bookings at this venue.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/admin/spaces/venues/${space.id}/assign-manager`)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#15803d]
                      hover:bg-[#166534] text-white text-[13px] font-bold transition shadow-sm shrink-0"
                  >
                    <Svg d="M12 4v16m8-8H4" className="w-4 h-4" strokeWidth={2.5} />
                    Add Venue Manager
                  </button>
                </div>

                {/* Manager list */}
                <div className="p-4 space-y-3">
                  {approversLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 rounded-2xl bg-[#f6fbf8] border border-[#e8f5ee] animate-pulse" />
                      ))}
                    </div>
                  ) : paginatedApprovers.length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="w-14 h-14 rounded-full bg-[#f0fdf4] flex items-center justify-center mx-auto mb-4 text-[#15803d]">
                        <Svg d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" className="w-7 h-7" />
                      </div>
                      <p className="text-[14.5px] font-bold text-[#374151]">No managers assigned yet</p>
                      <p className="text-[13px] text-[#94a3b8] mt-1 max-w-[280px] mx-auto">
                        Click <strong className="text-[#15803d]">Add Venue Manager</strong> to assign staff who can approve bookings at this venue.
                      </p>
                      <button
                        onClick={() => navigate(`/admin/spaces/venues/${space.id}/assign-manager`)}
                        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d]
                          hover:bg-[#166534] text-white text-[13.5px] font-bold transition"
                      >
                        <Svg d="M12 4v16m8-8H4" className="w-4 h-4" strokeWidth={2.5} />
                        Add Venue Manager
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {paginatedApprovers.map(approver => (
                          <ManagerCard
                            key={approver.id}
                            approver={approver}
                            onEdit={setEditingApprover}
                            onRemove={setRemoving}
                          />
                        ))}
                      </div>

                      {/* Pagination for Managers */}
                      {totalManagersPages > 1 && (
                        <div className="flex items-center justify-between border-t border-[#f1f5f9] px-2 py-4 mt-4">
                          <button
                            disabled={managersPage === 1}
                            onClick={() => setManagersPage(prev => Math.max(1, prev - 1))}
                            className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-[12px] font-semibold text-[#374151] hover:bg-gray-50 transition disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <span className="text-[12px] font-medium text-[#6b7280]">
                            Page {managersPage} of {totalManagersPages}
                          </span>
                          <button
                            disabled={managersPage === totalManagersPages}
                            onClick={() => setManagersPage(prev => Math.min(totalManagersPages, prev + 1))}
                            className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-[12px] font-semibold text-[#374151] hover:bg-gray-50 transition disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* ── BOOKING HISTORY TAB ── */}
            {activeTab === "history" && (
              <>
                {/* History header + filters */}
                <div className="px-6 py-5 border-b border-[#f1f5f9] space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#94a3b8] mb-0.5">
                        All Bookings
                      </p>
                      <h2 className="text-[17px] font-bold text-[#0f172a]">Booking History</h2>
                    </div>
                    
                    {/* Search box */}
                    <div className="relative w-full sm:w-[240px] shrink-0">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]"
                        viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor"
                        strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                      </svg>
                      <input
                        type="text"
                        value={bookingSearchTerm}
                        onChange={e => setBookingSearchTerm(e.target.value)}
                        placeholder="Search bookings..."
                        className="w-full pl-9 pr-3 py-1.5 text-[12.5px] border border-[#e2e8f0] rounded-xl
                          outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]
                          text-[#0f172a] placeholder:text-[#94a3b8]"
                      />
                    </div>
                  </div>

                  {/* Status filter chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map(f => {
                      let label = f === "ALL" ? "All" : (STATUS_META[f]?.label ?? f)
                      if (f === "PENDING") label = "Pending"
                      if (f === "APPROVED") label = "Approved"

                      return (
                        <button
                          key={f}
                          onClick={() => setHistoryFilter(f)}
                          className={`px-3 py-1 rounded-full text-[11.5px] font-bold border transition
                            ${ historyFilter === f
                              ? "bg-[#0f172a] text-white border-[#0f172a]"
                              : "bg-white text-[#6b7280] border-[#e2e8f0] hover:border-[#94a3b8]"
                            }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Booking list */}
                <div className="p-4 space-y-3">
                  {bookingsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 rounded-2xl bg-[#f6fbf8] border border-[#e8f5ee] animate-pulse" />
                      ))}
                    </div>
                  ) : paginatedBookings.length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="w-14 h-14 rounded-full bg-[#f0fdf4] flex items-center justify-center mx-auto mb-4 text-[#15803d]">
                        <Svg d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" className="w-7 h-7" />
                      </div>
                      <p className="text-[14px] font-bold text-[#374151]">
                        No matches found
                      </p>
                      <p className="text-[12.5px] text-[#94a3b8] mt-1">Try adjusting your search terms or filters.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {paginatedBookings.map(booking => {
                          const sm = STATUS_META[booking.status] ?? { label: booking.status, color: "bg-gray-100 text-gray-600 border-gray-200" }
                          return (
                            <div key={booking.id}
                              className="rounded-2xl border border-[#e8f5ee] bg-[#f6fbf8] px-5 py-4 hover:border-[#c7e8d5] transition"
                            >
                              {/* Row 1: reference + status */}
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[11.5px] font-bold text-[#15803d] font-mono tracking-wide">
                                    {booking.reference_code ?? "—"}
                                  </span>
                                  <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border ${sm.color}`}>
                                    {sm.label}
                                  </span>
                                </div>
                                <span className="text-[11px] text-[#94a3b8] shrink-0">
                                  {formatDate(booking.created_at)}
                                </span>
                              </div>

                              {/* Row 2: Event Name */}
                              <p className="text-[13.5px] font-bold text-[#0f172a] leading-snug mb-2 line-clamp-1">
                                {booking.purpose_of_booking || "—"}
                              </p>

                              {/* Row 3: Requestor */}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#6b7280] mb-2">
                                <span className="flex items-center gap-1">
                                  <Svg d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" className="w-3.5 h-3.5 text-[#94a3b8]" />
                                  <span className="font-semibold text-[#374151]">{booking.booked_by_name ?? "—"}</span>
                                </span>
                                {booking.booked_by_department && (
                                  <span className="flex items-center gap-1">
                                    <Svg d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16M9 21V11h6v10" className="w-3.5 h-3.5 text-[#94a3b8]" />
                                    {booking.booked_by_department}
                                  </span>
                                )}
                                {booking.faculty_sponsor_name && (
                                  <span className="flex items-center gap-1">
                                    <Svg d="M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" className="w-3.5 h-3.5 text-[#94a3b8]" />
                                    {booking.faculty_sponsor_name}
                                  </span>
                                )}
                              </div>

                              {/* Row 4: Date & Time */}
                              <div className="flex items-center gap-1.5 text-[12px] text-[#6b7280] mb-2">
                                <Svg d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" className="w-3.5 h-3.5 text-[#94a3b8]" />
                                <span className="font-medium text-[#374151]">
                                  {formatDateTime(booking.start_datetime)}
                                  {booking.end_datetime && ` – ${formatDateTime(booking.end_datetime)}`}
                                </span>
                              </div>

                              {/* Row 5: Approval State */}
                              <div className="text-[11.5px] text-[#475569] bg-white px-3 py-1.5 rounded-lg border border-[#e8f5ee] inline-block font-semibold">
                                <span className="text-[#94a3b8] font-bold text-[10px] uppercase tracking-wider block mb-0.5">Approval State</span>
                                {getApprovalStateText(booking)}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Pagination for Bookings */}
                      {totalBookingsPages > 1 && (
                        <div className="flex items-center justify-between border-t border-[#f1f5f9] px-2 py-4 mt-4">
                          <button
                            disabled={bookingsPage === 1}
                            onClick={() => setBookingsPage(prev => Math.max(1, prev - 1))}
                            className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-[12px] font-semibold text-[#374151] hover:bg-gray-50 transition disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <span className="text-[12px] font-medium text-[#6b7280]">
                            Page {bookingsPage} of {totalBookingsPages}
                          </span>
                          <button
                            disabled={bookingsPage === totalBookingsPages}
                            onClick={() => setBookingsPage(prev => Math.min(totalBookingsPages, prev + 1))}
                            className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-[12px] font-semibold text-[#374151] hover:bg-gray-50 transition disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}
