import React, { useState, useEffect, useCallback } from "react";
import messService from "../../api/messService";
import { MEALS, getEarliestTime, getRequestedMeals } from "../../api/messConfig";
import {
  CheckCircle2, XCircle, Clock3, Users, UtensilsCrossed,
  X, CalendarDays, ChefHat, ChevronRight, History,
  MapPin, User, Building, AlertCircle,
} from "lucide-react";

// ── Pure helpers (defined outside components — never recreated on re-render) ──

const formatDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const getTomorrowStr = () => {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return formatDate(t);
};

const getRequesterName  = (b) => b.requester_name || "Staff Member";
const getDepartmentName = (b) => {
  if (b.department_name)               return b.department_name;
  if (typeof b.department === "number") return "Department Pending";
  if (typeof b.department === "string") return b.department;
  return "General";
};

// ── BookingCard ───────────────────────────────────────────────────────────────

function BookingCard({ booking, onSelect }) {
  const meals       = getRequestedMeals(booking);
  const statusLower = booking.status?.toLowerCase();

  return (
    <div
      onClick={() => onSelect(booking)}
      className="bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
            statusLower === "pending"   ? "bg-amber-50 text-amber-700"   :
            statusLower === "confirmed" ? "bg-emerald-50 text-emerald-700" :
                                          "bg-red-50 text-red-700"
          }`}>
            {booking.status}
          </span>
          <span className="text-xs font-mono text-gray-400">{booking.reference_code}</span>
        </div>

        <h3 className="text-base font-bold text-gray-900">{booking.purpose_of_programme}</h3>

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700 mt-2 mb-3 bg-gray-50/70 p-2.5 rounded-lg border border-gray-100 w-fit">
          <span className="flex items-center gap-1.5 font-semibold">
            <User size={14} className="text-emerald-600" />{getRequesterName(booking)}
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1.5">
            <Building size={14} className="text-emerald-600" />{getDepartmentName(booking)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-2 font-medium">
          <span className="flex items-center gap-1.5"><CalendarDays size={15} className="text-gray-400" />{booking.booking_date}</span>
          <span className="flex items-center gap-1.5"><Clock3 size={15} className="text-gray-400" />Starts {getEarliestTime(booking)}</span>
          <span className="flex items-center gap-1.5"><MapPin size={15} className="text-gray-400" />{booking.delivery_location}</span>
          <span className="flex items-center gap-1.5"><Users size={15} className="text-gray-400" />{booking.total_persons} Pax</span>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {meals.length > 0
            ? meals.map((m) => (
                <span key={m} className="px-2.5 py-1 bg-white border border-gray-200 text-gray-600 text-[10px] rounded-md uppercase font-bold tracking-wider shadow-sm">{m}</span>
              ))
            : <span className="text-xs text-gray-400 italic">No specific meals requested</span>
          }
        </div>
      </div>

      <div className="flex items-center text-sm font-medium text-emerald-600 gap-1 shrink-0 mt-4 md:mt-0 bg-emerald-50 px-4 py-2 rounded-lg">
        View Menu <ChevronRight size={16} />
      </div>
    </div>
  );
}

// ── AdminMess ─────────────────────────────────────────────────────────────────

function AdminMess() {
  const [activeTab,      setActiveTab]      = useState("pending");
  const [bookings,       setBookings]       = useState([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [toastMsg,       setToastMsg]       = useState("");
  const [dispatchDate,   setDispatchDate]   = useState(getTomorrowStr);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [selectedBooking,  setSelectedBooking]  = useState(null);
  const [actionLoading,    setActionLoading]    = useState(false);
  const [showRejectInput,  setShowRejectInput]  = useState(false);
  const [rejectRemark,     setRejectRemark]     = useState("");
  const [remarkError,      setRemarkError]      = useState("");

  // ── Data fetching ───────────────────────────────────────────────────────────

  useEffect(() => {
    const isMounted = { current: true };

    const fetchBookings = async () => {
      setIsLoading(true);
      try {
        const data = await messService.getAllBookings();
        if (isMounted.current)
          setBookings(Array.isArray(data) ? data : data.results || []);
      } catch (err) {
        console.error("Failed to fetch mess bookings:", err);
      } finally {
        if (isMounted.current) setIsLoading(false);
      }
    };

    fetchBookings();
    return () => { isMounted.current = false; };
  }, [refreshTrigger]);

  // ── Panel helpers ───────────────────────────────────────────────────────────

  const openPanel = useCallback((booking) => {
    setSelectedBooking(booking);
    setShowRejectInput(false);
    setRejectRemark("");
    setRemarkError("");
  }, []);

  const closePanel = useCallback(() => setSelectedBooking(null), []);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  }, []);

  // ── Derived lists ───────────────────────────────────────────────────────────

  const pendingBookings = bookings.filter((b) => b.status?.toLowerCase() === "pending");

  const historyBookings = [...bookings].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const dispatchBookings = bookings
    .filter((b) => b.booking_date === dispatchDate && b.status?.toLowerCase() === "confirmed")
    .sort((a, b) => getEarliestTime(a).localeCompare(getEarliestTime(b)));

  const totalPrep = dispatchBookings.reduce(
    (acc, b) => ({
      total:  acc.total  + (b.total_persons  || 0),
      veg:    acc.veg    + (b.veg_persons    || 0),
      nonveg: acc.nonveg + (b.nonveg_persons || 0),
    }),
    { total: 0, veg: 0, nonveg: 0 }
  );

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleApprove = async (id) => {
    setActionLoading(true);
    try {
      await messService.approveBooking(id);
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "confirmed" } : b));
      showToast("Booking approved.");
      closePanel();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to approve booking.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectClick = () => {
    if (!showRejectInput) {
      setShowRejectInput(true);
    } else {
      setShowRejectInput(false);
      setRejectRemark("");
      setRemarkError("");
    }
  };

  const handleConfirmReject = async () => {
    const trimmed = rejectRemark.trim();
    if (!trimmed) {
      setRemarkError("A rejection reason is required before proceeding.");
      return;
    }
    setActionLoading(true);
    setRemarkError("");
    try {
      await messService.rejectBooking(selectedBooking.id, trimmed);
      setBookings((prev) =>
        prev.map((b) =>
          b.id === selectedBooking.id ? { ...b, status: "rejected", rejection_remark: trimmed } : b
        )
      );
      showToast("Booking rejected.");
      closePanel();
    } catch (err) {
      setRemarkError(
        err.response?.data?.rejection_remark ||
        err.response?.data?.detail ||
        "Failed to reject booking."
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const TABS = [
    { id: "pending",  label: "Needs Approval",        count: pendingBookings.length,  icon: Clock3  },
    { id: "dispatch", label: "Daily Kitchen Schedule", count: dispatchBookings.length, icon: ChefHat },
    { id: "history",  label: "All Records",            count: null,                    icon: History },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50/50 relative font-geist">

      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-5">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 sm:px-8 pt-8 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mess Operations</h1>
            <p className="text-sm text-gray-500 mt-1">Manage catering requests and view kitchen schedules.</p>
          </div>
          <button
            onClick={() => setRefreshTrigger((p) => p + 1)}
            disabled={isLoading}
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition disabled:opacity-50"
          >
            {isLoading ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>

        <div className="flex gap-6 overflow-x-auto">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`pb-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <TabIcon size={16} />
                {tab.label}
                {tab.count !== null && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === tab.id ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8">

        {/* ── Pending tab ── */}
        {activeTab === "pending" && (
          <div className="space-y-4 max-w-5xl">
            {isLoading ? (
              <p className="text-sm text-gray-400">Loading pending requests...</p>
            ) : pendingBookings.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
                <CheckCircle2 size={40} className="text-emerald-100 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900">All Caught Up!</h3>
                <p className="text-sm text-gray-500 mt-1">There are no catering requests waiting for your approval.</p>
              </div>
            ) : pendingBookings.map((b) => (
              <BookingCard key={b.id} booking={b} onSelect={openPanel} />
            ))}
          </div>
        )}

        {/* ── Dispatch tab ── */}
        {activeTab === "dispatch" && (
          <div className="max-w-5xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                  <ChefHat size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Prep Totals</h2>
                  <p className="text-xs text-gray-500">Total meals needed for the selected day.</p>
                </div>
              </div>
              <input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-full sm:w-auto"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[
                { label: "Total Plates Needed", value: totalPrep.total,  border: "border-gray-100",    textColor: "text-gray-400",    iconColor: "text-gray-400"    },
                { label: "Veg Plates",           value: totalPrep.veg,    border: "border-emerald-100", textColor: "text-emerald-600", iconColor: "text-emerald-600" },
                { label: "Non-Veg Plates",       value: totalPrep.nonveg, border: "border-red-100",     textColor: "text-red-600",     iconColor: "text-red-600"     },
              ].map(({ label, value, border, textColor, iconColor }) => (
                <div key={label} className={`bg-white p-5 rounded-2xl border ${border} shadow-sm relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 p-3 opacity-10"><UtensilsCrossed size={40} className={iconColor} /></div>
                  <p className={`text-xs font-semibold ${textColor} uppercase tracking-widest mb-1`}>{label}</p>
                  <p className="text-3xl font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Event Delivery Timeline</h3>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2">
              {dispatchBookings.length === 0 ? (
                <p className="text-sm text-gray-400 p-6 text-center">No catering events are scheduled for this date.</p>
              ) : dispatchBookings.map((b) => (
                <div key={b.id} onClick={() => openPanel(b)} className="flex gap-4 p-4 hover:bg-gray-50 rounded-xl cursor-pointer transition">
                  <div className="w-20 text-right shrink-0">
                    <span className="text-sm font-bold text-emerald-700">{getEarliestTime(b)}</span>
                  </div>
                  <div className="w-px bg-gray-200 relative">
                    <div className="absolute top-1.5 -left-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>
                  <div className="pb-4">
                    <h4 className="text-sm font-bold text-gray-900">{b.purpose_of_programme}</h4>
                    <p className="text-xs font-medium text-gray-600 mt-1">@ {b.delivery_location}</p>
                    <div className="flex gap-2 mt-2">
                      {getRequestedMeals(b).map((m) => (
                        <span key={m} className="px-2 py-0.5 bg-white border border-gray-200 text-gray-600 text-[9px] rounded-md uppercase font-bold tracking-wider shadow-sm">{m}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── History tab ── */}
        {activeTab === "history" && (
          <div className="space-y-4 max-w-5xl">
            {isLoading ? (
              <p className="text-sm text-gray-400">Loading all records...</p>
            ) : historyBookings.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
                <History size={40} className="text-gray-200 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900">No Records Found</h3>
                <p className="text-sm text-gray-500 mt-1">There is no past booking history in the system yet.</p>
              </div>
            ) : historyBookings.map((b) => (
              <BookingCard key={b.id} booking={b} onSelect={openPanel} />
            ))}
          </div>
        )}
      </div>

      {/* ── Slide-over review panel ── */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Booking Details</h2>
                <p className="text-xs font-mono text-gray-500 mt-1">{selectedBooking.reference_code}</p>
              </div>
              <button onClick={closePanel} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition">
                <X size={20} />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

              {/* Event info */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Event Information</p>
                <h3 className="text-lg font-bold text-gray-900">{selectedBooking.purpose_of_programme}</h3>

                <div className="grid grid-cols-2 gap-4 mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Requested By</p>
                    <p className="font-medium text-sm text-gray-900">{getRequesterName(selectedBooking)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{getDepartmentName(selectedBooking)}</p>
                  </div>
                  <div className="col-span-2 border-t border-gray-200 my-1" />
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Date</p>
                    <p className="font-medium text-sm text-gray-900 flex items-center gap-1.5">
                      <CalendarDays size={14} className="text-emerald-600" />{selectedBooking.booking_date}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">First Delivery</p>
                    <p className="font-medium text-sm text-gray-900 flex items-center gap-1.5">
                      <Clock3 size={14} className="text-emerald-600" />{getEarliestTime(selectedBooking)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Location</p>
                    <p className="font-medium text-sm text-gray-900 flex items-center gap-1.5">
                      <MapPin size={14} className="text-emerald-600" />{selectedBooking.delivery_location}
                    </p>
                  </div>
                </div>
              </div>

              {/* Headcount */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Headcount</p>
                <div className="flex items-center justify-between bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                  {[
                    { value: selectedBooking.veg_persons,    label: "Veg Plates",     color: "text-emerald-600" },
                    { value: selectedBooking.nonveg_persons,  label: "Non-Veg Plates", color: "text-red-600"     },
                    { value: selectedBooking.total_persons,   label: "Total Plates",   color: "text-gray-900"    },
                  ].map(({ value, label, color }, i, arr) => (
                    <React.Fragment key={label}>
                      <div className="text-center w-1/3">
                        <p className={`text-2xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
                      </div>
                      {i < arr.length - 1 && <div className="w-px h-10 bg-gray-200" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Catering menu — driven by MEALS constant */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Catering Menu</p>
                <div className="space-y-3">
                  {MEALS.filter((m) => selectedBooking[`${m.id}_required`]).map(({ id, label, timeKey, menuKey }) => (
                    <div key={id} className="border border-gray-100 rounded-lg p-3 bg-white shadow-sm">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                        <span className="text-xs font-bold text-emerald-600">
                          {selectedBooking[timeKey]?.slice(0, 5)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 leading-relaxed">{selectedBooking[menuKey]}</p>
                    </div>
                  ))}
                  {getRequestedMeals(selectedBooking).length === 0 && (
                    <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-lg text-center border border-gray-100">
                      No specific menu items were detailed for this request.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Admin action footer — only shown for pending bookings */}
            {selectedBooking.status?.toLowerCase() === "pending" && (
              <div className="border-t border-gray-100 bg-white shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                {showRejectInput && (
                  <div className="px-6 pt-4 pb-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Rejection Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={rejectRemark}
                      onChange={(e) => { setRejectRemark(e.target.value); if (remarkError) setRemarkError(""); }}
                      placeholder="Provide a clear reason so the requester can act on it..."
                      className={`w-full text-sm border rounded-xl px-3 py-2.5 resize-none outline-none transition focus:ring-2 ${
                        remarkError
                          ? "border-red-300 focus:ring-red-200 bg-red-50"
                          : "border-gray-200 focus:ring-emerald-500/20 focus:border-emerald-500"
                      }`}
                    />
                    {remarkError && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <AlertCircle size={13} className="text-red-500 shrink-0" />
                        <p className="text-xs text-red-600">{remarkError}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-6 pt-3 grid grid-cols-2 gap-3">
                  {showRejectInput ? (
                    <>
                      <button onClick={handleRejectClick} disabled={actionLoading}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-50">
                        Cancel
                      </button>
                      <button onClick={handleConfirmReject} disabled={actionLoading}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-50">
                        {actionLoading
                          ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <><XCircle size={18} /> Confirm Rejection</>}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={handleRejectClick} disabled={actionLoading}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition disabled:opacity-50">
                        <XCircle size={18} /> Reject
                      </button>
                      <button onClick={() => handleApprove(selectedBooking.id)} disabled={actionLoading}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50">
                        {actionLoading
                          ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <><CheckCircle2 size={18} /> Approve</>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminMess;