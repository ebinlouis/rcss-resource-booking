import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

// ── Nav links — each entry declares which capability unlocks it.
// capability() receives the capabilities object from /api/auth/me/
// and returns true/false. No is_superuser checks anywhere.
const NAV_LINKS = [
    { to: '/admin',                label: 'Action Center',   end: true,  capability: (c) => c?.can_manage_system    },
    { to: '/admin/spaces',         label: 'Spaces',          end: false, capability: (c) => c?.can_manage_spaces    },
    { to: '/admin/equipment',      label: 'Equipment',       end: false, capability: (c) => c?.can_manage_equipment },
    { to: '/admin/departments',    label: 'Departments',     end: false, capability: (c) => c?.can_manage_system    },
    { to: '/admin/role-overrides', label: 'Role Overrides',  end: false, capability: (c) => c?.can_manage_system    },
    { to: '/admin/mess',           label: 'Mess Operations', end: false, capability: (c) => c?.can_manage_mess      },
];

// ── Derive a readable module label from the effective_role string.
// Falls back gracefully if role is null (shouldn't happen in practice
// since ProtectedRoute guards the portal, but defensive is good).
const getRoleDisplay = (effectiveRole) => {
    if (!effectiveRole) return { title: 'Admin Portal', subtitle: 'Staff' };
    const normalized = effectiveRole.trim().toLowerCase();

    const map = {
        'it admin':         { title: 'IT Admin',          subtitle: 'System Operations'  },
        'mess':             { title: 'Mess Admin',         subtitle: 'Mess Operations'    },
        'facility manager': { title: 'Facility Manager',   subtitle: 'Spaces & Facilities'},
        'receptionist':     { title: 'Receptionist',       subtitle: 'Space Bookings'     },
        'lab in-charge':    { title: 'Lab In-charge',      subtitle: 'Lab Management'     },
        'librarian':        { title: 'Librarian',          subtitle: 'Library Spaces'     },
        'principal':        { title: 'Principal',          subtitle: 'Institution Head'   },
        'hod':              { title: 'Head of Department', subtitle: 'Department Head'    },
    };

    return map[normalized] ?? { title: effectiveRole, subtitle: 'Admin Portal' };
};

const AdminLayout = () => {
    const { logout, user, effectiveRole } = useAuth();
    const navigate = useNavigate();

    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    // Build capabilities object from auth context — spread into context
    // by AuthProvider so each capability is a top-level key.
    const capabilities = {
        can_manage_system:    user?.capabilities?.can_manage_system,
        can_manage_spaces:    user?.capabilities?.can_manage_spaces,
        can_manage_equipment: user?.capabilities?.can_manage_equipment,
        can_manage_mess:      user?.capabilities?.can_manage_mess,
    };

    // Filter nav links — each link decides its own visibility via capability()
    const visibleLinks = NAV_LINKS.filter(({ capability }) => capability(capabilities));

    const { title: roleTitle, subtitle: roleSubtitle } = getRoleDisplay(effectiveRole);

    return (
        <div className="flex h-screen bg-gray-50 font-geist w-full">

            {/* Desktop Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-100 hidden md:flex flex-col z-20">
                <div className="flex h-16 items-center px-6 border-b border-gray-100">
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                        <img src="/logo.png" alt="RCSS Logo" className="w-full h-full object-contain" />
                    </div>
                    <span className="ml-3 font-bold text-gray-900 tracking-tight">{roleTitle}</span>
                </div>

                <nav className="flex-1 space-y-1 p-4">
                    <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Modules</p>

                    {visibleLinks.map(({ to, label, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                                    isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-gray-600 hover:bg-gray-50'
                                }`
                            }
                        >
                            {label}
                        </NavLink>
                    ))}
                </nav>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* Top Header */}
                <header className="h-16 bg-white border-b border-gray-100 shrink-0 z-10 flex items-center justify-between px-5 md:px-8">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 md:hidden">
                            <img src="/logo.png" alt="RCSS Logo" className="w-full h-full object-contain" />
                        </div>
                        <h2 className="text-sm font-medium text-gray-500 hidden md:block">System Administration</h2>
                    </div>

                    {/* Profile Dropdown */}
                    <div className="relative" ref={profileRef}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setProfileOpen((prev) => !prev); }}
                            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-50 transition"
                        >
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm"
                                style={{ background: 'linear-gradient(135deg, #14532d, #1e3a5f)' }}
                            >
                                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                            <div className="hidden md:block text-left leading-tight">
                                <p className="text-xs font-semibold text-gray-800">{user?.name || 'Admin User'}</p>
                                <p className="text-[10px] text-gray-400">{roleSubtitle}</p>
                            </div>
                            <svg
                                className={`hidden md:block w-3.5 h-3.5 text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {profileOpen && (
                            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                                    <p className="text-sm font-semibold text-gray-800">{user?.name || 'Admin User'}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{user?.email || ''}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{roleTitle}</p>
                                </div>
                                <div className="py-1">
                                    <button
                                        onClick={() => navigate('/dashboard')}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                                    >
                                        Back to User Portal
                                    </button>
                                </div>
                                <div className="border-t border-gray-100 py-1">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition text-left"
                                    >
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                {/* Dynamic Page Content */}
                <main className="flex-1 overflow-y-auto w-full">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;