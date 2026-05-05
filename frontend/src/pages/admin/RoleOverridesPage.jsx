import { useState, useEffect } from 'react';
import roleOverrideService from '../../api/roleOverrideService';
import GrantOverrideModal from '../../components/admin/GrantOverrideModal';

const RoleOverridesPage = () => {
    const [overrides, setOverrides] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // NEW: The dependency trigger. We change this number to force a table refresh.
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // 1. The Effect handles ALL fetching natively.
    useEffect(() => {
        let isMounted = true; // Prevents memory leaks if the user leaves the page early

        const fetchData = async () => {
            try {
                const data = await roleOverrideService.getOverrides();
                if (isMounted) {
                    setOverrides(data);
                }
            } catch (error) {
                console.error('Failed to fetch overrides:', error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [refreshTrigger]); // 2. The effect listens to this trigger!

    const handleRevoke = async (id) => {
        if (!window.confirm("Are you sure you want to instantly revoke this access?")) return;
        
        setIsLoading(true); // User clicked a button, so this is perfectly legal
        try {
            await roleOverrideService.revokeOverride(id);
            // 3. Just increment the trigger to naturally tell the useEffect to fetch again
            setRefreshTrigger(prev => prev + 1);
        } catch {
            alert('Failed to revoke access. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="mx-auto max-w-6xl">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Role Overrides</h1>
                        <p className="text-sm text-gray-500 mt-1">Manage temporary administrative privileges across the system.</p>
                    </div>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white shadow hover:bg-green-700 transition"
                    >
                        + Grant Access
                    </button>
                </div>

                <div className="overflow-hidden rounded-xl bg-white shadow">
                    {isLoading ? (
                        <div className="p-10 text-center text-gray-500">Loading active overrides...</div>
                    ) : (
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-100 text-xs uppercase text-gray-700">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Elevated Role</th>
                                    <th className="px-6 py-4">Granted By</th>
                                    <th className="px-6 py-4">Expires At</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {overrides.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="py-8 text-center text-gray-500">
                                            No overrides found in the system.
                                        </td>
                                    </tr>
                                ) : (
                                    overrides.map((override) => {
                                        const isExpired = new Date(override.expires_at) < new Date();
                                        const isActive = override.is_active && !isExpired;

                                        return (
                                            <tr key={override.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    {override.user_name} <br/>
                                                    <span className="text-xs text-gray-400">{override.user_email}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="rounded bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                                                        {override.role_name}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">{override.granted_by_name}</td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    {new Date(override.expires_at).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isActive ? (
                                                        <span className="flex items-center text-green-600">
                                                            <div className="mr-2 h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse"></div> Active
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center text-red-500">
                                                            <div className="mr-2 h-2.5 w-2.5 rounded-full bg-red-500"></div> 
                                                            {isExpired ? 'Expired' : 'Revoked'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {isActive && (
                                                        <button 
                                                            onClick={() => handleRevoke(override.id)}
                                                            className="font-medium text-red-600 hover:text-red-900 hover:underline"
                                                        >
                                                            Revoke
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <GrantOverrideModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onRefresh={() => {
                    setIsLoading(true);
                    setRefreshTrigger(prev => prev + 1); // Triggers the refresh on modal submit
                }} 
            />
        </div>
    );
};

export default RoleOverridesPage;