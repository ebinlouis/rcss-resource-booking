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
    roles: ['RECEPTIONIST', 'LAB_INCHARGE', 'PRINCIPAL', 'HOD', 'IT_ADMIN', 'LIBRARIAN'],
    base: '/admin',
  },
  media: {
    roles: ['MEDIA_INCHARGE', 'IT_ADMIN'],
    base: '/admin/media',
  },
  mess: {
    roles: ['MESS_MANAGER', 'IT_ADMIN'],
    base: '/admin/mess',
  },
  fleet: {
    roles: ['FLEET_MANAGER', 'IT_ADMIN'],
    base: '/admin/transport',
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

  let tab = 'history'
  if (category === 'BOOKING_PENDING') tab = 'pending'
  else if (category === 'FACULTY_ESCALATED') tab = 'pending'
  else if (category === 'SYSTEM') tab = 'history'

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

  if ((notification.category === 'BOOKING_PENDING' || notification.category === 'FACULTY_ESCALATED') && reference) {
    const adminBase = ADMIN_PENDING_LINKS[domain] ?? ADMIN_PENDING_LINKS.spaces
    const tab = 'pending'
    return `${adminBase}?tab=${tab}&booking=${encodeURIComponent(reference)}`
  }

  if (reference && domain !== 'spaces') {
    const requesterBase = REQUESTER_LINKS[domain]
    if (requesterBase) {
      return `${requesterBase}?booking=${encodeURIComponent(reference)}`
    }
  }

  return link
}
