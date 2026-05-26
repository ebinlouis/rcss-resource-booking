import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Clapperboard, Utensils } from "lucide-react"
import api from "../api/axios"
import { bookingSessionActions } from "../store/bookingSessionStore"

function LinkedBookingOptions({
  visible,
  startIso,
  endIso,
  completedBookings = [],
  onAddMess,
  onAddMedia,
}) {
  const [mediaCapacity, setMediaCapacity] = useState(null)
  const [isCheckingMedia, setIsCheckingMedia] = useState(false)

  useEffect(() => {
    if (!visible || !startIso || !endIso) {
      return undefined
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setMediaCapacity(null)
      bookingSessionActions.setMediaCapacity(null)
      setIsCheckingMedia(true)
      try {
        const response = await api.get("/media/bookings/team_capacity/", {
          params: { start: startIso, end: endIso },
        })
        if (cancelled) return
        setMediaCapacity(response.data)
        bookingSessionActions.setMediaCapacity(response.data)
      } catch (error) {
        if (cancelled) return
        setMediaCapacity(null)
        bookingSessionActions.setMediaCapacity(null)
        console.error("Media team capacity check failed:", error)
      } finally {
        if (!cancelled) setIsCheckingMedia(false)
      }
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [visible, startIso, endIso])

  if (!visible) return null

  const messDone = completedBookings.includes("mess")
  const mediaDone = completedBookings.includes("media")
  const mediaLimited = mediaCapacity?.limited_capacity

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-900">
            You can also book Food or Media for this event.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Finish the linked request, return here, and submit the venue request last.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onAddMess}
              className="flex items-center justify-between rounded-xl border border-amber-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-800 transition hover:border-amber-300 hover:bg-amber-50"
            >
              <span className="inline-flex items-center gap-2">
                <Utensils className="h-4 w-4 text-amber-600" />
                {messDone ? "Mess selected" : "Add Mess"}
              </span>
              {messDone && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            </button>

            <div>
              <button
                type="button"
                onClick={onAddMedia}
                className="flex w-full items-center justify-between rounded-xl border border-amber-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-800 transition hover:border-amber-300 hover:bg-amber-50"
              >
                <span className="inline-flex items-center gap-2">
                  <Clapperboard className="h-4 w-4 text-amber-600" />
                  {mediaDone ? "Media selected" : "Add Media"}
                </span>
                {mediaDone && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              </button>
              {isCheckingMedia && (
                <p className="mt-1.5 text-xs font-medium text-amber-700">
                  Checking media team capacity...
                </p>
              )}
              {!isCheckingMedia && mediaLimited && (
                <p className="mt-1.5 text-xs font-semibold text-amber-800">
                  Media team is at limited capacity for this slot.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LinkedBookingOptions
