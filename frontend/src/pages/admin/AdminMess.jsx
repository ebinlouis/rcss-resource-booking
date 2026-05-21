import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import messService from "../../api/messService";
import notificationService from "../../api/notificationService";
import { MEALS, getEarliestTime, getRequestedMeals, formatDateRange, isMultiDay } from "../../api/messConfig";
import {
  CheckCircle2, XCircle, Clock3, Users, UtensilsCrossed,
  X, CalendarDays, ChefHat, ChevronRight, History,
  MapPin, User, Building, AlertCircle, ShieldOff, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Pure helpers ──────────────────────────────────────────────────────────────

const formatDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const getTomorrowStr = () => {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return formatDate(t);
};

const getRequesterName  = (b) => b.requester_name || "Staff Member";
const getDepartmentName = (b) => {
  if (b.department_name)                return b.department_name;
  if (typeof b.department === "number") return "Department Pending";
  if (typeof b.department === "string") return b.department;
  return "General";
};

const normaliseReference = (value) => String(value || "").trim().toUpperCase();

// Sum a numeric field across all daily_menus rows (falls back to the flat
// top-level field for legacy single-day bookings that lack daily_menus).
const sumField = (booking, field) => {
  const menus = booking?.daily_menus;
  if (Array.isArray(menus) && menus.length > 0)
    return menus.reduce((s, m) => s + (Number(m[field]) || 0), 0);
  return Number(booking?.[field]) || 0;
};

// Get the DayMenu row for a specific date string from a booking.
const getDayMenu = (booking, dateStr) =>
  booking?.daily_menus?.find((m) => m.date === dateStr) ?? null;

// Returns true if `dateStr` falls within booking's start_date…end_date range.
const bookingCoversDate = (booking, dateStr) => {
  const { start_date, end_date } = booking;
  if (!start_date) return false;
  const ed = end_date || start_date;
  return dateStr >= start_date && dateStr <= ed;
};

// ── Access denied screen ──────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <ShieldOff size={28} className="text-red-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
      <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
        You don't have permission to view this page. Mess Operations is only
        accessible to users with the <span className="font-semibold text-gray-700">Mess</span> role.
      </p>
      <p className="text-xs text-gray-400 mt-4">
        Contact your IT administrator if you believe this is a mistake.
      </p>
    </div>
  );
}

// ── BookingCard ───────────────────────────────────────────────────────────────

