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

const ADMIN_ROLE_LINKS = {
  spaces: {
    roles: ['RECEPTIONIST', 'LAB_INCHARGE', 'PRINCIPAL'],
    base: '/admin',
  },
  media: {
    roles: ['MEDIA_INCHARGE'],
    base: '/admin/media',
  },
  mess: {
    roles: ['MESS_MANAGER'],
    base: '/admin/mess',
  },
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

const getAdminDestination = (domain, reference, category, effectiveRoles = []) => {
  const config = ADMIN_ROLE_LINKS[domain]
  if (!config || !reference) return null

  const roles = Array.isArray(effectiveRoles) ? effectiveRoles : []
  const hasDomainRole = config.roles.some((role) => roles.includes(role))
  if (!hasDomainRole) return null

  const tab = category === 'BOOKING_PENDING' ? 'pending' : 'history'
  return `${config.base}?tab=${tab}&booking=${encodeURIComponent(reference)}`
}

export const getNotificationDestination = (notification, effectiveRoles = []) => {
  const link = notification?.link

  const reference = notification?.reference_code || extractBookingReference(link)
  const domain = notification?.domain || inferDomain(notification)

  if (!reference && !link) return null

  const adminDestination = getAdminDestination(
    domain,
    reference,
    notification.category,
    effectiveRoles,
  )
  if (adminDestination) return adminDestination

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
