import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    Building2, ChevronDown, Check, Mail, Package,
    Phone, RefreshCw, Settings, Wrench, X, Users,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import mediaApi from '../../api/mediaApi'
import PageInfo from '../../components/PageInfo'
import notificationService from '../../api/notificationService'
import { compareSubmissionTimeDesc, getSubmissionTimestamp } from '../../utils/submissionTime'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
    APPROVED:  'bg-green-100 text-green-700 border-green-200',
    PENDING:   'bg-yellow-100 text-yellow-800 border-yellow-200',
    REJECTED:  'bg-red-100 text-red-700 border-red-200',
    CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
    EXPIRED:   'bg-orange-100 text-orange-700 border-orange-200',
    COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// UPDATED: Now parses the full ISO string
const formatDate = (isoString) => {
    if (!isoString) return 'TBD'
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return 'TBD'
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// UPDATED: Now extracts time from the full ISO string
const formatTime = (isoString) => {
    if (!isoString) return 'TBD'
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return 'TBD'
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const timeAgo = (iso) => {
    if (!iso) return ''
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000))
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.round(mins / 60)
    return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`
}

const apiError = (err) =>
    err?.response?.data?.error || err?.response?.data?.detail || 'An unexpected error occurred.'

const normaliseReference = (value) => String(value || '').trim().toUpperCase()

// ── Shared primitives ─────────────────────────────────────────────────────────

const FieldLabel = ({ children }) => (
    <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[#6b7280]">{children}</p>
)

const StatusBadge = ({ status }) => (
    <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide ${STATUS_STYLES[status] ?? STATUS_STYLES.PENDING}`}>
        {status}
    </span>
)

const EventTypeBadge = ({ isExternal }) => isExternal ? (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-amber-700">
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        External Event
    </span>
) : (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-sky-600">
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zm5.99 7.176A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
        </svg>
        Internal Event
    </span>
)

// Backdrop wrapper shared across modals
const ModalBackdrop = ({ onClose, children }) => (
    <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
        onClick={onClose}
    >
        <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
)

// ── Modals ────────────────────────────────────────────────────────────────────

function TeamSettingsModal({ currentMax, onSave, onClose }) {
    const [value,   setValue]   = useState(String(currentMax ?? ''))
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState('')

    const parsed  = parseInt(value, 10)
    const isValid = !isNaN(parsed) && parsed >= 1 && parsed <= 20 && parsed !== currentMax

    const handleSave = async () => {
        if (!isValid) return
        setLoading(true); setError('')
        try {
            await onSave(parsed)
            onClose()
        } catch (err) {
            setError(apiError(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <ModalBackdrop onClose={onClose}>
            <div
                className="w-full max-w-[420px] rounded-2xl border border-[#e8f5ee] bg-white p-7 shadow-2xl shadow-black/10"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
            >
                <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0fdf4] text-[#15803d]">
                            <Settings className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[17px] font-bold tracking-tight text-[#0f172a]">Team Settings</p>
                            <p className="text-[13px] text-[#6b7280]">Adjust media team capacity</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#374151]">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="rounded-xl border border-[#e8f5ee] bg-[#f6fbf8] p-4 mb-5">
                    <p className="text-[13px] font-medium leading-relaxed text-[#374151]">
                        <span className="font-bold text-[#0f172a]">Max Concurrent Events</span> controls how many
                        team-coverage bookings can be approved to overlap at the same time. Reducing this value
                        will not affect already-approved bookings.
                    </p>
                </div>

                <label className="mb-2 block text-[12px] font-bold uppercase tracking-[0.1em] text-[#6b7280]">
                    Max Concurrent Events
                </label>
                <div className="flex items-center gap-3">
                    <input
                        type="number"
                        min={1}
                        max={20}
                        value={value}
                        onChange={(e) => { setValue(e.target.value); setError('') }}
                        className="w-full rounded-xl border border-[#dbe7df] bg-white px-4 py-3 text-[16px] font-semibold text-[#0f172a] outline-none transition focus:border-[#15803d] focus:ring-2 focus:ring-[#dcfce7]"
                        autoFocus
                    />
                    <span className="shrink-0 text-[13px] font-medium text-[#6b7280]">/ 20 max</span>
                </div>
                <p className="mt-2 text-[13px] text-[#6b7280]">Currently set to <strong>{currentMax}</strong>.</p>

                {error && (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13.5px] font-medium text-red-700">
                        {error}
                    </p>
                )}

                <div className="mt-6 flex justify-end gap-2.5">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-xl border border-[#e2e8f0] bg-white px-5 py-2.5 text-[14px] font-medium text-[#4b5563] hover:bg-[#f6fbf8] disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!isValid || loading}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#15803d] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#166534] disabled:opacity-40"
                    >
                        {loading ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </ModalBackdrop>
    )
}

function ApproveModal({ booking, onConfirm, onCancel, isLoading }) {
    if (!booking) return null
    return (
        <ModalBackdrop onClose={onCancel}>
            <div
                className="w-full max-w-[400px] rounded-2xl border border-[#e8f5ee] bg-white p-7 shadow-2xl shadow-black/10"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
            >
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#dcfce7]">
                    <Check className="h-6 w-6 text-[#15803d]" />
                </div>
                <p className="text-center text-[18px] font-bold tracking-tight text-[#0f172a]">Approve Booking?</p>
                <p className="mt-2 text-center text-[14.5px] leading-relaxed text-[#4b5563]">
                    Are you sure you want to approve this media request for{' '}
                    <span className="font-semibold text-[#0f172a]">{booking.user_details?.name || `User #${booking.user}`}</span>?
                </p>
                {booking.is_team_request && (
                    <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-left">
                        <p className="flex items-start gap-2 text-[13.5px] font-medium leading-relaxed text-purple-800">
                            <Users className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
                            <span>
                                <strong className="font-bold">Media Team Coverage:</strong> Approving this will reserve team
                                capacity and automatically allocate the Standard Gear Kit.
                            </span>
                        </p>
                    </div>
                )}
                <div className="mt-6 flex justify-center gap-2.5">
                    <button onClick={onCancel} disabled={isLoading} className="rounded-xl border border-[#e2e8f0] bg-white px-6 py-2.5 text-[14.5px] font-medium text-[#4b5563] hover:bg-[#f6fbf8] disabled:opacity-40">
                        Cancel
                    </button>
                    <button onClick={onConfirm} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl bg-[#15803d] px-6 py-2.5 text-[14.5px] font-semibold text-white hover:bg-[#166534] disabled:opacity-40">
                        {isLoading ? 'Approving…' : 'Yes, Approve'}
                    </button>
                </div>
            </div>
        </ModalBackdrop>
    )
}

function RejectModal({ booking, onConfirm, onCancel, isLoading }) {
    const [remarks, setRemarks] = useState('')
    const isCancellation = booking?.status === 'APPROVED'

    return (
        <ModalBackdrop onClose={onCancel}>
            <div
                className="w-full max-w-[460px] rounded-2xl border border-[#e8f5ee] bg-white p-7 shadow-2xl shadow-black/10"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
            >
                <p className="text-[19px] font-semibold tracking-tight text-[#0f172a]">
                    {isCancellation ? 'Cancel Approved Booking?' : 'Reject Request?'}
                </p>
                <p className="mt-1 border-b border-[#e8f5ee] pb-4 text-[14px] text-[#6b7280]">
                    <span className="font-semibold text-[#0f172a]">{booking.reference_code}</span> — {booking.event_name}
                </p>
                <label className="mt-5 mb-2 block text-[12px] font-bold uppercase tracking-[0.1em] text-[#6b7280]">
                    Reason <span className="text-red-600">*</span>
                </label>
                <textarea
                    className="min-h-[108px] w-full resize-none rounded-xl border border-[#dbe7df] bg-white px-4 py-3 text-[15px] text-[#0f172a] outline-none transition focus:border-[#15803d] focus:ring-2 focus:ring-[#dcfce7]"
                    placeholder="e.g. Equipment unavailable, scheduling conflict..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    autoFocus
                />
                <p className="mt-2 text-[13px] text-[#6b7280]">This reason will be recorded and notified to the user.</p>
                <div className="mt-6 flex justify-end gap-2.5">
                    <button onClick={onCancel} disabled={isLoading} className="rounded-xl border border-[#dbe7df] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#4b5563] hover:bg-[#f6fbf8] disabled:opacity-40">
                        Close
                    </button>
                    <button
                        onClick={() => onConfirm(remarks)}
                        disabled={isLoading || !remarks.trim()}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#dc2626] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#b91c1c] disabled:opacity-40"
                    >
                        {isLoading ? 'Processing…' : isCancellation ? 'Revoke & Cancel' : 'Reject Booking'}
                    </button>
                </div>
            </div>
        </ModalBackdrop>
    )
}

function SuccessModal({ booking, onClose }) {
    if (!booking) return null
    return (
        <ModalBackdrop onClose={onClose}>
            <div
                className="w-full max-w-[360px] rounded-2xl border border-[#e8f5ee] bg-white p-8 text-center shadow-2xl shadow-black/10"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
            >
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#dcfce7]">
                    <Check className="h-6 w-6 text-[#15803d]" />
                </div>
                <p className="text-[17px] font-semibold tracking-tight text-[#0f172a]">Booking approved!</p>
                <p className="mt-2 text-[14px] leading-relaxed text-[#6b6b6b]">
                    <span className="font-medium text-[#0f172a]">{booking.event_name}</span> has been approved.
                </p>
                <button onClick={onClose} className="mt-6 w-full rounded-xl bg-[#15803d] py-3 text-[14px] font-semibold text-white hover:bg-[#166534]">
                    Done
                </button>
            </div>
        </ModalBackdrop>
    )
}

// ── BookingCard ───────────────────────────────────────────────────────────────

function BookingCard({ booking, isPendingTab, isActing, onApproveClick, onRejectClick, isHighlighted }) {
    const [isExpanded, setIsExpanded] = useState(false)

    useEffect(() => {
        if (!isHighlighted) return undefined
        const timer = window.setTimeout(() => setIsExpanded(true), 0)
        return () => window.clearTimeout(timer)
    }, [isHighlighted])

    const equipment    = booking.equipment_requests ?? []
    const hasEquipment = equipment.length > 0
    const hasServices  = Boolean(booking.requested_services?.trim())
    const hasNotes     = Boolean(booking.user_notes?.trim())

    // UPDATED: Now compares absolute time strings instead of dates
    const hasBuffer = booking.setup_start_datetime && booking.event_start_datetime && 
        (new Date(booking.setup_start_datetime).getTime() !== new Date(booking.event_start_datetime).getTime() ||
         new Date(booking.teardown_end_datetime).getTime() !== new Date(booking.event_end_datetime).getTime());

    const user         = booking.user_details ?? {}
    const requesterName = user.name || `User #${booking.user}`
    const dept         = user.department || user.department_code || 'Department not provided'
    const spaceName    = booking.space_details?.name || 'Any suitable space'
    const location     = booking.space_details?.location || 'Location not specified'

    const toggle = () => { if (!window.getSelection().toString()) setIsExpanded((v) => !v) }

    return (
        <article
            data-booking-reference={booking.reference_code || ''}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${booking.is_external_event ? 'border-amber-200' : 'border-[#e8f5ee]'} ${isExpanded ? 'shadow-md' : 'hover:bg-[#fbfefc] hover:shadow-md'} ${isHighlighted ? 'ring-2 ring-[#22c55e] bg-[#f0fdf4]' : ''}`}
        >
            {/* ── Collapsed header ── */}
            <div className="block w-full cursor-pointer px-6 py-5 text-left" onClick={toggle}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="min-w-0 text-[18px] font-bold leading-tight tracking-tight text-[#0f172a]">{booking.event_name}</h2>
                    <div className="flex items-center gap-3">
                        {getSubmissionTimestamp(booking) && <span className="text-[13px] font-medium text-[#6b7280]">Submitted {timeAgo(getSubmissionTimestamp(booking))}</span>}
                        <span className="flex h-8 w-8 items-center justify-center rounded-full text-[#94a3b8] transition hover:bg-[#e8f5ee]">
                            <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </span>
                    </div>
                </div>

                {/* Badges */}
                <div className="mb-5 flex flex-wrap items-center gap-2.5">
                    <StatusBadge status={booking.status} />
                    <EventTypeBadge isExternal={booking.is_external_event} />
                    {booking.is_team_request && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-purple-700">
                            <Users className="h-3 w-3" /> Media Team Request
                        </span>
                    )}
                    {!booking.is_team_request && hasEquipment && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-blue-700">
                            <Package className="h-3 w-3" /> Equipment Request
                        </span>
                    )}
                </div>

                {/* Info grid */}
                <div className="grid gap-6 md:grid-cols-[1.5fr_1.35fr_2.15fr]">
                    <div>
                        <FieldLabel>Space / Location</FieldLabel>
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d1fae5] bg-[#f0fdf4] text-[#15803d]">
                                <Building2 className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-[16px] font-semibold leading-tight text-[#0f172a]">{spaceName}</p>
                                <p className="mt-1 truncate text-[13.5px] font-medium text-[#6b7280]">{location}</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <FieldLabel>From / To</FieldLabel>
                        <div className="space-y-2.5">
                            {/* UPDATED: Map over the new Datetimes */}
                            {[['bg-[#22c55e]', booking.setup_start_datetime], ['bg-[#dc2626]', booking.teardown_end_datetime]].map(([dot, time], i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
                                    <p className="text-[14.5px] font-semibold text-[#0f172a]">
                                        {formatDate(time)} · {formatTime(time)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <FieldLabel>Requested By</FieldLabel>
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d1fae5] bg-[#f0fdf4] text-[15px] font-bold text-[#15803d]">
                                {requesterName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 space-y-1.5">
                                <p className="truncate text-[17px] font-bold leading-tight text-gray-900">{requesterName}</p>
                                <p className="truncate text-[14.5px] font-semibold text-green-700">{dept}</p>
                                {user.phone && <p className="flex items-center gap-2 truncate text-[15px] font-medium text-gray-800"><Phone className="h-4 w-4 shrink-0 text-green-700" /> {user.phone}</p>}
                                {user.email && <p className="flex items-center gap-2 truncate text-[15px] font-medium text-gray-800"><Mail className="h-4 w-4 shrink-0 text-green-700" /> {user.email}</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Expanded content ── */}
            {isExpanded && (
                <div className="px-6 pb-6 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="pt-6 border-t border-[#e8f5ee]">
                        <div className="mb-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                            <div>
                                <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2">Booking Reference</p>
                                <div className="h-full bg-[#f0fdf4] border border-[#d1fae5] rounded-xl px-4 py-3.5 flex items-center">
                                    <span className="font-mono text-[15px] font-semibold tracking-wide text-[#14532d]">{booking.reference_code}</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2">Media Timing</p>
                                <div className="h-full rounded-xl border border-[#e8f5ee] bg-[#f6fbf8] px-4 py-3.5">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-[14.5px] font-semibold text-[#0f172a]">
                                            Event: {formatTime(booking.event_start_datetime)} – {formatTime(booking.event_end_datetime)}
                                        </p>
                                        <p className="rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-[#4b5563]">
                                            {hasBuffer ? 'Buffer included' : 'No extra buffer'}
                                        </p>
                                    </div>
                                    {hasBuffer && (
                                        <p className="mt-3 text-[13.5px] font-medium text-[#6b7280]">
                                            Setup starts at {formatTime(booking.setup_start_datetime)} and teardown ends at {formatTime(booking.teardown_end_datetime)}.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {(hasEquipment || hasServices || hasNotes) && (
                            <div className="flex flex-col gap-5 mb-6">
                                {hasEquipment && (
                                    <div>
                                        <p className="text-[13px] font-bold text-[#0f172a] mb-3 pb-1.5 border-b-2 border-[#15803d] inline-block">Equipment Needed</p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {booking.equipment_requests.map((er) => (
                                                <span key={er.id} className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#14532d] bg-[#dcfce7] px-3.5 py-1.5 rounded-xl">
                                                    <Package className="h-4 w-4" />
                                                    {er.equipment_name || `Equipment #${er.equipment}`}
                                                    {er.quantity > 1 && <span className="text-[#4a6b58] font-medium">× {er.quantity}</span>}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {hasServices && (
                                    <div>
                                        <p className="text-[13px] font-bold text-[#0f172a] mb-3 pb-1.5 border-b-2 border-[#15803d] inline-block">Services Needed</p>
                                        <div className="mt-2 rounded-xl border border-[#e8f5ee] bg-white px-4 py-3.5">
                                            <p className="flex items-start gap-2 text-[14.5px] font-medium leading-relaxed text-[#0f172a]">
                                                <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-[#15803d]" /> {booking.requested_services}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {hasNotes && (
                                    <div>
                                        <p className="text-[13px] font-bold text-[#0f172a] mb-3 pb-1.5 border-b-2 border-[#f59e0b] inline-block">Notes from Requester</p>
                                        <div className="mt-2 bg-[#fffbeb] rounded-xl px-4 py-3.5 border border-[#fef3c7]">
                                            <p className="text-[14.5px] text-[#374151] leading-relaxed">{booking.user_notes}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {['REJECTED', 'CANCELLED'].includes(booking.status) && booking.remarks_by_admin && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 mb-6">
                                <FieldLabel>Rejection / Cancellation Reason</FieldLabel>
                                <p className="text-[14.5px] font-semibold leading-relaxed text-red-700">{booking.remarks_by_admin}</p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2.5 pt-5 border-t border-[#e8f5ee]">
                        {isPendingTab ? (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); onRejectClick(booking) }} disabled={isActing} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#e2e8f0] text-[14.5px] font-medium text-[#374151] bg-white hover:bg-[#fef2f2] hover:text-[#dc2626] hover:border-[#fca5a5] transition-all disabled:opacity-40">
                                    <X className="h-4 w-4" /> Reject
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onApproveClick(booking) }} disabled={isActing} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d] text-white text-[14.5px] font-semibold hover:bg-[#166534] transition-all disabled:opacity-40">
                                    {isActing ? 'Processing…' : <><Check className="h-4 w-4" /> Approve</>}
                                </button>
                            </>
                        ) : booking.status === 'APPROVED' ? (
                            <button onClick={(e) => { e.stopPropagation(); onRejectClick(booking) }} disabled={isActing} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-[14.5px] font-medium text-red-700 bg-red-50 hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-40">
                                <X className="h-4 w-4" /> Revoke & Cancel Booking
                            </button>
                        ) : booking.status === 'CANCELLED' ? (
                            <span className="rounded-xl bg-gray-100 px-5 py-2 text-[13px] font-bold uppercase tracking-wider text-gray-500">
                                Cancelled
                            </span>
                        ) : null}
                    </div>
                </div>
            )}
        </article>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'pending',  label: 'Pending Requests', key: 'pending'  },
    { id: 'active',   label: 'Active Bookings',  key: 'active'   },
    { id: 'history',  label: 'History',          key: 'history'  },
    { id: 'resolved', label: 'Resolved by Me',   key: 'resolved' },
]

async function loadAdminMediaData() {
    const [pending, resolved, active, history] = await Promise.all([
        mediaApi.getPendingBookings(),
        mediaApi.getResolvedByMe(),
        mediaApi.getActiveBookings(),
        mediaApi.getHistoryBookings(),
    ])
    return { pending, resolved, active, history }
}

function AdminMediaPage() {
    const { user, isLoading: authLoading } = useAuth()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const canManageMedia = user?.capabilities?.can_manage_media
    const requestedTab = searchParams.get('tab')
    const highlightedReference = searchParams.get('booking') || ''

    const [activeTab,       setActiveTab]      = useState(() => (
        ['pending', 'active', 'history', 'resolved'].includes(requestedTab) ? requestedTab : 'pending'
    ))
    const [data,            setData]           = useState({ pending: [], resolved: [], active: [], history: [] })
    const [loading,         setLoading]        = useState(true)
    const [error,           setError]          = useState('')
    const [actionLoading,   setActionLoading]  = useState(null)
    const [rejectTarget,    setRejectTarget]   = useState(null)
    const [approveTarget,   setApproveTarget]  = useState(null)
    const [successTarget,   setSuccessTarget]  = useState(null)
    const [showSettings,    setShowSettings]   = useState(false)
    const [maxConcurrent,   setMaxConcurrent]  = useState(null)

    const fetchData = useCallback(async ({ showLoading = true } = {}) => {
        if (showLoading) setLoading(true)
        try {
            const [nextData, settings] = await Promise.all([
                loadAdminMediaData(),
                mediaApi.getSettings(),
            ])
            setData(nextData)
            setMaxConcurrent(settings.max_concurrent_events)
            setError('')
        } catch (err) {
            console.error('Failed to load media admin data', err)
            setError('Could not load media requests. Please try again.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!canManageMedia) return
        ;(async () => { await fetchData({ showLoading: false }) })()
    }, [canManageMedia, fetchData])

    useEffect(() => {
        if (!['pending', 'active', 'history', 'resolved'].includes(requestedTab)) return undefined
        const timer = window.setTimeout(() => setActiveTab(requestedTab), 0)
        return () => window.clearTimeout(timer)
    }, [requestedTab])

    const handleApproveConfirm = async () => {
        if (!approveTarget) return
        setActionLoading(approveTarget.id)
        try {
            await mediaApi.reviewBooking(approveTarget.id, { status: 'APPROVED' })
            await notificationService.markBookingRead(approveTarget.reference_code, 'media').catch(() => null)
            if (normaliseReference(approveTarget.reference_code) === normaliseReference(highlightedReference)) {
                navigate('/admin/media?tab=pending', { replace: true })
            }
            setSuccessTarget(approveTarget)
            setApproveTarget(null)
            await fetchData({ showLoading: false })
        } catch (err) {
            alert(`Failed to approve booking. ${apiError(err)}`)
        } finally {
            setActionLoading(null)
        }
    }

    const handleRejectConfirm = async (remarks) => {
        if (!rejectTarget) return
        setActionLoading(rejectTarget.id)
        try {
            await mediaApi.reviewBooking(rejectTarget.id, { status: 'REJECTED', remarks_by_admin: remarks })
            await notificationService.markBookingRead(rejectTarget.reference_code, 'media').catch(() => null)
            if (normaliseReference(rejectTarget.reference_code) === normaliseReference(highlightedReference)) {
                navigate('/admin/media?tab=pending', { replace: true })
            }
            setRejectTarget(null)
            await fetchData({ showLoading: false })
        } catch (err) {
            alert(`Failed to reject booking. ${apiError(err)}`)
        } finally {
            setActionLoading(null)
        }
    }

    const handleSaveSettings = async (newMax) => {
        await mediaApi.updateSettings({ max_concurrent_events: newMax })
        setMaxConcurrent(newMax)
    }

    const todayStr = new Date().toLocaleDateString('en-CA')
    const sortByExternal = (list) => [...list].sort((a, b) => {
        const externalDelta = (b.is_external_event ? 1 : 0) - (a.is_external_event ? 1 : 0)
        if (externalDelta) return externalDelta
        if (activeTab === 'pending') return compareSubmissionTimeDesc(a, b)
        if (activeTab === 'history' || activeTab === 'resolved') {
            return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
        }
        return 0
    })
    const list = sortByExternal(data[activeTab] ?? [])

    useEffect(() => {
        if (!highlightedReference || loading || list.length === 0) return undefined

        const target = Array.from(document.querySelectorAll('[data-booking-reference]'))
            .find((element) => normaliseReference(element.getAttribute('data-booking-reference')) === normaliseReference(highlightedReference))

        if (!target) return undefined

        const timer = window.setTimeout(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 80)

        return () => window.clearTimeout(timer)
    }, [highlightedReference, list, loading])

    useEffect(() => {
        if (!highlightedReference || loading || activeTab !== 'pending') return undefined
        if ((data.pending ?? []).some((booking) => normaliseReference(booking.reference_code) === normaliseReference(highlightedReference))) return undefined

        const nextTab = (data.history ?? []).some((booking) => normaliseReference(booking.reference_code) === normaliseReference(highlightedReference))
            ? 'history'
            : (data.active ?? []).some((booking) => normaliseReference(booking.reference_code) === normaliseReference(highlightedReference))
                ? 'active'
                : (data.resolved ?? []).some((booking) => normaliseReference(booking.reference_code) === normaliseReference(highlightedReference))
                ? 'resolved'
                : null

        if (!nextTab) return undefined

        const timer = window.setTimeout(() => setActiveTab(nextTab), 0)
        return () => window.clearTimeout(timer)
    }, [activeTab, data.active, data.history, data.pending, data.resolved, highlightedReference, loading])

    if (authLoading) {
        return (
            <div className="flex min-h-full items-center justify-center bg-[#f6fbf8]">
                <RefreshCw className="h-8 w-8 animate-spin text-[#15803d]" />
            </div>
        )
    }

    if (!canManageMedia) {
        return (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-[#f6fbf8] p-8 text-center" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <X className="h-7 w-7" />
                </div>
                <p className="text-[18px] font-bold text-[#0f172a]">Access Denied</p>
                <p className="max-w-sm text-[14px] text-[#6b7280]">You don't have permission to access the Media admin panel.</p>
            </div>
        )
    }

    return (
        <div className="min-h-full bg-[#f6fbf8] p-6 md:p-8" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
            {/* Modals */}
            {approveTarget && (
                <ApproveModal booking={approveTarget} onConfirm={handleApproveConfirm} onCancel={() => setApproveTarget(null)} isLoading={actionLoading === approveTarget.id} />
            )}
            {rejectTarget && (
                <RejectModal booking={rejectTarget} onConfirm={handleRejectConfirm} onCancel={() => setRejectTarget(null)} isLoading={actionLoading === rejectTarget.id} />
            )}
            {successTarget && (
                <SuccessModal booking={successTarget} onClose={() => setSuccessTarget(null)} />
            )}
            {showSettings && maxConcurrent !== null && (
                <TeamSettingsModal currentMax={maxConcurrent} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />
            )}

            <div className="mx-auto max-w-[1100px]">
                {/* Header */}
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Rajagiri College · Admin</p>
                        <div className="flex items-center gap-2">
                          <h1 className="text-[26px] font-bold leading-none tracking-tight text-[#0f172a]">Media Management</h1>
                          <PageInfo text="Approve or reject media team booking requests. Configure how many simultaneous media bookings are allowed." />
                        </div>
                        <p className="mt-2 text-[15px] text-[#374151]">Manage media equipment requests and event support bookings.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSettings(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-[#d1fae5] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#4a6b58] transition hover:bg-[#f0fdf4]"
                        >
                            <Settings className="h-[17px] w-[17px]" />
                            Team Settings
                            {maxConcurrent !== null && (
                                <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[12px] font-bold text-[#15803d]">
                                    {maxConcurrent}
                                </span>
                            )}
                        </button>
                        <button onClick={() => fetchData()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[#d1fae5] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#4a6b58] transition hover:bg-[#f0fdf4] disabled:opacity-40">
                            <RefreshCw className={`h-[18px] w-[18px] ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="mb-6 grid gap-3 md:grid-cols-3">
                    {[
                        { value: data.pending.length, label: 'Waiting for review'       },
                        { value: data.active.length,  label: 'Approved active bookings' },
                        // UPDATED: Use the new event_start_datetime for the "Today" check
                        { value: data.active.filter((b) => b.event_start_datetime && new Date(b.event_start_datetime).toLocaleDateString('en-CA') === todayStr).length, label: 'Approved for today' },
                    ].map(({ value, label }) => (
                        <div key={label} className="rounded-2xl border border-[#e8f5ee] bg-white px-6 py-5">
                            <p className="text-[30px] font-light leading-none tracking-tight text-[#0f172a]">{value}</p>
                            <p className="mt-2 text-[14px] font-semibold text-[#374151]">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="mb-5 flex w-fit flex-wrap gap-1 rounded-2xl bg-[#e8f5ee] p-1">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-bold transition-all ${activeTab === tab.id ? 'bg-white text-[#0f172a] shadow-sm ring-1 ring-black/5' : 'text-[#4a6b58] hover:bg-white/60'}`}
                        >
                            {tab.label}
                            <span className="rounded-full bg-[#f6fbf8] px-2 py-0.5 text-[12px] text-[#0f172a]">
                                {data[tab.key]?.length ?? 0}
                            </span>
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-[15px] font-semibold text-red-700">{error}</div>
                )}

                {/* List */}
                <div className="space-y-4">
                    {loading && list.length === 0 ? (
                        <div className="rounded-2xl border border-[#e8f5ee] bg-white py-16 text-center shadow-sm">
                            <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-[#15803d]" />
                            <p className="text-[15px] font-semibold text-[#6b7280]">Loading media requests...</p>
                        </div>
                    ) : list.length === 0 ? (
                        <div className="rounded-2xl border border-[#e8f5ee] bg-white px-8 py-16 text-center shadow-sm">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#dcfce7] text-[#15803d]">
                                <Check className="h-6 w-6" />
                            </div>
                            <p className="text-[16px] font-semibold text-[#0f172a]">No requests found</p>
                            <p className="mt-1.5 text-[14px] text-[#6b7280]">There are no {activeTab.replace('_', ' ')} media requests right now.</p>
                        </div>
                    ) : (
                        list.map((booking) => (
                            <BookingCard
                                key={booking.id}
                                booking={booking}
                                isPendingTab={activeTab === 'pending'}
                                isActing={actionLoading === booking.id}
                                onApproveClick={setApproveTarget}
                                onRejectClick={setRejectTarget}
                                isHighlighted={normaliseReference(booking.reference_code) === normaliseReference(highlightedReference)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

export default AdminMediaPage