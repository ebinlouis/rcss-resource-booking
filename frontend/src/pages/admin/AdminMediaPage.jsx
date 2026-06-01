import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    AlertTriangle, Building2, Check, ChevronDown, Clapperboard,
    Mail, Package, Phone, RefreshCw, Users, Wrench, X, Clock,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import mediaApi from '../../api/mediaApi'
import PageInfo from '../../components/PageInfo'
import notificationService from '../../api/notificationService'
import { compareSubmissionTimeDesc, getSubmissionTimestamp } from '../../utils/submissionTime'
import toast from 'react-hot-toast';
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

const formatDate = (isoString) => {
    if (!isoString) return 'TBD'
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return 'TBD'
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

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

/**
 * CrewApprovalModal — fetches crew availability for the booking, shows
 * a multi-select checkbox list with busy/free indicators, and submits
 * the selected crew IDs along with the APPROVED status.
 */
function CrewApprovalModal({ booking, onConfirm, onCancel }) {
    const [crewData,    setCrewData]    = useState(null)
    const [fetchError,  setFetchError]  = useState('')
    const [fetching,    setFetching]    = useState(true)
    const [selected,    setSelected]    = useState(new Set())
    const [submitting,  setSubmitting]  = useState(false)
    const [submitError, setSubmitError] = useState('')

    useEffect(() => {
        let cancelled = false
        mediaApi.getCrewAvailability(booking.id)
            .then((data) => { if (!cancelled) { setCrewData(data); setFetching(false) } })
            .catch((err) => { if (!cancelled) { setFetchError(apiError(err)); setFetching(false) } })
        return () => { cancelled = true }
    }, [booking.id])

    const toggleMember = (id) => {
        setSelected((prev) => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const handleSubmit = async () => {
        if (selected.size === 0) { setSubmitError('Please select at least one crew member.'); return }
        setSubmitting(true); setSubmitError('')
        try {
            await onConfirm(Array.from(selected))
        } catch (err) {
            setSubmitError(apiError(err))
            setSubmitting(false)
        }
    }

    const crew = crewData?.crew ?? []
    const freeCrew = crew.filter((m) => !m.is_busy)
    const busyCrew = crew.filter((m) => m.is_busy)

    return (
        <ModalBackdrop onClose={submitting ? undefined : onCancel}>
            <div
                className="w-full max-w-[560px] rounded-2xl border border-[#e8f5ee] bg-white shadow-2xl shadow-black/10 overflow-hidden"
                style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-7 py-5 border-b border-[#e8f5ee]">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dcfce7] text-[#15803d]">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[17px] font-bold tracking-tight text-[#0f172a]">Assign Crew & Approve</p>
                            <p className="text-[13px] text-[#6b7280]">{booking.event_name}</p>
                        </div>
                    </div>
                    <button onClick={onCancel} disabled={submitting} className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#374151] disabled:opacity-40">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Window info */}
                {crewData && (
                    <div className="px-7 pt-4 pb-2">
                        <p className="text-[12px] font-semibold text-[#6b7280]">
                            Time window: {formatDate(crewData.window_start)} {formatTime(crewData.window_start)} — {formatTime(crewData.window_end)}
                        </p>
                    </div>
                )}

                {/* Crew list */}
                <div className="max-h-[360px] overflow-y-auto px-7 py-3 space-y-2">
                    {fetching ? (
                        <div className="flex items-center justify-center py-10">
                            <RefreshCw className="h-6 w-6 animate-spin text-[#15803d]" />
                            <span className="ml-3 text-[14px] text-[#6b7280]">Checking availability…</span>
                        </div>
                    ) : fetchError ? (
                        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] font-medium text-red-700">{fetchError}</p>
                    ) : crew.length === 0 ? (
                        <p className="py-8 text-center text-[14px] text-[#6b7280]">No crew members found. Please contact IT Admin to assign the MEDIA_INCHARGE role.</p>
                    ) : (
                        <>
                            {/* Free members */}
                            {freeCrew.length > 0 && (
                                <div className="mb-3">
                                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-green-600">Available ({freeCrew.length})</p>
                                    <div className="space-y-2">
                                        {freeCrew.map((member) => (
                                            <CrewMemberRow key={member.id} member={member} selected={selected.has(member.id)} onToggle={toggleMember} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Busy members */}
                            {busyCrew.length > 0 && (
                                <div>
                                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-amber-600">Busy — Already Assigned ({busyCrew.length})</p>
                                    <div className="space-y-2">
                                        {busyCrew.map((member) => (
                                            <CrewMemberRow key={member.id} member={member} selected={selected.has(member.id)} onToggle={toggleMember} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Error & footer */}
                <div className="border-t border-[#e8f5ee] px-7 py-5">
                    {submitError && (
                        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{submitError}</p>
                    )}
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] text-[#6b7280]">
                            {selected.size === 0 ? 'No crew selected' : `${selected.size} crew member${selected.size > 1 ? 's' : ''} selected`}
                        </p>
                        <div className="flex gap-2.5">
                            <button onClick={onCancel} disabled={submitting} className="rounded-xl border border-[#e2e8f0] bg-white px-5 py-2.5 text-[14px] font-medium text-[#4b5563] hover:bg-[#f6fbf8] disabled:opacity-40">
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || fetching || selected.size === 0}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#15803d] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#166534] disabled:opacity-40"
                            >
                                {submitting ? <><RefreshCw className="h-4 w-4 animate-spin" /> Approving…</> : <><Check className="h-4 w-4" /> Approve Booking</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </ModalBackdrop>
    )
}

function CrewMemberRow({ member, selected, onToggle }) {
    return (
        <button
            type="button"
            onClick={() => onToggle(member.id)}
            className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                selected
                    ? 'border-[#15803d] bg-[#f0fdf4] ring-1 ring-[#15803d]'
                    : member.is_busy
                    ? 'border-amber-200 bg-amber-50/50 hover:border-amber-300'
                    : 'border-[#e8f5ee] bg-white hover:border-[#15803d]/40 hover:bg-[#f9fdfb]'
            }`}
        >
            <div className="flex items-start gap-3">
                {/* Checkbox */}
                <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                    selected ? 'border-[#15803d] bg-[#15803d]' : 'border-[#d1d5db]'
                }`}>
                    {selected && <Check className="h-3 w-3 text-white" />}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-semibold text-[#0f172a]">{member.name}</p>
                        {member.is_busy ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                <AlertTriangle className="h-3 w-3" /> Busy
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">
                                <Check className="h-3 w-3" /> Free
                            </span>
                        )}
                    </div>
                    {member.designation && (
                        <p className="mt-0.5 text-[12.5px] text-[#6b7280]">{member.designation}</p>
                    )}
                    {member.phone && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[#6b7280]">
                            <Phone className="h-3 w-3" /> {member.phone}
                        </p>
                    )}
                    {/* Busy conflicts warning */}
                    {member.is_busy && member.busy_bookings?.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {member.busy_bookings.map((b, i) => (
                                <p key={i} className="rounded-lg bg-amber-100/60 px-2.5 py-1.5 text-[11.5px] text-amber-800 flex items-center gap-1.5">
                                    <Clock className="w-3 h-3 shrink-0" /> {b.event_name} — {formatDate(b.setup_start_datetime)} {formatTime(b.setup_start_datetime)}–{formatTime(b.teardown_end_datetime)}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </button>
    )
}

function UpdateCrewModal({ booking, onConfirm, onCancel }) {
    const [crewData,    setCrewData]    = useState(null)
    const [fetchError,  setFetchError]  = useState('')
    const [fetching,    setFetching]    = useState(true)
    const [selected,    setSelected]    = useState(new Set())
    const [submitting,  setSubmitting]  = useState(false)
    const [submitError, setSubmitError] = useState('')

    useEffect(() => {
        let cancelled = false
        mediaApi.getEditCrewAvailability(booking.id)
            .then((data) => {
                if (!cancelled) {
                    setCrewData(data)
                    const preselected = new Set()
                    data.available_crew?.forEach(m => { if (m.is_preselected) preselected.add(m.id) })
                    setSelected(preselected)
                    setFetching(false)
                }
            })
            .catch((err) => { if (!cancelled) { setFetchError(apiError(err)); setFetching(false) } })
        return () => { cancelled = true }
    }, [booking.id])

    const toggleMember = (id) => {
        setSelected((prev) => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const handleSubmit = async () => {
        if (selected.size === 0) { setSubmitError('Please select at least one crew member.'); return }
        setSubmitting(true); setSubmitError('')
        try {
            await onConfirm(Array.from(selected))
        } catch (err) {
            setSubmitError(apiError(err))
            setSubmitting(false)
        }
    }

    const freeCrew = crewData?.available_crew ?? []
    const busyCrew = crewData?.currently_assigned_busy ?? []

    return (
        <ModalBackdrop onClose={submitting ? undefined : onCancel}>
            <div
                className="w-full max-w-[560px] rounded-2xl border border-[#e8f5ee] bg-white shadow-2xl shadow-black/10 overflow-hidden"
                style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            >
                <div className="flex items-center justify-between gap-3 px-7 py-5 border-b border-[#e8f5ee]">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dbeafe] text-[#1d4ed8]">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[17px] font-bold tracking-tight text-[#0f172a]">Update Assigned Crew</p>
                            <p className="text-[13px] text-[#6b7280]">{booking.event_name}</p>
                        </div>
                    </div>
                    <button onClick={onCancel} disabled={submitting} className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#374151] disabled:opacity-40">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="max-h-[360px] overflow-y-auto px-7 py-3 space-y-2">
                    {fetching ? (
                        <div className="flex items-center justify-center py-10">
                            <RefreshCw className="h-6 w-6 animate-spin text-[#1d4ed8]" />
                            <span className="ml-3 text-[14px] text-[#6b7280]">Loading crew availability…</span>
                        </div>
                    ) : fetchError ? (
                        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] font-medium text-red-700">{fetchError}</p>
                    ) : (freeCrew.length === 0 && busyCrew.length === 0) ? (
                        <p className="py-8 text-center text-[14px] text-[#6b7280]">No crew members found.</p>
                    ) : (
                        <>
                            {freeCrew.length > 0 && (
                                <div className="mb-3">
                                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#1d4ed8]">Available Options ({freeCrew.length})</p>
                                    <div className="space-y-2">
                                        {freeCrew.map((member) => (
                                            <CrewMemberRow key={member.id} member={member} selected={selected.has(member.id)} onToggle={toggleMember} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {busyCrew.length > 0 && (
                                <div>
                                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-amber-600">Currently Assigned but Busy ({busyCrew.length})</p>
                                    <div className="space-y-2">
                                        {busyCrew.map((member) => (
                                            <div key={member.id} className="w-full rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 opacity-75">
                                                <div className="flex items-start gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-[14px] font-semibold text-[#0f172a]">{member.name}</p>
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                                                <AlertTriangle className="h-3 w-3" /> Busy
                                                            </span>
                                                        </div>
                                                        {member.designation && <p className="mt-0.5 text-[12.5px] text-[#6b7280]">{member.designation}</p>}
                                                        {member.busy_bookings?.length > 0 && (
                                                            <div className="mt-2 space-y-1">
                                                                {member.busy_bookings.map((b, i) => (
                                                                    <p key={i} className="rounded-lg bg-amber-100/60 px-2.5 py-1.5 text-[11.5px] text-amber-800 flex items-center gap-1.5">
                                                                        <Clock className="w-3 h-3 shrink-0" /> {b.event_name} — {formatDate(b.setup_start_datetime)} {formatTime(b.setup_start_datetime)}–{formatTime(b.teardown_end_datetime)}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className="border-t border-[#e8f5ee] px-7 py-5">
                    {submitError && (
                        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{submitError}</p>
                    )}
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] text-[#6b7280]">
                            {selected.size === 0 ? 'No crew selected' : `${selected.size} crew member${selected.size > 1 ? 's' : ''} selected`}
                        </p>
                        <div className="flex gap-2.5">
                            <button onClick={onCancel} disabled={submitting} className="rounded-xl border border-[#e2e8f0] bg-white px-5 py-2.5 text-[14px] font-medium text-[#4b5563] hover:bg-[#f6fbf8] disabled:opacity-40">
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || fetching || selected.size === 0}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#1d4ed8] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#1e40af] disabled:opacity-40"
                            >
                                {submitting ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving…</> : <><Check className="h-4 w-4" /> Save Changes</>}
                            </button>
                        </div>
                    </div>
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
                style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
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
                style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            >
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#dcfce7]">
                    <Check className="h-6 w-6 text-[#15803d]" />
                </div>
                <p className="text-[17px] font-semibold tracking-tight text-[#0f172a]">Booking approved!</p>
                <p className="mt-2 text-[14px] leading-relaxed text-[#6b6b6b]">
                    <span className="font-medium text-[#0f172a]">{booking.event_name}</span> has been approved with crew assigned.
                </p>
                <button onClick={onClose} className="mt-6 w-full rounded-xl bg-[#15803d] py-3 text-[14px] font-semibold text-white hover:bg-[#166534]">
                    Done
                </button>
            </div>
        </ModalBackdrop>
    )
}

// ── Media Team Roster Card ─────────────────────────────────────────────────────

function MediaTeamRosterCard() {
    const [roster,  setRoster]  = useState([])
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState('')

    useEffect(() => {
        let cancelled = false
        mediaApi.getCrewRoster()
            .then((data) => { if (!cancelled) { setRoster(data); setLoading(false) } })
            .catch(() => { if (!cancelled) { setError('Could not load team roster.'); setLoading(false) } })
        return () => { cancelled = true }
    }, [])

    return (
        <div
            className="rounded-2xl border border-[#e8f5ee] bg-white shadow-sm overflow-hidden"
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
        >
            {/* Card header */}
            <div className="flex items-center gap-3 border-b border-[#e8f5ee] px-6 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f0fdf4] text-[#15803d]">
                    <Clapperboard className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-[15px] font-bold tracking-tight text-[#0f172a]">Media Team Roster</p>
                    <p className="text-[12px] text-[#6b7280]">All MEDIA_INCHARGE members · Managed by IT Admin</p>
                </div>
                {!loading && (
                    <span className="ml-auto rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-[12px] font-bold text-[#15803d]">
                        {roster.length} member{roster.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="px-6 py-4">
                {loading ? (
                    <div className="flex items-center gap-3 py-4">
                        <RefreshCw className="h-4 w-4 animate-spin text-[#15803d]" />
                        <span className="text-[13.5px] text-[#6b7280]">Loading roster…</span>
                    </div>
                ) : error ? (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] font-medium text-red-700">{error}</p>
                ) : roster.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#d1fae5] bg-[#f6fbf8] px-5 py-8 text-center">
                        <Users className="mx-auto mb-3 h-7 w-7 text-[#86efac]" />
                        <p className="text-[14px] font-semibold text-[#374151]">No media crew assigned yet</p>
                        <p className="mt-1 text-[13px] text-[#6b7280]">Contact an IT Admin to assign the MEDIA_INCHARGE role to team members.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {roster.map((member) => (
                            <div key={member.id} className="flex items-center gap-4 rounded-xl border border-[#e8f5ee] bg-[#f9fdfb] px-4 py-3">
                                {/* Avatar */}
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dcfce7] text-[15px] font-bold text-[#15803d]">
                                    {member.name?.charAt(0)?.toUpperCase() ?? '?'}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[14.5px] font-semibold text-[#0f172a]">{member.name}</p>
                                    {member.designation && (
                                        <p className="truncate text-[12.5px] text-[#6b7280]">{member.designation}</p>
                                    )}
                                </div>
                                <div className="shrink-0 space-y-1 text-right">
                                    {member.phone && (
                                        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#374151]">
                                            <Phone className="h-3.5 w-3.5 text-[#15803d]" /> {member.phone}
                                        </p>
                                    )}
                                    {member.email && (
                                        <p className="flex items-center gap-1.5 text-[12.5px] text-[#6b7280]">
                                            <Mail className="h-3.5 w-3.5 text-[#15803d]" /> {member.email}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── BookingCard ───────────────────────────────────────────────────────────────

function BookingCard({ booking, isPendingTab, isActing, onApproveClick, onRejectClick, onUpdateCrewClick, isHighlighted }) {
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

    const hasBuffer = booking.setup_start_datetime && booking.event_start_datetime &&
        (new Date(booking.setup_start_datetime).getTime() !== new Date(booking.event_start_datetime).getTime() ||
         new Date(booking.teardown_end_datetime).getTime() !== new Date(booking.event_end_datetime).getTime())

    const user          = booking.user_details ?? {}
    const requesterName = user.name || `User #${booking.user}`
    const dept          = user.department || user.department_code || 'Department not provided'
    const spaceName     = booking.space_details?.name || 'Any suitable space'
    const location      = booking.space_details?.location || 'Location not specified'

    // Assigned crew (visible on non-pending approved bookings)
    const assignedCrew = booking.assigned_crew ?? []
    const showCrew     = booking.status === 'APPROVED' && assignedCrew.length > 0

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

                        {/* Assigned crew for approved bookings */}
                        {showCrew && (
                            <div className="mb-6 rounded-xl border border-[#d1fae5] bg-[#f0fdf4] px-5 py-4">
                                <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.1em] text-[#15803d]">Assigned Crew</p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {assignedCrew.map((member) => (
                                        <div key={member.id} className="flex items-center gap-3 rounded-xl border border-[#bbf7d0] bg-white px-3 py-2.5">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dcfce7] text-[13px] font-bold text-[#15803d]">
                                                {member.name?.charAt(0)?.toUpperCase() ?? '?'}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-[13.5px] font-semibold text-[#0f172a]">{member.name}</p>
                                                {member.designation && <p className="truncate text-[12px] text-[#6b7280]">{member.designation}</p>}
                                                {member.phone && <p className="truncate text-[12px] text-[#374151]">{member.phone}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
                                    {isActing ? 'Processing…' : <><Check className="h-4 w-4" /> Approve & Assign Crew</>}
                                </button>
                            </>
                        ) : booking.status === 'APPROVED' ? (
                            <>
                                {booking.is_team_request && (
                                    <button onClick={(e) => { e.stopPropagation(); onUpdateCrewClick(booking) }} disabled={isActing} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#e2e8f0] text-[14.5px] font-medium text-[#1d4ed8] bg-white hover:bg-[#eff6ff] hover:text-[#1e40af] hover:border-[#bfdbfe] transition-all disabled:opacity-40">
                                        <Users className="h-4 w-4" /> Edit Assigned Crew
                                    </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); onRejectClick(booking) }} disabled={isActing} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-[14.5px] font-medium text-red-700 bg-red-50 hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-40">
                                    <X className="h-4 w-4" /> Revoke & Cancel Booking
                                </button>
                            </>
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

    const [activeTab,      setActiveTab]     = useState(() => (
        ['pending', 'active', 'history', 'resolved'].includes(requestedTab) ? requestedTab : 'pending'
    ))
    const [data,           setData]          = useState({ pending: [], resolved: [], active: [], history: [] })
    const [loading,        setLoading]       = useState(true)
    const [error,          setError]         = useState('')
    const [actionLoading,  setActionLoading] = useState(null)
    const [rejectTarget,   setRejectTarget]  = useState(null)
    const [approveTarget,  setApproveTarget] = useState(null)
    const [successTarget,  setSuccessTarget] = useState(null)
    const [updateCrewTarget, setUpdateCrewTarget] = useState(null)

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
        if (!canManageMedia) return
        ;(async () => { await fetchData({ showLoading: false }) })()
    }, [canManageMedia, fetchData])

    useEffect(() => {
        if (!['pending', 'active', 'history', 'resolved'].includes(requestedTab)) return undefined
        const timer = window.setTimeout(() => setActiveTab(requestedTab), 0)
        return () => window.clearTimeout(timer)
    }, [requestedTab])

    /** Called by CrewApprovalModal once crew are selected */
    const handleApproveConfirm = async (crewIds) => {
        if (!approveTarget) return
        setActionLoading(approveTarget.id)
        try {
            await mediaApi.reviewBooking(approveTarget.id, {
                status: 'APPROVED',
                assigned_crew: crewIds,
            })
            await notificationService.markBookingRead(approveTarget.reference_code, 'media').catch(() => null)
            if (normaliseReference(approveTarget.reference_code) === normaliseReference(highlightedReference)) {
                navigate('/admin/media?tab=pending', { replace: true })
            }
            setSuccessTarget(approveTarget)
            setApproveTarget(null)
            await fetchData({ showLoading: false })
        } catch (err) {
            // Let the modal handle the error display by re-throwing
            setActionLoading(null)
            throw err
        } finally {
            setActionLoading(null)
        }
    }

    const handleUpdateCrewConfirm = async (crewIds) => {
        if (!updateCrewTarget) return
        setActionLoading(updateCrewTarget.id)
        try {
            await mediaApi.updateCrew(updateCrewTarget.id, crewIds)
            setUpdateCrewTarget(null)
            await fetchData({ showLoading: false })
        } catch (err) {
            setActionLoading(null)
            throw err
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
    toast.error(`Failed to reject booking. ${apiError(err)}`);
} finally {
            setActionLoading(null)
        }
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
            <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-[#f6fbf8] p-8 text-center" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <X className="h-7 w-7" />
                </div>
                <p className="text-[18px] font-bold text-[#0f172a]">Access Denied</p>
                <p className="max-w-sm text-[14px] text-[#6b7280]">You don&apos;t have permission to access the Media admin panel.</p>
            </div>
        )
    }

    return (
        <div className="min-h-full bg-[#f6fbf8] p-6 md:p-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* Modals */}
            {approveTarget && (
                <CrewApprovalModal
                    booking={approveTarget}
                    onConfirm={handleApproveConfirm}
                    onCancel={() => setApproveTarget(null)}
                />
            )}
            {updateCrewTarget && (
                <UpdateCrewModal
                    booking={updateCrewTarget}
                    onConfirm={handleUpdateCrewConfirm}
                    onCancel={() => setUpdateCrewTarget(null)}
                />
            )}
            {rejectTarget && (
                <RejectModal booking={rejectTarget} onConfirm={handleRejectConfirm} onCancel={() => setRejectTarget(null)} isLoading={actionLoading === rejectTarget.id} />
            )}
            {successTarget && (
                <SuccessModal booking={successTarget} onClose={() => setSuccessTarget(null)} />
            )}

            <div className="mx-auto max-w-[1100px]">
                {/* Header */}
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Rajagiri College · Admin</p>
                        <div className="flex items-center gap-2">
                          <h1 className="text-[26px] font-bold leading-none tracking-tight text-[#0f172a]">Media Management</h1>
                          <PageInfo text="Approve media booking requests and assign crew members. The Media Team Roster is managed by IT Admin." />
                        </div>
                        <p className="mt-2 text-[15px] text-[#374151]">Manage media equipment requests and event support bookings.</p>
                    </div>
                    <div className="flex items-center gap-2">
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
                        { value: data.active.filter((b) => b.event_start_datetime && new Date(b.event_start_datetime).toLocaleDateString('en-CA') === todayStr).length, label: 'Approved for today' },
                    ].map(({ value, label }) => (
                        <div key={label} className="rounded-2xl border border-[#e8f5ee] bg-white px-6 py-5">
                            <p className="text-[30px] font-light leading-none tracking-tight text-[#0f172a]">{value}</p>
                            <p className="mt-2 text-[14px] font-semibold text-[#374151]">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Media Team Roster Card */}
                <div className="mb-6">
                    <MediaTeamRosterCard />
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
                        <div className="rounded-2xl border border-[#e8f5ee] bg-white px-6 py-12 text-center">
                            <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-[#15803d]" />
                            <p className="text-[14px] font-medium text-[#6b7280]">Loading bookings…</p>
                        </div>
                    ) : list.length === 0 ? (
                        <div className="rounded-2xl border border-[#e8f5ee] bg-white px-6 py-12 text-center">
                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f0fdf4]">
                                <Package className="h-6 w-6 text-[#86efac]" />
                            </div>
                            <p className="text-[15px] font-semibold text-[#374151]">No bookings here</p>
                            <p className="mt-1 text-[13.5px] text-[#6b7280]">
                                {activeTab === 'pending' ? 'No pending requests at the moment.' : 'Nothing to show in this section.'}
                            </p>
                        </div>
                    ) : (
                        list.map((booking) => (
                            <BookingCard
                                key={booking.id}
                                booking={booking}
                                isPendingTab={activeTab === 'pending'}
                                isActing={actionLoading === booking.id}
                                onApproveClick={(b) => setApproveTarget(b)}
                                onRejectClick={(b) => setRejectTarget(b)}
                                onUpdateCrewClick={(b) => setUpdateCrewTarget(b)}
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