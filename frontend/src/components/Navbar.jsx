import { useState, useEffect, useRef } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

import {
  LayoutGrid,
  Bus,
  Clapperboard,
  UtensilsCrossed,
  ShieldCheck,
} from "lucide-react"

const TABS = [
  {
    name: "Spaces",
    path: "/dashboard",
    icon: LayoutGrid,
  },
  {
    name: "Transport",
    path: "/transport",
    icon: Bus,
  },
  {
    name: "Media",
    path: "/media",
    icon: Clapperboard,
  },
  {
    name: "Mess",
    path: "/mess",
    icon: UtensilsCrossed,
  },
]

function Navbar({ onTabChange }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const profileRef = useRef(null)

  const { user, logout } = useAuth()

  const isApprover = user?.can_access_admin_portal

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }

    document.addEventListener("mousedown", handler)

    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Close mobile menu on outside click
  useEffect(() => {
    if (!menuOpen) return

    const handler = () => setMenuOpen(false)

    setTimeout(() => {
      window.addEventListener("click", handler)
    }, 0)

    return () => window.removeEventListener("click", handler)
  }, [menuOpen])

  const handleLogout = async () => {
    await logout()
    navigate("/")
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/40 bg-white/70 backdrop-blur-xl">

      <div className="w-full px-5 md:px-8 xl:px-10">

        <div className="flex items-center justify-between h-20 gap-4">

          {/* Logo */}
          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
            <img
              src="/logo.png"
              alt="RCSS Logo"
              className="w-full h-full object-contain"
            />
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
                    ${
                      isActive
                        ? "border-green-700 text-green-700"
                        : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                    }`}
                >
                  <Icon className="w-[16px] h-[16px]" />
                  {tab.name}
                </Link>
              )
            })}

            {/* Admin Portal */}
            {isApprover && (
              <Link
                to="/admin"
                className={`relative px-5 text-sm font-medium transition-all duration-300
                  flex items-center border-b-2 gap-2
                  ${
                    location.pathname === "/admin"
                      ? "border-green-700 text-green-700"
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                  }`}
              >
                <ShieldCheck className="w-[16px] h-[16px]" />
                Admin Portal
              </Link>
            )}

          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-2 md:gap-3">

            {/* Notification */}
            <button className="hidden md:flex relative w-10 h-10 items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 transition">

              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0
                  006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714
                  0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>

              <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>

            {/* Profile */}
            <div className="relative" ref={profileRef}>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setProfileOpen(!profileOpen)
                }}
                className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition"
              >

                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm"
                  style={{
                    background: "linear-gradient(135deg, #14532d, #1e3a5f)",
                  }}
                >
                  {user?.name ? user.name[0].toUpperCase() : "U"}
                </div>

                {/* User Info */}
                <div className="hidden md:block text-left leading-tight">
                  <p className="text-sm font-semibold text-gray-800">
                    {user?.name || "Loading..."}
                  </p>

                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                    {user?.effective_role || "Student"}
                  </p>
                </div>

                {/* Arrow */}
                <svg
                  className={`hidden md:block w-3 h-3 text-gray-400 transition-transform ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>

              </button>

              {/* Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">

                  {/* Top */}
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {user?.name || "User"}
                    </p>

                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {user?.email || "No email provided"}
                    </p>
                  </div>

                  {/* Menu */}
                  <div className="py-1">

                    {[
                      {
                        label: "My Bookings",
                        d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
                      },
                      {
                        label: "Profile",
                        d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
                      },
                    ].map(({ label, d }) => (
                      <button
                        key={label}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                      >
                        <svg
                          className="w-4 h-4 text-gray-400 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={d}
                          />
                        </svg>

                        {label}
                      </button>
                    ))}

                  </div>

                  {/* Logout */}
                  <div className="border-t border-gray-100 py-1">

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition text-left font-medium"
                    >

                      <svg
                        className="w-4 h-4 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>

                      Sign out
                    </button>

                  </div>

                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(!menuOpen)
              }}
            >

              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={
                    menuOpen
                      ? "M6 18L18 6M6 6l12 12"
                      : "M4 6h16M4 12h16M4 18h16"
                  }
                />
              </svg>

            </button>

          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden border-t border-gray-100 bg-white overflow-hidden transition-all duration-300
        ${menuOpen ? "max-h-[500px]" : "max-h-0"}`}
      >

        <nav className="px-4 py-3 space-y-1">

          {TABS.map((tab) => {
            const Icon = tab.icon

            return (
              <Link
                key={tab.name}
                to={tab.path}
                onClick={() => {
                  onTabChange?.(tab)
                  setMenuOpen(false)
                }}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition
                  ${
                    location.pathname === tab.path
                      ? "bg-green-50 text-green-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </Link>
            )
          })}

          {/* Mobile Admin */}
          {isApprover && (
            <Link
              to="/admin"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition
                ${
                  location.pathname === "/admin"
                    ? "bg-green-50 text-green-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Admin Portal
            </Link>
          )}

        </nav>

        {/* Mobile Bottom */}
        <div className="px-4 py-4 border-t border-gray-100 bg-gray-50 flex items-center gap-3">

          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm"
            style={{
              background: "linear-gradient(135deg, #14532d, #1e3a5f)",
            }}
          >
            {user?.name ? user.name[0].toUpperCase() : "U"}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">
              {user?.name || "Loading..."}
            </p>

            <p className="text-xs text-gray-500 truncate">
              {user?.email || "No email"}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="ml-auto text-xs text-red-600 font-bold bg-white px-3 py-1.5 rounded border border-red-100 shadow-sm"
          >
            Sign out
          </button>

        </div>
      </div>
    </header>
  )
}

export default Navbar