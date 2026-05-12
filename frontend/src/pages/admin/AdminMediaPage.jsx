import { useState, useEffect, useCallback } from 'react'
import {
    Building2,
    ChevronDown,
    Check,
    Mail,
    Package,
    Phone,
    RefreshCw,
    Wrench,
    X,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import mediaApi from '../../api/mediaApi'

const STATUS_STYLES = {
    APPROVED:  'bg-green-100 text-green-700 border-green-200',
    PENDING:   'bg-yellow-100 text-yellow-800 border-yellow-200',
    REJECTED:  'bg-red-100 text-red-700 border-red-200',
    CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
}

async function loadAdminMediaData() {
    const [pending, resolved, active] = await Promise.all([
        mediaApi.getPendingBookings(),
        mediaApi.getResolvedByMe(),
        mediaApi.getActiveBookings(),
    ])
    return { pending, resolved, active }
}

function StatusBadge({ status }) {
    const style = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING
    return (
        <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide ${style}`}>
            {status}
        </span>
    )
}

function EventTypeBadge({ isExternal }) {
    if (isExternal) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-amber-700">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                External Event
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-sky-600">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zm5.99 7.176A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
            </svg>
            Internal Event
        </span>
    )
}

function formatDate(dateString) {
    if (!dateString) return 'TBD'
    return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
    })
}

function formatTime(timeString) {
    if (!timeString) return 'TBD'
    const [hours, minutes] = timeString.split(':')
    const date = new Date()
    date.setHours(Number(hours), Number(minutes), 0, 0)
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function timeAgo(isoString) {
    if (!isoString) return ''
    const minutes = Math.max(0, Math.round((Date.now() - new Date(isoString)) / 60000))
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.round(hours / 24)}d ago`
}

function FieldLabel({ children }) {
    return (
        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[#6b7280]">
            {children}
        </p>
    )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function ApproveModal({ booking, onConfirm, onCancel, isLoading }) {
    if (!booking) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm" onClick={onCancel}>
            <div
                className="w-full max-w-[400px] rounded-2xl border border-[#e8f5ee] bg-white p-7 shadow-2xl shadow-black/10"
                onClick={(e) => e.stopPropagation()}
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
            >
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#dcfce7]">
                    <Check className="h-6 w-6 text-[#15803d]" />
                </div>
                <p className="text-center text-[18px] font-bold tracking-tight text-[#0f172a]">Approve Booking?</p>
                <p className="mt-2 text-center text-[14.5px] leading-relaxed text-[#4b5563]">
                    Are you sure you want to approve this media request for <span className="font-semibold text-[#0f172a]">{booking.user_details?.name || booking.user_name || 'this user'}</span>?
                </p>

                <div className="mt-6 flex justify-center gap-2.5">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="rounded-xl border border-[#e2e8f0] bg-white px-6 py-2.5 text-[14.5px] font-medium text-[#4b5563] transition hover:bg-[#f6fbf8] disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm()}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#15803d] px-6 py-2.5 text-[14.5px] font-semibold text-white transition hover:bg-[#166534] disabled:opacity-40"
                    >
                        {isLoading ? 'Approving...' : 'Yes, Approve'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function RejectModal({ booking, onConfirm, onCancel, isLoading }) {
    const [remarks, setRemarks] = useState('')
    
    // Adapt text depending on if it's a new request or an already approved one being cancelled
    const isCancellation = booking?.status === 'APPROVED';
    const title = isCancellation ? 'Cancel Approved Booking?' : 'Reject Request?';
    const buttonText = isCancellation ? 'Revoke & Cancel' : 'Reject Booking';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
            <div
                className="w-full max-w-[460px] rounded-2xl border border-[#e8f5ee] bg-white p-7 shadow-2xl shadow-black/10"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
            >
                <p className="text-[19px] font-semibold tracking-tight text-[#0f172a]">{title}</p>
                <p className="mt-1 border-b border-[#e8f5ee] pb-4 text-[14px] text-[#6b7280]">
                    <span className="font-semibold text-[#0f172a]">{booking.reference_code}</span>
                    {' - '}
                    {booking.event_name}
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
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="rounded-xl border border-[#dbe7df] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#4b5563] transition hover:bg-[#f6fbf8] disabled:opacity-40"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => onConfirm(remarks)}
                        disabled={isLoading || !remarks.trim()}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#dc2626] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#b91c1c] disabled:opacity-40"
                    >
                        {isLoading ? 'Processing...' : buttonText}
                    </button>
                </div>
            </div>
        </div>
    )
}

function SuccessModal({ booking, onClose }) {
    if (!booking) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
            <div className="w-full max-w-[360px] rounded-2xl border border-[#e8f5ee] bg-white p-8 text-center shadow-2xl shadow-black/10"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#dcfce7]">
                    <Check className="h-6 w-6 text-[#15803d]" />
                </div>
                <p className="text-[17px] font-semibold tracking-tight text-[#0f172a]">Booking approved!</p>
                <p className="mt-2 text-[14px] leading-relaxed text-[#6b6b6b]">
                    <span className="font-medium text-[#0f172a]">{booking.event_name}</span> has been approved.
                </p>
                <button
                    onClick={onClose}
                    className="mt-6 w-full rounded-xl bg-[#15803d] py-3 text-[14px] font-semibold text-white transition hover:bg-[#166534]"
                >
                    Done
                </button>
            </div>
        </div>
    );
}

function BookingCard({ booking, isPendingTab, isActing, onApproveClick, onRejectClick }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const equipment    = booking.equipment_requests ?? []
    const hasEquipment = equipment.length > 0
    const hasServices  = Boolean(booking.requested_services?.trim())
    const hasNotes     = Boolean(booking.user_notes?.trim())
    const hasBuffer    =
        booking.setup_start_time !== booking.event_start_time ||
        booking.teardown_end_time !== booking.event_end_time

    const user                = booking.user_details ?? {}
    const requesterName       = user.name || booking.user_name || `User #${booking.user}`
    const requesterDepartment = user.department || user.department_code || booking.department_name || 'Department not provided'
    const requesterPhone      = user.phone || booking.requester_phone
    const requesterEmail      = user.email || booking.requester_email
    const spaceName           = booking.space_details?.name || 'Any suitable space'
    const location            = booking.space_details?.location || 'Location not specified'

    return (
        <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${booking.is_external_event ? 'border-amber-200' : 'border-[#e8f5ee]'} ${isExpanded ? 'shadow-md' : 'hover:bg-[#fbfefc] hover:shadow-md'}`}>
            <div
                className="block w-full cursor-pointer px-6 py-5 text-left"
                onClick={() => {
                    if (window.getSelection().toString().length > 0) return;
                    setIsExpanded((v) => !v)
                }}
            >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                        <span className="rounded-lg border border-[#d1fae5] bg-[#f0fdf4] px-3 py-1 font-mono text-[12.5px] font-semibold tracking-wide text-[#14532d]">
                            {booking.reference_code}
                        </span>
                        <StatusBadge status={booking.status} />
                        <EventTypeBadge isExternal={booking.is_external_event} />
                        <h2 className="min-w-0 text-[18px] font-bold leading-tight tracking-tight text-[#0f172a]">
                            {booking.event_name}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        {booking.created_at && (
                            <span className="text-[13px] font-medium text-[#6b7280]">
                                Submitted {timeAgo(booking.created_at)}
                            </span>
                        )}
                        <span className="flex h-8 w-8 items-center justify-center rounded-full text-[#94a3b8] transition hover:bg-[#e8f5ee]">
                            <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </span>
                    </div>
                </div>

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
                            <div className="flex items-center gap-3">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#22c55e]" />
                                <p className="text-[14.5px] font-semibold text-[#0f172a]">
                                    {formatDate(booking.booking_date)} · {formatTime(booking.setup_start_time)}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#dc2626]" />
                                <p className="text-[14.5px] font-semibold text-[#0f172a]">
                                    {formatDate(booking.booking_date)} · {formatTime(booking.teardown_end_time)}
                                </p>
                            </div>
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
                                <p className="truncate text-[14.5px] font-semibold text-green-700">{requesterDepartment}</p>
                                {requesterPhone && (
                                    <p className="flex items-center gap-2 truncate text-[15px] font-medium text-gray-800">
                                        <Phone className="h-4 w-4 shrink-0 text-green-700" /> {requesterPhone}
                                    </p>
                                )}
                                {requesterEmail && (
                                    <p className="flex items-center gap-2 truncate text-[15px] font-medium text-gray-800">
                                        <Mail className="h-4 w-4 shrink-0 text-green-700" /> {requesterEmail}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* EXPANDED CONTENT AREA */}
            {isExpanded && (
                <div className="px-6 pb-6 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="pt-6 border-t border-[#e8f5ee]">

                        <div className="mb-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                            <div>
                                <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2">Purpose of Booking</p>
                                <div className="h-full bg-[#f0fdf4] border border-[#d1fae5] rounded-xl px-4 py-3.5">
                                    <p className="text-[14.5px] text-[#14532d] font-medium leading-relaxed">
                                        {booking.purpose_of_booking || booking.purpose || 'No purpose provided.'}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2">Media Timing</p>
                                <div className="h-full rounded-xl border border-[#e8f5ee] bg-[#f6fbf8] px-4 py-3.5">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-[14.5px] font-semibold text-[#0f172a]">
                                            Event: {formatTime(booking.event_start_time)} - {formatTime(booking.event_end_time)}
                                        </p>
                                        <p className="rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-[#4b5563]">
                                            {hasBuffer ? 'Buffer included' : 'No extra buffer'}
                                        </p>
                                    </div>
                                    {hasBuffer && (
                                        <p className="mt-3 text-[13.5px] font-medium text-[#6b7280]">
                                            Setup starts at {formatTime(booking.setup_start_time)} and teardown ends at {formatTime(booking.teardown_end_time)}.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Equipment + Services + Notes */}
                        {(hasEquipment || hasServices || hasNotes) && (
                            <div className="flex flex-col gap-5 mb-6">
                                {hasEquipment && (
                                    <div>
                                        <p className="text-[13px] font-bold text-[#0f172a] mb-3 pb-1.5 border-b-2 border-[#15803d] inline-block">
                                            Equipment Needed
                                        </p>
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
                                        <p className="text-[13px] font-bold text-[#0f172a] mb-3 pb-1.5 border-b-2 border-[#15803d] inline-block">
                                            Services Needed
                                        </p>
                                        <div className="mt-2 rounded-xl border border-[#e8f5ee] bg-white px-4 py-3.5">
                                            <p className="flex items-start gap-2 text-[14.5px] font-medium leading-relaxed text-[#0f172a]">
                                                <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-[#15803d]" />
                                                {booking.requested_services}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {hasNotes && (
                                    <div>
                                        <p className="text-[13px] font-bold text-[#0f172a] mb-3 pb-1.5 border-b-2 border-[#f59e0b] inline-block">
                                            Notes from Requester
                                        </p>
                                        <div className="mt-2 bg-[#fffbeb] rounded-xl px-4 py-3.5 border border-[#fef3c7]">
                                            <p className="text-[14.5px] text-[#374151] leading-relaxed">
                                                {booking.user_notes}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {booking.status === 'REJECTED' && booking.remarks_by_admin && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
                                <FieldLabel>Rejection Reason</FieldLabel>
                                <p className="text-[14.5px] font-semibold leading-relaxed text-red-700">
                                    {booking.remarks_by_admin}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2.5 pt-5 border-t border-[#e8f5ee]">
                        {isPendingTab ? (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRejectClick(booking); }}
                                    disabled={isActing}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#e2e8f0] text-[14.5px] font-medium text-[#374151] bg-white hover:bg-[#fef2f2] hover:text-[#dc2626] hover:border-[#fca5a5] transition-all duration-150 disabled:opacity-40"
                                >
                                    <X className="h-4 w-4" /> Reject
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onApproveClick(booking); }}
                                    disabled={isActing}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d] text-white text-[14.5px] font-semibold hover:bg-[#166534] transition-all duration-150 disabled:opacity-40"
                                >
                                    {isActing ? 'Processing…' : <><Check className="h-4 w-4" /> Approve</>}
                                </button>
                            </>
                        ) : booking.status === 'APPROVED' ? ( // Fixed condition to look at booking status
                            <button
                                onClick={(e) => { e.stopPropagation(); onRejectClick(booking); }}
                                disabled={isActing}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-[14.5px] font-medium text-red-700 bg-red-50 hover:bg-red-100 hover:border-red-300 transition-all duration-150 disabled:opacity-40"
                            >
                                <X className="h-4 w-4" /> Revoke & Cancel Booking
                            </button>
                        ) : null}
                    </div>
                </div>
            )}
        </article>
    )
}

function AdminMediaPage() {
    const { user, isLoading: authLoading } = useAuth()
    const canManageMedia = user?.capabilities?.can_manage_media

    const [activeTab,     setActiveTab]     = useState('pending')
    const [data,          setData]          = useState({ pending: [], resolved: [], active: [] })
    const [loading,       setLoading]       = useState(true)
    const [error,         setError]         = useState('')
    const [actionLoading, setActionLoading] = useState(null)
    const [rejectTarget,  setRejectTarget]  = useState(null)
    const [approveTarget, setApproveTarget] = useState(null)
    const [successTarget, setSuccessTarget] = useState(null)

    const fetchData = useCallback(async ({ showLoading = true } = {}) => {
        if (showLoading) setLoading(true)
        try {
            const nextData = await loadAdminMediaData()
            setData(nextData)
            setError('')
        } catch (err) {
            console.error('Failed to load media admin data', err)
            setError('Could not load media requests. Please try again.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!canManageMedia) return;
        const loadInitial = async () => {
            await fetchData({ showLoading: false });
        };
        loadInitial();
    }, [canManageMedia, fetchData])

    const handleApproveConfirm = async () => {
        if (!approveTarget) return;
        setActionLoading(approveTarget.id)
        try {
            await mediaApi.reviewBooking(approveTarget.id, { status: 'APPROVED' })
            setSuccessTarget(approveTarget)
            setApproveTarget(null)
            await fetchData({ showLoading: false })
        } catch (err) {
            alert(`Failed to approve booking. ${err.response?.data?.error || ''}`)
        } finally {
            setActionLoading(null)
        }
    }

    const handleRejectConfirm = async (remarks) => {
        if (!rejectTarget) return
        setActionLoading(rejectTarget.id)
        try {
            await mediaApi.reviewBooking(rejectTarget.id, { status: 'REJECTED', remarks_by_admin: remarks })
            setRejectTarget(null)
            await fetchData({ showLoading: false })
        } catch (err) {
            alert(`Failed to reject booking. ${err.response?.data?.error || ''}`)
        } finally {
            setActionLoading(null)
        }
    }

    const sortedList = (list) =>
        [...list].sort((a, b) => (b.is_external_event ? 1 : 0) - (a.is_external_event ? 1 : 0))

    const list = sortedList(data[activeTab] || [])

    const activeTodayCount = data.active.filter((b) => {
        if (!b.booking_date) return false
        return b.booking_date === new Date().toLocaleDateString('en-CA')
    }).length

    const tabs = [
        { id: 'pending',  label: 'Pending Requests', count: data.pending.length  },
        { id: 'active',   label: 'Active Bookings',  count: data.active.length   },
        { id: 'resolved', label: 'Resolved by Me',   count: data.resolved.length },
    ]

    if (authLoading) {
        return (
            <div className="flex min-h-full items-center justify-center bg-[#f6fbf8]">
                <RefreshCw className="h-8 w-8 animate-spin text-[#15803d]" />
            </div>
        )
    }

    if (!canManageMedia) {
        return (
            <div
                className="flex min-h-full flex-col items-center justify-center gap-3 bg-[#f6fbf8] p-8 text-center"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
            >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <X className="h-7 w-7" />
                </div>
                <p className="text-[18px] font-bold text-[#0f172a]">Access Denied</p>
                <p className="max-w-sm text-[14px] text-[#6b7280]">
                    You don't have permission to access the Media admin panel.
                </p>
            </div>
        )
    }

    return (
        <div
            className="min-h-full bg-[#f6fbf8] p-6 md:p-8"
            style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
        >
            {approveTarget && (
                <ApproveModal
                    booking={approveTarget}
                    onConfirm={handleApproveConfirm}
                    onCancel={() => setApproveTarget(null)}
                    isLoading={actionLoading === approveTarget.id}
                />
            )}

            {rejectTarget && (
                <RejectModal
                    booking={rejectTarget}
                    onConfirm={handleRejectConfirm}
                    onCancel={() => setRejectTarget(null)}
                    isLoading={actionLoading === rejectTarget.id}
                />
            )}

            {successTarget && (
                <SuccessModal
                    booking={successTarget}
                    onClose={() => setSuccessTarget(null)}
                />
            )}

            <div className="mx-auto max-w-[1100px]">
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">
                            Rajagiri College · Admin
                        </p>
                        <h1 className="text-[26px] font-bold leading-none tracking-tight text-[#0f172a]">
                            Media Operations
                        </h1>
                        <p className="mt-2 text-[15px] text-[#374151]">
                            Review media support, portable equipment, and service requests.
                        </p>
                    </div>
                    <button
                        onClick={() => fetchData()}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#d1fae5] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#4a6b58] transition hover:bg-[#f0fdf4] disabled:opacity-40"
                    >
                        <RefreshCw className={`h-[18px] w-[18px] ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                <div className="mb-6 grid gap-3 md:grid-cols-3">
                    {[
                        { value: data.pending.length, label: 'Waiting for review'       },
                        { value: data.active.length,  label: 'Approved active bookings' },
                        { value: activeTodayCount,    label: 'Approved for today'        },
                    ].map(({ value, label }) => (
                        <div key={label} className="rounded-2xl border border-[#e8f5ee] bg-white px-6 py-5">
                            <p className="text-[30px] font-light leading-none tracking-tight text-[#0f172a]">{value}</p>
                            <p className="mt-2 text-[14px] font-semibold text-[#374151]">{label}</p>
                        </div>
                    ))}
                </div>

                <div className="mb-5 flex w-fit flex-wrap gap-1 rounded-2xl bg-[#e8f5ee] p-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-bold transition-all ${
                                activeTab === tab.id
                                    ? 'bg-white text-[#0f172a] shadow-sm ring-1 ring-black/5'
                                    : 'text-[#4a6b58] hover:bg-white/60'
                            }`}
                        >
                            {tab.label}
                            <span className="rounded-full bg-[#f6fbf8] px-2 py-0.5 text-[12px] text-[#0f172a]">
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-[15px] font-semibold text-red-700">
                        {error}
                    </div>
                )}

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
                            <p className="mt-1.5 text-[14px] text-[#6b7280]">
                                There are no {activeTab.replace('_', ' ')} media requests right now.
                            </p>
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
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

export default AdminMediaPage
