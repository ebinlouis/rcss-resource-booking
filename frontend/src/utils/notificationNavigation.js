const ADMIN_PENDING_LINKS = {
  spaces: '/admin',
  media: '/admin/media',
  mess: '/admin/mess',
  fleet: '/admin/transport',
}

const REQUESTER_LINKS = {
  spaces: '/bookings',
  media: '/media/my-bookings',
  mess: '/mess',
  fleet: '/transport',
}

const inferDomain = (notification) => {
  const text = `${notification?.title ?? ''} ${notification?.message ?? ''}`.toLowerCase()
  if (text.includes('media')) return 'media'
  if (text.includes('mess') || text.includes('catering')) return 'mess'
  if (text.includes('fleet') || text.includes('transport') || text.includes('vehicle')) return 'fleet'
  if (text.includes('space')) return 'spaces'
  return 'spaces'
}

const extractBookingReference = (link) => {
  const match = String(link ?? '').match(/\/bookings\/([^/?#]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

export const getNotificationDestination = (notification) => {
  const link = notification?.link

  const reference = notification?.reference_code || extractBookingReference(link)
  const domain = notification?.domain || inferDomain(notification)

  if (!reference && !link) return null

  if (notification.category === 'BOOKING_PENDING' && reference) {
    const adminBase = ADMIN_PENDING_LINKS[domain] ?? ADMIN_PENDING_LINKS.spaces
    return `${adminBase}?tab=pending&booking=${encodeURIComponent(reference)}`
  }

  if (reference && domain !== 'spaces') {
    const requesterBase = REQUESTER_LINKS[domain]
    if (requesterBase) {
      return `${requesterBase}?booking=${encodeURIComponent(reference)}`
    }
  }

  return link
}
