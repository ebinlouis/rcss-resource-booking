import { createPortal } from "react-dom"

/* ---------- ICON WRAPPERS ---------- */
const IconBox = ({ children, color = "green" }) => {
  const colors = {
    green:  "bg-green-100  text-green-600",
    blue:   "bg-blue-100   text-blue-600",
    purple: "bg-purple-100 text-purple-600",
    yellow: "bg-yellow-100 text-yellow-600",
  }
  return (
    <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${colors[color]}`}>
      {children}
    </div>
  )
}

/* ---------- ICONS ---------- */
const CameraIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="7" width="18" height="14" rx="2" />
    <circle cx="12" cy="14" r="3" />
    <path d="M8 7l1.5-3h5L16 7" />
  </svg>
)

const CalendarIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const ClockIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
)

const LocationIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z" />
    <circle cx="12" cy="11" r="2" />
  </svg>
)

const UserIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="7" r="4" />
    <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
  </svg>
)

const BuildingIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="7" width="18" height="14" />
    <path d="M9 7V3h6v4" />
  </svg>
)

const ShieldIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const FileIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="12" y2="17" />
  </svg>
)

const ServiceIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="7" width="18" height="14" rx="2" />
    <circle cx="12" cy="14" r="3" />
  </svg>
)

const GearIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const PrintIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
)

const EditIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

/* ---------- SECTION CARD ---------- */
const SectionCard = ({ icon, title, color, children }) => (
  <div className="border border-gray-200 rounded-xl p-5 h-full flex flex-col">
    <div className="flex items-center gap-2 font-semibold text-sm text-gray-800 mb-4">
      <IconBox color={color}>{icon}</IconBox>
      <span>{title}</span>
    </div>
    <div className="space-y-3 text-sm flex-1">{children}</div>
  </div>
)

/* ---------- INFO ROW ---------- */
const InfoRow = ({ icon, label, value }) => (
  <div className="flex justify-between items-center">
    <div className="flex items-center gap-2 text-gray-500">
      {icon}
      <span>{label}</span>
    </div>
    <span className="font-medium text-gray-800 text-right">{value}</span>
  </div>
)

/* ---------- MAIN COMPONENT ---------- */
function MediaBookingDetailsModal({ booking, onClose }) {
  if (!booking) return null

  const statusColor =
    booking.status === "confirmed"
      ? "bg-green-100 text-green-700"
      : "bg-yellow-100 text-yellow-700"

  const statusLabel =
    booking.status
      ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1)
      : "Unknown"

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col">

        <div className="p-6">

          {/* ── HEADER ── */}
          <div className="flex justify-between items-center border-b pb-4 mb-4">
            {/* Left */}
            <div className="flex items-center gap-3">
              <IconBox color="green">
                <CameraIcon />
              </IconBox>
              <div>
                <h2 className="text-base font-semibold text-gray-900 leading-tight">
                  Booking Details
                </h2>
                <p className="text-xs text-gray-500">Full information about this booking</p>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${statusColor}`}>
                • {statusLabel}
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-lg font-light"
              >
                ×
              </button>
            </div>
          </div>

          {/* ── EVENT SUMMARY ROW ── */}
          <div className="flex justify-between items-center py-4 border-b mb-5">
            {/* Left — Event name + subtitle */}
            <div className="flex items-center gap-3">
              <IconBox color="green">
                <CameraIcon />
              </IconBox>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                  {booking.event_name || "N/A"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {booking.hall_name || "N/A"} &nbsp;•&nbsp; {booking.service_type || "Media"}
                </p>
              </div>
            </div>

            {/* Right — Date + Time */}
            <div className="flex flex-col items-end gap-1 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <CalendarIcon />
                <span>{booking.booking_date || "N/A"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ClockIcon />
                <span>{booking.start_time} – {booking.end_time}</span>
              </div>
            </div>
          </div>

          {/* ── 2×2 GRID ── */}
          <div className="grid grid-cols-2 gap-5">

            {/* ─ Booking Information (green) ─ */}
            <SectionCard
              icon={<CalendarIcon />}
              title="Booking Information"
              color="green"
            >
              <InfoRow
                icon={<CalendarIcon className="w-4 h-4 text-gray-400" />}
                label="Booking Date"
                value={booking.booking_date || "N/A"}
              />
              <InfoRow
                icon={<ClockIcon className="w-4 h-4 text-gray-400" />}
                label="Time"
                value={`${booking.start_time} – ${booking.end_time}`}
              />
              <InfoRow
                icon={<LocationIcon className="w-4 h-4 text-gray-400" />}
                label="Hall / Location"
                value={booking.hall_name || "N/A"}
              />
            </SectionCard>

            {/* ─ Request Information (blue) ─ */}
            <SectionCard
              icon={<UserIcon />}
              title="Request Information"
              color="blue"
            >
              <InfoRow
                icon={<UserIcon className="w-4 h-4 text-gray-400" />}
                label="Requested By"
                value={booking.requested_by || "N/A"}
              />
              <InfoRow
                icon={<BuildingIcon className="w-4 h-4 text-gray-400" />}
                label="Department"
                value={booking.department_name || "N/A"}
              />
              <InfoRow
                icon={<ShieldIcon className="w-4 h-4 text-gray-400" />}
                label="Organization"
                value={booking.organization || "N/A"}
              />
            </SectionCard>

            {/* ─ Media Requirements (purple) ─ */}
            <SectionCard
              icon={<ServiceIcon />}
              title="Media Requirements"
              color="purple"
            >
              <InfoRow
                icon={<ServiceIcon className="w-4 h-4 text-gray-400" />}
                label="Service Type"
                value={booking.service_type || "N/A"}
              />
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 text-gray-500">
                  <GearIcon className="w-4 h-4 text-gray-400" />
                  <span>Equipment</span>
                </div>
                <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                  {booking.equipment?.length > 0 ? (
                    booking.equipment.map((eq, i) => (
                      <span
                        key={i}
                        className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-700"
                      >
                        {eq}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 italic text-sm">None</span>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* ─ Additional Information (yellow) ─ */}
            <SectionCard
              icon={<FileIcon />}
              title="Additional Information"
              color="yellow"
            >
              <InfoRow
                icon={<FileIcon className="w-4 h-4 text-gray-400" />}
                label="Remarks"
                value={booking.remarks || "None"}
              />
            </SectionCard>

          </div>
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="flex justify-between items-center border-t px-6 py-4">
          {/* Left — Print */}
          <button className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <PrintIcon />
            Print
          </button>

          {/* Right — Edit + Close */}
          <div className="flex gap-3">
            <button className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <EditIcon />
              Edit Booking
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  )
}

export default MediaBookingDetailsModal