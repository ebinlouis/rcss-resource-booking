import { useState, useEffect, useCallback } from "react"
import api from "../../api/axios"
import SpaceFormModal from "../../components/admin/SpaceFormModal"

// ─────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────

const SPACE_TYPE_META = {
  GENERAL_HALL: { label: "General Hall", color: "bg-[#dcfce7] text-[#14532d] border-[#bbf7d0]" },
  LAB:          { label: "Laboratory",   color: "bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]" },
  GUEST_ROOM:   { label: "Guest Room",   color: "bg-[#fef3c7] text-[#92400e] border-[#fde68a]" },
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

const IconPlus = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v16m8-8H4" />
  </svg>
)

const IconPencil = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z" />
  </svg>
)

const IconBuilding = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 8h.01M15 8h.01M9 13h.01M15 13h.01" />
  </svg>
)

const IconRefresh = ({ spinning, className = "w-4 h-4" }) => (
  <svg
    className={className}
    style={spinning ? { animation: "spin 0.7s linear infinite" } : {}}
    viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"
  >
    <path d="M1 4v6h6M23 20v-6h-6" />
    <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" />
  </svg>
)

const IconSearch = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)

const IconUsers = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
)

const IconLock = ({ className = "w-3 h-3" }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
  </svg>
)

const IconAlert = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

// ─────────────────────────────────────────────────────────────
// Space Card
// ─────────────────────────────────────────────────────────────

