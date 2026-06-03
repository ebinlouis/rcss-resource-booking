import { useState, useEffect, useMemo, useCallback } from "react"
import { useAuth } from "../hooks/useAuth";
import RoomCard from "../components/RoomCard"
import TodayBookings from "../components/TodayBookings"
import AvailabilityModal from "../components/AvailabilityModal"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import MainLayout from "../layouts/MainLayout"
import { bookingSessionActions, useBookingSession } from "../store/bookingSessionStore"

import api from "../api/axios"
import { useSpaceCatalog, useMySpaceBookings } from "../hooks/useSpaceQueries"

const FILTERS = ["All", "Halls", "Labs", "Open Areas"]

const STATUS_STYLES = {
  APPROVED: "bg-green-100 text-green-700",
  CONFIRMED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  PENDING:  "bg-yellow-100 text-yellow-700",
  AWAITING_FACULTY: "bg-blue-100 text-blue-700",
  FACULTY_ESCALATED: "bg-purple-100 text-purple-700",
}

const STATUS_LABELS = {
  AWAITING_FACULTY: "Faculty Approval Pending",
  FACULTY_ESCALATED: "Final Approval Pending",
  REJECTED: "Rejected",
  CONFIRMED: "Approved",
  APPROVED: "Approved",
}

function Home() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const [searchParams] = useSearchParams()
  const bookingSession = useBookingSession()
  const shouldResumeSpace = searchParams.get("resumeSpace") === "1"
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState("All")

  // null = closed. { room } = open for that room.
  const [availabilityTarget, setAvailabilityTarget] = useState(null)

  const { data: dbRoomsData, isLoading } = useSpaceCatalog();
  const { data: myBookingsData, isLoading: isLoadingMyBookings } = useMySpaceBookings();

  const dbRooms = dbRoomsData || [];
  const myBookings = myBookingsData || [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("resumeSpace") !== "1") {
      bookingSessionActions.clearSession()
    }
  }, [])

  useEffect(() => {
    if (shouldResumeSpace && bookingSession.spaceFormData?.space && dbRooms.length > 0) {
      const draftSpaceId = bookingSession.spaceFormData.space
      const room = dbRooms.find(
        (item) => String(item.id) === String(draftSpaceId)
      )
      if (room && !availabilityTarget) {
        setAvailabilityTarget(room)
      }
    }
  }, [shouldResumeSpace, bookingSession.spaceFormData?.space, dbRooms, availabilityTarget])

  const handleEditBooking = (booking) => {
    const room = dbRooms.find(
      (r) => r.name.toLowerCase() === booking.hall.toLowerCase()
    )
    setAvailabilityTarget(room || { name: booking.hall })
  }

  const filteredRooms = useMemo(() => {
    return (dbRooms || []).filter((r) => {
      const roomType = String(
        r.space_type || r.type || r.category || ""
      ).toLowerCase()

      const matchesSearch =
        (r.name || "").toLowerCase().includes(search.toLowerCase()) ||
        roomType.includes(search.toLowerCase())

      const matchesFilter =
        activeFilter === "All" ||
        (activeFilter === "Halls" && roomType.includes("hall")) ||
        (activeFilter === "Labs" && roomType.includes("lab")) ||
        (activeFilter === "Open Areas" &&
          (roomType.includes("open") || roomType.includes("outdoor")))

      return matchesSearch && matchesFilter
    })
  }, [dbRooms, search, activeFilter])

  const approvedRequests = useMemo(() => {
    return myBookings.filter(
      (booking) => booking.status === "APPROVED"
    ).length
  }, [myBookings])

  const handleOpenAvailability = useCallback((room) => {
    setAvailabilityTarget(room)
  }, [])

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  const handleLinkedIntent = (target) => {
    const sequence = ["space"]
    if (target === "mess" || bookingSession.messFormData) sequence.push("mess")
    if (target === "media" || bookingSession.mediaFormData) sequence.push("media")
    sequence.push("review")

    bookingSessionActions.startWizard({
      origin: `${location.pathname}${location.search}`,
      sequence,
      initialStep: target,
    })
    setAvailabilityTarget(null)
  }

  return (
    <MainLayout>

      {/* Welcome */}
      <div className="relative overflow-hidden rounded-[32px] p-5 text-white shadow-[0_20px_60px_rgba(16,185,129,0.35)]">
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{ backgroundImage: "url('/Rectangle.png')" }}
        />
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div>
            <h1 className="mt-3 text-4xl text-white lg:text-5xl font-bold tracking-tight drop-shadow-lg">
              {user ? `${greeting}, ${user.name}` : "Welcome"}
            </h1>
            <p className="mt-4 ml-5 text-[12px] font-medium uppercase tracking-[0.25em] text-white/80">
              Resource Booking made simple
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 min-w-[260px]">
            {user ? (
              <>
                <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 px-6 py-4 min-w-[110px] shadow-lg">
                  <div className="flex flex-col h-full">
                    <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
                      Approved
                    </p>
                    <div className="flex-1 flex items-center justify-center">
                      <h2 className="text-4xl font-bold leading-none text-white">
                        {approvedRequests}
                      </h2>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 px-6 py-4 min-w-[110px] shadow-lg">
                  <div className="flex flex-col h-full">
                    <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
                      My Requests
                    </p>
                    <div className="flex-1 flex items-center justify-center">
                      <h2 className="text-4xl font-bold leading-none text-white">
                        {myBookings?.length || 0}
                      </h2>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-2 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 px-6 py-4 shadow-lg flex flex-col items-center justify-center gap-2">
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Available Venues</p>
                <h2 className="text-4xl font-bold leading-none text-white">{dbRooms?.length || 0}</h2>
                <button
                  onClick={() => navigate("/login", { state: { from: location.pathname } })}
                  className="mt-1 text-xs font-semibold text-white/80 hover:text-white underline underline-offset-2 transition"
                >
                  Sign in to book →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch mt-6">
        <div className="relative lg:col-span-2">
          <TodayBookings onEditBooking={handleEditBooking} />
        </div>

        <div className="lg:col-span-1 lg:mt-4">
          {user ? (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">My Requests</h2>
                {myBookings.length > 0 && (
                  <span className="text-xs text-gray-400 font-medium">
                    {myBookings.length} total
                  </span>
                )}
              </div>

              {isLoadingMyBookings ? (
                <div className="space-y-2.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-[68px] bg-gray-50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : myBookings.length === 0 ? (
                <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <svg className="w-6 h-6 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm text-gray-500 font-medium">No requests yet</p>
                  <p className="text-xs text-gray-400 mt-0.5">Your bookings will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myBookings.slice(0, 3).map((booking) => (
                    <div
                      key={booking.id}
                      className="p-3 bg-gray-50 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-gray-800 leading-tight truncate flex-1">
                          {booking.space_details?.name || "Unknown Space"}
                        </h3>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 ${STATUS_STYLES[booking.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[booking.status] || booking.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mb-1.5">
                        {booking.purpose_of_booking}
                      </p>
                      <p className="text-[11px] text-gray-400 font-medium">
                        {new Date(booking.start_datetime).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <button
  onClick={() => {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } })
      return
    }
    navigate("/my-bookings")
  }}
                className="mt-4 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-green-600 border border-green-100 hover:bg-green-700 rounded-lg transition"
              >
                View all bookings
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ) : (
            /* Guest CTA — prompt to sign in */
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 sticky top-6 flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Sign in to book venues</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Browse the calendar freely. Sign in when you're ready to make a booking request.
                </p>
              </div>
              <button
                onClick={() => navigate("/login", { state: { from: location.pathname } })}
                className="w-full py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Bookable Venues</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Browse available halls, labs, and meeting venues for your next booking
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeFilter === f
                    ? "bg-green-700 text-white shadow-sm"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search venues"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-10 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700 placeholder:text-gray-400 shadow-sm transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[220px] bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onOpenAvailability={handleOpenAvailability}
              />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-gray-200 rounded-xl bg-white px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-600">No venues match your search</p>
            <p className="text-xs text-gray-400 mt-1">Try a different name or filter</p>
          </div>
        )}
      </div>

      {availabilityTarget && (
        <AvailabilityModal
          spaceId={availabilityTarget.id}
          spaceName={availabilityTarget.name}
          openBookingOnMount={
            shouldResumeSpace &&
            Boolean(bookingSession.spaceFormData?.space) &&
            String(bookingSession.spaceFormData?.space) === String(availabilityTarget.id)
          }
          onClose={() => setAvailabilityTarget(null)}
          onLinkedIntent={handleLinkedIntent}
          initialDate={
            shouldResumeSpace &&
            Boolean(bookingSession.spaceFormData?.space) &&
            String(bookingSession.spaceFormData?.space) === String(availabilityTarget.id)
              ? bookingSession.spaceFormData?.start_date
              : null
          }
        />
      )}

    </MainLayout>
  )
}

export default Home