import { useState, useEffect } from 'react';
import spaceAdminService from '../../api/spaceAdminService';
import AssignApproverModal from '../../components/admin/AssignApproverModal';

const SpaceApproversManagement = () => {
    const [approvers, setApprovers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Initial load on mount
    useEffect(() => {
        let isMounted = true;
        
        const fetchInitial = async () => {
            try {
                const data = await spaceAdminService.getApprovers();
                if (isMounted) setApprovers(Array.isArray(data) ? data : data.results || []);
            } catch (error) {
                console.error('Failed to fetch approvers', error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchInitial();

        return () => { isMounted = false; };
    }, []);

    // Manual refresh
    const refreshApprovers = async () => {
        setIsLoading(true);
        try {
            const data = await spaceAdminService.getApprovers();
            setApprovers(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error('Failed to refresh approvers', error);
        } finally {
            setIsLoading(false);
        }
    };

    const revokeApprover = async (approver) => {
        const shouldRevoke = window.confirm(
            approver.is_last_assignment_for_role
                ? 'This is the user\'s last active assignment for this role. Revoking it will also remove the role badge from their profile. Continue?'
                : 'Revoke this scoped approver assignment?'
        );
        if (!shouldRevoke) return;

        try {
            await spaceAdminService.deleteApprover(approver.id);
            refreshApprovers();
        } catch {
            alert("Failed to revoke assignment.");
        }
    };

    const formatScope = (approver) => {
        if (approver.scope_type === 'BLOCK' && approver.block_name) {
            return `Block: ${approver.block_name}`;
        }
        if (approver.scope_type === 'SPACE' && approver.space_name) {
            return `Space: ${approver.space_name}`;
        }
        return 'Unscoped';
    };

    return (
        <div className="p-6 md:p-10 max-w-6xl mx-auto">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Space Approvers</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage scoped keycards for block and space approvers.</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm"
                >
                    + Assign Approver
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="caps-label px-6 py-4">User</th>
                            <th className="caps-label px-6 py-4">Assigned Role</th>
                            <th className="caps-label px-6 py-4">Jurisdiction (Scope)</th>
                            <th className="caps-label px-6 py-4 text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            <tr><td colSpan="4" className="text-center py-10 text-gray-500 text-sm">Loading assignments...</td></tr>
                        ) : approvers.length === 0 ? (
                            <tr><td colSpan="4" className="text-center py-10 text-gray-500 text-sm">No scoped approvers found.</td></tr>
                        ) : (
                            approvers.map(approver => (
                                <tr key={approver.id} className="hover:bg-gray-50/50 transition">
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-semibold text-gray-900">{approver.user_name || 'Unknown User'}</p>
                                        <p className="text-[11px] text-gray-500">{approver.user_email}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full text-[11px] font-bold text-green-700 tracking-wide">
                                            {approver.role_display || approver.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-700">
                                        {formatScope(approver)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => revokeApprover(approver)}
                                            className="text-xs font-bold px-3 py-1.5 rounded-lg transition bg-red-50 text-red-600 hover:bg-red-100"
                                        >
                                            Revoke
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mount the Modal here */}
            <AssignApproverModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onRefresh={refreshApprovers} 
            />
        </div>
    );
};

export default SpaceApproversManagement;
