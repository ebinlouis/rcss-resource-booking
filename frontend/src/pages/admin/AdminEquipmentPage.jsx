import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useCreateEquipment, useUpdateEquipment, useSoftDeleteEquipment } from '../../hooks/useEquipmentQueries';

// Must match EquipmentCategory choices in models.py exactly
const EQUIPMENT_CATEGORIES = [
    { value: 'AV',         label: 'Audio & Visual' },
    { value: 'LIGHTING',   label: 'Lighting'        },
    { value: 'FURNITURE',  label: 'Furniture'       },
    { value: 'COMPUTING',  label: 'Computing'       },
    { value: 'NETWORKING', label: 'Networking'      },
    { value: 'OTHER',      label: 'Other'           },
];

const CATEGORY_COLORS = {
    AV:         'bg-blue-50   text-blue-700',
    LIGHTING:   'bg-yellow-50 text-yellow-700',
    FURNITURE:  'bg-orange-50 text-orange-700',
    COMPUTING:  'bg-violet-50 text-violet-700',
    NETWORKING: 'bg-cyan-50   text-cyan-700',
    OTHER:      'bg-gray-100  text-gray-600',
};

const EMPTY_FORM = {
    name:                  '',
    category:              'AV',
    description:           '',
    total_owned:           1,
    is_portable:           true,
    is_active:             true,
    is_standard_media_kit: false, // NEW: Dynamic auto-assign flag
};

const ENDPOINT = '/spaces/inventory/';

const FieldLabel = ({ children }) => (
    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
        {children}
    </label>
);

const inputCls =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 ' +
    'focus:outline-none focus:ring-2 focus:ring-green-500 bg-white transition';

const Toggle = ({ checked, onChange, label, sublabel }) => (
    <label className="flex items-center gap-3 cursor-pointer select-none">
        <button
            type="button"
            onClick={onChange}
            className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
                checked ? 'bg-green-600' : 'bg-gray-200'
            }`}
        >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                checked ? 'translate-x-5' : 'translate-x-0'
            }`} />
        </button>
        <div>
            <p className="text-xs font-semibold text-gray-700">{label}</p>
            <p className="text-[10px] text-gray-400">{sublabel}</p>
        </div>
    </label>
);

