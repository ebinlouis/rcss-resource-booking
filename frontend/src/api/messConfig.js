// Shared meal configuration — single source of truth for all Mess-related
// components. Each entry drives form fields, payload keys, display labels,
// and the earliest-time / requested-meals helper functions.
export const MEALS = [
  {
    id:              "breakfast",
    label:           "Breakfast",
    timeKey:         "breakfast_time",
    menuKey:         "breakfast_menu",
    menuPlaceholder: "E.g., Appam & Stew, Coffee",
    menuLabel:       "menu",
  },
  {
    id:              "morning_tea",
    label:           "Morning Tea",
    timeKey:         "morning_tea_time",
    menuKey:         "morning_snack_option",
    menuPlaceholder: "E.g., Tea & Biscuits",
    menuLabel:       "snack option",
  },
  {
    id:              "lunch",
    label:           "Lunch",
    timeKey:         "lunch_time",
    menuKey:         "lunch_menu",
    menuPlaceholder: "E.g., Veg Meals, Chicken Biriyani",
    menuLabel:       "menu",
  },
  {
    id:              "evening_tea",
    label:           "Evening Tea",
    timeKey:         "evening_tea_time",
    menuKey:         "evening_snack_option",
    menuPlaceholder: "E.g., Tea & Banana Fritters",
    menuLabel:       "snack option",
  },
  {
    id:              "dinner",
    label:           "Dinner",
    timeKey:         "dinner_time",
    menuKey:         "dinner_menu",
    menuPlaceholder: "E.g., Chapathi & Chicken Curry",
    menuLabel:       "menu",
  },
]

/**
 * Returns the earliest HH:MM across ALL daily_menus entries on a booking.
 * Falls back gracefully if daily_menus is missing or empty.
 */
export const getEarliestTime = (booking) => {
  const menus = booking?.daily_menus
  if (!Array.isArray(menus) || menus.length === 0) return "–"

  const times = []
  for (const menu of menus) {
    for (const meal of MEALS) {
      const t = menu[meal.timeKey]
      if (t && typeof t === "string" && t.length >= 5) {
        // prefix with date so we sort across days correctly
        times.push(`${menu.date}T${t}`)
      }
    }
  }

  if (times.length === 0) return "–"
  times.sort()
  // Return only the HH:MM portion
  return times[0].slice(11, 16)
}

/**
 * Returns an array of unique meal labels that appear on ANY day of the booking.
 * Used for the tag pills on booking cards.
 */
export const getRequestedMeals = (booking) => {
  const menus = booking?.daily_menus
  if (!Array.isArray(menus) || menus.length === 0) return []

  const seen = new Set()
  for (const menu of menus) {
    for (const meal of MEALS) {
      if (menu[meal.timeKey]) seen.add(meal.label)
    }
  }
  return Array.from(seen)
}

/**
 * Returns the total headcount across all days.
 * For multi-day bookings, sums total_persons from each DailyMessMenu row.
 * For display cards — admins see per-day detail in the side panel.
 */
export const getTotalPersons = (booking) => {
  const menus = booking?.daily_menus
  if (!Array.isArray(menus) || menus.length === 0) return 0
  return menus.reduce((sum, m) => sum + (m.total_persons || 0), 0)
}

export const getTotalVeg = (booking) => {
  const menus = booking?.daily_menus
  if (!Array.isArray(menus) || menus.length === 0) return 0
  return menus.reduce((sum, m) => sum + (m.veg_persons || 0), 0)
}

export const getTotalNonVeg = (booking) => {
  const menus = booking?.daily_menus
  if (!Array.isArray(menus) || menus.length === 0) return 0
  return menus.reduce((sum, m) => sum + (m.nonveg_persons || 0), 0)
}

/**
 * Formats a date range for display.
 * Single day: "26 May 2026"
 * Multi-day:  "26 May – 28 May 2026"
 */
export const formatDateRange = (startDate, endDate) => {
  if (!startDate) return "–"
  const fmt = (d) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    })
  if (!endDate || startDate === endDate) return fmt(startDate)
  const fmtNoYear = (d) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric", month: "short",
    })
  return `${fmtNoYear(startDate)} – ${fmt(endDate)}`
}

/**
 * Returns true if a booking spans more than one day.
 */
export const isMultiDay = (booking) =>
  booking?.start_date && booking?.end_date && booking.start_date !== booking.end_date

/**
 * Generates an array of YYYY-MM-DD date strings between start and end (inclusive).
 *
 * FIX: The previous version used cursor.toISOString() which converts to UTC.
 * In IST (UTC+5:30), midnight local time is 18:30 the previous UTC day, so
 * toISOString() returned the wrong (prior) date for every entry.
 * We now format the date manually from local year/month/day to stay timezone-safe.
 */
export const getDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return []
  const dates = []
  const cursor = new Date(startDate + "T00:00:00")
  const end    = new Date(endDate   + "T00:00:00")
  while (cursor <= end) {
    const y  = cursor.getFullYear()
    const m  = String(cursor.getMonth() + 1).padStart(2, "0")
    const d  = String(cursor.getDate()).padStart(2, "0")
    dates.push(`${y}-${m}-${d}`)          // uses local date, not UTC
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}