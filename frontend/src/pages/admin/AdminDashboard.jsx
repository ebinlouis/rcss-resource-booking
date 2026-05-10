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
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconBuilding = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 8h.01M15 8h.01M9 13h.01M15 13h.01"/>
    </svg>
);

const IconCheck = ({ className = 'w-[18px] h-[18px]' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M5 13l4 4L19 7"/>
    </svg>
);

const IconX = ({ className = 'w-[18px] h-[18px]' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
);

const IconRefresh = ({ spinning, className = 'w-[18px] h-[18px]' }) => (
    <svg
        className={className}
        style={spinning ? { animation: 'spin 0.7s linear infinite' } : {}}
        viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"
    >
        <path d="M1 4v6h6M23 20v-6h-6"/>
        <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/>
    </svg>
);

const IconUsers = ({ className = 'w-[15px] h-[15px]' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
);

const IconAlert = ({ className = 'w-6 h-6' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
);

const IconBox = ({ className = 'w-3 h-3' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
);

const IconChevron = ({ className = 'w-4 h-4', expanded }) => (
    <svg 
        className={`${className} transition-transform duration-300 ease-in-out ${expanded ? 'rotate-180' : ''}`} 
        viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"
    >
        <path d="M6 9l6 6 6-6"/>
    </svg>
);

// ─── Reject Modal ─────────────────────────────────────────────────────────────

const RejectModal = ({ booking, onConfirm, onCancel, isLoading }) => {
    const [remarks, setRemarks] = useState('');
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl border border-[#e8f5ee] shadow-2xl shadow-black/10 p-7 w-full max-w-[440px]"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
                <p className="text-[17px] font-semibold text-[#0f172a] tracking-tight">Reject this booking?</p>
                <p className="text-[14px] text-[#6b6b6b] mt-1 pb-4 border-b border-[#e8f5ee]">
                    <span className="font-medium text-[#0f172a]">{booking.reference_code}</span>
                    {' '}· {booking.resource_name}
                </p>

                <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#a8c4b4] mt-4 mb-2">
                    Reason <span className="text-[#dc2626]">*</span>
                </p>
                <textarea
                    className="w-full border border-[#e2e8f0] rounded-xl px-4 py-3 text-[14px] text-[#0f172a] bg-white resize-none outline-none min-h-[96px] transition-all focus:border-[#15803d] focus:ring-2 focus:ring-[#dcfce7]"
                    placeholder="e.g. Schedule conflict, missing documentation…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    autoFocus
                    style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
                />
                <p className="text-[12px] text-[#a8c4b4] mt-1.5">The requester will see this reason.</p>

                <div className="flex gap-2 justify-end mt-5">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-5 py-2.5 rounded-xl border border-[#e2e8f0] text-[14px] text-[#6b6b6b] hover:bg-[#f6fbf8] transition disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(remarks)}
                        disabled={isLoading || !remarks.trim()}
                        className="px-5 py-2.5 rounded-xl bg-[#dc2626] text-white text-[14px] font-semibold hover:opacity-85 transition disabled:opacity-40"
                    >
                        {isLoading ? 'Rejecting…' : 'Reject booking'}
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
            <div className="bg-white rounded-2xl border border-[#e8f5ee] shadow-2xl shadow-black/10 p-8 w-full max-w-[360px] text-center"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
                <div className="w-14 h-14 rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-5">
                    <IconCheck className="w-6 h-6 text-[#15803d]" />
                </div>
                <p className="text-[17px] font-semibold text-[#0f172a] tracking-tight">Booking approved!</p>
                <p className="text-[14px] text-[#6b6b6b] mt-2 leading-relaxed">
                    <span className="font-medium text-[#0f172a]">{booking.resource_name}</span> has been approved for{' '}
                    <span className="font-medium text-[#0f172a]">{booking.requester}</span>.
                </p>
                <button
                    onClick={onClose}
                    className="w-full mt-6 py-3 rounded-xl bg-[#15803d] text-white text-[14px] font-semibold hover:bg-[#166534] transition"
                >
                    Done
                </button>
            </div>
        </div>
    );
};

// ─── Booking Row ──────────────────────────────────────────────────────────────

const BookingRow = ({ booking, onApprove, onReject, isActing }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasEquipment = booking.equipment_requests?.length > 0;
    const hasNotes     = booking.user_notes?.trim().length > 0;

    return (
        <div className={`px-7 border-b border-[#e8f5ee] last:border-0 transition-colors duration-150 ${isExpanded ? 'bg-[#f6fbf8]' : 'hover:bg-[#f6fbf8]'}`}>
            
            {/* CLICKABLE QUICK-GLANCE HEADER */}
            <div 
                className="py-6 cursor-pointer select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {/* Top strip */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-[13.5px] font-semibold text-[#14532d] bg-[#f0fdf4] px-3 py-1 rounded-lg border border-[#d1fae5] tracking-wide">
                            {booking.reference_code}
                        </span>
                        {booking.attendee_count > 0 && (
                            <span className="flex items-center gap-1.5 text-[14px] text-[#374151] font-medium">
                                <IconUsers className="w-4 h-4 text-[#15803d]" />
                                {booking.attendee_count} {booking.attendee_count === 1 ? 'person' : 'people'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[13px] text-[#6b7280] font-medium">Submitted {timeAgo(booking.created_at)}</span>
                        <div className="w-8 h-8 rounded-full hover:bg-[#e8f5ee] flex items-center justify-center transition-colors">
                            <IconChevron expanded={isExpanded} className="w-5 h-5 text-[#94a3b8]" />
                        </div>
                    </div>
                </div>

                {/* 3-col info grid (Always Visible) */}
                <div className="grid gap-7 grid-cols-1 md:grid-cols-3">
                    {/* Space */}
                    <div>
                        <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2.5">Space</p>
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#f0fdf4] border border-[#d1fae5] flex items-center justify-center shrink-0 text-[#15803d]">
                                <IconBuilding className="w-[20px] h-[20px]" />
                            </div>
                            <div>
                                <p className="text-[16px] font-semibold text-[#0f172a] leading-tight">{booking.resource_name || 'Space'}</p>
                                <p className="text-[13px] text-[#6b7280] mt-0.5">{booking.reference_code}</p>
                            </div>
                        </div>
                    </div>

                    {/* Schedule */}
                    <div>
                        <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2.5">When</p>
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] shrink-0" />
                                <div>
                                    <span className="block text-[12px] font-semibold text-[#6b7280] uppercase tracking-wide mb-0.5">From</span>
                                    <span className="text-[15px] font-semibold text-[#0f172a]">{formatDateTime(booking.start_datetime)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] shrink-0" />
                                <div>
                                    <span className="block text-[12px] font-semibold text-[#6b7280] uppercase tracking-wide mb-0.5">To</span>
                                    <span className="text-[15px] font-semibold text-[#0f172a]">{formatDateTime(booking.end_datetime)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Requester */}
                    <div>
                        <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2.5">Requested by</p>
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#f0fdf4] border border-[#d1fae5] text-[#15803d] text-[15px] font-bold flex items-center justify-center shrink-0">
                                {booking.requester?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[15px] font-semibold text-[#0f172a] leading-tight">{booking.requester}</p>
                                <p className="text-[13px] font-semibold text-[#15803d] mt-0.5">
                                    {booking.department_name || booking.department || 'General Member'}
                                </p>
                                {booking.requester_email && (
                                    <p className="text-[13px] text-[#6b7280] mt-1 truncate">{booking.requester_email}</p>
                                )}
                                {booking.requester_phone && (
                                    <p className="text-[13px] text-[#6b7280] mt-0.5">{booking.requester_phone}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* EXPANDED CONTENT AREA */}
            {isExpanded && (
                <div className="pb-6 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="pt-6 border-t border-[#e8f5ee]">
                        {/* Purpose */}
                        <div className="mb-6">
                            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2">Purpose of Booking</p>
                            <div className="bg-[#f0fdf4] border border-[#d1fae5] rounded-xl px-4 py-3.5">
                                <p className="text-[14.5px] text-[#14532d] font-medium leading-relaxed">
                                    {booking.purpose_of_booking || booking.purpose || 'No purpose provided.'}
                                </p>
                            </div>
                        </div>

                        {/* Equipment + Notes */}
                        {(hasEquipment || hasNotes) && (
                            <div className="flex flex-col gap-5 mb-6">
                                {hasEquipment && (
                                    <div>
                                        <p className="text-[13px] font-bold text-[#0f172a] mb-3 pb-1.5 border-b-2 border-[#15803d] inline-block">
                                            Equipment Needed
                                        </p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {booking.equipment_requests.map((er) => (
                                                <span key={er.id} className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#14532d] bg-[#dcfce7] px-3.5 py-1.5 rounded-xl">
                                                    <IconBox className="w-3.5 h-3.5" />
                                                    {er.equipment_name}
                                                    {er.quantity > 1 && <span className="text-[#4a6b58] font-medium">× {er.quantity}</span>}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {hasNotes && (
                                    <div>
                                        <p className="text-[13px] font-bold text-[#0f172a] mb-3 pb-1.5 border-b-2 border-[#f59e0b] inline-block">
                                            Notes from Requester
                                        </p>
                                        <div className="mt-2 bg-[#fffbeb] rounded-xl px-4 py-3.5">
                                            <p className="text-[14.5px] text-[#374151] leading-relaxed">
                                                {booking.user_notes}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end gap-2.5 pt-5 border-t border-[#e8f5ee]">
                            <button
                                onClick={(e) => { e.stopPropagation(); onReject(booking); }}
                                disabled={isActing}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#e2e8f0] text-[14.5px] font-medium text-[#374151] bg-white hover:bg-[#fef2f2] hover:text-[#dc2626] hover:border-[#fca5a5] transition-all duration-150 disabled:opacity-40"
                            >
                                <IconX /> Reject
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onApprove(booking); }}
                                disabled={isActing}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d] text-white text-[14.5px] font-semibold hover:bg-[#166534] transition-all duration-150 disabled:opacity-40"
                            >
                                {isActing ? 'Processing…' : <><IconCheck /> Approve</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
                            : 'Could not load bookings. Please check your connection.'
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
            alert(err.response?.data?.error || 'Could not approve. Please try again.');
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
            alert(err.response?.data?.error || 'Could not reject. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const todayCount = pendingBookings.filter((b) => {
        if (!b.start_datetime) return false;
        const d = new Date(b.start_datetime), now = new Date();
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const totalPeople = pendingBookings.reduce((s, b) => s + (b.attendee_count || 0), 0);

    return (
        <div
            className="min-h-full bg-[#f6fbf8] p-6 md:p-8"
            style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
        >
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Modals */}
            {rejectTarget  && <RejectModal  booking={rejectTarget}  onConfirm={handleRejectConfirm} onCancel={() => setRejectTarget(null)}  isLoading={actionLoading === rejectTarget.id} />}
            {successTarget && <SuccessModal booking={successTarget} onClose={() => setSuccessTarget(null)} />}

            <div className="max-w-[1100px] mx-auto">

                {/* Page header */}
                <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
                    <div>
                        <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#6b7280] mb-1.5">
                            Rajagiri College · Admin
                        </p>
                        <h1 className="text-[26px] font-bold text-[#0f172a] tracking-tight leading-none">
                            Space Approval
                        </h1>
                        <p className="text-[15px] text-[#374151] mt-2">
                            {error
                                ? 'Something went wrong loading requests'
                                : pendingBookings.length === 0
                                    ? 'No pending requests right now'
                                    : `${pendingBookings.length} booking${pendingBookings.length !== 1 ? 's' : ''} waiting for your review`}
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#d1fae5] bg-white text-[14px] text-[#4a6b58] hover:bg-[#f0fdf4] transition-all duration-150 disabled:opacity-40"
                    >
                        <IconRefresh spinning={isLoading} />
                        Refresh
                    </button>
                </div>

                {/* Stat strip */}
                <div className="grid grid-cols-3 gap-3 mb-7">
                    {[
                        { value: pendingBookings.length, label: 'Waiting for review' },
                        { value: todayCount,             label: 'Happening today' },
                        { value: totalPeople,            label: 'Total people attending' },
                    ].map(({ value, label }) => (
                        <div key={label} className="bg-white border border-[#e8f5ee] rounded-2xl px-6 py-5">
                            <p className="text-[32px] font-light text-[#0f172a] tracking-tight leading-none">{value}</p>
                            <p className="text-[14px] font-medium text-[#374151] mt-2">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Queue panel */}
                <div className="adc-panel">
                    <div className="adc-phead">
                        <span className="adc-phead-l">Pending approvals · All Modules</span>
                <div className="bg-white border border-[#e8f5ee] rounded-2xl overflow-hidden shadow-sm">

                    {/* Panel header */}
                    <div className="flex items-center px-7 py-4 border-b border-[#e8f5ee] bg-white relative z-10">
                        <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#374151]">
                            Pending bookings
                        </span>
                    </div>

                    {/* States */}
                    {error ? (
                        <div className="py-20 text-center px-8">
                            <div className="w-12 h-12 rounded-full bg-[#fef2f2] flex items-center justify-center mx-auto mb-4 text-[#dc2626]">
                                <IconAlert />
                            </div>
                            <p className="text-[15px] font-semibold text-[#0f172a]">Could not load bookings</p>
                            <p className="text-[13.5px] text-[#a8c4b4] mt-1.5">Sign out and back in, then try again.</p>
                        </div>
                    ) : isLoading && pendingBookings.length === 0 ? (
                        <div className="py-20 text-center">
                            <p className="text-[14px] text-[#a8c4b4]">Loading bookings…</p>
                        </div>
                    ) : pendingBookings.length === 0 ? (
                        <div className="py-20 text-center px-8">
                            <div className="w-12 h-12 rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-4 text-[#15803d]">
                                <IconCheck className="w-6 h-6" />
                            </div>
                            <p className="text-[15px] font-semibold text-[#0f172a]">All caught up!</p>
                            <p className="text-[13.5px] text-[#a8c4b4] mt-1.5">No bookings are waiting for review.</p>
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