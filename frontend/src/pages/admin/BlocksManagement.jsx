import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import spaceAdminService from '../../api/spaceAdminService';
import api from '../../api/axios';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const SPACE_TYPE_META = {
    GENERAL_HALL: { label: 'General Hall', color: 'bg-[#dcfce7] text-[#14532d] border-[#bbf7d0]' },
    LAB:          { label: 'Laboratory',   color: 'bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]' },
    GUEST_ROOM:   { label: 'Guest Room',   color: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]' },
    CLASSROOM:    { label: 'Classroom',    color: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]' },
}

// ─────────────────────────────────────────────────────────────
// Block Detail Modal
// ─────────────────────────────────────────────────────────────

function BlockDetailModal({ block, onClose }) {
    const [venues, setVenues]               = useState([]);
    const [classrooms, setClassrooms]       = useState([]);
    const [loading, setLoading]             = useState(true);
    const [error, setError]                 = useState(null);

    useEffect(() => {
        if (!block) return;
        let isMounted = true;

        const fetchBlockSpaces = async () => {
            setLoading(true);
            setError(null);
            try {
                const [venuesRes, classroomsRes] = await Promise.all([
                    api.get(`/spaces/catalog/?block=${block.id}`),
                    api.get(`/spaces/catalog/?space_view=classrooms&block=${block.id}`),
                ]);
                if (!isMounted) return;
                const venueList     = venuesRes.data?.results     ?? venuesRes.data     ?? [];
                const classroomList = classroomsRes.data?.results ?? classroomsRes.data ?? [];
                setVenues(Array.isArray(venueList) ? venueList : []);
                setClassrooms(Array.isArray(classroomList) ? classroomList : []);
            } catch (err) {
                if (!isMounted) return;
                console.error('Failed to load block spaces', err);
                setError('Could not load spaces for this block.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchBlockSpaces();
        return () => { isMounted = false; };
    }, [block]);

    // Close on Escape key
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-2xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-[#e8f5ee] shrink-0">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#94a3b8] mb-1">
                            Block · {block.code}
                        </p>
                        <h2 className="text-[20px] font-bold text-[#0f172a] leading-tight">
                            {block.name}
                        </h2>
                        {block.description && (
                            <p className="text-[13px] text-[#6b7280] mt-1">{block.description}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-4 p-1.5 rounded-lg text-[#94a3b8] hover:text-[#374151] hover:bg-[#f1f5f9] transition shrink-0"
                        aria-label="Close"
                    >
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body — scrollable */}
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-7">
                    {loading ? (
                        <div className="py-16 flex flex-col items-center gap-3 text-[#94a3b8]">
                            <svg className="w-7 h-7 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M1 4v6h6M23 20v-6h-6" />
                                <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" />
                            </svg>
                            <span className="text-[13.5px]">Loading spaces…</span>
                        </div>
                    ) : error ? (
                        <div className="py-16 text-center">
                            <p className="text-[14px] font-semibold text-[#dc2626]">{error}</p>
                        </div>
                    ) : (
                        <>
                            {/* ── Venues section ── */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <h3 className="text-[13px] font-bold uppercase tracking-widest text-[#374151]">
                                        Venues
                                    </h3>
                                    <span className="inline-flex items-center justify-center text-[11px] font-bold text-[#15803d] bg-[#dcfce7] rounded-full px-2 py-0.5 border border-[#bbf7d0]">
                                        {venues.length}
                                    </span>
                                </div>

                                {venues.length === 0 ? (
                                    <p className="text-[13px] text-[#94a3b8] py-4 text-center border border-dashed border-[#e2e8f0] rounded-xl">
                                        No venues in this block yet.
                                    </p>
                                ) : (
                                    <div className="divide-y divide-[#f1f5f9] border border-[#e8f5ee] rounded-xl overflow-hidden">
                                        {venues.map((space) => {
                                            const meta = SPACE_TYPE_META[space.space_type] ?? {
                                                label: space.space_type,
                                                color: 'bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]',
                                            };
                                            return (
                                                <div key={space.id} className="flex items-center gap-4 px-4 py-3 bg-white">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[13.5px] font-semibold text-[#0f172a] truncate">
                                                            {space.name}
                                                        </p>
                                                        {space.location && (
                                                            <p className="text-[12px] text-[#6b7280] truncate mt-0.5">
                                                                {space.location}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {space.capacity_hard && (
                                                            <span className="text-[12px] font-semibold text-[#374151]">
                                                                {space.capacity_hard} seats
                                                            </span>
                                                        )}
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${meta.color}`}>
                                                            {meta.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>

                            {/* ── Classrooms section ── */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <h3 className="text-[13px] font-bold uppercase tracking-widest text-[#374151]">
                                        Classrooms
                                    </h3>
                                    <span className="inline-flex items-center justify-center text-[11px] font-bold text-[#1d4ed8] bg-[#eff6ff] rounded-full px-2 py-0.5 border border-[#bfdbfe]">
                                        {classrooms.length}
                                    </span>
                                </div>

                                {classrooms.length === 0 ? (
                                    <p className="text-[13px] text-[#94a3b8] py-4 text-center border border-dashed border-[#e2e8f0] rounded-xl">
                                        No classrooms in this block yet.
                                    </p>
                                ) : (
                                    <div className="divide-y divide-[#f1f5f9] border border-[#e8f5ee] rounded-xl overflow-hidden">
                                        {classrooms.map((space) => (
                                            <div key={space.id} className="flex items-center gap-4 px-4 py-3 bg-white">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13.5px] font-semibold text-[#0f172a] truncate">
                                                        {space.name}
                                                    </p>
                                                    {space.location && (
                                                        <p className="text-[12px] text-[#6b7280] truncate mt-0.5">
                                                            {space.location}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-[12px] font-semibold text-[#374151]">
                                                        Seats {space.capacity_hard}
                                                    </span>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]">
                                                        Classroom
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[#e8f5ee] shrink-0 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-[13px] font-semibold text-[#4a6b58] border border-[#d1fae5] bg-white hover:bg-[#f0fdf4] rounded-xl transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

const BlocksManagement = () => {
    const navigate = useNavigate();
    const [blocks, setBlocks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: ''
    });
    const [editingId, setEditingId] = useState(null);
    const [search, setSearch] = useState('');
    const [selectedBlock, setSelectedBlock] = useState(null);


    useEffect(() => {
        let isMounted = true;

        const fetchInitial = async () => {
            try {
                const data = await spaceAdminService.getBlocks();
                if (isMounted) {
                    setBlocks(Array.isArray(data) ? data : data.results || []);
                }
            } catch (error) {
                console.error('Failed to fetch blocks', error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchInitial();

        return () => {
            isMounted = false;
        };
    }, []);

    const refreshBlocks = async () => {
        setIsLoading(true);
        try {
            const data = await spaceAdminService.getBlocks();
            setBlocks(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error('Failed to refresh blocks', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (editingId) {
                await spaceAdminService.updateBlock(editingId, formData);
            } else {
                await spaceAdminService.createBlock(formData);
            }

            setIsModalOpen(false);
            setFormData({
                name: '',
                code: '',
                description: ''
            });
            setEditingId(null);
            refreshBlocks();
        } catch (error) {
            console.error('Failed to save block', error);

            const backendError =
                error.response?.data?.code?.[0] ||
                error.response?.data?.name?.[0] ||
                'Please check your inputs.';

            toast.error(`Failed to save block: ${backendError}`);
        }
    };

    const openEdit = (block) => {
        setFormData({
            name: block.name,
            code: block.code || '',
            description: block.description || ''
        });

        setEditingId(block.id);
        setIsModalOpen(true);
    };

    const filtered = useMemo(() => {
        const q = search.toLowerCase();

        if (!q) return blocks;

        return blocks.filter(
            (b) =>
                b.name?.toLowerCase().includes(q) ||
                b.code?.toLowerCase().includes(q) ||
                b.description?.toLowerCase().includes(q)
        );
    }, [blocks, search]);

    return (
        <div className="min-h-full bg-[#f6fbf8] p-6 md:p-8">
            <div className="max-w-[1200px] mx-auto">

                {/* Back Button */}
                <button
                    type="button"
                    onClick={() => navigate('/admin/spaces')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#d1fae5] bg-white text-[13.5px] font-semibold text-[#15803d] hover:bg-[#f0fdf4] transition mb-6"
                >
                    <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back to Venues
                </button>

                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8">
                    <div>
                        <p className="caps-label mb-1.5">
                            Rajagiri College · System Admin
                        </p>

                        <h1 className="text-[26px] font-bold text-[#0f172a] tracking-tight leading-none">
                            Campus Blocks
                        </h1>

                        <p className="text-[15px] text-[#374151] mt-2">
                            Manage campus blocks and building locations. Click a row to see its venues and classrooms.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                        {/* Search */}
                        <div className="relative w-full sm:w-[340px]">
                            <svg
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z"
                                />
                            </svg>

                            <input
                                type="text"
                                placeholder="Search by block name, code, or description"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-10 py-2.5 border border-[#d1fae5] rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] text-gray-700 placeholder:text-gray-400 shadow-sm transition"
                            />

                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2.5}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Add Button */}
                        <button
                            type="button"
                            onClick={() => {
                                setFormData({
                                    name: '',
                                    code: '',
                                    description: ''
                                });
                                setEditingId(null);
                                setIsModalOpen(true);
                            }}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-[13.5px] font-semibold transition shadow-sm whitespace-nowrap"
                        >
                            Add Block
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-[#e8f5ee] overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#f6fbf8] border-b border-[#e8f5ee]">
                                <th className="caps-label px-6 py-4">Block Name</th>
                                <th className="caps-label px-6 py-4">Code</th>
                                <th className="caps-label px-6 py-4">Description</th>
                                <th className="caps-label px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-[#e8f5ee]">
                            {isLoading ? (
                                <tr>
                                    <td
                                        colSpan="4"
                                        className="text-center py-10 text-[#94a3b8] text-[13.5px]"
                                    >
                                        Loading blocks...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan="4"
                                        className="text-center py-10 text-[#94a3b8] text-[13.5px]"
                                    >
                                        {search
                                            ? 'No blocks match your search.'
                                            : 'No blocks available yet.'}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((block) => (
                                    <tr
                                        key={block.id}
                                        onClick={() => setSelectedBlock(block)}
                                        title="Click to see venues and classrooms in this block"
                                        className="hover:bg-[#f0fdf4]/70 transition cursor-pointer"
                                    >
                                        <td className="px-6 py-4 text-[14px] font-semibold text-[#0f172a]">
                                            {block.name}
                                        </td>

                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-1 bg-[#f0fdf4] rounded-lg text-[11px] font-bold text-[#14532d] tracking-wide border border-[#d1fae5]">
                                                {block.code}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4 text-[13.5px] text-[#6b7280]">
                                            {block.description || '—'}
                                        </td>

                                        <td className="px-6 py-4 text-right">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEdit(block);
                                                }}
                                                className="text-[13px] font-semibold text-[#15803d] hover:text-[#166534] transition"
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {search && (
                    <p className="text-xs text-gray-400 mt-3">
                        {filtered.length} result
                        {filtered.length !== 1 ? 's' : ''} found
                    </p>
                )}
            </div>

            {/* Edit / Create Block Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            {editingId ? 'Edit Block' : 'Create New Block'}
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block caps-label mb-1.5">
                                    Block Name <span className="text-red-500">*</span>
                                </label>

                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            name: e.target.value
                                        })
                                    }
                                    placeholder="e.g. Main Block"
                                    autoFocus
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] transition"
                                />
                            </div>

                            <div>
                                <label className="block caps-label mb-1.5">
                                    Block Code <span className="text-red-500">*</span>
                                </label>

                                <input
                                    required
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            code: e.target.value.toUpperCase()
                                        })
                                    }
                                    placeholder="e.g. MB"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white uppercase focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] transition"
                                />

                                <p className="text-xs text-gray-400 mt-1">
                                    Short code used in room numbers (example: MB-101)
                                </p>
                            </div>

                            <div>
                                <label className="block caps-label mb-1.5">
                                    Description
                                </label>

                                <textarea
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            description: e.target.value
                                        })
                                    }
                                    placeholder="Optional details about this block"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white h-24 resize-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] transition"
                                />
                            </div>

                            <div className="flex gap-3 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2.5 text-[13px] font-semibold text-[#4a6b58] border border-[#d1fae5] bg-white hover:bg-[#f0fdf4] rounded-xl transition"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="px-4 py-2.5 text-[13px] font-semibold text-white bg-[#15803d] hover:bg-[#166534] rounded-xl transition"
                                >
                                    {editingId ? 'Save Changes' : 'Create Block'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Block Detail Modal */}
            {selectedBlock && (
                <BlockDetailModal
                    block={selectedBlock}
                    onClose={() => setSelectedBlock(null)}
                />
            )}
        </div>
    );
};

export default BlocksManagement;