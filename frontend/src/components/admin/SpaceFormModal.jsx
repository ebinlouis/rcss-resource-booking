import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import api from "../../api/axios"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const SPACE_TYPES = [
  { value: "GENERAL_HALL", label: "General Hall" },
  { value: "LAB", label: "Laboratory" },
  { value: "GUEST_ROOM", label: "Guest Room" },
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

// ─────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────

function SpaceFormModal({ initialData = null, onClose, onSaved }) {
  const isEdit = !!initialData
  const fileInputRef = useRef(null)

  // ── Form state ──
  const [form, setForm] = useState(() => ({
    name: initialData?.name ?? "",
    space_type: initialData?.space_type ?? "",
    capacity_hard: initialData?.capacity_hard ?? "",
    location: initialData?.location ?? "",
    description: initialData?.description ?? "",
    is_active: initialData?.is_active ?? true,
    is_special_purpose: initialData?.is_special_purpose ?? false,
  }))

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

  // ── Load equipment options ──
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/spaces/inventory/")
        const items = res.data.results ?? res.data ?? []
        setAllEquipment(items.filter((eq) => eq.is_active !== false))
      } catch {
        // Non-fatal
      }
    }
    load()
  }, [])

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
    if (!form.capacity_hard || Number(form.capacity_hard) < 1)
      e.capacity_hard = "Enter a valid capacity (≥ 1)"
    if (!form.location.trim()) e.location = "Location is required"
    for (const row of equipmentRows) {
      if (!row.equipment) {
        e.equipment = "All equipment rows must have an item selected"
        break
      }
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
      fd.append("capacity_hard", Number(form.capacity_hard))
      fd.append("location", form.location.trim())
      fd.append("description", form.description.trim())
      fd.append("is_active", form.is_active)
      fd.append("is_special_purpose", form.is_special_purpose)

      if (imageFile) fd.append("image_1", imageFile)

      const validRows = equipmentRows.filter((r) => r.equipment)
      fd.append(
        "equipment_data",
        JSON.stringify(validRows.map((r) => ({ equipment: r.equipment, quantity: r.quantity })))
      )

      if (isEdit) {
        await api.patch(`/spaces/catalog/${initialData.id}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      } else {
        await api.post("/spaces/catalog/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
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
      if (errData.location)
        mapped.location = Array.isArray(errData.location) ? errData.location[0] : errData.location
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

            <div className="grid grid-cols-2 gap-4">
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
              <Field label="Location / Block" required error={errors.location}>
                <input
                  className={inputCls(errors.location)}
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="e.g. Block A, Ground Floor"
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

            {/* ── STATUS TOGGLES ── */}
            <SectionDivider>Visibility & Flags</SectionDivider>

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

              {/* is_special_purpose toggle — prominently styled */}
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