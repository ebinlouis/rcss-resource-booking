import Tooltip from '../../components/Tooltip'
import PageInfo from '../../components/PageInfo'
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, Mail } from 'lucide-react';
import approvalService from '../../api/approvalService';
import notificationService from '../../api/notificationService';
import { useAuth } from '../../hooks/useAuth';
import { compareSubmissionTimeDesc, getSubmissionTimestamp } from '../../utils/submissionTime';
import api from '../../api/axios';
import { useApprovals, useResolveApproval } from '../../hooks/useApprovalQueries';
import { useSpaceCatalog } from '../../hooks/useSpaceQueries';

// ─── Utilities ────────────────────────────────────────────────────────────────

// ─── Calendar date helpers (mirrors Media.jsx pattern) ───────────────────────

const todayDateKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const dateKeyFromDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const addCalDays = (dateString, days) => {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + days);
    return dateKeyFromDate(date);
};

const getCalWeekStart = (dateString) => {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() - date.getDay()); // rewind to Sunday
    return dateKeyFromDate(date);
};

const formatCalDate = (dateString, options = {}) => {
    if (!dateString) return '';
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('en-IN', options);
};

// Check whether a booking overlaps a given YYYY-MM-DD date string
const bookingOverlapsDate = (booking, dateKey) => {
    // Try every date field the booking might carry
    const candidates = [
        booking.start_datetime,
        booking.end_datetime,
        booking.event_date,
        booking.reservation_date,
    ].filter(Boolean);

    if (candidates.length === 0) return true; // no date info → always show

    const target = new Date(`${dateKey}T00:00:00`);
    const targetEnd = new Date(`${dateKey}T23:59:59`);

    // A booking overlaps if start <= targetEnd AND end >= target
    const start = booking.start_datetime ? new Date(booking.start_datetime) : null;
    const end = booking.end_datetime ? new Date(booking.end_datetime) : null;

    if (start && end) {
        return start <= targetEnd && end >= target;
    }
    if (start) return dateKeyFromDate(start) === dateKey;
    return false;
};


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

const isToday = (isoString) => {
    if (!isoString) return false;
    const d = new Date(isoString);
    const now = new Date();
    return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
    );
};

/**
 * Collapses recurring booking siblings into one UI card.
 *
 * The backend now always sends `group_id` (a UUID string) for every space
 * booking. Recurring slots share the same group_id; single bookings each
 * have their own unique group_id. Using it directly as the map key is both
 * correct and O(n) — no fragile composite-key heuristics needed.
 *
 * The "parent" card holds:
 *   - child_bookings: all sibling rows (used to pick the representative ID
 *     for the approval call and to show the recurring-day count badge)
 *   - start_datetime: the earliest slot's start (for display)
 *   - end_datetime:   the latest slot's end     (for display)
 *   - all other fields from the first sibling in the group
 */
const groupBookings = (list) => {
    if (!list) return [];
    const map = new Map();

    list.forEach(b => {
        const key = b.group_id || `${b.domain || 'spaces'}-${b.id}`;

        if (!map.has(key)) {
            map.set(key, { ...b, child_bookings: [b] });
        } else {
            const parent = map.get(key);
            parent.child_bookings.push(b);

            // Keep the card's time range spanning the full recurring window
            if (new Date(b.end_datetime) > new Date(parent.end_datetime)) {
                parent.end_datetime = b.end_datetime;
            }
            if (new Date(b.start_datetime) < new Date(parent.start_datetime)) {
                parent.start_datetime = b.start_datetime;
            }
            if (b.updated_at && (!parent.updated_at || new Date(b.updated_at) > new Date(parent.updated_at))) {
                parent.updated_at = b.updated_at;
            }
        }
    });

    return Array.from(map.values());
};

const bookingRowKey = (booking) => (
    `${booking.domain || 'spaces'}-${booking.group_id || booking.id}-${booking.status || 'UNKNOWN'}`
);

const normaliseReference = (value) => String(value || '').trim().toUpperCase();

const bookingMatchesReference = (booking, reference) => {
    const target = normaliseReference(reference);
    if (!target) return false;
    if (normaliseReference(booking.reference_code) === target) return true;
    return (booking.child_bookings ?? []).some(
        (child) => normaliseReference(child.reference_code) === target
    );
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconBuilding = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 8h.01M15 8h.01M9 13h.01M15 13h.01" />
    </svg>
);

