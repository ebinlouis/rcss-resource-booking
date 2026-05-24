import { useState, useEffect, useRef } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import NotificationBell from "./NotificationBell"

import {
  LayoutGrid,
  Bus,
  Clapperboard,
  UtensilsCrossed,
  ShieldCheck,
} from "lucide-react"

const TABS = [
  { name: "Venues",    path: "/dashboard", icon: LayoutGrid      },
  { name: "Transport", path: "/transport", icon: Bus             },
  { name: "Media",     path: "/media",     icon: Clapperboard    },
  { name: "Food",      path: "/mess",      icon: UtensilsCrossed },
]

const ROLE_DISPLAY_MAP = {
  'IT_ADMIN':       'IT Admin',
  'PRINCIPAL':      'Principal',
  'HOD':            'Head of Department',
  'RECEPTIONIST':   'Receptionist',
  'LAB_INCHARGE':   'Lab In-Charge',
  'LIBRARIAN':      'Librarian',
  'MESS_MANAGER':   'Mess Manager',
  'MEDIA_INCHARGE': 'Media In-Charge',
  'FLEET_MANAGER':  'Fleet Manager',
  'FACULTY':        'Faculty',
  'STAFF':          'Staff',
  'STUDENT':        'Student',
}

const ROLE_PRIORITY = [
  'IT_ADMIN', 'PRINCIPAL', 'HOD',
  'RECEPTIONIST', 'LAB_INCHARGE', 'LIBRARIAN',
  'MESS_MANAGER', 'MEDIA_INCHARGE', 'FLEET_MANAGER',
  'FACULTY', 'STAFF', 'STUDENT',
]

const getRoleLabel = (effectiveRoles = []) => {
  if (!effectiveRoles.length) return 'Student'
  const top = ROLE_PRIORITY.find((r) => effectiveRoles.includes(r))
  return ROLE_DISPLAY_MAP[top] ?? effectiveRoles[0]
}

function HeaderAvatar({ user }) {
  const initial = user?.name ? user.name[0].toUpperCase() : "U"

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm overflow-hidden"
      style={{ background: "linear-gradient(135deg, #14532d, #1e3a5f)" }}
    >
      {user?.profile_image ? (
        <img
          src={user.profile_image}
          alt={`${user?.name || "User"} profile`}
          className="w-full h-full object-cover"
        />
      ) : (
        initial
      )}
    </div>
  )
}

function Navbar({ onTabChange }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)

  const {
    user,
    logout,
    effectiveRoles,
    can_access_admin_portal,
    can_manage_system,
    can_manage_mess,
  } = useAuth()

  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target))
        setProfileOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const handler = () => setMenuOpen(false)
    setTimeout(() => window.addEventListener("click", handler), 0)
    return () => window.removeEventListener("click", handler)
  }, [menuOpen])

  const handleLogout = async () => {
    await logout()
    navigate("/")
  }

  const handleAdminPortalClick = (e) => {
    e.preventDefault()
    const can_manage_media = user?.capabilities?.can_manage_media

    // IT_ADMIN always goes to /admin (spaces/labs only — no mess or media)
    if (user?.is_superuser || can_manage_system) {
      navigate("/admin")
    } else if (can_manage_mess) {
      navigate("/admin/mess")
    } else if (can_manage_media) {
      navigate("/admin/media")
    } else {
      navigate("/admin")
    }
  }

  const roleLabel = getRoleLabel(effectiveRoles)

  return (
    <header className="sticky top-0 z-50 border-b border-white/40 bg-white/70 backdrop-blur-xl">
      <div className="w-full px-5 md:px-8 xl:px-10">
        <div className="flex items-center justify-between h-20 gap-4">

          {/* Logo */}
          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
            <img src="/logo.png" alt="RCSS Logo" className="w-full h-full object-contain" />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-stretch gap-1 self-stretch">
            {TABS.map((tab) => {
              const isActive = location.pathname === tab.path
              const Icon = tab.icon
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  onClick={() => onTabChange?.(tab)}
                  className={`relative px-5 text-sm font-medium transition-all duration-300
                    flex items-center border-b-2 gap-2
                    ${isActive
                      ? "border-green-700 text-green-700"
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                    }`}
                >
                  <Icon className="w-[16px] h-[16px]" />
                  {tab.name}
                </Link>
              )
            })}

            {can_access_admin_portal && (
              <button
                onClick={handleAdminPortalClick}
                className={`relative px-5 text-sm font-medium transition-all duration-300
                  flex items-center border-b-2 gap-2
                  ${location.pathname.startsWith("/admin")
                    ? "border-green-700 text-green-700"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                  }`}
              >
                <ShieldCheck className="w-[16px] h-[16px]" />
                Admin Portal
              </button>
            )}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-2 md:gap-3">

            {user ? (
              <>
                {/* Notification */}
                <NotificationBell className="hidden md:block" />

                {/* Profile dropdown */}
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen) }}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition"
                  >
                    <HeaderAvatar user={user} />
                    <div className="hidden md:block text-left leading-tight">
                      <p className="text-sm font-semibold text-gray-800">
                        {user?.name || "Loading..."}
                      </p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                        {roleLabel}
                      </p>
                    </div>
                    <svg
                      className={`hidden md:block w-3 h-3 text-gray-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-800 truncate">{user?.name || "User"}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{user?.email || "No email provided"}</p>
                      </div>
                      <div className="py-1">
                        {[
                          { label: "My Bookings",   path: "/my-bookings",   d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
                          { label: "Notifications", path: "/notifications", d: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
                          { label: "Profile",       path: "/profile",       d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
                        ].map(({ label, path, d }) => (
                          <Link
                            key={label}
                            to={path}
                            onClick={() => setProfileOpen(false)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                          >
                            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d={d} />
                            </svg>
                            {label}
                          </Link>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 py-1">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition text-left font-medium"
                        >
                          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign In
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`md:hidden border-t border-gray-100 bg-white overflow-hidden transition-all duration-300 ${menuOpen ? "max-h-[500px]" : "max-h-0"}`}>
        <nav className="px-4 py-3 space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <Link
                key={tab.name}
                to={tab.path}
                onClick={() => { onTabChange?.(tab); setMenuOpen(false) }}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition
                  ${location.pathname === tab.path
                    ? "bg-green-50 text-green-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50"
                  }`}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </Link>
            )
          })}

          {can_access_admin_portal && (
            <button
              onClick={(e) => { setMenuOpen(false); handleAdminPortalClick(e) }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition text-left
                ${location.pathname.startsWith("/admin")
                  ? "bg-green-50 text-green-700 font-semibold"
                  : "text-gray-600 hover:bg-gray-50"
                }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Admin Portal
            </button>
          )}

          <Link
            to="/notifications"
            onClick={() => setMenuOpen(false)}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition
              ${location.pathname === "/notifications"
                ? "bg-green-50 text-green-700 font-semibold"
                : "text-gray-600 hover:bg-gray-50"
              }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Notifications
          </Link>
        </nav>

        <div className="px-4 py-4 border-t border-gray-100 bg-gray-50 flex items-center gap-3">
          {user ? (
            <>
              <HeaderAvatar user={user} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{user?.name || "Loading..."}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email || "No email"}</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-auto text-xs text-red-600 font-bold bg-white px-3 py-1.5 rounded border border-red-100 shadow-sm"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar