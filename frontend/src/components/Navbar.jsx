function Navbar() {
  return (
    <div className="bg-white border-b px-6 py-3 flex justify-between items-center">

      {/* LEFT SECTION */}
      <div className="flex items-center gap-3">
        <div className="bg-green-700 text-white font-bold w-8 h-8 flex items-center justify-center rounded">
          R
        </div>

        <div>
          <h1 className="font-bold text-gray-900">Resource Booking</h1>
          <p className="text-sm text-gray-500">RCSS</p>
        </div>
      </div>

      {/* CENTER NAV */}
      <div className="bg-gray-100 rounded-md px-4 py-2 flex gap-6">
        <button className="font-semibold text-gray-900">Spaces</button>
        <button className="text-gray-500">Transport</button>
        <button className="text-gray-500">Media</button>
        <button className="text-gray-500">Mess</button>
         <button className="text-gray-500">Approvals</button>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-3">
       {/*<div className="bg-gray-100 px-3 py-1 rounded">2</div>*/}
        <div className="bg-gray-100 px-3 py-1 rounded">🌙</div>
        <div className="bg-black text-white w-8 h-8 flex items-center justify-center rounded">
          A
        </div>
      </div>

    </div>
  )
}

export default Navbar