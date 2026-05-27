import { useState, useEffect } from 'react'
import approvalService from '../api/approvalService'
import { useAuth } from '../hooks/useAuth'
import MainLayout from '../layouts/MainLayout'
import toast from 'react-hot-toast'
import { CheckCircle2, XCircle, Clock, ChevronDown, RefreshCw, User, Phone, Mail, Building2, Users, CalendarDays, FileText } from 'lucide-react'

const STATUS_META = {
  APPROVED:          { label: 'Approved',   cls: 'bg-green-100 text-green-700' },
  REJECTED:          { label: 'Rejected',   cls: 'bg-red-100 text-red-700' },
  FACULTY_ESCALATED: { label: 'Needs Higher Approval',  cls: 'bg-purple-100 text-purple-700' },
  CANCELLED:         { label: 'Cancelled',  cls: 'bg-gray-100 text-gray-500' },
}

const fmtDate = (s) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (s) => new Date(s).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })

/* ── Detail row ─────────────────────────────── */
function DetailRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-gray-400 text-xs uppercase tracking-wide font-semibold block leading-none mb-0.5">{label}</span>
        <span className="text-gray-800 font-medium leading-snug">{value}</span>
      </div>
    </div>
  )
}

/* ── Pending card ───────────────────────────── */
function PendingCard({ booking, onApprove, onReject, isActing }) {
  const [note, setNote]     = useState('')
  const [err,  setErr]      = useState('')
  const [open, setOpen]     = useState(true)

  const handleReject = () => {
    if (!note.trim() || note.trim().length < 10) {
      setErr('Please provide a short reason so the student understands why it was rejected.')
      return
    }
    setErr('')
    onReject(booking.id, note)
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{booking.space_details?.name || 'Venue Booking'}</h3>
          <p className="text-xs text-amber-700 font-semibold mt-0.5">Action Required</p>
        </div>
        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200 shrink-0">
          {fmtDate(booking.start_datetime)}
        </span>
        <button onClick={() => setOpen(v => !v)} className="p-1 text-gray-400 hover:text-gray-600 transition">
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="p-5 grid md:grid-cols-2 gap-6">
          {/* Left: details */}
          <div className="space-y-3.5">
            <DetailRow icon={User}       label="Student"    value={booking.booked_by_name} />
            <DetailRow icon={Mail}       label="Email"      value={booking.booked_by_email} />
            <DetailRow icon={Phone}      label="Phone"      value={booking.booked_by_phone} />
            <DetailRow icon={Building2}  label="Department" value={booking.booked_by_department} />
            <DetailRow icon={Users}      label="Attendees"  value={booking.attendee_count} />
            <DetailRow icon={CalendarDays} label="Date & Time" value={`${fmtDate(booking.start_datetime)} · ${fmtTime(booking.start_datetime)} – ${fmtTime(booking.end_datetime)}`} />
            <DetailRow icon={FileText}   label="Purpose"    value={booking.purpose_of_booking} />
            {booking.user_notes && (
              <DetailRow icon={FileText} label="Notes" value={booking.user_notes} />
            )}
          </div>

          {/* Right: actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => onApprove(booking.id)}
              disabled={isActing}
              className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 shadow-sm shadow-green-100"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isActing ? 'Please wait...' : 'Approve Request'}
            </button>

            <div className="relative">
              <textarea
                rows={3}
                placeholder="Tell the student why this booking is being rejected..."
                value={note}
                onChange={e => { setNote(e.target.value); setErr('') }}
                className={`w-full text-sm border rounded-xl p-3 resize-none outline-none transition ${err ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200' : 'border-gray-200 focus:ring-2 focus:ring-gray-200'}`}
              />
              {err && <p className="text-xs text-red-500 font-medium mt-1">{err}</p>}
            </div>

            <button
              onClick={handleReject}
              disabled={isActing}
              className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Reject Request
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── History row ────────────────────────────── */
function HistoryRow({ item }) {
  const meta = STATUS_META[item.status] || { label: item.status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <tr className="hover:bg-gray-50 transition">
      <td className="px-5 py-3.5 font-medium text-gray-900 text-sm">{item.space_details?.name || '—'}</td>
      <td className="px-5 py-3.5 text-sm">
        <p className="font-medium text-gray-800">{item.booked_by_name}</p>
        <p className="text-xs text-gray-400 mt-0.5">{item.booked_by_email}</p>
      </td>
      <td className="px-5 py-3.5 text-sm text-gray-600">{fmtDate(item.start_datetime)}</td>
      <td className="px-5 py-3.5">
        <span className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${meta.cls}`}>
          {meta.label}
        </span>
      </td>
    </tr>
  )
}

/* ── Main page ──────────────────────────────── */
export default function FacultyApprovalPage() {
  const { user }                          = useAuth()
  const [pending,  setPending]            = useState([])
  const [history,  setHistory]            = useState([])
  const [loading,  setLoading]            = useState(true)
  const [actingId, setActingId]           = useState(null)
  const [loadError, setLoadError]         = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await approvalService.fetchFacultyPending()
      setPending(data.pending || [])
      setHistory(data.history || [])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleApprove = async (id) => {
    setActingId(id)
    try {
      await approvalService.resolveFacultyBooking({ id, action: 'approve' })
      toast.success('Booking approved successfully!')
      await fetchData()
    } catch {
      toast.error('Couldn\'t approve the booking. Please try again.')
    } finally {
      setActingId(null)
    }
  }

  const handleReject = async (id, note) => {
    setActingId(id)
    try {
      await approvalService.resolveFacultyBooking({ id, action: 'reject', rejectionNote: note })
      toast.error('Booking request rejected.')
      await fetchData()
    } catch {
      toast.error('Couldn\'t reject the booking. Please try again.')
    } finally {
      setActingId(null)
    }
  }

  if (!user?.capabilities?.can_approve_faculty) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Access Denied</p>
            <p className="text-xs text-gray-400 mt-1">Only authorised faculty members can view this page.</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Faculty Approvals</h1>
            <p className="text-sm text-gray-400 mt-1">Review student booking requests that need your approval.</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pending',  value: pending.length,  icon: Clock,         cls: 'text-amber-600 bg-amber-50'  },
            { label: 'Approved', value: history.filter(h => h.status === 'APPROVED').length, icon: CheckCircle2, cls: 'text-green-700 bg-green-50' },
            { label: 'Rejected', value: history.filter(h => h.status === 'REJECTED').length, icon: XCircle,      cls: 'text-red-600 bg-red-50'    },
          ].map(({ label, value, icon: Icon, cls }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cls}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 leading-none">{loading ? '—' : value}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Error */}
        {loadError && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 text-sm text-red-600 font-medium">
            Couldn't load booking requests. Please try again.
          </div>
        )}

        {/* Pending section */}
        {!loadError && (
          <section>
            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Waiting for Your Approval
              {pending.length > 0 && (
                <span className="ml-1 text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{pending.length}</span>
              )}
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[1,2].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}
              </div>
            ) : pending.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-600">No pending requests</p>
                <p className="text-xs text-gray-400 mt-1">No pending requests at the moment.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pending.map(b => (
                  <PendingCard
                    key={b.id}
                    booking={b}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    isActing={actingId === b.id}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* History section */}
        {!loadError && !loading && history.length > 0 && (
          <section>
            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Approvals History
            </h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Venue', 'Student', 'Date', 'Status'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {history.map(item => <HistoryRow key={item.id} item={item} />)}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>
    </MainLayout>
  )
}