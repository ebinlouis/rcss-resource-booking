import { useState, useEffect, useRef } from "react"
import { Link, useLocation } from "react-router-dom"

const TABS = [
  { name: "Spaces", path: "/dashboard" },
  { name: "Transport", path: "/transport" },
  { name: "Media", path: null },
  { name: "Mess", path: "/mess" },
  { name: "Approvals", path: null }
];

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)
  const location = useLocation()

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

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-screen-xl mx-auto px-5 md:px-6">
        <div className="flex items-center justify-between h-16 gap-4">

          {/* LOGO */}
          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 shadow-sm bg-white">
            <img
              src="/logo.png"
              alt="RCSS Logo"
              className="w-full h-full object-contain"
            />
          </div>

          {/* DESKTOP NAV */}
          <nav className="hidden md:flex items-center bg-gray-100 rounded-lg px-1.5 py-1 gap-0.5">
            {TABS.map((tab) => {
              const isActive = location.pathname === tab.path

              if (!tab.path) {
                return (
                  <button
                    key={tab.name}
                    type="button"
                    className="px-3.5 py-1.5 rounded-md text-sm font-medium text-gray-400 cursor-not-allowed"
                  >
                    {tab.name}
                  </button>
                )
              }

              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-all
                    ${isActive
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-800 hover:bg-white/60"}`}
                >
                  {tab.name}
                </Link>
              )
            })}
          </nav>

          {/* RIGHT SIDE */}
          <div className="flex items-center gap-2">

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setProfileOpen(!profileOpen)
                }}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 transition"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: "linear-gradient(135deg, #14532d, #1e3a5f)" }}
                >
                  A
                </div>

                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold text-gray-800">Admin User</p>
                  <p className="text-[10px] text-gray-400">Faculty</p>
                </div>
              </button>

              {/* DROPDOWN */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow border border-gray-100">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <p className="text-sm font-semibold">Admin User</p>
                    <p className="text-xs text-gray-400">admin@rcss.ac.in</p>
                  </div>

                  <button
                    type="button"
                    className="w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 text-left"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>

            {/* MOBILE MENU BUTTON */}
            <button
              type="button"
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(!menuOpen)
              }}
            >
              ☰
            </button>

          </div>
        </div>
      </div>

      {/* MOBILE NAV */}
      {menuOpen && (
        <div className="md:hidden border-t bg-white">
          {TABS.map((tab) => {
            if (!tab.path) {
              return (
                <div
                  key={tab.name}
                  className="px-4 py-3 text-sm text-gray-400"
                >
                  {tab.name}
                </div>
              )
            }

            return (
              <Link
                key={tab.name}
                to={tab.path}
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100"
              >
                {tab.name}
              </Link>
            )
          })}
        </div>
      )}
    </header>
  )
}

export default Navbar