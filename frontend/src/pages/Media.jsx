import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ChevronRight,
  Clapperboard,
  Package,
  Plus,
  RefreshCcw,
  Search,
  Clock,
} from "lucide-react"
import MainLayout from "../layouts/MainLayout"
import MediaBookingModal from "../components/MediaBookingModal"
import mediaApi from "../api/mediaApi"

const todayKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)
  return todayKeyFromDate(date)
}

const formatDate = (dateString, options = {}) => {
  if (!dateString) return "TBD"
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-IN", options)
}

const formatTime = (timeString) => {
  if (!timeString) return "TBD"
  const [hours, minutes] = timeString.split(":")
  const date = new Date()
  date.setHours(Number(hours), Number(minutes), 0, 0)
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
}

const statusClass = {
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
}

function StatusBadge({ status }) {
  return (
    <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusClass[status] ?? statusClass.PENDING}`}>
      {status}
    </span>
  )
}

function RecentRequestCard({ booking }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-gray-900">{booking.event_name || "Media request"}</p>
          <p className="mt-0.5 truncate text-[12.5px] text-gray-500">{booking.space_details?.name || "Any suitable space"}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <p className="text-[12px] font-medium text-gray-500">
        {formatDate(booking.booking_date, { day: "numeric", month: "short", year: "numeric" })}
        {" · "}
        {formatTime(booking.setup_start_time)} - {formatTime(booking.teardown_end_time)}
      </p>
    </div>
  )
}

function AvailabilityRow({ item }) {
  const total = item.total_owned || 0
  const available = item.available_quantity || 0
  const percent = total > 0 ? Math.max(0, Math.min(100, (available / total) * 100)) : 0
  const lowStock = total > 0 && available / total <= 0.3
  const out = total > 0 && available === 0

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-gray-900">{item.name}</p>
          <p className="mt-0.5 text-[12.5px] font-medium text-gray-500">{item.category_display || item.category || "Equipment"}</p>
        </div>
        <div className="text-right">
          <p className={`text-[15px] font-bold ${out ? "text-red-600" : lowStock ? "text-amber-600" : "text-emerald-700"}`}>
            {available}/{total}
          </p>
          <p className="text-[11.5px] font-medium text-gray-400">available</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${out ? "bg-red-500" : lowStock ? "bg-amber-500" : "bg-emerald-600"}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {item.booked_slots && item.booked_slots.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Reserved Timeslots</p>
          <div className="space-y-1.5">
            {item.booked_slots.map((slot, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-[12px]">
                <span className="font-semibold text-gray-700">
                  {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                </span>
                <span className="max-w-[140px] truncate font-medium text-gray-500" title={slot.event_name}>
                  {slot.quantity}x · {slot.event_name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TeamFluidView({ teamData }) {
  if (!teamData) return null;

  const { max_capacity, booked_slots, fully_booked_periods } = teamData;

  if (!booked_slots || booked_slots.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-10 text-center md:col-span-2">
        <Clapperboard className="mx-auto mb-3 h-8 w-8 text-emerald-300" />
        <p className="text-[15px] font-bold text-emerald-800">Media Team is fully available</p>
        <p className="mt-1 text-[13px] text-emerald-600">
          No events scheduled for this day yet. They can handle up to {max_capacity} simultaneous events.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:col-span-2">
      {/* Overview Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white border border-gray-200 px-5 py-4 shadow-sm">
        <div>
          <p className="text-[14px] font-bold text-gray-900">Team Capacity Status</p>
          <p className="text-[13px] text-gray-500 mt-0.5">
            The team can handle <span className="font-bold text-gray-700">{max_capacity} events</span> at the exact same time.
          </p>
        </div>
        {fully_booked_periods?.length === 0 && (
           <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[12px] font-bold">Capacity Available</span>
        )}
      </div>

      {/* Fully Booked Warning */}
      {fully_booked_periods?.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <p className="text-[14px] font-bold text-red-800 mb-2 flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse"></span>
            No Capacity During These Times
          </p>
          <p className="text-[13px] text-red-600 mb-3">
            The media team has hit their limit of {max_capacity} simultaneous events during these specific windows:
          </p>
          <ul className="space-y-1.5">
             {fully_booked_periods.map((period, i) => (
                <li key={i} className="text-[13.5px] font-bold text-red-900 bg-red-100/50 w-fit px-3 py-1 rounded-md">
                   {formatTime(period.start)} - {formatTime(period.end)}
                </li>
             ))}
          </ul>
        </div>
      )}

      {/* Scheduled Commitments List */}
      <div>
        <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-3">Today's Detailed Commitments</p>
        <div className="grid gap-3 md:grid-cols-2">
          {booked_slots.map((slot, i) => (
             <div key={i} className="flex flex-col justify-center rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
                <p className="text-[14.5px] font-bold text-gray-900 mb-1">{slot.event_name}</p>
                <div className="flex items-center gap-2 text-[13.5px] font-semibold text-emerald-700 bg-emerald-50 w-fit px-2.5 py-1 rounded-lg">
                   <Clock className="h-3.5 w-3.5" />
                   {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                </div>
                <p className="text-[11.5px] font-medium text-gray-400 mt-2">
                   *Time block includes required setup & teardown
                </p>
             </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Media() {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [availability, setAvailability] = useState([])
  const [teamData, setTeamData] = useState(null)
  const [availabilityLoading, setAvailabilityLoading] = useState(true)
  const [availabilityError, setAvailabilityError] = useState("")
  const [availabilityType, setAvailabilityType] = useState("equipment")
  const [myBookings, setMyBookings] = useState([])
  const [myLoading, setMyLoading] = useState(true)
  const [openCreate, setOpenCreate] = useState(false)
  const [search, setSearch] = useState("")

  const weekDates = useMemo(() => {
    const base = new Date(`${selectedDate}T00:00:00`)
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(base)
      day.setDate(base.getDate() + index)
      return todayKeyFromDate(day)
    })
  }, [selectedDate])

  const canGoPrevious = addDays(selectedDate, -7) >= todayKey()

  const filteredAvailability = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return availability
    return availability.filter((item) => {
      const name = item.name?.toLowerCase() || ""
      const category = item.category_display?.toLowerCase() || item.category?.toLowerCase() || ""
      return name.includes(q) || category.includes(q)
    })
  }, [availability, search])

  const recentBookings = myBookings.slice(0, 3)

  async function refreshMyBookings() {
    setMyLoading(true)
    try {
      const data = await mediaApi.getMyBookings()
      setMyBookings(data)
    } catch (error) {
      console.error("Failed to load media requests:", error)
    } finally {
      setMyLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    const loadAvailability = async () => {
      await Promise.resolve()
      if (!active) return
      setAvailabilityLoading(true)
      setAvailabilityError("")
      try {
        const data = await mediaApi.getDailyAvailability(selectedDate, availabilityType)
        if (!active) return
        
        if (availabilityType === "team") {
          setTeamData(data)
        } else {
          setAvailability(data.items ?? [])
        }
      } catch (error) {
        console.error("Failed to load media availability:", error)
        if (active) setAvailabilityError("Could not load availability.")
      } finally {
        if (active) setAvailabilityLoading(false)
      }
    }

    loadAvailability()
    return () => {
      active = false
    }
  }, [selectedDate, availabilityType])

  useEffect(() => {
    let active = true

    const loadBookings = async () => {
      await Promise.resolve()
      if (!active) return
      setMyLoading(true)
      try {
        const data = await mediaApi.getMyBookings()
        if (active) setMyBookings(data)
      } catch (error) {
        console.error("Failed to load media requests:", error)
      } finally {
        if (active) setMyLoading(false)
      }
    }

    loadBookings()
    return () => {
      active = false
    }
  }, [])

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-[1280px]">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-gray-500">Media & Equipment</p>
            <h1 className="text-[28px] font-bold leading-none tracking-tight text-gray-900">Media Booking</h1>
            <p className="mt-2 text-[15px] text-gray-600">Check equipment availability before sending a request.</p>
          </div>
          <button
            onClick={() => setOpenCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            Book Media
          </button>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,0.9fr)]">
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    {availabilityType === "equipment" ? (
                      <Package className="h-5 w-5 text-emerald-700" />
                    ) : (
                      <Clapperboard className="h-5 w-5 text-emerald-700" />
                    )}
                    <h2 className="text-[18px] font-bold text-gray-900">System-Wide Availability</h2>
                  </div>
                  <p className="mt-1 text-[13.5px] text-gray-500">
                    {availabilityType === "equipment" ? "Inventory counts" : "Media team coverage"} for {formatDate(selectedDate, { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-[14px] font-medium text-gray-700 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50"
                />
              </div>

              <div className="mt-5 flex items-center gap-2">
                <button
                  onClick={() => setSelectedDate(addDays(selectedDate, -7))}
                  disabled={!canGoPrevious}
                  className="flex h-[58px] w-10 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-35"
                  title="Previous 7 days"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
                {weekDates.map((date) => (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`min-w-[86px] rounded-xl border px-3 py-2 text-left transition ${
                      selectedDate === date
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wide">
                      {formatDate(date, { weekday: "short" })}
                    </p>
                    <p className="mt-0.5 text-[14px] font-semibold">{formatDate(date, { day: "numeric", month: "short" })}</p>
                  </button>
                ))}
                </div>

                <button
                  onClick={() => setSelectedDate(addDays(selectedDate, 7))}
                  className="flex h-[58px] w-10 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-500 transition hover:bg-gray-50"
                  title="Next 7 days"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="border-b border-gray-100 bg-gray-50/70 px-6 py-4">
              <div className="mb-4 flex w-fit rounded-xl bg-white p-1 shadow-sm ring-1 ring-gray-100">
                {[
                  { id: "equipment", label: "Equipment Inventory", icon: Package },
                  { id: "team", label: "Media Team Coverage", icon: Clapperboard },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => setAvailabilityType(item.id)}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-bold transition ${
                        availabilityType === item.id
                          ? "bg-emerald-700 text-white"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  )
                })}
              </div>

              {availabilityType === "equipment" && (
                <div className="relative max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Filter equipment..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-[14px] outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50"
                />
                </div>
              )}
            </div>

            <div className={`grid gap-3 p-6 md:grid-cols-2`}>
              {availabilityLoading ? (
                Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="h-[104px] animate-pulse rounded-xl bg-gray-50" />
                ))
              ) : availabilityError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-700 md:col-span-2">
                  {availabilityError}
                </div>
              ) : availabilityType === "team" ? (
                <TeamFluidView teamData={teamData} />
              ) : filteredAvailability.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center md:col-span-2">
                  <p className="text-[14px] font-semibold text-gray-700">No equipment found</p>
                  <p className="mt-1 text-[13px] text-gray-500">Try a different search term.</p>
                </div>
              ) : (
                filteredAvailability.map((item) => <AvailabilityRow key={item.id} item={item} />)
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-bold text-gray-900">My Requests</h2>
                <p className="mt-0.5 text-[13px] text-gray-500">Latest 3 media requests</p>
              </div>
              <CalendarDays className="h-5 w-5 text-gray-400" />
            </div>

            {myLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-[86px] animate-pulse rounded-xl bg-gray-50" />
                ))}
              </div>
            ) : recentBookings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
                <Clapperboard className="mx-auto mb-3 h-6 w-6 text-gray-300" />
                <p className="text-[14px] font-semibold text-gray-700">No media requests yet</p>
                <p className="mt-1 text-[13px] text-gray-500">Your requests will show up here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentBookings.map((booking) => (
                  <RecentRequestCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}

            <button
              onClick={() => navigate("/media/my-bookings")}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-emerald-800"
            >
              View all bookings
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={refreshMyBookings}
              disabled={myLoading}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[14px] font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
            >
              <RefreshCcw className={`h-4 w-4 ${myLoading ? "animate-spin" : ""}`} />
              Refresh requests
            </button>
          </aside>
        </div>
      </div>

      {openCreate && (
        <MediaBookingModal
          onClose={() => setOpenCreate(false)}
          onSuccess={() => {
            setOpenCreate(false)
            refreshMyBookings()
          }}
        />
      )}
    </MainLayout>
  )
}

function todayKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export default Media