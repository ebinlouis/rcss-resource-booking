import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import toast from "react-hot-toast"
import api from "../../api/axios"
import {
  useCreateTimetableBatch,
  useDeleteTimetableBatch,
  useUpdateTimetableBatch,
  useEditTimetableBlock,
  useClearTimetableDate,
  useDeleteTimetableBlock
} from "../../hooks/useSpaceQueries"

const getImportCounts = (data) => ({
  imported: data?.row_count ?? 0,
  failed: data?.skipped_count ?? data?.conflicts?.length ?? 0,
})

export default function TimetableManagerModal({ space, onClose }) {
  const [batches, setBatches] = useState([])
  const [blocks, setBlocks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadLabel, setUploadLabel] = useState("")
  const [error, setError] = useState(null)
  
  const [editBatchId, setEditBatchId] = useState(null)
  const [editBatchLabel, setEditBatchLabel] = useState("")
  const [editBatchFile, setEditBatchFile] = useState(null)
  const [isEditingBatch, setIsEditingBatch] = useState(false)
  
  const [deleteDate, setDeleteDate] = useState("")
  const [selectedBatchId, setSelectedBatchId] = useState(null)
  const [editingBlockId, setEditingBlockId] = useState(null)
  const [editBlockForm, setEditBlockForm] = useState({ date: "", start_time: "", end_time: "", label: "", instructor: "" })
  
  const [cancelAction, setCancelAction] = useState(null)

  const createBatch = useCreateTimetableBatch(space.id)
  const deleteBatch = useDeleteTimetableBatch(space.id)
  const updateBatch = useUpdateTimetableBatch(space.id)
  const editBlock = useEditTimetableBlock(space.id)
  const clearDate = useClearTimetableDate(space.id)
  const deleteBlock = useDeleteTimetableBlock(space.id)

  const fetchBatches = useCallback(async (preserveError = false) => {
    try {
      const res = await api.get(`/spaces/catalog/${space.id}/timetable/`)
      setBatches(res.data.batches ?? [])
      setBlocks(res.data.blocks ?? [])
      if (!preserveError) setError(null)
    } catch (err) {
      if (err.response?.status === 403) {
        setError("You don't have permission to manage timetables for this venue.")
      } else {
        setError("Failed to load timetables.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [space.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBatches()
  }, [fetchBatches])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)
      if (!uploadLabel) setUploadLabel(file.name.replace(".csv", ""))
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) return
    setIsUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", uploadFile)
      fd.append("label", uploadLabel)
      
      const res = await createBatch.mutateAsync(fd)
      
      let hasError = false;
      if (res.conflicts && res.conflicts.length > 0) {
        const { imported, failed } = getImportCounts(res)
        toast.error(`${imported} blocks imported, ${failed} failed.`)
        setError(
          res.message + 
          "\nFailed Blocks:\n" + 
          res.conflicts.join("\n")
        )
        hasError = true;
      } else {
        const { imported } = getImportCounts(res)
        toast.success(`${imported} blocks imported.`)
        setError(null)
      }
      
      setUploadFile(null)
      setUploadLabel("")
      fetchBatches(hasError)
    } catch (err) {
      if (err.response?.data?.conflicts) {
        const { imported, failed } = getImportCounts(err.response.data)
        toast.error(`${imported} blocks imported, ${failed} failed.`)
        setError(
          err.response.data.message + 
          "\nFailed Blocks:\n" + 
          err.response.data.conflicts.join("\n")
        )
      } else {
        toast.error(err.response?.data?.error || "Upload failed. Check your connection and try again.")
        setError(err.response?.data?.error || "Failed to upload timetable.")
      }
      // If it completely fails, we might still want to fetch batches if we deleted the batch, etc.
      fetchBatches(true)
    } finally {
      setIsUploading(false)
    }
  }

