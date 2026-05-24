import { useState, useEffect, useRef } from 'react';
import roleOverrideService from '../../api/roleOverrideService';

const SCOPED_APPROVER_ROLES = ['RECEPTIONIST', 'LAB_INCHARGE', 'LIBRARIAN'];

/* ─── Info Tooltip/Popover ─────────────────────────────────────────────── */
const InfoPopover = () => {
    const [isVisible, setIsVisible] = useState(false);
    const popoverRef = useRef(null);
    const buttonRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                popoverRef.current && !popoverRef.current.contains(e.target) &&
                buttonRef.current && !buttonRef.current.contains(e.target)
            ) {
                setIsVisible(false);
            }
        };
        if (isVisible) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isVisible]);

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e) => { if (e.key === 'Escape') setIsVisible(false); };
        if (isVisible) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isVisible]);

    return (
        <div className="relative inline-flex items-center" style={{ verticalAlign: 'middle' }}>
            {/* Info button */}
            <button
                ref={buttonRef}
                type="button"
                aria-label="Show information about Temporary Access"
                onClick={() => setIsVisible(v => !v)}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: '1.5px solid #3b82f6',
                    background: isVisible ? '#eff6ff' : 'white',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    transition: 'background 0.15s, box-shadow 0.15s',
                    boxShadow: isVisible ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
                    flexShrink: 0,
                    padding: 0,
                }}
                onMouseEnter={e => {
                    if (!isVisible) e.currentTarget.style.background = '#eff6ff';
                }}
                onMouseLeave={e => {
                    if (!isVisible) e.currentTarget.style.background = 'white';
                }}
            >
                <svg
                    width="11" height="11" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="8.01" strokeWidth="3" />
                    <line x1="12" y1="12" x2="12" y2="16" />
                </svg>
            </button>

            {/* Popover panel */}
            {isVisible && (
                <div
                    ref={popoverRef}
                    role="dialog"
                    aria-modal="false"
                    aria-label="Temporary Access Information"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                        width: '300px',
                        maxWidth: 'calc(100vw - 48px)',
                        background: 'white',
                        border: '1px solid #dbeafe',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                        padding: '16px',
                        animation: 'infoPopoverIn 0.18s ease both',
                    }}
                >
                    {/* Arrow */}
                    <div style={{
                        position: 'absolute',
                        top: '-6px',
                        left: '50%',
                        transform: 'translateX(-50%) rotate(45deg)',
                        width: '10px',
                        height: '10px',
                        background: 'white',
                        border: '1px solid #dbeafe',
                        borderBottom: 'none',
                        borderRight: 'none',
                    }} />

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <div style={{
                            width: '28px', height: '28px', borderRadius: '8px',
                            background: '#eff6ff', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af', margin: 0, lineHeight: 1.3 }}>
                                Temporary Access
                            </p>
                            <p style={{ fontSize: '10px', color: '#6b7280', margin: 0, lineHeight: 1.3 }}>
                                Time-limited permission elevation
                            </p>
                        </div>
                    </div>

                    {/* Description */}
                    <p style={{ fontSize: '11.5px', color: '#374151', lineHeight: 1.6, marginBottom: '10px', margin: '0 0 10px' }}>
                        Allows admins to grant users additional system permissions for a limited time. Access
                        is automatically revoked when the expiry date is reached.
                    </p>

                    {/* Divider */}
                    <div style={{ height: '1px', background: '#eff6ff', margin: '10px 0' }} />

                    {/* Use cases */}
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                        Example Use Cases
                    </p>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                        {[
                            'Substitute faculty handling approvals',
                            'Temporary transport coordinator',
                            'Event-specific admin access',
                            'Emergency operational access',
                        ].map((item, i) => (
                            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '4px', fontSize: '11px', color: '#4b5563' }}>
                                <span style={{ color: '#3b82f6', flexShrink: 0, marginTop: '1px' }}>•</span>
                                {item}
                            </li>
                        ))}
                    </ul>

                    {/* Footer note */}
                    <div style={{
                        marginTop: '10px', padding: '8px', borderRadius: '8px',
                        background: '#f0fdf4', border: '1px solid #bbf7d0',
                        display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                            stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span style={{ fontSize: '10.5px', color: '#15803d', lineHeight: 1.4 }}>
                            Access automatically expires on the selected date &amp; time.
                        </span>
                    </div>

                    {/* Dismiss */}
                    <button
                        type="button"
                        onClick={() => setIsVisible(false)}
                        style={{
                            position: 'absolute', top: '10px', right: '10px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#9ca3af', padding: '2px', borderRadius: '4px',
                            lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        aria-label="Dismiss"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Keyframe animation injected once */}
            <style>{`
                @keyframes infoPopoverIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(0.97); }
                    to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
};

/* ─── Helper Text component ─────────────────────────────────────────────── */
const FieldHelper = ({ children }) => (
    <p style={{
        fontSize: '11px',
        color: '#6b7280',
        marginTop: '5px',
        lineHeight: 1.5,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '4px',
    }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, marginTop: '1px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="8.01" strokeWidth="3" />
            <line x1="12" y1="12" x2="12" y2="16" />
        </svg>
        {children}
    </p>
);

/* ─── Main Modal ─────────────────────────────────────────────────────────── */
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
            setIsSubmitting(false); 
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 overflow-visible max-h-[90vh] overflow-y-auto">

                {/* ── Modal Header ── */}
                <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-base font-bold text-gray-900 leading-snug">
                            Assign Temporary Access
                        </h3>
                        <InfoPopover />
                    </div>
                    {/* Close button */}
                    <button
                        type="button"
                        onClick={handleCloseModal}
                        aria-label="Close modal"
                        className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                    Grant temporary access to a user for a limited period.
                </p>

                {/* ── Info Banner ── */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    marginBottom: '18px',
                }}>
                    <div style={{
                        width: '24px', height: '24px', borderRadius: '6px',
                        background: '#dbeafe', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0, marginTop: '1px',
                    }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                            stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                    </div>
                    <div>
                        <p style={{ fontSize: '11.5px', fontWeight: 600, color: '#1d4ed8', margin: '0 0 2px' }}>
                            What is Temporary Access?
                        </p>
                        <p style={{ fontSize: '11px', color: '#3b82f6', margin: 0, lineHeight: 1.5 }}>
                            Elevates a user's permissions for a specific period. Access is automatically
                            removed when the expiry date is reached — no manual action required.
                        </p>
                    </div>
                </div>

                {/* ── Error Banner ── */}
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
                        <FieldHelper>This role will be temporarily added to the selected user.</FieldHelper>
                    </div>

                    {/* SCOPE CONFIGURATION */}
                    {isRoleScoped && (
                        <div className="space-y-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div>
                                <label className="block caps-label mb-1.5">Scope Type <span className="text-red-500">*</span></label>
                                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition" value={scopeType} onChange={(e) => { setScopeType(e.target.value); setSelectedBlockId(''); setSelectedSpaceId(''); }}>
                                    <option value="GLOBAL">Select Scope...</option>
                                    <option value="BLOCK">Block Specific</option>
                                    <option value="SPACE">Space Specific</option>
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
                                    <label className="block caps-label mb-1.5">Select Space <span className="text-red-500">*</span></label>
                                    <select required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition" value={selectedSpaceId} onChange={(e) => setSelectedSpaceId(e.target.value)}>
                                        <option value="" disabled>-- Select Space --</option>
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
                        <FieldHelper>Access will automatically expire after this date and time.</FieldHelper>
                    </div>

                    <div className="flex gap-3 mt-6 justify-end pt-2">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
                        <button type="submit" disabled={isSubmitting || !selectedUser || !selectedRole || !validUntil || !reason || (isRoleScoped && scopeType === 'BLOCK' && !selectedBlockId) || (isRoleScoped && scopeType === 'SPACE' && !selectedSpaceId)} className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-black rounded-lg transition disabled:opacity-50 shadow-sm">
                            {isSubmitting ? 'Granting...' : 'Assign Access'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GrantOverrideModal;