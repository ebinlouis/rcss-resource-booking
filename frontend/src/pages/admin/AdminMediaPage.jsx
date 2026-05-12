import { useCallback, useEffect, useState } from 'react'
import {
    Building2,
    ChevronDown,
    Check,
    Mail,
    MapPin,
    Package,
    Phone,
    RefreshCw,
    User,
    Wrench,
    X,
} from 'lucide-react'
import mediaApi from '../../api/mediaApi'

const STATUS_STYLES = {
    APPROVED: 'bg-green-100 text-green-700 border-green-200',
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    REJECTED: 'bg-red-100 text-red-700 border-red-200',
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

// External / Internal event type badge
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
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
}

function formatTime(timeString) {
    if (!timeString) return 'TBD'
    const [hours, minutes] = timeString.split(':')
    const date = new Date()
    date.setHours(Number(hours), Number(minutes), 0, 0)
    return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    })
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

function RejectModal({ booking, onConfirm, onCancel, isLoading }) {
    const [remarks, setRemarks] = useState('')

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
            <div
                className="w-full max-w-[460px] rounded-2xl border border-[#e8f5ee] bg-white p-7 shadow-2xl shadow-black/10"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
            >
                <p className="text-[19px] font-semibold tracking-tight text-[#0f172a]">Reject media request?</p>
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
                    onChange={(event) => setRemarks(event.target.value)}
                    autoFocus
                />
                <p className="mt-2 text-[13px] text-[#6b7280]">This reason will be recorded against the booking.</p>

                <div className="mt-6 flex justify-end gap-2.5">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="rounded-xl border border-[#dbe7df] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#4b5563] transition hover:bg-[#f6fbf8] disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(remarks)}
                        disabled={isLoading || !remarks.trim()}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#dc2626] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#b91c1c] disabled:opacity-40"
                    >
                        {isLoading ? 'Rejecting...' : 'Reject booking'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function BookingCard({ booking, isPending, isActing, onApprove, onReject }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const equipment = booking.equipment_requests ?? []
    const hasEquipment = equipment.length > 0
    const hasServices = Boolean(booking.requested_services?.trim())
    const hasNotes = Boolean(booking.user_notes?.trim())
    const hasBuffer =
        booking.setup_start_time !== booking.event_start_time ||
        booking.teardown_end_time !== booking.event_end_time

    const user = booking.user_details ?? {}
    const requesterName = user.name || booking.user_name || `User #${booking.user}`
    const requesterDepartment = user.department || user.department_code || booking.department_name || 'Department not provided'
    const requesterPhone = user.phone || booking.requester_phone
    const requesterEmail = user.email || booking.requester_email
    const requesterId = user.employee_student_id
    const spaceName = booking.space_details?.name || 'Any suitable space'
    const location = booking.space_details?.location || 'Location not specified'

    return (
        <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${booking.is_external_event ? 'border-amber-200' : 'border-[#e8f5ee]'} ${isExpanded ? 'shadow-md' : 'hover:bg-[#fbfefc] hover:shadow-md'}`}>
            <button
                type="button"
                className="block w-full cursor-pointer select-none px-6 py-5 text-left"
                onClick={() => setIsExpanded((value) => !value)}
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

                <div className="grid gap-6 md:grid-cols-3">
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
                            <div className="min-w-0 space-y-1">
                                <p className="truncate text-[15.5px] font-semibold leading-tight text-[#0f172a]">{requesterName}</p>
                                <p className="mt-1 truncate text-[13.5px] font-semibold text-[#15803d]">{requesterDepartment}</p>
                                {requesterPhone && (
                                    <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-[#6b7280]">
                                        <Phone className="h-3.5 w-3.5 shrink-0 text-[#15803d]" />
                                        {requesterPhone}
                                    </p>
                                )}
                                {requesterEmail && (
                                    <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-[#6b7280]">
                                        <Mail className="h-3.5 w-3.5 shrink-0 text-[#15803d]" />
                                        {requesterEmail}
                                    </p>
                                )}
                                {requesterId && (
                                    <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-[#6b7280]">
                                        <User className="h-3.5 w-3.5 shrink-0 text-[#15803d]" />
                                        {requesterId}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </button>

            {isExpanded && (
                <div className="border-t border-[#e8f5ee] px-6 pb-6 pt-5">
                    <div className="space-y-5">
                        {/* Media Schedule — full grid only when buffer exists, simple row otherwise */}
                        <div className="rounded-xl border border-[#e8f5ee] bg-[#f6fbf8] p-5">
                            <FieldLabel>Media Schedule</FieldLabel>
                            {hasBuffer ? (
                                <div className="grid gap-4 md:grid-cols-4">
                                    {[
                                        ['Setup starts', booking.setup_start_time],
                                        ['Event starts', booking.event_start_time],
                                        ['Event ends', booking.event_end_time],
                                        ['Teardown ends', booking.teardown_end_time],
                                    ].map(([label, value]) => (
                                        <div key={label}>
                                            <p className="text-[12.5px] font-semibold text-[#6b7280]">{label}</p>
                                            <p className="mt-1 text-[16px] font-bold text-[#0f172a]">{formatTime(value)}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2">
                                    {[
                                        ['Event starts', booking.event_start_time],
                                        ['Event ends', booking.event_end_time],
                                    ].map(([label, value]) => (
                                        <div key={label}>
                                            <p className="text-[12.5px] font-semibold text-[#6b7280]">{label}</p>
                                            <p className="mt-1 text-[16px] font-bold text-[#0f172a]">{formatTime(value)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="mt-4 text-[13.5px] font-medium text-[#6b7280]">
                                {hasBuffer ? 'Buffer time is included for setup and teardown.' : 'No extra setup or teardown buffer was requested.'}
                            </p>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                            <div className="rounded-xl border border-[#e8f5ee] bg-white p-5">
                                <FieldLabel>Equipment</FieldLabel>
                                {hasEquipment ? (
                                    <div className="flex flex-wrap gap-2">
                                        {equipment.map((item) => (
                                            <span
                                                key={item.id ?? item.equipment}
                                                className="inline-flex items-center gap-2 rounded-xl bg-[#dcfce7] px-3 py-1.5 text-[13.5px] font-semibold text-[#14532d]"
                                            >
                                                <Package className="h-4 w-4" />
                                                {item.equipment_name || `Equipment #${item.equipment}`}
                                                {item.quantity > 1 && <span className="text-[#4b5563]">x {item.quantity}</span>}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[14.5px] font-medium text-[#6b7280]">No equipment requested.</p>
                                )}
                            </div>

                            <div className="rounded-xl border border-[#e8f5ee] bg-white p-5">
                                <FieldLabel>Services</FieldLabel>
                                {hasServices ? (
                                    <p className="flex items-start gap-2 text-[14.5px] font-medium leading-relaxed text-[#0f172a]">
                                        <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-[#15803d]" />
                                        {booking.requested_services}
                                    </p>
                                ) : (
                                    <p className="text-[14.5px] font-medium text-[#6b7280]">No extra media service requested.</p>
                                )}
                            </div>
                        </div>

                        {hasNotes && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
                                <FieldLabel>User Notes</FieldLabel>
                                <p className="text-[14.5px] font-medium leading-relaxed text-amber-950">{booking.user_notes}</p>
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

                    {isPending && (
                        <div className="mt-5 flex justify-end gap-2.5 border-t border-[#e8f5ee] pt-5">
                            <button
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onReject(booking)
                                }}
                                disabled={isActing}
                                className="inline-flex items-center gap-2 rounded-xl border border-[#dbe7df] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#374151] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                            >
                                <X className="h-4 w-4" />
                                Reject
                            </button>
                            <button
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onApprove(booking.id)
                                }}
                                disabled={isActing}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#15803d] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#166534] disabled:opacity-40"
                            >
                                {isActing ? (
                                    'Processing...'
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" />
                                        Approve
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </article>
    )
}

function AdminMediaPage() {
    const [activeTab, setActiveTab] = useState('pending')
    const [data, setData] = useState({ pending: [], resolved: [], active: [] })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [actionLoading, setActionLoading] = useState(null)
    const [rejectTarget, setRejectTarget] = useState(null)

    const fetchData = useCallback(async ({ showLoading = true } = {}) => {
        if (showLoading) {
            await Promise.resolve()
            setLoading(true)
        }

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
        let isCurrent = true

        const loadInitialData = async () => {
            await Promise.resolve()
            if (!isCurrent) return

            setLoading(true)
            try {
                const nextData = await loadAdminMediaData()
                if (!isCurrent) return
                setData(nextData)
                setError('')
            } catch (err) {
                console.error('Failed to load media admin data', err)
                if (isCurrent) setError('Could not load media requests. Please try again.')
            } finally {
                if (isCurrent) setLoading(false)
            }
        }

        loadInitialData()
        return () => {
            isCurrent = false
        }
    }, [])

    const handleApprove = async (id) => {
        setActionLoading(id)
        try {
            await mediaApi.reviewBooking(id, { status: 'APPROVED' })
            await fetchData({ showLoading: false })
        } catch (err) {
            alert(`Failed to approve booking. ${err.response?.data?.error || ''}`)
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async (remarks) => {
        if (!rejectTarget) return

        setActionLoading(rejectTarget.id)
        try {
            await mediaApi.reviewBooking(rejectTarget.id, {
                status: 'REJECTED',
                remarks_by_admin: remarks,
            })
            setRejectTarget(null)
            await fetchData({ showLoading: false })
        } catch (err) {
            alert(`Failed to reject booking. ${err.response?.data?.error || ''}`)
        } finally {
            setActionLoading(null)
        }
    }

    // Sort: external events float to top within any tab
    const sortedList = (list) =>
        [...list].sort((a, b) => (b.is_external_event ? 1 : 0) - (a.is_external_event ? 1 : 0))

    const list = sortedList(data[activeTab] || [])

    const activeTodayCount = data.active.filter((booking) => {
        if (!booking.booking_date) return false
        const today = new Date().toLocaleDateString('en-CA')
        return booking.booking_date === today
    }).length

    const tabs = [
        { id: 'pending', label: 'Pending Requests', count: data.pending.length },
        { id: 'active', label: 'Active Bookings', count: data.active.length },
        { id: 'resolved', label: 'Resolved by Me', count: data.resolved.length },
    ]

    return (
        <div
            className="min-h-full bg-[#f6fbf8] p-6 md:p-8"
            style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
        >
            {rejectTarget && (
                <RejectModal
                    booking={rejectTarget}
                    onConfirm={handleReject}
                    onCancel={() => setRejectTarget(null)}
                    isLoading={actionLoading === rejectTarget.id}
                />
            )}

            <div className="mx-auto max-w-[1100px]">
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">
                            Rajagiri College - Admin
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
                        { value: data.pending.length, label: 'Waiting for review' },
                        { value: data.active.length, label: 'Approved active bookings' },
                        { value: activeTodayCount, label: 'Approved for today' },
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
                                isPending={activeTab === 'pending'}
                                isActing={actionLoading === booking.id}
                                onApprove={handleApprove}
                                onReject={setRejectTarget}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

export default AdminMediaPage