const handleDeleteBatch = async (batchId) => {
  setCancelAction(() => async () => {
    try {
      await deleteBatch.mutateAsync(batchId)
      fetchBatches()
    } catch {
      setError("Failed to delete timetable.")
    }
  })
}

  const handleEditBatch = async (batchId) => {
    setIsEditingBatch(true)
    try {
      const fd = new FormData()
      fd.append("upload_label", editBatchLabel)
      if (editBatchFile) {
        fd.append("file", editBatchFile)
      }
      
      await updateBatch.mutateAsync({ batchId, fd })
      setEditBatchId(null)
      setEditBatchFile(null)
      fetchBatches()
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update timetable.")
    } finally {
      setIsEditingBatch(false)
    }
  }

  const handleSaveBlock = async (blockId) => {
    try {
      await editBlock.mutateAsync({ blockId, data: editBlockForm })
      setEditingBlockId(null)
      fetchBatches()
      setError(null)
    } catch (err) {
      if (err.response?.status === 409) {
        setError(err.response.data.message)
      } else {
        setError(err.response?.data?.error || "Failed to update block.")
      }
    }
  }

const handleDeleteByDate = async () => {
  if (!deleteDate) return

  setCancelAction(() => async () => {
    try {
      await clearDate.mutateAsync(deleteDate)
      setDeleteDate("")
      fetchBatches()
    } catch {
      setError("Failed to delete blocks.")
    }
  })
}

