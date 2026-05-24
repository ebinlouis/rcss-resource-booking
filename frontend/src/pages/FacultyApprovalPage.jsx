import React, { useState, useEffect } from 'react';
import approvalService from '../api/approvalService';
import { useAuth } from '../hooks/useAuth';

export default function FacultyApprovalPage() {
    const { user } = useAuth();
    const [pending, setPending] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [rejectionNotes, setRejectionNotes] = useState({});
    const [loadError, setLoadError] = useState(false);
    const [actionErrors, setActionErrors] = useState({});

    const fetchData = async (isInitial = false) => {
        try {
            if (!isInitial) {
                setLoading(true);
                setLoadError(false);
            }
            const data = await approvalService.fetchFacultyPending();
            setPending(data.pending || []);
            setHistory(data.history || []);
        } catch (err) {
            console.error(err);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData(true);
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    const handleApprove = async (id) => {
        try {
            setActionLoading(id);
            setActionErrors(prev => ({...prev, [id]: null}));
            await approvalService.resolveFacultyBooking({ id, action: 'approve' });
            await fetchData();
        } catch (err) {
            console.error(err);
            setActionErrors(prev => ({...prev, [id]: "Failed to approve booking."}));
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id) => {
        const note = rejectionNotes[id];
        if (!note?.trim() || note.trim().length < 10) {
            setActionErrors(prev => ({...prev, [id]: "Rejection note must be at least 10 characters long."}));
            return;
        }
        try {
            setActionLoading(id);
            setActionErrors(prev => ({...prev, [id]: null}));
            await approvalService.resolveFacultyBooking({ id, action: 'reject', rejectionNote: note });
            await fetchData();
        } catch (err) {
            console.error(err);
            setActionErrors(prev => ({...prev, [id]: "Failed to reject booking."}));
        } finally {
            setActionLoading(null);
        }
    };

    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTime = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'REJECTED': return 'bg-red-100 text-red-700';
            case 'APPROVED': return 'bg-green-100 text-green-700';
            case 'FACULTY_ESCALATED': return 'bg-purple-100 text-purple-700';
            case 'CANCELLED': return 'bg-gray-100 text-gray-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    if (!user?.capabilities?.can_approve_faculty) {
        return <div className="p-8 text-center text-red-500">Not authorized. Faculty access only.</div>;
    }

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading your approvals...</div>;
    }

    if (loadError) {
        return <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl max-w-2xl mx-auto mt-8 border border-red-100">Failed to load approvals. Please refresh the page to try again.</div>;
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in duration-300">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Faculty Approvals</h1>
                <p className="text-gray-500 mt-1">Review student space booking requests requiring your sponsorship.</p>
            </div>

            <div>
                <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Pending Your Review</h2>
                {pending.length === 0 ? (
                    <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-100">No pending requests at the moment.</p>
                ) : (
                    <div className="grid gap-4">
                        {pending.map(booking => (
                            <div key={booking.id} className="bg-white border border-amber-200 shadow-sm rounded-xl p-5 flex flex-col md:flex-row gap-6">
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Action Required</span>
                                        <h3 className="font-bold text-gray-900">{booking.space_details?.name || 'Space Booking'}</h3>
                                    </div>
                                    <p className="text-sm text-gray-600"><strong>Purpose:</strong> {booking.purpose_of_booking}</p>
                                    <p className="text-sm text-gray-600"><strong>Student:</strong> {booking.booked_by_name}</p>
                                    <p className="text-sm text-gray-600"><strong>Email:</strong> {booking.booked_by_email}</p>
                                    {booking.booked_by_phone && (
                                        <p className="text-sm text-gray-600"><strong>Phone:</strong> {booking.booked_by_phone}</p>
                                    )}
                                    <p className="text-sm text-gray-600"><strong>Department:</strong> {booking.booked_by_department}</p>
                                    <p className="text-sm text-gray-600"><strong>Date:</strong> {formatDate(booking.start_datetime)} | {formatTime(booking.start_datetime)} - {formatTime(booking.end_datetime)}</p>
                                    <p className="text-sm text-gray-600"><strong>Attendees:</strong> {booking.attendee_count}</p>
                                    {booking.user_notes && (
                                        <p className="text-sm text-gray-600"><strong>Notes:</strong> {booking.user_notes}</p>
                                    )}
                                </div>
                                <div className="w-full md:w-72 flex flex-col gap-2">
                                    <button 
                                        disabled={actionLoading === booking.id}
                                        onClick={() => handleApprove(booking.id)}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
                                    >
                                        Approve Request
                                    </button>
                                    <textarea 
                                        placeholder="Reason for rejection (min 10 characters)" 
                                        className={`text-sm border rounded-xl p-3 resize-none outline-none transition ${actionErrors[booking.id] ? "border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-red-50" : "border-gray-200 focus:ring-2 focus:ring-gray-300"}`}
                                        rows={2}
                                        value={rejectionNotes[booking.id] || ''}
                                        onChange={(e) => {
                                            setRejectionNotes(prev => ({...prev, [booking.id]: e.target.value}));
                                            if (actionErrors[booking.id]) setActionErrors(prev => ({...prev, [booking.id]: null}));
                                        }}
                                    />
                                    {actionErrors[booking.id] && (
                                        <p className="text-xs text-red-500 font-medium">{actionErrors[booking.id]}</p>
                                    )}
                                    <button 
                                        disabled={actionLoading === booking.id || (rejectionNotes[booking.id]?.trim().length || 0) < 10}
                                        onClick={() => handleReject(booking.id)}
                                        className="w-full bg-white hover:bg-red-50 text-red-600 font-semibold border border-red-200 py-2 rounded-xl transition disabled:opacity-50 disabled:bg-gray-50 disabled:text-red-400 disabled:border-gray-200"
                                    >
                                        Reject Request
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="pt-4">
                <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Past Approvals</h2>
                {history.length === 0 ? (
                    <p className="text-sm text-gray-500">No history available.</p>
                ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-xl">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                                <tr>
                                    <th className="px-5 py-3.5 font-semibold">Space</th>
                                    <th className="px-5 py-3.5 font-semibold">Student</th>
                                    <th className="px-5 py-3.5 font-semibold">Date</th>
                                    <th className="px-5 py-3.5 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {history.map(item => (
                                    <tr key={item.id} className="bg-white hover:bg-gray-50 transition">
                                        <td className="px-5 py-3 font-medium text-gray-900">{item.space_details?.name || 'Unknown Space'}</td>
                                        <td className="px-5 py-3 text-gray-600">
                                            {item.booked_by_name}
                                            <div className="text-xs text-gray-500 mt-0.5">{item.booked_by_email}</div>
                                            {item.booked_by_phone && (
                                                <div className="text-xs text-gray-500">{item.booked_by_phone}</div>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-gray-600">{formatDate(item.start_datetime)}</td>
                                        <td className="px-5 py-3">
                                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${getStatusColor(item.status)}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
