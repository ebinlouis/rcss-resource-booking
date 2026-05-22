import { useState, useEffect } from 'react';
import roleOverrideService from '../../api/roleOverrideService';
import GrantOverrideModal from '../../components/admin/GrantOverrideModal';

const RoleOverridesPage = () => {
    const [overrides, setOverrides] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null); 
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await roleOverrideService.getOverrides();
                if (isMounted) {
                    setOverrides(Array.isArray(data) ? data : data.results || []);
                }
            } catch (err) {
                console.error('Failed to fetch overrides:', err);
                if (isMounted) setError('Failed to load role overrides from the server.');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [refreshTrigger]);

    const handleRevoke = async (id) => {
        if (!id) {
            alert("Error: Missing Override ID.");
            return;
        }

        if (!window.confirm("Are you sure you want to instantly revoke this access?")) return;
        
        // Optimistically show loading state
        setIsLoading(true);
        try {
            await roleOverrideService.revokeOverride(id);
            setRefreshTrigger(prev => prev + 1);
        } catch (err) {
            console.error("Revoke API Error:", err);
            alert('Failed to revoke access. Please check your permissions and try again.');
            setIsLoading(false); // Only reset if it failed, else let useEffect handle it
        }
    };

    return (
        <div className="max-w-screen-xl mx-auto px-6 py-8 font-geist text-gray-900">
            
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Special Access</h1>
                    <p className="text-sm text-gray-500 mt-1">Temporarily give users additional permissions or admin access.</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Grant Access
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active & Previous Access</h2>
                </div>

                {isLoading && overrides.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-12 text-sm text-gray-400 animate-pulse italic">
                        Loading special access records...
                    </div>
                ) : error ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-600">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{error}</p>
                        <button onClick={() => setRefreshTrigger(prev => prev + 1)} className="mt-3 text-xs font-semibold text-blue-600 hover:underline">Try Again</button>
                    </div>
                ) : overrides.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-16 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 mb-4">
                            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium">No Special Access Found</p>
                        <p className="text-xs text-gray-500 mt-1">There are currently no active or previous special access records.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 bg-white">
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">User</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Elevated Role</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Reason & Granter</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Valid Until</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {overrides.map((override) => {
                                    // Parse Django's valid_until safely
                                    let formattedDate = '-';
                                    let isExpired = false;
                                    
                                    if (override.valid_until) {
                                        const dateObj = new Date(override.valid_until);
                                        if (!isNaN(dateObj.getTime())) {
                                            isExpired = dateObj < new Date();
                                            formattedDate = dateObj.toLocaleString('en-IN', {
                                                day: 'numeric', month: 'short', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            });
                                        }
                                    }

                                    const isActive = override.is_active && !isExpired;

                                    return (
                                        <tr key={override.id} className="hover:bg-gray-50/50 transition group">
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-semibold text-gray-900">{override.user_name}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{override.user_email}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase tracking-wider">
                                                    {override.role_name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-xs text-gray-800 font-medium truncate max-w-[200px]" title={override.reason}>
                                                    {override.reason || '-'}
                                                </p>
                                                <p className="text-[10px] text-gray-500 mt-0.5">By: {override.granted_by_name}</p>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-gray-600 font-medium">
                                                {formattedDate}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isActive ? (
                                                    <span className="flex items-center text-xs font-semibold text-emerald-600">
                                                        <span className="relative flex h-2 w-2 mr-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                        </span>
                                                        ACTIVE
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center text-xs font-semibold text-gray-400">
                                                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-300 mr-2"></span>
                                                        {isExpired ? 'EXPIRED' : 'REVOKED'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {isActive && (
                                                    <button 
                                                        onClick={() => handleRevoke(override.id)}
                                                        className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    >
                                                        Revoke
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <GrantOverrideModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onRefresh={() => {
                    setRefreshTrigger(prev => prev + 1);
                }} 
            />
        </div>
    );
};

export default RoleOverridesPage;
