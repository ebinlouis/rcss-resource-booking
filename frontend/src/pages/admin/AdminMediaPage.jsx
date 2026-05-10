import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import mediaApi from '../../api/mediaApi'

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
    })
}

function formatTime(timeStr) {
    if (!timeStr) return '—'
    // Ensure timeStr is HH:MM:SS before parsing
    const parts = timeStr.split(':')
    if (parts.length >= 2) {
        const date = new Date()
        date.setHours(parseInt(parts[0]), parseInt(parts[1]), 0)
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    }
    return timeStr
}

function FieldLabel({ children }) {
    return (
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            {children}
        </p>
    )
}

function RejectModal({ booking, onConfirm, onCancel, isLoading }) {
    const [remarks, setRemarks] = useState('')
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-base font-bold text-gray-900 mb-1">Reject Booking</h3>
                <p className="text-xs text-gray-500 mb-4">
                    <span className="font-medium text-gray-700">{booking.reference_code}</span>
                    {' · '}{booking.event_name}
                </p>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                    Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                    rows={4}
                    placeholder="e.g. Equipment unavailable, scheduling conflict…"
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
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50"
                    >
                        {isLoading ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function AdminMediaPage() {
    const [activeTab, setActiveTab] = useState('pending')
    const [data, setData] = useState({ pending: [], resolved: [], active: [] })
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(null)
    const [rejectTarget, setRejectTarget] = useState(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [pending, resolved, active] = await Promise.all([
                mediaApi.getPendingBookings(),
                mediaApi.getResolvedByMe(),
                mediaApi.getActiveBookings(),
            ])
            setData({ pending, resolved, active })
        } catch (err) {
            console.error("Failed to load media admin data", err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleApprove = async (id) => {
        setActionLoading(id)
        try {
            await mediaApi.reviewBooking(id, { status: 'APPROVED' })
            await fetchData()
        } catch (err) {
            alert("Failed to approve booking. " + (err.response?.data?.error || ""))
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async (remarks) => {
        if (!rejectTarget) return
        setActionLoading(rejectTarget.id)
        try {
            await mediaApi.reviewBooking(rejectTarget.id, { status: 'REJECTED', remarks_by_admin: remarks })
            setRejectTarget(null)
            await fetchData()
        } catch (err) {
            alert("Failed to reject booking. " + (err.response?.data?.error || ""))
        } finally {
            setActionLoading(null)
        }
    }

    const renderCard = (b, isPending) => (
        <div key={b.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition duration-200">
            <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-start bg-gray-50/50">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {b.reference_code}
                        </span>
                        <StatusBadge status={b.status} />
                    </div>
                    <h3 className="font-bold text-gray-900">{b.event_name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        By <span className="font-medium text-gray-700">{b.user_name || `User #${b.user}`}</span>
                        {b.department_name && ` · ${b.department_name}`}
                    </p>
                </div>
            </div>

            <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6">
                    <div>
                        <FieldLabel>Date</FieldLabel>
                        <p className="text-sm font-medium text-gray-900">{formatDT(b.booking_date)}</p>
                    </div>
                    <div>
                        <FieldLabel>Time</FieldLabel>
                        <p className="text-sm font-medium text-gray-900">
                            {formatTime(b.start_time)} - {formatTime(b.end_time)}
                        </p>
                    </div>
                    <div>
                        <FieldLabel>Space</FieldLabel>
                        <p className="text-sm font-medium text-gray-900">{b.space_details?.name || 'Any suitable'}</p>
                    </div>
                    <div>
                        <FieldLabel>Org / Club</FieldLabel>
                        <p className="text-sm font-medium text-gray-900">{b.organization || '—'}</p>
                    </div>
                </div>

                {(b.requested_equipment || b.requested_services) && (
                    <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {b.requested_equipment && (
                            <div>
                                <FieldLabel>Equipment</FieldLabel>
                                <p className="text-sm text-gray-700">{b.requested_equipment}</p>
                            </div>
                        )}
                        {b.requested_services && (
                            <div>
                                <FieldLabel>Services</FieldLabel>
                                <p className="text-sm text-gray-700">{b.requested_services}</p>
                            </div>
                        )}
                    </div>
                )}

                {b.user_notes && (
                    <div className="mt-4 pt-4 border-t border-gray-50 bg-amber-50/30 -mx-5 px-5 pb-2">
                        <FieldLabel>User Notes</FieldLabel>
                        <p className="text-sm text-amber-900 italic">"{b.user_notes}"</p>
                    </div>
                )}

                {b.status === 'REJECTED' && b.remarks_by_admin && (
                    <div className="mt-4 pt-4 border-t border-gray-50 bg-red-50/50 -mx-5 px-5 pb-2">
                        <FieldLabel>Rejection Reason</FieldLabel>
                        <p className="text-sm text-red-700 font-medium">{b.remarks_by_admin}</p>
                    </div>
                )}

                {isPending && (
                    <div className="mt-5 pt-4 border-t border-gray-100 flex gap-3 justify-end">
                        <button
                            onClick={() => setRejectTarget(b)}
                            disabled={actionLoading === b.id}
                            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                        >
                            Reject
                        </button>
                        <button
                            onClick={() => handleApprove(b.id)}
                            disabled={actionLoading === b.id}
                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                        >
                            {actionLoading === b.id ? 'Processing...' : 'Approve Request'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )

    const list = data[activeTab] || []

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {rejectTarget && (
                <RejectModal
                    booking={rejectTarget}
                    onConfirm={handleReject}
                    onCancel={() => setRejectTarget(null)}
                    isLoading={actionLoading === rejectTarget.id}
                />
            )}

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Media Operations</h1>
                    <p className="text-sm text-gray-500 mt-1">Review and manage media, equipment, and service requests.</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition shadow-sm"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <div className="flex space-x-1 bg-gray-100/80 p-1 rounded-xl w-fit mb-6">
                {[
                    { id: 'pending', label: 'Pending Requests', count: data.pending.length },
                    { id: 'active', label: 'Active Bookings', count: data.active.length },
                    { id: 'resolved', label: 'Resolved by Me', count: data.resolved.length },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === tab.id
                                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-900/5'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                            }`}
                    >
                        {tab.label}
                        <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-gray-100 text-gray-900' : 'bg-gray-200/50 text-gray-500'}`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="py-12 text-center">
                        <div className="w-8 h-8 border-4 border-gray-200 border-t-green-600 rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-sm text-gray-500 font-medium">Loading requests...</p>
                    </div>
                ) : list.length === 0 ? (
                    <div className="bg-white border border-gray-100 rounded-xl p-12 text-center shadow-sm">
                        <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
                            🎬
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 mb-1">No requests found</h3>
                        <p className="text-xs text-gray-500">There are no {activeTab} media requests at the moment.</p>
                    </div>
                ) : (
                    list.map(b => renderCard(b, activeTab === 'pending'))
                )}
            </div>
        </div>
    )
}

export default AdminMediaPage
