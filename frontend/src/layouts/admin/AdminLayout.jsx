import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const NAV_LINKS = [
    { to: '/admin',                label: 'Space Approval',  end: true,  capability: (c) => c?.can_manage_system    },
    { to: '/admin/spaces',         label: 'Spaces',          end: false, capability: (c) => c?.can_manage_spaces    },
    { to: '/admin/equipment',      label: 'Equipment',       end: false, capability: (c) => c?.can_manage_equipment },
    { to: '/admin/departments',    label: 'Departments',     end: false, capability: (c) => c?.can_manage_system    },
    { to: '/admin/role-overrides', label: 'Role Overrides',  end: false, capability: (c) => c?.can_manage_system    },
    { to: '/admin/mess',           label: 'Mess Operations', end: false, capability: (c) => c?.can_manage_mess      },
];

const NAV_ICONS = {
    'Space Approval':  'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    'Spaces':          'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    'Equipment':       'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
    'Departments':     'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    'Role Overrides':  'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
    'Mess Operations': 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
};

const getRoleDisplay = (effectiveRole) => {
    if (!effectiveRole) return { title: 'Admin Portal', subtitle: 'Staff' };
    const normalized = effectiveRole.trim().toLowerCase();
    const map = {
        'it admin':         { title: 'IT Admin',          subtitle: 'System Operations'   },
        'mess':             { title: 'Mess Admin',         subtitle: 'Mess Operations'     },
        'facility manager': { title: 'Facility Manager',   subtitle: 'Spaces & Facilities' },
        'receptionist':     { title: 'Receptionist',       subtitle: 'Space Bookings'      },
        'lab in-charge':    { title: 'Lab In-charge',      subtitle: 'Lab Management'      },
        'librarian':        { title: 'Librarian',          subtitle: 'Library Spaces'      },
        'principal':        { title: 'Principal',          subtitle: 'Institution Head'    },
        'hod':              { title: 'Head of Department', subtitle: 'Department Head'     },
    };
    return map[normalized] ?? { title: effectiveRole, subtitle: 'Admin Portal' };
};

