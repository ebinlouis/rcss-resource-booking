import Tooltip from "../../components/Tooltip";
import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import NotificationBell from '../../components/NotificationBell';

    { to: '/admin',                label: 'Venue Bookings',        end: true,  capability: (c) => c?.can_manage_system || c?.can_manage_spaces || c?.can_manage_labs || c?.can_manage_principal_view },
    { to: '/admin/spaces',         label: 'Venue Management',      end: false, capability: (c) => c?.can_manage_system || c?.can_manage_spaces },
    { to: '/admin/blocks',         label: 'Blocks',                end: false, capability: (c) => c?.can_manage_system },
    { to: '/admin/users',          label: 'Users',                 end: false, capability: (c) => c?.can_manage_system },
    { to: '/admin/approvers',      label: 'Venue Managers',        end: false, capability: (c) => c?.can_manage_system },
    { to: '/admin/departments',    label: 'Departments & Faculties', end: false, capability: (c) => c?.can_manage_system },
    { to: '/admin/faculties',      label: 'Faculties',             end: false, capability: (c) => c?.is_hod && !c?.can_manage_system },
    { to: '/admin/transport',      label: 'Transport Management',  end: false, capability: (c) => c?.can_manage_system },
    { to: '/admin/mess',           label: 'Mess',                  end: false, capability: (c) => c?.can_manage_mess },
    { to: '/admin/media',          label: 'Media Management',      end: false, capability: (c) => c?.can_manage_media },
    { to: '/media/schedule',       label: 'Team Schedule',         end: false, capability: (c) => c?.can_manage_media },
    { to: '/admin/role-overrides', label: 'Special Access',        end: false, capability: (c) => c?.can_manage_system },
    { to: '/admin/equipment',      label: 'Equipment Management',  end: false, capability: (c) => c?.can_manage_system || c?.can_manage_equipment || c?.can_manage_media },

const NAV_ICONS = {
    'Venue Bookings': 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    'Venue Management': 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    'Blocks': 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
    'Users': 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M12 12a4 4 0 100-8 4 4 0 000 8z',
    'Faculties': 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M12 12a4 4 0 100-8 4 4 0 000 8z',
    'Venue Managers': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    'Departments ': 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    'Transport Management': 'M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4zM5 7h14l1 6H4L5 7zm2-3h10',
    'Mess': 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    'Media Management': 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
    'Team Schedule': 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    'Special Access': 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
    'Equipment Management': 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
};

// Priority order — if user has multiple roles, show the most senior one
const ROLE_PRIORITY = [
    'IT_ADMIN',
    'PRINCIPAL',
    'HOD',
    'RECEPTIONIST',
    'LAB_INCHARGE',
    'LIBRARIAN',
    'MESS_MANAGER',
    'MEDIA_INCHARGE',
    'FLEET_MANAGER',
];

const ROLE_DISPLAY_MAP = {
    'IT_ADMIN': { title: 'IT Admin', subtitle: 'System Operations' },
    'PRINCIPAL': { title: 'Principal', subtitle: 'Institution Head' },
    'HOD': { title: 'Head of Department', subtitle: 'Department Head' },
    'RECEPTIONIST': { title: 'Receptionist', subtitle: 'Venue Bookings' },
    'LAB_INCHARGE': { title: 'Lab In-Charge', subtitle: 'Lab Management' },
    'LIBRARIAN': { title: 'Librarian', subtitle: 'Library Rooms' },
    'MESS_MANAGER': { title: 'Mess Manager', subtitle: 'Mess Operations' },
    'MEDIA_INCHARGE': { title: 'Media In-Charge', subtitle: 'Media Management' },
    'FLEET_MANAGER': { title: 'Fleet Manager', subtitle: 'Fleet Operations' },
};

const getRoleDisplay = (effectiveRoles = []) => {
    if (!effectiveRoles.length) return { title: 'Admin Portal', subtitle: 'Staff' };
    const topRole = ROLE_PRIORITY.find((r) => effectiveRoles.includes(r));
    if (topRole && ROLE_DISPLAY_MAP[topRole]) return ROLE_DISPLAY_MAP[topRole];
    return { title: effectiveRoles[0], subtitle: 'Admin Portal' };
};

