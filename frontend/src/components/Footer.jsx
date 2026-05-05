function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-200 bg-white mt-12">
      <div className="max-w-screen-xl mx-auto px-6 py-6">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          {/* Left — Branding */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #14532d, #1e3a5f)" }}
            >
              <span className="text-white font-bold text-xs">RC</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-gray-800">
                Rajagiri College of Social Sciences
              </p>
              <p className="text-xs text-gray-400">
                Resource Booking System &mdash; Internal Use Only
              </p>
            </div>
          </div>

          {/* Center — Links */}
          <div className="flex items-center gap-5 text-xs text-gray-400">
            {[
              { label: "Help & Support",  href: "#" },
              { label: "Privacy Policy",  href: "#" },
              { label: "Terms of Use",    href: "#" },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="hover:text-green-700 transition"
              >
                {label}
              </a>
            ))}
          </div>

          {/* Right — Copyright */}
          <p className="text-xs text-gray-400">
            &copy; {year} RCSS. All rights reserved.
          </p>

        </div>

        {/* Bottom rule */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:justify-between gap-1 text-[11px] text-gray-300">
          <span>Rajagiri College of Social Sciences, Kalamassery, Ernakulam, Kerala</span>
          <span>Built by RLabZ</span>
        </div>

      </div>
    </footer>
  )
}

export default Footer