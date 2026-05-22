import { useState, useEffect } from 'react';
import spaceAdminService from '../../api/spaceAdminService';

const BlocksManagement = () => {
    const [blocks, setBlocks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // ADDED 'code' to initial state
    const [formData, setFormData] = useState({ name: '', code: '', description: '' });
    const [editingId, setEditingId] = useState(null);

    // Initial load on mount
    useEffect(() => {
        let isMounted = true;
        
        const fetchInitial = async () => {
            try {
                const data = await spaceAdminService.getBlocks();
                if (isMounted) setBlocks(Array.isArray(data) ? data : data.results || []);
            } catch (error) {
                console.error('Failed to fetch blocks', error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchInitial();
        
        return () => { isMounted = false; };
    }, []);

    // Manual refresh for after creating/updating a block
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
            // RESET 'code' as well
            setFormData({ name: '', code: '', description: '' });
            setEditingId(null);
            refreshBlocks(); 
        } catch (error) {
            console.error('Failed to save block', error);
            const backendError = error.response?.data?.code?.[0] || error.response?.data?.name?.[0] || "Please check your inputs.";
            alert(`Failed to save block: ${backendError}`);
        }
    };

    const openEdit = (block) => {
        // LOAD 'code' when editing
        setFormData({ name: block.name, code: block.code || '', description: block.description || '' });
        setEditingId(block.id);
        setIsModalOpen(true);
    };

    return (
        <div className="p-6 md:p-10 max-w-6xl mx-auto">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Buildings</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage campus buildings and organize rooms by location.</p>
                </div>
                <button 
                    onClick={() => { setFormData({name: '', code: '', description: ''}); setEditingId(null); setIsModalOpen(true); }}
                    className="bg-[#15803d] hover:bg-[#166534] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm"
                >
                    + Add Block
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="caps-label px-6 py-4">Code</th>
                            <th className="caps-label px-6 py-4">Block Name</th>
                            <th className="caps-label px-6 py-4">Description</th>
                            <th className="caps-label px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            <tr><td colSpan="4" className="text-center py-10 text-gray-500 text-sm">Loading blocks...</td></tr>
                        ) : blocks.length === 0 ? (
                            <tr><td colSpan="4" className="text-center py-10 text-gray-500 text-sm">No blocks configured yet.</td></tr>
                        ) : (
                            blocks.map(block => (
                                <tr key={block.id} className="hover:bg-gray-50/50 transition">
                                    {/* Display the Code */}
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-700 tracking-wide">
                                            {block.code}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-gray-900">{block.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{block.description || '-'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => openEdit(block)}
                                            className="text-[#15803d] hover:text-[#166534] text-sm font-medium transition"
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

            {/* Block Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            {editingId ? 'Edit Block' : 'Create New Block'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            
                            {/* Block Code Input */}
                            <div>
                                <label className="block caps-label mb-1.5">Block Code <span className="text-red-500">*</span></label>
                                <input 
                                    required
                                    type="text" 
                                    value={formData.code}
                                    onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] transition uppercase"
                                    placeholder="e.g., MB, SB, LB"
                                />
                            </div>

                            <div>
                                <label className="block caps-label mb-1.5">Block Name <span className="text-red-500">*</span></label>
                                <input 
                                    required
                                    type="text" 
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] transition"
                                    placeholder="e.g., Main Block, Science Wing"
                                />
                            </div>
                            
                            <div>
                                <label className="block caps-label mb-1.5">Description</label>
                                <textarea 
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] transition h-24 resize-none"
                                    placeholder="Optional details..."
                                />
                            </div>
                            <div className="flex gap-3 justify-end pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
                                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-[#15803d] hover:bg-[#166534] rounded-lg transition">Save Block</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BlocksManagement;
