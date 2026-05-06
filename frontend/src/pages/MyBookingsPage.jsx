import { useState, useEffect } from 'react';
import api from '../api/axios'; 
import MainLayout from '../layouts/MainLayout';
import BookingModal from '../components/BookingModal'; 

const MyBookingsPage = () => {
    const [myBookings, setMyBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true); 
    const [error, setError] = useState(null);
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);

    // 1. Initial Data Fetching Effect (Linter-safe & No setState issues)
    useEffect(() => {
        let isMounted = true;

        async function loadInitialData() {
            try {
                // We rely on the initial 'true' state of isLoading to avoid sync updates
                const response = await api.get('/spaces/requests/');
                if (isMounted) {
                    const data = response.data.results || response.data || [];
                    setMyBookings(data);
                    setError(null);
                }
            } catch (err) {
                console.error("Fetch error:", err);
                if (isMounted) setError("Failed to load your booking history.");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        loadInitialData();

        return () => {
            isMounted = false;
        };
    }, []);

    // 2. Refresh function for manual actions (Cancel/Edit)
    const refreshData = async () => {
        try {
            const response = await api.get('/spaces/requests/');
            const data = response.data.results || response.data || [];
            setMyBookings(data);
        } catch (err) {
            console.error("Refresh error:", err);
        }
    };

    const handleCancelBooking = async (id) => {
        if (!window.confirm("Are you sure? This will free up the space for others.")) return;
        
        setIsActionLoading(true);
        try {
            await api.delete(`/spaces/requests/${id}/`);
            await refreshData();
        } catch {
            alert("Could not cancel booking.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleEditClick = (booking) => {
        setSelectedBooking(booking);
        setIsEditModalOpen(true);
    };

    const getStatusBadge = (status) => {
        const styles = {
            'APPROVED': 'bg-green-100 text-green-700 border-green-200',
            'REJECTED': 'bg-red-100 text-red-700 border-red-200',
            'CANCELLED': 'bg-gray-100 text-gray-700 border-gray-200',
            'PENDING': 'bg-yellow-100 text-yellow-700 border-yellow-200'
        };
        const currentStyle = styles[status] || styles['PENDING'];
        const label = status === 'PENDING' ? 'Pending Review' : status.charAt(0) + status.slice(1).toLowerCase();

        return (
            <span className={`px-2.5 py-0.5 border text-[10px] font-bold rounded-md uppercase tracking-wider ${currentStyle}`}>
                {label}
            </span>
        );
    };

    return (
        <MainLayout>
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Booking History</h1>
                    <p className="text-sm text-gray-500 mt-1">View and manage your resource requests.</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[450px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-24 space-y-4 text-center">
                            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                            <p className="text-sm text-gray-400 font-medium animate-pulse">Syncing with database...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <p className="text-sm font-semibold text-red-600">{error}</p>
                            <button onClick={() => window.location.reload()} className="mt-4 text-emerald-600 text-sm font-medium hover:underline">Reload page</button>
                        </div>
                    ) : myBookings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 text-center">
                            <p className="text-base font-semibold text-gray-900">No bookings found</p>
                            <p className="text-sm text-gray-500 mt-1">You haven't made any reservation requests yet.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {myBookings.map((booking) => (
                                <div key={booking.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex flex-col md:flex-row justify-between gap-6">
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-bold text-gray-900">{booking.space_details?.name || 'Unknown Space'}</h3>
                                                {getStatusBadge(booking.status)}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Reference</span>
                                                    <span className="text-gray-700 font-mono text-xs">{booking.reference_code}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Date & Duration</span>
                                                    <span className="text-gray-700">
                                                        {new Date(booking.start_datetime).toLocaleDateString('en-IN')} • 
                                                        <span className="font-medium ml-1">
                                                            {/* Showing full start and end time range */}
                                                            {new Date(booking.start_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                                                            {new Date(booking.end_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600 italic">"{booking.purpose_of_booking}"</p>
                                        </div>

                                        <div className="flex flex-col justify-center items-end gap-2 min-w-[160px]">
                                            {booking.can_modify && (booking.status === 'PENDING' || booking.status === 'APPROVED') ? (
                                                <>
                                                    {booking.status === 'PENDING' && (
                                                        <button 
                                                            onClick={() => handleEditClick(booking)}
                                                            className="w-full px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-100 transition-all mb-1"
                                                        >
                                                            Edit Request
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => handleCancelBooking(booking.id)}
                                                        disabled={isActionLoading}
                                                        className="w-full px-4 py-2 text-xs font-bold text-red-600 hover:underline transition-all disabled:opacity-50"
                                                    >
                                                        {isActionLoading ? 'Wait...' : 'Cancel Request'}
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="text-[10px] font-bold text-gray-300 uppercase py-2">No Actions Available</span>
                                            )}

                                            {booking.status === 'REJECTED' && booking.remarks_by_admin && (
                                                <div className="w-full mt-2 bg-red-50 p-3 rounded-xl border border-red-100">
                                                    <p className="text-[9px] font-bold text-red-800 uppercase tracking-widest mb-1">Admin Feedback</p>
                                                    <p className="text-xs text-red-900 italic leading-snug">"{booking.remarks_by_admin}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* EDIT MODAL TRIGGER */}
            {isEditModalOpen && selectedBooking && (
                <BookingModal
                    spaceId={selectedBooking.space}
                    spaceName={selectedBooking.space_details?.name}
                    initialData={selectedBooking} 
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setSelectedBooking(null);
                        refreshData(); 
                    }}
                />
            )}
        </MainLayout>
    );
};

export default MyBookingsPage;