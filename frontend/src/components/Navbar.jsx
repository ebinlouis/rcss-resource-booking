import { useState, useEffect, useRef } from "react"

const TABS = ["Spaces", "Transport", "Media", "Mess", "Approvals"]

function Navbar({ activeTab = "Spaces", onTabChange }) {
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)

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
    window.addEventListener("click", handler)
    return () => window.removeEventListener("click", handler)
  }, [menuOpen])

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-screen-xl mx-auto px-5 md:px-6">
        <div className="flex items-center justify-between h-16 gap-4">

          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 ">
  <img
    src="/logo.png"
    alt="RCSS Logo"
    className="w-full h-full object-contain"
  />
</div>

            {/* ── Center tabs — underline style (desktop) ── */}
          <nav className="hidden md:flex items-stretch gap-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => onTabChange?.(tab)}
                  className={`relative px-4 text-sm font-medium transition-colors
                    flex items-center border-b-2
                    ${isActive
                      ? "border-green-600 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"}`}
                >
                  {tab}
                </button>
              )
            })}
          </nav>

 {/* ── Right ── */}
          <div className="flex items-center gap-1">

            {/* Bell */}
            <button className="hidden md:flex relative w-9 h-9 items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0
                     006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714
                     0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen) }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: "linear-gradient(135deg, #14532d, #1e3a5f)" }}
                >
                  A
                </div>
                <div className="hidden md:block text-left leading-tight">
                  <p className="text-xs font-semibold text-gray-800">Admin User</p>
                  <p className="text-[10px] text-gray-400">Faculty</p>
                </div>
                <svg
                  className={`hidden md:block w-3 h-3 text-gray-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-800">Admin User</p>
                    <p className="text-xs text-gray-400 mt-0.5">admin@rcss.ac.in</p>
                  </div>
                  <div className="py-1">
                    {[
                      { label: "My Bookings", d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
                      { label: "Profile",     d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
                      { label: "Settings",    d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
                    ].map(({ label, d }) => (
                      <button key={label} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left">
                        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={d} />
                        </svg>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 py-1">
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition text-left">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>



{/* Hamburger (mobile) */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            >
              <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
      </div>

       {/* Mobile menu */}
      <div className={`md:hidden border-t border-gray-100 bg-white overflow-hidden transition-all duration-200
        ${menuOpen ? "max-h-72" : "max-h-0"}`}>
        <nav className="px-4 py-2 space-y-0.5">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { onTabChange?.(tab); setMenuOpen(false) }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition
                ${activeTab === tab
                  ? "bg-green-50 text-green-600 font-semibold"
                  : "text-gray-600 hover:bg-gray-50"}`}
            >
              {tab}
            </button>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "linear-gradient(135deg, #14532d, #1e3a5f)" }}>
            A
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Admin User</p>
            <p className="text-xs text-gray-400">admin@rcss.ac.in</p>
          </div>
          <button className="ml-auto text-xs text-red-500 font-medium">Sign out</button>
        </div>
      </div>
    </header>
  )
}

export default Navbar