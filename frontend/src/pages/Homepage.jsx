import { useMemo } from "react"
import { useAuth } from "../hooks/useAuth"
import { useNavigate, useLocation, Link } from "react-router-dom"
import MainLayout from "../layouts/MainLayout"
import { useSpaceCatalog, useMySpaceBookings } from "../hooks/useSpaceQueries"
import { useMyFleetBookings } from "../hooks/useFleetQueries"
import { useMyMediaBookings } from "../hooks/useMediaQueries"
import { useMyMessBookings } from "../hooks/useMessQueries"
import {
  Building2, Bus, Clapperboard, UtensilsCrossed,
  ChevronRight, CalendarDays, Clock, Plus,
  CheckCircle2, AlertCircle,
} from "lucide-react"

// ── constants ─────────────────────────────────────────────────────────────────

const PENDING_STATUSES  = ["PENDING", "AWAITING_FACULTY", "FACULTY_ESCALATED"]
const ACTIVE_STATUSES   = ["APPROVED", "CONFIRMED", "ACTIVE"]
const REJECTED_STATUSES = ["REJECTED", "DECLINED", "FACULTY_REJECTED", "CANCELLED"]

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}
function fmtTime(iso) {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
}
function timeAgo(iso) {
  if (!iso) return ""
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000))
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`
}

function statusStyle(status) {
  if (ACTIVE_STATUSES.includes(status))   return { badge: "bg-green-100 text-green-700",  dot: "bg-green-500",  label: "Approved"  }
  if (PENDING_STATUSES.includes(status))  return { badge: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-400", label: "Pending"   }
  if (REJECTED_STATUSES.includes(status)) return { badge: "bg-red-100 text-red-700",       dot: "bg-red-400",    label: "Rejected"  }
  if (status === "COMPLETED")             return { badge: "bg-blue-100 text-blue-700",     dot: "bg-blue-400",   label: "Completed" }
  return                                         { badge: "bg-gray-100 text-gray-600",     dot: "bg-gray-300",   label: status || "—" }
}

function StatusBadge({ status }) {
  const s = statusStyle(status)
  return (
    <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${s.badge}`}>
      {s.label}
    </span>
  )
}

// ── ServiceCard ───────────────────────────────────────────────────────────────
// Matches the exact card style used across Transport / Media / Mess pages:
// rounded-2xl border border-gray-100 bg-white shadow-sm

function ServiceCard({ icon: Icon, label, sublabel, path, pendingCount, activeCount, loading, onNavigate }) {
  return (
    <button
      onClick={() => onNavigate(path)}
      className="group w-full text-left rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-green-100 transition-all duration-150 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
    >
      {/* inner content matches px-6 py-5 from other pages */}
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <Icon className="w-5 h-5 text-green-700" />
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-600 group-hover:translate-x-0.5 transition-all" />
        </div>

        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-0.5">{sublabel}</p>
        <h3 className="text-base font-semibold text-gray-900 group-hover:text-green-700 transition-colors">{label}</h3>

        <div className="mt-4 flex items-center gap-2 flex-wrap min-h-[24px]">
          {loading ? (
            <span className="text-xs text-gray-300">Loading…</span>
          ) : (
            <>
              {activeCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-100 text-green-700 text-[11px] font-bold uppercase tracking-wide">
                  {activeCount} active
                </span>
              )}
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-yellow-100 text-yellow-700 text-[11px] font-bold uppercase tracking-wide">
                  {pendingCount} pending
                </span>
              )}
              {!loading && activeCount === 0 && pendingCount === 0 && (
                <span className="text-xs text-gray-300">No active requests</span>
              )}
            </>
          )}
        </div>
      </div>
    </button>
  )
}

// ── ActivityRow ───────────────────────────────────────────────────────────────

function ActivityRow({ title, subtitle, module, status, created, path }) {
  const s = statusStyle(status)
  return (
    <Link
      to={path}
      className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/70 transition cursor-pointer border-b border-gray-100 last:border-0"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-300 shrink-0">{module}</span>
        </div>
        <p className="text-sm text-gray-500 truncate mt-0.5">{subtitle}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <StatusBadge status={status} />
        {created && <span className="text-[11px] text-gray-400">{timeAgo(created)}</span>}
      </div>
    </Link>
  )
}

