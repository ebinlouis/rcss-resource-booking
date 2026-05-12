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

/** Returns the earliest HH:MM across all meal times on a booking.
 *  Handles null, undefined, and empty string gracefully. */
export const getEarliestTime = (b) => {
  const times = MEALS
    .map((m) => b[m.timeKey])
    .filter((t) => t && typeof t === "string" && t.length >= 5)
  return times.length === 0 ? "–" : times.sort()[0].slice(0, 5)
}

/** Returns an array of meal labels that are flagged as required. */
export const getRequestedMeals = (b) =>
  MEALS.filter((m) => b[`${m.id}_required`]).map((m) => m.label)