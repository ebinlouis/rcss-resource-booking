import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import approvalService from '../../api/approvalService';
import { useAuth } from '../../hooks/useAuth';

// ─── Utilities ────────────────────────────────────────────────────────────────

const formatDateTime = (isoString) => {
    if (!isoString) return 'TBD';
    return new Intl.DateTimeFormat('en-IN', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date(isoString));
};

const timeAgo = (isoString) => {
    if (!isoString) return '';
    const mins = Math.round((Date.now() - new Date(isoString)) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icon = ({ path, className = 'w-4 h-4', strokeWidth = 1.75, fill = 'none' }) => (
    <svg className={className} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
    </svg>
);

const IconBuilding = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 8h.01M15 8h.01M9 13h.01M15 13h.01"/>
    </svg>
);

const IconCheck = ({ className = 'w-4 h-4' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M5 13l4 4L19 7"/>
    </svg>
);

const IconX = ({ className = 'w-4 h-4' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
);

const IconRefresh = ({ spinning, className = 'w-4 h-4' }) => (
    <svg
        className={className}
        style={spinning ? { animation: 'spin 0.7s linear infinite' } : {}}
        viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"
    >
        <path d="M1 4v6h6M23 20v-6h-6"/>
        <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/>
    </svg>
);

const IconUsers = ({ className = 'w-[13px] h-[13px]' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
);

const IconAlert = ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
);

const IconBox = ({ className = 'w-[10px] h-[10px]' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
);

// ─── Reject Modal ─────────────────────────────────────────────────────────────

const RejectModal = ({ booking, onConfirm, onCancel, isLoading }) => {
    const [remarks, setRemarks] = useState('');
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl border border-[#e8f5ee] shadow-2xl shadow-black/10 p-7 w-full max-w-[420px]">
                <p className="text-[15px] font-semibold text-[#0f0f0f] tracking-tight">Reject booking</p>
                <p className="text-[13px] text-[#6b6b6b] mt-1 pb-4 border-b border-[#e8f5ee]">
                    <span className="font-medium text-[#0f0f0f]">{booking.reference_code}</span>
                    {' '}· {booking.resource_name}
                </p>

                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#a8c4b4] mt-4 mb-2">
                    Reason for rejection <span className="text-[#dc2626]">*</span>
                </p>
                <textarea
                    className="w-full border border-[#e2e8f0] rounded-xl px-3.5 py-2.5 text-[13px] text-[#0f0f0f] bg-white resize-none outline-none min-h-[88px] transition-all focus:border-[#15803d] focus:ring-2 focus:ring-[#dcfce7]"
                    placeholder="e.g. Conflicting schedule, missing documentation…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    autoFocus
                    style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
                />
                <p className="text-[11px] text-[#a8c4b4] mt-1.5">This message will be recorded against the booking.</p>

                <div className="flex gap-2 justify-end mt-5">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-xl border border-[#e2e8f0] text-[13px] text-[#6b6b6b] hover:bg-[#f6fbf8] transition disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(remarks)}
                        disabled={isLoading || !remarks.trim()}
                        className="px-4 py-2 rounded-xl border-none bg-[#dc2626] text-white text-[13px] font-semibold hover:opacity-85 transition disabled:opacity-40"
                    >
                        {isLoading ? 'Rejecting…' : 'Confirm rejection'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Success Modal ────────────────────────────────────────────────────────────

const SuccessModal = ({ booking, onClose }) => {
    if (!booking) return null;
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl border border-[#e8f5ee] shadow-2xl shadow-black/10 p-7 w-full max-w-[360px] text-center">
                <div className="w-12 h-12 rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-4">
                    <IconCheck className="w-5 h-5 text-[#15803d]" />
                </div>
                <p className="text-[15px] font-semibold text-[#0f0f0f] tracking-tight">Booking approved</p>
                <p className="text-[13px] text-[#6b6b6b] mt-1.5 leading-relaxed">
                    Request <span className="font-medium text-[#0f0f0f]">{booking.reference_code}</span> for{' '}
                    <span className="font-medium text-[#0f0f0f]">{booking.resource_name}</span> has been approved.
                </p>
                <button
                    onClick={onClose}
                    className="w-full mt-5 py-2.5 rounded-xl bg-[#15803d] text-white text-[13px] font-semibold hover:bg-[#166534] transition"
                >
                    Continue
                </button>
            </div>
        </div>
    );
};

// ─── Booking Row ──────────────────────────────────────────────────────────────

const BookingRow = ({ booking, onApprove, onReject, isActing }) => {
    const hasEquipment = booking.equipment_requests?.length > 0;
    const hasNotes     = booking.user_notes?.trim().length > 0;

    return (
        <div className="px-6 py-5 border-b border-[#e8f5ee] last:border-0 hover:bg-[#f6fbf8] transition-colors duration-100">

            {/* Top strip */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11.5px] text-[#4a6b58] bg-[#f0fdf4] px-2 py-0.5 rounded-md border border-[#d1fae5]">
                        {booking.reference_code}
                    </span>
                    {booking.attendee_count && (
                        <span className="flex items-center gap-1 text-[12px] text-[#86a898]">
                            <IconUsers /> {booking.attendee_count} pax
                        </span>
                    )}
                </div>
                <span className="text-[11px] text-[#a8c4b4]">Requested {timeAgo(booking.created_at)}</span>
            </div>

            {/* 3-col info grid */}
            <div className="grid gap-6" style={{ gridTemplateColumns: '1.8fr 1.6fr 2.6fr' }}>

                {/* Resource */}
                <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#a8c4b4] mb-2">Resource</p>
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#f0fdf4] border border-[#d1fae5] flex items-center justify-center shrink-0 text-[#15803d]">
                            <IconBuilding className="w-[17px] h-[17px]" />
                        </div>
                        <div>
                            <p className="text-[14px] font-semibold text-[#0f0f0f] leading-tight">{booking.resource_name || 'Space'}</p>
                            <p className="text-[11px] text-[#a8c4b4] mt-0.5">Spaces · {booking.reference_code}</p>
                        </div>
                    </div>
                </div>

                {/* Schedule */}
                <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#a8c4b4] mb-2">Schedule</p>
                    <div className="flex flex-col gap-0">
                        {/* Start */}
                        <div className="flex items-start gap-2.5">
                            <div className="flex flex-col items-center pt-1">
                                <span className="w-[7px] h-[7px] rounded-full bg-[#22c55e] shrink-0" />
                                <span className="w-px h-[18px] bg-[#d1fae5] my-1" />
                            </div>
                            <div>
                                <span className="block text-[10px] text-[#a8c4b4] tracking-wide">Starts</span>
                                <span className="text-[13px] font-medium text-[#0f0f0f]">{formatDateTime(booking.start_datetime)}</span>
                            </div>
                        </div>
                        {/* End */}
                        <div className="flex items-start gap-2.5">
                            <div className="flex flex-col items-center pt-1">
                                <span className="w-[7px] h-[7px] rounded-full bg-[#dc2626] shrink-0" />
                            </div>
                            <div>
                                <span className="block text-[10px] text-[#a8c4b4] tracking-wide">Ends</span>
                                <span className="text-[13px] font-medium text-[#0f0f0f]">{formatDateTime(booking.end_datetime)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Requester + Purpose */}
                <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#a8c4b4] mb-2">Requester &amp; purpose</p>
                    <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#f0fdf4] border border-[#d1fae5] text-[#15803d] text-[11px] font-bold flex items-center justify-center shrink-0">
                            {booking.requester?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                            <p className="text-[13px] font-semibold text-[#0f0f0f] leading-tight">{booking.requester}</p>
                            <p className="text-[11px] text-[#a8c4b4]">{booking.department || 'General Member'}</p>
                        </div>
                    </div>
                    <p className="text-[12.5px] text-[#4a6b58] bg-[#f6fbf8] px-3 py-2 rounded-xl border border-[#e8f5ee] leading-relaxed line-clamp-2">
                        {booking.purpose || 'No purpose provided.'}
                    </p>
                </div>
            </div>

            {/* Equipment + Notes */}
            {(hasEquipment || hasNotes) && (
                <div className="mt-4 pt-4 border-t border-[#e8f5ee] flex flex-col gap-3">
                    {hasEquipment && (
                        <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#a8c4b4] mb-2">Equipment requested</p>
                            <div className="flex flex-wrap gap-1.5">
                                {booking.equipment_requests.map((er) => (
                                    <span key={er.id} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#15803d] bg-[#f0fdf4] border border-[#d1fae5] px-2.5 py-1 rounded-full">
                                        <IconBox />
                                        {er.equipment_name}
                                        {er.quantity > 1 && <span className="opacity-60">&nbsp;×&nbsp;{er.quantity}</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {hasNotes && (
                        <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#b45309] mb-1.5">User notes</p>
                            <p className="text-[12.5px] text-[#6b6b6b] bg-[#fffbeb] px-3 py-2 rounded-xl border border-[#fde68a]/60 leading-relaxed">
                                {booking.user_notes}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[#e8f5ee]">
                <button
                    onClick={() => onReject(booking)}
                    disabled={isActing}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#e2e8f0] text-[13px] text-[#6b6b6b] bg-white hover:bg-[#fef2f2] hover:text-[#dc2626] hover:border-[#fca5a5] transition-all duration-150 disabled:opacity-40"
                >
                    <IconX /> Reject
                </button>
                <button
                    onClick={() => onApprove(booking)}
                    disabled={isActing}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-none bg-[#15803d] text-white text-[13px] font-semibold hover:bg-[#166534] transition-all duration-150 disabled:opacity-40"
                >
                    {isActing ? 'Processing…' : <><IconCheck /> Approve</>}
                </button>
            </div>
        </div>
    );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const AdminDashboard = () => {
    const { can_manage_system, can_manage_mess } = useAuth();
    const navigate = useNavigate();

    const [pendingBookings, setPendingBookings] = useState([]);
    const [isLoading,       setIsLoading]       = useState(true);
    const [actionLoading,   setActionLoading]   = useState(null);
    const [error,           setError]           = useState(null);
    const [refreshCount,    setRefreshCount]    = useState(0);
    const [rejectTarget,    setRejectTarget]    = useState(null);
    const [successTarget,   setSuccessTarget]   = useState(null);

    useEffect(() => {
        let isMounted = true;

        if (can_manage_mess && !can_manage_system) {
            navigate('/admin/mess', { replace: true });
            return;
        }

        const fetchQueue = async () => {
            setIsLoading(true);
            try {
                const data = await approvalService.getPendingApprovals();
                if (isMounted) {
                    const cleanQueue = (data.queue || []).filter(
                        (b) => b.domain?.toLowerCase() !== 'mess'
                    );
                    setPendingBookings(cleanQueue);
                    setError(null);
                }
            } catch (err) {
                console.error('Fetch error:', err);
                if (isMounted) {
                    setError(
                        err.response?.status === 401
                            ? 'Your account lacks approver privileges.'
                            : 'Connection failed. Please check your backend server.'
                    );
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchQueue();
        return () => { isMounted = false; };
    }, [refreshCount, can_manage_system, can_manage_mess, navigate]);

    const handleRefresh = () => { setIsLoading(true); setRefreshCount((c) => c + 1); };

    const handleApprove = async (booking) => {
        setActionLoading(booking.id);
        try {
            await approvalService.resolveBooking({ module: booking.domain, id: booking.id, status: 'APPROVED', remarks: '' });
            setPendingBookings((prev) => prev.filter((b) => b.id !== booking.id));
            setSuccessTarget(booking);
        } catch (err) {
            console.error('Approve error:', err);
            alert(err.response?.data?.error || 'Approval failed. Check admin permissions.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectConfirm = async (remarks) => {
        if (!rejectTarget) return;
        setActionLoading(rejectTarget.id);
        try {
            await approvalService.resolveBooking({ module: rejectTarget.domain, id: rejectTarget.id, status: 'REJECTED', remarks });
            setPendingBookings((prev) => prev.filter((b) => b.id !== rejectTarget.id));
            setRejectTarget(null);
        } catch (err) {
            console.error('Reject error:', err);
            alert(err.response?.data?.error || 'Rejection failed. Check admin permissions.');
        } finally {
            setActionLoading(null);
        }
    };

    const todayCount = pendingBookings.filter((b) => {
        if (!b.start_datetime) return false;
        const d = new Date(b.start_datetime), now = new Date();
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const totalPax = pendingBookings.reduce((s, b) => s + (b.attendee_count || 0), 0);

    return (
        <div
            className="min-h-full bg-[#f6fbf8] p-6 md:p-8"
            style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
        >
            {/* spin keyframe */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Modals */}
            {rejectTarget  && <RejectModal  booking={rejectTarget}  onConfirm={handleRejectConfirm} onCancel={() => setRejectTarget(null)}  isLoading={actionLoading === rejectTarget.id} />}
            {successTarget && <SuccessModal booking={successTarget} onClose={() => setSuccessTarget(null)} />}

            <div className="max-w-[1100px] mx-auto">

                {/* Page header */}
                <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
                    <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#a8c4b4] mb-1">
                            Rajagiri College · Admin
                        </p>
                        <h1 className="text-[22px] font-bold text-[#0f172a] tracking-tight leading-none">
                            Space Approval
                        </h1>
                        <p className="text-[13px] text-[#86a898] mt-1.5">
                            {error
                                ? 'Authentication required'
                                : `${pendingBookings.length} pending request${pendingBookings.length !== 1 ? 's' : ''} awaiting review`}
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#d1fae5] bg-white text-[13px] text-[#4a6b58] hover:bg-[#f0fdf4] transition-all duration-150 disabled:opacity-40"
                    >
                        <IconRefresh spinning={isLoading} />
                        Refresh
                    </button>
                </div>

                {/* Stat strip */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                        { value: pendingBookings.length, label: 'Total pending' },
                        { value: todayCount,             label: 'Scheduled today' },
                        { value: totalPax,               label: 'Total expected pax' },
                    ].map(({ value, label }) => (
                        <div key={label} className="bg-white border border-[#e8f5ee] rounded-2xl px-5 py-4">
                            <p className="text-[28px] font-light text-[#0f172a] tracking-tight leading-none">{value}</p>
                            <p className="text-[11px] text-[#a8c4b4] mt-1.5 tracking-wide">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Queue panel */}
                <div className="bg-white border border-[#e8f5ee] rounded-2xl overflow-hidden">

                    {/* Panel header */}
                    <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#e8f5ee]">
                        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-[#a8c4b4]">
                            Pending approvals · Spaces
                        </span>
                    </div>

                    {/* States */}
                    {error ? (
                        <div className="py-16 text-center px-8">
                            <div className="w-11 h-11 rounded-full bg-[#fef2f2] flex items-center justify-center mx-auto mb-3 text-[#dc2626]">
                                <IconAlert />
                            </div>
                            <p className="text-[14px] font-semibold text-[#0f172a]">{error}</p>
                            <p className="text-[12.5px] text-[#a8c4b4] mt-1">Log out and back in to refresh your session.</p>
                        </div>
                    ) : isLoading && pendingBookings.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="text-[13px] text-[#a8c4b4]">Loading resource queue…</p>
                        </div>
                    ) : pendingBookings.length === 0 ? (
                        <div className="py-16 text-center px-8">
                            <div className="w-11 h-11 rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-3 text-[#15803d]">
                                <IconCheck className="w-5 h-5" />
                            </div>
                            <p className="text-[14px] font-semibold text-[#0f172a]">Queue clear</p>
                            <p className="text-[12.5px] text-[#a8c4b4] mt-1">All requests have been processed.</p>
                        </div>
                    ) : (
                        pendingBookings.map((booking) => (
                            <BookingRow
                                key={`${booking.domain}-${booking.id}`}
                                booking={booking}
                                onApprove={handleApprove}
                                onReject={setRejectTarget}
                                isActing={actionLoading === booking.id}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;