// ── UpcomingRow ───────────────────────────────────────────────────────────────

function UpcomingRow({ icon: Icon, title, subtitle, date, path }) {
  return (
    <Link
      to={path}
      className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/70 transition cursor-pointer border-b border-gray-100 last:border-0"
    >
      <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-green-700" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
        <p className="text-sm text-gray-500 truncate">{subtitle}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium text-gray-700">{fmtDate(date)}</p>
        <p className="text-xs text-gray-400">{fmtTime(date)}</p>
      </div>
    </Link>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

function HomePage() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()

  const go = (path) => {
    if (!user) { navigate("/login", { state: { from: path } }); return }
    navigate(path)
  }

  const { data: dbRoomsData }                              = useSpaceCatalog()
  const { data: spaceData,  isLoading: loadingSpace }      = useMySpaceBookings()
  const { data: fleetData,  isLoading: loadingFleet }      = useMyFleetBookings()
  const { data: mediaData,  isLoading: loadingMedia }      = useMyMediaBookings()
  const { data: messData,   isLoading: loadingMess }       = useMyMessBookings()

  const dbRooms    = dbRoomsData || []
  const spaceBooks = spaceData   || []
  const fleetBooks = fleetData   || []
  const mediaBooks = mediaData   || []
  const messBooks  = messData    || []

  const h = new Date().getHours()
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
  const anyLoading = loadingSpace || loadingFleet || loadingMedia || loadingMess

  // per-module stats
  const stats = useMemo(() => {
    const now = new Date()
    const n = (list, fn) => list.filter(fn).length
    return {
      space: {
        pending: n(spaceBooks, b => PENDING_STATUSES.includes(b.status)),
        active:  n(spaceBooks, b => ACTIVE_STATUSES.includes(b.status) && new Date(b.end_datetime) > now),
      },
      fleet: {
        pending: n(fleetBooks, b => PENDING_STATUSES.includes(b.status)),
        active:  n(fleetBooks, b => ACTIVE_STATUSES.includes(b.status)),
      },
      media: {
        pending: n(mediaBooks, b => PENDING_STATUSES.includes(b.status)),
        active:  n(mediaBooks, b => ACTIVE_STATUSES.includes(b.status)),
      },
      mess: {
        pending: n(messBooks, b => PENDING_STATUSES.includes(b.status)),
        active:  n(messBooks, b => ACTIVE_STATUSES.includes(b.status)),
      },
    }
  }, [spaceBooks, fleetBooks, mediaBooks, messBooks])

  const totalPending = stats.space.pending + stats.fleet.pending + stats.media.pending + stats.mess.pending
  const totalActive  = stats.space.active  + stats.fleet.active  + stats.media.active  + stats.mess.active

  // unified recent activity
  const recentActivity = useMemo(() => {
    const items = []
    spaceBooks.forEach(b => items.push({
      id: `space-${b.id}`, module: "Venues",
      title:    b.space_details?.name || "Venue",
      subtitle: b.purpose_of_booking || "—",
      status:   b.status,
      created:  b.created_at || b.start_datetime,
      path:     "/my-bookings",
    }))
    fleetBooks.forEach(b => items.push({
      id: `fleet-${b.id}`, module: "Transport",
      title:    b.vehicle_details?.name || `Vehicle #${b.vehicle}`,
      subtitle: b.destination ? `${b.pickup_location} → ${b.destination}` : b.purpose || "—",
      status:   b.status,
      created:  b.created_at || b.start_datetime,
      path:     "/transport/my-bookings",
    }))
    mediaBooks.forEach(b => items.push({
      id: `media-${b.id}`, module: "Media",
      title:    b.event_name || "Media Support",
      subtitle: fmtDate(b.event_start_datetime || b.setup_start_datetime),
      status:   b.status,
      created:  b.created_at || b.event_start_datetime,
      path:     "/media/my-bookings",
    }))
    messBooks.forEach(b => items.push({
      id: `mess-${b.id}`, module: "Food",
      title:    b.purpose_of_programme || "Catering Request",
      subtitle: b.start_date ? fmtDate(b.start_date) : "—",
      status:   b.status,
      created:  b.created_at || b.start_date,
      path:     "/mess/my-bookings",
    }))
    return items.sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, 8)
  }, [spaceBooks, fleetBooks, mediaBooks, messBooks])

  // upcoming approved in next 7 days
  const upcoming = useMemo(() => {
    const now  = new Date()
    const week = new Date(now.getTime() + 7 * 86400000)
    const items = []
    spaceBooks
      .filter(b => ACTIVE_STATUSES.includes(b.status) && b.start_datetime)
      .filter(b => { const d = new Date(b.start_datetime); return d >= now && d <= week })
      .forEach(b => items.push({ id: `space-${b.id}`, icon: Building2, title: b.space_details?.name || "Venue",     subtitle: b.purpose_of_booking || "—", date: b.start_datetime, path: "/my-bookings" }))
    fleetBooks
      .filter(b => ACTIVE_STATUSES.includes(b.status) && b.start_datetime)
      .filter(b => { const d = new Date(b.start_datetime); return d >= now && d <= week })
      .forEach(b => items.push({ id: `fleet-${b.id}`, icon: Bus,        title: b.vehicle_details?.name || "Vehicle", subtitle: b.destination || "—",          date: b.start_datetime, path: "/transport/my-bookings" }))
    mediaBooks
      .filter(b => ACTIVE_STATUSES.includes(b.status))
      .filter(b => { const d = new Date(b.event_start_datetime || b.setup_start_datetime); return d >= now && d <= week })
      .forEach(b => items.push({ id: `media-${b.id}`, icon: Clapperboard, title: b.event_name || "Media Support",  subtitle: "—",                             date: b.event_start_datetime || b.setup_start_datetime, path: "/media/my-bookings" }))
    messBooks
      .filter(b => ACTIVE_STATUSES.includes(b.status) && b.start_date)
      .filter(b => { const d = new Date(b.start_date); return d >= now && d <= week })
      .forEach(b => items.push({ id: `mess-${b.id}`,  icon: UtensilsCrossed, title: b.purpose_of_programme || "Catering", subtitle: fmtDate(b.start_date), date: b.start_date, path: "/mess/my-bookings" }))
    return items.sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 5)
  }, [spaceBooks, fleetBooks, mediaBooks, messBooks])

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-[1280px] space-y-6">

        {/* ── Header — identical pattern to Transport / Media / Mess ── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            {user && (
              <p className="text-sm text-gray-500 mb-1">{greeting}, <span className="font-semibold text-gray-700">{user.name}</span></p>
            )}
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600">
              {user
                ? "All your bookings across venues, transport, media, and food in one place."
                : "Book college resources — venues, transport, media, and food."}
            </p>
          </div>
          {!user && (
            <button
              onClick={() => navigate("/login", { state: { from: location.pathname } })}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
            >
              Sign In to Book
            </button>
          )}
        </div>

        {/* ── Summary stats row (logged in only) — same rounded-2xl border style ── */}
        {user && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Active Bookings",  value: anyLoading ? "—" : totalActive,       sub: "approved & upcoming" },
              { label: "Pending Requests", value: anyLoading ? "—" : totalPending,      sub: "awaiting approval"   },
              { label: "Venues Available", value: dbRooms.length || "—",                sub: "on campus"           },
            ].map(({ label, value, sub }) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-white shadow-sm px-6 py-5">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
                <p className="text-3xl font-bold tracking-tight text-gray-900">{value}</p>
                <p className="mt-1 text-sm text-gray-500">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Service cards — 4 equal columns, same card style as section cards ── */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-5">
            <h2 className="text-lg font-semibold text-gray-900">Services</h2>
            <p className="mt-1 text-sm text-gray-500">Select a service to view bookings or make a new request.</p>
          </div>
          <div className="p-5 grid grid-cols-2 xl:grid-cols-4 gap-4">
            <ServiceCard
              icon={Building2} label="Venues" sublabel="Halls & Labs"
              path="/dashboard"
              pendingCount={user ? stats.space.pending : 0}
              activeCount={user ? stats.space.active : 0}
              loading={user && loadingSpace}
              onNavigate={go}
            />
            <ServiceCard
              icon={Bus} label="Transport" sublabel="College vehicles"
              path="/transport"
              pendingCount={user ? stats.fleet.pending : 0}
              activeCount={user ? stats.fleet.active : 0}
              loading={user && loadingFleet}
              onNavigate={go}
            />
            <ServiceCard
              icon={Clapperboard} label="Media" sublabel="AV equipment"
              path="/media"
              pendingCount={user ? stats.media.pending : 0}
              activeCount={user ? stats.media.active : 0}
              loading={user && loadingMedia}
              onNavigate={go}
            />
            <ServiceCard
              icon={UtensilsCrossed} label="Food" sublabel="Catering & mess"
              path="/mess"
              pendingCount={user ? stats.mess.pending : 0}
              activeCount={user ? stats.mess.active : 0}
              loading={user && loadingMess}
              onNavigate={go}
            />
          </div>
        </section>

        {/* ── Two-column layout — same lg:grid-cols-3 pattern as Transport ── */}
        {user ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* Recent activity — lg:col-span-2 */}
            <section className="lg:col-span-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                  <p className="mt-1 text-sm text-gray-500">Your latest booking requests across all services.</p>
                </div>
              </div>

              {anyLoading ? (
                <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-gray-500">
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Loading activity…
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                    <Clock className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">No bookings yet</p>
                  <p className="mt-1 text-sm text-gray-500">Your requests across all services will appear here.</p>
                </div>
              ) : (
                <div>
                  {recentActivity.map(item => (
                    <ActivityRow key={item.id} {...item} />
                  ))}
                </div>
              )}

              {/* Footer quick links */}
              {recentActivity.length > 0 && (
                <div className="border-t border-gray-100 px-6 py-4 grid grid-cols-4 gap-2">
                  {[
                    { label: "Venues",    path: "/my-bookings"           },
                    { label: "Transport", path: "/transport/my-bookings" },
                    { label: "Media",     path: "/media/my-bookings"     },
                    { label: "Food",      path: "/mess/my-bookings"      },
                  ].map(({ label, path }) => (
                    <Link
                      key={path}
                      to={path}
                      className="flex items-center justify-center gap-1 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-green-50 hover:border-green-100 hover:text-green-700 transition"
                    >
                      {label} <ChevronRight className="w-3 h-3" />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Sidebar — lg:col-span-1, same style as TransportMyRequests sidebar */}
            <div className="lg:col-span-1 space-y-4">

              {/* Upcoming this week */}
              <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-6 py-5">
                  <h2 className="text-lg font-semibold text-gray-900">Upcoming This Week</h2>
                  <p className="mt-1 text-sm text-gray-500">Approved bookings in the next 7 days.</p>
                </div>

                {anyLoading ? (
                  <div className="flex items-center justify-center gap-2 px-6 py-8 text-sm text-gray-500">
                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Loading…
                  </div>
                ) : upcoming.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                      <CalendarDays className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Nothing this week</p>
                    <p className="mt-1 text-sm text-gray-500">Approved bookings in the next 7 days will appear here.</p>
                  </div>
                ) : (
                  <div>
                    {upcoming.map(item => (
                      <UpcomingRow key={item.id} {...item} />
                    ))}
                  </div>
                )}
              </section>

            </div>
          </div>
        ) : (
          /* Guest state — same empty-state style as other pages */
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="text-lg font-semibold text-gray-900">Your Bookings</h2>
              <p className="mt-1 text-sm text-gray-500">Sign in to view and manage all your booking requests.</p>
            </div>
            <div className="px-6 py-12 text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 mx-auto">
                <Building2 className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm text-gray-500 font-medium">Sign in to view your bookings across all services</p>
              <button
                onClick={() => navigate("/login", { state: { from: location.pathname } })}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-700 text-white text-xs font-semibold hover:bg-green-800 transition"
              >
                Sign In
              </button>
            </div>
          </section>
        )}

      </div>
    </MainLayout>
  )
}

export default HomePage