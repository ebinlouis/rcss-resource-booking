import { useState, useEffect, useCallback } from "react"
import spaceAdminService from "../../api/spaceAdminService"
import AssignApproverModal from "./AssignApproverModal"
import { parseSpaceLocation } from "../../utils/spaceLocation"

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function Icon({ className = "w-4 h-4", viewBox = "0 0 24 24", fill = "none", strokeWidth = 2, children }) {
  return (
    <svg
      className={className}
      viewBox={viewBox}
      fill={fill}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    >
      {children}
    </svg>
  )
}

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

// ─────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────

function Avatar({ name, photo, size = "md" }) {
  const sizeClass = size === "sm"
    ? "w-8 h-8 text-[11px]"
    : "w-10 h-10 text-[13px]"

  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("")

  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-white shadow-sm shrink-0`}
      />
    )
  }
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-[#15803d] to-[#059669] text-white
        flex items-center justify-center font-bold ring-2 ring-white shadow-sm shrink-0`}
    >
      {initials}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Section heading
// ─────────────────────────────────────────────────────────────

function SectionHeading({ children }) {
  return (
    <p className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#6b7280] mb-3">
      {children}
    </p>
  )
}

// ─────────────────────────────────────────────────────────────
// Detail row
// ─────────────────────────────────────────────────────────────

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#f1f5f9] last:border-0">
      <div className="w-8 h-8 rounded-lg bg-[#f0fdf4] flex items-center justify-center text-[#15803d] shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider leading-none mb-0.5">
          {label}
        </p>
        <p className="text-[13.5px] font-semibold text-[#0f172a] leading-snug break-words">
          {value || "—"}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Manager card
// ─────────────────────────────────────────────────────────────