const IconCheck = ({ className = 'w-[18px] h-[18px]' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M5 13l4 4L19 7" />
    </svg>
);

const IconX = ({ className = 'w-[18px] h-[18px]' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

const IconRefresh = ({ spinning, className = 'w-[18px] h-[18px]' }) => (
    <svg
        className={className}
        style={spinning ? { animation: 'spin 0.7s linear infinite' } : {}}
        viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"
    >
        <path d="M1 4v6h6M23 20v-6h-6" />
        <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" />
    </svg>
);

const IconUsers = ({ className = 'w-[15px] h-[15px]' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
);

const IconAlert = ({ className = 'w-6 h-6' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

const IconBox = ({ className = 'w-3 h-3' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
);

const IconChevron = ({ className = 'w-4 h-4', expanded }) => (
    <svg
        className={`${className} transition-transform duration-300 ease-in-out ${expanded ? 'rotate-180' : ''}`}
        viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"
    >
        <path d="M6 9l6 6 6-6" />
    </svg>
);

const IconLightning = ({ className = 'w-3 h-3' }) => (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
);

const IconCalendar = ({ className = 'w-4 h-4' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

// ─── Filter Pills ─────────────────────────────────────────────────────────────

function FilterPills({ label, options, value, onChange }) {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280]">
                {label}
            </span>
            <div className="flex gap-1 flex-wrap">
                {options.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`px-3 py-1 rounded-lg text-[12.5px] font-semibold transition-all ${value === opt.value
                                ? 'bg-[#15803d] text-white shadow-sm'
                                : 'bg-white border border-[#e2e8f0] text-[#4b5563] hover:border-[#a7f3d0] hover:bg-[#f0fdf4]'
                            }`}
                    >
                        {opt.label}
                        {opt.count !== undefined && (
                            <span className={`ml-1.5 text-[11px] ${value === opt.value ? 'text-white/70' : 'text-[#9ca3af]'}`}>
                                {opt.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

const ApproveModal = ({ booking, onConfirm, onCancel, isLoading, errorMsg }) => {
    if (!booking) return null;
    const dayCount = booking.child_bookings?.length ?? 1;
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={onCancel}>
            <div
                className="bg-white rounded-2xl border border-[#e8f5ee] shadow-2xl shadow-black/10 p-7 w-full max-w-[400px]"
                onClick={(e) => e.stopPropagation()}
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
            >
                <div className="w-14 h-14 rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-5">
                    <IconCheck className="w-6 h-6 text-[#15803d]" />
                </div>
                <p className="text-[18px] font-bold text-[#0f172a] text-center tracking-tight">Approve Booking?</p>
<p className="text-[14.5px] text-[#4b5563] mt-2 text-center leading-relaxed">
    {dayCount > 1
        ? <>Approve all <span className="font-semibold text-[#0f172a]">{dayCount} booking dates</span> for <span className="font-semibold text-[#0f172a]">{booking.requester || booking.user_name || 'this user'}</span>?</>
        : <>Approve this booking for <span className="font-semibold text-[#0f172a]">{booking.requester || booking.user_name || 'this user'}</span>?</>
    }
</p>

                {errorMsg && (
                    <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-[13.5px] text-red-700 font-medium text-center">{errorMsg}</p>
                    </div>
                )}

                <div className="flex gap-2 justify-center mt-6">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-6 py-2.5 rounded-xl border border-[#e2e8f0] text-[14.5px] font-medium text-[#4b5563] hover:bg-[#f6fbf8] transition disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <Tooltip text="Confirm approval. The venue will be reserved and the requester notified." position="top">
                        <button
                            onClick={() => onConfirm()}
                            disabled={isLoading}
                            className="px-6 py-2.5 rounded-xl bg-[#15803d] text-white text-[14.5px] font-semibold hover:bg-[#166534] transition disabled:opacity-40 flex items-center gap-2"
                        >
                            {isLoading ? 'Approving...' : 'Yes, Approve'}
                        </button>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
};

const RejectModal = ({ booking, onConfirm, onCancel, isLoading, errorMsg }) => {
    const [remarks, setRemarks] = useState('');

    const isCancellation = booking?.status === 'APPROVED';
    const title = isCancellation ? 'Cancel Approved Booking?' : 'Reject Request?';
    const buttonText = isCancellation ? 'Cancel' : 'Reject Booking';

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div
                className="bg-white rounded-2xl border border-[#e8f5ee] shadow-2xl shadow-black/10 p-7 w-full max-w-[440px]"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
            >
                <p className="text-[17px] font-semibold text-[#0f172a] tracking-tight">{title}</p>
                <p className="text-[14px] text-[#6b6b6b] mt-1 pb-4 border-b border-[#e8f5ee]">
                    <span className="font-medium text-[#0f172a]">{booking.reference_code}</span>
                    {' '}· {booking.resource_name}
                    {booking.child_bookings?.length > 1 && (
                        <span className="ml-2 text-[12px] font-bold text-[#4f46e5] bg-[#eff6ff] px-2 py-0.5 rounded-md">
                            {booking.child_bookings.length} slots
                        </span>
                    )}
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
                <p className="text-[12px] text-[#a8c4b4] mt-1.5">
                    A notification and this reason will be sent to the user.
                </p>

                {errorMsg && (
                    <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-[13.5px] text-red-700 font-medium">{errorMsg}</p>
                    </div>
                )}

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
            <div
                className="bg-white rounded-2xl border border-[#e8f5ee] shadow-2xl shadow-black/10 p-8 w-full max-w-[360px] text-center"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
            >
                <div className="w-14 h-14 rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-5">
                    <IconCheck className="w-6 h-6 text-[#15803d]" />
                </div>
                <p className="text-[17px] font-semibold text-[#0f172a] tracking-tight">Booking action successful!</p>
                <p className="text-[14px] text-[#6b6b6b] mt-2 leading-relaxed">
                    <span className="font-medium text-[#0f172a]">{booking.resource_name}</span> has been processed for{' '}
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

const BookingRow = ({ booking, onApproveClick, onRejectClick, isActing, isPendingTab, isHighlighted }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (!isHighlighted) return undefined;
        const timer = window.setTimeout(() => setIsExpanded(true), 0);
        return () => window.clearTimeout(timer);
    }, [isHighlighted]);

    const hasEquipment = booking.equipment_requests?.length > 0;
    const hasNotes = booking.user_notes?.trim().length > 0;
    const isExternal = booking.is_external;
    const capacity = booking.space_details?.capacity_hard;
    const attendees = booking.attendee_count;
    const isUnderutilized = capacity && attendees && (attendees / capacity < 0.30);
    const isExpired = new Date(booking.end_datetime) < new Date();

    const startDate = booking.start_datetime ? new Date(booking.start_datetime) : null;
    const endDate = booking.end_datetime ? new Date(booking.end_datetime) : null;
    const isMultiDay = startDate && endDate && startDate.toDateString() !== endDate.toDateString();

    // A group is "recurring" when there are multiple distinct DB rows sharing
    // the same group_id. A single continuous multi-day booking is one row and
    // will never have child_bookings.length > 1.
    const isRecurring = (booking.child_bookings?.length ?? 1) > 1;

    return (
        <div
            data-booking-reference={booking.reference_code || ''}
            className={`px-7 border-b border-[#e8f5ee] last:border-0 transition-colors duration-150 ${isExpanded ? 'bg-[#f6fbf8]' : 'hover:bg-[#f6fbf8]'} ${isExternal && !isExpanded ? 'bg-[#fffdf8]' : ''} ${isHighlighted ? 'ring-2 ring-[#22c55e] ring-inset bg-[#f0fdf4]' : ''}`}
        >

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
                        {booking.is_student_booking && (
                            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                                Student Booking
                            </span>
                        )}
                        {isRecurring ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#4f46e5] bg-[#eff6ff] px-2 py-0.5 rounded-md border border-[#c7d2fe]">
                                <IconCalendar className="w-3 h-3" /> Multi-Day Event ({booking.child_bookings.length} Days)
                            </span>
                        ) : isMultiDay ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#0369a1] bg-[#e0f2fe] px-2 py-0.5 rounded-md border border-[#bae6fd]">
                                <IconCalendar className="w-3 h-3" /> Continuous Multi-Day Event
                            </span>
                        ) : null}
                        {attendees > 0 && (
                            <span className="flex items-center gap-1.5 text-[14px] text-[#374151] font-medium ml-1">
                                <IconUsers className={`w-4 h-4 ${isUnderutilized ? 'text-[#ea580c]' : 'text-[#15803d]'}`} />
                                {attendees} {attendees === 1 ? 'person' : 'people'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[13px] text-[#6b7280] font-medium">Submitted {timeAgo(getSubmissionTimestamp(booking))}</span>
                        <div className="w-8 h-8 rounded-full hover:bg-[#e8f5ee] flex items-center justify-center transition-colors">
                            <IconChevron expanded={isExpanded} className="w-5 h-5 text-[#94a3b8]" />
                        </div>
                    </div>
                </div>

                {/* 3-col info grid */}
                <div className="grid gap-7 grid-cols-1 md:grid-cols-3">
                    {/* Venue */}
                    <div>
                        <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2.5">Venue</p>
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#f0fdf4] border border-[#d1fae5] flex items-center justify-center shrink-0 text-[#15803d]">
                                <IconBuilding className="w-[20px] h-[20px]" />
                            </div>
                            <div>
                                <p className="text-[16px] font-semibold text-[#0f172a] leading-tight">{booking.resource_name || booking.space_details?.name || 'Space'}</p>
                                <p className="text-[13px] text-[#6b7280] mt-0.5 capitalize">{booking.space_details?.space_type?.replace('_', ' ') || 'Workspace'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Schedule */}
                    <div>
                        <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2.5">
                            {isRecurring ? 'SBooking Dates' : 'When'}
                        </p>
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
                                <p className="text-[17px] font-bold text-gray-900 leading-tight">{booking.requester || booking.user_name}</p>
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

            {/* EXPANDED CONTENT */}
            {isExpanded && (
                <div className="pb-6 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="pt-6 border-t border-[#e8f5ee]">

                        {isUnderutilized && (
                            <div className="mb-6 bg-[#fff7ed] border border-[#fed7aa] rounded-xl px-4 py-3.5 flex items-start gap-3">
                                <IconAlert className="text-[#ea580c] shrink-0 w-5 h-5 mt-0.5" />
                                <div>
                                    <p className="text-[13.5px] font-bold text-[#9a3412] uppercase tracking-wide">
                                        Large Venue for Small Group ({attendees} / {capacity} seats)
                                    </p>
                                    <p className="text-[14px] text-[#c2410c] mt-1 leading-relaxed">
                                        The number of attendees is low compared to the venue capacity. Please review the reason provided before approving.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Recurring slot breakdown */}
                        {isRecurring && (
                            <div className="mb-6">
                                <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2">Event Dates</p>
                                <div className="flex flex-wrap gap-2">
                                    {booking.child_bookings.map((child, i) => (
                                        <span key={`${child.domain || 'spaces'}-${child.id}-${i}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#4f46e5] bg-[#eff6ff] border border-[#c7d2fe] px-3 py-1.5 rounded-lg">
                                            <IconCalendar className="w-3.5 h-3.5" />
                                            Day {i + 1} · {formatDateTime(child.start_datetime)} – {formatDateTime(child.end_datetime)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {booking.is_student_booking && (
                            <div className="mb-6">
                                <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2">Faculty In Charge</p>
                                <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3.5 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[14px]">
                                        {booking.faculty_sponsor_name?.charAt(0).toUpperCase() || 'F'}
                                    </div>
                                    <p className="text-[14.5px] text-purple-900 leading-relaxed font-medium">
                                        Faculty In Charge: {booking.faculty_sponsor_name || 'Unknown'}
                                        {['PENDING', 'FACULTY_ESCALATED', 'APPROVED'].includes(booking.status) ? ' (Approved)' : ''}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="mb-6">
                            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2">Event Purpose</p>
                            <div className="bg-[#f0fdf4] border border-[#d1fae5] rounded-xl px-4 py-3.5">
                                <p className="text-[14.5px] text-[#14532d] font-medium leading-relaxed">
                                    {booking.purpose_of_booking || booking.purpose || 'No purpose provided.'}
                                </p>
                            </div>
                        </div>

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
                                            <p className="text-[14.5px] text-[#374151] leading-relaxed">{booking.user_notes}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {['REJECTED', 'CANCELLED'].includes(booking.status) && booking.remarks_by_admin && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 mb-6">
                                <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280] mb-2">Rejection Reason</p>
                                <p className="text-[14.5px] font-semibold leading-relaxed text-red-700">
                                    {booking.remarks_by_admin}
                                </p>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2.5 pt-5 border-t border-[#e8f5ee]">
                            {isPendingTab ? (
                                <>
                                    <Tooltip text="Reject this request. You'll be asked to provide a reason which will be shared with the requester." position="top">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onRejectClick(booking); }}
                                            disabled={isActing}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#e2e8f0] text-[14.5px] font-medium text-[#374151] bg-white hover:bg-[#fef2f2] hover:text-[#dc2626] hover:border-[#fca5a5] transition-all duration-150 disabled:opacity-40"
                                        >
                                            <IconX /> Reject
                                        </button>
                                    </Tooltip>
                                    <Tooltip text="Approve this booking request. The requester will be notified and the venue will be reserved." position="top">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onApproveClick(booking); }}
                                            disabled={isActing}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d] text-white text-[14.5px] font-semibold hover:bg-[#166534] transition-all duration-150 disabled:opacity-40"
                                        >
                                            {isActing ? 'Processing…' : <><IconCheck /> Approve</>}
                                        </button>
                                    </Tooltip>
                                </>
                            ) : isExpired ? (
                                <span className="text-[13px] font-bold text-gray-500 uppercase tracking-wider px-5 py-2 bg-gray-100 rounded-xl">
                                    Event Completed
                                </span>
                            ) : booking.status === 'APPROVED' ? (
                                <Tooltip text="Revoke this approval and cancel the booking. The requester will be notified and the venue will be freed up." position="top">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRejectClick(booking); }}
                                        disabled={isActing}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-[14.5px] font-medium text-red-700 bg-red-50 hover:bg-red-100 hover:border-red-300 transition-all duration-150 disabled:opacity-40"
                                    >
                                        <IconX /> Cancel Booking
                                    </button>
                                </Tooltip>
                            ) : booking.status === 'APPROVED' ? (
                                <Tooltip
                                    text="Revoke this approval and cancel the booking. The requester will be notified and the venue will be freed up."
                                    position="top"
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRejectClick(booking);
                                        }}
                                        disabled={isActing}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-[14.5px] font-medium text-red-700 bg-red-50 hover:bg-red-100 hover:border-red-300 transition-all duration-150 disabled:opacity-40"
                                    >
                                        <IconX />
                                        Cancel Booking
                                    </button>
                                </Tooltip>
                            ) : ['REJECTED', 'CANCELLED'].includes(booking.status) ? (<span className="text-[13px] font-bold text-red-500 uppercase tracking-wider px-5 py-2 bg-red-50 rounded-xl">
                                Cancelled
                            </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Booking List (shared renderer) ──────────────────────────────────────────

function BookingList({ bookings, isPendingTab, onApproveClick, onRejectClick, actionLoading, highlightedReference }) {
    const priorityBookings = bookings.filter(b => b.is_external);
    const standardBookings = bookings.filter(b => !b.is_external);

    if (bookings.length === 0) return null;

    return (
        <>
            {priorityBookings.length > 0 && (
                <div className="border-b border-[#e8f5ee]">
                    <div className="flex items-center px-7 py-3 bg-[#fffbeb] border-b border-[#fde68a]">
                        <span className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#d97706]">
                            <IconLightning /> External Events
                        </span>
                    </div>
                    {priorityBookings.map((booking) => (
                        <BookingRow
                            key={bookingRowKey(booking)}
                            booking={booking}
                            isPendingTab={isPendingTab}
                            onApproveClick={onApproveClick}
                            onRejectClick={onRejectClick}
                            isActing={actionLoading === booking.id}
                            isHighlighted={bookingMatchesReference(booking, highlightedReference)}
                        />
                    ))}
                </div>
            )}
            {standardBookings.length > 0 && (
                <div>
                    {priorityBookings.length > 0 && (
                        <div className="flex items-center px-7 py-3 bg-[#f8fafc] border-b border-[#e2e8f0]">
                            <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
                                Internal Events
                            </span>
                        </div>
                    )}
                    {standardBookings.map((booking) => (
                        <BookingRow
                            key={bookingRowKey(booking)}
                            booking={booking}
                            isPendingTab={isPendingTab}
                            onApproveClick={onApproveClick}
                            onRejectClick={onRejectClick}
                            isActing={actionLoading === booking.id}
                            isHighlighted={bookingMatchesReference(booking, highlightedReference)}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const PAGE_DOMAIN = 'spaces';

const AdminDashboard = () => {
    const { can_manage_system, can_manage_mess, user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const can_manage_media = user?.capabilities?.can_manage_media;
    const currentUserId = user?.id;
    const requestedTab = searchParams.get('tab');
    const highlightedReference = searchParams.get('booking') || '';

    const now = new Date();

    // ── Tabs ──────────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState(() => (
        ['pending', 'upcoming', 'history', 'resolvedByMe'].includes(requestedTab)
            ? requestedTab
            : 'pending'
    ));

    // ── Optional date filter (empty string = no filter) ──────────────────────
    const [dateFilter, setDateFilter] = useState('');

    // ── React Query ───────────────────────────────────────────────────────────
    const pendingQuery = useApprovals(PAGE_DOMAIN, 'PENDING');
    const approvedQuery = useApprovals(PAGE_DOMAIN, 'APPROVED');
    const rejectedQuery = useApprovals(PAGE_DOMAIN, 'REJECTED');
    const cancelledQuery = useApprovals(PAGE_DOMAIN, 'CANCELLED');

    const isLoading = pendingQuery.isLoading || approvedQuery.isLoading || rejectedQuery.isLoading || cancelledQuery.isLoading;
    const isFetching = pendingQuery.isFetching || approvedQuery.isFetching || rejectedQuery.isFetching || cancelledQuery.isFetching;

    const raw = useMemo(() => {
        const r = {
            pending: groupBookings(pendingQuery.data?.queue || []),
            approved: groupBookings(approvedQuery.data?.queue || []),
            rejected: groupBookings(rejectedQuery.data?.queue || []),
            cancelled: groupBookings(cancelledQuery.data?.queue || []),
        };
        return r;
    }, [
        pendingQuery.data?.queue,
        approvedQuery.data?.queue,
        rejectedQuery.data?.queue,
        cancelledQuery.data?.queue
    ]);

    // ── UI state ──────────────────────────────────────────────────────────────
    const [actionLoading, setActionLoading] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [error, setError] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [approveTarget, setApproveTarget] = useState(null);
    const [successTarget, setSuccessTarget] = useState(null);

    // ── Filters (only apply to history / resolved tabs) ───────────────────────
    const [statusFilter, setStatusFilter] = useState('all');
    const [timingFilter, setTimingFilter] = useState('all');

    // ── Unified filter toolbar state ──────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [venueFilter, setVenueFilter] = useState('all');
    
    const { data: spacesData } = useSpaceCatalog();
    const venues = Array.isArray(spacesData) ? spacesData : (spacesData?.results ?? []);

    // Reset filters when switching tabs
    const handleTabChange = useCallback((tab) => {
        setActiveTab(tab);
        setStatusFilter('all');
        setTimingFilter('all');
    }, []);

    useEffect(() => {
        if (!['pending', 'upcoming', 'history', 'resolvedByMe'].includes(requestedTab)) return undefined;
        const timer = window.setTimeout(() => handleTabChange(requestedTab), 0);
        return () => window.clearTimeout(timer);
    }, [handleTabChange, requestedTab]);

    // ── Derived lists ─────────────────────────────────────────────────────────
    const history = useMemo(() => {
        const res = [...raw.approved, ...raw.rejected, ...raw.cancelled]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return res;
    }, [raw.approved, raw.rejected, raw.cancelled]);

    const upcoming = useMemo(() => {
        const res = raw.approved
            .filter(b => b.start_datetime && new Date(b.start_datetime) > now)
            .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
        return res;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [raw.approved]);

    const resolvedByMe = useMemo(() => {
        const res = history.filter(b => b.resolved_by_id === currentUserId);
        return res;
    }, [history, currentUserId]);

    // ── Apply filters to a list ───────────────────────────────────────────────
    const applyFilters = useCallback((list) => {
        let result = list;

        if (statusFilter === 'approved') {
            result = result.filter(b => b.status === 'APPROVED');
        } else if (statusFilter === 'rejected') {
            result = result.filter(b => b.status === 'REJECTED');
        } else if (statusFilter === 'cancelled') {
            result = result.filter(b => b.status === 'CANCELLED');
        }

        if (timingFilter === 'today') {
            result = result.filter(b => isToday(b.start_datetime));
        } else if (timingFilter === 'upcoming') {
            result = result.filter(b => b.start_datetime && new Date(b.start_datetime) > now);
        } else if (timingFilter === 'past') {
            result = result.filter(b => b.end_datetime && new Date(b.end_datetime) < now);
        }

        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, timingFilter]);

    // ── What renders in the queue panel ───────────────────────────────────────
    const listForTab = useMemo(() => {
        let res;
        switch (activeTab) {
            case 'pending': res = [...raw.pending].sort(compareSubmissionTimeDesc); break;
            case 'upcoming': res = upcoming; break;
            case 'history': res = applyFilters(history); break;
            case 'resolvedByMe': res = applyFilters(resolvedByMe); break;
            default: res = []; break;
        }
        return res;
    }, [activeTab, raw.pending, upcoming, history, resolvedByMe, applyFilters]);

    // ── Combined display list: tab → optional date → venue → search ──────────
    const displayList = useMemo(() => {
        let result = listForTab;

        if (dateFilter) {
            result = result.filter((b) => bookingOverlapsDate(b, dateFilter));
        }

        if (venueFilter !== 'all') {
            result = result.filter(b => {
                const name = (b.resource_name || b.space_details?.name || '').toLowerCase();
                return name === venueFilter.toLowerCase();
            });
        }

        const q = searchQuery.trim().toLowerCase();
        if (q) {
            result = result.filter(b => {
                const fields = [
                    b.requester, b.user_name,
                    b.resource_name, b.space_details?.name,
                    b.department_name, b.department,
                    b.reference_code,
                ].map(v => (v || '').toLowerCase());
                return fields.some(f => f.includes(q));
            });
        }
        return result;
    }, [listForTab, dateFilter, venueFilter, searchQuery]);

    useEffect(() => {
        if (!highlightedReference || isLoading || listForTab.length === 0) return undefined;

        const target = Array.from(document.querySelectorAll('[data-booking-reference]'))
            .find((element) => normaliseReference(element.getAttribute('data-booking-reference')) === normaliseReference(highlightedReference));

        if (!target) return undefined;

        const timer = window.setTimeout(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);

        return () => window.clearTimeout(timer);
    }, [highlightedReference, isLoading, listForTab]);

    useEffect(() => {
        if (!highlightedReference || isLoading || activeTab !== 'pending') return undefined;
        if (raw.pending.some((booking) => bookingMatchesReference(booking, highlightedReference))) return undefined;

        const nextTab = history.some((booking) => bookingMatchesReference(booking, highlightedReference))
            ? 'history'
            : upcoming.some((booking) => bookingMatchesReference(booking, highlightedReference))
                ? 'upcoming'
                : null;

        if (!nextTab) return undefined;

        const timer = window.setTimeout(() => handleTabChange(nextTab), 0);
        return () => window.clearTimeout(timer);
    }, [activeTab, handleTabChange, highlightedReference, history, isLoading, raw.pending, upcoming]);

    // ── Auth Redirects ────────────────────────────────────────────────────────
    const can_manage_fleet = user?.capabilities?.can_manage_fleet;

    useEffect(() => {
        if (can_manage_fleet && !can_manage_system) {
            navigate('/admin/transport', { replace: true });
            return;
        }
        if (can_manage_mess && !can_manage_system) {
            navigate('/admin/mess', { replace: true });
            return;
        }
        if (can_manage_media && !can_manage_system) {
            navigate('/admin/media', { replace: true });
            return;
        }
    }, [can_manage_fleet, can_manage_mess, can_manage_system, can_manage_media, navigate]);

    const resolveMutation = useResolveApproval();

    // ── Actions ───────────────────────────────────────────────────────────────

    const handleApproveConfirm = async () => {
        if (!approveTarget) return;
        const parentBooking = approveTarget;
        setActionLoading(parentBooking.id);
        setActionError(null);
        try {
            // Send ONE call with the first child's ID.
            // The backend's _resolve_group() fans out to all siblings via group_id,
            // so a single request is both correct and sufficient.
            const representativeId = parentBooking.child_bookings?.[0]?.id ?? parentBooking.id;
            await resolveMutation.mutateAsync({
                module: parentBooking.domain || 'spaces',
                id: representativeId,
                status: 'APPROVED',
                remarks: '',
            });
            await notificationService.markBookingRead(parentBooking.reference_code, parentBooking.domain || 'spaces').catch(() => null);
            if (bookingMatchesReference(parentBooking, highlightedReference)) {
                navigate('/admin?tab=pending', { replace: true });
            }

            setSuccessTarget(parentBooking);
            setApproveTarget(null);
        } catch (err) {
            console.error('Approve error:', err);
            setActionError(err.response?.data?.error || 'Could not approve booking. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectConfirm = async (remarks) => {
        if (!rejectTarget) return;
        const parentBooking = rejectTarget;
        setActionLoading(parentBooking.id);
        setActionError(null);
        try {
            // Same single-call pattern — backend resolves the whole group.
            const representativeId = parentBooking.child_bookings?.[0]?.id ?? parentBooking.id;
            await resolveMutation.mutateAsync({
                module: parentBooking.domain || 'spaces',
                id: representativeId,
                status: 'REJECTED',
                remarks,
            });
            await notificationService.markBookingRead(parentBooking.reference_code, parentBooking.domain || 'spaces').catch(() => null);
            if (bookingMatchesReference(parentBooking, highlightedReference)) {
                navigate('/admin?tab=pending', { replace: true });
            }

            setRejectTarget(null);
        } catch (err) {
            console.error('Reject error:', err);
            setActionError(err.response?.data?.error || 'Could not reject booking. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    // Clear action error when modals close
    const handleApproveClose = () => { setApproveTarget(null); setActionError(null); };
    const handleRejectClose = () => { setRejectTarget(null); setActionError(null); };

    // ── Stats ─────────────────────────────────────────────────────────────────
    const todayCount = useMemo(() =>
        raw.approved.filter(b => b.start_datetime && isToday(b.start_datetime)).length,
        [raw.approved]);

    const totalPeople = useMemo(() =>
        [...raw.approved, ...raw.pending].reduce((s, b) => s + (b.attendee_count || 0), 0),
        [raw.approved, raw.pending]);

    // ── Tabs config ───────────────────────────────────────────────────────────
    const tabs = [
        { id: 'pending', label: 'Pending', count: raw.pending.length },
        { id: 'upcoming', label: 'Approved Events', count: upcoming.length },
        { id: 'history', label: 'History', count: history.length },
        { id: 'resolvedByMe', label: 'Resolved by Me', count: resolvedByMe.length },
    ];

    const showFilters = activeTab === 'history' || activeTab === 'resolvedByMe';

    // Filter option counts
    const baseList = activeTab === 'history' ? history : resolvedByMe;

    const statusOptions = useMemo(() => {
        const res = [
            { value: 'all', label: 'All', count: baseList.length },
            { value: 'approved', label: 'Approved', count: baseList.filter(b => b.status === 'APPROVED').length },
            { value: 'rejected', label: 'Rejected', count: baseList.filter(b => b.status === 'REJECTED').length },
            { value: 'cancelled', label: 'Cancelled', count: baseList.filter(b => b.status === 'CANCELLED').length },
        ];
        return res;
    }, [baseList]);

    const timingOptions = useMemo(() => {
        const res = [
            { value: 'all', label: 'All time' },
            { value: 'today', label: 'Today', count: baseList.filter(b => isToday(b.start_datetime)).length },
            { value: 'upcoming', label: 'Upcoming', count: baseList.filter(b => b.start_datetime && new Date(b.start_datetime) > now).length },
            { value: 'past', label: 'Past', count: baseList.filter(b => b.end_datetime && new Date(b.end_datetime) < now).length },
        ];
        return res;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseList]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div
            className="min-h-full bg-[#f6fbf8] p-6 md:p-8"
            style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
        >
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Modals */}
            {approveTarget && (
                <ApproveModal
                    booking={approveTarget}
                    onConfirm={handleApproveConfirm}
                    onCancel={handleApproveClose}
                    isLoading={actionLoading === approveTarget.id}
                    errorMsg={actionError}
                />
            )}
            {rejectTarget && (
                <RejectModal
                    booking={rejectTarget}
                    onConfirm={handleRejectConfirm}
                    onCancel={handleRejectClose}
                    isLoading={actionLoading === rejectTarget.id}
                    errorMsg={actionError}
                />
            )}
            {successTarget && (
                <SuccessModal booking={successTarget} onClose={() => setSuccessTarget(null)} />
            )}

            <div className="max-w-[1100px] mx-auto">

                {/* Page header */}
                <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
                    <div>
                        <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#6b7280] mb-1.5">
                            Rajagiri College · Admin
                        </p>
                        <div className="flex items-center gap-2">
                            <h1 className="text-[26px] font-bold text-[#0f172a] tracking-tight leading-none">Venue Bookings</h1>
                            <PageInfo text="Review, approve, or reject space booking requests. Approved requests reserve the venue." />
                        </div>
                        <p className="text-[15px] text-[#374151] mt-2">
                            Review and manage venue booking requests.
                        </p>
                    </div>
                    <Tooltip text="Reload the booking queue to see the latest requests." position="top">
                        <button
                            onClick={() => {
                                pendingQuery.refetch();
                                approvedQuery.refetch();
                                rejectedQuery.refetch();
                                cancelledQuery.refetch();
                            }}
                            disabled={isFetching}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#d1fae5] bg-white text-[14px] font-semibold text-[#4a6b58] hover:bg-[#f0fdf4] transition-all duration-150 disabled:opacity-40"
                        >
                            <IconRefresh spinning={isFetching} />
                            Refresh
                        </button>
                    </Tooltip>
                </div>

                {/* Stat strip */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                        { value: raw.pending.length, label: 'Needs Approval' },
                        { value: todayCount, label: 'Today \'s Events' },
                        { value: totalPeople, label: 'Total people attending' },
                    ].map(({ value, label }) => (
                        <div key={label} className="bg-white border border-[#e8f5ee] rounded-2xl px-6 py-5">
                            <p className="text-[32px] font-light text-[#0f172a] tracking-tight leading-none">{value}</p>
                            <p className="text-[14px] font-medium text-[#374151] mt-2">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="mb-4 flex w-fit flex-wrap gap-1 rounded-2xl bg-[#e8f5ee] p-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-bold transition-all ${activeTab === tab.id
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

                {/* ── Filter Toolbar ── */}
                <div className="mb-4 rounded-2xl border border-[#e8f5ee] bg-white shadow-sm overflow-hidden">

                    {/* Controls row */}
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3">

                        {/* Search */}
                        <div className="relative flex-1 min-w-[180px]">
                            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search bookings…"
                                className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2.5 pl-9 pr-8 text-[13.5px] text-[#0f172a] outline-none transition focus:border-[#15803d] focus:ring-2 focus:ring-[#dcfce7] placeholder:text-[#9ca3af]"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151] transition">
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" stroke="currentColor"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>

                        {/* Venue dropdown */}
                        <div className="relative min-w-[160px]">
                            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 8h.01M15 8h.01M9 13h.01M15 13h.01" /></svg>
                            <select
                                value={venueFilter}
                                onChange={e => setVenueFilter(e.target.value)}
                                className="w-full appearance-none rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2.5 pl-9 pr-8 text-[13.5px] text-[#0f172a] outline-none transition focus:border-[#15803d] focus:ring-2 focus:ring-[#dcfce7] cursor-pointer"
                            >
                                <option value="all">All Venues</option>
                                {venues.map(v => (
                                    <option key={v.id} value={v.name}>{v.name}</option>
                                ))}
                            </select>
                            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"><path d="M6 9l6 6 6-6" /></svg>
                        </div>

                        {/* Date filter — opt-in; empty = show all */}
                        {dateFilter ? (
                            <div className="flex items-center gap-1.5 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5">
                                <svg className="w-4 h-4 text-[#15803d] shrink-0" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                <span className="text-[13px] font-semibold text-[#15803d] whitespace-nowrap">
                                    {formatCalDate(dateFilter, { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                                <button onClick={() => setDateFilter('')} className="ml-1 text-[#15803d] hover:text-[#166534] transition" aria-label="Clear date filter">
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" stroke="currentColor"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                <input
                                    type="date"
                                    value=""
                                    onChange={e => e.target.value && setDateFilter(e.target.value)}
                                    className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2.5 pl-9 pr-3 text-[13.5px] text-[#9ca3af] outline-none transition focus:border-[#15803d] focus:ring-2 focus:ring-[#dcfce7] cursor-pointer"
                                    placeholder="Filter by date"
                                />
                            </div>
                        )}

                        {/* Clear all */}
                        {(searchQuery || venueFilter !== 'all' || dateFilter) && (
                            <button
                                onClick={() => { setSearchQuery(''); setVenueFilter('all'); setDateFilter(''); }}
                                className="text-[12px] font-bold text-[#dc2626] hover:underline whitespace-nowrap transition"
                            >
                                Clear all
                            </button>
                        )}
                    </div>

                    {/* Status/timing pills (history/resolvedByMe only) */}
                    {showFilters && (
                        <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-[#e8f5ee] px-5 py-3">
                            <FilterPills label="Status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
                            <div className="w-px bg-[#e8f5ee] self-stretch hidden sm:block" />
                            <FilterPills label="Timing" options={timingOptions} value={timingFilter} onChange={setTimingFilter} />
                        </div>
                    )}
                </div>

                {/* Queue panel */}
                <div className="bg-white border border-[#e8f5ee] rounded-2xl overflow-hidden shadow-sm">
                    {error ? (
                        <div className="py-20 text-center px-8">
                            <div className="w-12 h-12 rounded-full bg-[#fef2f2] flex items-center justify-center mx-auto mb-4 text-[#dc2626]"><IconAlert /></div>
                            <p className="text-[15px] font-semibold text-[#0f172a]">Could not load bookings</p>
                            <p className="text-[13.5px] text-[#a8c4b4] mt-1.5">Sign out and back in, then try again.</p>
                        </div>
                    ) : isLoading ? (
                        <div className="flex flex-col">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="px-7 py-6 border-b border-[#e8f5ee] animate-pulse">
                                    <div className="h-4 bg-[#f0fdf4] rounded w-32 mb-5"></div>
                                    <div className="grid grid-cols-3 gap-7">
                                        <div><div className="h-3 bg-gray-100 rounded w-16 mb-2"></div><div className="h-10 bg-gray-50 rounded"></div></div>
                                        <div><div className="h-3 bg-gray-100 rounded w-16 mb-2"></div><div className="h-10 bg-gray-50 rounded"></div></div>
                                        <div><div className="h-3 bg-gray-100 rounded w-16 mb-2"></div><div className="h-10 bg-gray-50 rounded"></div></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : displayList.length === 0 ? (
                        <div className="py-20 text-center px-8">
                            <div className="w-12 h-12 rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-4 text-[#15803d]"><IconCheck className="w-6 h-6" /></div>
                            <p className="text-[15px] font-semibold text-[#0f172a]">No requests match your filters.</p>
                            <p className="text-[13.5px] text-[#a8c4b4] mt-1.5">Try a different date, venue, or search term.</p>
                        </div>
                    ) : (
                        <BookingList
                            bookings={displayList}
                            isPendingTab={activeTab === 'pending'}
                            onApproveClick={setApproveTarget}
                            onRejectClick={setRejectTarget}
                            actionLoading={actionLoading}
                            highlightedReference={highlightedReference}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;