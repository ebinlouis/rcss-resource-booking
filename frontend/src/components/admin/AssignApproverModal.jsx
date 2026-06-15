import { useState, useEffect } from 'react';
import roleOverrideService from '../../api/roleOverrideService';
import spaceAdminService from '../../api/spaceAdminService';

const SCOPED_APPROVER_ROLES = ['RECEPTIONIST', 'LAB_INCHARGE', 'LIBRARIAN'];

const getRoleValue = (role) => String(role.id ?? role.value ?? role.name ?? role);
const getRoleName = (role) => String(role.name ?? role.value ?? role);
const getRoleLabel = (role) => role.display_name || role.label || role.name || role;

const AssignApproverModal = ({ isOpen, onClose, onRefresh, defaultScopeType, defaultSpaceId }) => {
    const [selectedUser, setSelectedUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const [selectedRole, setSelectedRole] = useState('');
    const [scopeType, setScopeType] = useState(defaultScopeType || 'BLOCK');
    const [selectedBlockId, setSelectedBlockId] = useState('');
    const [selectedSpaceId, setSelectedSpaceId] = useState(defaultSpaceId ? String(defaultSpaceId) : '');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const [roles, setRoles] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [spaces, setSpaces] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const scopedRoles = roles.filter((role) => SCOPED_APPROVER_ROLES.includes(getRoleName(role)));

    useEffect(() => {
        let isMounted = true;
        if (!isOpen) return;

        const fetchFormData = async () => {
            try {
                const [rolesData, blocksData, spacesData] = await Promise.all([
                    roleOverrideService.getRoles(),
                    roleOverrideService.getBlocks(),
                    roleOverrideService.getSpaces()
                ]);

                if (isMounted) {
                    setRoles(Array.isArray(rolesData) ? rolesData : rolesData.results || []);
                    setBlocks(Array.isArray(blocksData) ? blocksData : blocksData.results || []);
                    setSpaces(Array.isArray(spacesData) ? spacesData : spacesData.results || []);
                }
            } catch (err) {
                console.error("Failed to fetch form data", err);
                if (isMounted) setError("Failed to load system data. Please try again.");
            } finally {
                if (isMounted) setIsLoadingData(false);
            }
        };

        fetchFormData();
        return () => { isMounted = false; };
    }, [isOpen]);

    useEffect(() => {
        let isMounted = true;
        if (!isOpen || selectedUser) return;

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

    const handleRoleChange = (e) => {
        setSelectedRole(e.target.value);
        // Only reset scope if not pre-locked by a parent context
        if (!defaultScopeType) {
            setScopeType('BLOCK');
            setSelectedBlockId('');
            setSelectedSpaceId('');
        }
    };

    const handleCloseModal = () => {
        setSelectedUser(null);
        setSearchTerm('');
        setSearchResults([]);
        setSelectedRole('');
        setScopeType(defaultScopeType || 'BLOCK');
        setSelectedBlockId('');
        setSelectedSpaceId(defaultSpaceId ? String(defaultSpaceId) : '');
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const payload = {
                user: selectedUser.id,
                role: parseInt(selectedRole, 10),
            };

            if (scopeType === 'BLOCK') {
                payload.scope_type = 'BLOCK';
                payload.block = parseInt(selectedBlockId);
            } else if (scopeType === 'SPACE') {
                payload.scope_type = 'SPACE';
                payload.space = parseInt(selectedSpaceId);
            }

            await spaceAdminService.createApprover(payload);
            onRefresh();
            handleCloseModal();
        } catch (err) {
            // Clean up Django's raw constraint errors
            let errorMsg = 'Failed to assign role. Ensure user does not already have this exact assignment.';
            const data = err.response?.data;

            if (data) {
                const rawError = data.non_field_errors?.[0] || data.user?.[0] || data.error;
                if (rawError && rawError.includes('unique set')) {
                    errorMsg = "This user is already permanently assigned to this exact role/scope.";
                } else if (rawError) {
                    errorMsg = rawError;
                }
            }

            setError(errorMsg);
            setIsSubmitting(false);
        }
    };

    const isRoleScoped = Boolean(selectedRole);

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 overflow-visible max-h-[90vh] overflow-y-auto">

                <h3 className="text-base font-bold text-gray-900 mb-1">Assign Venue Approver</h3>
                <p className="text-xs text-gray-500 mb-5">
                    Choose a user and assign approval access for selected venues. Role permissions will be applied automatically.
                </p>

                {error && (
                    <div className="mb-5 flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-600">
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* TARGET USER AUTOCOMPLETE */}
                    <div className="relative">
                        <label className="block caps-label mb-1.5">
                            Select User <span className="text-red-500">*</span>
                        </label>

                        {selectedUser ? (
                            <div className="flex items-center justify-between w-full border border-green-200 bg-green-50 rounded-lg px-3 py-2">
                                <div>
                                    <p className="text-sm font-semibold text-green-900">{selectedUser.first_name || selectedUser.name}</p>
                                    <p className="text-[10px] text-green-700">{selectedUser.email}</p>
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

                                {isSearching && searchTerm.length >= 2 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg px-3 py-4 text-center text-xs text-gray-500">
                                        Searching...
                                    </div>
                                )}

                                {searchResults.length > 0 && !isSearching && (
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
                                                <p className="text-sm font-medium text-gray-900">{user.first_name || user.name}</p>
                                                <p className="text-[10px] text-gray-500">{user.email}</p>
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

                    {/* ASSIGN ROLE */}
                    <div>
                        <label className="block caps-label mb-1.5">
                            Approval Role <span className="text-red-500">*</span>
                        </label>
                        <select
                            required
                            disabled={isLoadingData}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition disabled:opacity-50"
                            value={selectedRole}
                            onChange={handleRoleChange}
                        >
                            <option value="" disabled>
                                {isLoadingData ? "Loading..." : "-- Choose role --"}
                            </option>
                            {scopedRoles.map(r => {
                                const val = getRoleValue(r);
                                const label = getRoleLabel(r);
                                return <option key={val} value={val}>{label}</option>;
                            })}
                        </select>
                    </div>

                    {/* SCOPE CONFIGURATION (CONDITIONAL) */}
                    {isRoleScoped && (
                        <div className="space-y-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div>
                                <label className="block caps-label mb-1.5">
                                    Scope Type <span className="text-red-500">*</span>
                                </label>
                                {defaultScopeType ? (
                                    /* Locked — pre-filled from Venue Details drawer */
                                    <div className="flex items-center gap-2 w-full border border-green-200 bg-green-50 rounded-lg px-3 py-2">
                                        <span className="text-sm font-semibold text-green-900">
                                            {defaultScopeType === 'SPACE' ? 'Venue Specific' : 'Block Specific'}
                                        </span>
                                        <span className="ml-auto text-[10px] font-bold text-green-600 uppercase tracking-wide">Prefilled</span>
                                    </div>
                                ) : (
                                    <select
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition"
                                        value={scopeType}
                                        onChange={(e) => {
                                            setScopeType(e.target.value);
                                            setSelectedBlockId('');
                                            setSelectedSpaceId('');
                                        }}
                                    >
                                        <option value="BLOCK">Block Specific</option>
                                        <option value="SPACE">Venue Specific</option>
                                    </select>
                                )}
                            </div>

                            {scopeType === 'BLOCK' && (
                                <div>
                                    <label className="block caps-label mb-1.5">
                                        Select Block <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        required
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition"
                                        value={selectedBlockId}
                                        onChange={(e) => setSelectedBlockId(e.target.value)}
                                    >
                                        <option value="" disabled>-- Select Block --</option>
                                        {blocks.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {scopeType === 'SPACE' && (
                                <div>
                                    <label className="block caps-label mb-1.5">
                                        Select Venue <span className="text-red-500">*</span>
                                    </label>
                                    {defaultSpaceId ? (
                                        /* Locked — pre-filled from Venue Details drawer */
                                        <div className="flex items-center gap-2 w-full border border-green-200 bg-green-50 rounded-lg px-3 py-2">
                                            <span className="text-sm font-semibold text-green-900">
                                                {spaces.find(s => String(s.id) === String(defaultSpaceId))?.name || 'Current Venue'}
                                            </span>
                                            <span className="ml-auto text-[10px] font-bold text-green-600 uppercase tracking-wide">Prefilled</span>
                                        </div>
                                    ) : (
                                        <select
                                            required
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition"
                                            value={selectedSpaceId}
                                            onChange={(e) => setSelectedSpaceId(e.target.value)}
                                        >
                                            <option value="" disabled>-- Select Venue --</option>
                                            {spaces.map(s => {
                                                const suffix = s.room_number ? ` (${s.room_number})` : '';
                                                return <option key={s.id} value={s.id}>{s.name}{suffix}</option>;
                                            })}
                                        </select>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 mt-6 justify-end pt-2">
                        <button
                            type="button"
                            onClick={handleCloseModal}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={
                                isSubmitting ||
                                !selectedUser ||
                                !selectedRole ||
                                (scopeType === 'BLOCK' && !selectedBlockId) ||
                                (scopeType === 'SPACE' && !selectedSpaceId)
                            }
                            className="px-4 py-2 text-sm font-semibold text-white bg-[#15803d] hover:bg-[#166534] rounded-lg transition disabled:opacity-50 shadow-sm"
                        >
                            {isSubmitting ? 'Assigning...' : 'Assign Access'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AssignApproverModal;