function SpaceCard({ space, onEdit }) {
  const typeMeta = SPACE_TYPE_META[space.space_type] ?? {
    label: space.space_type,
    color: "bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]",
  }

  return (
    <div
      className={`bg-white rounded-2xl border overflow-hidden flex flex-col transition-all duration-200
        hover:shadow-md hover:-translate-y-0.5 group
        ${space.is_active ? "border-[#e8f5ee]" : "border-[#e2e8f0] opacity-60"}`}
      style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
    >
      {/* Image */}
      <div className="relative h-36 bg-[#f0fdf4] overflow-hidden shrink-0">
        {space.image_1 ? (
          <img
            src={space.image_1}
            alt={space.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#d1fae5]">
            <IconBuilding className="w-10 h-10" />
          </div>
        )}

        {/* Overlay badges */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${typeMeta.color}`}>
            {typeMeta.label}
          </span>
          {space.is_special_purpose && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-200">
              <IconLock className="w-2.5 h-2.5" /> Special
            </span>
          )}
        </div>

        {!space.is_active && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] bg-white/80 px-3 py-1 rounded-full border border-[#e2e8f0]">
              Inactive
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-[#0f172a] leading-tight tracking-tight">
            {space.name}
          </h3>
          <p className="text-[12.5px] text-[#6b7280] mt-0.5 leading-tight">{space.location || "—"}</p>
        </div>

        {/* Capacity & equipment */}
        <div className="flex items-center gap-3">
          {space.capacity_hard && (
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#374151]">
              <IconUsers />
              {space.capacity_hard} seats
            </span>
          )}
          {space.built_in_equipment?.length > 0 && (
            <span className="text-[11.5px] text-[#94a3b8] font-medium">
              · {space.built_in_equipment.length} equipment item{space.built_in_equipment.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {space.description && (
          <p className="text-[12px] text-[#94a3b8] leading-relaxed line-clamp-2">
            {space.description}
          </p>
        )}

        {/* Edit button */}
        <div className="mt-auto pt-1">
          <button
            onClick={() => onEdit(space)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#d1fae5]
              text-[13px] font-semibold text-[#15803d] hover:bg-[#f0fdf4] transition"
          >
            <IconPencil className="w-3.5 h-3.5" />
            Edit Space
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

const AdminSpacesPage = () => {
  const [spaces, setSpaces] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshCount, setRefreshCount] = useState(0)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // null = create, object = edit

  // Filter/search
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState("ALL")
  const [filterActive, setFilterActive] = useState("ALL") // ALL | ACTIVE | INACTIVE

  // ── Load spaces ──
  useEffect(() => {
    let isMounted = true
    const fetchSpaces = async () => {
      setIsLoading(true)
      try {
        const res = await api.get("/spaces/catalog/")
        if (isMounted) {
          setSpaces(res.data.results ?? res.data ?? [])
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.response?.status === 401
              ? "You don't have permission to manage spaces."
              : "Could not load spaces. Please check your connection."
          )
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    fetchSpaces()
    return () => { isMounted = false }
  }, [refreshCount])

  const handleRefresh = () => {
    setIsLoading(true)
    setRefreshCount((c) => c + 1)
  }

  const openCreate = () => {
    setEditTarget(null)
    setModalOpen(true)
  }

  const openEdit = useCallback((space) => {
    setEditTarget(space)
    setModalOpen(true)
  }, [])

  const handleSaved = () => {
    // Refresh list after save; modal stays open until user clicks "Done"
    setRefreshCount((c) => c + 1)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setEditTarget(null)
    // Refresh in case something was saved
    setRefreshCount((c) => c + 1)
  }

  // ── Filtering ──
  const filtered = spaces.filter((s) => {
    const matchQuery =
      !searchQuery ||
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.location?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchType = filterType === "ALL" || s.space_type === filterType

    const matchActive =
      filterActive === "ALL" ||
      (filterActive === "ACTIVE" && s.is_active) ||
      (filterActive === "INACTIVE" && !s.is_active)

    return matchQuery && matchType && matchActive
  })

  // ── Stats ──
  const totalActive = spaces.filter((s) => s.is_active).length
  const totalSpecial = spaces.filter((s) => s.is_special_purpose).length
  const totalCapacity = spaces.reduce((sum, s) => sum + (s.capacity_hard || 0), 0)

  return (
    <div
      className="min-h-full bg-[#f6fbf8] p-6 md:p-8"
      style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Modal */}
      {modalOpen && (
        <SpaceFormModal
          initialData={editTarget}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}

      <div className="max-w-[1200px] mx-auto">

        {/* ── Page Header ── */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#6b7280] mb-1.5">
              Rajagiri College · System Admin
            </p>
            <h1 className="text-[26px] font-bold text-[#0f172a] tracking-tight leading-none">
              Manage Spaces
            </h1>
            <p className="text-[15px] text-[#374151] mt-2">
              {error
                ? "Something went wrong loading spaces"
                : isLoading
                  ? "Loading catalog…"
                  : `${spaces.length} space${spaces.length !== 1 ? "s" : ""} in the booking catalog`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#d1fae5] bg-white text-[13.5px] text-[#4a6b58] hover:bg-[#f0fdf4] transition disabled:opacity-40"
            >
              <IconRefresh spinning={isLoading} />
              Refresh
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-[13.5px] font-semibold transition shadow-sm"
            >
              <IconPlus />
              Add New Space
            </button>
          </div>
        </div>

        {/* ── Stat strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
          {[
            { value: spaces.length,  label: "Total spaces" },
            { value: totalActive,    label: "Active" },
            { value: totalSpecial,   label: "Special purpose" },
            { value: totalCapacity,  label: "Total seat capacity" },
          ].map(({ value, label }) => (
            <div key={label} className="bg-white border border-[#e8f5ee] rounded-2xl px-5 py-4">
              <p className="text-[30px] font-light text-[#0f172a] tracking-tight leading-none">{value}</p>
              <p className="text-[13px] font-medium text-[#374151] mt-2">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="bg-white border border-[#e8f5ee] rounded-2xl px-5 py-4 mb-6 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name or location…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-[13.5px] border border-[#e2e8f0] rounded-xl
                outline-none focus:ring-2 focus:ring-[#15803d] focus:border-transparent
                text-[#0f172a] placeholder:text-[#94a3b8]"
              style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
            />
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1.5">
            {["ALL", "GENERAL_HALL", "LAB", "GUEST_ROOM"].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3.5 py-1.5 rounded-xl text-[12.5px] font-semibold transition border
                  ${filterType === type
                    ? "bg-[#15803d] text-white border-[#15803d]"
                    : "bg-white text-[#374151] border-[#e2e8f0] hover:bg-[#f0fdf4] hover:border-[#d1fae5]"}`}
              >
                {type === "ALL"
                  ? "All types"
                  : SPACE_TYPE_META[type]?.label ?? type}
              </button>
            ))}
          </div>

          {/* Active filter */}
          <div className="flex items-center gap-1.5">
            {[
              { value: "ALL", label: "All" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterActive(value)}
                className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition border
                  ${filterActive === value
                    ? "bg-[#0f172a] text-white border-[#0f172a]"
                    : "bg-white text-[#374151] border-[#e2e8f0] hover:border-[#94a3b8]"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        {error ? (
          <div className="bg-white border border-[#e8f5ee] rounded-2xl py-20 text-center px-8">
            <div className="w-12 h-12 rounded-full bg-[#fef2f2] flex items-center justify-center mx-auto mb-4 text-[#dc2626]">
              <IconAlert />
            </div>
            <p className="text-[15px] font-semibold text-[#0f172a]">Could not load spaces</p>
            <p className="text-[13.5px] text-[#94a3b8] mt-1.5">{error}</p>
          </div>
        ) : isLoading && spaces.length === 0 ? (
          <div className="bg-white border border-[#e8f5ee] rounded-2xl py-20 text-center">
            <p className="text-[14px] text-[#94a3b8]">Loading spaces…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-[#e8f5ee] rounded-2xl py-20 text-center px-8">
            <div className="w-12 h-12 rounded-full bg-[#f0fdf4] flex items-center justify-center mx-auto mb-4 text-[#15803d]">
              <IconBuilding />
            </div>
            <p className="text-[15px] font-semibold text-[#0f172a]">
              {spaces.length === 0 ? "No spaces yet" : "No spaces match your filters"}
            </p>
            <p className="text-[13.5px] text-[#94a3b8] mt-1.5">
              {spaces.length === 0
                ? "Click \"Add New Space\" to create the first one."
                : "Try adjusting your search or filter options."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((space) => (
              <SpaceCard key={space.id} space={space} onEdit={openEdit} />
            ))}
          </div>
        )}

        {/* Results count when filtering */}
        {!error && !isLoading && filtered.length > 0 && (searchQuery || filterType !== "ALL" || filterActive !== "ALL") && (
          <p className="text-center text-[12.5px] text-[#94a3b8] font-medium mt-5">
            Showing {filtered.length} of {spaces.length} spaces
          </p>
        )}
      </div>
    </div>
  )
}

export default AdminSpacesPage