import Navbar from "../components/Navbar"
import Footer from "../components/Footer"

function MainLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-green-50/30">

      {/* Navbar */}
      <Navbar />

      {/* Page Content */}
      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto px-8 py-10">
          {children}
        </div>
      </main>

      {/* Footer */}
      <Footer />

    </div>
  )
}

export default MainLayout