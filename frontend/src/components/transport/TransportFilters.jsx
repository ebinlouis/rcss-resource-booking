/**
 * TransportFilters.jsx
 *
 * Lightweight search + vehicle-filter toolbar for the Transport admin page.
 *
 * Props:
 *   searchQuery   {string}      current text search value
 *   vehicleFilter {string}      current vehicle name filter ("" = all)
 *   vehicles      {Array}       list of { name, id } objects from existing bookings
 *   onSearch      {fn(string)}
 *   onVehicle     {fn(string)}
 *   resultCount   {number}      how many bookings match the combined filters
 *   totalCount    {number}      total bookings before filtering
 */

export default function TransportFilters({
    searchQuery,
    vehicleFilter,
    vehicles,
    onSearch,
    onVehicle,
    resultCount,
    totalCount,
}) {
    const inputCls = `
        w-full border border-[#dbe7df] rounded-xl px-4 py-2.5
        text-[13.5px] text-[#374151] placeholder-[#94a3b8]
        outline-none transition
        focus:border-[#15803d] focus:ring-2 focus:ring-[#dcfce7]
        bg-white
    `

    const hasFilters = searchQuery.trim() !== '' || vehicleFilter !== ''

    return (
        <div className="bg-white rounded-2xl border border-[#e8f5ee] shadow-sm px-5 py-4">
            <div className="flex flex-col sm:flex-row gap-3">
                {/* ── Text search ── */}
                <div className="relative flex-1 min-w-0">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder="Search by requester, destination, vehicle, reference…"
                        value={searchQuery}
                        onChange={(e) => onSearch(e.target.value)}
                        className={`${inputCls} pl-10`}
                    />
                </div>

                {/* ── Vehicle dropdown ── */}
                <div className="sm:w-56 shrink-0">
                    <select
                        value={vehicleFilter}
                        onChange={(e) => onVehicle(e.target.value)}
                        className={`${inputCls} cursor-pointer`}
                    >
                        <option value="">All Vehicles</option>
                        {vehicles.map((v) => (
                            <option key={v.name} value={v.name}>
                                {v.name}
                                {v.reg ? ` — ${v.reg}` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {/* ── Clear all filters ── */}
                {hasFilters && (
                    <button
                        onClick={() => { onSearch(''); onVehicle('') }}
                        className="
                            shrink-0 inline-flex items-center gap-1.5
                            px-4 py-2.5 rounded-xl
                            border border-[#e2e8f0]
                            text-[12.5px] font-semibold text-[#6b7280]
                            hover:bg-[#f1f5f9] hover:text-[#374151]
                            transition
                        "
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear
                    </button>
                )}
            </div>

            {/* ── Result count hint ── */}
            {hasFilters && (
                <p className="mt-2.5 text-[12px] font-medium text-[#6b7280]">
                    Showing{' '}
                    <span className="font-bold text-[#0f172a]">{resultCount}</span>
                    {' '}of{' '}
                    <span className="font-bold text-[#0f172a]">{totalCount}</span>
                    {' '}bookings
                </p>
            )}
        </div>
    )
}