const handleDeleteBlock = async (blockId) => {
  setCancelAction(() => async () => {
    try {
      await deleteBlock.mutateAsync(blockId)
      fetchBatches()
    } catch {
      setError("Failed to delete block.")
    }
  })
}

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-green-50">
          <div>
            <h2 className="text-xl font-bold text-green-900">Manage Timetable</h2>
            <p className="text-sm text-green-700 mt-1">{space.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-100 text-green-400 transition">
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-8 p-5 bg-gray-50 border border-gray-200 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Upload New Timetable (CSV)</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-600 block mb-1">Label (e.g. Fall 2026)</label>
                <input 
                  type="text" 
                  value={uploadLabel}
                  onChange={(e) => setUploadLabel(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="Semester timetable..."
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-600 block mb-1">CSV File</label>
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleFileChange}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
              </div>
              <button 
                onClick={handleUpload}
                disabled={!uploadFile || isUploading}
                className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
              >
                {isUploading ? "Uploading..." : "Upload"}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              CSV columns: <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">date, start_time, end_time, label, instructor</code>
              <span className="ml-1 text-gray-300">(instructor is optional)</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Active Timetable Batches</h3>
              {isLoading ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : batches.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No timetables uploaded yet.</p>
              ) : (
                <div className="space-y-3">
                  {batches.map(batch => (
                    <div 
                      key={batch.id} 
                      className={`p-4 border rounded-xl bg-white transition cursor-pointer ${selectedBatchId === batch.id ? 'border-green-400 ring-1 ring-green-400 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
                      onClick={() => setSelectedBatchId(prev => prev === batch.id ? null : batch.id)}
                    >
                      {editBatchId === batch.id ? (
                        <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                          <input 
                            type="text" 
                            value={editBatchLabel}
                            onChange={(e) => setEditBatchLabel(e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-green-500 outline-none"
                            placeholder="Label"
                          />
                          <input 
                            type="file" 
                            accept=".csv"
                            onChange={(e) => setEditBatchFile(e.target.files?.[0] || null)}
                            className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                          />
                          <div className="flex gap-2">
                            <button disabled={isEditingBatch} onClick={() => handleEditBatch(batch.id)} className="text-green-600 text-xs font-semibold px-2 py-1 hover:bg-green-50 rounded disabled:opacity-50">Save</button>
                            <button disabled={isEditingBatch} onClick={() => setCancelAction(() => () => { setEditBatchId(null); setEditBatchFile(null); })} className="text-gray-500 text-xs font-semibold px-2 py-1 hover:bg-gray-50 rounded disabled:opacity-50">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{batch.label}</p>
                            <p className="text-xs text-gray-500 mt-1">Uploaded on {new Date(batch.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => { setEditBatchId(batch.id); setEditBatchLabel(batch.label) }}
                              className="text-green-600 hover:text-green-800 text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-green-50 transition"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteBatch(batch.id)}
                              className="text-red-600 hover:text-red-800 text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-red-50 transition"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Manage Blocks</h3>
              
              <div className="p-4 border border-red-200 rounded-xl bg-red-50 mb-4">
                <h4 className="text-xs font-bold text-red-800 mb-2 uppercase tracking-wide">Clear by Date</h4>
                <div className="flex gap-2">
                  <input 
                    type="date"
                    value={deleteDate}
                    onChange={(e) => setDeleteDate(e.target.value)}
                    className="flex-1 border border-red-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <button 
                    onClick={handleDeleteByDate}
                    disabled={!deleteDate}
                    className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-red-700 transition"
                  >
                    Clear Date
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Recent Blocks</h4>
                  {selectedBatchId && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                      Filtered by batch
                    </span>
                  )}
                </div>
                {blocks.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No blocks available.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                    {(selectedBatchId ? blocks.filter(b => b.batch_id === selectedBatchId) : blocks).slice(0, selectedBatchId ? undefined : 50).map(block => (
                      <div key={block.id} className="p-4 bg-white flex flex-col hover:bg-gray-50 transition">
                        {editingBlockId === block.id ? (
                          <div className="flex flex-col gap-3">
                            <div className="flex gap-3">
                              <input type="date" name="edit_date" value={editBlockForm.date} onChange={e => setEditBlockForm({...editBlockForm, date: e.target.value})} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                              <input type="time" name="edit_start_time" value={editBlockForm.start_time} onChange={e => setEditBlockForm({...editBlockForm, start_time: e.target.value})} className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                              <input type="time" name="edit_end_time" value={editBlockForm.end_time} onChange={e => setEditBlockForm({...editBlockForm, end_time: e.target.value})} className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                            </div>
                            <div className="flex gap-3">
                              <input type="text" name="edit_label" value={editBlockForm.label} onChange={e => setEditBlockForm({...editBlockForm, label: e.target.value})} placeholder="Label (subject)" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                              <input type="text" name="edit_instructor" value={editBlockForm.instructor} onChange={e => setEditBlockForm({...editBlockForm, instructor: e.target.value})} placeholder="Instructor (optional)" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                            </div>
                            <div className="flex gap-3">
                              <button onClick={() => handleSaveBlock(block.id)} className="text-white bg-green-600 text-sm font-semibold px-4 py-2 hover:bg-green-700 rounded-lg transition">Save</button>
                              <button onClick={() => setCancelAction(() => () => setEditingBlockId(null))} className="text-gray-600 bg-gray-100 text-sm font-semibold px-4 py-2 hover:bg-gray-200 rounded-lg transition">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{block.date}</p>
                              <p className="text-xs text-gray-500">{block.start_time.slice(0, 5)} - {block.end_time.slice(0, 5)} · {block.label}</p>
                              {block.instructor && <p className="text-[11px] text-gray-400 mt-0.5">Instructor: {block.instructor}</p>}
                            </div>
                            <div className="flex gap-2 items-center">
                              <button 
                                onClick={() => {
                                  setEditingBlockId(block.id);
                                  setEditBlockForm({
                                    date: block.date,
                                    start_time: block.start_time.slice(0, 5),
                                    end_time: block.end_time.slice(0, 5),
                                    label: block.label,
                                    instructor: block.instructor || ""
                                  });
                                }}
                                className="text-green-500 hover:text-green-700 text-xs font-semibold transition"
                                title="Edit Block"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteBlock(block.id)}
                                className="text-gray-400 hover:text-red-600 transition p-1 rounded"
                                title="Delete Block"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {!selectedBatchId && blocks.length > 50 && (
                      <div className="p-2 text-center text-xs text-gray-500 bg-gray-50">
                        Showing first 50 blocks. Select a batch to view all its blocks.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-red-50">
              <h3 className="font-bold text-red-800">Notice</h3>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition">✕</button>
            </div>
            <div className="p-5 overflow-y-auto whitespace-pre-wrap text-sm text-gray-700">
              {error}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button onClick={() => setError(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold hover:bg-gray-300 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelAction && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 bg-red-50">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="font-bold text-red-800">Confirm Action</h3>
            </div>
            <div className="p-5 text-sm text-gray-700">
              Are you sure you want to continue? This action cannot be undone.
            </div>
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setCancelAction(null)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition">
                Keep Editing
              </button>
              <button 
                onClick={() => {
                  cancelAction();
                  setCancelAction(null);
                }} 
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
