import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
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

const todayKeyFromDate = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)
  return todayKeyFromDate(date)
}

const formatDate = (dateString, options = {}) => {
  if (!dateString) return "TBD"

  const date = dateString.includes("T")
    ? new Date(dateString)
    : new Date(`${dateString}T00:00:00`)

  if (isNaN(date.getTime())) return "TBD"

  return date.toLocaleDateString("en-IN", options)
}

const formatTime = (timeString) => {
  if (!timeString) return "TBD"

  let date

  if (timeString.includes("T")) {
    date = new Date(timeString)
  } else {
    const [hours, minutes] = timeString.split(":")
    date = new Date()
    date.setHours(Number(hours), Number(minutes), 0, 0)
  }

  if (isNaN(date.getTime())) return "TBD"

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

const statusClass = {
  APPROVED: "bg-green-100 text-green-700 border-green-200",
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-600 border-gray-200",
}

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
        statusClass[status] ?? statusClass.PENDING
      }`}
    >
      {status}
    </span>
  )
}

function RecentRequestCard({ booking }) {
  const startDt =
    booking.setup_start_datetime || booking.event_start_datetime

  const endDt =
    booking.teardown_end_datetime || booking.event_end_datetime

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 hover:border-gray-200 transition">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {booking.event_name || "Media Request"}
          </p>

          <p className="mt-0.5 truncate text-xs text-gray-500">
            {booking.space_details?.name || "Venue not specified"}
          </p>
        </div>

        <StatusBadge status={booking.status} />
      </div>

      <p className="text-xs font-medium text-gray-500">
        {formatDate(startDt, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
        {" • "}
        {formatTime(startDt)} – {formatTime(endDt)}
      </p>
    </div>
  )
}

function AvailabilityRow({ item }) {
  const total = item.total_owned || 0
  const available = item.available_quantity || 0

  const percent =
    total > 0
      ? Math.max(0, Math.min(100, (available / total) * 100))
      : 0

  const lowStock = total > 0 && available / total <= 0.3
  const out = total > 0 && available === 0

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {item.name}
          </p>

          <p className="mt-1 text-xs font-medium text-gray-500">
            {item.category_display || item.category || "Equipment"}
          </p>
        </div>

        <div className="text-right">
          <p
            className={`text-sm font-bold ${
              out
                ? "text-red-600"
                : lowStock
                ? "text-amber-600"
                : "text-green-700"
            }`}
          >
            {available}/{total}
          </p>

          <p className="text-xs text-gray-400">
            available
          </p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${
            out
              ? "bg-red-500"
              : lowStock
              ? "bg-amber-500"
              : "bg-green-600"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {item.booked_slots && item.booked_slots.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
            Booked Time Slots
          </p>

          <div className="space-y-2">
            {item.booked_slots.map((slot, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs"
              >
                <span className="font-semibold text-gray-700">
                  {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                </span>

                <span
                  className="max-w-[140px] truncate text-gray-500"
                  title={slot.event_name}
                >
                  {slot.quantity}× {slot.event_name}
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
  if (!teamData) return null

  const { max_capacity, booked_slots, fully_booked_periods } = teamData

  if (!booked_slots || booked_slots.length === 0) {
    return (
      <div className="rounded-xl border border-green-100 bg-green-50 px-6 py-10 text-center md:col-span-2">
        <Clapperboard className="mx-auto mb-3 h-8 w-8 text-green-300" />

        <p className="text-sm font-bold text-green-800">
          Media team is fully available
        </p>

        <p className="mt-1 text-sm text-green-600">
          No bookings are scheduled for this day. The team can support up to{" "}
          {max_capacity} simultaneous events.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 md:col-span-2">

      {/* Capacity summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Team Availability Status
          </p>

          <p className="mt-1 text-sm text-gray-500">
            The media team can support{" "}
            <span className="font-semibold text-gray-700">
              {max_capacity} concurrent events
            </span>
            .
          </p>
        </div>

        {fully_booked_periods?.length === 0 && (
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
            Capacity Available
          </span>
        )}
      </div>

      {/* Fully booked warning */}
      {fully_booked_periods?.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-red-800">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
            Fully Booked Time Windows
          </p>

          <p className="mb-3 text-sm text-red-600">
            The media team has reached its capacity limit during these periods.
          </p>

          <div className="flex flex-wrap gap-2">
            {fully_booked_periods.map((period, i) => (
              <span
                key={i}
                className="rounded-lg bg-red-100 px-3 py-1 text-sm font-semibold text-red-800"
              >
                {formatTime(period.start)} – {formatTime(period.end)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Commitments */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
          Scheduled Commitments
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          {booked_slots.map((slot, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm hover:shadow-md transition"
            >
              <p className="text-sm font-semibold text-gray-900">
                {slot.event_name}
              </p>

              <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
                <Clock className="h-4 w-4" />
                {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
              </div>

              <p className="mt-3 text-xs text-gray-400">
                Includes setup and teardown time
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
  const [searchParams] = useSearchParams()
  const isLinkedFlow = searchParams.get("linked") === "1"
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
    const mediaGearOnly = availability.filter(
      (item) => item.is_standard_media_kit === true
    )

    const query = search.trim().toLowerCase()

    if (!query) return mediaGearOnly

    return mediaGearOnly.filter((item) => {
      const name = item.name?.toLowerCase() || ""
      const category =
        item.category_display?.toLowerCase() ||
        item.category?.toLowerCase() ||
        ""

      return name.includes(query) || category.includes(query)
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
        const data = await mediaApi.getDailyAvailability(
          selectedDate,
          availabilityType
        )

        if (!active) return

        if (availabilityType === "team") {
          setTeamData(data)
        } else {
          setAvailability(data.items ?? [])
        }
      } catch (error) {
        console.error("Failed to load media availability:", error)

        if (active) {
          setAvailabilityError("Could not load availability.")
        }
      } finally {
        if (active) {
          setAvailabilityLoading(false)
        }
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

        if (active) {
          setMyBookings(data)
        }
      } catch (error) {
        console.error("Failed to load media requests:", error)
      } finally {
        if (active) {
          setMyLoading(false)
        }
      }
    }

    loadBookings()

    return () => {
      active = false
    }
  }, [])

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-[1280px] space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
              Media Booking
            </h1>

            <p className="mt-2 text-sm text-gray-600">
              Check availability and request media team support or equipment for your event.
            </p>
          </div>

          <button
            onClick={() => setOpenCreate(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            Book Media
          </button>
        </div>

        {/* Main layout */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,0.9fr)]">

          {/* Main content */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">

            {/* Top controls */}
            <div className="border-b border-gray-100 px-6 py-5">

              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {availabilityType === "equipment" ? (
                      <Package className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clapperboard className="h-5 w-5 text-green-600" />
                    )}

                    <h2 className="text-lg font-semibold text-gray-900">
                      Availability Overview
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-gray-500">
                    {availabilityType === "equipment"
                      ? "Check equipment inventory"
                      : "Check media team availability"}{" "}
                    for{" "}
                    {formatDate(selectedDate, {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                />
              </div>

              {/* Week navigation */}
              <div className="mt-5 flex items-center gap-2">

                <button
                  onClick={() => setSelectedDate(addDays(selectedDate, -7))}
                  disabled={!canGoPrevious}
                  className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
                  {weekDates.map((date) => (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`min-w-[78px] rounded-xl border px-3 py-2 text-left transition ${
                        selectedDate === date
                          ? "border-green-200 bg-green-50 text-green-800"
                          : "border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wide">
                        {formatDate(date, { weekday: "short" })}
                      </p>

                      <p className="mt-1 text-sm font-semibold">
                        {formatDate(date, {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedDate(addDays(selectedDate, 7))}
                  className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tabs + Search */}
            <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">

              <div className="mb-4 flex w-fit rounded-xl bg-white p-1 shadow-sm border border-gray-100">
                {[
                  {
                    id: "team",
                    label: "Media Team",
                    icon: Clapperboard,
                  },
                  {
                    id: "equipment",
                    label: "Equipment",
                    icon: Package,
                  },
                ].map((item) => {
                  const Icon = item.icon

                  return (
                    <button
                      key={item.id}
                      onClick={() => setAvailabilityType(item.id)}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        availabilityType === item.id
                          ? "bg-green-600 text-white"
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
                    placeholder="Search cameras, microphones, lights..."
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              {availabilityLoading ? (
                Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    className="h-[120px] animate-pulse rounded-xl bg-gray-50"
                  />
                ))
              ) : availabilityError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-4 text-sm font-medium text-red-700 md:col-span-2">
                  {availabilityError}
                </div>
              ) : availabilityType === "team" ? (
                <TeamFluidView teamData={teamData} />
              ) : filteredAvailability.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center md:col-span-2">
                  <Package className="mx-auto mb-3 h-6 w-6 text-gray-300" />

                  <p className="text-sm font-semibold text-gray-700">
                    No equipment found
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Try searching with a different keyword.
                  </p>
                </div>
              ) : (
                filteredAvailability.map((item) => (
                  <AvailabilityRow key={item.id} item={item} />
                ))
              )}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:sticky lg:top-6">

            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  My Requests
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Your recent media bookings
                </p>
              </div>

              <CalendarDays className="h-5 w-5 text-gray-400" />
            </div>

            {myLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-[86px] animate-pulse rounded-xl bg-gray-50"
                  />
                ))}
              </div>
            ) : recentBookings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center">
                <Clapperboard className="mx-auto mb-3 h-6 w-6 text-gray-300" />

                <p className="text-sm font-semibold text-gray-700">
                  No media bookings yet
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Your booking requests will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentBookings.map((booking) => (
                  <RecentRequestCard
                    key={booking.id}
                    booking={booking}
                  />
                ))}
              </div>
            )}

            <button
              onClick={() => navigate("/media/my-bookings")}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              View All Bookings
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={refreshMyBookings}
              disabled={myLoading}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
            >
              <RefreshCcw
                className={`h-4 w-4 ${
                  myLoading ? "animate-spin" : ""
                }`}
              />
              Refresh Status
            </button>
          </aside>
        </div>
      </div>

      {openCreate && (
        <MediaBookingModal
          onClose={() => setOpenCreate(false)}
          onSuccess={() => {
            setOpenCreate(false)
            if (isLinkedFlow) {
              navigate("/dashboard?resumeSpace=1")
            } else {
              refreshMyBookings()
            }
          }}
        />
      )}
    </MainLayout>
  )
}

export default Media
