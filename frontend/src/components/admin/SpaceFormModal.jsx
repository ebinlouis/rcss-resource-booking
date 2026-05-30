import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import api from "../../api/axios"
import spaceAdminService from "../../api/spaceAdminService"
import { useCreateSpace, useUpdateSpace } from "../../hooks/useSpaceQueries"
import { combineSpaceLocation, parseSpaceLocation } from "../../utils/spaceLocation"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const SPACE_TYPES = [
  { value: "GENERAL_HALL", label: "General Hall" },
  { value: "LAB", label: "Laboratory" },
  { value: "GUEST_ROOM", label: "Guest Room" },
]

const APPROVAL_CATEGORIES = [
  { value: "GENERAL", label: "General", hint: "Receptionist scoped by block or space" },
  { value: "LAB", label: "Lab", hint: "Lab In-Charge scoped by block or space" },
  { value: "LIBRARY", label: "Library", hint: "Librarian scoped by block or space" },
]

const APPROVAL_WORKFLOWS = [
  { value: "DIRECT", label: "Direct Approver", hint: "The scoped approver can approve immediately" },
  { value: "HOD_FALLBACK", label: "HOD with Fallback", hint: "HOD approves first; scoped lab in-charge is fallback" },
]

// ─────────────────────────────────────────────────────────────
// Helper: input class builder
// ─────────────────────────────────────────────────────────────

