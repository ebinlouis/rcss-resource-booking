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
  ArrowRight, ChevronRight, Clock, CalendarDays,
  Home as HomeIcon,
} from "lucide-react"

// ─── constants ────────────────────────────────────────────────────────────────

const PENDING_STATUSES  = ["PENDING", "AWAITING_FACULTY", "FACULTY_ESCALATED"]
const ACTIVE_STATUSES   = ["APPROVED", "CONFIRMED", "ACTIVE"]
const REJECTED_STATUSES = ["REJECTED", "DECLINED", "FACULTY_REJECTED", "CANCELLED"]

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
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
function statusMeta(status) {
  if (ACTIVE_STATUSES.includes(status))   return { dot: "bg-green-500", badge: "bg-green-50 text-green-700",  label: "Approved"  }
  if (PENDING_STATUSES.includes(status))  return { dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700",  label: "Pending"   }
  if (REJECTED_STATUSES.includes(status)) return { dot: "bg-red-400",   badge: "bg-red-50 text-red-600",      label: "Rejected"  }
  if (status === "COMPLETED")             return { dot: "bg-gray-300",  badge: "bg-gray-50 text-gray-500",    label: "Completed" }
  return                                         { dot: "bg-gray-300",  badge: "bg-gray-50 text-gray-500",    label: status || "—" }
}

// ─── ModuleCard ───────────────────────────────────────────────────────────────

function ModuleCard({ icon: Icon, label, sublabel, description, path, gradient, iconBg, iconColor, pendingCount, activeCount, loading, onNavigate }) {
  return (
    <button
      onClick={() => onNavigate(path)}
      className="group w-full text-left bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
    >
      <div className={`h-1 w-full bg-gradient-to-r ${gradient}`} />
      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 rounded-2xl ${iconBg} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all mt-1" />
        </div>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${iconColor} mb-0.5`}>{sublabel}</p>
        <h3 className="text-[16px] font-bold text-gray-900 group-hover:text-green-700 transition-colors mb-1.5">{label}</h3>
        <p className="text-[12px] text-gray-400 leading-relaxed line-clamp-2 hidden md:block">{description}</p>
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {loading ? (
            <span className="text-[11px] text-gray-300">Loading…</span>
          ) : (
            <>
              {activeCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-100 text-[11px] font-semibold text-green-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  {activeCount} active
                </span>
              )}
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-[11px] font-semibold text-amber-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {pendingCount} pending
                </span>
              )}
              {activeCount === 0 && pendingCount === 0 && (
                <span className="text-[11px] text-gray-300">No active requests</span>
              )}
            </>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, colorClass }) {
  return (
    <div className={`flex flex-col items-center justify-center px-5 py-4 rounded-2xl border ${colorClass}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{label}</span>
      <span className="text-[28px] font-bold leading-none">{value}</span>
    </div>
  )
}

// ─── main ─────────────────────────────────────────────────────────────────────

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

  // per-module counts
  const stats = useMemo(() => {
    const now = new Date()
    const cnt = (list, fn) => list.filter(fn).length
    return {
      space: {
        pending: cnt(spaceBooks, b => PENDING_STATUSES.includes(b.status)),
        active:  cnt(spaceBooks, b => ACTIVE_STATUSES.includes(b.status) && new Date(b.end_datetime) > now),
      },
      fleet: {
        pending: cnt(fleetBooks, b => PENDING_STATUSES.includes(b.status)),
        active:  cnt(fleetBooks, b => ACTIVE_STATUSES.includes(b.status)),
      },
      media: {
        pending: cnt(mediaBooks, b => PENDING_STATUSES.includes(b.status)),
        active:  cnt(mediaBooks, b => ACTIVE_STATUSES.includes(b.status)),
      },
      mess: {
        pending: cnt(messBooks, b => PENDING_STATUSES.includes(b.status)),
        active:  cnt(messBooks, b => ACTIVE_STATUSES.includes(b.status)),
      },
    }
  }, [spaceBooks, fleetBooks, mediaBooks, messBooks])

  const totalPending = stats.space.pending + stats.fleet.pending + stats.media.pending + stats.mess.pending
  const totalActive  = stats.space.active  + stats.fleet.active  + stats.media.active  + stats.mess.active

  // unified recent activity feed
  const recentActivity = useMemo(() => {
    const items = []
    spaceBooks.forEach(b => items.push({
      id: `space-${b.id}`, module: "Venues",
      title: b.space_details?.name || "Venue",
      subtitle: b.purpose_of_booking || "—",
      status: b.status,
      created: b.created_at || b.start_datetime,
      path: "/my-bookings",
    }))
    fleetBooks.forEach(b => items.push({
      id: `fleet-${b.id}`, module: "Transport",
      title: b.vehicle_details?.name || `Vehicle #${b.vehicle}`,
      subtitle: b.destination || b.purpose || "—",
      status: b.status,
      created: b.created_at || b.start_datetime,
      path: "/transport/my-bookings",
    }))
    mediaBooks.forEach(b => items.push({
      id: `media-${b.id}`, module: "Media",
      title: b.event_name || "Media Support",
      subtitle: fmtDate(b.event_start_datetime || b.setup_start_datetime),
      status: b.status,
      created: b.created_at || b.event_start_datetime || b.setup_start_datetime,
      path: "/media/my-bookings",
    }))
    messBooks.forEach(b => items.push({
      id: `mess-${b.id}`, module: "Food",
      title: b.purpose_of_programme || "Catering Request",
      subtitle: b.start_date ? fmtDate(b.start_date) : "—",
      status: b.status,
      created: b.created_at || b.start_date,
      path: "/mess/my-bookings",
    }))
    return items.sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, 8)
  }, [spaceBooks, fleetBooks, mediaBooks, messBooks])

  // upcoming approved bookings in next 7 days
  const upcoming = useMemo(() => {
    const now  = new Date()
    const week = new Date(now.getTime() + 7 * 86400000)
    const items = []
    spaceBooks
      .filter(b => ACTIVE_STATUSES.includes(b.status) && b.start_datetime)
      .filter(b => { const d = new Date(b.start_datetime); return d >= now && d <= week })
      .forEach(b => items.push({ id: `space-${b.id}`, icon: Building2, iconBg: "bg-emerald-50", iconColor: "text-emerald-700", title: b.space_details?.name || "Venue", subtitle: b.purpose_of_booking || "—", date: b.start_datetime, path: "/my-bookings" }))
    fleetBooks
      .filter(b => ACTIVE_STATUSES.includes(b.status) && b.start_datetime)
      .filter(b => { const d = new Date(b.start_datetime); return d >= now && d <= week })
      .forEach(b => items.push({ id: `fleet-${b.id}`, icon: Bus, iconBg: "bg-sky-50", iconColor: "text-sky-700", title: b.vehicle_details?.name || "Vehicle", subtitle: b.destination || "—", date: b.start_datetime, path: "/transport/my-bookings" }))
    mediaBooks
      .filter(b => ACTIVE_STATUSES.includes(b.status))
      .filter(b => { const d = new Date(b.event_start_datetime || b.setup_start_datetime); return d >= now && d <= week })
      .forEach(b => items.push({ id: `media-${b.id}`, icon: Clapperboard, iconBg: "bg-violet-50", iconColor: "text-violet-700", title: b.event_name || "Media Support", subtitle: fmtDate(b.event_start_datetime || b.setup_start_datetime), date: b.event_start_datetime || b.setup_start_datetime, path: "/media/my-bookings" }))
    messBooks
      .filter(b => ACTIVE_STATUSES.includes(b.status) && b.start_date)
      .filter(b => { const d = new Date(b.start_date); return d >= now && d <= week })
      .forEach(b => items.push({ id: `mess-${b.id}`, icon: UtensilsCrossed, iconBg: "bg-orange-50", iconColor: "text-orange-700", title: b.purpose_of_programme || "Catering", subtitle: fmtDate(b.start_date), date: b.start_date, path: "/mess/my-bookings" }))
    return items.sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 5)
  }, [spaceBooks, fleetBooks, mediaBooks, messBooks])

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <div className="space-y-8">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-[28px] shadow-[0_16px_48px_rgba(16,185,129,0.22)]">
          <div className="absolute inset-0 bg-cover bg-center scale-105" style={{ backgroundImage: "url('/Rectangle.png')" }} />
          <div className="absolute inset-0 bg-gradient-to-br from-green-900/70 via-green-800/50 to-emerald-700/30" />
          <div className="relative z-10 px-6 py-9 md:px-10 md:py-11">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50 mb-3">Rajagiri College of Social Sciences</p>
                <h1 className="text-3xl md:text-[40px] font-bold text-white tracking-tight leading-[1.15]">
                  {user ? `${greeting},` : "Welcome to RCSS"}{user && <><br /><span className="text-emerald-300">{user.name.split(" ")[0]}</span></>}
                </h1>
                <p className="mt-3 text-[13px] text-white/55 max-w-sm leading-relaxed">
                  {user
                    ? "All your bookings, venues, transport, media, and food in one place."
                    : "Book college resources — venues, transport, media, and food."}
                </p>
                {!user && (
                  <button
                    onClick={() => navigate("/login", { state: { from: location.pathname } })}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-green-800 text-[13px] font-bold hover:bg-emerald-50 transition shadow-lg"
                  >
                    Sign in to book <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
              {user ? (
                <div className="flex flex-wrap gap-3 lg:shrink-0">
                  <StatCard label="Active"  value={anyLoading ? "—" : totalActive}  colorClass="bg-white/10 border-white/20 text-white" />
                  <StatCard label="Pending" value={anyLoading ? "—" : totalPending} colorClass="bg-amber-50/15 border-amber-300/20 text-white" />
                  <StatCard label="Venues"  value={dbRooms.length || "—"}           colorClass="bg-sky-50/10 border-sky-300/20 text-white" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 lg:shrink-0">
                  <StatCard label="Venues"   value={dbRooms.length || "—"} colorClass="bg-white/10 border-white/20 text-white" />
                  <StatCard label="Services" value="4"                      colorClass="bg-white/10 border-white/20 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── MODULE CARDS ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-[16px] font-bold text-gray-900 mb-1">Services</h2>
          <p className="text-[13px] text-gray-400 mb-4">Tap a service to browse or make a booking</p>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
            <ModuleCard
              icon={Building2} label="Venues" sublabel="Halls & Labs" description="Reserve seminar halls, labs, and open spaces for events and classes."
              path="/dashboard" gradient="from-emerald-500 to-green-700" iconBg="bg-emerald-50" iconColor="text-emerald-700"
              pendingCount={user ? stats.space.pending : 0} activeCount={user ? stats.space.active : 0} loading={user && loadingSpace} onNavigate={go}
            />
            <ModuleCard
              icon={Bus} label="Transport" sublabel="College vehicles" description="Request vehicles for official trips, field visits, and off-campus travel."
              path="/transport" gradient="from-sky-400 to-blue-600" iconBg="bg-sky-50" iconColor="text-sky-700"
              pendingCount={user ? stats.fleet.pending : 0} activeCount={user ? stats.fleet.active : 0} loading={user && loadingFleet} onNavigate={go}
            />
            <ModuleCard
              icon={Clapperboard} label="Media" sublabel="AV equipment" description="Book cameras, projectors, mics, and other AV equipment for your event."
              path="/media" gradient="from-violet-400 to-purple-600" iconBg="bg-violet-50" iconColor="text-violet-700"
              pendingCount={user ? stats.media.pending : 0} activeCount={user ? stats.media.active : 0} loading={user && loadingMedia} onNavigate={go}
            />
            <ModuleCard
              icon={UtensilsCrossed} label="Food" sublabel="Catering & mess" description="Arrange catering and refreshments for events and functions."
              path="/mess" gradient="from-orange-400 to-amber-500" iconBg="bg-orange-50" iconColor="text-orange-700"
              pendingCount={user ? stats.mess.pending : 0} activeCount={user ? stats.mess.active : 0} loading={user && loadingMess} onNavigate={go}
            />
          </div>
        </section>

        {/* ── UPCOMING + RECENT (logged in only) ───────────────────────── */}
        {user && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* upcoming this week */}
            <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-bold text-gray-900">Upcoming This Week</h2>
              </div>
              {anyLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}</div>
              ) : upcoming.length === 0 ? (
                <div className="py-8 flex flex-col items-center text-center gap-2">
                  <CalendarDays className="w-7 h-7 text-gray-200" />
                  <p className="text-[13px] text-gray-400 font-medium">Nothing scheduled this week</p>
                  <p className="text-[11px] text-gray-300">Approved bookings in the next 7 days appear here</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {upcoming.map(item => {
                    const Icon = item.icon
                    return (
                      <Link key={item.id} to={item.path} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group">
                        <div className={`w-8 h-8 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-4 h-4 ${item.iconColor}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-gray-800 truncate group-hover:text-green-700 transition-colors">{item.title}</p>
                          <p className="text-[11px] text-gray-400 truncate">{item.subtitle}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] font-semibold text-gray-600">{fmtDate(item.date)}</p>
                          <p className="text-[10px] text-gray-400">{fmtTime(item.date)}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* recent activity */}
            <div className="lg:col-span-3 bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-bold text-gray-900">Recent Activity</h2>
              </div>
              {anyLoading ? (
                <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />)}</div>
              ) : recentActivity.length === 0 ? (
                <div className="py-8 flex flex-col items-center text-center gap-2 flex-1">
                  <Clock className="w-7 h-7 text-gray-200" />
                  <p className="text-[13px] text-gray-400 font-medium">No bookings yet</p>
                  <p className="text-[11px] text-gray-300">All your requests across all services will appear here</p>
                </div>
              ) : (
                <div className="flex-1">
                  {recentActivity.map(item => {
                    const meta = statusMeta(item.status)
                    return (
                      <Link key={item.id} to={item.path} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/70 rounded-xl px-2 -mx-2 transition group">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <p className="text-[13px] font-semibold text-gray-800 truncate group-hover:text-green-700 transition-colors">{item.title}</p>
                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide shrink-0">{item.module}</span>
                          </div>
                          <p className="text-[11px] text-gray-400 truncate">{item.subtitle}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${meta.badge}`}>{meta.label}</span>
                          <span className="text-[10px] text-gray-300">{timeAgo(item.created)}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}

              {/* quick links to each module's history */}
              <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-4 gap-2">
                {[
                  { label: "Venues",    path: "/my-bookings",           c: "text-emerald-700 hover:bg-emerald-50 border-emerald-100" },
                  { label: "Transport", path: "/transport/my-bookings", c: "text-sky-700 hover:bg-sky-50 border-sky-100" },
                  { label: "Media",     path: "/media/my-bookings",     c: "text-violet-700 hover:bg-violet-50 border-violet-100" },
                  { label: "Food",      path: "/mess/my-bookings",      c: "text-orange-700 hover:bg-orange-50 border-orange-100" },
                ].map(({ label, path, c }) => (
                  <Link key={path} to={path} className={`flex items-center justify-center gap-0.5 py-2 rounded-xl border text-[12px] font-semibold transition ${c}`}>
                    {label} <ChevronRight className="w-3 h-3" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── GUEST CTA ────────────────────────────────────────────────── */}
        {!user && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <h3 className="text-[16px] font-bold text-gray-900 mb-1">Ready to book?</h3>
              <p className="text-[13px] text-gray-400 leading-relaxed max-w-md">
                Browse venue availability freely. Sign in to submit booking requests for venues, transport, media, and catering.
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link to="/dashboard" className="px-5 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-600 hover:bg-gray-50 transition">
                Browse Venues
              </Link>
              <button
                onClick={() => navigate("/login", { state: { from: location.pathname } })}
                className="px-5 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-[13px] font-bold transition shadow-sm"
              >
                Sign In
              </button>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  )
}

export default HomePage