import { useState, useEffect } from "react"

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

useEffect(() => {
    const handleClick = () => setMenuOpen(false)

    if (menuOpen) {
      window.addEventListener("click", handleClick)
    }

    return () => window.removeEventListener("click", handleClick)
  }, [menuOpen])

  const tabs = ["Spaces", "Transport", "Media", "Mess", "Approvals"]

  return (
    <div className="bg-white border-b px-4 md:px-6 py-3 relative">

      <div className="flex items-center justify-between gap-4">

        {/* LEFT */}
        <div className="flex items-center gap-3">
          <div className="bg-green-700 text-white font-bold w-8 h-8 flex items-center justify-center rounded">
            R
          </div>

          <div>
            <h1 className="font-semibold text-gray-900 text-sm md:text-base">
              Resource Booking
            </h1>
            <p className="text-xs text-gray-500">RCSS</p>
          </div>
        </div>

        {/* CENTER NAV (Desktop only) */}
        <div className="hidden md:flex bg-gray-100 rounded-md px-2 py-1 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`px-3 py-1 rounded text-sm ${
                tab === "Spaces"
                  ? "bg-white text-gray-900 shadow-sm font-medium"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2">

          {/* Menu button (mobile) */}
          <button
  className="md:hidden p-2 rounded bg-gray-100"
  onClick={(e) => {
    e.stopPropagation()
    setMenuOpen(!menuOpen)
  }}
>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Profile */}
          <div className="bg-black text-white w-8 h-8 flex items-center justify-center rounded text-sm">
            A
          </div>

        </div>

      </div>

      {/* DROPDOWN MENU (Mobile with animation) */}
<div
  className={`absolute top-full left-0 w-full bg-white border-t shadow-md md:hidden z-50 transition-all duration-300 ease-in-out ${
    menuOpen
      ? "opacity-100 translate-y-0 pointer-events-auto"
      : "opacity-0 -translate-y-2 pointer-events-none"
  }`}
>

  {tabs.map((tab, i) => (
    <button
      key={tab}
      style={{ transitionDelay: `${i * 40}ms` }}
      className="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition"
    >
      {tab}
    </button>
  ))}

</div>
      

    </div>
  )
}

export default Navbar