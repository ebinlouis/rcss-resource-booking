import { useState, useEffect } from 'react';
import api from '../../api/axios';

const MEDIA_BASE = 'http://localhost:8000';

const SPACE_TYPES = [
    { value: 'GENERAL_HALL', label: 'General Hall' },
    { value: 'LAB',          label: 'Lab'           },
    { value: 'GUEST_ROOM',   label: 'Guest Room'    },
];

const EMPTY_FORM = {
    name: '', space_type: 'GENERAL_HALL',
    capacity_hard: '', location: '', is_active: true,
};

const FieldLabel = ({ children }) => (
    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
        {children}
    </label>
);

const inputCls =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 ' +
    'focus:outline-none focus:ring-2 focus:ring-green-500 bg-white transition';

// Resolves a Django image path to a full URL
const mediaUrl = (path) =>
    !path ? null : path.startsWith('http') ? path : `${MEDIA_BASE}/media/${path}`;

const AdminSpacesPage = () => {
    const [spaces, setSpaces]                   = useState([]);
    const [masterEquipment, setMasterEquipment] = useState([]);
    const [isLoading, setIsLoading]             = useState(true);
    const [refreshCount, setRefreshCount]       = useState(0);

    const [isModalOpen, setIsModalOpen]     = useState(false);
    const [editingSpace, setEditingSpace]   = useState(null);
    const [isSubmitting, setIsSubmitting]   = useState(false);
    const [formData, setFormData]           = useState(EMPTY_FORM);
    const [imageFile, setImageFile]         = useState(null);
    const [equipmentRows, setEquipmentRows] = useState([]);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const [catalogRes, inventoryRes] = await Promise.all([
                    api.get('/spaces/catalog/'),
                    api.get('/spaces/inventory/'),
                ]);
                if (!isMounted) return;
                setSpaces(catalogRes.data.results ?? catalogRes.data ?? []);
                setMasterEquipment(inventoryRes.data.results ?? inventoryRes.data ?? []);
            } catch (err) {
                if (!isMounted) return;
                console.error('Failed to fetch data:', err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [refreshCount]);

    // ── Modal helpers ──────────────────────────────────────────────────────────
    const handleOpenModal = (space = null) => {
        setImageFile(null);
        if (space) {
            setEditingSpace(space);
            setFormData({
                name:          space.name,
                space_type:    space.space_type,
                capacity_hard: space.capacity_hard,
                location:      space.location,
                is_active:     space.is_active,
            });
            setEquipmentRows(
                Array.isArray(space.built_in_equipment)
                    ? space.built_in_equipment.map((i) => ({
                          equipment_id: i.equipment,
                          quantity:     i.quantity,
                      }))
                    : []
            );
        } else {
            setEditingSpace(null);
            setFormData(EMPTY_FORM);
            setEquipmentRows([]);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSpace(null);
        setImageFile(null);
        setEquipmentRows([]);
    };

    const addEquipmentRow    = () => setEquipmentRows((p) => [...p, { equipment_id: '', quantity: 1 }]);
    const removeEquipmentRow = (i) => setEquipmentRows((p) => p.filter((_, idx) => idx !== i));
    const updateEquipmentRow = (i, field, val) =>
        setEquipmentRows((p) => p.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const data = new FormData();
            data.append('name',          formData.name);
            data.append('space_type',    formData.space_type);
            data.append('capacity_hard', parseInt(formData.capacity_hard, 10));
            data.append('location',      formData.location);
            data.append('is_active',     formData.is_active);
            if (imageFile) data.append('image_1', imageFile);
            const validRows = equipmentRows.filter((r) => r.equipment_id);
            if (validRows.length > 0) {
                data.append('equipment_data', JSON.stringify(
                    validRows.map((r) => ({ equipment: r.equipment_id, quantity: r.quantity }))
                ));
            }

            const cfg = { headers: { 'Content-Type': 'multipart/form-data' } };
            if (editingSpace) {
                await api.put(`/spaces/catalog/${editingSpace.id}/`, data, cfg);
            } else {
                await api.post('/spaces/catalog/', data, cfg);
            }

            setRefreshCount((c) => c + 1);
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save space:', err);
            alert(err.response?.data?.detail || 'An error occurred while saving.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeactivate = async (id) => {
        if (!window.confirm('Deactivate this space? It will no longer be bookable.')) return;
        try {
            await api.patch(`/spaces/catalog/${id}/`, { is_active: false });
            setRefreshCount((c) => c + 1);
        } catch {
            alert('Failed to deactivate space.');
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-screen-xl mx-auto px-6 py-8 font-geist text-gray-900">

            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Manage Spaces</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Add, edit, and manage physical resources across the campus.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-green-800 transition shadow-sm"
                >
                    + Add New Space
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px] font-bold whitespace-nowrap">
                            <tr>
                                <th className="px-6 py-4 w-16">Image</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Location</th>
                                <th className="px-6 py-4">Capacity</th>
                                <th className="px-6 py-4">Equipment</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-400 italic animate-pulse">
                                        Loading spaces…
                                    </td>
                                </tr>
                            ) : spaces.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                        No active spaces found. Click "Add New Space" to create one.
                                    </td>
                                </tr>
                            ) : (
                                spaces.map((space) => (
                                    <tr key={space.id} className="hover:bg-gray-50/50 transition align-top">

                                        {/* Thumbnail */}
                                        <td className="px-6 py-4">
                                            {mediaUrl(space.image_1) ? (
                                                <img
                                                    src={mediaUrl(space.image_1)}
                                                    alt={space.name}
                                                    className="w-10 h-10 rounded-lg object-cover border border-gray-100 shrink-0"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap">{space.name}</td>

                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">
                                                {space.space_type.replace(/_/g, ' ')}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{space.location}</td>
                                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{space.capacity_hard} pax</td>

                                        {/* Equipment badges */}
                                        <td className="px-6 py-4 max-w-xs">
                                            {Array.isArray(space.built_in_equipment) && space.built_in_equipment.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {space.built_in_equipment.map((eq) => (
                                                        <span key={eq.id}
                                                            className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap">
                                                            {eq.equipment_name}
                                                            <span className="text-green-400">×{eq.quantity}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 italic text-xs">None</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            <button onClick={() => handleOpenModal(space)}
                                                className="text-blue-600 hover:text-blue-800 font-medium text-xs mr-4 transition">
                                                Edit
                                            </button>
                                            <button onClick={() => handleDeactivate(space.id)}
                                                className="text-red-500 hover:text-red-700 font-medium text-xs transition">
                                                Deactivate
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                            {editingSpace ? 'Edit Space' : 'Create New Space'}
                        </h3>
                        <p className="text-xs text-gray-500 mb-5">
                            Define the parameters for this bookable campus resource.
                        </p>

                        {/* Current image preview */}
                        {editingSpace && mediaUrl(editingSpace.image_1) && !imageFile && (
                            <div className="mb-4">
                                <FieldLabel>Current Image</FieldLabel>
                                <img
                                    src={mediaUrl(editingSpace.image_1)}
                                    alt={editingSpace.name}
                                    className="w-full h-36 object-cover rounded-lg border border-gray-100"
                                />
                            </div>
                        )}

                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">

                                <div className="col-span-2">
                                    <FieldLabel>Space Name *</FieldLabel>
                                    <input required type="text" placeholder="e.g. Golden Aureole"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className={inputCls} />
                                </div>

                                <div>
                                    <FieldLabel>Type *</FieldLabel>
                                    <select value={formData.space_type}
                                        onChange={(e) => setFormData({ ...formData, space_type: e.target.value })}
                                        className={inputCls}>
                                        {SPACE_TYPES.map((t) => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <FieldLabel>Capacity *</FieldLabel>
                                    <input required type="number" min="1" placeholder="e.g. 150"
                                        value={formData.capacity_hard}
                                        onChange={(e) => setFormData({ ...formData, capacity_hard: e.target.value })}
                                        className={inputCls} />
                                </div>

                                <div className="col-span-2">
                                    <FieldLabel>Location *</FieldLabel>
                                    <input required type="text" placeholder="e.g. Main Block, 2nd Floor"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        className={inputCls} />
                                </div>

                                <div className="col-span-2">
                                    <FieldLabel>
                                        Space Image {editingSpace ? '(leave blank to keep current)' : '(Optional)'}
                                    </FieldLabel>
                                    <input type="file" accept="image/*"
                                        onChange={(e) => setImageFile(e.target.files[0])}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 transition-colors" />
                                </div>

                                {/* Built-in equipment */}
                                <div className="col-span-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <FieldLabel>Built-in Equipment</FieldLabel>
                                        <button type="button" onClick={addEquipmentRow}
                                            className="text-xs font-semibold text-green-700 hover:text-green-900 transition">
                                            + Add Item
                                        </button>
                                    </div>
                                    {equipmentRows.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic">No built-in equipment added.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {equipmentRows.map((row, idx) => (
                                                <div key={idx} className="flex gap-2 items-center">
                                                    <select value={row.equipment_id}
                                                        onChange={(e) => updateEquipmentRow(idx, 'equipment_id', e.target.value)}
                                                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                                                        <option value="">Select equipment…</option>
                                                        {masterEquipment.map((eq) => (
                                                            <option key={eq.id} value={eq.id}>{eq.name}</option>
                                                        ))}
                                                    </select>
                                                    <input type="number" min="1" value={row.quantity}
                                                        onChange={(e) => updateEquipmentRow(idx, 'quantity', parseInt(e.target.value, 10))}
                                                        className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                                        placeholder="Qty" />
                                                    <button type="button" onClick={() => removeEquipmentRow(idx)}
                                                        className="text-red-400 hover:text-red-600 text-xs font-bold transition px-1">
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 mt-2">
                                <button type="button" onClick={handleCloseModal}
                                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting}
                                    className="px-6 py-2 text-sm font-bold text-white bg-green-700 hover:bg-green-800 rounded-lg transition shadow-sm disabled:opacity-50">
                                    {isSubmitting ? 'Saving…' : 'Save Space'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSpacesPage;