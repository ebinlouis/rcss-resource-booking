import { useState, useEffect } from 'react';
import api from '../api/axios'; 
import MainLayout from '../layouts/MainLayout';

const MyBookingsPage = () => {
    const [myBookings, setMyBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchMyBookings = async () => {
            setIsLoading(true);
            try {
                // Returns only the logged-in user's data due to backend get_queryset logic
                const response = await api.get('/spaces/bookings/');
                setMyBookings(response.data);
                setError(null);
            } catch (err) {
                console.error("Fetch error:", err);
                setError("Failed to load your booking history.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchMyBookings();
    }, []); // Empty dependency array, no more ESLint warnings!

    // Helper to color-code statuses
    const getStatusBadge = (status) => {
        switch (status) {
            case 'APPROVED':
                return <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Approved</span>;
            case 'REJECTED':
                return <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Rejected</span>;
            case 'CANCELLED':
                return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full">Cancelled</span>;
            default:
                return <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">Pending Review</span>;
        }
    };

    return (
        <MainLayout>
            <div className="font-geist text-gray-900">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight">My Bookings</h1>
                    <p className="text-sm text-gray-500 mt-1">Track the status of your campus resource requests.</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12 text-sm text-gray-400 animate-pulse">
                            Loading your history...
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <p className="text-sm font-medium text-red-600">{error}</p>
                        </div>
                    ) : myBookings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 text-center">
                            <p className="text-sm font-medium">No bookings found</p>
                            <p className="text-xs text-gray-500 mt-1">You haven't requested any spaces yet.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {myBookings.map((booking) => (
                                <div key={booking.id} className="p-6 flex flex-col md:flex-row gap-6 justify-between hover:bg-gray-50/30 transition">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-base font-bold">{booking.space_details?.name || 'Unknown Space'}</h3>
                                            {getStatusBadge(booking.status)}
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium text-gray-900">Ref:</span> {booking.reference_code}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium text-gray-900">Time:</span> {new Date(booking.start_datetime).toLocaleString()} - {new Date(booking.end_datetime).toLocaleString()}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium text-gray-900">Purpose:</span> {booking.purpose_of_booking}
                                        </p>
                                    </div>

                                    {/* Show Admin Remarks if Rejected */}
                                    {booking.status === 'REJECTED' && booking.remarks_by_admin && (
                                        <div className="mt-4 md:mt-0 md:max-w-xs bg-red-50 p-3 rounded-lg border border-red-100 h-fit">
                                            <p className="text-[10px] font-bold text-red-800 uppercase tracking-widest mb-1">Admin Remarks</p>
                                            <p className="text-sm text-red-900 italic">"{booking.remarks_by_admin}"</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
};

export default MyBookingsPage;