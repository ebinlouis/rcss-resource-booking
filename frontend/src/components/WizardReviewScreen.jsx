import {
  CheckCircle2,
  Clapperboard,
  DoorOpen,
  Loader2,
  Pencil,
  RotateCcw,
  Utensils,
  XCircle,
} from "lucide-react"

const serviceMeta = {
  space: { label: "Space", icon: DoorOpen },
  mess: { label: "Mess", icon: Utensils },
  media: { label: "Media", icon: Clapperboard },
}

const formatDate = (dateString) => {
  if (!dateString) return "Not set"
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const formatDateTime = (value) => {
  if (!value) return "Not set"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}

const formatTimeRange = (start, end) => `${start || "Not set"} - ${end || "Not set"}`

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-800">{value || "Not set"}</p>
    </div>
  )
}

function StatusBadge({ service, status, onRetry }) {
  if (!status || status === "idle") return null

  if (status === "submitting") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Submitting
      </span>
    )
  }

  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Success
      </span>
    )
  }

  if (status === "failed") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
          <XCircle className="h-3.5 w-3.5" />
          Failed
        </span>
        <button
          type="button"
          onClick={() => onRetry(service)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    )
  }

  return null
}

function ReviewCard({
  service,
  status,
  error,
  onEdit,
  onRetry,
  children,
}) {
  const meta = serviceMeta[service]
  const Icon = meta.icon
  const locked = status === "submitting" || status === "success"

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-gray-900">{meta.label}</h3>
            {error && <p className="mt-1 text-sm font-medium text-red-600">{error}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge service={service} status={status} onRetry={onRetry} />
          <button
            type="button"
            onClick={() => onEdit(service)}
            disabled={locked}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  )
}

function WizardReviewScreen({
  session,
  statuses,
  errors,
  onEdit,
  onRetry,
}) {
  const space = session.spaceFormData || {}
  const mess = session.messFormData || {}
  const media = session.mediaFormData || {}
  const sequence = (session.wizardSequence || []).filter((service) => service !== "review")

  return (
    <div className="flex w-full flex-col gap-4">
      {sequence.map((service) => {
        if (service === "space") {
          const isMultiDay = space.end_date && space.end_date !== space.start_date
          const dayCount = isMultiDay
            ? Math.round((new Date(space.end_date + "T00:00:00") - new Date(space.start_date + "T00:00:00")) / 86400000) + 1
            : null

          return (
            <ReviewCard
              key={service}
              service={service}
              status={statuses?.space || "idle"}
              error={errors?.space}
              onEdit={onEdit}
              onRetry={onRetry}
            >
              <Detail label="Venue" value={space.spaceName} />
              {isMultiDay ? (
                <>
                  <Detail label="Start" value={`${formatDate(space.start_date)}${space.start_time ? ` · ${space.start_time}` : ""}`} />
                  <Detail label="End" value={`${formatDate(space.end_date)}${space.end_time ? ` · ${space.end_time}` : ""}`} />
                  <Detail
                    label="Duration"
                    value={`${dayCount} ${dayCount === 1 ? "day" : "days"} · ${space.bookingType === "SINGLE" ? "Continuous" : "Daily recurring"}`}
                  />
                </>
              ) : (
                <>
                  <Detail label="Date" value={formatDate(space.start_date)} />
                  <Detail label="Time" value={formatTimeRange(space.start_time, space.end_time)} />
                </>
              )}
              <Detail label="Attendees" value={space.attendees} />
              <Detail label="Purpose" value={space.purpose} />
              <Detail label="Equipment" value={space.equipmentSummary || "None selected"} />
            </ReviewCard>
          )
        }

        if (service === "mess") {
          return (
            <ReviewCard
              key={service}
              service={service}
              status={statuses?.mess || "idle"}
              error={errors?.mess}
              onEdit={onEdit}
              onRetry={onRetry}
            >
              <Detail label="Delivery location" value={mess.eventForm?.delivery_location} />
              <Detail
                label="Date range"
                value={`${formatDate(mess.eventForm?.start_date)} - ${formatDate(mess.eventForm?.end_date)}`}
              />
              <Detail label="Meals" value={mess.mealSummary} />
            </ReviewCard>
          )
        }

        if (service === "media") {
          return (
            <ReviewCard
              key={service}
              service={service}
              status={statuses?.media || "idle"}
              error={errors?.media}
              onEdit={onEdit}
              onRetry={onRetry}
            >
              <Detail label="Event name" value={media.formData?.event_name} />
              <Detail
                label="Setup to teardown"
                value={`${formatDateTime(media.payload?.setup_start_datetime)} - ${formatDateTime(media.payload?.teardown_end_datetime)}`}
              />
              <Detail label="Request" value={media.requestSummary} />
              <Detail label="Venue" value={media.spaceName} />
            </ReviewCard>
          )
        }

        return null
      })}
    </div>
  )
}

export default WizardReviewScreen
