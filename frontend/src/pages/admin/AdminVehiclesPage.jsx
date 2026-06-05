import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getVehicles, createVehicle, updateVehicle, deleteVehicle } from "../../api/fleetApi"
import {
  Plus, Search, Pencil, Trash2, X, Bus,
  CheckCircle2, XCircle, RefreshCw, AlertTriangle,
} from "lucide-react"
import toast from "react-hot-toast"

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = (error) =>
  `w-full border ${
    error ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
  } rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-600 transition-all`

function Field({ label, required, children, error }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {error && <span className="text-red-500 text-xs">{error}</span>}
    </div>
  )
}

// ── Vehicle Form Modal ─────────────────────────────────────────────────────────

function VehicleFormModal({ vehicle, onClose, onSaved }) {
  const isEdit = Boolean(vehicle)
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    name:                vehicle?.name                ?? "",
    registration_number: vehicle?.registration_number ?? "",
    capacity:            vehicle?.capacity            ?? "",
    is_active:           vehicle?.is_active           ?? true,
  })
  const [errors,     setErrors]     = useState({})
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())                e.name                = "Required"
    if (!form.registration_number.trim()) e.registration_number = "Required"
    if (!form.capacity || Number(form.capacity) < 1) e.capacity = "Must be at least 1"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const payload = {
        name:                form.name.trim(),
        registration_number: form.registration_number.trim(),
        capacity:            Number(form.capacity),
        is_active:           form.is_active,
      }
      if (isEdit) {
        await updateVehicle(vehicle.id, payload)
        toast.success("Vehicle updated successfully.")
      } else {
        await createVehicle(payload)
        toast.success("Vehicle added successfully.")
      }
      queryClient.invalidateQueries({ queryKey: ["fleet", "vehicles"] })
      onSaved()
    } catch (err) {
      const data = err?.response?.data
      if (data && typeof data === "object") {
        const mapped = {}
        Object.keys(data).forEach((k) => {
          mapped[k] = Array.isArray(data[k]) ? data[k][0] : data[k]
        })
        setErrors(mapped)
      } else {
        toast.error("Something went wrong. Please try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {isEdit ? "Edit Vehicle" : "Add Vehicle"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEdit ? "Update vehicle details." : "Add a new vehicle for booking and management."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">

          <Field label="Vehicle Name" required error={errors.name}>
            <input
              type="text"
              name="name"
              className={inputCls(errors.name)}
              placeholder="e.g., Bus, Mini Van"
              value={form.name}
              onChange={handleChange}
            />
          </Field>

          <Field label="Registration Number" required error={errors.registration_number}>
            <input
              type="text"
              name="registration_number"
              className={inputCls(errors.registration_number)}
              placeholder="e.g., KL07 CL 4106"
              value={form.registration_number}
              onChange={handleChange}
            />
          </Field>

          <Field label="Capacity" required error={errors.capacity}>
            <input
              type="number"
              name="capacity"
              min="1"
              className={inputCls(errors.capacity)}
              placeholder="Number of seats"
              value={form.capacity}
              onChange={handleChange}
            />
          </Field>

          {/* Is Active toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50/60">
            <div>
              <p className="text-sm font-semibold text-gray-700">Active</p>
              <p className="text-xs text-gray-500 mt-0.5">Vehicle is available for bookings</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.is_active}
              onClick={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 ${
                form.is_active ? "bg-green-600" : "bg-gray-300"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${form.is_active ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-green-700 text-white text-sm font-bold hover:bg-green-800 transition shadow-sm disabled:opacity-60 flex items-center gap-2"
          >
            {submitting && (
              <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Vehicle"}
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────

function DeleteModal({ vehicle, onConfirm, onClose, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Delete Vehicle?</h2>
        <p className="text-sm text-gray-500 mb-4">This will permanently remove this vehicle.</p>
        <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 mb-5 text-left">
          <p className="text-sm font-semibold text-gray-900">{vehicle.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{vehicle.registration_number} · {vehicle.capacity} seats</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminVehiclesPage() {
  const queryClient = useQueryClient()

  const { data: vehicles = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["fleet", "vehicles"],
    queryFn:  getVehicles,
    staleTime: 0,
  })

  const [search,        setSearch]        = useState("")
  const [filterStatus,  setFilterStatus]  = useState("all") // all | active | inactive
  const [showForm,      setShowForm]      = useState(false)
  const [editTarget,    setEditTarget]    = useState(null)
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [deleting,      setDeleting]      = useState(false)

  // ── Stats ─────────────────────────────────────────────────────────────────

  const totalVehicles  = vehicles.length
  const activeVehicles = vehicles.filter((v) => v.is_active).length
  const totalCapacity  = vehicles.reduce((sum, v) => sum + (v.capacity || 0), 0)

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = [...vehicles]
    if (filterStatus === "active")   result = result.filter((v) => v.is_active)
    if (filterStatus === "inactive") result = result.filter((v) => !v.is_active)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((v) =>
        v.name?.toLowerCase().includes(q) ||
        v.registration_number?.toLowerCase().includes(q)
      )
    }
    return result
  }, [vehicles, search, filterStatus])

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteVehicle(deleteTarget.id)
      queryClient.invalidateQueries({ queryKey: ["fleet", "vehicles"] })
      toast.success("Vehicle deleted.")
      setDeleteTarget(null)
    } catch {
      toast.error("Could not delete vehicle. It may have active bookings.")
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicle Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage fleet vehicles and their availability.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-green-700 hover:bg-green-50 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => { setEditTarget(null); setShowForm(true) }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Vehicle
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Vehicles",  value: totalVehicles  },
          { label: "Active Vehicles", value: activeVehicles  },
          { label: "Total Capacity",  value: `${totalCapacity} seats` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search vehicles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-green-600 transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-green-600 transition text-gray-700 font-medium"
        >
          <option value="all">All Vehicles</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Table header */}
        <div className="hidden md:grid grid-cols-12 bg-gray-50 border-b border-gray-100 px-6 py-3">
          <span className="col-span-3 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">Name</span>
          <span className="col-span-3 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">Registration</span>
          <span className="col-span-2 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">Capacity</span>
          <span className="col-span-2 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">Status</span>
          <span className="col-span-2 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500 text-right">Actions</span>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col">
            {[1, 2, 3].map((i) => (
              <div key={i} className="hidden md:grid grid-cols-12 items-center px-6 py-4 border-b border-gray-100 animate-pulse">
                <div className="col-span-3"><div className="h-4 bg-gray-100 rounded w-24" /></div>
                <div className="col-span-3"><div className="h-4 bg-gray-100 rounded w-28" /></div>
                <div className="col-span-2"><div className="h-4 bg-gray-100 rounded w-12" /></div>
                <div className="col-span-2"><div className="h-5 bg-gray-100 rounded w-16" /></div>
                <div className="col-span-2 flex justify-end gap-2">
                  <div className="h-8 w-8 bg-gray-100 rounded-lg" />
                  <div className="h-8 w-8 bg-gray-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && isError && (
          <div className="py-16 text-center px-6">
            <p className="text-sm font-semibold text-gray-700 mb-2">Failed to load vehicles.</p>
            <button onClick={() => refetch()} className="text-green-700 text-sm font-medium hover:underline">
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="py-16 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <Bus className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-semibold text-gray-700">
              {search || filterStatus !== "all" ? "No vehicles match your search." : "No vehicles yet."}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {search || filterStatus !== "all" ? "Try changing your search or filter." : 'Click "+ Add Vehicle" to get started.'}
            </p>
          </div>
        )}

        {/* Rows */}
        {!isLoading && !isError && filtered.map((vehicle, idx) => (
          <div key={vehicle.id}>

            {/* Desktop row */}
            <div className={`hidden md:grid grid-cols-12 items-center px-6 py-4 hover:bg-gray-50/60 transition ${idx !== filtered.length - 1 ? "border-b border-gray-100" : ""}`}>
              <div className="col-span-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-700 shrink-0">
                    <Bus className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{vehicle.name}</p>
                </div>
              </div>
              <div className="col-span-3">
                <p className="text-sm font-mono text-gray-700">{vehicle.registration_number}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-700">{vehicle.capacity} seats</p>
              </div>
              <div className="col-span-2">
                {vehicle.is_active ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-100 text-green-700 text-[11px] font-bold uppercase tracking-wide">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 text-[11px] font-bold uppercase tracking-wide">
                    <XCircle className="w-3 h-3" /> Inactive
                  </span>
                )}
              </div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => { setEditTarget(vehicle); setShowForm(true) }}
                  title="Edit"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:border-green-200 hover:bg-green-50 hover:text-green-700 transition"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(vehicle)}
                  title="Delete"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-100 text-red-500 text-xs font-medium hover:bg-red-50 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>

            {/* Mobile card */}
            <div className={`md:hidden mx-3 my-3 rounded-2xl border border-gray-200 bg-white shadow-sm p-4 ${idx !== filtered.length - 1 ? "mb-0" : ""}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-700 shrink-0">
                    <Bus className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{vehicle.name}</p>
                    <p className="text-xs font-mono text-gray-500 mt-0.5">{vehicle.registration_number}</p>
                  </div>
                </div>
                {vehicle.is_active ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-[10px] font-bold uppercase">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold uppercase">
                    <XCircle className="w-3 h-3" /> Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">{vehicle.capacity} passenger seats</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditTarget(vehicle); setShowForm(true) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:border-green-200 hover:bg-green-50 hover:text-green-700 transition"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(vehicle)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-100 text-xs font-semibold text-red-500 hover:bg-red-50 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Form modal */}
      {showForm && (
        <VehicleFormModal
          vehicle={editTarget}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
          onSaved={() => { setShowForm(false); setEditTarget(null) }}
        />
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          vehicle={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

    </div>
  )
}