function ManagerCard({ approver }) {
  const roleColor = ROLE_COLOR[approver.role_display?.toUpperCase().replace(" ", "_")]
    ?? ROLE_COLOR[approver.role]
    ?? "bg-gray-50 text-gray-700 border-gray-200"

  const scopeLabel =
    approver.scope_type === "BLOCK"
      ? `Block: ${approver.block_name || "—"}`
      : approver.scope_type === "SPACE"
      ? `Venue specific`
      : "All Venues"

  return (
    <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-[#e8f5ee] bg-white hover:bg-[#f6fbf8] transition">
      <Avatar name={approver.user_name || approver.user_email} photo={approver.profile_image} />
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-bold text-[#0f172a] leading-tight truncate">
          {approver.user_name || "Unknown"}
        </p>
        <p className="text-[11.5px] text-[#6b7280] truncate">{approver.user_email}</p>
        <p className="text-[11px] text-[#94a3b8] mt-0.5">{scopeLabel}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${roleColor}`}>
          {approver.role_display || approver.role}
        </span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          approver.is_active
            ? "bg-emerald-50 text-emerald-600"
            : "bg-gray-100 text-gray-400"
        }`}>
          {approver.is_active ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Drawer
// ─────────────────────────────────────────────────────────────

export default function VenueDetailDrawer({ space, blocks = [], onClose, onEditVenue }) {
  const [approvers, setApprovers]       = useState([])
  const [approversLoading, setApproversLoading] = useState(true)
  const [approversError, setApproversError]     = useState(null)
  const [assignModalOpen, setAssignModalOpen]   = useState(false)
  const [visible, setVisible] = useState(false)

  // Slide-in animation
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 260)
  }, [onClose])

  // Fetch approvers scoped to this specific space
  const fetchApprovers = useCallback(async () => {
    if (!space?.id) return
    setApproversLoading(true)
    setApproversError(null)
    try {
      const data = await spaceAdminService.getApprovers({ space: space.id })
      setApprovers(Array.isArray(data) ? data : data.results || [])
    } catch {
      setApproversError("Could not load venue managers.")
    } finally {
      setApproversLoading(false)
    }
  }, [space?.id])

  useEffect(() => { fetchApprovers() }, [fetchApprovers])

  const { blockName, locationDetails } = parseSpaceLocation(space.location, blocks)
  const typeMeta = SPACE_TYPE_META[space.space_type] ?? {
    label: space.space_type,
    color: "bg-gray-100 text-gray-600 border-gray-200",
  }

  // Equipment list
  const equipment = space.built_in_equipment ?? []

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-250
          ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* ── Drawer panel ── */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-[460px] bg-[#f6fbf8]
          shadow-2xl flex flex-col overflow-hidden
          transition-transform duration-250 ease-out
          ${visible ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-[#e8f5ee] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#f0fdf4] flex items-center justify-center text-[#15803d]">
              <Icon className="w-4 h-4">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 8h.01M15 8h.01M9 13h.01M15 13h.01" />
              </Icon>
            </div>
            <div>
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[#15803d] leading-none">
                Venue Details
              </p>
              <h2 className="text-[15px] font-bold text-[#0f172a] leading-snug mt-0.5 max-w-[300px] truncate">
                {space.name}
              </h2>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#6b7280]
              hover:bg-[#f0fdf4] hover:text-[#15803d] transition"
            aria-label="Close venue details"
          >
            <Icon className="w-4 h-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </Icon>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Venue image */}
          <div className="relative h-48 bg-[#e8f5ee] shrink-0">
            {space.image_1 ? (
              <img
                src={space.image_1}
                alt={space.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#d1fae5]">
                <Icon className="w-14 h-14">
                  <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 8h.01M15 8h.01M9 13h.01M15 13h.01" />
                </Icon>
              </div>
            )}

            {/* Badges overlaid on image */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${typeMeta.color}`}>
                {typeMeta.label}
              </span>
              {space.is_special_purpose && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-yellow-50 text-yellow-700 border-yellow-200">
                  Special Approval
                </span>
              )}
              {space.approval_workflow_type === "HOD_FALLBACK" && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200">
                  Dept. Approval
                </span>
              )}
            </div>

            {/* Status badge */}
            <div className="absolute top-3 right-3">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border
                ${space.is_active
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                {space.is_active ? "Available" : "Unavailable"}
              </span>
            </div>

            {/* Edit button overlay */}
            {onEditVenue && (
              <button
                onClick={() => { onEditVenue(space); handleClose(); }}
                className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5
                  bg-white/90 backdrop-blur-sm rounded-xl text-[12px] font-semibold text-[#15803d]
                  border border-white hover:bg-white transition shadow-sm"
              >
                <Icon className="w-3 h-3">
                  <path d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z" />
                </Icon>
                Edit Venue
              </button>
            )}
          </div>

          {/* ── SECTION 1: Venue Details ── */}
          <div className="px-5 pt-5 pb-4">
            <SectionHeading>Venue Information</SectionHeading>
            <div className="bg-white rounded-2xl border border-[#e8f5ee] overflow-hidden px-4">
              <DetailRow
                icon={<Icon className="w-4 h-4"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 8h.01M15 8h.01M9 13h.01M15 13h.01" /></Icon>}
                label="Venue Name"
                value={space.name}
              />
              <DetailRow
                icon={<Icon className="w-4 h-4"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></Icon>}
                label="Venue Type"
                value={typeMeta.label}
              />
              {blockName && (
                <DetailRow
                  icon={<Icon className="w-4 h-4"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16M9 21V11h6v10" /></Icon>}
                  label="Block"
                  value={blockName}
                />
              )}
              {locationDetails && (
                <DetailRow
                  icon={<Icon className="w-4 h-4"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></Icon>}
                  label="Location"
                  value={locationDetails}
                />
              )}
              <DetailRow
                icon={<Icon className="w-4 h-4"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></Icon>}
                label="Capacity"
                value={space.capacity_hard ? `${space.capacity_hard} seats` : null}
              />
              <DetailRow
                icon={<Icon className="w-4 h-4"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></Icon>}
                label="Status"
                value={space.is_active ? "Available" : "Unavailable"}
              />
              {space.description && (
                <DetailRow
                  icon={<Icon className="w-4 h-4"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></Icon>}
                  label="Description"
                  value={space.description}
                />
              )}
              <DetailRow
                icon={<Icon className="w-4 h-4"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></Icon>}
                label="Created"
                value={formatDate(space.created_at)}
              />
              <DetailRow
                icon={<Icon className="w-4 h-4"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></Icon>}
                label="Last Updated"
                value={formatDate(space.updated_at)}
              />
            </div>
          </div>

          {/* ── Facilities / Equipment ── */}
          {equipment.length > 0 && (
            <div className="px-5 pb-4">
              <SectionHeading>Facilities & Amenities</SectionHeading>
              <div className="bg-white rounded-2xl border border-[#e8f5ee] px-4 py-3.5 flex flex-wrap gap-2">
                {equipment.map((eq) => (
                  <span
                    key={eq.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#d1fae5]
                      bg-[#f0fdf4] text-[12px] font-semibold text-[#15803d]"
                  >
                    <Icon className="w-3 h-3">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </Icon>
                    {eq.equipment_name} × {eq.quantity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── SECTION 2: Venue Managers ── */}
          <div className="px-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <SectionHeading>Venue Managers</SectionHeading>
              <button
                onClick={() => setAssignModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                  bg-[#15803d] hover:bg-[#166534] text-white text-[12px] font-bold
                  transition shadow-sm"
              >
                <Icon className="w-3 h-3" strokeWidth={2.5}>
                  <path d="M12 4v16m8-8H4" />
                </Icon>
                Assign Venue Manager
              </button>
            </div>

            {approversLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-white border border-[#e8f5ee] animate-pulse" />
                ))}
              </div>
            ) : approversError ? (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-[13px] text-red-600 font-medium">
                {approversError}
              </div>
            ) : approvers.length === 0 ? (
              <div className="bg-white border border-[#e8f5ee] rounded-xl px-4 py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-[#f0fdf4] flex items-center justify-center mx-auto mb-3 text-[#15803d]">
                  <Icon className="w-5 h-5">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                  </Icon>
                </div>
                <p className="text-[13px] font-semibold text-[#374151]">No venue managers assigned</p>
                <p className="text-[12px] text-[#94a3b8] mt-1">
                  Click <span className="font-bold text-[#15803d]">Assign Venue Manager</span> to add one.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {approvers.map((approver) => (
                  <ManagerCard key={approver.id} approver={approver} />
                ))}
              </div>
            )}
          </div>

          {/* Bottom padding */}
          <div className="h-6" />
        </div>
      </div>

      {/* ── Assign Approver Modal (reused, prefilled) ── */}
      <AssignApproverModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        onRefresh={() => {
          setAssignModalOpen(false)
          fetchApprovers()
        }}
        defaultScopeType="SPACE"
        defaultSpaceId={space.id}
      />
    </>
  )
}
