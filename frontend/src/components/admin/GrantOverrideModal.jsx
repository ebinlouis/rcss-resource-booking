import { useState, useEffect } from 'react';
import roleOverrideService from '../../api/roleOverrideService';

const GrantOverrideModal = ({ isOpen, onClose, onRefresh }) => {
    const [selectedUser, setSelectedUser] = useState(null); 
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const [roleId, setRoleId] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const [roles, setRoles] = useState([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(true);

    // 1. Fetch available Roles on open (with isMounted guard)
    useEffect(() => {
        let isMounted = true;
        if (!isOpen) return;

        const fetchRoles = async () => {
            try {
                const data = await roleOverrideService.getRoles();
                if (isMounted) setRoles(data);
            } catch (err) {
                console.error("Failed to fetch roles", err);
            } finally {
                if (isMounted) setIsLoadingRoles(false);
            }
        };

        fetchRoles();

        return () => {
            isMounted = false;
        };
    }, [isOpen]);

    // 2. Debounced User Search (Linter-safe async updates)
    useEffect(() => {
        let isMounted = true;
        if (!isOpen || selectedUser) return; 

        // Wrap everything inside the timeout to avoid synchronous setState cascade
        const timer = setTimeout(async () => {
            if (searchTerm.trim().length < 2) {
                if (isMounted) {
                    setSearchResults([]);
                    setIsSearching(false);
                }
                return;
            }

            if (isMounted) setIsSearching(true);
            
            try {
                const results = await roleOverrideService.searchUsers(searchTerm);
                if (isMounted) setSearchResults(results);
            } catch (err) {
                console.error("Search failed", err);
            } finally {
                if (isMounted) setIsSearching(false);
            }
        }, 300);

        return () => {
            isMounted = false;
            clearTimeout(timer); 
        };
    }, [searchTerm, isOpen, selectedUser]);

    // Centralized reset function to replace the synchronous useEffect
    const handleCloseModal = () => {
        setSelectedUser(null);
        setSearchTerm('');
        setSearchResults([]);
        setRoleId('');
        setExpiresAt('');
        setError(null);
        onClose(); // Tell parent to hide the modal
    };

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const isoDate = new Date(expiresAt).toISOString();
            await roleOverrideService.grantOverride({
                user: selectedUser.id, 
                overridden_role: parseInt(roleId),
                expires_at: isoDate
            });
            onRefresh();
            handleCloseModal(); // Clean up state and close on success
        } catch (err) {
            setError(err.response?.data?.user?.[0] || err.response?.data?.error || 'Failed to grant override.');
            setIsSubmitting(false); // Only toggle false if it failed
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-geist">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 overflow-visible">
                
                <h3 className="text-base font-bold text-gray-900 mb-1">Grant Temporary Access</h3>
                <p className="text-xs text-gray-500 mb-5">
                    Search for a user to temporarily elevate their permissions.
                </p>

                {error && (
                    <div className="mb-5 flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-600">
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* TARGET USER AUTOCOMPLETE */}
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                            Target User <span className="text-red-500">*</span>
                        </label>
                        
                        {selectedUser ? (
                            <div className="flex items-center justify-between w-full border border-green-200 bg-green-50 rounded-lg px-3 py-2">
                                <div>
                                    <p className="text-sm font-semibold text-green-900">{selectedUser.first_name}</p>
                                    <p className="text-[10px] text-green-700">{selectedUser.email} • {selectedUser.employee_student_id}</p>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => { setSelectedUser(null); setSearchTerm(''); }}
                                    className="p-1.5 hover:bg-green-100 rounded-md text-green-700 transition"
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <>
                                <input 
                                    type="text" 
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition placeholder:text-gray-400"
                                    placeholder="Search by name, email, or ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoComplete="off"
                                />
                                
                                {searchResults.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {searchResults.map(user => (
                                            <button
                                                key={user.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedUser(user);
                                                    setSearchResults([]);
                                                }}
                                                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition"
                                            >
                                                <p className="text-sm font-medium text-gray-900">{user.first_name}</p>
                                                <p className="text-[10px] text-gray-500">{user.email} • {user.employee_student_id}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg px-3 py-4 text-center text-xs text-gray-500">
                                        No users found.
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ELEVATE TO ROLE */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                            Elevate to Role <span className="text-red-500">*</span>
                        </label>
                        <select 
                            required
                            disabled={isLoadingRoles}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition disabled:opacity-50"
                            value={roleId}
                            onChange={(e) => setRoleId(e.target.value)}
                        >
                            <option value="" disabled>
                                {isLoadingRoles ? "Loading roles..." : "-- Select Role --"}
                            </option>
                            {roles.map(role => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* EXPIRES AT */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                            Expires At (Mandatory) <span className="text-red-500">*</span>
                        </label>
                        <input 
                            type="datetime-local" 
                            required
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 mt-6 justify-end pt-2">
                        <button 
                            type="button" 
                            onClick={handleCloseModal} // Uses the new clean-up function
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSubmitting || !selectedUser || !roleId || !expiresAt}
                            className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition disabled:opacity-50 shadow-sm"
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