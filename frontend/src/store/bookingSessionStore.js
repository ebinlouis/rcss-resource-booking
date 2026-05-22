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
  completedBookings: [],
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
  markComplete(type) {
    setState((current) => ({
      ...current,
      completedBookings: current.completedBookings.includes(type)
        ? current.completedBookings
        : [...current.completedBookings, type],
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
