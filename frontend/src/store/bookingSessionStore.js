import { useSyncExternalStore } from "react"

const STORAGE_KEY = "booking-session"

const newEventGroupId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16)
    const nibble = char === "x" ? value : (value & 0x3) | 0x8
    return nibble.toString(16)
  })
}

const freshSession = () => ({
  eventGroupId: newEventGroupId(),
  spaceFormData: null,
  messFormData: null,
  mediaFormData: null,
  mediaRequestMode: null,
  mediaCapacity: null,
  completedBookings: [],
  submittedBookings: {
    space: null,
    mess: null,
    media: null,
  },
  wizardActive: false,
  wizardOrigin: "/dashboard",
  wizardSequence: [],
  wizardInitialStep: null,
  wizardSuccess: false,
})

const readSession = () => {
  if (typeof window === "undefined") return freshSession()
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return freshSession()
    return { ...freshSession(), ...JSON.parse(raw) }
  } catch {
    return freshSession()
  }
}

let state = readSession()
const listeners = new Set()

const persist = () => {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const emit = () => {
  persist()
  listeners.forEach((listener) => listener())
}

const setState = (updater) => {
  state = typeof updater === "function" ? updater(state) : { ...state, ...updater }
  emit()
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => state

export const bookingSessionActions = {
  setSpaceFormData(data) {
    setState((current) => ({
      ...current,
      spaceFormData: { ...(current.spaceFormData || {}), ...data },
    }))
  },

  setMessFormData(data) {
    setState((current) => ({
      ...current,
      messFormData: { ...(current.messFormData || {}), ...data },
    }))
  },

  setMediaFormData(data) {
    setState((current) => ({
      ...current,
      mediaFormData: { ...(current.mediaFormData || {}), ...data },
    }))
  },

  setMediaRequestMode(mode) {
    setState({ mediaRequestMode: mode })
  },

  setMediaCapacity(data) {
    setState({ mediaCapacity: data })
  },

  // startWizard — call when user clicks Add Mess / Add Media from BookingModal.
  // Space form data must already be written to the store before calling this.
  startWizard({ origin = "/dashboard", sequence = ["space", "review"], initialStep = "space" } = {}) {
    setState((current) => ({
      ...current,
      wizardActive: true,
      wizardOrigin: origin,
      wizardSequence: sequence,
      wizardInitialStep: initialStep,
      wizardSuccess: false,
    }))
  },

  setWizardSequence(sequence) {
    setState({ wizardSequence: sequence })
  },

  setWizardInitialStep(step) {
    setState({ wizardInitialStep: step })
  },

  // closeWizard — only for partial-failure retry where Space already submitted.
  // For clean cancel, call clearSession() instead.
  closeWizard() {
    setState({
      wizardActive: false,
      wizardSequence: [],
      wizardInitialStep: null,
      wizardSuccess: false,
    })
  },

  markWizardSuccess() {
    setState((current) => ({
      ...freshSession(),
      wizardActive: true,
      wizardOrigin: current.wizardOrigin || "/dashboard",
      wizardSuccess: true,
    }))
  },

  markComplete(type) {
    setState((current) => ({
      ...current,
      completedBookings: current.completedBookings.includes(type)
        ? current.completedBookings
        : [...current.completedBookings, type],
    }))
  },

  markSubmitted(type, booking) {
    setState((current) => ({
      ...current,
      submittedBookings: {
        ...(current.submittedBookings || {}),
        [type]: booking || true,
      },
    }))
  },

  clearSession() {
    state = freshSession()
    emit()
  },
}

export const useBookingSession = () => useSyncExternalStore(
  subscribe,
  getSnapshot,
  getSnapshot,
)
