import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useFacultyPending, useResolveFacultyApproval } from '../hooks/useApprovalQueries'
import { useSpaceCatalog } from '../hooks/useSpaceQueries'
import MainLayout from '../layouts/MainLayout'
import toast from 'react-hot-toast'
import {
  CheckCircle2, XCircle, Clock, ChevronRight, RefreshCw,
  User, Phone, Mail, Building2, Users, CalendarDays, FileText,
  X, MapPin, BookOpen, Briefcase, Hash, Info, CheckSquare, AlertCircle,
  Search
} from 'lucide-react'

/* ── Helpers ─────────────────────────────────────────────── */
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtTime = (s) => s ? new Date(s).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—'
const fmtDateTime = (s) => s ? `${fmtDate(s)}, ${fmtTime(s)}` : '—'

const STATUS_META = {
  APPROVED: { label: 'Approved', cls: 'bg-green-100 text-green-700 border-green-200' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-700 border-red-200' },
  AWAITING_FACULTY: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  FACULTY_ESCALATED: { label: 'Needs Higher Approval', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  PENDING: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  EXPIRED: { label: 'Expired', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

const getStatusMeta = (s) => STATUS_META[s?.toUpperCase()] || { label: s || 'Unknown', cls: 'bg-gray-100 text-gray-500 border border-gray-200' }

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function avatarColor(name) {
  const colors = ['bg-blue-600', 'bg-violet-600', 'bg-pink-600', 'bg-teal-600', 'bg-orange-600', 'bg-cyan-600', 'bg-indigo-600']
  const idx = name ? name.charCodeAt(0) % colors.length : 0
  return colors[idx]
}

/* ── Status Badge ────────────────────────────────────────── */
function StatusBadge({ status }) {
  const meta = getStatusMeta(status)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${meta.cls}`}>
      {meta.label}
    </span>
  )
}

/* ── Avatar ──────────────────────────────────────────────── */
function Avatar({ name, size = 'md', imageUrl = null }) {
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'

  const getProfileImageUrl = (path) => {
    if (!path) return ""
    if (path.startsWith("http://") || path.startsWith("https://")) return path
    return `http://localhost:8000${path.startsWith("/") ? "" : "/"}${path}`
  }

  return (
    <div className={`${sz} ${!imageUrl ? avatarColor(name) : 'bg-gray-100'} rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm overflow-hidden select-none`}>
      {imageUrl ? (
        <img src={getProfileImageUrl(imageUrl)} alt={name || "User"} className="w-full h-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  )
}

/* ── Detail Row (sidebar) ─────────────────────────────────── */
function SideDetailRow({ icon: Icon, label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm text-gray-900 font-medium leading-snug break-words">{value}</p>
      </div>
    </div>
  )
}

/* ── Timeline Step ───────────────────────────────────────── */
function TimelineStep({ icon: Icon, label, time, active, done, last }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${done ? 'bg-green-500 border-green-500 text-white' :
          active ? 'bg-amber-400 border-amber-400 text-white' :
            'bg-white border-gray-200 text-gray-300'
          }`}>
          <Icon className="w-4 h-4" />
        </div>
        {!last && <div className={`w-0.5 flex-1 mt-1 mb-1 rounded-full ${done ? 'bg-green-200' : 'bg-gray-100'}`} style={{ minHeight: '20px' }} />}
      </div>
      <div className="pb-4 min-w-0">
        <p className={`text-sm font-semibold ${done ? 'text-green-700' : active ? 'text-amber-700' : 'text-gray-400'}`}>{label}</p>
        {time && <p className="text-xs text-gray-500 mt-0.5">{fmtDateTime(time)}</p>}
      </div>
    </div>
  )
}

/* ── Detail Sidebar ──────────────────────────────────────── */
function DetailSidebar({ booking, onClose, onApprove, onReject, isActing, currentUser }) {
  const [note, setNote] = useState('')
  const [noteErr, setNoteErr] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)
  const isPending = ['AWAITING_FACULTY', 'PENDING'].includes(booking?.status?.toUpperCase())

  useEffect(() => {
    setNote(''); setNoteErr(''); setIsRejecting(false);
  }, [booking?.id])

  if (!booking) return null

  const handleRejectConfirm = () => {
    if (!note.trim() || note.trim().length < 10) {
      setNoteErr('Please provide a reason (min 10 chars).')
      return
    }
    setNoteErr('')
    onReject(booking.id, note)
  }

  const status = booking.status?.toUpperCase()
  const isDone = ['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(status)
  const isRejected = status === 'REJECTED'

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[420px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-100"
        style={{ animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={booking.booked_by_name} size="lg" />
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 text-sm truncate">{booking.booked_by_name || '—'}</h2>
              <p className="text-xs text-gray-500 truncate">{booking.booked_by_email || '—'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 bg-white">

          {/* Status + Venue */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={booking.status} />
            {booking.space_details?.name && (
              <span className="text-xs font-semibold uppercase tracking-wide bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-1 rounded-lg">
                {booking.space_details.name}
              </span>
            )}
          </div>

          {/* Core booking details */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 border-b border-gray-100 pb-2">Booking Details</p>
            <div className="space-y-4">
              <SideDetailRow icon={MapPin} label="Venue" value={booking.space_details?.name} />
              <SideDetailRow icon={CalendarDays} label="Date" value={fmtDate(booking.start_datetime)} />
              <SideDetailRow icon={Clock} label="Time" value={`${fmtTime(booking.start_datetime)} – ${fmtTime(booking.end_datetime)}`} />
              <SideDetailRow icon={BookOpen} label="Purpose" value={booking.purpose_of_booking} />
              <SideDetailRow icon={Users} label="Attendees" value={booking.attendee_count} />
              <SideDetailRow icon={Briefcase} label="Event Type" value={booking.is_external_event ? 'External Event' : 'Internal / Departmental'} />
            </div>
          </section>

          {/* Student info */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 border-b border-gray-100 pb-2">Student Info</p>
            <div className="space-y-4">
              <SideDetailRow icon={User} label="Name" value={booking.booked_by_name} />
              <SideDetailRow icon={Mail} label="Email" value={booking.booked_by_email} />
              <SideDetailRow icon={Phone} label="Phone" value={booking.booked_by_phone} />
              <SideDetailRow icon={Building2} label="Department" value={booking.booked_by_department} />
            </div>
          </section>

          {/* Equipment */}
          {(booking.equipment_requested?.length > 0 || booking.equipment_notes) && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 border-b border-gray-100 pb-2">Equipment Requested</p>
              <div className="space-y-4">
                {booking.equipment_requested?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {booking.equipment_requested.map((eq, i) => (
                      <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg font-semibold shadow-sm">
                        {eq?.name || eq}
                      </span>
                    ))}
                  </div>
                )}
                <SideDetailRow icon={FileText} label="Equipment Notes" value={booking.equipment_notes} />
              </div>
            </section>
          )}

          {/* Additional info */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 border-b border-gray-100 pb-2">Additional Info</p>
            <div className="space-y-4">
              {(booking.faculty_sponsor_name || booking.faculty_sponsor) && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Avatar
                      name={booking.faculty_sponsor_name || booking.faculty_sponsor}
                      size="sm"
                      imageUrl={currentUser?.profile_image}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Faculty In-Charge</p>
                    <p className="text-sm text-gray-900 font-medium leading-snug break-words">{booking.faculty_sponsor_name || booking.faculty_sponsor}</p>
                  </div>
                </div>
              )}
              <SideDetailRow icon={FileText} label="Notes" value={booking.user_notes} />
              <SideDetailRow icon={Info} label="Booking ID" value={`#${booking.id}`} />
              <SideDetailRow icon={CalendarDays} label="Submitted On" value={fmtDateTime(booking.created_at)} />
            </div>
          </section>

          {/* Rejection note (history) */}
          {isRejected && booking.rejection_note && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 border-b border-gray-100 pb-2">Rejection Reason</p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm font-medium text-red-800 shadow-sm">
                {booking.rejection_note}
              </div>
            </section>
          )}

          {/* Approval Timeline */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-100 pb-2">Approval Timeline</p>
            <div className="space-y-0">
              <TimelineStep
                icon={CheckSquare}
                label="Booking Submitted"
                time={booking.created_at}
                done={true}
                active={false}
                last={false}
              />
              <TimelineStep
                icon={User}
                label="Faculty Review"
                time={isDone ? (booking.faculty_reviewed_at || booking.updated_at) : null}
                done={isDone}
                active={!isDone}
                last={!['FACULTY_ESCALATED'].includes(status)}
              />
              {status === 'FACULTY_ESCALATED' && (
                <TimelineStep
                  icon={AlertCircle}
                  label="Escalated to In-Charge"
                  time={booking.updated_at}
                  done={false}
                  active={true}
                  last={true}
                />
              )}
            </div>
          </section>
        </div>

        {/* Action footer — only for pending */}
        {isPending && (
          <div className="shrink-0 border-t border-gray-100 px-6 py-5 bg-gray-50/80 backdrop-blur-md">
            {isRejecting ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <textarea
                  rows={3}
                  placeholder="Enter rejection reason..."
                  value={note}
                  onChange={e => { setNote(e.target.value); setNoteErr('') }}
                  className={`w-full text-sm border rounded-xl p-4 resize-y min-h-[100px] outline-none transition focus:ring-2 shadow-sm ${noteErr ? 'border-red-300 bg-red-50 focus:ring-red-100' : 'border-gray-200 bg-white focus:ring-red-100 focus:border-red-400'
                    }`}
                />
                {noteErr && <p className="text-[11px] text-red-600 uppercase font-bold tracking-wide -mt-2">{noteErr}</p>}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setIsRejecting(false); setNoteErr(''); setNote(''); }}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-100 transition shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRejectConfirm}
                    disabled={isActing}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-sm shadow-sm"
                  >
                    Confirm Reject
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onApprove(booking.id)}
                  disabled={isActing}
                  className="flex-[2] flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-sm shadow-sm"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {isActing ? 'Processing…' : 'Approve Request'}
                </button>
                <button
                  onClick={() => setIsRejecting(true)}
                  className="flex-1 flex items-center justify-center gap-2 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 font-semibold py-3 rounded-xl transition text-sm shadow-sm"
                >
                  <XCircle className="w-5 h-5" />
                  Reject
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0);    }
        }
      `}</style>
    </>
  )
}

/* ── Request Row ─────────────────────────────────────────── */
function RequestRow({ booking, onSelect, onApprove, onReject, isActing }) {
  const isPending = ['AWAITING_FACULTY', 'PENDING'].includes(booking.status?.toUpperCase())
  const [isRejecting, setIsRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [noteErr, setNoteErr] = useState('')

  const handleApproveClick = (e) => {
    e.stopPropagation()
    onApprove(booking.id)
  }

  const handleRejectInit = (e) => {
    e.stopPropagation()
    setIsRejecting(true)
  }

  const handleRejectCancel = (e) => {
    e.stopPropagation()
    setIsRejecting(false)
    setNote('')
    setNoteErr('')
  }

  const handleRejectConfirm = (e) => {
    e.stopPropagation()
    if (!note.trim() || note.trim().length < 10) {
      setNoteErr('Please provide a reason (min 10 chars).')
      return
    }
    onReject(booking.id, note)
  }

  return (
    <>
      <div
        onClick={() => !isRejecting && onSelect(booking)}
        className={`group flex flex-col md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_120px_100px_40px] items-center gap-4 px-6 py-4 transition-all border-b border-gray-100 last:border-none ${isRejecting ? 'bg-gray-50/50' : 'hover:bg-gray-50 cursor-pointer bg-white'
          }`}
      >
        {/* Student */}
        <div className="flex items-center gap-4 w-full min-w-0">
          <Avatar name={booking.booked_by_name} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{booking.booked_by_name || '—'}</p>
            <p className="text-xs text-gray-500 truncate mt-0.5">{booking.booked_by_email || '—'}</p>
          </div>
        </div>

        {/* Venue */}
        <div className="w-full min-w-0 md:block hidden">
          <p className="text-sm font-medium text-gray-800 truncate">{booking.space_details?.name || '—'}</p>
        </div>

        {/* Date & Time */}
        <div className="w-full min-w-0 md:block hidden">
          <p className="text-sm font-medium text-gray-700">{fmtDate(booking.start_datetime)}</p>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mt-1">{fmtTime(booking.start_datetime)} – {fmtTime(booking.end_datetime)}</p>
        </div>

        {/* Status */}
        <div className="w-full md:block hidden">
          <StatusBadge status={booking.status} />
        </div>

        {/* Actions */}
        <div className="w-full md:w-auto md:justify-self-end flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
          {isPending ? (
            <>
              <button
                onClick={handleApproveClick}
                disabled={isActing || isRejecting}
                title="Approve Request"
                className="w-8 h-8 rounded-full flex items-center justify-center text-green-600 bg-green-50 hover:bg-green-100 border border-green-200 transition disabled:opacity-50 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleRejectInit}
                disabled={isActing || isRejecting}
                title="Reject Request"
                className="w-8 h-8 rounded-full flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition disabled:opacity-50 shadow-sm"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          ) : (
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Resolved</span>
          )}
        </div>

        {/* Expand Icon */}
        <div className="hidden md:flex justify-end">
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition" />
        </div>
      </div>

      {/* Inline Reject Expansion */}
      {isRejecting && (
        <div className="px-6 py-5 bg-gray-50 border-b border-gray-100 flex flex-col items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="w-full">
            <textarea
              rows={3}
              placeholder="Enter rejection reason..."
              value={note}
              onChange={e => { setNote(e.target.value); setNoteErr('') }}
              className={`w-full text-sm border rounded-xl p-4 resize-y min-h-[100px] outline-none transition focus:ring-2 shadow-sm ${noteErr ? 'border-red-300 bg-white focus:ring-red-100' : 'border-gray-200 focus:ring-gray-100 focus:border-red-400 bg-white'
                }`}
            />
            {noteErr && <p className="text-[10px] text-red-600 font-bold uppercase mt-1.5">{noteErr}</p>}
          </div>
          <div className="flex items-center justify-end gap-3 w-full md:w-auto self-end shrink-0">
            <button onClick={handleRejectCancel} className="px-6 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition shadow-sm">
              Cancel
            </button>
            <button onClick={handleRejectConfirm} disabled={isActing} className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 shadow-sm">
              <XCircle className="w-4 h-4" />
              Confirm Reject
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Filter Tabs ─────────────────────────────────────────── */
const TABS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'ALL', label: 'All' },
]

/* ── Main Page ───────────────────────────────────────────── */
export default function FacultyApprovalPage() {
  const { user } = useAuth()
  const { data: facultyData, isLoading: loading, isError: loadError, refetch: fetchData } = useFacultyPending()
  const { data: spacesData } = useSpaceCatalog()

  const pending = facultyData?.pending || []
  const history = facultyData?.history || []
  const allItems = useMemo(() => [...pending, ...history], [pending, history])

  const [activeTab, setActiveTab] = useState('PENDING')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [actingId, setActingId] = useState(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [venueFilter, setVenueFilter] = useState('ALL')
  const [dateFilter, setDateFilter] = useState('')

  const resolveMutation = useResolveFacultyApproval()

  // Extract all system venues
  const venues = useMemo(() => {
    if (!spacesData) return []
    return [...new Set(spacesData.map(s => s.name))].sort()
  }, [spacesData])

  // Close sidebar when tab changes
  useEffect(() => { setSelectedBooking(null) }, [activeTab])

  const handleApprove = async (id) => {
    setActingId(id)
    try {
      await resolveMutation.mutateAsync({ id, action: 'approve' })
      toast.success('Booking approved successfully!')
      setSelectedBooking(null)
    } catch {
      toast.error("Couldn't approve. Please try again.")
    } finally {
      setActingId(null)
    }
  }

  const handleReject = async (id, note) => {
    setActingId(id)
    try {
      await resolveMutation.mutateAsync({ id, action: 'reject', rejectionNote: note })
      toast.success('Booking request rejected.')
      setSelectedBooking(null)
    } catch {
      toast.error("Couldn't reject. Please try again.")
    } finally {
      setActingId(null)
    }
  }

  const tabCounts = useMemo(() => ({
    PENDING: pending.length,
    APPROVED: history.filter(h => h.status?.toUpperCase() === 'APPROVED').length,
    REJECTED: history.filter(h => h.status?.toUpperCase() === 'REJECTED').length,
    EXPIRED: history.filter(h => h.status?.toUpperCase() === 'EXPIRED').length,
    ALL: allItems.length,
  }), [pending, history, allItems])

  const visibleItems = useMemo(() => {
    let items = []
    if (activeTab === 'ALL') {
      items = allItems
    } else if (activeTab === 'PENDING') {
      items = pending
    } else {
      items = history.filter(h => h.status?.toUpperCase() === activeTab)
    }

    // Apply toolbar filters
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(b =>
        b.booked_by_name?.toLowerCase().includes(q) ||
        b.purpose_of_booking?.toLowerCase().includes(q) ||
        b.booked_by_email?.toLowerCase().includes(q) ||
        b.space_details?.name?.toLowerCase().includes(q)
      )
    }

    if (venueFilter !== 'ALL') {
      items = items.filter(b => b.space_details?.name === venueFilter)
    }

    if (dateFilter) {
      items = items.filter(b => b.start_datetime?.startsWith(dateFilter))
    }

    return items
  }, [activeTab, allItems, pending, history, searchQuery, venueFilter, dateFilter])

  if (!user?.capabilities?.can_approve_faculty) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <XCircle className="w-7 h-7 text-red-500" />
            </div>
            <p className="text-base font-semibold text-gray-900">Access Denied</p>
            <p className="text-sm text-gray-500 mt-1">Only authorised faculty members can view this page.</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-[1280px] space-y-6">

        {/* Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
              My Approvals
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Review and manage student booking requests requiring your approval.
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Top status cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Pending */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-5 transition hover:shadow-md">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-sm">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              {loading ? <div className="h-7 w-12 bg-gray-100 animate-pulse rounded mb-1" /> : <p className="text-2xl font-bold text-gray-900 leading-tight">{tabCounts.PENDING}</p>}
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mt-0.5">Pending</p>
            </div>
          </div>
          {/* Approved */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-5 transition hover:shadow-md">
            <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 text-green-700 flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              {loading ? <div className="h-7 w-12 bg-gray-100 animate-pulse rounded mb-1" /> : <p className="text-2xl font-bold text-gray-900 leading-tight">{tabCounts.APPROVED}</p>}
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mt-0.5">Approved</p>
            </div>
          </div>
          {/* Rejected */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-5 transition hover:shadow-md">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shrink-0 shadow-sm">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              {loading ? <div className="h-7 w-12 bg-gray-100 animate-pulse rounded mb-1" /> : <p className="text-2xl font-bold text-gray-900 leading-tight">{tabCounts.REJECTED}</p>}
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mt-0.5">Rejected</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 hide-scrollbar">
          {TABS.map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap border ${isActive
                  ? 'bg-green-700 text-white border-green-700 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                  }`}
              >
                {tab.label}
                <span className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[11px] font-bold rounded-full transition-colors ${isActive ? 'bg-green-600 text-white shadow-inner' : 'bg-gray-100 text-gray-500'
                  }`}>
                  {tabCounts[tab.key]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-4 py-4 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search students, venues, or purpose..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white focus:ring-2 focus:ring-green-100 rounded-xl outline-none transition"
            />
          </div>
          <div className="relative w-full md:w-64">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={venueFilter}
              onChange={e => setVenueFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 text-sm bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white focus:ring-2 focus:ring-green-100 rounded-xl outline-none transition appearance-none cursor-pointer"
            >
              <option value="ALL">All Venues</option>
              {venues.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="relative w-full md:w-56">
            <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white focus:ring-2 focus:ring-green-100 rounded-xl outline-none transition cursor-pointer"
            />
          </div>
        </div>

        {/* Error */}
        {loadError && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 text-sm text-red-700 font-medium shadow-sm">
            Couldn't load booking requests. Please try again.
          </div>
        )}

        {/* Request List */}
        {!loadError && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[300px]">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_120px_100px_40px] items-center gap-4 px-6 py-4 border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <div>Student</div>
              <div>Venue</div>
              <div>Date & Time</div>
              <div>Status</div>
              <div className="text-right">Actions</div>
              <div></div>
            </div>

            <div className="flex flex-col">
              {loading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-4 px-6 py-5 border-b border-gray-100 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-1/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                  </div>
                ))
              ) : visibleItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-base font-semibold text-gray-900">No {activeTab !== 'ALL' ? activeTab.toLowerCase() : ''} requests found</p>
                  <p className="text-sm text-gray-500 mt-1 max-w-sm">
                    {activeTab === 'PENDING' ? 'You are all caught up! There are no pending requests waiting for your approval.' : 'Try adjusting your filters or search query.'}
                  </p>
                </div>
              ) : (
                visibleItems.map(b => (
                  <RequestRow
                    key={b.id}
                    booking={b}
                    onSelect={setSelectedBooking}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    isActing={actingId === b.id}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detail Sidebar */}
      {selectedBooking && (
        <DetailSidebar
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          isActing={actingId === selectedBooking.id}
          currentUser={user}
        />
      )}
    </MainLayout>
  )
}