const Icon = ({ path, className = "w-[18px] h-[18px]" }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

const SidebarContent = ({ roleTitle, roleSubtitle, visibleLinks, collapsed, onCloseMobile, onNavigate, onLogout }) => (
    <>
        {/* Logo / Brand — same height as top bar (64px) */}
        <div
            className={`border-b border-[#e8f5ee] transition-all duration-300 flex items-center ${
                collapsed ? 'justify-center px-3 h-16' : 'px-5 h-16'
            }`}
        >
            {collapsed ? (
                <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain" />
            ) : (
                <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain shrink-0" />
                    <div>
                        <p className="text-[14px] font-bold text-[#14532d] leading-tight tracking-tight">{roleTitle}</p>
                        <p className="text-[12px] text-[#86a898] leading-tight mt-0.5">{roleSubtitle}</p>
                    </div>
                </div>
            )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 pt-4 pb-4 space-y-0.5 transition-all duration-300 ${collapsed ? 'px-2' : 'px-3'}`}>
            {!collapsed && (
                <p className="px-3 mb-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a8c4b4]">Navigation</p>
            )}
            {visibleLinks.map(({ to, label, end }) => (
                <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onCloseMobile}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                        `group flex items-center rounded-xl transition-all duration-150 ${
                            collapsed ? 'justify-center w-11 h-11 mx-auto' : 'gap-3 px-3 py-[9px]'
                        } text-[14px] font-medium ${
                            isActive
                                ? 'bg-[#dcfce7] text-[#15803d] font-semibold'
                                : 'text-[#4a6b58] hover:bg-[#f0fdf4] hover:text-[#166534]'
                        }`
                    }
                >
                    {({ isActive }) => (
                        <>
                            <span className={`shrink-0 transition-colors duration-150 ${isActive ? 'text-[#16a34a]' : 'text-[#86a898] group-hover:text-[#22c55e]'}`}>
                                <Icon path={NAV_ICONS[label] || NAV_ICONS['Spaces']} className="w-[17px] h-[17px]" />
                            </span>
                            {!collapsed && <span className="leading-none">{label}</span>}
                            {!collapsed && isActive && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
                            )}
                        </>
                    )}
                </NavLink>
            ))}
        </nav>

        {/* User Footer */}
        <div className={`pb-4 border-t border-[#e8f5ee] pt-3 transition-all duration-300 ${collapsed ? 'px-2' : 'px-3'}`}>
            <button
                onClick={() => onNavigate('/dashboard')}
                title={collapsed ? 'User Portal' : undefined}
                className={`w-full flex items-center transition-all duration-150 font-medium mb-1 rounded-xl hover:bg-[#f0fdf4] text-[#4a6b58] ${
                    collapsed ? 'justify-center w-11 h-11 mx-auto' : 'gap-2.5 px-3 py-[9px] text-[13.5px]'
                }`}
            >
                <Icon path="M10 19l-7-7m0 0l7-7m-7 7h18" className="w-[17px] h-[17px] text-[#86a898] shrink-0" />
                {!collapsed && 'User Portal'}
            </button>
            <button
                onClick={onLogout}
                title={collapsed ? 'Sign out' : undefined}
                className={`w-full flex items-center transition-all duration-150 font-medium rounded-xl hover:bg-[#fff1f2] text-[#dc2626] ${
                    collapsed ? 'justify-center w-11 h-11 mx-auto' : 'gap-2.5 px-3 py-[9px] text-[13.5px]'
                }`}
            >
                <Icon path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" className="w-[17px] h-[17px] shrink-0" />
                {!collapsed && 'Sign out'}
            </button>
        </div>
    </>
);

const AdminLayout = () => {
    const { logout, user, effectiveRole } = useAuth();
    const navigate = useNavigate();
    const [profileOpen, setProfileOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const profileRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLogout = () => { logout(); navigate('/'); };

    const capabilities = {
        can_manage_system:    user?.capabilities?.can_manage_system,
        can_manage_spaces:    user?.capabilities?.can_manage_spaces,
        can_manage_equipment: user?.capabilities?.can_manage_equipment,
        can_manage_mess:      user?.capabilities?.can_manage_mess,
    };

    const visibleLinks = NAV_LINKS.filter(({ capability }) => capability(capabilities));
    const { title: roleTitle, subtitle: roleSubtitle } = getRoleDisplay(effectiveRole);
    const initial = user?.name?.charAt(0)?.toUpperCase() || 'A';

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
                className={`shrink-0 bg-white border-r border-[#e8f5ee] hidden md:flex flex-col z-20 transition-all duration-300 overflow-hidden ${
                    sidebarCollapsed ? 'w-[64px]' : 'w-[230px]'
                }`}
            >
                <SidebarContent {...sidebarProps} />
            </aside>

            {/* ── Mobile Overlay ── */}
            {mobileOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                    <aside className="absolute left-0 top-0 bottom-0 w-[230px] bg-white flex flex-col shadow-2xl z-50">
                        <SidebarContent {...sidebarProps} />
                    </aside>
                </div>
            )}

            {/* ── Main ── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                {/* Top Bar — h-16 = 64px, same as sidebar brand row */}
                <header className="h-16 bg-white border-b border-[#e8f5ee] shrink-0 flex items-center justify-between px-5 md:px-7">

                    {/* Left */}
                    <div className="flex items-center gap-3">
                        {/* Desktop: collapse toggle */}
                        <button
                            onClick={() => setSidebarCollapsed(p => !p)}
                            className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg hover:bg-[#f0fdf4] text-[#86a898] hover:text-[#15803d] transition-all duration-150"
                            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            <Icon
                                path={sidebarCollapsed
                                    ? 'M13 5l7 7-7 7M5 5l7 7-7 7'
                                    : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'}
                                className="w-4 h-4"
                            />
                        </button>

                        {/* Mobile: hamburger */}
                        <button
                            onClick={() => setMobileOpen(true)}
                            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#f0fdf4] text-[#4a6b58] transition"
                        >
                            <Icon path="M4 6h16M4 12h16M4 18h16" className="w-[18px] h-[18px]" />
                        </button>

                        {/* Date */}
                        <span className="hidden md:block text-[13px] text-[#a8c4b4] font-medium tracking-tight select-none">
                            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-2.5">

                        {/* Notifications */}
                        <button className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#f0fdf4] text-[#86a898] hover:text-[#15803d] transition-all duration-150">
                            <Icon
                                path="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                                className="w-[19px] h-[19px]"
                            />
                            <span className="absolute top-[9px] right-[9px] w-[7px] h-[7px] rounded-full bg-[#22c55e] border-2 border-white" />
                        </button>

                        {/* Divider */}
                        <div className="hidden md:block w-px h-5 bg-[#e8f5ee]" />

                        {/* Avatar + dropdown */}
                        <div className="relative" ref={profileRef}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setProfileOpen(p => !p); }}
                                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold hover:opacity-90 active:scale-95 transition-all duration-150 ring-2 ring-[#d1fae5] ring-offset-1"
                                style={{ background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)' }}
                            >
                                {initial}
                            </button>

                            {profileOpen && (
                                <div className="absolute right-0 top-full mt-2.5 w-60 bg-white rounded-2xl shadow-xl shadow-black/8 border border-[#e8f5ee] overflow-hidden z-50">
                                    <div className="px-4 py-4 bg-[#f6fbf8] border-b border-[#e8f5ee]">
                                        <p className="text-[14px] font-semibold text-[#14532d]">{user?.name || 'Admin User'}</p>
                                        <p className="text-[12px] text-[#86a898] mt-0.5">{user?.email || ''}</p>
                                        <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#dcfce7] rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                                            <span className="text-[11px] font-semibold text-[#15803d]">{roleTitle}</span>
                                        </div>
                                    </div>
                                    <div className="py-1.5">
                                        <button
                                            onClick={() => { navigate('/dashboard'); setProfileOpen(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#374151] hover:bg-[#f6fbf8] transition text-left"
                                        >
                                            <Icon path="M10 19l-7-7m0 0l7-7m-7 7h18" className="w-4 h-4 text-[#86a898]" />
                                            Back to User Portal
                                        </button>
                                    </div>
                                    <div className="border-t border-[#e8f5ee] py-1.5">
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#dc2626] hover:bg-[#fff1f2] transition text-left"
                                        >
                                            <Icon path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" className="w-4 h-4" />
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto w-full">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;