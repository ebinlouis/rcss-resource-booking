import { useState } from 'react';
import roleOverrideService from '../../api/roleOverrideService';

const GrantOverrideModal = ({ isOpen, onClose, onRefresh }) => {
    const [userId, setUserId] = useState('');
    const [roleId, setRoleId] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // In a full production environment, you would fetch these lists from your API.
    // For now, we use standard inputs/selects to wire up the logic.
    const MOCK_ROLES = [
        { id: 1, name: 'IT_ADMIN' },
        { id: 2, name: 'HOD' },
        { id: 3, name: 'STAFF' }
    ];

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // Must convert local datetime to ISO string for Django backend
            const isoDate = new Date(expiresAt).toISOString();
            
            await roleOverrideService.grantOverride({
                user: parseInt(userId),
                overridden_role: parseInt(roleId),
                expires_at: isoDate
            });
            
            onRefresh(); // Reload the table
            onClose();   // Close the modal
        } catch (err) {
            setError(err.response?.data?.user?.[0] || 'Failed to grant override. Ensure date is in the future.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
                <h2 className="mb-4 text-xl font-bold text-gray-800">Grant Temporary Access</h2>
                
                {error && (
                    <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Target User ID</label>
                        <input 
                            type="number" 
                            required
                            className="w-full rounded-lg border p-2 focus:border-blue-500 focus:ring focus:ring-blue-200"
                            placeholder="Enter User ID"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Elevate to Role</label>
                        <select 
                            required
                            className="w-full rounded-lg border p-2 focus:border-blue-500 focus:ring focus:ring-blue-200"
                            value={roleId}
                            onChange={(e) => setRoleId(e.target.value)}
                        >
                            <option value="">-- Select Role --</option>
                            {MOCK_ROLES.map(role => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Expires At (Mandatory)</label>
                        <input 
                            type="datetime-local" 
                            required
                            className="w-full rounded-lg border p-2 focus:border-blue-500 focus:ring focus:ring-blue-200"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                        />
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="rounded-lg px-4 py-2 font-medium text-gray-600 hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Granting...' : 'Authorize Upgrade'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GrantOverrideModal;