const inputCls = (err) =>
  `w-full border rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] bg-white outline-none transition
   focus:ring-2 focus:ring-[#15803d] focus:border-transparent placeholder:text-[#94a3b8]
   ${err ? "border-red-300 bg-red-50" : "border-[#e2e8f0] hover:border-[#94a3b8]"}`

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function Field({ label, required, hint, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
        className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#6b7280]"
      >
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[#94a3b8] mt-0.5">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-0.5 font-medium">{error}</p>}
    </div>
  )
}

function SectionDivider({ children }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span
        style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
        className="text-[10.5px] font-extrabold text-[#94a3b8] uppercase tracking-[0.15em] whitespace-nowrap"
      >
        {children}
      </span>
      <div className="flex-1 h-px bg-[#e8f5ee]" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Equipment Row
// ─────────────────────────────────────────────────────────────

function EquipmentRow({ row, index, allEquipment, onChange, onRemove, usedIds }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl">
      <select
        className={`flex-1 border rounded-lg px-3 py-2 text-sm text-[#0f172a] bg-white outline-none transition
          focus:ring-2 focus:ring-[#15803d] focus:border-transparent border-[#e2e8f0] hover:border-[#94a3b8]`}
        value={row.equipment}
        onChange={(e) => onChange(index, "equipment", Number(e.target.value))}
        style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
      >
        <option value="">Select equipment…</option>
        {allEquipment.map((eq) => (
          <option
            key={eq.id}
            value={eq.id}
            disabled={usedIds.includes(eq.id) && eq.id !== row.equipment}
          >
            {eq.name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-[#6b7280] font-medium">Qty</span>
        <input
          type="number"
          min="1"
          max="999"
          className="w-16 border rounded-lg px-2.5 py-2 text-sm text-[#0f172a] bg-white outline-none
            focus:ring-2 focus:ring-[#15803d] focus:border-transparent border-[#e2e8f0] text-center"
          value={row.quantity}
          onChange={(e) => onChange(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
          style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
        />
      </div>

      <button
        type="button"
        onClick={() => onRemove(index)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#94a3b8]
          hover:bg-red-50 hover:text-red-500 transition shrink-0"
        aria-label="Remove row"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function BufferInput({ value, onChange, placeholder = "0" }) {
  return (
    <div className="relative flex items-center">
      <input
        type="number"
        min="0"
        max="480"
        step="5"
        className="w-full border rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] bg-white outline-none transition
          focus:ring-2 focus:ring-[#15803d] focus:border-transparent placeholder:text-[#94a3b8]
          border-[#e2e8f0] hover:border-[#94a3b8] pr-14"
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        placeholder={placeholder}
        style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
      />
      <span className="absolute right-3.5 text-[11.5px] font-semibold text-[#94a3b8] pointer-events-none">
        min
      </span>
    </div>
  )
}

function UserSearchCombobox({ displayValue, onSelect, placeholder, error }) {
    const [query, setQuery]           = useState(displayValue || "")
    const [results, setResults]       = useState([])
    const [isOpen, setIsOpen]         = useState(false)
    const [isLoading, setIsLoading]   = useState(false)
    const debounceRef                 = useRef(null)

    useEffect(() => {
        // eslint-disable-next-line
        setQuery(displayValue || "")
    }, [displayValue])

    const search = (q) => {
        setQuery(q)
        clearTimeout(debounceRef.current)
        if (!q.trim()) { setResults([]); setIsOpen(false); return }
        debounceRef.current = setTimeout(async () => {
            setIsLoading(true)
            try {
                const res = await api.get(`/auth/users/search/?q=${encodeURIComponent(q)}`)
                setResults(res.data?.results ?? res.data ?? [])
                setIsOpen(true)
            } catch {
                setResults([])
            } finally {
                setIsLoading(false)
            }
        }, 300)
    }

    const select = (user) => {
        onSelect(user)
        setQuery(user.full_name || user.name || `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim())
        setIsOpen(false)
        setResults([])
    }

    return (
        <div className="relative">
            <input
                className={inputCls(error)}
                value={query}
                onChange={(e) => search(e.target.value)}
                placeholder={placeholder}
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
                autoComplete="off"
            />
            {isLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#94a3b8]">
                    Searching…
                </span>
            )}
            {isOpen && results.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-[#e2e8f0] rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {results.map((user) => {
                        const name = user.full_name || user.name ||
                            `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email
                        return (
                            <button
                                key={user.id}
                                type="button"
                                onClick={() => select(user)}
                                className="w-full text-left px-4 py-2.5 text-[13px] text-[#0f172a]
                                    hover:bg-[#f0fdf4] transition flex flex-col"
                            >
                                <span className="font-semibold">{name}</span>
                                {user.email && (
                                    <span className="text-[11px] text-[#94a3b8]">{user.email}</span>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
            {isOpen && !isLoading && results.length === 0 && query.trim() && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-[#e2e8f0]
                    rounded-xl shadow-lg px-4 py-3 text-[13px] text-[#94a3b8]">
                    No users found
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────

function SpaceFormModal({ initialData = null, onClose, onSaved }) {
  const isEdit = !!initialData
  const fileInputRef = useRef(null)

  const createSpace = useCreateSpace()
  const updateSpace = useUpdateSpace()

  const [blocks, setBlocks] = useState([])
  const [blocksLoading, setBlocksLoading] = useState(true)

  // ── Form state ──
  const [form, setForm] = useState(() => {
    const parsed = parseSpaceLocation(initialData?.location ?? "", [])
    return {
      name: initialData?.name ?? "",
      space_type: initialData?.space_type ?? "",
      approval_category: initialData?.approval_category ?? "GENERAL",
      approval_workflow_type: initialData?.approval_workflow_type ?? "DIRECT",
      capacity_hard: initialData?.capacity_hard ?? "",
      blockId: parsed.blockId,
      locationDetails: parsed.locationDetails,
      description: initialData?.description ?? "",
      is_active: initialData?.is_active ?? true,
      is_special_purpose: initialData?.is_special_purpose ?? false,
      setup_buffer_minutes: initialData?.setup_buffer_minutes ?? 0,
      teardown_buffer_minutes: initialData?.teardown_buffer_minutes ?? 0,
      chain_primary_approver:  initialData?.approver_chain?.primary_approver?.id   ?? null,
      chain_fallback_approver: initialData?.approver_chain?.fallback_approver?.id   ?? null,
      chain_escalation_hours:  initialData?.approver_chain?.escalation_hours        ?? 24,
      chain_requires_reason:   initialData?.approver_chain?.requires_reason         ?? true,
      chain_earliest_start:    initialData?.approver_chain?.earliest_start          ?? "",
      chain_latest_end:        initialData?.approver_chain?.latest_end              ?? "",
    }
  })

  const [primaryApproverDisplay, setPrimaryApproverDisplay]   = useState(
      initialData?.approver_chain?.primary_approver?.name ?? ""
  )
  const [fallbackApproverDisplay, setFallbackApproverDisplay] = useState(
      initialData?.approver_chain?.fallback_approver?.name ?? ""
  )

  // Image state
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(initialData?.image_1 ?? null)
  const [imageDragOver, setImageDragOver] = useState(false)

  // Equipment state — array of { equipment: id|"", quantity: 1 }
  const [equipmentRows, setEquipmentRows] = useState(() => {
    if (initialData?.built_in_equipment?.length) {
      return initialData.built_in_equipment.map((e) => ({
        equipment: e.equipment ?? e.id,
        quantity: e.quantity ?? 1,
      }))
    }
    return []
  })

  const [allEquipment, setAllEquipment] = useState([])
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // ── Load equipment options + blocks ──
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/spaces/inventory/")
        const items = res.data.results ?? res.data ?? []
        setAllEquipment(items.filter((eq) => eq.is_active !== false && !eq.is_standard_media_kit))
      } catch {
        // Non-fatal
      }
    }
    load()
  }, [])

  useEffect(() => {
    let isMounted = true
    const loadBlocks = async () => {
      setBlocksLoading(true)
      try {
        const data = await spaceAdminService.getBlocks()
        const list = Array.isArray(data) ? data : data.results ?? []
        if (!isMounted) return
        setBlocks(list.filter((b) => b.is_active !== false))
        if (initialData?.location) {
          const parsed = parseSpaceLocation(initialData.location, list)
          setForm((p) => ({
            ...p,
            blockId: parsed.blockId || p.blockId,
            locationDetails: parsed.locationDetails || p.locationDetails,
          }))
        }
      } catch {
        // Non-fatal — dropdown may be empty
      } finally {
        if (isMounted) setBlocksLoading(false)
      }
    }
    loadBlocks()
    return () => { isMounted = false }
  }, [initialData?.location])

  // ── Helpers ──
  const set = (key, val) => {
    setForm((p) => ({ ...p, [key]: val }))
    if (errors[key]) setErrors((p) => ({ ...p, [key]: null }))
  }

  const handleImageChange = (file) => {
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setImageDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith("image/")) handleImageChange(file)
  }

  // Equipment rows
  const addEquipmentRow = () => {
    setEquipmentRows((p) => [...p, { equipment: "", quantity: 1 }])
  }

  const updateEquipmentRow = (idx, key, val) => {
    setEquipmentRows((p) => p.map((r, i) => (i === idx ? { ...r, [key]: val } : r)))
  }

  const removeEquipmentRow = (idx) => {
    setEquipmentRows((p) => p.filter((_, i) => i !== idx))
  }

  const usedEquipmentIds = equipmentRows.map((r) => r.equipment).filter(Boolean)

  // ── Validation ──
  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = "Space name is required"
    if (!form.space_type) e.space_type = "Select a space type"
    if (!form.approval_category) e.approval_category = "Select an approval category"
    if (!form.approval_workflow_type) e.approval_workflow_type = "Select an approval workflow"
    if (!form.capacity_hard || Number(form.capacity_hard) < 1)
      e.capacity_hard = "Enter a valid capacity (≥ 1)"
    if (!form.blockId) e.blockId = "Select a block"
    if (!form.locationDetails.trim()) e.locationDetails = "Location details are required"
    for (const row of equipmentRows) {
      if (!row.equipment) {
        e.equipment = "All equipment rows must have an item selected"
        break
      }
    }
    if (form.approval_workflow_type === "HOD_FALLBACK") {
        if (!form.chain_primary_approver)
            e.chain_primary_approver = "Select a primary approver"
        if (!form.chain_fallback_approver)
            e.chain_fallback_approver = "Select a fallback approver"
        if (form.chain_escalation_hours < 1)
            e.chain_escalation_hours = "Must be at least 1 hour"
    }
    return e
  }

  // ── Submit ──
  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      const fd = new FormData()
      fd.append("name", form.name.trim())
      fd.append("space_type", form.space_type)
      fd.append("approval_category", form.approval_category)
      fd.append("approval_workflow_type", form.approval_workflow_type)
      fd.append("capacity_hard", Number(form.capacity_hard))
      const selectedBlock = blocks.find((b) => String(b.id) === String(form.blockId))
      const locationValue = combineSpaceLocation(
        selectedBlock?.name ?? "",
        form.locationDetails.trim()
      )
      fd.append("location", locationValue)
      fd.append("description", form.description.trim())
      fd.append("is_active", form.is_active)
      fd.append("is_special_purpose", form.is_special_purpose)
      fd.append("setup_buffer_minutes", Number(form.setup_buffer_minutes))
      fd.append("teardown_buffer_minutes", Number(form.teardown_buffer_minutes))

      if (form.approval_workflow_type === "HOD_FALLBACK") {
          fd.append("chain_primary_approver",  form.chain_primary_approver)
          fd.append("chain_fallback_approver", form.chain_fallback_approver)
          fd.append("chain_escalation_hours",  form.chain_escalation_hours)
          fd.append("chain_requires_reason",   form.chain_requires_reason)
          if (form.chain_earliest_start) fd.append("chain_earliest_start", form.chain_earliest_start)
          if (form.chain_latest_end)     fd.append("chain_latest_end",     form.chain_latest_end)
      }

      if (imageFile) fd.append("image_1", imageFile)

      const validRows = equipmentRows.filter((r) => r.equipment)
      fd.append(
        "equipment_data",
        JSON.stringify(validRows.map((r) => ({ equipment: r.equipment, quantity: r.quantity })))
      )

      if (isEdit) {
        await updateSpace.mutateAsync({ id: initialData.id, fd })
      } else {
        await createSpace.mutateAsync(fd)
      }

      setSubmitted(true)
      onSaved?.()
    } catch (error) {
      const errData = error.response?.data || {}
      const mapped = {}
      if (errData.name) mapped.name = Array.isArray(errData.name) ? errData.name[0] : errData.name
      if (errData.capacity_hard)
        mapped.capacity_hard = Array.isArray(errData.capacity_hard)
          ? errData.capacity_hard[0]
          : errData.capacity_hard
      if (errData.location) {
        const msg = Array.isArray(errData.location) ? errData.location[0] : errData.location
        mapped.locationDetails = msg
      }
      if (errData.non_field_errors)
        mapped.server = Array.isArray(errData.non_field_errors)
          ? errData.non_field_errors[0]
          : errData.non_field_errors
      if (Object.keys(mapped).length === 0) mapped.server = "Submission failed. Please try again."
      setErrors(mapped)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Success screen ──
  if (submitted) {
    return createPortal(
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
        <div
          className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-4 max-w-sm w-full text-center border border-[#e8f5ee]"
          style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
        >
          <div className="w-14 h-14 rounded-full bg-[#dcfce7] flex items-center justify-center">
            <svg className="w-7 h-7 text-[#15803d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-[18px] font-bold text-[#0f172a] tracking-tight">
            {isEdit ? "Space Updated" : "Space Created"}
          </h2>
          <p className="text-[14px] text-[#6b7280] leading-relaxed">
            <span className="font-semibold text-[#0f172a]">{form.name}</span> has been{" "}
            {isEdit ? "updated" : "added to the catalog"} successfully.
          </p>
          <button
            onClick={onClose}
            className="mt-2 w-full bg-[#15803d] hover:bg-[#166534] text-white py-2.5 rounded-xl text-sm font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>,
      document.body
    )
  }

  // ── Main modal ──
  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div
        className="bg-white w-full max-w-3xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[94vh] border border-[#e8f5ee]"
        style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
      >
        {/* ═══════════════════════════════════════ */}
        {/* LEFT PANEL                              */}
        {/* ═══════════════════════════════════════ */}
        <div
          className="hidden md:flex md:w-[30%] shrink-0 flex-col justify-between p-7"
          style={{
            background: "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)",
          }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#86efac] mb-2">
              {isEdit ? "Edit Space" : "New Space"}
            </p>
            <h2 className="text-[22px] font-bold text-white leading-tight tracking-tight">
              {form.name || "Untitled Space"}
            </h2>

            {form.space_type && (
              <span className="inline-block mt-2 px-2.5 py-1 rounded-md bg-white/10 text-[#86efac] text-[11px] font-semibold uppercase tracking-wide border border-white/20">
                {SPACE_TYPES.find((t) => t.value === form.space_type)?.label ?? form.space_type}
              </span>
            )}

            <p className="text-sm text-[#86efac]/70 mt-4 leading-relaxed">
              {isEdit
                ? "Editing a space updates it live in the booking catalog immediately."
                : "New spaces appear in the booking catalog once saved."}
            </p>

            {/* Capacity display */}
            {Number(form.capacity_hard) > 0 && (
              <div className="mt-5 bg-white/10 rounded-xl px-4 py-3 border border-white/10">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#86efac]/60 mb-1">
                  Capacity
                </p>
                <p className="text-white font-bold text-2xl leading-none">
                  {form.capacity_hard}
                  <span className="text-[13px] font-medium text-[#86efac]/60 ml-1">seats</span>
                </p>
              </div>
            )}

            {/* Buffer preview */}
            {(Number(form.setup_buffer_minutes) > 0 || Number(form.teardown_buffer_minutes) > 0) && (
              <div className="mt-3 bg-white/10 rounded-xl px-4 py-3 border border-white/10 space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#86efac]/60">
                  Buffers
                </p>
                {Number(form.setup_buffer_minutes) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#86efac]/70 font-medium">Before</span>
                    <span className="text-[13px] font-bold text-white">
                      {form.setup_buffer_minutes}
                      <span className="text-[11px] font-medium text-[#86efac]/60 ml-1">min</span>
                    </span>
                  </div>
                )}
                {Number(form.teardown_buffer_minutes) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#86efac]/70 font-medium">After</span>
                    <span className="text-[13px] font-bold text-white">
                      {form.teardown_buffer_minutes}
                      <span className="text-[11px] font-medium text-[#86efac]/60 ml-1">min</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {form.approval_workflow_type === "HOD_FALLBACK" && primaryApproverDisplay && (
                <div className="mt-3 bg-white/10 rounded-xl px-4 py-3 border border-white/10 space-y-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#86efac]/60">
                        Approver Chain
                    </p>
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-white font-semibold">
                            {primaryApproverDisplay}
                        </span>
                        {fallbackApproverDisplay && (
                            <span className="text-[11px] text-[#86efac]/70">
                                ↳ {fallbackApproverDisplay} (fallback)
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Flags */}
            <div className="mt-5 space-y-2">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${form.is_active ? "bg-[#dcfce7]/20 border-[#86efac]/30 text-[#86efac]" : "bg-white/5 border-white/10 text-white/30"}`}>
                <span className={`w-2 h-2 rounded-full ${form.is_active ? "bg-[#86efac]" : "bg-white/20"}`} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">
                  {form.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              {form.is_special_purpose && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-amber-400/10 border-amber-400/30 text-amber-300">
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    Special Purpose
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Equipment count */}
          {equipmentRows.filter((r) => r.equipment).length > 0 && (
            <div className="bg-white/10 rounded-xl px-4 py-3 border border-white/10">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#86efac]/60 mb-1">
                Built-in Equipment
              </p>
              <p className="text-white font-bold text-xl">
                {equipmentRows.filter((r) => r.equipment).length}
                <span className="text-[12px] font-medium text-[#86efac]/60 ml-1">
                  {equipmentRows.filter((r) => r.equipment).length === 1 ? "item" : "items"}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* RIGHT PANEL                             */}
        {/* ═══════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          {/* Header */}
          <div className="flex justify-between items-start px-7 pt-6 pb-4 border-b border-[#e8f5ee] shrink-0">
            <div>
              <p className="text-[10.5px] font-bold text-[#15803d] uppercase tracking-[0.12em] mb-0.5">
                Space Configuration
              </p>
              <h2 className="text-[20px] font-bold text-[#0f172a] tracking-tight">
                {isEdit ? "Edit space details" : "Add a new space"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f1f5f9] text-[#94a3b8] transition"
            >
              ✕
            </button>
          </div>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-6">

            {/* ── BASIC INFO ── */}
            <SectionDivider>Basic Information</SectionDivider>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Space Name" required error={errors.name}>
                <input
                  className={inputCls(errors.name)}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Main Seminar Hall"
                  style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
                />
              </Field>
              <Field label="Space Type" required error={errors.space_type}>
                <select
                  className={inputCls(errors.space_type)}
                  value={form.space_type}
                  onChange={(e) => set("space_type", e.target.value)}
                  style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
                >
                  <option value="">Select type…</option>
                  {SPACE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Capacity (seats)" required error={errors.capacity_hard}>
              <input
                type="number"
                min="1"
                className={inputCls(errors.capacity_hard)}
                value={form.capacity_hard}
                onChange={(e) => set("capacity_hard", e.target.value)}
                placeholder="e.g. 150"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Block" required error={errors.blockId}>
                <select
                  className={inputCls(errors.blockId)}
                  value={form.blockId}
                  onChange={(e) => set("blockId", e.target.value)}
                  disabled={blocksLoading}
                  style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
                >
                  <option value="">Select block…</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Location Details" required error={errors.locationDetails}>
                <input
                  className={inputCls(errors.locationDetails)}
                  value={form.locationDetails}
                  onChange={(e) => set("locationDetails", e.target.value)}
                  placeholder="e.g. Ground Floor, Room 101"
                  style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
                />
              </Field>
            </div>

            <Field label="Description" hint="Optional. Visible to users when they browse spaces.">
              <textarea
                rows={3}
                className={`${inputCls(false)} resize-none`}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Describe the space, its features, typical use…"
                style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
              />
            </Field>

            {/* ── CLEANING BUFFERS ── */}
            <SectionDivider>Approval Routing</SectionDivider>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Approval Category" required error={errors.approval_category} hint="Determines which scoped role reviews this space.">
                <select
                  className={inputCls(errors.approval_category)}
                  value={form.approval_category}
                  onChange={(e) => set("approval_category", e.target.value)}
                  style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
                >
                  {APPROVAL_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Approval Workflow" required error={errors.approval_workflow_type} hint="Use HOD fallback only for special lab workflows like AI Lab.">
                <select
                  className={inputCls(errors.approval_workflow_type)}
                  value={form.approval_workflow_type}
                  onChange={(e) => set("approval_workflow_type", e.target.value)}
                  style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
                >
                  {APPROVAL_WORKFLOWS.map((workflow) => (
                    <option key={workflow.value} value={workflow.value}>
                      {workflow.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {form.approval_workflow_type === "HOD_FALLBACK" && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 space-y-4">
                <p className="text-[12px] font-semibold text-blue-800">
                  Configure who approves student bookings for this space.
                  The primary approver (e.g. HOD) acts first. If they don't respond within
                  the escalation window, the fallback approver (e.g. Lab In-Charge) is notified.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Primary Approver" required error={errors.chain_primary_approver}>
                    <UserSearchCombobox
                      value={form.chain_primary_approver}
                      displayValue={primaryApproverDisplay}
                      onSelect={(user) => {
                        set("chain_primary_approver", user.id)
                        setPrimaryApproverDisplay(
                          user.full_name || `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email
                        )
                        if (errors.chain_primary_approver)
                          setErrors((p) => ({ ...p, chain_primary_approver: null }))
                      }}
                      placeholder="Search by name…"
                      error={errors.chain_primary_approver}
                    />
                  </Field>

                  <Field label="Fallback Approver" required error={errors.chain_fallback_approver}>
                    <UserSearchCombobox
                      value={form.chain_fallback_approver}
                      displayValue={fallbackApproverDisplay}
                      onSelect={(user) => {
                        set("chain_fallback_approver", user.id)
                        setFallbackApproverDisplay(
                          user.full_name || `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email
                        )
                        if (errors.chain_fallback_approver)
                          setErrors((p) => ({ ...p, chain_fallback_approver: null }))
                      }}
                      placeholder="Search by name…"
                      error={errors.chain_fallback_approver}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Field
                    label="Escalation Window"
                    hint="Hours before fallback approver is notified."
                    error={errors.chain_escalation_hours}
                  >
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="1"
                        max="168"
                        className={`${inputCls(errors.chain_escalation_hours)} pr-12`}
                        value={form.chain_escalation_hours}
                        onChange={(e) => set("chain_escalation_hours", Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
                      />
                      <span className="absolute right-3.5 text-[11.5px] font-semibold text-[#94a3b8] pointer-events-none">
                        hrs
                      </span>
                    </div>
                  </Field>

                  <Field label="Booking Opens At" hint="Earliest allowed start time. Leave blank for no restriction.">
                    <input
                      type="time"
                      className={inputCls(false)}
                      value={form.chain_earliest_start}
                      onChange={(e) => set("chain_earliest_start", e.target.value)}
                      style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
                    />
                  </Field>

                  <Field label="Booking Closes At" hint="Latest allowed end time. Leave blank for no restriction.">
                    <input
                      type="time"
                      className={inputCls(false)}
                      value={form.chain_latest_end}
                      onChange={(e) => set("chain_latest_end", e.target.value)}
                      style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
                    />
                  </Field>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-blue-200 bg-white">
                  <div>
                    <span className="text-[13.5px] font-semibold text-[#0f172a]">Require booking reason</span>
                    <p className="text-[12px] text-[#6b7280] mt-0.5">
                      If on, students must fill in a purpose before submitting.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.chain_requires_reason}
                    onClick={() => set("chain_requires_reason", !form.chain_requires_reason)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
                      focus:outline-none focus:ring-2 focus:ring-[#15803d] focus:ring-offset-2
                      ${form.chain_requires_reason ? "bg-blue-600" : "bg-[#e2e8f0]"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm
                      transition-transform ${form.chain_requires_reason ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </div>
              </div>
            )}

            <SectionDivider>Cleaning &amp; Maintenance Buffers</SectionDivider>

            {/* Explainer card */}
            <div className="flex gap-3 p-3.5 rounded-xl bg-[#f0fdf4] border border-[#d1fae5]">
              <div className="shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-[#15803d]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[12px] text-[#166534] leading-relaxed">
                <span className="font-semibold">These buffers are invisible to users.</span>{" "}
                After a booking ends, the teardown buffer is automatically held for cleaning — the next available slot shifts forward accordingly. Users see the slot as unavailable; they never need to account for this themselves.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Setup buffer (before)"
                hint="Held before a booking starts. Rarely needed — use for spaces that require pre-event prep by staff."
              >
                <BufferInput
                  value={form.setup_buffer_minutes}
                  onChange={(val) => set("setup_buffer_minutes", val)}
                />
              </Field>

              <Field
                label="Teardown buffer (after)"
                hint="Held after every booking ends. Use this for cleaning, sanitisation, or equipment reset time."
              >
                <BufferInput
                  value={form.teardown_buffer_minutes}
                  onChange={(val) => set("teardown_buffer_minutes", val)}
                />
              </Field>
            </div>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-2 -mt-2">
              <span className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wide self-center mr-1">
                Quick presets:
              </span>
              {[
                { label: "No buffer", setup: 0, teardown: 0 },
                { label: "15 min cleanup", setup: 0, teardown: 15 },
                { label: "30 min cleanup", setup: 0, teardown: 30 },
                { label: "45 min cleanup", setup: 0, teardown: 45 },
                { label: "1 hr cleanup", setup: 0, teardown: 60 },
              ].map(({ label, setup, teardown }) => {
                const isActive =
                  form.setup_buffer_minutes === setup &&
                  form.teardown_buffer_minutes === teardown
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      set("setup_buffer_minutes", setup)
                      set("teardown_buffer_minutes", teardown)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold border transition
                      ${isActive
                        ? "bg-[#15803d] text-white border-[#15803d]"
                        : "bg-white text-[#374151] border-[#e2e8f0] hover:bg-[#f0fdf4] hover:border-[#d1fae5]"}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* ── STATUS TOGGLES ── */}
            <SectionDivider>Visibility &amp; Flags</SectionDivider>

            <div className="space-y-3">
              {/* is_active toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
                <div className="flex flex-col pr-4">
                  <span className="text-[14px] font-semibold text-[#0f172a]">Active Space</span>
                  <span className="text-[12px] text-[#6b7280] mt-0.5 leading-relaxed">
                    When active, this space appears in the booking catalog and can be requested.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_active}
                  onClick={() => set("is_active", !form.is_active)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200
                    focus:outline-none focus:ring-2 focus:ring-[#15803d] focus:ring-offset-2
                    ${form.is_active ? "bg-[#15803d]" : "bg-[#e2e8f0]"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200
                      ${form.is_active ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>

              {/* is_special_purpose toggle */}
              <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200
                ${form.is_special_purpose
                  ? "border-amber-300 bg-amber-50"
                  : "border-[#e2e8f0] bg-[#f8fafc]"}`}
              >
                <div className="flex items-start gap-3 pr-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-all
                    ${form.is_special_purpose ? "bg-amber-100 text-amber-600" : "bg-[#e2e8f0] text-[#94a3b8]"}`}
                  >
                    <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <span className={`text-[14px] font-bold tracking-tight ${form.is_special_purpose ? "text-amber-800" : "text-[#0f172a]"}`}>
                      Special Purpose Space
                    </span>
                    <p className={`text-[12px] mt-0.5 leading-relaxed ${form.is_special_purpose ? "text-amber-700" : "text-[#6b7280]"}`}>
                      <span className="font-semibold">Fences this room from the suggestion engine.</span>{" "}
                      Spaces like AI Labs or dedicated research rooms that should never be auto-suggested
                      as alternatives during low-occupancy bookings must be flagged here.
                    </p>
                    {form.is_special_purpose && (
                      <p className="text-[11.5px] text-amber-600 font-semibold mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        This space will NOT appear in automated booking suggestions.
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_special_purpose}
                  onClick={() => set("is_special_purpose", !form.is_special_purpose)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200
                    focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2
                    ${form.is_special_purpose ? "bg-amber-500" : "bg-[#e2e8f0]"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200
                      ${form.is_special_purpose ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>
            </div>

            {/* ── IMAGE UPLOAD ── */}
            <SectionDivider>Space Image</SectionDivider>

            <div
              className={`relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${imageDragOver
                  ? "border-[#15803d] bg-[#f0fdf4]"
                  : imagePreview
                    ? "border-[#d1fae5] bg-white"
                    : "border-[#e2e8f0] hover:border-[#94a3b8] bg-[#f8fafc]"}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setImageDragOver(true) }}
              onDragLeave={() => setImageDragOver(false)}
              onDrop={handleDrop}
            >
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Space preview"
                    className="w-full h-44 object-cover rounded-xl"
                  />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all rounded-xl flex items-center justify-center">
                    <span className="opacity-0 hover:opacity-100 text-white text-sm font-semibold bg-black/60 px-4 py-2 rounded-lg transition-opacity pointer-events-none">
                      Click to change image
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setImageFile(null)
                      setImagePreview(null)
                    }}
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/50 hover:bg-red-600 text-white flex items-center justify-center transition text-xs"
                    aria-label="Remove image"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="py-10 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#e2e8f0] flex items-center justify-center text-[#94a3b8]">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-[13.5px] font-semibold text-[#374151]">
                      Drop an image, or{" "}
                      <span className="text-[#15803d] underline underline-offset-2">browse</span>
                    </p>
                    <p className="text-[12px] text-[#94a3b8] mt-1">PNG, JPG up to 10 MB</p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageChange(e.target.files?.[0])}
              />
            </div>

            {/* ── BUILT-IN EQUIPMENT ── */}
            <SectionDivider>Built-in Equipment</SectionDivider>

            {errors.equipment && (
              <p className="text-xs text-red-500 font-medium -mt-3">{errors.equipment}</p>
            )}

            <div className="space-y-2.5">
              {equipmentRows.length === 0 ? (
                <p className="text-[13px] text-[#94a3b8] py-2 text-center">
                  No equipment added yet. Click below to add.
                </p>
              ) : (
                equipmentRows.map((row, idx) => (
                  <EquipmentRow
                    key={idx}
                    row={row}
                    index={idx}
                    allEquipment={allEquipment}
                    onChange={updateEquipmentRow}
                    onRemove={removeEquipmentRow}
                    usedIds={usedEquipmentIds}
                  />
                ))
              )}

              <button
                type="button"
                onClick={addEquipmentRow}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed
                  border-[#d1fae5] text-[#15803d] text-[13.5px] font-semibold hover:bg-[#f0fdf4] transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add equipment row
              </button>
            </div>

            {/* bottom breathing room */}
            <div className="h-2" />
          </div>

          {/* Footer */}
          <div className="shrink-0 flex justify-between items-center px-7 py-4 border-t border-[#e8f5ee] bg-[#f8fafb]">
            <div>
              {errors.server && (
                <p className="text-xs text-red-500 font-medium">{errors.server}</p>
              )}
              {!errors.server && (
                <p className="text-[12px] text-[#94a3b8]">
                  {isEdit
                    ? "Changes are applied immediately to the booking catalog."
                    : "The new space will be visible to users right away."}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#e2e8f0] text-[13.5px] font-medium text-[#6b7280] hover:bg-[#f1f5f9] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-[13.5px] font-semibold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Space"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default SpaceFormModal
