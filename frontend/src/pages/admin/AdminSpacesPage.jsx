import { useState, useEffect } from 'react';
import api from '../../api/axios';

const AdminSpacesPage = () => {
    const [spaces, setSpaces] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshCount, setRefreshCount] = useState(0);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSpace, setEditingSpace] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        space_type: 'GENERAL_HALL',
        capacity_hard: '',
        location: '',
        is_active: true
    });
    // File upload state
    const [imageFile, setImageFile] = useState(null);

    const SPACE_TYPES = [
        { value: 'GENERAL_HALL', label: 'General Hall' },
        { value: 'LAB', label: 'Lab' },
        { value: 'GUEST_ROOM', label: 'Guest Room' }
    ];

    useEffect(() => {
        let isMounted = true;

        const fetchSpaces = async () => {
            try {
                const response = await api.get('/spaces/catalog/');
                if (isMounted) {
                    const data = response.data.results ? response.data.results : response.data;
                    setSpaces(data || []);
                }
            } catch (err) {
                console.error("Failed to fetch spaces:", err);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchSpaces();

        return () => {
            isMounted = false;
        };
    }, [refreshCount]);

    const handleOpenModal = (space = null) => {
        setImageFile(null); // Always reset the file input when opening the modal
        
        if (space) {
            setEditingSpace(space);
            setFormData({
                name: space.name,
                space_type: space.space_type,
                capacity_hard: space.capacity_hard,
                location: space.location,
                is_active: space.is_active
            });
        } else {
            setEditingSpace(null);
            setFormData({ name: '', space_type: 'GENERAL_HALL', capacity_hard: '', location: '', is_active: true });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSpace(null);
        setImageFile(null);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // Because we have an image, we MUST use FormData instead of a standard JSON object
            const submitData = new FormData();
            submitData.append('name', formData.name);
            submitData.append('space_type', formData.space_type);
            submitData.append('capacity_hard', parseInt(formData.capacity_hard, 10));
            submitData.append('location', formData.location);
            submitData.append('is_active', formData.is_active);

            // Only append the image if the admin actually selected a new file
            if (imageFile) {
                submitData.append('image_1', imageFile);
            }

            if (editingSpace) {
                // Update existing space
                await api.put(`/spaces/catalog/${editingSpace.id}/`, submitData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                // Create new space
                await api.post('/spaces/catalog/', submitData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            setRefreshCount(c => c + 1);
            handleCloseModal();
        } catch (err) {
            console.error("Failed to save space:", err);
            alert(err.response?.data?.detail || "An error occurred while saving.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Soft Delete (Deactivate)
    const handleDeactivate = async (id) => {
        if (!window.confirm("Are you sure you want to deactivate this space? It will no longer be bookable.")) return;
        
        try {
            // PATCH requests for just flipping a boolean can still be standard JSON
            await api.patch(`/spaces/catalog/${id}/`, { is_active: false });
            setRefreshCount(c => c + 1);
        } catch (err) {
            console.error("Failed to deactivate space:", err);
            alert("Failed to deactivate space.");
        }
    };

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
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Location</th>
                                <th className="px-6 py-4">Capacity</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 italic animate-pulse">
                                        Loading spaces...
                                    </td>
                                </tr>
                            ) : spaces.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        No active spaces found. Click "Add New Space" to create one.
                                    </td>
                                </tr>
                            ) : (
                                spaces.map((space) => (
                                    <tr key={space.id} className="hover:bg-gray-50/50 transition">
                                        <td className="px-6 py-4 font-semibold text-gray-900">{space.name}</td>
                                        <td className="px-6 py-4">
                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">
                                                {space.space_type.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{space.location}</td>
                                        <td className="px-6 py-4 text-gray-600">{space.capacity_hard} pax</td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleOpenModal(space)}
                                                className="text-blue-600 hover:text-blue-800 font-medium text-xs mr-4 transition"
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => handleDeactivate(space.id)}
                                                className="text-red-500 hover:text-red-700 font-medium text-xs transition"
                                            >
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

            {/* CREATE / EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                            {editingSpace ? 'Edit Space' : 'Create New Space'}
                        </h3>
                        <p className="text-xs text-gray-500 mb-6">
                            Define the parameters for this bookable campus resource.
                        </p>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Space Name *</label>
                                    <input 
                                        required
                                        type="text"
                                        placeholder="e.g. Golden Aureole"
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Type *</label>
                                    <select 
                                        value={formData.space_type}
                                        onChange={e => setFormData({...formData, space_type: e.target.value})}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                    >
                                        {SPACE_TYPES.map(type => (
                                            <option key={type.value} value={type.value}>{type.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Capacity *</label>
                                    <input 
                                        required
                                        type="number"
                                        min="1"
                                        placeholder="e.g. 150"
                                        value={formData.capacity_hard}
                                        onChange={e => setFormData({...formData, capacity_hard: e.target.value})}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Location *</label>
                                    <input 
                                        required
                                        type="text"
                                        placeholder="e.g. Main Block, 2nd Floor"
                                        value={formData.location}
                                        onChange={e => setFormData({...formData, location: e.target.value})}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                                
                                {/* <-- NEW: IMAGE UPLOAD FIELD --> */}
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Space Image (Optional)</label>
                                    <input 
                                        type="file"
                                        accept="image/*"
                                        onChange={e => setImageFile(e.target.files[0])}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 transition-colors"
                                    />
                                    {editingSpace && editingSpace.image_1 && !imageFile && (
                                        <p className="text-[10px] text-gray-400 mt-1">Leave blank to keep the current image.</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8 justify-end pt-4 border-t border-gray-100">
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
                                    {isSubmitting ? 'Saving...' : 'Save Space'}
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