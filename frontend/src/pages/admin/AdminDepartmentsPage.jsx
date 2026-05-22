import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/axios';

const inputCls =
    'w-full border border-[#e2e8f0] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] bg-white outline-none transition focus:ring-2 focus:ring-[#15803d] focus:border-transparent placeholder:text-[#94a3b8] hover:border-[#94a3b8]';

export default function AdminDepartmentsPage() {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ department_name: '', department_code: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState(null);

    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState(null);

    const refreshRef = useRef(null);

    const fetchDepartments = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setListError(null);
        try {
            const res = await api.get('/auth/departments/');
            setDepartments(res.data.results || res.data);
        } catch (err) {
            console.error(err);
            setListError('Failed to load departments.');
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshRef.current = fetchDepartments;
    }, [fetchDepartments]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setListError(null);
            try {
                const res = await api.get('/auth/departments/');
                if (!cancelled) setDepartments(res.data.results || res.data);
            } catch (err) {
                console.error(err);
                if (!cancelled) setListError('Failed to load departments.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

    const openAddModal = () => {
        setEditingId(null);
        setForm({ department_name: '', department_code: '' });
        setFormError(null);
        setIsModalOpen(true);
    };

    const openEditModal = (dept) => {
        setEditingId(dept.id);
        setForm({
            department_name: dept.department_name ?? '',
            department_code: dept.department_code ?? '',
        });
        setFormError(null);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setEditingId(null);
        setForm({ department_name: '', department_code: '' });
        setFormError(null);
    };

    const openDeleteModal = (dept) => {
        setDeleteTarget(dept);
        setDeleteError(null);
    };

    const closeDeleteModal = () => {
        if (isDeleting) return;
        setDeleteTarget(null);
        setDeleteError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setFormError(null);
        try {
            if (editingId) {
                await api.patch(`/auth/departments/${editingId}/`, form);
            } else {
                await api.post('/auth/departments/', form);
            }
            setIsModalOpen(false);
            setEditingId(null);
            setForm({ department_name: '', department_code: '' });
            refreshRef.current?.({ silent: true });
        } catch (err) {
            setFormError(
                err.response?.data?.department_name?.[0] ||
                err.response?.data?.department_code?.[0] ||
                (editingId ? 'Error updating department' : 'Error adding department')
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        setDeleteError(null);
        try {
            await api.delete(`/auth/departments/${deleteTarget.id}/`);
            setDeleteTarget(null);
            refreshRef.current?.({ silent: true });
        } catch {
            setDeleteError('Error deleting department. It may be in use.');
        } finally {
            setIsDeleting(false);
        }
    };

    const isEditing = editingId != null;

    return (
        <div className="min-h-full bg-[#f6fbf8] p-6 md:p-8">
            <div className="max-w-[1200px] mx-auto">
                {/* Header */}
                <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
                    <div>
                        <p className="caps-label mb-1.5">Rajagiri College · System Admin</p>
                        <h1 className="text-[26px] font-bold text-[#0f172a] tracking-tight leading-none">
                            Departments
                        </h1>
                        <p className="text-[15px] text-[#374151] mt-2">
                            Manage departments, HODs, and faculty members.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={openAddModal}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-[13.5px] font-semibold transition shadow-sm"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M12 4v16m8-8H4" />
                        </svg>
                        Add Department
                    </button>
                </div>

                {/* List */}
                {listError ? (
                    <div className="bg-white border border-[#e8f5ee] rounded-2xl py-16 text-center px-8">
                        <p className="text-[15px] font-semibold text-[#0f172a]">Could not load departments</p>
                        <p className="text-[13.5px] text-[#94a3b8] mt-1.5">{listError}</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-[#e8f5ee] overflow-hidden overflow-x-auto">
                        <table className="w-full min-w-[480px] text-left border-collapse">
                            <thead>
                                <tr className="bg-[#f6fbf8] border-b border-[#e8f5ee]">
                                    <th className="caps-label px-6 py-4">Department Name</th>
                                    <th className="caps-label px-6 py-4">Department Code</th>
                                    <th className="caps-label px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e8f5ee]">
                                {loading ? (
                                    <tr>
                                        <td colSpan="3" className="text-center py-10 text-[#94a3b8] text-[13.5px]">
                                            Loading departments...
                                        </td>
                                    </tr>
                                ) : departments.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" className="text-center py-10 text-[#94a3b8] text-[13.5px]">
                                            No departments found. Click &quot;Add Department&quot; to create one.
                                        </td>
                                    </tr>
                                ) : (
                                    departments.map((dept) => (
                                        <tr key={dept.id} className="hover:bg-[#f0fdf4]/50 transition">
                                            <td className="px-6 py-4 text-[14px] font-semibold text-[#0f172a]">
                                                {dept.department_name}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#f0fdf4] rounded-lg text-[11px] font-bold text-[#14532d] tracking-wide border border-[#d1fae5] font-mono uppercase">
                                                    {dept.department_code}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-3 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditModal(dept)}
                                                        className="text-[13px] font-semibold text-[#15803d] hover:text-[#166534] transition"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openDeleteModal(dept)}
                                                        className="text-[13px] font-semibold text-red-600 hover:text-red-700 transition"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add / Edit Department Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={closeModal}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start mb-5">
                            <div>
                                <p className="text-[10.5px] font-bold text-[#15803d] uppercase tracking-[0.12em] mb-0.5">
                                    {isEditing ? 'Update Department' : 'New Department'}
                                </p>
                                <h3 className="text-[20px] font-bold text-[#0f172a] tracking-tight">
                                    {isEditing ? 'Edit Department' : 'Add New Department'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={isSubmitting}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f1f5f9] text-[#94a3b8] transition disabled:opacity-40"
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block caps-label mb-1.5">
                                    Department Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    required
                                    value={form.department_name}
                                    onChange={(e) => setForm({ ...form, department_name: e.target.value })}
                                    placeholder="e.g. Computer Science"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className="block caps-label mb-1.5">
                                    Department Code <span className="text-red-500">*</span>
                                </label>
                                <input
                                    required
                                    value={form.department_code}
                                    onChange={(e) => setForm({ ...form, department_code: e.target.value })}
                                    placeholder="e.g. CS"
                                    className={inputCls}
                                />
                            </div>
                            {formError && (
                                <p className="text-xs text-red-500 font-medium">{formError}</p>
                            )}
                            <div className="flex flex-wrap gap-3 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={isSubmitting}
                                    className="px-4 py-2.5 text-[13px] font-semibold text-[#4a6b58] border border-[#d1fae5] bg-white hover:bg-[#f0fdf4] rounded-xl transition disabled:opacity-40"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2.5 text-[13px] font-semibold text-white bg-[#15803d] hover:bg-[#166534] rounded-xl transition disabled:opacity-50"
                                >
                                    {isSubmitting
                                        ? 'Saving...'
                                        : isEditing
                                          ? 'Save Changes'
                                          : 'Save Department'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={closeDeleteModal}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-[20px] font-bold text-[#0f172a] tracking-tight">
                                Delete Department
                            </h3>
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                disabled={isDeleting}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f1f5f9] text-[#94a3b8] transition disabled:opacity-40"
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-[14px] text-[#374151] leading-relaxed">
                            Are you sure you want to delete{' '}
                            <span className="font-semibold text-[#0f172a]">
                                {deleteTarget.department_name}
                            </span>
                            ?
                        </p>
                        <p className="text-[13px] text-[#94a3b8] mt-2">
                            This action cannot be undone.
                        </p>

                        {deleteError && (
                            <p className="text-xs text-red-500 font-medium mt-4">{deleteError}</p>
                        )}

                        <div className="flex flex-wrap gap-3 justify-end mt-6">
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                disabled={isDeleting}
                                className="px-4 py-2.5 text-[13px] font-semibold text-[#4a6b58] border border-[#d1fae5] bg-white hover:bg-[#f0fdf4] rounded-xl transition disabled:opacity-40"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="px-4 py-2.5 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete Department'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
