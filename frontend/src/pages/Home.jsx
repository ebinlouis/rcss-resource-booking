import { useState, useEffect } from "react"
import { useAuth } from "../hooks/useAuth";
import RoomCard from "../components/RoomCard"
import TodayBookings from "../components/TodayBookings"
import AvailabilityModal from "../components/AvailabilityModal"
import { useNavigate, useSearchParams } from "react-router-dom"
import MainLayout from "../layouts/MainLayout"
import { bookingSessionActions, useBookingSession } from "../store/bookingSessionStore"

import api from "../api/axios"

const FILTERS = ["All", "Halls", "Labs", "Open Areas"]

const STATUS_STYLES = {
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  PENDING:  "bg-amber-100 text-amber-700",
}

function Home() {
  const [searchParams] = useSearchParams()
  const bookingSession = useBookingSession()
  const shouldResumeSpace = searchParams.get("resumeSpace") === "1"
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState("All")

  const [selectedRoom, setSelectedRoom] = useState(null)
  const [openAvailability, setOpenAvailability] = useState(false)

  const [dbRooms, setDbRooms] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const [myBookings, setMyBookings] = useState([])
  const [isLoadingMyBookings, setIsLoadingMyBookings] = useState(true)

  useEffect(() => {
    if (!shouldResumeSpace) bookingSessionActions.clearSession()
  }, [shouldResumeSpace])

  useEffect(() => {
    const fetchSpaces = async () => {
      try {
        const response = await api.get("/spaces/catalog/")
        const spaceData = response.data.results ?? response.data
        setDbRooms(spaceData || [])
      } catch (error) {
        console.error("Failed to fetch venues:", error)
        setDbRooms([])
      } finally {
        setIsLoading(false)
      }
    }

    const fetchMyBookings = async () => {
      try {
        const response = await api.get("/spaces/requests/?view=mine")
        const data = response.data.results ?? response.data ?? []
        setMyBookings(data)
      } catch (error) {
        console.error("Failed to fetch my bookings:", error)
      } finally {
        setIsLoadingMyBookings(false)
      }
    }

    fetchSpaces()
    fetchMyBookings()
  }, [])

  useEffect(() => {
    if (!shouldResumeSpace || isLoading || dbRooms.length === 0) return

    const draftSpaceId = bookingSession.spaceFormData?.space
    if (!draftSpaceId) return

    const room = dbRooms.find((item) => String(item.id) === String(draftSpaceId))
    if (!room) return

    setSelectedRoom(room)
    setOpenAvailability(true)
  }, [bookingSession.spaceFormData, dbRooms, isLoading, shouldResumeSpace])

  const handleEditBooking = (booking) => {
    const room = dbRooms.find(
      (r) => r.name.toLowerCase() === booking.hall.toLowerCase()
    )
    setSelectedRoom(room || { name: booking.hall })
    setOpenAvailability(true)
  }

const filteredRooms = dbRooms.filter((r) => {
  const roomType = (r.space_type || "").toLowerCase()

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

  const approvedRequests = myBookings.filter(
  (booking) => booking.status === "APPROVED"
).length

const auth = useAuth();
const user = auth?.user;
const navigate = useNavigate()
const hour = new Date().getHours()
const greeting =
  hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <MainLayout>

{/* Welcome */}
<div className="relative overflow-hidden rounded-[32px] p-5 text-white shadow-[0_20px_60px_rgba(16,185,129,0.35)]">

  {/* Background Image */}
  <div
    className="absolute inset-0 bg-cover bg-center scale-105"
    style={{
      backgroundImage: "url('/Rectangle.png')",
    }}
  />

  {/* Dark overlay */}
  <div className="absolute inset-0 bg-black/10" />

  {/* Grid pattern
  <div className="absolute inset-0 opacity-20">
    <div
      className="h-full w-full"
      style={{
        backgroundImage:
          "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    />
  </div> */}

  {/* Content */}
  <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">

    {/* Left side */}
    <div>
      <h1 className="mt-3 text-4xl text-white lg:text-5xl font-bold tracking-tight drop-shadow-lg">
        {greeting}, {user?.name || "User"}
      </h1>

      <p className="mt-4 ml-5 text-[12px] font-medium uppercase tracking-[0.25em] text-white/80">
        Resource Booking made simple
      </p>
    </div>

    {/* Right side mini cards */}
    <div className="grid grid-cols-2 gap-4 min-w-[260px]">

      {/* Spaces card */}
<div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 px-6 py-4 min-w-[110px] shadow-lg">

  <div className="flex flex-col h-full">

    {/* Label */}
    <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
      Approved Requests
    </p>

    {/* Number */}
  <div className="flex-1 flex items-center justify-center">
    <h2 className="text-4xl font-bold leading-none text-white">
      {approvedRequests}
    </h2>
  </div>

  </div>
</div>

      {/* Requests card */}
<div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 px-6 py-4 min-w-[110px] shadow-lg">

  <div className="flex flex-col h-full">

    {/* Label */}
    <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
      Total Requests
    </p>

    {/* Number */}
    <div className="flex-1 flex items-center justify-center">
    <h2 className="text-4xl font-bold leading-none text-white">
      {myBookings?.length || 0}
    </h2>
  </div>

  </div>
</div>

    </div>
  </div>
</div>

      {/* TOP SPLIT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

{/* LEFT: General campus activity feed */}
<div className="relative lg:col-span-2">
  <TodayBookings onEditBooking={handleEditBooking} />
</div>

        {/* RIGHT: This user's own requests — max 3 shown */}
        <div className="lg:col-span-1 lg:mt-4">
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
                {/* Only 3 max */}
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
                        {booking.status}
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
  onClick={() => navigate("/my-bookings")}
  className="mt-4 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-green-600 border border-green-100 hover:bg-green-700 rounded-lg transition"
>
  View all bookings

  <svg
    className="w-3.5 h-3.5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 5l7 7-7 7"
    />
  </svg>

</button>

          </div>
        </div>

      </div>

      {/* SPACES SECTION */}
      <div className="mt-10">

        <div className="mb-5">
  <h2 className="text-lg font-semibold text-gray-900">
    Bookable Venues
  </h2>

  <p className="text-sm text-gray-400 mt-0.5">
    Browse available halls, labs, and meeting venues for your next booking
  </p>
</div>

        {/* Filters + Search */}
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

        {(search || activeFilter !== "All") && (
          <p className="text-xs text-gray-400 mb-4">
            {filteredRooms.length} venue{filteredRooms.length !== 1 ? "s" : ""} found
          </p>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-14">
            <p className="text-sm text-gray-500 font-medium animate-pulse">
              Loading venues from database...
            </p>
          </div>
        ) : filteredRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onOpenAvailability={() => {
                  setSelectedRoom(room)
                  setOpenAvailability(true)
                }}
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

      {openAvailability && selectedRoom && (
        <AvailabilityModal
          spaceId={selectedRoom.id}
          spaceName={selectedRoom.name}
          openBookingOnMount={Boolean(bookingSession.spaceFormData?.space)}
          onClose={() => setOpenAvailability(false)}
        />
      )}

    </MainLayout>
  )
}

export default Home
