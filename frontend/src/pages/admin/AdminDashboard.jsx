import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Mail } from 'lucide-react';
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

const IconLightning = ({ className = 'w-3 h-3' }) => (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
);

// ─── Modals ───────────────────────────────────────────────────────────────────

const ApproveModal = ({ booking, onConfirm, onCancel, isLoading }) => {
    if (!booking) return null;
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={onCancel}>
            <div className="bg-white rounded-2xl border border-[#e8f5ee] shadow-2xl shadow-black/10 p-7 w-full max-w-[400px]"
                onClick={(e) => e.stopPropagation()}
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
                <div className="w-14 h-14 rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-5">
                    <IconCheck className="w-6 h-6 text-[#15803d]" />
                </div>
                <p className="text-[18px] font-bold text-[#0f172a] text-center tracking-tight">Approve Booking?</p>
                <p className="text-[14.5px] text-[#4b5563] mt-2 text-center leading-relaxed">
                    Are you sure you want to approve this booking for <span className="font-semibold text-[#0f172a]">{booking.requester || booking.user_name || 'this user'}</span>?
                </p>

                <div className="flex gap-2 justify-center mt-6">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-6 py-2.5 rounded-xl border border-[#e2e8f0] text-[14.5px] font-medium text-[#4b5563] hover:bg-[#f6fbf8] transition disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm()}
                        disabled={isLoading}
                        className="px-6 py-2.5 rounded-xl bg-[#15803d] text-white text-[14.5px] font-semibold hover:bg-[#166534] transition disabled:opacity-40 flex items-center gap-2"
                    >
                        {isLoading ? 'Approving...' : 'Yes, Approve'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const RejectModal = ({ booking, onConfirm, onCancel, isLoading }) => {
    const [remarks, setRemarks] = useState('');
    
    const isCancellation = booking?.status === 'APPROVED';
    const title = isCancellation ? 'Cancel Approved Booking?' : 'Reject Request?';
    const buttonText = isCancellation ? 'Revoke & Cancel' : 'Reject Booking';

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl border border-[#e8f5ee] shadow-2xl shadow-black/10 p-7 w-full max-w-[440px]"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
                <p className="text-[17px] font-semibold text-[#0f172a] tracking-tight">{title}</p>
                <p className="text-[14px] text-[#6b6b6b] mt-1 pb-4 border-b border-[#e8f5ee]">
                    <span className="font-medium text-[#0f172a]">{booking.reference_code}</span>
                    {' '}· {booking.resource_name}
                </p>

                <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#a8c4b4] mt-4 mb-2">
                    Reason <span className="text-[#dc2626]">*</span>
                </p>
                <textarea
                    className="w-full border border-[#e2e8f0] rounded-xl px-4 py-3 text-[14px] text-[#0f172a] bg-white resize-none outline-none min-h-[96px] transition-all focus:border-[#15803d] focus:ring-2 focus:ring-[#dcfce7]"
                    placeholder="e.g. Space unexpectedly needed for exams..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    autoFocus
                    style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
                />
                <p className="text-[12px] text-[#a8c4b4] mt-1.5">A notification and this reason will be sent to the user.</p>

                <div className="flex gap-2 justify-end mt-5">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-5 py-2.5 rounded-xl border border-[#e2e8f0] text-[14px] text-[#6b6b6b] hover:bg-[#f6fbf8] transition disabled:opacity-40"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => onConfirm(remarks)}
                        disabled={isLoading || !remarks.trim()}
                        className="px-5 py-2.5 rounded-xl bg-[#dc2626] text-white text-[14px] font-semibold hover:opacity-85 transition disabled:opacity-40 flex items-center gap-2"
                    >
                        {isLoading ? 'Processing…' : buttonText}
                    </button>
                </div>
            </div>
        </div>
    );
};

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

const BookingRow = ({ booking, onApproveClick, onRejectClick, isActing, isPendingTab }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasEquipment = booking.equipment_requests?.length > 0;
    const hasNotes     = booking.user_notes?.trim().length > 0;
    const isExternal   = booking.is_external;

    const capacity  = booking.space_details?.capacity_hard;
    const attendees = booking.attendee_count;
    const isUnderutilized = capacity && attendees && (attendees / capacity < 0.30);

    const isExpired = new Date(booking.end_datetime) < new Date();

    return (
        <div className={`px-7 border-b border-[#e8f5ee] last:border-0 transition-colors duration-150 ${isExpanded ? 'bg-[#f6fbf8]' : 'hover:bg-[#f6fbf8]'} ${isExternal && !isExpanded ? 'bg-[#fffdf8]' : ''}`}>

            {/* CLICKABLE QUICK-GLANCE HEADER */}
            <div
                className="py-6 cursor-pointer"
                onClick={() => {
                    if (window.getSelection().toString().length > 0) return;
                    setIsExpanded(!isExpanded);
                }}
            >
                {/* Top strip */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-[13.5px] font-semibold text-[#14532d] bg-[#f0fdf4] px-3 py-1 rounded-lg border border-[#d1fae5] tracking-wide">
                            {booking.reference_code}
                        </span>
                        {isExternal && (
                            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#d97706] bg-[#fef3c7] px-2 py-0.5 rounded-md border border-[#fde68a]">
                                <IconLightning className="w-3 h-3" /> Priority Event
                            </span>
                        )}
                        {attendees > 0 && (
                            <span className="flex items-center gap-1.5 text-[14px] text-[#374151] font-medium ml-1">
                                <IconUsers className={`w-4 h-4 ${isUnderutilized ? 'text-[#ea580c]' : 'text-[#15803d]'}`} />
                                {attendees} {attendees === 1 ? 'person' : 'people'}
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

                {/* 3-col info grid */}
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
                                <p className="text-[13px] text-[#6b7280] mt-0.5 capitalize">{booking.space_details?.space_type?.replace('_', ' ') || 'Workspace'}</p>
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
                            <div className="flex-1 min-w-0 space-y-1.5">
                                <p className="text-[17px] font-bold text-gray-900 leading-tight">{booking.requester}</p>
                                <p className="text-[14.5px] font-semibold text-green-700">
                                    {booking.department_name || booking.department || 'General Member'}
                                </p>
                                {booking.requester_email && (
                                    <p className="flex items-center gap-2 truncate text-[15px] font-medium text-gray-800">
                                       <Mail className="h-4 w-4 shrink-0 text-green-700" /> {booking.requester_email}
                                    </p>
                                )}
                                {booking.requester_phone && (
                                    <p className="flex items-center gap-2 truncate text-[15px] font-medium text-gray-800 mt-0.5">
                                       <Phone className="h-4 w-4 shrink-0 text-green-700" /> {booking.requester_phone}
                                    </p>
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

                        {/* UNDERUTILIZATION WARNING */}
                        {isUnderutilized && (
                            <div className="mb-6 bg-[#fff7ed] border border-[#fed7aa] rounded-xl px-4 py-3.5 flex items-start gap-3">
                                <IconAlert className="text-[#ea580c] shrink-0 w-5 h-5 mt-0.5" />
                                <div>
                                    <p className="text-[13.5px] font-bold text-[#9a3412] uppercase tracking-wide">
                                        Capacity Warning ({attendees} / {capacity} seats)
                                    </p>
                                    <p className="text-[14px] text-[#c2410c] mt-1 leading-relaxed">
                                        This booking utilizes less than 30% of the hall's capacity. Please read the requester's notes carefully for justification before approving.
                                    </p>
                                </div>
                            </div>
                        )}

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
                                <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2">Rejection / Cancellation Reason</p>
                                <p className="text-[14.5px] font-semibold leading-relaxed text-red-700">
                                    {booking.remarks_by_admin}
                                </p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2.5 pt-5 border-t border-[#e8f5ee]">
                            {isPendingTab ? (
                                <>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRejectClick(booking); }}
                                        disabled={isActing}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#e2e8f0] text-[14.5px] font-medium text-[#374151] bg-white hover:bg-[#fef2f2] hover:text-[#dc2626] hover:border-[#fca5a5] transition-all duration-150 disabled:opacity-40"
                                    >
                                        <IconX /> Reject
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onApproveClick(booking); }}
                                        disabled={isActing}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d] text-white text-[14.5px] font-semibold hover:bg-[#166534] transition-all duration-150 disabled:opacity-40"
                                    >
                                        {isActing ? 'Processing…' : <><IconCheck /> Approve</>}
                                    </button>
                                </>
                            ) : isExpired ? (
                                <span className="text-[13px] font-bold text-gray-500 uppercase tracking-wider px-5 py-2 bg-gray-100 rounded-xl">Event Completed</span>
                            ) : booking.status === 'APPROVED' ? (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRejectClick(booking); }}
                                    disabled={isActing}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-[14.5px] font-medium text-red-700 bg-red-50 hover:bg-red-100 hover:border-red-300 transition-all duration-150 disabled:opacity-40"
                                >
                                    <IconX /> Revoke & Cancel Booking
                                </button>
                            ) : booking.status === 'REJECTED' ? (
                                <span className="text-[13px] font-bold text-red-500 uppercase tracking-wider px-5 py-2 bg-red-50 rounded-xl">Rejected / Cancelled</span>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const PAGE_DOMAIN = 'spaces';

const AdminDashboard = () => {
    const { can_manage_system, can_manage_mess, user } = useAuth();
    const navigate = useNavigate();
    const can_manage_media = user?.capabilities?.can_manage_media;

    const [activeTab,       setActiveTab]       = useState('pending');
    const [data,            setData]            = useState({ pending: [], history: [], resolved: [] });
    const [isLoading,       setIsLoading]       = useState(true);
    const [actionLoading,   setActionLoading]   = useState(null);
    const [error,           setError]           = useState(null);
    const [rejectTarget,    setRejectTarget]    = useState(null);
    const [approveTarget,   setApproveTarget]   = useState(null);
    const [successTarget,   setSuccessTarget]   = useState(null);

    const fetchQueue = useCallback(async ({ showLoading = true } = {}) => {
        if (showLoading) setIsLoading(true);
        try {
            const [pendingData, approvedData, rejectedData] = await Promise.all([
                approvalService.getApprovals({ domain: PAGE_DOMAIN, status: 'PENDING' }).catch(() => ({ queue: [] })),
                approvalService.getApprovals({ domain: PAGE_DOMAIN, status: 'APPROVED' }).catch(() => ({ queue: [] })),
                approvalService.getApprovals({ domain: PAGE_DOMAIN, status: 'REJECTED' }).catch(() => ({ queue: [] }))
            ]);
            
            const historyList = [...(approvedData.queue || []), ...(rejectedData.queue || [])]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setData({
                pending: pendingData.queue || [],
                history: historyList,
                resolved: historyList // Placeholder logic if 'resolved_by' filtering isn't supported yet
            });
            setError(null);
        } catch (err) {
            console.error('Fetch error:', err);
            setError('Could not load bookings. Please check your connection.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (can_manage_mess && !can_manage_system) {
            navigate('/admin/mess', { replace: true });
            return;
        }

        if (can_manage_media && !can_manage_system) {
            navigate('/admin/media', { replace: true });
            return;
        }

        const loadInitial = async () => {
            await fetchQueue({ showLoading: false });
        };
        loadInitial();
    }, [can_manage_system, can_manage_mess, can_manage_media, navigate, fetchQueue]);

    const handleApproveConfirm = async () => {
        if (!approveTarget) return;
        const booking = approveTarget;
        setActionLoading(booking.id);
        try {
            await approvalService.resolveBooking({ module: booking.domain, id: booking.id, status: 'APPROVED', remarks: '' });
            setSuccessTarget(booking);
            setApproveTarget(null);
            await fetchQueue({ showLoading: false });
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
            setRejectTarget(null);
            await fetchQueue({ showLoading: false });
        } catch (err) {
            console.error('Reject error:', err);
            alert(err.response?.data?.error || 'Could not reject. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const listToRender = data[activeTab] || [];
    const priorityBookings = listToRender.filter(b => b.is_external);
    const standardBookings = listToRender.filter(b => !b.is_external);

    const todayCount = data.history.filter((b) => {
        if (!b.start_datetime || b.status === 'REJECTED') return false;
        const d = new Date(b.start_datetime), now = new Date();
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const totalPeople = data.history.reduce((s, b) => b.status === 'APPROVED' ? s + (b.attendee_count || 0) : s, 0) + 
                        data.pending.reduce((s, b) => s + (b.attendee_count || 0), 0);

    const tabs = [
        { id: 'pending',  label: 'Pending Requests', count: data.pending.length },
        { id: 'history',  label: 'History',          count: data.history.length },
        { id: 'resolved', label: 'Resolved by Me',   count: data.resolved.length },
    ];

    return (
        <div
            className="min-h-full bg-[#f6fbf8] p-6 md:p-8"
            style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
        >
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Modals */}
            {approveTarget && <ApproveModal booking={approveTarget} onConfirm={handleApproveConfirm} onCancel={() => setApproveTarget(null)} isLoading={actionLoading === approveTarget.id} />}
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
                            Review new requests and manage active reservations.
                        </p>
                    </div>
                    <button
                        onClick={() => fetchQueue()}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#d1fae5] bg-white text-[14px] font-semibold text-[#4a6b58] hover:bg-[#f0fdf4] transition-all duration-150 disabled:opacity-40"
                    >
                        <IconRefresh spinning={isLoading} />
                        Refresh
                    </button>
                </div>

                {/* Stat strip */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                        { value: data.pending.length, label: 'Waiting for review' },
                        { value: todayCount,          label: 'Happening today' },
                        { value: totalPeople,         label: 'Total people attending' },
                    ].map(({ value, label }) => (
                        <div key={label} className="bg-white border border-[#e8f5ee] rounded-2xl px-6 py-5">
                            <p className="text-[32px] font-light text-[#0f172a] tracking-tight leading-none">{value}</p>
                            <p className="text-[14px] font-medium text-[#374151] mt-2">{label}</p>
                        </div>
                    ))}
                </div>

                {/* TABS */}
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

                {/* Queue panel */}
                <div className="bg-white border border-[#e8f5ee] rounded-2xl overflow-hidden shadow-sm">

                    {error ? (
                        <div className="py-20 text-center px-8">
                            <div className="w-12 h-12 rounded-full bg-[#fef2f2] flex items-center justify-center mx-auto mb-4 text-[#dc2626]">
                                <IconAlert />
                            </div>
                            <p className="text-[15px] font-semibold text-[#0f172a]">Could not load bookings</p>
                            <p className="text-[13.5px] text-[#a8c4b4] mt-1.5">Sign out and back in, then try again.</p>
                        </div>
                    ) : isLoading && listToRender.length === 0 ? (
                        <div className="py-20 text-center">
                            <p className="text-[14px] text-[#a8c4b4]">Loading bookings…</p>
                        </div>
                    ) : listToRender.length === 0 ? (
                        <div className="py-20 text-center px-8">
                            <div className="w-12 h-12 rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-4 text-[#15803d]">
                                <IconCheck className="w-6 h-6" />
                            </div>
                            <p className="text-[15px] font-semibold text-[#0f172a]">All caught up!</p>
                            <p className="text-[13.5px] text-[#a8c4b4] mt-1.5">There are no {activeTab} bookings right now.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {/* PRIORITY QUEUE */}
                            {priorityBookings.length > 0 && (
                                <div className="border-b border-[#e8f5ee]">
                                    <div className="flex items-center px-7 py-3 bg-[#fffbeb] border-b border-[#fde68a]">
                                        <span className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#d97706]">
                                            <IconLightning /> Priority Events (External)
                                        </span>
                                    </div>
                                    {priorityBookings.map((booking) => (
                                        <BookingRow
                                            key={`${booking.domain}-${booking.id}`}
                                            booking={booking}
                                            isPendingTab={activeTab === 'pending'}
                                            onApproveClick={setApproveTarget}
                                            onRejectClick={setRejectTarget}
                                            isActing={actionLoading === booking.id}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* STANDARD QUEUE */}
                            {standardBookings.length > 0 && (
                                <div>
                                    {priorityBookings.length > 0 && (
                                        <div className="flex items-center px-7 py-3 bg-[#f8fafc] border-b border-[#e2e8f0]">
                                            <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
                                                Standard Events (Internal)
                                            </span>
                                        </div>
                                    )}
                                    {standardBookings.map((booking) => (
                                        <BookingRow
                                            key={`${booking.domain}-${booking.id}`}
                                            booking={booking}
                                            isPendingTab={activeTab === 'pending'}
                                            onApproveClick={setApproveTarget}
                                            onRejectClick={setRejectTarget}
                                            isActing={actionLoading === booking.id}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;