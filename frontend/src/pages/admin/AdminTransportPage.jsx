/**
 * AdminTransportPage.jsx — src/pages/admin/AdminTransportPage.jsx
 *
 * Fleet module admin management page.
 * Rendered inside AdminLayout under /admin/transport (requires can_manage_system).
 *
 * Tabs:
 *  1. Pending Requests  — approve / reject inline
 *  2. Resolved by Me    — approval history for this admin
 *  3. Active Bookings   — all currently approved fleet bookings
 *
 * Each tab supports an inline Reschedule modal for admins.
 *
 * Patterns followed:
 *  - AdminDashboard.jsx  (header, card shell, RejectModal, action buttons)
 *  - Transport.jsx       (STATUS_STYLES, formatDT, table rows)
 *  - fleetApi.js         (api function calls, error shape)
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
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

// ==========================================
// SHARED STYLE MAP  (mirrors Transport.jsx)
// ==========================================
const STATUS_STYLES = {
    APPROVED:  { badge: 'bg-green-100 text-green-700' },
    PENDING:   { badge: 'bg-yellow-100 text-yellow-700' },
    REJECTED:  { badge: 'bg-blue-100 text-blue-700' },
    CANCELLED: { badge: 'bg-gray-100 text-gray-500' },
}

function StatusBadge({ status }) {
    const s = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING
    return (
        <span className={`text-[10px] font-bold uppercase tracking-tight px-2 py-1 rounded-md ${s.badge}`}>
            {status}
        </span>
    )
}

function formatDT(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    })
}

// ==========================================
// LABEL — tiny uppercase section label
// (mirrors AdminDashboard pattern)
// ==========================================
function FieldLabel({ children }) {
    return (
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            {children}
        </p>
    )
}

// ==========================================
// REJECT MODAL  (identical pattern to AdminDashboard)
// ==========================================
function RejectModal({ booking, onConfirm, onCancel, isLoading }) {
    const [remarks, setRemarks] = useState('')
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-base font-bold text-gray-900 mb-1">Reject Booking</h3>
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
                <p className="text-[10px] text-gray-400 mt-1">This message will be recorded against the booking.</p>
                <div className="flex gap-3 mt-5 justify-end">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(remarks)}
                        disabled={isLoading || !remarks.trim()}
                        className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition disabled:opacity-50"
                    >
                        {isLoading ? 'Rejecting…' : 'Confirm Reject'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ==========================================
// RESCHEDULE MODAL
// Allows admins to change vehicle / dates /
// passengers / locations on any booking.
// ==========================================
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

        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs)
            return
        }

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
                <h3 className="text-base font-bold text-gray-900 mb-1">Reschedule / Edit Booking</h3>
                <p className="text-xs text-gray-500 mb-5">
                    <span className="font-medium text-gray-700">{booking.reference_code}</span>
                    {' · '}Requested by {booking.user_email ?? booking.user}
                </p>

                <div className="space-y-4">
                    {/* Vehicle */}
                    <div>
                        <FieldLabel>Vehicle</FieldLabel>
                        <select
                            className={inputCls('vehicle')}
                            value={form.vehicle}
                            onChange={e => set('vehicle', e.target.value)}
                        >
                            <option value="">Select vehicle</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>
                                    {v.name} — {v.registration_number} (cap: {v.capacity})
                                </option>
                            ))}
                        </select>
                        {fieldErrors.vehicle && <p className="text-xs text-red-500 mt-1">{fieldErrors.vehicle}</p>}
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <FieldLabel>Start date & time</FieldLabel>
                            <input
                                type="datetime-local"
                                className={inputCls('start_datetime')}
                                value={form.start_datetime}
                                onChange={e => set('start_datetime', e.target.value)}
                            />
                            {fieldErrors.start_datetime && <p className="text-xs text-red-500 mt-1">{fieldErrors.start_datetime}</p>}
                        </div>
                        <div>
                            <FieldLabel>End date & time</FieldLabel>
                            <input
                                type="datetime-local"
                                className={inputCls('end_datetime')}
                                value={form.end_datetime}
                                onChange={e => set('end_datetime', e.target.value)}
                            />
                            {fieldErrors.end_datetime && <p className="text-xs text-red-500 mt-1">{fieldErrors.end_datetime}</p>}
                        </div>
                    </div>

                    {/* Locations */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <FieldLabel>Pickup location</FieldLabel>
                            <input
                                className={inputCls('pickup_location')}
                                value={form.pickup_location}
                                onChange={e => set('pickup_location', e.target.value)}
                                placeholder="e.g. College main gate"
                            />
                        </div>
                        <div>
                            <FieldLabel>Destination</FieldLabel>
                            <input
                                className={inputCls('destination')}
                                value={form.destination}
                                onChange={e => set('destination', e.target.value)}
                                placeholder="e.g. Kochi"
                            />
                        </div>
                    </div>

                    {/* Passengers */}
                    <div>
                        <FieldLabel>Total passengers</FieldLabel>
                        <input
                            type="number"
                            min={1}
                            className={inputCls('total_passengers')}
                            value={form.total_passengers}
                            onChange={e => set('total_passengers', e.target.value)}
                        />
                        {fieldErrors.total_passengers && <p className="text-xs text-red-500 mt-1">{fieldErrors.total_passengers}</p>}
                    </div>

                    {/* Admin remark */}
                    <div>
                        <FieldLabel>Admin remark (optional)</FieldLabel>
                        <textarea
                            rows={2}
                            className={`${inputCls('remarks_by_admin')} resize-none`}
                            placeholder="Reason for change, operational note…"
                            value={form.remarks_by_admin}
                            onChange={e => set('remarks_by_admin', e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6 justify-end">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg transition disabled:opacity-50"
                    >
                        {isLoading ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ==========================================
// EMPTY STATE
// ==========================================
function EmptyState({ message }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">{message}</p>
        </div>
    )
}
// ApprovalConfirmCard — place after the existing RejectModal, before the main return
function ApprovalConfirmCard({ booking, onDismiss }) {
    if (!booking) return null
    return (
        <div className="mb-6 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="bg-green-50 border-b border-gray-100 px-6 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-semibold text-green-700">Request approved</p>
                    <p className="text-xs text-green-600/80">This booking has been confirmed and recorded.</p>
                </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-3 gap-5">
                {[
                    ['Reference',   booking.reference_code,                                           'font-mono text-xs'],
                    ['Status',      null,                                                              ''],
                    ['Vehicle',     booking.vehicle_details?.name ?? `Vehicle #${booking.vehicle}`,   ''],
                    ['Passengers',  booking.total_passengers,                                         ''],
                    ['Departure',   formatDT(booking.start_datetime),                                 ''],
                    ['Return',      formatDT(booking.end_datetime),                                   ''],
                    ['Route',       `${booking.pickup_location} → ${booking.destination}`,            'col-span-2 md:col-span-3'],
                    ['Approved by', booking.resolved_by_name,                                         'col-span-2 md:col-span-3'],
                ].map(([label, value, extra]) => (
                    <div key={label} className={extra}>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                        {label === 'Status'
                            ? <span className="inline-block bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">Approved</span>
                            : <p className="text-sm text-gray-900">{value ?? '—'}</p>
                        }
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-6 py-3 flex justify-end">
                <button
                    onClick={onDismiss}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                    Dismiss
                </button>
            </div>
        </div>
    )
}

// ==========================================
// BOOKING ROW  (shared across all 3 tabs)
// ==========================================
function BookingRow({ booking, onApprove, onReject, onReschedule, actionLoading, showApproveReject, showReschedule }) {
    return (
        <div className="p-6 flex flex-col lg:flex-row gap-8 hover:bg-gray-50/30 transition">
            {/* Info grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <div>
                    <FieldLabel>Vehicle</FieldLabel>
                    <p className="text-sm font-semibold text-gray-900">
                        {booking.vehicle_details?.name ?? `Vehicle #${booking.vehicle}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {booking.vehicle_details?.registration_number ?? ''}
                        {booking.total_passengers
                            ? ` · ${booking.total_passengers} pax`
                            : ''}
                    </p>
                </div>

                <div>
                    <FieldLabel>Reference</FieldLabel>
                    <p className="text-sm font-medium text-gray-900">{booking.reference_code}</p>
                    <StatusBadge status={booking.status} />
                </div>

                <div>
                    <FieldLabel>Requester</FieldLabel>
                    <p className="text-sm font-medium text-gray-900">{booking.user_email ?? booking.user}</p>
                </div>

                <div>
                    <FieldLabel>Trip</FieldLabel>
                    <p className="text-sm text-gray-700">
                        {booking.pickup_location} → {booking.destination}
                    </p>
                </div>

                <div>
                    <FieldLabel>Window</FieldLabel>
                    <p className="text-xs text-gray-700">{formatDT(booking.start_datetime)}</p>
                    <p className="text-xs text-gray-400">→ {formatDT(booking.end_datetime)}</p>
                </div>

                <div>
                    <FieldLabel>Purpose</FieldLabel>
                    <p className="text-sm text-gray-600 italic line-clamp-2">"{booking.purpose}"</p>
                </div>

                {booking.remarks_by_admin && (
                    <div className="md:col-span-2 xl:col-span-3">
                        <FieldLabel>Admin remark</FieldLabel>
                        <p className="text-sm text-gray-600">{booking.remarks_by_admin}</p>
                    </div>
                )}

                {booking.resolved_by_name && (
                    <div>
                        <FieldLabel>Resolved by</FieldLabel>
                        <p className="text-sm text-gray-700">{booking.resolved_by_name}</p>
                        <p className="text-xs text-gray-400">{formatDT(booking.resolved_at)}</p>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 lg:border-l lg:border-gray-100 lg:pl-8 shrink-0">
                {/* Reschedule — available in all tabs */}
                {showReschedule && (
                    <button
                        onClick={() => onReschedule(booking)}
                        disabled={actionLoading === booking.id}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
                    >
                        Reschedule
                    </button>
                )}

                {/* Approve / Reject — only in Pending tab */}
                {showApproveReject && (
                    <>
                        <button
                            onClick={() => onReject(booking)}
                            disabled={actionLoading === booking.id}
                            className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                        >
                            Reject
                        </button>
                        <button
                            onClick={() => onApprove(booking.id)}
                            disabled={actionLoading === booking.id}
                            className="px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg shadow-sm transition disabled:opacity-50"
                        >
                            {actionLoading === booking.id ? 'Processing…' : 'Approve'}
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

// ==========================================
// TAB DEFINITIONS
// ==========================================
const TABS = [
    { key: 'pending',        label: 'Pending Requests' },
    { key: 'resolved_by_me', label: 'Resolved by Me'   },
    { key: 'active',         label: 'Active Bookings'  },
]

// ==========================================
// MAIN PAGE
// ==========================================
export default function AdminTransportPage() {
    const [activeTab, setActiveTab]   = useState('pending')
    const [bookings, setBookings]     = useState([])
    const [isLoading, setIsLoading]   = useState(true)
    const [error, setError]           = useState(null)
    const [refreshCount, setRefreshCount] = useState(0)

    // Action state
    const [actionLoading, setActionLoading] = useState(null)
    const [rejectTarget, setRejectTarget]   = useState(null)
    const [rescheduleTarget, setRescheduleTarget] = useState(null)

    // Vehicles needed by RescheduleModal
    const [vehicles, setVehicles] = useState([])
    const [lastApproved, setLastApproved] = useState(null)
    

    // ------------------------------------------------------------------
    // Fetch vehicles once for the reschedule modal
    // ------------------------------------------------------------------
    useEffect(() => {
        getVehicles()
            .then(data => setVehicles(Array.isArray(data) ? data : data.results ?? []))
            .catch(() => {}) // non-critical; modal will show empty dropdown
    }, [])

    // ------------------------------------------------------------------
    // Fetch bookings whenever tab or refreshCount changes
    // ------------------------------------------------------------------
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
            console.error(err)
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

    // ------------------------------------------------------------------
    // APPROVE
    // ------------------------------------------------------------------
    const handleApprove = async (id) => {
        setActionLoading(id)
        try {
            await reviewBooking(id, { status: 'APPROVED', remarks: '' })
            // Store the booking object so the card can display its details
            const approved = bookings.find(b => b.id === id)
            setLastApproved(approved ?? { id, reference_code: '—' })
            refresh()
        } catch (err) {
            alert(err?.response?.data?.error || 'Approval failed.')
        } finally {
            setActionLoading(null)
        }
    }

    // ------------------------------------------------------------------
    // REJECT (step 1: open modal)
    // ------------------------------------------------------------------
    const handleRejectClick = (booking) => setRejectTarget(booking)

    // REJECT (step 2: submit with remarks from modal)
    const handleRejectConfirm = async (remarks) => {
        if (!rejectTarget) return
        setActionLoading(rejectTarget.id)
        try {
            await reviewBooking(rejectTarget.id, { status: 'REJECTED', remarks })
            setRejectTarget(null)
            refresh()
        } catch (err) {
            alert(err?.response?.data?.error || 'Rejection failed.')
        } finally {
            setActionLoading(null)
        }
    }

    // ------------------------------------------------------------------
    // RESCHEDULE
    // ------------------------------------------------------------------
    const handleRescheduleClick  = (booking) => setRescheduleTarget(booking)

    const handleRescheduleConfirm = async (payload) => {
        if (!rescheduleTarget) return
        setActionLoading(rescheduleTarget.id)
        try {
            await rescheduleBooking(rescheduleTarget.id, payload)
            setRescheduleTarget(null)
            refresh()
        } catch (err) {
            const errData = err?.response?.data
            const msg = typeof errData === 'object'
                ? Object.values(errData).flat().join(' ')
                : 'Reschedule failed. Check for conflicts.'
            alert(msg)
        } finally {
            setActionLoading(null)
        }
    }

    // ------------------------------------------------------------------
    // TAB CONFIG
    // ------------------------------------------------------------------
    const currentTab = TABS.find(t => t.key === activeTab)
    const emptyMessages = {
        pending:        'No pending transport requests. Queue is clear.',
        resolved_by_me: 'No bookings resolved by you yet.',
        active:         'No active (approved) fleet bookings.',
    }

    // ------------------------------------------------------------------
    // RENDER
    // ------------------------------------------------------------------
    return (
        <div className="max-w-screen-xl mx-auto px-6 py-8 font-geist text-gray-900">

            {/* MODALS */}
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

            {/* HEADER */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold tracking-tight">Transport Management</h1>
                      <PageInfo text="Manage vehicle bookings — approve, reject, or reschedule transport requests from staff and faculty." />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage vehicles, transport bookings, and trip approvals.
                    </p>
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
            <ApprovalConfirmCard
            booking={lastApproved}
            onDismiss={() => setLastApproved(null)}
            />
            {/* TAB BAR */}
            <div className="flex gap-1 mb-6 border-b border-gray-100">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); setBookings([]); }}
                        className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition border-b-2 -mb-px ${
                            activeTab === tab.key
                                ? 'border-green-700 text-green-700 bg-green-50/50'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        {tab.label}
                        {tab.key === 'pending' && bookings.length > 0 && activeTab === 'pending' && (
                            <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">
                                {bookings.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* CONTENT CARD */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col">

                {/* Card header */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        {currentTab?.label}
                    </h2>
                    {!isLoading && !error && (
                        <span className="text-[10px] text-gray-400 font-medium">
                            {bookings.length} record{bookings.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {/* States */}
                {error ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-600">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{error}</p>
                        <button
                            onClick={refresh}
                            className="mt-3 text-xs font-semibold text-green-700 hover:underline"
                        >
                            Try again
                        </button>
                    </div>
                ) : isLoading ? (
                    <div className="flex-1 flex items-center justify-center p-12 text-sm text-gray-400 animate-pulse italic">
                        Loading fleet data…
                    </div>
                ) : bookings.length === 0 ? (
                    <EmptyState message={emptyMessages[activeTab]} />
                ) : (
                    <div className="divide-y divide-gray-100">
                        {bookings.map(booking => (
                            <BookingRow
                                key={booking.id}
                                booking={booking}
                                onApprove={handleApprove}
                                onReject={handleRejectClick}
                                onReschedule={handleRescheduleClick}
                                actionLoading={actionLoading}
                                showApproveReject={activeTab === 'pending'}
                                showReschedule={activeTab !== 'resolved_by_me'}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}