const Icon = ({ path, className = 'w-[18px] h-[18px]' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

const SidebarContent = ({ roleTitle, roleSubtitle, visibleLinks, collapsed, onCloseMobile, onNavigate, onLogout }) => (
    <>
        {/* Logo / Brand */}
        <div
            className={`border-b border-[#e8f5ee] transition-all duration-300 flex items-center ${collapsed ? 'justify-center px-3 h-16' : 'px-5 h-16'
                }`}
        >
            {collapsed ? (
                <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain" />
            ) : (
                <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain shrink-0" />
                    <div>
                        <p className="text-[15.5px] font-bold text-[#14532d] leading-tight tracking-tight">{roleTitle}</p>
                        <p className="text-[13px] text-[#86a898] leading-tight mt-0.5">{roleSubtitle}</p>
                    </div>
                </div>
            )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto pt-4 pb-4 space-y-0.5 transition-all duration-300 ${collapsed ? 'px-2' : 'px-3'}`}>
            {!collapsed && (
                <p className="px-3 mb-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#a8c4b4]">
                    Navigation
                </p>
            )}
            {visibleLinks.map(({ to, label, end }) => (
                <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onCloseMobile}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                        `group flex items-center rounded-xl transition-all duration-150 ${collapsed ? 'justify-center w-11 h-11 mx-auto' : 'gap-3 px-3 py-[10px]'
                        } text-[15px] font-medium ${isActive
                            ? 'bg-[#dcfce7] text-[#15803d] font-semibold'
                            : 'text-[#4a6b58] hover:bg-[#f0fdf4] hover:text-[#166634]'
                        }`
                    }
                >
                    {({ isActive }) => (
                        <>
                            <span
                                className={`shrink-0 transition-colors duration-150 ${isActive ? 'text-[#16a34a]' : 'text-[#86a898] group-hover:text-[#22c55e]'
                                    }`}
                            >
                                <Icon
                                    path={NAV_ICONS[label] ?? NAV_ICONS['Venue Management']}
                                    className="w-[19px] h-[19px]"
                                />
                            </span>
                            {!collapsed && <span className="leading-none">{label}</span>}
                            {!collapsed && isActive && (
                                <span className="ml-auto w-2 h-2 rounded-full bg-[#22c55e] shrink-0" />
                            )}
                        </>
                    )}
                </NavLink>
            ))}
        </nav>

        {/* User Footer */}
        <div className={`pb-4 border-t border-[#e8f5ee] pt-3 transition-all duration-300 ${collapsed ? 'px-2' : 'px-3'}`}>
            <Tooltip text="Go back to the main user-facing portal to browse venues and manage your own bookings." position="right">
                <button
                    onClick={() => onNavigate('/dashboard')}
                    title={collapsed ? 'User Portal' : undefined}
                    className={`w-full flex items-center transition-all duration-150 font-medium mb-1 rounded-xl hover:bg-[#f0fdf4] text-[#4a6b58] ${collapsed ? 'justify-center w-11 h-11 mx-auto' : 'gap-2.5 px-3 py-[10px] text-[14.5px]'
                        }`}
                >
                    <Icon path="M10 19l-7-7m0 0l7-7m-7 7h18" className="w-[19px] h-[19px] text-[#86a898] shrink-0" />
                    {!collapsed && 'User Portal'}
                </button>
            </Tooltip>
            <Tooltip text="Log out of your admin session." position="right">
                <button
                    onClick={onLogout}
                    title={collapsed ? 'Sign out' : undefined}
                    className={`w-full flex items-center transition-all duration-150 font-medium rounded-xl hover:bg-[#fff1f2] text-[#dc2626] ${collapsed ? 'justify-center w-11 h-11 mx-auto' : 'gap-2.5 px-3 py-[10px] text-[14.5px]'
                        }`}
                >
                    <Icon
                        path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        className="w-[19px] h-[19px] shrink-0"
                    />
                    {!collapsed && 'Sign out'}
                </button>
            </Tooltip>
        </div>
    </>
);

const AdminLayout = () => {
    const { logout, user, effectiveRoles } = useAuth();
    const navigate = useNavigate();
    const [profileOpen, setProfileOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

    const handleLogout = () => { logout(); navigate('/'); };

    const capabilities = {
        can_manage_system:         user?.capabilities?.can_manage_system,
        can_manage_spaces:         user?.capabilities?.can_manage_spaces,
        can_manage_labs:           user?.capabilities?.can_manage_labs,
        can_manage_equipment:      user?.capabilities?.can_manage_equipment,
        can_manage_mess:           user?.capabilities?.can_manage_mess,
        can_manage_media:          user?.capabilities?.can_manage_media,
        can_manage_principal_view: user?.capabilities?.can_manage_principal_view,
        is_hod:                    user?.effective_roles?.includes('HOD'),
    };

    const visibleLinks = NAV_LINKS.filter(({ capability }) => capability(capabilities));
    const { title: roleTitle, subtitle: roleSubtitle } = getRoleDisplay(effectiveRoles);
    const initial = user?.name?.charAt(0)?.toUpperCase() ?? 'A';

    const sidebarProps = {
        roleTitle,
        roleSubtitle,
        visibleLinks,
        collapsed: sidebarCollapsed,
        onCloseMobile: () => setMobileOpen(false),
        onNavigate: navigate,
        onLogout: handleLogout,
    };

    return (
        <div
            className="flex h-screen bg-[#f6fbf8] w-full"
            style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
        >
            {/* ── Desktop Sidebar ── */}
            <aside
                className={`shrink-0 bg-white border-r border-[#e8f5ee] hidden md:flex flex-col z-20
                    transition-all duration-300 overflow-hidden ${sidebarCollapsed ? 'w-[64px]' : 'w-[230px]'
                    }`}
            >
                <SidebarContent {...sidebarProps} />
            </aside>

            {/* ── Mobile Overlay ── */}
            {mobileOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <div
                        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                        onClick={() => setMobileOpen(false)}
                    />
                    <aside className="absolute left-0 top-0 bottom-0 w-[230px] bg-white flex flex-col shadow-2xl z-50">
                        <SidebarContent {...sidebarProps} />
                    </aside>
                </div>
            )}

            {/* ── Main ── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <header className="h-16 bg-white border-b border-[#e8f5ee] shrink-0 flex items-center justify-between px-5 md:px-7">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarCollapsed((p) => !p)}
                            className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg
                                hover:bg-[#f0fdf4] text-[#4a6b58] hover:text-[#15803d] transition-all duration-150"
                            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            <Icon
                                path={sidebarCollapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'}
                                className="w-[18px] h-[18px]"
                            />
                        </button>
                        <button
                            onClick={() => setMobileOpen(true)}
                            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg
                                hover:bg-[#f0fdf4] text-[#4a6b58] transition"
                        >
                            <Icon path="M4 6h16M4 12h16M4 18h16" className="w-[18px] h-[18px]" />
                        </button>
                        <span className="hidden md:block text-[15px] text-[#4a6b58] font-medium tracking-tight select-none">
                            {new Date().toLocaleDateString('en-IN', {
                                weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                            })}
                        </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <NotificationBell tone="admin" />
                        <div className="hidden md:block w-px h-6 bg-[#e8f5ee]" />
                        <div className="relative" ref={profileRef}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setProfileOpen((p) => !p); }}
                                className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white
                                    text-[14px] font-bold hover:opacity-90 active:scale-95 transition-all duration-150
                                    ring-2 ring-[#d1fae5] ring-offset-1"
                                style={user?.profile_image ? {} : { background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)' }}
                            >
                                {user?.profile_image
                                    ? <img src={user.profile_image.startsWith('http') ? user.profile_image : `http://localhost:8000${user.profile_image.startsWith('/') ? '' : '/'}${user.profile_image}`} alt={user.name} className="w-full h-full object-cover" />
                                    : initial
                                }
                            </button>
                            {profileOpen && (
                                <div className="absolute right-0 top-full mt-2.5 w-64 bg-white rounded-2xl
                                    shadow-xl shadow-black/8 border border-[#e8f5ee] overflow-hidden z-50">
                                    <div className="px-4 py-4 bg-[#f6fbf8] border-b border-[#e8f5ee]">
                                        <p className="text-[15px] font-semibold text-[#14532d]">{user?.name ?? 'Admin User'}</p>
                                        <p className="text-[13px] text-[#86a898] mt-0.5">{user?.email ?? ''}</p>
                                        <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#dcfce7] rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                                            <span className="text-[12px] font-semibold text-[#15803d]">{roleTitle}</span>
                                        </div>
                                    </div>
                                    <div className="py-1.5">
                                        <button
                                            onClick={() => { navigate('/dashboard'); setProfileOpen(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px]
                                                text-[#374151] hover:bg-[#f6fbf8] transition text-left"
                                        >
                                            <Icon path="M10 19l-7-7m0 0l7-7m-7 7h18" className="w-4 h-4 text-[#86a898]" />
                                            Back to User Portal
                                        </button>
                                    </div>
                                    <div className="border-t border-[#e8f5ee] py-1.5">
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px]
                                                text-[#dc2626] hover:bg-[#fff1f2] transition text-left"
                                        >
                                            <Icon
                                                path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                                className="w-4 h-4"
                                            />
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto w-full">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;