function BookingCard({ booking, onSelect, isHighlighted }) {
  const meals       = getRequestedMeals(booking);
  const statusLower = booking.status?.toLowerCase();
  const multiDay    = isMultiDay(booking);
  const totalPax    = sumField(booking, "total_persons");
  const dateLabel   = formatDateRange(booking.start_date, booking.end_date);
  const dayCount    = booking.daily_menus?.length ?? 1;

  return (
    <div
      data-booking-reference={booking.reference_code || ""}
      onClick={() => onSelect(booking)}
      className={`bg-white border rounded-xl p-5 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${isHighlighted ? "border-emerald-400 ring-2 ring-emerald-300 bg-emerald-50/70" : "border-gray-200"}`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
            statusLower === "pending"   ? "bg-amber-50 text-amber-700"    :
            statusLower === "confirmed" || statusLower === "approved" ? "bg-emerald-50 text-emerald-700" :
            statusLower === "completed" ? "bg-slate-50 text-slate-700" :
            statusLower === "expired"   ? "bg-orange-50 text-orange-700" :
                                          "bg-red-50 text-red-700"
          }`}>
            {booking.status}
          </span>
          {multiDay && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-blue-50 text-blue-700">
              {dayCount} Days
            </span>
          )}
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
          <span className="flex items-center gap-1.5">
            <CalendarDays size={15} className="text-gray-400" />{dateLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock3 size={15} className="text-gray-400" />Starts {getEarliestTime(booking)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={15} className="text-gray-400" />{booking.delivery_location}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={15} className="text-gray-400" />
            {multiDay ? `${totalPax} total pax (${dayCount} days)` : `${totalPax} Pax`}
          </span>
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
        View Details <ChevronRight size={16} />
      </div>
    </div>
  );
}

// ── DayMenuDetail — collapsible per-day section inside the side panel ─────────

function DayMenuDetail({ dayMenu, dayIndex, totalDays, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? dayIndex === 0);

  const activeMeals = MEALS.filter((m) => dayMenu[m.timeKey]);

  const fmt = (dateStr) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short",
    });

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Day {dayIndex + 1}
            {totalDays > 1 && <span className="ml-1 text-gray-400 font-normal">of {totalDays}</span>}
          </span>
          <span className="text-sm font-semibold text-gray-800">{fmt(dayMenu.date)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
            {dayMenu.total_persons} pax
          </span>
          {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4 bg-white">

          {/* Headcount row */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            {[
              { value: dayMenu.veg_persons,    label: "Veg",     color: "text-emerald-600" },
              { value: dayMenu.nonveg_persons,  label: "Non-Veg", color: "text-red-600"     },
              { value: dayMenu.total_persons,   label: "Total",   color: "text-gray-900"    },
            ].map(({ value, label, color }, i, arr) => (
              <React.Fragment key={label}>
                <div className="text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-[10px] font-medium text-gray-500 mt-0.5">{label}</p>
                </div>
                {i < arr.length - 1 && <div className="w-px h-8 bg-gray-200" />}
              </React.Fragment>
            ))}
          </div>

          {/* Meals */}
          {activeMeals.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-2">No meals configured for this day.</p>
          ) : (
            <div className="space-y-2">
              {activeMeals.map(({ id, label, timeKey, menuKey }) => (
                <div key={id} className="border border-gray-100 rounded-lg p-3 bg-white shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                    <span className="text-xs font-bold text-emerald-600">
                      {dayMenu[timeKey]?.slice(0, 5)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed">{dayMenu[menuKey]}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AdminMess ─────────────────────────────────────────────────────────────────

function AdminMess() {
  const { can_manage_mess, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const highlightedReference = searchParams.get("booking") || "";

  const [activeTab,      setActiveTab]      = useState(() => (
    ["pending", "dispatch", "history"].includes(requestedTab) ? requestedTab : "pending"
  ));
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

  // ── Data fetching ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!can_manage_mess) return;
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
  }, [refreshTrigger, can_manage_mess]);

  // ── Panel helpers ────────────────────────────────────────────────────────────

  const openPanel = useCallback((booking) => {
    setSelectedBooking(booking);
    setShowRejectInput(false);
    setRejectRemark("");
    setRemarkError("");
  }, []);

  const closePanel  = useCallback(() => setSelectedBooking(null), []);
  const showToast   = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  }, []);

  useEffect(() => {
    if (!["pending", "dispatch", "history"].includes(requestedTab)) return undefined;
    const timer = window.setTimeout(() => setActiveTab(requestedTab), 0);
    return () => window.clearTimeout(timer);
  }, [requestedTab]);

  // ── Derived lists ────────────────────────────────────────────────────────────

  const pendingBookings = bookings.filter((b) => b.status?.toLowerCase() === "pending");

  const historyBookings = [...bookings].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  // Multi-day aware: a booking appears on a dispatch day if that date falls
  // anywhere within start_date…end_date, not just if booking_date matches.
  const dispatchBookings = bookings
    .filter((b) =>
      bookingCoversDate(b, dispatchDate) &&
      ["confirmed", "approved"].includes(b.status?.toLowerCase())
    )
    .sort((a, b) => getEarliestTime(a).localeCompare(getEarliestTime(b)));

  // Prep totals: for multi-day bookings only count the selected day's row.
  const totalPrep = dispatchBookings.reduce(
    (acc, b) => {
      const dayMenu = getDayMenu(b, dispatchDate);
      // If a matching day row exists use it; otherwise fall back to flat fields
      // (handles legacy single-day bookings without daily_menus).
      const total  = Number(dayMenu?.total_persons  ?? b.total_persons  ?? 0);
      const veg    = Number(dayMenu?.veg_persons    ?? b.veg_persons    ?? 0);
      const nonveg = Number(dayMenu?.nonveg_persons ?? b.nonveg_persons ?? 0);
      return {
        total:  acc.total  + total,
        veg:    acc.veg    + veg,
        nonveg: acc.nonveg + nonveg,
      };
    },
    { total: 0, veg: 0, nonveg: 0 }
  );

  useEffect(() => {
    if (!highlightedReference || isLoading || bookings.length === 0) return undefined;

    const targetBooking = bookings.find(
      (booking) => normaliseReference(booking.reference_code) === normaliseReference(highlightedReference)
    );
    if (!targetBooking) return undefined;

    const timer = window.setTimeout(() => {
      setActiveTab(targetBooking.status?.toLowerCase() === "pending" ? "pending" : "history");
      openPanel(targetBooking);

      const target = Array.from(document.querySelectorAll("[data-booking-reference]"))
        .find((element) => normaliseReference(element.getAttribute("data-booking-reference")) === normaliseReference(highlightedReference));
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [bookings, highlightedReference, isLoading, openPanel]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleApprove = async (booking) => {
    setActionLoading(true);
    try {
      await messService.approveBooking(booking.id);
      await notificationService.markBookingRead(booking.reference_code, "mess").catch(() => null);
      if (normaliseReference(booking.reference_code) === normaliseReference(highlightedReference)) {
        navigate("/admin/mess?tab=pending", { replace: true });
      }
      setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: "APPROVED" } : b));
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
      await notificationService.markBookingRead(selectedBooking.reference_code, "mess").catch(() => null);
      if (normaliseReference(selectedBooking.reference_code) === normaliseReference(highlightedReference)) {
        navigate("/admin/mess?tab=pending", { replace: true });
      }
      setBookings((prev) =>
        prev.map((b) =>
          b.id === selectedBooking.id
            ? { ...b, status: "rejected", rejection_remark: trimmed }
            : b
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

  // ── Auth loading ─────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <span className="w-6 h-6 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!can_manage_mess) return <AccessDenied />;

  // ── Render ───────────────────────────────────────────────────────────────────

  const TABS = [
    { id: "pending",  label: "Needs Approval",        count: pendingBookings.length,  icon: Clock3  },
    { id: "dispatch", label: "Daily Kitchen Schedule", count: dispatchBookings.length, icon: ChefHat },
    { id: "history",  label: "All Records",            count: null,                    icon: History },
  ];

  // For the side panel: figure out if this is multi-day and grab daily_menus
  const panelMenus     = selectedBooking?.daily_menus ?? [];
  const panelMultiDay  = isMultiDay(selectedBooking ?? {});
  const panelTotalPax  = selectedBooking ? sumField(selectedBooking, "total_persons") : 0;

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
              <BookingCard
                key={b.id}
                booking={b}
                onSelect={openPanel}
                isHighlighted={normaliseReference(b.reference_code) === normaliseReference(highlightedReference)}
              />
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
                  <p className="text-xs text-gray-500">Meals needed for selected day across all events.</p>
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
              ) : dispatchBookings.map((b) => {
                const dayMenu  = getDayMenu(b, dispatchDate);
                // For the timeline, show the earliest meal time on the specific day
                const dayTimes = dayMenu
                  ? MEALS.map((m) => dayMenu[m.timeKey]).filter(Boolean).sort()
                  : [];
                const displayTime = dayTimes[0]?.slice(0, 5) ?? getEarliestTime(b);
                const multiDay    = isMultiDay(b);

                return (
                  <div
                    key={b.id}
                    data-booking-reference={b.reference_code || ""}
                    onClick={() => openPanel(b)}
                    className={`flex gap-4 p-4 hover:bg-gray-50 rounded-xl cursor-pointer transition ${normaliseReference(b.reference_code) === normaliseReference(highlightedReference) ? "bg-emerald-50 ring-2 ring-emerald-300" : ""}`}
                  >
                    <div className="w-20 text-right shrink-0">
                      <span className="text-sm font-bold text-emerald-700">{displayTime}</span>
                    </div>
                    <div className="w-px bg-gray-200 relative">
                      <div className="absolute top-1.5 -left-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                    </div>
                    <div className="pb-4 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-gray-900">{b.purpose_of_programme}</h4>
                        {multiDay && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 uppercase tracking-wider">
                            Day {(b.daily_menus?.findIndex((m) => m.date === dispatchDate) ?? 0) + 1} of {b.daily_menus?.length}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-600 mt-1">@ {b.delivery_location}</p>
                      {dayMenu && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          <span className="text-emerald-600 font-semibold">{dayMenu.total_persons}</span> pax
                          {" · "}
                          <span className="text-emerald-600">{dayMenu.veg_persons} veg</span>
                          {" / "}
                          <span className="text-red-500">{dayMenu.nonveg_persons} non-veg</span>
                        </p>
                      )}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {(dayMenu
                          ? MEALS.filter((m) => dayMenu[m.timeKey]).map((m) => m.label)
                          : getRequestedMeals(b)
                        ).map((ml) => (
                          <span key={ml} className="px-2 py-0.5 bg-white border border-gray-200 text-gray-600 text-[9px] rounded-md uppercase font-bold tracking-wider shadow-sm">{ml}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
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
              <BookingCard
                key={b.id}
                booking={b}
                onSelect={openPanel}
                isHighlighted={normaliseReference(b.reference_code) === normaliseReference(highlightedReference)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Slide-over review panel ── */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Booking Details</h2>
                <p className="text-xs font-mono text-gray-500 mt-1">{selectedBooking.reference_code}</p>
              </div>
              <button onClick={closePanel} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

              {/* Event info */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Event Information</p>
                <div className="flex items-start gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-gray-900">{selectedBooking.purpose_of_programme}</h3>
                  {panelMultiDay && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 uppercase tracking-wider mt-1">
                      {panelMenus.length} Days
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Requested By</p>
                    <p className="font-medium text-sm text-gray-900">{getRequesterName(selectedBooking)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{getDepartmentName(selectedBooking)}</p>
                  </div>
                  <div className="col-span-2 border-t border-gray-200 my-1" />
                  <div className={panelMultiDay ? "col-span-2" : ""}>
                    <p className="text-xs text-gray-500 mb-1">{panelMultiDay ? "Date Range" : "Date"}</p>
                    <p className="font-medium text-sm text-gray-900 flex items-center gap-1.5">
                      <CalendarDays size={14} className="text-emerald-600" />
                      {formatDateRange(selectedBooking.start_date, selectedBooking.end_date)}
                    </p>
                  </div>
                  {!panelMultiDay && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">First Delivery</p>
                      <p className="font-medium text-sm text-gray-900 flex items-center gap-1.5">
                        <Clock3 size={14} className="text-emerald-600" />{getEarliestTime(selectedBooking)}
                      </p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Location</p>
                    <p className="font-medium text-sm text-gray-900 flex items-center gap-1.5">
                      <MapPin size={14} className="text-emerald-600" />{selectedBooking.delivery_location}
                    </p>
                  </div>
                </div>
              </div>

              {/* Overall headcount summary (multi-day: totals across all days) */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {panelMultiDay ? `Headcount Summary (All ${panelMenus.length} Days)` : "Headcount"}
                </p>
                <div className="flex items-center justify-between bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                  {[
                    { value: sumField(selectedBooking, "veg_persons"),    label: "Veg",     color: "text-emerald-600" },
                    { value: sumField(selectedBooking, "nonveg_persons"),  label: "Non-Veg", color: "text-red-600"     },
                    { value: panelTotalPax,                                label: "Total",   color: "text-gray-900"    },
                  ].map(({ value, label, color }, i, arr) => (
                    <React.Fragment key={label}>
                      <div className="text-center w-1/3">
                        <p className={`text-2xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs font-medium text-gray-500 mt-0.5">
                          {label}{panelMultiDay ? " (total)" : " Plates"}
                        </p>
                      </div>
                      {i < arr.length - 1 && <div className="w-px h-10 bg-gray-200" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Daily menus — collapsible per-day sections */}
              {panelMenus.length > 0 ? (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    {panelMultiDay ? "Daily Menus" : "Catering Menu"}
                  </p>
                  <div className="space-y-2">
                    {panelMenus.map((dayMenu, idx) => (
                      <DayMenuDetail
                        key={dayMenu.date}
                        dayMenu={dayMenu}
                        dayIndex={idx}
                        totalDays={panelMenus.length}
                        defaultOpen={!panelMultiDay || idx === 0}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                // Fallback for legacy flat bookings with no daily_menus array
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Catering Menu</p>
                  <div className="space-y-3">
                    {MEALS.filter((m) => selectedBooking[m.timeKey]).map(({ id, label, timeKey, menuKey }) => (
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
              )}

              {/* User notes */}
              {selectedBooking.user_notes && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</p>
                  <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 leading-relaxed">
                    {selectedBooking.user_notes}
                  </p>
                </div>
              )}

              {/* Rejection remark (if already rejected) */}
              {selectedBooking.status?.toLowerCase() === "rejected" && selectedBooking.rejection_remark && (
                <div>
                  <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Rejection Reason</p>
                  <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 leading-relaxed">
                    {selectedBooking.rejection_remark}
                  </p>
                </div>
              )}
            </div>

            {/* Action footer — only for pending bookings */}
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
                      <button onClick={() => handleApprove(selectedBooking)} disabled={actionLoading}
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