const AdminEquipmentPage = () => {
    const [equipment, setEquipment]           = useState([]);
    const [isLoading, setIsLoading]           = useState(true);
    const [search, setSearch]                 = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [confirmDeactivateId, setConfirmDeactivateId] = useState(null);

    const [isModalOpen, setIsModalOpen]   = useState(false);
    const [editingItem, setEditingItem]   = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData]         = useState(EMPTY_FORM);
    const [formError, setFormError]       = useState('');

    const createEquipment = useCreateEquipment();
    const updateEquipment = useUpdateEquipment();
    const softDeleteEquipment = useSoftDeleteEquipment();

    // ── Fetch ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        let isMounted = true;

        const fetchEquipment = async () => {
            try {
                const res  = await api.get(ENDPOINT);
                if (!isMounted) return;
                const data = res.data.results ?? res.data;
                setEquipment(data ?? []);
            } catch (err) {
    if (!isMounted) return;
    console.error('Failed to fetch equipment:', err);
    toast.error('Failed to load equipment.');
} finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchEquipment();
        return () => { isMounted = false; };
    }, []);

    // ── Modal ─────────────────────────────────────────────────────────────────
    const handleOpenModal = (item = null) => {
        setFormError('');
        if (item) {
            setEditingItem(item);
            setFormData({
                name:                  item.name,
                category:              item.category,
                description:           item.description ?? '',
                total_owned:           item.total_owned ?? 1,
                is_portable:           item.is_portable,
                is_active:             item.is_active,
                is_standard_media_kit: item.is_standard_media_kit ?? false,
            });
        } else {
            setEditingItem(null);
            setFormData(EMPTY_FORM);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        setFormError('');
    };

    const patchForm = (patch) => setFormData((prev) => ({ ...prev, ...patch }));

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async (e) => {
        e.preventDefault();
        setFormError('');
        setIsSubmitting(true);
        try {
            const payload = {
                name:                  formData.name.trim(),
                category:              formData.category,
                description:           formData.description.trim(),
                total_owned:           parseInt(formData.total_owned, 10),
                is_portable:           formData.is_portable,
                is_active:             formData.is_active,
                is_standard_media_kit: formData.is_standard_media_kit,
            };

if (editingItem) {
    await updateEquipment.mutateAsync({ id: editingItem.id, payload });
    toast.success('Equipment updated successfully.');
} else {
    await createEquipment.mutateAsync(payload);
    toast.success('Equipment added successfully.');
}

handleCloseModal();
        } catch (err) {
            console.error('Failed to save equipment:', err);
            toast.error(
                err.response?.data?.detail ||
                Object.values(err.response?.data ?? {})[0]?.[0] ||
                'An error occurred. Please try again.'
            );
            setFormError('Failed to save equipment.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Deactivate ────────────────────────────────────────────────────────────
    const handleDeactivate = async (id) => {
        try {
await softDeleteEquipment.mutateAsync(id);
toast.success('Equipment deactivated successfully.');
        } catch (err) {
    console.error('Failed to fetch equipment:', err);
    toast.error('Failed to load equipment.');
}
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const filtered = equipment.filter((item) => {
        const q = search.toLowerCase();
        const matchesSearch =
            item.name.toLowerCase().includes(q) ||
            (item.description ?? '').toLowerCase().includes(q);
        const matchesCategory =
            filterCategory === 'ALL' || item.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const totalActive     = equipment.filter((i) => i.is_active).length;
    const totalPortable   = equipment.filter((i) => i.is_portable).length;
    const totalCategories = new Set(equipment.map((i) => i.category)).size;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-screen-xl mx-auto px-6 py-8 font-geist text-gray-900">

            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Equipment Management</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Track and manage available equipment and inventory.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-green-800 transition shadow-sm shrink-0"
                >
                    + Add Equipment
                </button>
            </div>

            {/* Stat pills */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                    { label: 'Active Items',  value: totalActive     },
                    { label: 'Portable Items', value: totalPortable   },
                    { label: 'Equipment Types',    value: totalCategories },
                ].map(({ label, value }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                        <p className="text-xl font-bold text-gray-900">
                            {isLoading ? <span className="animate-pulse text-gray-300">—</span> : value}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 font-medium">{label}</p>
                    </div>
                ))}
            </div>

{/* Search + Filter */}
<div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
    <div className="relative w-full sm:max-w-md">
        <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
        </svg>

        <input
            type="text"
            placeholder="Search equipment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
    </div>

    <select
        value={filterCategory}
        onChange={(e) => setFilterCategory(e.target.value)}
        className="w-full sm:w-52 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white shrink-0"
    >
        <option value="ALL">All Categories</option>
        {EQUIPMENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
                {c.label}
            </option>
        ))}
    </select>
</div>

            {/* Table */}
<div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                    <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Quantity</th>
                                <th className="px-6 py-4">Can Be Moved</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-400 italic animate-pulse">
                                        Loading equipment…
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                        {search || filterCategory !== 'ALL'
                                            ? 'No equipment matches your filters.'
                                            : 'No equipment found. Click "+ Add Equipment" to get started.'}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((item) => (
                                    <tr key={item.id} className={`hover:bg-gray-50/50 transition ${!item.is_active ? 'opacity-50' : ''}`}>
                                        <td className="px-6 py-4 font-semibold text-gray-900">{item.name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.OTHER}`}>
                                                {EQUIPMENT_CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category}
                                            </span>
                                            {/* Subtle badge if it's part of the standard media kit */}
                                            {item.is_standard_media_kit && (
                                                <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-800 text-white uppercase">
                                                    Media Kit
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                                            {item.description || <span className="italic text-gray-300">—</span>}
                                        </td>
                                        <td className="px-6 py-4 text-gray-700 font-medium">
                                            {item.total_owned}
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.is_portable ? (
                                                <span className="inline-flex items-center gap-1 text-green-700 text-xs font-semibold">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                                                    Yes
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-gray-400 text-xs font-semibold">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
                                                    Fixed Location
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.is_active
                                                ? <span className="text-green-700 bg-green-50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">Active</span>
                                                : <span className="text-gray-400 bg-gray-100 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">Inactive</span>
                                            }
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleOpenModal(item)}
                                                className="text-blue-600 hover:text-blue-800 font-medium text-xs mr-4 transition"
                                            >
                                                Edit
                                            </button>
                                            {item.is_active && (
                                                <button
                                                    onClick={() => setConfirmDeactivateId(item.id)}
                                                    className="text-red-500 hover:text-red-700 font-medium text-xs transition"
                                                >
                                                    Deactivate
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!isLoading && filtered.length > 0 && (
                    <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50">
                        <p className="text-[11px] text-gray-400">
                            Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of{' '}
                            <span className="font-semibold text-gray-600">{equipment.length}</span> items
                        </p>
                    </div>
                )}
            </div>

                {confirmDeactivateId && (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900">
                Deactivate Equipment?
            </h3>

            <p className="text-sm text-gray-500 mt-2">
This equipment will no longer be available for future bookings.            </p>

            <div className="flex justify-end gap-3 mt-6">
                <button
                    onClick={() => setConfirmDeactivateId(null)}
                    className="px-4 py-2 bg-gray-100 rounded-lg"
                >
                    Cancel
                </button>

                <button
                    onClick={async () => {
                        await handleDeactivate(confirmDeactivateId);
                        setConfirmDeactivateId(null);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg"
                >
                    Deactivate
                </button>
            </div>
        </div>
    </div>
)}

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                            {editingItem ? 'Edit Equipment' : 'Add Equipment'}
                        </h3>
                        <p className="text-xs text-gray-500 mb-6">
                            {editingItem
                                ? 'Update the details for this equipment item.'
                                : 'Add a new equipment item for booking and management.'}
                        </p>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <FieldLabel>Equipment Name *</FieldLabel>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g., Sony A7S III Camera"
                                    value={formData.name}
                                    onChange={(e) => patchForm({ name: e.target.value })}
                                    className={inputCls}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <FieldLabel>Category *</FieldLabel>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => patchForm({ category: e.target.value })}
                                        className={inputCls}
                                    >
                                        {EQUIPMENT_CATEGORIES.map((c) => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <FieldLabel>Total Quantity *</FieldLabel>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        value={formData.total_owned}
                                        onChange={(e) => patchForm({ total_owned: e.target.value })}
                                        className={inputCls}
                                    />
                                </div>
                            </div>

                            <div>
                                <FieldLabel>Description</FieldLabel>
                                <textarea
                                    rows={3}
                                    placeholder="Model details, specifications, or additional notes..."
                                    value={formData.description}
                                    onChange={(e) => patchForm({ description: e.target.value })}
                                    className={`${inputCls} resize-none`}
                                />
                            </div>

                            <div className="flex flex-wrap gap-x-6 gap-y-4 pt-2">
                                <Toggle
                                    checked={formData.is_portable}
                                    onChange={() => patchForm({ is_portable: !formData.is_portable })}
                                    label="Portable"
                                    sublabel="Can be moved between venues"
                                />
                                <Toggle
                                    checked={formData.is_active}
                                    onChange={() => patchForm({ is_active: !formData.is_active })}
                                    label="Available"
                                    sublabel="Can be assigned for bookings"
                                />
                                <div className="w-full">
                                    <Toggle
                                        checked={formData.is_standard_media_kit}
                                        onChange={() => patchForm({ is_standard_media_kit: !formData.is_standard_media_kit })}
                                        label="Include in Media Team Kit"
                                        sublabel="Automatically includes 1 item in media team bookings"
                                    />
                                </div>
                            </div>

                            {formError && (
                                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-2">
                                    {formError}
                                </p>
                            )}

                            <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 mt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2 text-sm font-bold text-white bg-green-700 hover:bg-green-800 rounded-lg transition shadow-sm disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Saving…' : editingItem ? 'Update Equipment' : 'Add Equipment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminEquipmentPage;
