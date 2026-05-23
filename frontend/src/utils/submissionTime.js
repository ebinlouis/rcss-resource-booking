export const getSubmissionTimestamp = (booking) => {
  if (!booking) return null

  const status = String(booking.status || "").toUpperCase()
  if (status === "PENDING" && booking.updated_at) {
    return booking.updated_at
  }

  return booking.created_at || booking.updated_at || null
}

export const compareSubmissionTimeDesc = (a, b) => {
  const aTime = new Date(getSubmissionTimestamp(a) || 0).getTime()
  const bTime = new Date(getSubmissionTimestamp(b) || 0).getTime()
  return bTime - aTime
}
