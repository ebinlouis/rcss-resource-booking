import { useCallback, useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import api from "../api/axios"
import mediaApi from "../api/mediaApi"
import messService from "../api/messService"
import { bookingSessionActions, useBookingSession } from "../store/bookingSessionStore"

const INITIAL_STATUSES = {
  space: "idle",
  mess: "idle",
  media: "idle",
}

const serviceOrder = ["space", "mess", "media"]

const normalizeError = (error) => {
  const data = error?.response?.data
  if (!data) return "Submission failed. Please try again."
  if (typeof data === "string") return data

  if (Array.isArray(data.non_field_errors)) return data.non_field_errors[0]
  if (data.non_field_errors) return data.non_field_errors
  if (data.detail) return data.detail
  if (data.error) return data.error

  const firstKey = Object.keys(data)[0]
  if (!firstKey) return "Submission failed. Please try again."

  const value = data[firstKey]
  if (Array.isArray(value)) return `${firstKey}: ${value[0]}`
  if (typeof value === "object") return `${firstKey}: ${JSON.stringify(value)}`
  return `${firstKey}: ${value}`
}

function useWizardSubmit() {
  const session = useBookingSession()
  const [statuses, setStatuses] = useState(INITIAL_STATUSES)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!session.eventGroupId) return
    setStatuses(INITIAL_STATUSES)
    setErrors({})
  }, [session.eventGroupId])

  const activeServices = useMemo(
    () => serviceOrder.filter((service) => session.wizardSequence?.includes(service)),
    [session.wizardSequence],
  )

  const setServiceStatus = useCallback((service, status) => {
    setStatuses((current) => ({ ...current, [service]: status }))
  }, [])

  const setServiceError = useCallback((service, message) => {
    setErrors((current) => ({ ...current, [service]: message }))
  }, [])

  const clearServiceError = useCallback((service) => {
    setErrors((current) => {
      const next = { ...current }
      delete next[service]
      return next
    })
  }, [])

  const submitSpace = useCallback(async (snapshot) => {
    const existing = snapshot.submittedBookings?.space
    if (existing) return existing

    const payload = snapshot.spaceFormData?.payload
    if (!payload) throw new Error("Space booking details are incomplete.")

    const response = await api.post("/spaces/requests/", {
      ...payload,
      event_group_id: snapshot.eventGroupId,
    })

    const booking = response.data
    bookingSessionActions.setSpaceFormData({
      ...(snapshot.spaceFormData || {}),
      id: booking?.id,
      reference_code: booking?.reference_code,
      event_group_id: booking?.event_group_id || snapshot.eventGroupId,
    })
    bookingSessionActions.markComplete("space")
    bookingSessionActions.markSubmitted("space", booking)
    return booking
  }, [])

  const submitMess = useCallback(async (snapshot) => {
    const existing = snapshot.submittedBookings?.mess
    if (existing) return existing

    const payload = snapshot.messFormData?.payload
    if (!payload) throw new Error("Mess booking details are incomplete.")

    const booking = await messService.createBooking({
      ...payload,
      event_group_id: snapshot.eventGroupId,
    })
    bookingSessionActions.markComplete("mess")
    bookingSessionActions.markSubmitted("mess", booking)
    return booking
  }, [])

  const submitMedia = useCallback(async (snapshot) => {
    const existing = snapshot.submittedBookings?.media
    if (existing) return existing

    const payload = snapshot.mediaFormData?.payload
    if (!payload) throw new Error("Media booking details are incomplete.")

    const booking = await mediaApi.createBooking({
      ...payload,
      event_group_id: snapshot.eventGroupId,
    })
    bookingSessionActions.markComplete("media")
    bookingSessionActions.markSubmitted("media", booking)
    return booking
  }, [])

  const submitters = useMemo(
    () => ({
      space: submitSpace,
      mess: submitMess,
      media: submitMedia,
    }),
    [submitMedia, submitMess, submitSpace],
  )

  const finishIfComplete = useCallback((submittedMap) => {
    const allDone = activeServices.every((service) => submittedMap[service])
    if (allDone) {
      bookingSessionActions.markWizardSuccess()
      toast.success("All linked bookings submitted successfully.")
    }
    return allDone
  }, [activeServices])

  const submit = useCallback(async () => {
    setSubmitting(true)
    setErrors({})

    const snapshot = session
    const submittedMap = { ...(snapshot.submittedBookings || {}) }

    try {
      if (activeServices.includes("space")) {
        setServiceStatus("space", "submitting")
        try {
          submittedMap.space = await submitSpace(snapshot)
          setServiceStatus("space", "success")
        } catch (error) {
          setServiceError("space", normalizeError(error))
          setServiceStatus("space", "failed")
          return { ok: false, stoppedAt: "space" }
        }
      }

      for (const service of ["mess", "media"]) {
        if (!activeServices.includes(service)) continue

        setServiceStatus(service, "submitting")
        clearServiceError(service)
        try {
          submittedMap[service] = await submitters[service]({
            ...snapshot,
            submittedBookings: submittedMap,
          })
          setServiceStatus(service, "success")
        } catch (error) {
          setServiceError(service, normalizeError(error))
          setServiceStatus(service, "failed")
        }
      }

      const allDone = finishIfComplete(submittedMap)
      return { ok: allDone }
    } finally {
      setSubmitting(false)
    }
  }, [
    activeServices,
    clearServiceError,
    finishIfComplete,
    session,
    setServiceError,
    setServiceStatus,
    submitSpace,
    submitters,
  ])

  const retry = useCallback(async (service) => {
    if (!submitters[service]) return { ok: false }

    setSubmitting(true)
    setServiceStatus(service, "submitting")
    clearServiceError(service)

    const snapshot = session
    const submittedMap = { ...(snapshot.submittedBookings || {}) }

    try {
      const booking = await submitters[service](snapshot)
      submittedMap[service] = booking
      setServiceStatus(service, "success")
      const allDone = finishIfComplete(submittedMap)
      return { ok: allDone }
    } catch (error) {
      setServiceError(service, normalizeError(error))
      setServiceStatus(service, "failed")
      return { ok: false }
    } finally {
      setSubmitting(false)
    }
  }, [
    clearServiceError,
    finishIfComplete,
    session,
    setServiceError,
    setServiceStatus,
    submitters,
  ])

  return {
    submit,
    submitting,
    errors,
    retry,
    statuses,
  }
}

export default useWizardSubmit
