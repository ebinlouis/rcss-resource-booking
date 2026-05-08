import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import approvalService from '../../api/approvalService';
import { useAuth } from '../../hooks/useAuth';

// ==========================================
// REJECT MODAL
// ==========================================
const RejectModal = ({ booking, onConfirm, onCancel, isLoading }) => {
    const [remarks, setRemarks] = useState('');

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-base font-bold text-gray-900 mb-1">Reject Booking</h3>
                <p className="text-xs text-gray-500 mb-4">
                    <span className="font-medium text-gray-700">{booking.reference_code}</span> · {booking.resource_name}
                </p>

                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                    Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                    rows={4}
                    placeholder="e.g. Conflicting schedule, missing documentation..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    autoFocus
                />
                <p className="text-[10px] text-gray-400 mt-1">This message will be recorded against the booking.</p>

                <div className="flex gap-3 mt-5 justify-end">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(remarks)}
                        disabled={isLoading || !remarks.trim()}
                        className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition disabled:opacity-50"
                    >
                        {isLoading ? 'Rejecting...' : 'Confirm Reject'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// MAIN DASHBOARD
// ==========================================
const AdminDashboard = () => {
    const { can_manage_system, can_manage_mess } = useAuth();
    const navigate = useNavigate();

    const [pendingBookings, setPendingBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState(null);
    const [refreshCount, setRefreshCount] = useState(0);

    // Tracks which booking is pending rejection (opens modal)
    const [rejectTarget, setRejectTarget] = useState(null);

    useEffect(() => {
        let isMounted = true;

        // Auto-Bouncer: If they only have Mess clearance, reroute them immediately
        if (can_manage_mess && !can_manage_system) {
            navigate('/admin/mess', { replace: true });
            return;
        }

        const fetchQueue = async () => {
            setIsLoading(true);
            try {
                const data = await approvalService.getPendingApprovals();
                
                if (isMounted) {
                    // Filter out Mess bookings so they don't clutter the IT Admin dashboard
                    const cleanQueue = (data.queue || []).filter(
                        (booking) => booking.domain?.toLowerCase() !== 'mess'
                    );
                    
                    setPendingBookings(cleanQueue);
                    setError(null);
                }
            } catch (err) {
                console.error("Fetch error:", err);
                if (isMounted) {
                    if (err.response?.status === 401) {
                        setError("UNAUTHORIZED: Your account lacks IsApprover privileges.");
                    } else {
                        setError("Connection failed. Please check your backend server.");
                    }
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchQueue();

        // Cleanup function prevents state updates if the component unmounts
        return () => {
            isMounted = false;
        };
    }, [refreshCount, can_manage_system, can_manage_mess, navigate]);

    const handleRefresh = () => {
        setIsLoading(true);
        setRefreshCount(c => c + 1);
    };

    // Approve - no remarks needed
    const handleApprove = async (id, domain) => {
        setActionLoading(id);
        try {
            await approvalService.resolveBooking({
                module: domain,
                id: id,
                status: 'APPROVED',
                remarks: ''
            });
            handleRefresh();
        } catch (err) {
            console.error("Approve error:", err);
            alert(err.response?.data?.error || "Approval failed. Check admin permissions.");
        } finally {
            setActionLoading(null);
        }
    };

    // Step 1: Open modal
    const handleRejectClick = (booking) => {
        setRejectTarget(booking);
    };

    // Step 2: Submit with remarks from modal
    const handleRejectConfirm = async (remarks) => {
        if (!rejectTarget) return;
        setActionLoading(rejectTarget.id);
        try {
            await approvalService.resolveBooking({
                module: rejectTarget.domain,
                id: rejectTarget.id,
                status: 'REJECTED',
                remarks: remarks
            });
            setRejectTarget(null);
            handleRefresh();
        } catch (err) {
            console.error("Reject error:", err);
            alert(err.response?.data?.error || "Rejection failed. Check admin permissions.");
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="max-w-screen-xl mx-auto px-6 py-8 font-geist text-gray-900">

            {/* Reject Modal */}
            {rejectTarget && (
                <RejectModal
                    booking={rejectTarget}
                    onConfirm={handleRejectConfirm}
                    onCancel={() => setRejectTarget(null)}
                    isLoading={actionLoading === rejectTarget.id}
                />
            )}

            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Action Center</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {error ? "Authentication Required" : `Reviewing ${pendingBookings.length} pending requests across Rajagiri resources.`}
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition shadow-sm disabled:opacity-50"
                >
                    <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Queue
                </button>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pending Approvals</h2>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Phase 1 Live</span>
                </div>

                {error ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-600">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <p className="text-sm font-medium">{error}</p>
                        <p className="text-xs text-gray-400 mt-2">Log out and log back in to refresh your administrative session.</p>
                    </div>
                ) : isLoading && pendingBookings.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-12 text-sm text-gray-400 animate-pulse italic">
                        Synchronizing with Rajagiri resource database...
                    </div>
                ) : pendingBookings.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-16 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 mb-4">
                            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium">Queue Clear</p>
                        <p className="text-xs text-gray-500 mt-1">All booking requests have been processed.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {pendingBookings.map((booking) => (
                            <div key={`${booking.domain}-${booking.id}`} className="p-6 flex flex-col lg:flex-row gap-8 hover:bg-gray-50/30 transition">

                                {/* Info Grid */}
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Resource / Type</p>
                                        <p className="text-sm font-semibold">{booking.resource_name || 'System Resource'}</p>
                                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold rounded uppercase">
                                            {booking.domain}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Booking Reference</p>
                                        <p className="text-sm font-medium">{booking.reference_code}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Requested on {new Date(booking.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Requester</p>
                                        <p className="text-sm font-medium">{booking.requester}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Purpose</p>
                                        <p className="text-sm text-gray-600 italic line-clamp-1">"{booking.purpose}"</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-3 lg:border-l lg:border-gray-100 lg:pl-8">
                                    <button
                                        onClick={() => handleRejectClick(booking)}
                                        disabled={actionLoading === booking.id}
                                        className="px-5 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => handleApprove(booking.id, booking.domain)}
                                        disabled={actionLoading === booking.id}
                                        className="px-5 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition shadow-sm disabled:opacity-50"
                                    >
                                        {actionLoading === booking.id ? 'Processing...' : 'Approve'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;