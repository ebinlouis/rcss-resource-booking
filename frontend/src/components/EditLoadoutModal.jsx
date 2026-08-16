import { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { Package, Plus, X, AlertCircle, Loader2, CheckCircle2 } from "lucide-react"
import toast from "react-hot-toast"
import mediaService from "../api/mediaApi"

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = (hasError) =>
  `w-full border ${
    hasError
      ? "border-red-400 bg-red-50 focus:ring-red-400"
      : "border-gray-200 bg-white focus:ring-emerald-600"
  } rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 transition-all`

function formatTime(isoString) {
  if (!isoString) return "--"
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return "--"
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
}

function formatDate(isoString) {
  if (!isoString) return "--"
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return "--"
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })
}

/** Returns "3 Jun 2025, 10:00 am" */
function formatDateTime(isoString) {
  if (!isoString) return "--"
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return "--"
  const date = d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
  return `${date}, ${time}`
}

function isSameDay(isoA, isoB) {
  if (!isoA || !isoB) return false
  return new Date(isoA).toDateString() === new Date(isoB).toDateString()
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EquipmentRow({ row, index, allRows, availableEquipment, groupedEquipment, onChange, onRemove, error }) {
  const selected = availableEquipment.find((e) => e.id === Number(row.equipment))
  const maxQty   = selected ? selected.currently_available + (row._originalQty ?? 0) : 1

  return (
    <div className="flex items-start gap-3">
      {/* Equipment select */}
      <div className="flex-1">
        <select
          value={row.equipment}
          onChange={(e) => onChange(index, "equipment", Number(e.target.value) || "")}
          className={inputCls(!!error?.equipment)}
        >
          <option value="">— Select equipment —</option>
          {Object.entries(groupedEquipment).map(([cat, items]) => (
            <optgroup key={cat} label={cat}>
              {items.map((eq) => {
                const usedElsewhere = allRows.some(
                  (r, i) => i !== index && Number(r.equipment) === eq.id
                )
                const avail = eq.currently_available + (row._originalQty ?? 0)
                const disabled = (avail === 0 && Number(row.equipment) !== eq.id) || usedElsewhere
                return (
                  <option key={eq.id} value={eq.id} disabled={disabled}>
                    {eq.name}
                    {usedElsewhere
                      ? " (already added)"
                      : avail === 0
                      ? " (out of stock)"
                      : ` (${avail} available)`}
                  </option>
                )
              })}
            </optgroup>
          ))}
        </select>
        {error?.equipment && (
          <p className="mt-1 text-xs text-red-500">{error.equipment}</p>
        )}
      </div>

      {/* Quantity */}
      <div className="w-20 shrink-0">
        <input
          type="number"
          min={1}
          max={maxQty}
          value={row.quantity}
          disabled={!row.equipment}
          onChange={(e) => onChange(index, "quantity", Math.max(1, Number(e.target.value)))}
          className={inputCls(!!error?.quantity)}
        />
        {error?.quantity && (
          <p className="mt-1 text-xs text-red-500">{error.quantity}</p>
        )}
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="mt-1 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        title="Remove row"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Seed rows helper (pure, outside component) ────────────────────────────────

function seedRows(booking) {
  const seeded = (booking?.equipment_requests ?? []).map((req) => ({
    equipment:    req.equipment,
    quantity:     req.quantity,
    _originalQty: req.quantity,
  }))
  return seeded.length ? seeded : [{ equipment: "", quantity: 1, _originalQty: 0 }]
}

// ── Main Modal ────────────────────────────────────────────────────────────────

/**
 * EditLoadoutModal
 *
 * Props:
 * booking   — full MediaBooking object (from runsheet API)
 * onClose   — () => void
 * onSuccess — (updatedBooking) => void   called after a successful PATCH
 */
function EditLoadoutModal({ booking, onClose, onSuccess }) {
  // ── State ──────────────────────────────────────────────────────────────────

  const [rows, setRows]                       = useState(() => seedRows(booking))
  const [availableEquipment, setAvail]        = useState([])
  const [loadingInventory, setLoadingInv]     = useState(true)
  const [inventoryError, setInventoryError]   = useState("")
  const [rowErrors, setRowErrors]             = useState({})
  const [globalError, setGlobalError]         = useState("")
  const [saving, setSaving]                   = useState(false)
  const [saved, setSaved]                     = useState(false)

  const bookingId = booking?.id

  // Pluck DateTimes
  const startDt = booking?.setup_start_datetime || booking?.event_start_datetime
  const endDt   = booking?.teardown_end_datetime || booking?.event_end_datetime

  useEffect(() => {
    let cancelled = false
    Promise.resolve(seedRows(booking)).then((seeded) => {
      if (!cancelled) setRows(seeded)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  // ── Load live inventory for this booking's time window ────────────────────
  useEffect(() => {
    let active = true

    Promise.resolve().then(() => {
      if (!active) return
      setLoadingInv(true)
      setInventoryError("")

      mediaService
        .checkAvailability(startDt, endDt, booking.id)
        .then((data) => {
          if (!active) return

          const existingEqIds = new Set((booking.equipment_requests || []).map(r => r.equipment))
          const mediaGearOnly = data.filter(eq => eq.is_standard_media_kit || existingEqIds.has(eq.id))

          setAvail(mediaGearOnly)

          setRows((prev) => prev.map((row) => {
            if (!row.equipment) return row
            const item = mediaGearOnly.find((eq) => eq.id === Number(row.equipment))
            if (!item || (item.currently_available + (row._originalQty ?? 0) < row.quantity)) {
              return { equipment: "", quantity: 1, _originalQty: 0 }
            }
            return row
          }))
        })
        .catch(() => {
          if (active) setInventoryError("Could not load live inventory. Check your connection.")
        })
        .finally(() => {
          if (active) setLoadingInv(false)
        })
    })

    return () => { active = false }
  }, [startDt, endDt, booking.id, booking.equipment_requests])

  // ── Grouped equipment for <optgroup> ──────────────────────────────────────
  const groupedEquipment = useMemo(() => {
    return availableEquipment.reduce((acc, eq) => {
      if (!acc[eq.category]) acc[eq.category] = []
      acc[eq.category].push(eq)
      return acc
    }, {})
  }, [availableEquipment])

  // ── Row handlers ──────────────────────────────────────────────────────────
  const handleRowChange = (index, field, value) => {
    setRows((prev) => {
      const next = [...prev]
      if (field === "equipment") {
        next[index] = { ...next[index], equipment: value, quantity: 1, _originalQty: 0 }
      } else {
        next[index] = { ...next[index], [field]: value }
      }
      return next
    })
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
    setGlobalError("")
  }

  const addRow = () => {
    setRows((prev) => [...prev, { equipment: "", quantity: 1, _originalQty: 0 }])
  }

  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {}
    const seenIds = new Set()
    rows.forEach((row, i) => {
      const rowErr = {}
      if (!row.equipment) rowErr.equipment = "Select an item"
      if (row.quantity < 1) rowErr.quantity = "Min 1"
      if (row.equipment && seenIds.has(Number(row.equipment))) {
        rowErr.equipment = "Duplicate — merge into one row"
      }
      if (row.equipment) seenIds.add(Number(row.equipment))
      if (Object.keys(rowErr).length) errs[i] = rowErr
    })
    setRowErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setGlobalError("")
    if (!validate()) return

    const payload = rows
      .filter((r) => r.equipment)
      .map((r) => ({ equipment: Number(r.equipment), quantity: Number(r.quantity) }))

    try {
      setSaving(true)
      const updated = await mediaService.updateLoadout(booking.id, payload)
      setSaved(true)
      toast.success("Equipment loadout updated successfully.")
      setTimeout(() => {
        onSuccess(updated)
      }, 900)
    } catch (err) {
      const data = err.response?.data
      const msg  = data?.error || data?.detail || "Failed to save loadout. Please try again."
      setGlobalError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // ── Date/time label for header ─────────────────────────────────────────────
  const eStart    = booking?.event_start_datetime
  const eEnd      = booking?.event_end_datetime
  const sameDay   = isSameDay(eStart, eEnd)

  // Single-day:  "3 Jun 2025 · 10:00 am – 1:00 pm"
  // Multi-day:   "3 Jun 2025, 10:00 am – 5 Jun 2025, 1:00 pm"
  const eventTimeLabel = sameDay
    ? `${formatDate(eStart)} · ${formatTime(eStart)} – ${formatTime(eEnd)}`
    : `${formatDateTime(eStart)} – ${formatDateTime(eEnd)}`

  // ── Render ────────────────────────────────────────────────────────────────
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 mb-1">
              Edit Loadout
            </p>
            <h2 className="text-[18px] font-bold text-gray-900 leading-tight">
              {booking.event_name}
            </h2>
            <p className="mt-1 text-[13px] text-gray-500">
              {eventTimeLabel}
              {" · "}
              {booking.space_details?.name ?? "—"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Success state */}
          {saved && (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-800">Loadout saved successfully.</p>
            </div>
          )}

          {/* Global error */}
          {globalError && (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <p className="text-sm text-red-700">{globalError}</p>
            </div>
          )}

          {/* Inventory loading */}
          {loadingInventory ? (
            <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading live inventory…</span>
            </div>
          ) : inventoryError ? (
            <div className="flex items-start gap-3 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-yellow-600 mt-0.5" />
              <p className="text-sm text-yellow-800">{inventoryError}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-700" />
                  <span className="text-sm font-bold text-gray-800">Media Team Gear</span>
                </div>
                <span className="text-xs text-gray-400 font-medium">
                  Quantities reflect live availability
                </span>
              </div>

              {/* Equipment rows */}
              {availableEquipment.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50">
                   <p className="text-sm text-gray-500 font-medium">No Media Team gear available for this time slot.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rows.map((row, index) => (
                    <EquipmentRow
                      key={index}
                      row={row}
                      index={index}
                      allRows={rows}
                      availableEquipment={availableEquipment}
                      groupedEquipment={groupedEquipment}
                      onChange={handleRowChange}
                      onRemove={removeRow}
                      error={rowErrors[index]}
                    />
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add equipment
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
          <p className="text-xs text-gray-400 font-medium">
            This replaces the entire loadout for this event.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saved || loadingInventory}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold disabled:opacity-60 transition-colors shadow-sm"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : saved ? "Saved!" : "Save Loadout"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default EditLoadoutModal