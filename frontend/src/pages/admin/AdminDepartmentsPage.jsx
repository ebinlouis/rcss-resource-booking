import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/axios';

export default function AdminDepartmentsPage() {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ department_name: '', department_code: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Stable ref-based refresher — calling this from event handlers
    // never touches the effect, so the linter can't flag it
    const refreshRef = useRef(null);

    const fetchDepartments = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/auth/departments/');
            setDepartments(res.data.results || res.data);
        } catch (err) {
            console.error(err);
            setError("Failed to load departments.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Keep the ref up-to-date so event handlers always call the latest version
    useEffect(() => {
        refreshRef.current = fetchDepartments;
    }, [fetchDepartments]);

    // Initial load — fully inline, no external setState-calling function invoked
    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);
            try {
                const res = await api.get('/auth/departments/');
                if (!cancelled) setDepartments(res.data.results || res.data);
            } catch (err) {
                console.error(err);
                if (!cancelled) setError("Failed to load departments.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            await api.post('/auth/departments/', form);
            setForm({ department_name: '', department_code: '' });
            refreshRef.current?.();
        } catch (err) {
            setError(
                err.response?.data?.department_name?.[0] ||
                err.response?.data?.department_code?.[0] ||
                "Error adding department"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this department?")) return;
        try {
            await api.delete(`/auth/departments/${id}/`);
            refreshRef.current?.();
        } catch {
            alert("Error deleting department. It may be in use.");
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Departments & Faculties</h1>
                <p className="text-sm text-gray-500 mt-1">Manage departments, HODs, and faculty members.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* ── CREATE FORM ── */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                    <h2 className="text-sm font-semibold text-gray-800 mb-4 uppercase tracking-wide">Add New Department</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Department Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                required
                                value={form.department_name}
                                onChange={e => setForm({ ...form, department_name: e.target.value })}
                                placeholder="e.g. Computer Science"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-700 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Department Code <span className="text-red-500">*</span>
                            </label>
                            <input
                                required
                                value={form.department_code}
                                onChange={e => setForm({ ...form, department_code: e.target.value })}
                                placeholder="e.g. CS"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-700 outline-none"
                            />
                        </div>
                        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-green-700 hover:bg-green-800 text-white font-medium text-sm py-2.5 rounded-lg transition disabled:opacity-50"
                        >
                            {isSubmitting ? 'Adding...' : 'Save Department'}
                        </button>
                    </form>
                </div>

                {/* ── LIST VIEW ── */}
                <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50/50 text-xs uppercase text-gray-400 font-semibold border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Code</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan="3" className="px-6 py-8 text-center text-gray-400">Loading departments...</td></tr>
                                ) : departments.length === 0 ? (
                                    <tr><td colSpan="3" className="px-6 py-8 text-center text-gray-400">No departments found.</td></tr>
                                ) : (
                                    departments.map((dept) => (
                                        <tr key={dept.id} className="hover:bg-gray-50/50 transition">
                                            <td className="px-6 py-4 font-medium text-gray-900">{dept.department_name}</td>
                                            <td className="px-6 py-4">
                                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs font-mono">
                                                    {dept.department_code}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(dept.id)}
                                                    className="text-red-500 hover:text-red-700 text-xs font-medium transition"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
