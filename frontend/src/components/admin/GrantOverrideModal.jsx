import { useState, useEffect } from 'react';
import roleOverrideService from '../../api/roleOverrideService';
import toast from 'react-hot-toast';

const SCOPED_APPROVER_ROLES = ['RECEPTIONIST', 'LAB_INCHARGE', 'LIBRARIAN'];

const GrantOverrideModal = ({ isOpen, onClose, onRefresh }) => {
    const [selectedUser, setSelectedUser] = useState(null); 
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const [selectedRole, setSelectedRole] = useState('');
    const [scopeType, setScopeType] = useState('GLOBAL');
    const [selectedBlockId, setSelectedBlockId] = useState('');
    const [selectedSpaceId, setSelectedSpaceId] = useState('');
    
    const [validUntil, setValidUntil] = useState('');
    const [reason, setReason] = useState('');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const [roles, setRoles] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [spaces, setSpaces] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Calculate current local datetime to block past dates
    const getCurrentDateTimeLocal = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    };

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

        return () => { isMounted = false; clearTimeout(timer); };
    }, [searchTerm, isOpen, selectedUser]);

    const handleRoleChange = (e) => {
        setSelectedRole(e.target.value);
        setSelectedBlockId('');
        setSelectedSpaceId('');
        setScopeType('GLOBAL'); 
    };

    const selectedRoleObj = roles.find(r => r.id.toString() === selectedRole.toString());
    const isRoleScoped = selectedRoleObj && SCOPED_APPROVER_ROLES.includes(selectedRoleObj.name);

    const handleCloseModal = () => {
        setSelectedUser(null);
        setSearchTerm('');
        setSearchResults([]);
        setSelectedRole('');
        setScopeType('GLOBAL');
        setSelectedBlockId('');
        setSelectedSpaceId('');
        setValidUntil('');
        setReason('');
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
                role: parseInt(selectedRole),
                valid_until: new Date(validUntil).toISOString(),
                reason: reason.trim()
            };

            if (isRoleScoped) {
                if (scopeType === 'BLOCK') {
                    payload.block = String(selectedBlockId); 
                } else if (scopeType === 'SPACE') {
                    payload.space = parseInt(selectedSpaceId); 
                }
            }

            await roleOverrideService.grantOverride(payload);
            const userName = selectedUser?.first_name || selectedUser?.name || selectedUser?.email || 'User';
            const roleName = selectedRoleObj?.display_name || selectedRoleObj?.name || 'role';
            let scopeLabel = '';
            if (isRoleScoped && scopeType === 'BLOCK') {
                const targetBlock = blocks.find(b => String(b.id) === String(selectedBlockId));
                scopeLabel = targetBlock ? ` for ${targetBlock.name}` : '';
            } else if (isRoleScoped && scopeType === 'SPACE') {
                const targetSpace = spaces.find(s => String(s.id) === String(selectedSpaceId));
                scopeLabel = targetSpace ? ` for ${targetSpace.name}` : '';
            }
            const formattedExpiry = validUntil 
                ? new Date(validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                : '';
            const expiryText = formattedExpiry ? ` until ${formattedExpiry}` : '';
            toast.success(`Temporary ${roleName} access granted to ${userName}${scopeLabel}${expiryText}.`);
            onRefresh();
            handleCloseModal(); 
        } catch (err) {
            console.error("Payload Error:", err.response?.data);
            
            // Clean up Django's raw constraint errors
            let errorMsg = 'Failed to grant access. Ensure all required fields are filled.';
            const data = err.response?.data;
            
            if (data) {
                const rawError = data.non_field_errors?.[0] || data.user?.[0] || data.block?.[0] || data.error;
                if (rawError && rawError.includes('unique set')) {
                    errorMsg = "This user already holds an active access for this exact role.";
                } else if (rawError) {
                    errorMsg = rawError;
                }
            }
            
            setError(errorMsg);
            toast.error(errorMsg);
            setIsSubmitting(false); 
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 overflow-visible max-h-[90vh] overflow-y-auto">
                <h3 className="text-base font-bold text-gray-900 mb-1">Assign Temporary Access</h3>
                <p className="text-xs text-gray-500 mb-5">Grant temporary access to a user for a limited period.</p>

                {error && (
                    <div className="mb-5 flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-600">
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* TARGET USER AUTOCOMPLETE */}
                    <div className="relative">
                        <label className="block caps-label mb-1.5">Select User <span className="text-red-500">*</span></label>
                        {selectedUser ? (
                            <div className="flex items-center justify-between w-full border border-green-200 bg-green-50 rounded-lg px-3 py-2">
                                <div>
                                    <p className="text-sm font-semibold text-green-900">{selectedUser.first_name}</p>
                                    <p className="text-[10px] text-green-700">{selectedUser.email}</p>
                                </div>
                                <button type="button" onClick={() => { setSelectedUser(null); setSearchTerm(''); }} className="p-1.5 hover:bg-green-100 rounded-md text-green-700 transition">✕</button>
                            </div>
                        ) : (
                            <>
                                <input type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition" placeholder="Search by name, email, or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoComplete="off" />
                                {isSearching && searchTerm.length >= 2 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg px-3 py-4 text-center text-xs text-gray-500">
                                        Searching...
                                    </div>
                                )}
                                {searchResults.length > 0 && !isSearching && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {searchResults.map(user => (
                                            <button key={user.id} type="button" onClick={() => { setSelectedUser(user); setSearchResults([]); }} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition">
                                                <p className="text-sm font-medium text-gray-900">{user.first_name}</p>
                                                <p className="text-[10px] text-gray-500">{user.email}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ELEVATE TO ROLE */}
                    <div>
                        <label className="block caps-label mb-1.5">Assign Temporary Role<span className="text-red-500">*</span></label>
                        <select required disabled={isLoadingData} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition disabled:opacity-50" value={selectedRole} onChange={handleRoleChange}>
                            <option value="" disabled>{isLoadingData ? "Loading..." : "-- Choose Role --"}</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name} - {r.description}</option>)}
                        </select>
                    </div>

                    {/* SCOPE CONFIGURATION */}
                    {isRoleScoped && (
                        <div className="space-y-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div>
                                <label className="block caps-label mb-1.5">Scope Type <span className="text-red-500">*</span></label>
                                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition" value={scopeType} onChange={(e) => { setScopeType(e.target.value); setSelectedBlockId(''); setSelectedSpaceId(''); }}>
                                    <option value="GLOBAL">Select Scope...</option>
                                    <option value="BLOCK">Block Specific</option>
                                    <option value="SPACE">Venue Specific</option>
                                </select>
                            </div>
                            {scopeType === 'BLOCK' && (
                                <div>
                                    <label className="block caps-label mb-1.5">Select Block <span className="text-red-500">*</span></label>
                                    <select required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition" value={selectedBlockId} onChange={(e) => setSelectedBlockId(e.target.value)}>
                                        <option value="" disabled>-- Select Block --</option>
                                        {blocks.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                                    </select>
                                </div>
                            )}
                            {scopeType === 'SPACE' && (
                                <div>
                                    <label className="block caps-label mb-1.5">Select Venue <span className="text-red-500">*</span></label>
                                    <select required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition" value={selectedSpaceId} onChange={(e) => setSelectedSpaceId(e.target.value)}>
                                        <option value="" disabled>-- Select Venue --</option>
                                        {spaces.map(s => <option key={s.id} value={s.id}>{s.name} ({s.room_number})</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* REASON */}
                    <div>
                        <label className="block caps-label mb-1.5">Reason for Temporary Access * <span className="text-red-500">*</span></label>
                        <input type="text" required maxLength={250} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition" placeholder="e.g., Covering for a staff member on leave" value={reason} onChange={(e) => setReason(e.target.value)} />
                    </div>

                    {/* VALID UNTIL */}
                    <div>
                        <label className="block caps-label mb-1.5">Valid Until (Mandatory) <span className="text-red-500">*</span></label>
                        <input 
                            type="datetime-local" 
                            required 
                            min={getCurrentDateTimeLocal()} // Prevents past dates natively
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition" 
                            value={validUntil} 
                            onChange={(e) => setValidUntil(e.target.value)} 
                        />
                    </div>

                    <div className="flex gap-3 mt-6 justify-end pt-2">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
                        <button type="submit" disabled={isSubmitting || !selectedUser || !selectedRole || !validUntil || !reason || (isRoleScoped && scopeType === 'BLOCK' && !selectedBlockId) || (isRoleScoped && scopeType === 'SPACE' && !selectedSpaceId)} className="px-4 py-2 text-sm font-semibold text-white bg-[#15803d] hover:bg-[#166534] rounded-lg transition disabled:opacity-50 shadow-sm">
                            {isSubmitting ? 'Granting...' : 'Assign Access'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GrantOverrideModal;