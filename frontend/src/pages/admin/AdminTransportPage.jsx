/**
 * AdminTransportPage.jsx — src/pages/admin/AdminTransportPage.jsx
 * Compact expandable row pattern + optional date filter
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, MapPin, Bus, Users, Pencil, X, CalendarDays } from 'lucide-react'
import {
    getPendingBookings,
    getResolvedByMe,
    getActiveBookings,
    reviewBooking,
    rescheduleBooking,
    getVehicles,
} from '../../api/fleetApi'
import Tooltip from "../../components/Tooltip"
import PageInfo from '../../components/PageInfo'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDT(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    })
}

function formatShortDate(dateStr) {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${d} ${months[parseInt(m, 10) - 1]} ${y}`
}

function timeAgo(isoString) {
    if (!isoString) return ''
    const mins = Math.round((Date.now() - new Date(isoString)) / 60000)
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.round(hrs / 24)}d ago`
}

// Only filter when user has picked a date
function bookingMatchesDate(booking, dateStr) {
    if (!dateStr) return true
    const start = booking.start_datetime?.slice(0, 10)
    const end   = booking.end_datetime?.slice(0, 10)
    if (!start) return false
    return start <= dateStr && (end ? end >= dateStr : start === dateStr)
}

// ── Status ────────────────────────────────────────────────────────────────────

const STATUS_BADGE = {
    APPROVED:  'bg-green-100 text-green-700 border-green-200',
    PENDING:   'bg-yellow-100 text-yellow-700 border-yellow-200',
    COMPLETED: 'bg-blue-100 text-blue-700 border-blue-200',
    REJECTED:  'bg-red-100 text-red-700 border-red-200',
    EXPIRED:   'bg-orange-100 text-orange-700 border-orange-200',
    CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
}

const STATUS_CARD = {
    APPROVED:  'bg-green-50 border-green-100 text-green-800',
    PENDING:   'bg-yellow-50 border-yellow-100 text-yellow-800',
    COMPLETED: 'bg-blue-50 border-blue-100 text-blue-800',
    REJECTED:  'bg-red-50 border-red-100 text-red-800',
    EXPIRED:   'bg-orange-50 border-orange-100 text-orange-800',
    CANCELLED: 'bg-gray-50 border-gray-100 text-gray-600',
}

const STATUS_LABEL = {
    APPROVED:  'Approved',
    PENDING:   'Pending Review',
    COMPLETED: 'Completed',
    REJECTED:  'Rejected',
    EXPIRED:   'Expired',
    CANCELLED: 'Cancelled',
}

function StatusBadge({ status }) {
    const style = STATUS_BADGE[status] ?? STATUS_BADGE.PENDING
    const label = STATUS_LABEL[status] ?? status
    return (
        <span className={`px-3 py-1 border text-[11px] font-bold rounded-lg uppercase tracking-wide ${style}`}>
            {label}
        </span>
    )
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({ booking, onConfirm, onCancel, isLoading }) {
    const [remarks, setRemarks] = useState('')
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-base font-bold text-gray-900 mb-1">Decline Request</h3>
                <p className="text-xs text-gray-500 mb-4">
                    <span className="font-medium text-gray-700">{booking.reference_code}</span>
                    {' · '}{booking.vehicle_details?.name ?? `Vehicle #${booking.vehicle}`}
                </p>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                    Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                    rows={4}
                    placeholder="e.g. Vehicle unavailable, conflicting schedule…"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    autoFocus
                />
                <p className="text-[10px] text-gray-400 mt-1">This reason will be shared with the requester.</p>
                <div className="flex gap-3 mt-5 justify-end">
                    <button onClick={onCancel} disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50">
                        Cancel
                    </button>
                    <button onClick={() => onConfirm(remarks)} disabled={isLoading || !remarks.trim()}
                        className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition disabled:opacity-50">
                        {isLoading ? 'Rejecting…' : 'Confirm Reject'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Reschedule Modal ──────────────────────────────────────────────────────────

function FieldLabel({ children }) {
    return (
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            {children}
        </p>
    )
}

function RescheduleModal({ booking, vehicles, onConfirm, onCancel, isLoading }) {
    const [form, setForm] = useState({
        vehicle:          booking.vehicle ?? '',
        start_datetime:   booking.start_datetime ? booking.start_datetime.slice(0, 16) : '',
        end_datetime:     booking.end_datetime   ? booking.end_datetime.slice(0, 16)   : '',
        pickup_location:  booking.pickup_location  ?? '',
        destination:      booking.destination      ?? '',
        total_passengers: booking.total_passengers ?? '',
        remarks_by_admin: booking.remarks_by_admin ?? '',
    })
    const [fieldErrors, setFieldErrors] = useState({})
    const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
    const inputCls = (key) =>
        `w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition ${
            fieldErrors[key] ? 'border-red-300' : 'border-gray-200'
        }`

    const handleConfirm = () => {
        const errs = {}
        if (!form.start_datetime) errs.start_datetime = 'Required'
        if (!form.end_datetime)   errs.end_datetime   = 'Required'
        if (form.start_datetime && form.end_datetime && form.start_datetime >= form.end_datetime)
            errs.end_datetime = 'Must be after start'
        if (!form.vehicle) errs.vehicle = 'Required'
        if (!form.total_passengers || Number(form.total_passengers) < 1)
            errs.total_passengers = 'Must be ≥ 1'
        if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
        onConfirm({
            vehicle:          Number(form.vehicle),
            start_datetime:   form.start_datetime,
            end_datetime:     form.end_datetime,
            pickup_location:  form.pickup_location,
            destination:      form.destination,
            total_passengers: Number(form.total_passengers),
            remarks_by_admin: form.remarks_by_admin || undefined,
        })
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Update Trip Details</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            <span className="font-medium text-gray-700">{booking.reference_code}</span>
                            {' · '}Requested by {booking.user_email ?? booking.user}
                        </p>
                    </div>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <FieldLabel>Vehicle</FieldLabel>
                        <select className={inputCls('vehicle')} value={form.vehicle} onChange={e => set('vehicle', e.target.value)}>
                            <option value="">Select vehicle</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>
                                    {v.name} — {v.registration_number} (Capacity: {v.capacity})
                                </option>
                            ))}
                        </select>
                        {fieldErrors.vehicle && <p className="text-xs text-red-500 mt-1">{fieldErrors.vehicle}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <FieldLabel>Start date & time</FieldLabel>
                            <input type="datetime-local" className={inputCls('start_datetime')} value={form.start_datetime} onChange={e => set('start_datetime', e.target.value)} />
                            {fieldErrors.start_datetime && <p className="text-xs text-red-500 mt-1">{fieldErrors.start_datetime}</p>}
                        </div>
                        <div>
                            <FieldLabel>End date & time</FieldLabel>
                            <input type="datetime-local" className={inputCls('end_datetime')} value={form.end_datetime} onChange={e => set('end_datetime', e.target.value)} />
                            {fieldErrors.end_datetime && <p className="text-xs text-red-500 mt-1">{fieldErrors.end_datetime}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <FieldLabel>Pickup location</FieldLabel>
                            <input className={inputCls('pickup_location')} value={form.pickup_location} onChange={e => set('pickup_location', e.target.value)} placeholder="e.g. College main gate" />
                        </div>
                        <div>
                            <FieldLabel>Destination</FieldLabel>
                            <input className={inputCls('destination')} value={form.destination} onChange={e => set('destination', e.target.value)} placeholder="e.g. Kochi" />
                        </div>
                    </div>
                    <div>
                        <FieldLabel>Total passengers</FieldLabel>
                        <input type="number" min={1} className={inputCls('total_passengers')} value={form.total_passengers} onChange={e => set('total_passengers', e.target.value)} />
                        {fieldErrors.total_passengers && <p className="text-xs text-red-500 mt-1">{fieldErrors.total_passengers}</p>}
                    </div>
                    <div>
                        <FieldLabel>Notes (optional)</FieldLabel>
                        <textarea rows={2} className={`${inputCls('remarks_by_admin')} resize-none`} placeholder="Reason for the update (optional)" value={form.remarks_by_admin} onChange={e => set('remarks_by_admin', e.target.value)} />
                    </div>
                </div>
                <div className="flex gap-3 mt-6 justify-end">
                    <button onClick={onCancel} disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50">
                        Cancel
                    </button>
                    <button onClick={handleConfirm} disabled={isLoading}
                        className="px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg transition disabled:opacity-50">
                        {isLoading ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Booking Row ───────────────────────────────────────────────────────────────

function BookingRow({ booking, onApprove, onReject, onReschedule, actionLoading, showApproveReject, showReschedule }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const cardStyle = STATUS_CARD[booking.status] ?? STATUS_CARD.PENDING

    return (
        <div className={`border-b border-gray-100 last:border-0 transition-colors duration-150 ${isExpanded ? 'bg-[#f8fafc]' : 'bg-white hover:bg-[#f8fafc]'}`}>

            {/* Clickable header */}
            <div className="px-7 py-5 cursor-pointer select-none" onClick={() => setIsExpanded(v => !v)}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <StatusBadge status={booking.status} />
                        {booking.reference_code && (
                            <span className="font-mono text-[13px] font-semibold text-green-900 bg-green-50 px-3 py-1 rounded-lg border border-green-100 tracking-wide">
                                {booking.reference_code}
                            </span>
                        )}
                        <span className="text-[12px] text-gray-500 font-medium">
                            {booking.user_email ?? `User #${booking.user}`}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {booking.created_at && (
                            <span className="text-[13px] text-gray-400 font-medium">
                                Submitted {timeAgo(booking.created_at)}
                            </span>
                        )}
                        <div className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors">
                            <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                </div>

                <div className="grid gap-6" style={{ gridTemplateColumns: '1.8fr 1.6fr 2fr' }}>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-2">Route</p>
                        <div className="flex items-start gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0 text-green-700">
                                <MapPin className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-[15px] font-semibold text-gray-900 leading-tight">{booking.pickup_location}</p>
                                <p className="truncate text-[12px] text-gray-500 mt-0.5">→ {booking.destination}</p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-2">When</p>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                <span className="text-[14px] font-semibold text-gray-900">{formatDT(booking.start_datetime)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                                <span className="text-[14px] font-semibold text-gray-900">{formatDT(booking.end_datetime)}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-2">Vehicle</p>
                        <div className="flex items-center gap-2">
                            <Bus className="w-4 h-4 text-gray-500 shrink-0" />
                            <span className="text-[14px] font-semibold text-gray-900">
                                {booking.vehicle_details?.name ?? `Vehicle #${booking.vehicle}`}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="text-[13px] text-gray-500">{booking.total_passengers} passengers</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
                <div className="px-7 pb-6 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="pt-5 border-t border-gray-200 space-y-5">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-2">Trip Details</p>
                            <div className={`rounded-xl border px-4 py-3.5 ${cardStyle}`}>
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <Bus className="w-4 h-4 opacity-70" />
                                        <span className="text-[14px] font-semibold">
                                            {booking.vehicle_details?.name ?? `Vehicle #${booking.vehicle}`}
                                        </span>
                                        {booking.vehicle_details?.registration_number && (
                                            <span className="text-[12px] font-mono opacity-70">
                                                · {booking.vehicle_details.registration_number}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 opacity-70" />
                                        <span className="text-[14px] font-medium">{booking.total_passengers} passengers</span>
                                    </div>
                                </div>
                                {booking.purpose && (
                                    <p className="mt-2 text-[13px] opacity-80 italic">{booking.purpose}</p>
                                )}
                            </div>
                        </div>

                        {booking.status === 'REJECTED' && booking.remarks_by_admin && (
                            <div>
                                <p className="text-[13px] font-bold text-gray-900 mb-2 pb-1.5 border-b-2 border-red-500 inline-block">
                                    Rejection Reason
                                </p>
                                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                                    <p className="text-[14px] text-red-900 leading-relaxed italic">"{booking.remarks_by_admin}"</p>
                                </div>
                            </div>
                        )}

                        {booking.resolved_by_name && (
                            <p className="text-[12px] text-gray-400">
                                Resolved by <span className="font-semibold text-gray-600">{booking.resolved_by_name}</span>
                                {' · '}{formatDT(booking.resolved_at)}
                            </p>
                        )}

                        <div className="flex justify-end items-center gap-2.5 pt-4 border-t border-gray-100">
                            {/* Reschedule only on Approved Trips tab, not on Pending */}
                            {showReschedule && (
                                <button
                                    onClick={() => onReschedule(booking)}
                                    disabled={actionLoading === booking.id}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-[13.5px] font-medium text-gray-700 bg-white hover:bg-gray-50 transition disabled:opacity-40"
                                >
                                    <Pencil className="w-3.5 h-3.5" /> Reschedule
                                </button>
                            )}
                            {showApproveReject && (
                                <>
                                    <button
                                        onClick={() => onReject(booking)}
                                        disabled={actionLoading === booking.id}
                                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border border-gray-200 text-[13.5px] font-medium text-gray-700 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition disabled:opacity-40"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => onApprove(booking.id)}
                                        disabled={actionLoading === booking.id}
                                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-green-600 text-white text-[13.5px] font-semibold hover:bg-green-700 transition disabled:opacity-50"
                                    >
                                        {actionLoading === booking.id ? 'Processing…' : 'Approve'}
                                    </button>
                                </>
                            )}
                            {!showApproveReject && !showReschedule && (
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mr-auto">
                                    No Actions Available
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Approval confirm banner ───────────────────────────────────────────────────

function ApprovalConfirmCard({ booking, onDismiss }) {
    if (!booking) return null
    return (
        <div className="mb-6 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-green-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-green-700">Trip approved — {booking.reference_code}</p>
                        <p className="text-xs text-green-600/80">
                            {booking.vehicle_details?.name ?? `Vehicle #${booking.vehicle}`}
                            {' · '}{booking.pickup_location} → {booking.destination}
                        </p>
                    </div>
                </div>
                <button onClick={onDismiss} className="text-green-500 hover:text-green-700 transition">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
    { key: 'pending',        label: 'Pending Requests' },
    { key: 'resolved_by_me', label: 'Resolved by Me'   },
    { key: 'active',         label: 'Approved Trips'   },
]

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminTransportPage() {
    const [activeTab,        setActiveTab]        = useState('pending')
    const [bookings,         setBookings]          = useState([])
    const [isLoading,        setIsLoading]         = useState(true)
    const [error,            setError]             = useState(null)
    const [refreshCount,     setRefreshCount]      = useState(0)
    const [actionLoading,    setActionLoading]     = useState(null)
    const [rejectTarget,     setRejectTarget]      = useState(null)
    const [rescheduleTarget, setRescheduleTarget]  = useState(null)
    const [vehicles,         setVehicles]          = useState([])
    const [lastApproved,     setLastApproved]      = useState(null)

    // ✅ Date filter — empty by default, only filters when user picks a date
    const [selectedDate, setSelectedDate] = useState('')

    useEffect(() => {
        getVehicles()
            .then(data => setVehicles(Array.isArray(data) ? data : data.results ?? []))
            .catch(() => {})
    }, [])

    const fetchFn = useCallback(async () => {
        const fetchers = {
            pending:        getPendingBookings,
            resolved_by_me: getResolvedByMe,
            active:         getActiveBookings,
        }
        setIsLoading(true)
        setError(null)
        try {
            const data = await fetchers[activeTab]()
            setBookings(Array.isArray(data) ? data : data.results ?? [])
        } catch (err) {
            setError(
                err?.response?.status === 403
                    ? 'You do not have permission to view this data.'
                    : 'Failed to load bookings. Check the backend connection.'
            )
        } finally {
            setIsLoading(false)
        }
    }, [activeTab, refreshCount]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchFn() }, [fetchFn])

    const refresh = () => setRefreshCount(c => c + 1)

    // Only filter when a date is selected
    const filteredBookings = selectedDate
        ? bookings.filter(b => bookingMatchesDate(b, selectedDate))
        : bookings

    const handleApprove = async (id) => {
        setActionLoading(id)
        const targetBooking = bookings.find(b => b.id === id)
        const refCode = targetBooking?.reference_code
        try {
            await reviewBooking(id, { status: 'APPROVED', remarks: '' })
            const approved = targetBooking ?? { id, reference_code: '—' }
            setLastApproved(approved)
            toast.success(refCode ? `${refCode} approved.` : 'Booking approved.')
            refresh()
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Approval failed.')
        } finally {
            setActionLoading(null)
        }
    }

    const handleRejectConfirm = async (remarks) => {
        if (!rejectTarget) return
        const refCode = rejectTarget.reference_code
        setActionLoading(rejectTarget.id)
        try {
            await reviewBooking(rejectTarget.id, { status: 'REJECTED', remarks })
            setRejectTarget(null)
            toast.success(refCode ? `${refCode} rejected.` : 'Booking rejected.')
            refresh()
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Rejection failed.')
        } finally {
            setActionLoading(null)
        }
    }

    const handleRescheduleConfirm = async (payload) => {
        if (!rescheduleTarget) return
        const refCode = rescheduleTarget.reference_code
        setActionLoading(rescheduleTarget.id)
        try {
            const updatedBooking = await rescheduleBooking(rescheduleTarget.id, payload)
            setRescheduleTarget(null)
            const confirmedStart = updatedBooking?.start_datetime || payload.start_datetime
            const newTime = confirmedStart ? formatDT(confirmedStart) : ''
            const finalRef = updatedBooking?.reference_code || refCode
            if (newTime) {
                toast.success(finalRef ? `${finalRef} rescheduled to ${newTime}.` : `Trip rescheduled to ${newTime}.`)
            } else {
                toast.success(finalRef ? `${finalRef} rescheduled.` : 'Trip rescheduled.')
            }
            refresh()
        } catch (err) {
            const errData = err?.response?.data
            const msg = typeof errData === 'object'
                ? Object.values(errData).flat().join(' ')
                : 'Reschedule failed. Check for conflicts.'
            toast.error(msg)
        } finally {
            setActionLoading(null)
        }
    }

    return (
        <div className="max-w-screen-xl mx-auto px-6 py-8 text-gray-900">

            {/* Modals */}
            {rejectTarget && (
                <RejectModal
                    booking={rejectTarget}
                    onConfirm={handleRejectConfirm}
                    onCancel={() => setRejectTarget(null)}
                    isLoading={actionLoading === rejectTarget.id}
                />
            )}
            {rescheduleTarget && (
                <RescheduleModal
                    booking={rescheduleTarget}
                    vehicles={vehicles}
                    onConfirm={handleRescheduleConfirm}
                    onCancel={() => setRescheduleTarget(null)}
                    isLoading={actionLoading === rescheduleTarget.id}
                />
            )}

            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">Transport Management</h1>
                        <PageInfo text="Manage vehicle bookings — approve, reject, or reschedule transport requests from staff and faculty." />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Manage vehicles, transport bookings, and trip approvals.</p>
                </div>
                <Tooltip text="Reload this page" position="left">
                    <button
                        onClick={refresh}
                        disabled={isLoading}
                        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </Tooltip>
            </div>

            {/* Approval confirm banner */}
            <ApprovalConfirmCard booking={lastApproved} onDismiss={() => setLastApproved(null)} />

            {/* Tab bar + date picker */}
            <div className="flex items-end justify-between gap-4 mb-6 border-b border-gray-100">
                <div className="flex gap-1">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); setBookings([]) }}
                            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition border-b-2 -mb-px ${
                                activeTab === tab.key
                                    ? 'border-green-700 text-green-700 bg-green-50/50'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {tab.label}
                            {tab.key === 'pending' && filteredBookings.length > 0 && activeTab === 'pending' && (
                                <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">
                                    {filteredBookings.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Date picker — empty by default, Clear removes filter */}
                <div className="flex items-center gap-2 pb-1.5">
                    {selectedDate && (
                        <button
                            onClick={() => setSelectedDate('')}
                            className="text-sm text-green-700 hover:text-green-800 font-medium"
                        >
                            Clear
                        </button>
                    )}
                    <div className="relative flex items-center">
                        <CalendarDays className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm bg-white shadow-sm outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-slate-800"
                        />
                    </div>
                </div>
            </div>

            {/* Content panel */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

                {/* Panel header */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-7 py-3 border-b border-gray-200 bg-gray-50/50">
                    <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-gray-600">
                        {TABS.find(t => t.key === activeTab)?.label}
                        {selectedDate && (
                            <span className="ml-2 text-gray-400 font-medium normal-case tracking-normal">
                                — {formatShortDate(selectedDate)}
                            </span>
                        )}
                    </span>
                    {!isLoading && !error && (
                        <span className="text-[11px] text-gray-400 font-medium">
                            {filteredBookings.length} record{filteredBookings.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex flex-col">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="px-7 py-5 border-b border-gray-100 animate-pulse">
                                <div className="flex justify-between mb-4">
                                    <div className="h-6 bg-gray-100 rounded w-28" />
                                    <div className="h-4 bg-gray-100 rounded w-32" />
                                </div>
                                <div className="grid gap-6" style={{ gridTemplateColumns: '1.8fr 1.6fr 2fr' }}>
                                    <div className="flex gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-gray-100 shrink-0" />
                                        <div className="space-y-1.5 flex-1">
                                            <div className="h-4 bg-gray-100 rounded w-28" />
                                            <div className="h-3 bg-gray-100 rounded w-20" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-4 bg-gray-100 rounded w-36" />
                                        <div className="h-4 bg-gray-100 rounded w-36" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-4 bg-gray-100 rounded w-24" />
                                        <div className="h-3 bg-gray-100 rounded w-20" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="py-20 text-center px-8">
                        <p className="text-sm font-semibold text-gray-900 mb-2">{error}</p>
                        <button onClick={refresh} className="text-green-700 text-sm font-medium hover:underline">Try again</button>
                    </div>
                ) : filteredBookings.length === 0 ? (
                    <div className="py-20 text-center px-8">
                        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                            <CalendarDays className="w-6 h-6 text-green-600" />
                        </div>
                        <p className="text-sm font-semibold text-gray-700">
                            {selectedDate ? `No bookings for ${formatShortDate(selectedDate)}` : 'No bookings found.'}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {filteredBookings.map(booking => (
                            <BookingRow
                                key={booking.id}
                                booking={booking}
                                onApprove={handleApprove}
                                onReject={setRejectTarget}
                                onReschedule={setRescheduleTarget}
                                actionLoading={actionLoading}
                                showApproveReject={activeTab === 'pending'}
                                // ✅ Reschedule only on Approved Trips, not Pending or Resolved
                                showReschedule={activeTab === 'active'}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}