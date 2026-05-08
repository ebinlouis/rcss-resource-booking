import React, { useState, useEffect } from "react";
import messService from "../../api/messService";
import {
  CheckCircle2,
  XCircle,
  Clock3,
  Users,
  UtensilsCrossed,
  X,
  CalendarDays,
  ChefHat,
  ChevronRight,
  History,
  MapPin,
  User,
  Building
} from "lucide-react";

function AdminMess() {
  // Date Helpers
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const formatDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // State
  const [activeTab, setActiveTab] = useState("pending");
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const [dispatchDate, setDispatchDate] = useState(formatDate(tomorrow));
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Panel State
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Initial Fetch & Refresh Logic
  useEffect(() => {
    let isMounted = true;

    const fetchBookings = async () => {
      setIsLoading(true);
      try {
        const data = await messService.getBookings();
        if (isMounted) {
          const bookingArray = Array.isArray(data) ? data : (data.results || []);
          setBookings(bookingArray);
        }
      } catch (err) {
        console.error("Failed to fetch mess bookings:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchBookings();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const showToast = (message) => {
    setToastMsg(message);
    setTimeout(() => setToastMsg(""), 4000);
  };

  // Helper to extract requested meals for quick-glance badges
  const getRequestedMeals = (b) => {
    const meals = [];
    if (b.breakfast_required) meals.push("Breakfast");
    if (b.morning_tea_required) meals.push("Morning Tea");
    if (b.lunch_required) meals.push("Lunch");
    if (b.evening_tea_required) meals.push("Evening Tea");
    if (b.dinner_required) meals.push("Dinner");
    return meals;
  };

  // Derived Data 
  const pendingBookings = bookings.filter((b) => b.status?.toLowerCase() === "pending");
  const historyBookings = [...bookings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  // Kitchen Dispatch Logic
  const dispatchBookings = bookings.filter(
    (b) => b.booking_date === dispatchDate && b.status?.toLowerCase() === "confirmed"
  ).sort((a, b) => (a.delivery_time || "").localeCompare(b.delivery_time || ""));

  const totalPrep = dispatchBookings.reduce(
    (acc, b) => {
      acc.total += b.total_persons || 0;
      acc.veg += b.veg_persons || 0;
      acc.nonveg += b.nonveg_persons || 0;
      return acc;
    },
    { total: 0, veg: 0, nonveg: 0 }
  );

  // Admin Actions
  const handleApprove = async (id) => {
    setActionLoading(true);
    try {
      await messService.approveBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "confirmed" } : b)));
      showToast("Booking Approved.");
      setSelectedBooking(null);
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to approve booking.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id) => {
    setActionLoading(true);
    try {
      await messService.rejectBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "rejected" } : b)));
      showToast("Booking Rejected.");
      setSelectedBooking(null);
    } catch {
      alert("Failed to reject booking.");
    } finally {
      setActionLoading(false);
    }
  };

  // 🔥 UPDATED HELPERS: Strictly check for the new string names sent by the Django serializer
  const getRequesterName = (b) => {
    if (b.requester_name) return b.requester_name;
    return "Staff Member"; 
  };

  const getDepartmentName = (b) => {
    if (b.department_name) return b.department_name;
    // Safeguard: If it's a raw number, show a clean fallback instead of just "1"
    if (typeof b.department === 'number') return "Department Pending";
    if (typeof b.department === 'string') return b.department;
    return "General";
  };

  // Reusable Quick Glance Card Component
  const BookingCard = ({ booking, onClick }) => {
    const meals = getRequestedMeals(booking);
    const statusLower = booking.status?.toLowerCase();
    
    return (
      <div
        onClick={() => onClick(booking)}
        className="bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
              statusLower === 'pending' ? 'bg-amber-50 text-amber-700' :
              statusLower === 'confirmed' ? 'bg-emerald-50 text-emerald-700' :
              'bg-red-50 text-red-700'
            }`}>
              {booking.status}
            </span>
            <span className="text-xs font-mono text-gray-400">{booking.reference_code}</span>
          </div>
          
          <h3 className="text-base font-bold text-gray-900">{booking.purpose_of_programme}</h3>
          
          {/* Requester & Department Highlight */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700 mt-2 mb-3 bg-gray-50/70 p-2.5 rounded-lg border border-gray-100 w-fit">
             <span className="flex items-center gap-1.5 font-semibold">
               <User size={14} className="text-emerald-600"/> {getRequesterName(booking)}
             </span>
             <span className="text-gray-300">|</span>
             <span className="flex items-center gap-1.5">
               <Building size={14} className="text-emerald-600"/> {getDepartmentName(booking)}
             </span>
          </div>
          
          {/* Quick Glance Metrics */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-2 font-medium">
            <span className="flex items-center gap-1.5"><CalendarDays size={15} className="text-gray-400"/>{booking.booking_date}</span>
            <span className="flex items-center gap-1.5"><Clock3 size={15} className="text-gray-400"/>{booking.delivery_time?.slice(0, 5)}</span>
            <span className="flex items-center gap-1.5"><MapPin size={15} className="text-gray-400"/>{booking.delivery_location}</span>
            <span className="flex items-center gap-1.5"><Users size={15} className="text-gray-400"/>{booking.total_persons} Pax</span>
          </div>

          {/* Quick Glance Meal Badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            {meals.map(m => (
              <span key={m} className="px-2.5 py-1 bg-white border border-gray-200 text-gray-600 text-[10px] rounded-md uppercase font-bold tracking-wider shadow-sm">
                {m}
              </span>
            ))}
            {meals.length === 0 && <span className="text-xs text-gray-400 italic">No specific meals requested</span>}
          </div>
        </div>

        <div className="flex items-center text-sm font-medium text-emerald-600 gap-1 shrink-0 mt-4 md:mt-0 bg-emerald-50 px-4 py-2 rounded-lg">
          View Menu <ChevronRight size={16} />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50 relative font-geist">
      
      {/* SUCCESS TOAST */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-5">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* HEADER & TABS */}
      <div className="bg-white border-b border-gray-200 px-6 sm:px-8 pt-8 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mess Operations</h1>
            <p className="text-sm text-gray-500 mt-1">Manage catering requests and view kitchen schedules.</p>
          </div>
          <button 
            onClick={handleRefresh} 
            disabled={isLoading}
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition disabled:opacity-50"
          >
            {isLoading ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>

        <div className="flex gap-6 overflow-x-auto">
          {[
            { id: "pending", label: "Needs Approval", count: pendingBookings.length, icon: Clock3 },
            { id: "dispatch", label: "Daily Kitchen Schedule", count: dispatchBookings.length, icon: ChefHat },
            { id: "history", label: "All Records", count: null, icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.count !== null && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === tab.id ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8">
        
        {/* === TAB 1: NEEDS APPROVAL === */}
        {activeTab === "pending" && (
          <div className="space-y-4 max-w-5xl">
            {isLoading ? (
              <p className="text-sm text-gray-400">Loading pending requests...</p>
            ) : pendingBookings.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
                <CheckCircle2 size={40} className="text-emerald-100 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900">All Caught Up!</h3>
                <p className="text-sm text-gray-500 mt-1">There are no catering requests waiting for your approval right now.</p>
              </div>
            ) : (
              pendingBookings.map((b) => (
                <BookingCard key={b.id} booking={b} onClick={setSelectedBooking} />
              ))
            )}
          </div>
        )}

        {/* === TAB 2: DAILY KITCHEN SCHEDULE === */}
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
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Total Plates Needed</p>
                <p className="text-3xl font-bold text-gray-900">{totalPrep.total}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10"><UtensilsCrossed size={40} className="text-emerald-600"/></div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Veg Plates</p>
                <p className="text-3xl font-bold text-gray-900">{totalPrep.veg}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10"><UtensilsCrossed size={40} className="text-red-600"/></div>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-widest mb-1">Non-Veg Plates</p>
                <p className="text-3xl font-bold text-gray-900">{totalPrep.nonveg}</p>
              </div>
            </div>

            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Event Delivery Timeline</h3>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2">
              {dispatchBookings.length === 0 ? (
                <p className="text-sm text-gray-400 p-6 text-center">No catering events are scheduled for this date.</p>
              ) : (
                dispatchBookings.map((b) => (
                  <div key={b.id} onClick={() => setSelectedBooking(b)} className="group flex gap-4 p-4 hover:bg-gray-50 rounded-xl cursor-pointer transition">
                    <div className="w-20 text-right shrink-0">
                      <span className="text-sm font-bold text-emerald-700">{b.delivery_time?.slice(0, 5)}</span>
                    </div>
                    <div className="w-px bg-gray-200 relative">
                      <div className="absolute top-1.5 -left-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></div>
                    </div>
                    <div className="pb-4">
                      <h4 className="text-sm font-bold text-gray-900">{b.purpose_of_programme}</h4>
                      <p className="text-xs font-medium text-gray-600 mt-1">@ {b.delivery_location}</p>
                      
                      <div className="flex gap-2 mt-2">
                        {getRequestedMeals(b).map(m => (
                          <span key={m} className="px-2 py-0.5 bg-white border border-gray-200 text-gray-600 text-[9px] rounded-md uppercase font-bold tracking-wider shadow-sm">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* === TAB 3: ALL RECORDS (HISTORY) === */}
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
            ) : (
              historyBookings.map((b) => (
                <BookingCard key={b.id} booking={b} onClick={setSelectedBooking} />
              ))
            )}
          </div>
        )}
      </div>

      {/* === SLIDE-OVER REVIEW PANEL (UNIVERSAL) === */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Booking Details</h2>
                <p className="text-xs font-mono text-gray-500 mt-1">{selectedBooking.reference_code}</p>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Event Information</p>
                <h3 className="text-lg font-bold text-gray-900">{selectedBooking.purpose_of_programme}</h3>
                
                <div className="grid grid-cols-2 gap-4 mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Requested By</p>
                    <p className="font-medium text-sm text-gray-900">{getRequesterName(selectedBooking)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{getDepartmentName(selectedBooking)}</p>
                  </div>
                  <div className="col-span-2 border-t border-gray-200 my-1"></div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Date</p>
                    <p className="font-medium text-sm text-gray-900 flex items-center gap-1.5"><CalendarDays size={14} className="text-emerald-600"/> {selectedBooking.booking_date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Time</p>
                    <p className="font-medium text-sm text-gray-900 flex items-center gap-1.5"><Clock3 size={14} className="text-emerald-600"/> {selectedBooking.delivery_time?.slice(0, 5)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Location</p>
                    <p className="font-medium text-sm text-gray-900 flex items-center gap-1.5"><MapPin size={14} className="text-emerald-600"/> {selectedBooking.delivery_location}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Headcount</p>
                <div className="flex items-center justify-between bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                  <div className="text-center w-1/3">
                    <p className="text-2xl font-bold text-emerald-600">{selectedBooking.veg_persons}</p>
                    <p className="text-xs font-medium text-gray-500 mt-0.5">Veg Plates</p>
                  </div>
                  <div className="w-px h-10 bg-gray-200"></div>
                  <div className="text-center w-1/3">
                    <p className="text-2xl font-bold text-red-600">{selectedBooking.nonveg_persons}</p>
                    <p className="text-xs font-medium text-gray-500 mt-0.5">Non-Veg Plates</p>
                  </div>
                  <div className="w-px h-10 bg-gray-200"></div>
                  <div className="text-center w-1/3">
                    <p className="text-2xl font-bold text-gray-900">{selectedBooking.total_persons}</p>
                    <p className="text-xs font-medium text-gray-500 mt-0.5">Total Plates</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Catering Menu</p>
                <div className="space-y-3">
                  {selectedBooking.breakfast_required && (
                    <div className="border border-gray-100 rounded-lg p-3 bg-white shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Breakfast Menu</span>
                      <p className="text-sm text-gray-800 leading-relaxed">{selectedBooking.breakfast_menu}</p>
                    </div>
                  )}
                  {selectedBooking.morning_tea_required && (
                    <div className="border border-gray-100 rounded-lg p-3 bg-white shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Morning Tea Selection</span>
                      <p className="text-sm text-gray-800 leading-relaxed">{selectedBooking.morning_snack_option}</p>
                    </div>
                  )}
                  {selectedBooking.lunch_required && (
                    <div className="border border-gray-100 rounded-lg p-3 bg-white shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Lunch Menu</span>
                      <p className="text-sm text-gray-800 leading-relaxed">{selectedBooking.lunch_menu}</p>
                    </div>
                  )}
                  {selectedBooking.evening_tea_required && (
                    <div className="border border-gray-100 rounded-lg p-3 bg-white shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Evening Tea Selection</span>
                      <p className="text-sm text-gray-800 leading-relaxed">{selectedBooking.evening_snack_option}</p>
                    </div>
                  )}
                  {selectedBooking.dinner_required && (
                    <div className="border border-gray-100 rounded-lg p-3 bg-white shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Dinner Menu</span>
                      <p className="text-sm text-gray-800 leading-relaxed">{selectedBooking.dinner_menu}</p>
                    </div>
                  )}
                  {getRequestedMeals(selectedBooking).length === 0 && (
                     <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-lg text-center border border-gray-100">
                       No specific menu items were detailed for this request.
                     </p>
                  )}
                </div>
              </div>
            </div>

            {/* Admin Action Footer (Only shows if status is strictly pending) */}
            {selectedBooking.status?.toLowerCase() === "pending" && (
              <div className="p-6 border-t border-gray-100 bg-white grid grid-cols-2 gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button
                  onClick={() => handleReject(selectedBooking.id)}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition disabled:opacity-50"
                >
                  <XCircle size={18} /> Reject
                </button>
                <button
                  onClick={() => handleApprove(selectedBooking.id)}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  <CheckCircle2 size={18} /> Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminMess;