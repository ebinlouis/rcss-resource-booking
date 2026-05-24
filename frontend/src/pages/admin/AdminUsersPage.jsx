import Tooltip from '../../components/Tooltip'
import PageInfo from '../../components/PageInfo'
import { useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, X } from 'lucide-react';
import adminUserService from '../../api/adminUserService';

const getUserName = (user) => {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    return name || user.email;
};

const normalizeList = (data) => Array.isArray(data) ? data : data.results || [];

function RoleBadge({ role }) {
    return (
        <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-[12px] font-bold text-green-700 ring-1 ring-green-100">
            {role.display_name || role.name}
        </span>
    );
}

function UserRoleModal({ user, roles, onClose, onSave, isSaving }) {
    const [selectedRoles, setSelectedRoles] = useState(() =>
        (user.roles || []).map((roleId) => Number(roleId))
    );

    const roleGroups = useMemo(() => {
        const scoped = new Set(['RECEPTIONIST', 'LAB_INCHARGE', 'LIBRARIAN']);
        const system = new Set(['IT_ADMIN']);
        const module = new Set(['MESS_MANAGER', 'MEDIA_INCHARGE', 'FLEET_MANAGER']);

        return [
            { title: 'Base Identity', items: roles.filter((role) => ['STUDENT', 'FACULTY', 'STAFF'].includes(role.name)) },
            { title: 'Scoped Space Badges', items: roles.filter((role) => scoped.has(role.name)) },
            { title: 'Module Managers', items: roles.filter((role) => module.has(role.name)) },
            { title: 'Institutional / System', items: roles.filter((role) => ['HOD', 'PRINCIPAL'].includes(role.name) || system.has(role.name)) },
        ].filter((group) => group.items.length > 0);
    }, [roles]);

    const toggleRole = (roleId) => {
        setSelectedRoles((current) =>
            current.includes(roleId)
                ? current.filter((id) => id !== roleId)
                : [...current, roleId]
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-green-100 bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-green-100 px-6 py-5">
                    <div>
                        <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-green-700">User Badge Management</p>
                        <h2 className="mt-1 text-[20px] font-bold text-gray-950">{getUserName(user)}</h2>
                        <p className="mt-1 text-[14px] text-gray-500">{user.email}</p>
                    </div>
                    <Tooltip text="Close without saving." position="left">
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </Tooltip>
                </div>

                <div className="max-h-[62vh] space-y-5 overflow-y-auto px-6 py-5">
                    {roleGroups.map((group) => (
                        <div key={group.title}>
                            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-gray-500">{group.title}</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {group.items.map((role) => {
                                    const isChecked = selectedRoles.includes(role.id);
                                    return (
                                        <label
                                            key={role.id}
                                            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                                                isChecked
                                                    ? 'border-green-200 bg-green-50'
                                                    : 'border-gray-200 bg-white hover:border-green-100 hover:bg-green-50/40'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggleRole(role.id)}
                                                className="mt-1 h-4 w-4 accent-green-700"
                                            />
                                            <span>
                                                <span className="block text-[14.5px] font-bold text-gray-950">
                                                    {role.display_name || role.name}
                                                </span>
                                                <span className="mt-0.5 block text-[12.5px] font-medium text-gray-500">
                                                    {role.name}
                                                </span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-3 border-t border-green-100 px-6 py-5">
                    <Tooltip text="Discard any changes and close this panel." position="top">
                      <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="rounded-xl border border-gray-200 px-5 py-2.5 text-[14px] font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </Tooltip>
                    <Tooltip text="Save the selected roles for this user. Changes take effect immediately." position="top">
                      <button
                        type="button"
                        onClick={() => onSave(user.id, selectedRoles)}
                        disabled={isSaving}
                        className="rounded-xl bg-green-700 px-5 py-2.5 text-[14px] font-bold text-white transition hover:bg-green-800 disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save Roles'}
                      </button>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}

function AdminUsersPage() {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let isMounted = true;

        const loadRoles = async () => {
            try {
                const data = await adminUserService.getRoles();
                if (isMounted) setRoles(normalizeList(data));
            } catch (err) {
                console.error('Failed to load roles', err);
                if (isMounted) setError('Could not load roles.');
            }
        };

        loadRoles();
        return () => { isMounted = false; };
    }, []);

useEffect(() => {
    let isMounted = true;

    const timer = setTimeout(async () => {
        setIsLoading(true);

        try {
            const data = await adminUserService.getUsers(search.trim() ? { q: search.trim() } : {});
            const allUsers = normalizeList(data);

            const query = search.trim().toLowerCase();

            const filteredUsers = query
                ? allUsers.filter((user) =>
                      [
                          getUserName(user),
                          user.email,
                          user.employee_student_id,
                          user.phone,
                          user.department_name,
                      ]
                          .filter(Boolean)
                          .some((field) =>
                              field.toLowerCase().includes(query)
                          )
                  )
                : allUsers;

            if (isMounted) {
                setUsers(filteredUsers);
                setError('');
            }
        } catch (err) {
            console.error('Failed to load users', err);
            if (isMounted) setError('Could not load users.');
        } finally {
            if (isMounted) setIsLoading(false);
        }
    }, 250);

    return () => {
        isMounted = false;
        clearTimeout(timer);
    };
}, [search]);

    const handleSaveRoles = async (userId, roleIds) => {
        setIsSaving(true);
        setError('');

        try {
            const updated = await adminUserService.setRoles(userId, roleIds);
            setUsers((current) => current.map((user) => user.id === userId ? updated : user));
            setSelectedUser(null);
        } catch (err) {
            console.error('Failed to update user roles', err);
            setError(err.response?.data?.roles || 'Could not update user roles.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-6xl p-6 md:p-10">
            {selectedUser && (
                <UserRoleModal
                    user={selectedUser}
                    roles={roles}
                    onClose={() => setSelectedUser(null)}
                    onSave={handleSaveRoles}
                    isSaving={isSaving}
                />
            )}

            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-green-700">
                        Rajagiri College · IT Admin
                    </p>
                    <div className="flex items-center gap-2">
                      <h1 className="text-[26px] font-bold tracking-tight text-gray-950">User Management</h1>
                      <PageInfo text="View all registered users and assign or remove system roles like Admin, Faculty, Lab In-Charge, and more." />
                    </div>
                    <p className="mt-2 text-[15px] text-gray-600">
                        Manage user roles and access for the admin portal.
                    </p>
                </div>
                <div className="relative w-full md:w-[360px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search name, email, department or phone"
                        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-[14.5px] font-medium text-gray-800 outline-none transition focus:border-green-300 focus:ring-2 focus:ring-green-100"
                    />
                </div>
            </div>

            {error && (
                <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
                <div className="border-b border-green-100 px-6 py-4">
                    <p className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.1em] text-gray-950">
                        <ShieldCheck className="h-4 w-4 text-green-700" />
                        User Badges
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] border-collapse text-left">
                        <thead>
                            <tr className="border-b border-green-100 bg-green-50/50">
                                <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-[0.1em] text-gray-500">User</th>
                                <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-[0.1em] text-gray-500">Department</th>
                                <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-[0.1em] text-gray-500">Roles</th>
                                <th className="px-6 py-4 text-right text-[12px] font-bold uppercase tracking-[0.1em] text-gray-500">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-green-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-[14px] font-medium text-gray-500">
                                        Loading users...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-[14px] font-medium text-gray-500">
                                        No users found.
                                    </td>
                                </tr>
                            ) : users.map((user) => (
                                <tr key={user.id} className="transition hover:bg-green-50/35">
                                    <td className="px-6 py-4">
                                        <p className="text-[15px] font-bold text-gray-950">{getUserName(user)}</p>
                                        <p className="mt-0.5 text-[13px] font-medium text-gray-500">{user.email}</p>
                                    </td>
                                    <td className="px-6 py-4 text-[14px] font-semibold text-gray-700">
                                        {user.department_name || 'Unassigned'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex max-w-[360px] flex-wrap gap-2">
                                            {user.role_details?.length > 0
                                                ? user.role_details.map((role) => <RoleBadge key={role.id} role={role} />)
                                                : <span className="text-[13px] font-medium text-gray-400">No badges</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Tooltip text="Assign or remove system roles for this user (e.g. Admin, Faculty, Lab In-Charge)." position="left">
                                          <button
                                            type="button"
                                            onClick={() => setSelectedUser(user)}
                                            className="rounded-xl bg-gray-950 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-black"
                                          >
                                            Edit Roles
                                          </button>
                                        </Tooltip>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default AdminUsersPage;