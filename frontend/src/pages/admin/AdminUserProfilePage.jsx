import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import adminUserService from "../../api/adminUserService"
import spaceAdminService from "../../api/spaceAdminService"
import roleOverrideService from "../../api/roleOverrideService"
import api from "../../api/axios"
import toast from "react-hot-toast"
import { X } from "lucide-react"

const normalise = (d) => Array.isArray(d) ? d : d?.results ?? []

const ROLE_COLOR = {
  FACULTY: "bg-blue-50 text-blue-700 border-blue-200",
  STAFF: "bg-slate-50 text-slate-700 border-slate-200",
  STUDENT: "bg-violet-50 text-violet-700 border-violet-200",
  RECEPTIONIST: "bg-sky-50 text-sky-700 border-sky-200",
  LAB_INCHARGE: "bg-indigo-50 text-indigo-700 border-indigo-200",
  LIBRARIAN: "bg-rose-50 text-rose-700 border-rose-200",
  HOD: "bg-amber-50 text-amber-700 border-amber-200",
  IT_ADMIN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIA_INCHARGE: "bg-purple-50 text-purple-700 border-purple-200",
  FLEET_MANAGER: "bg-orange-50 text-orange-700 border-orange-200",
  MESS_MANAGER: "bg-teal-50 text-teal-700 border-teal-200",
}

const getRoleDisplayName = (role) => {
  if (!role) return ""
  if (role.name === "FLEET_MANAGER" || role === "FLEET_MANAGER") return "Transport Manager"
  return role.display_name || role.name || role
}

const ROLE_DESCRIPTIONS = {
  FLEET_MANAGER: "Approves vehicle bookings and transport",
  LAB_INCHARGE: "Manage computer lab booking requests",
  LIBRARIAN: "Manage library venue reservation requests",
  MEDIA_INCHARGE: "Manage media equipment booking requests",
  MESS_MANAGER: "Manage food catering booking requests",
  RECEPTIONIST: "Manage general venue booking requests",
}

const SCOPED_ROLES = ["RECEPTIONIST", "LAB_INCHARGE", "LIBRARIAN"]

function Svg({ d, className = "w-5 h-5", strokeWidth = 2 }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <path d={d} />
    </svg>
  )
}

const getProfileImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `http://localhost:8000${url}`;
};

function Avatar({ name, photo, size = "lg" }) {
  const initials = (name || "?").split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("")
  const cls = size === "xl"
    ? "w-20 h-20 text-[24px] font-black"
    : size === "lg"
      ? "w-16 h-16 text-[18px] font-bold"
      : "w-10 h-10 text-[13px] font-bold"
  const imageUrl = getProfileImageUrl(photo)
  if (imageUrl) return <img src={imageUrl} alt={name} className={`${cls} rounded-full object-cover ring-2 ring-[#e8f5ee] shrink-0`} />
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-[#15803d] to-[#059669] text-white flex items-center justify-center ring-2 ring-[#e8f5ee] shrink-0`}>
      {initials}
    </div>
  )
}

export default function AdminUserProfilePage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [user, setUser] = useState(null)
  const [userLoading, setUserLoad] = useState(true)
  const backRoute = location.state?.from || "/admin/users"
  const backLabel = location.state?.fromLabel || "User Management"
  const [approvers, setApprovers] = useState([])
  const [apvLoading, setApvLoad] = useState(true)
  const [overrides, setOverrides] = useState([])
  const [_ovrLoading, setOvrLoad] = useState(true)

  // System options for assignment
  const [roles, setRoles] = useState([])
  const [spaces, setSpaces] = useState([])
  const [blocks, setBlocks] = useState([])
  const [departments, setDepartments] = useState([])

  // Modal states
  const [isAssignSpaceOpen, setIsAssignSpaceOpen] = useState(false)
  const [isGrantTemporaryOpen, setIsGrantTemporaryOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState(null) // role object
  const [scopeType, setScopeType] = useState("SPACE") // SPACE, BLOCK, GLOBAL
  const [selectedVenue, setSelectedVenue] = useState(null)
  const [selectedBlock, setSelectedBlock] = useState(null)
  const [reason, setReason] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [venueSearch, setVenueSearch] = useState("")
  const [blockSearch, setBlockSearch] = useState("")
  const [isAssigning, setIsAssigning] = useState(false)

  // Edit / delete assignment states
  const [editingApprover, setEditingApprover] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [removingApprover, setRemoving] = useState(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [revokingOverride, setRevokingOvr] = useState(null)
  const [isRevokingOvr, setIsRevokingOvr] = useState(false)

  // Tabbed layout, local edit roles modal, and pagination states
  const [activeTab, setActiveTab] = useState("personal")
  const [specialTab, setSpecialTab] = useState("active")
  const [isEditRolesOpen, setIsEditRolesOpen] = useState(false)
  const [isSavingRoles, setIsSavingRoles] = useState(false)
  const [isEditDetailsOpen, setIsEditDetailsOpen] = useState(false)
  const [isSavingDetails, setIsSavingDetails] = useState(false)
  const [detailsForm, setDetailsForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    designation: "",
    department: "",
    is_active: true
  })
  const [spacesPage, setSpacesPage] = useState(1)
  const [activeMenuId, setActiveMenuId] = useState(null)

  // Handle click outside to close menus
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null)
    }
    window.addEventListener("click", handleOutsideClick)
    return () => window.removeEventListener("click", handleOutsideClick)
  }, [])

  // Fetch initial user, roles, spaces, blocks
  useEffect(() => {
    let alive = true
    Promise.resolve().then(() => {
      if (alive) setUserLoad(true)
    })
    adminUserService.getUsers({ id: userId })
      .then(data => {
        if (!alive) return
        const list = normalise(data)
        const found = list.find(u => String(u.id) === String(userId)) ?? list[0] ?? null
        setUser(found)
      })
      .catch(() => toast.error("Could not load user details."))
      .finally(() => { if (alive) setUserLoad(false) })

    roleOverrideService.getRoles().then(r => setRoles(normalise(r))).catch(() => { })
    roleOverrideService.getSpaces().then(s => setSpaces(normalise(s))).catch(() => { })
    roleOverrideService.getBlocks().then(b => setBlocks(normalise(b))).catch(() => { })
    api.get("/auth/departments/").then(res => {
      if (alive) setDepartments(normalise(res.data))
    }).catch(() => { })

    return () => { alive = false }
  }, [userId])

  // Fetch approvers & overrides
  const fetchAssignments = useCallback(() => {
    Promise.resolve().then(() => {
      setApvLoad(true)
      setOvrLoad(true)
    })
    spaceAdminService.getApprovers({ user: userId })
      .then(data => setApprovers(normalise(data)))
      .catch(() => { })
      .finally(() => setApvLoad(false))

    roleOverrideService.getOverrides()
      .then(data => {
        const filtered = normalise(data).filter(o => String(o.user) === String(userId))
        setOverrides(filtered)
      })
      .catch(() => { })
      .finally(() => setOvrLoad(false))
  }, [userId])

  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email
    : ""

  // Filter valid roles for resource/venue management
  const validRoles = useMemo(() => {
    const list = ["RECEPTIONIST", "LAB_INCHARGE", "LIBRARIAN", "MEDIA_INCHARGE", "FLEET_MANAGER", "MESS_MANAGER"]
    return roles.filter(r => list.includes(r.name))
  }, [roles])

  // Filtered lists for picker search
  const filteredSpaces = useMemo(() => {
    const q = venueSearch.toLowerCase().trim()
    if (!q) return spaces
    return spaces.filter(s => s.name?.toLowerCase().includes(q) || s.room_number?.toLowerCase().includes(q))
  }, [spaces, venueSearch])

  const filteredBlocks = useMemo(() => {
    const q = blockSearch.toLowerCase().trim()
    if (!q) return blocks
    return blocks.filter(b => b.name?.toLowerCase().includes(q) || b.code?.toLowerCase().includes(q))
  }, [blocks, blockSearch])

  const handleSaveRoles = async (userId, roleIds) => {
    setIsSavingRoles(true)
    try {
      const updated = await adminUserService.setRoles(userId, roleIds)
      setUser(updated)
      setIsEditRolesOpen(false)
      toast.success("User roles updated successfully.")
    } catch (err) {
      toast.error(err.response?.data?.roles || "Could not update user roles. Please try again.")
    } finally {
      setIsSavingRoles(false)
    }
  }

  // Spaces pagination helper
  const SPACES_PAGE_SIZE = 5
  const paginatedApprovers = useMemo(() => {
    return approvers.slice((spacesPage - 1) * SPACES_PAGE_SIZE, spacesPage * SPACES_PAGE_SIZE)
  }, [approvers, spacesPage])

  // Memoized subgroups for Roles & Permissions Tab
  const baseIdentity = useMemo(() => (user?.role_details ?? []).filter(r => ['STUDENT', 'FACULTY', 'STAFF'].includes(r.name)), [user])
  const scopedRoles = useMemo(() => (user?.role_details ?? []).filter(r => ['RECEPTIONIST', 'LAB_INCHARGE', 'LIBRARIAN'].includes(r.name)), [user])
  const moduleManagers = useMemo(() => (user?.role_details ?? []).filter(r => ['MESS_MANAGER', 'MEDIA_INCHARGE', 'FLEET_MANAGER'].includes(r.name)), [user])
  const systemRoles = useMemo(() => (user?.role_details ?? []).filter(r => ['IT_ADMIN', 'HOD', 'PRINCIPAL'].includes(r.name)), [user])



  // Handle permanent space/block assignment
  const handleAssignSpace = async () => {
    if (!selectedRole || (scopeType === "SPACE" && !selectedVenue) || (scopeType === "BLOCK" && !selectedBlock)) {
      toast.error("Please fill in all required fields.")
      return
    }
    setIsAssigning(true)
    try {
      const payload = {
        user: parseInt(userId, 10),
        role: parseInt(selectedRole.id, 10),
        scope_type: scopeType
      }
      if (scopeType === "SPACE") {
        payload.space = parseInt(selectedVenue.id, 10)
      } else {
        payload.block = parseInt(selectedBlock.id, 10)
      }
      await spaceAdminService.createApprover(payload)
      toast.success("Venue assignment created successfully.")
      setIsAssignSpaceOpen(false)
      fetchAssignments()
      // Reset
      setSelectedRole(null)
      setSelectedVenue(null)
      setSelectedBlock(null)
      setVenueSearch("")
      setBlockSearch("")
    } catch (err) {
      const data = err.response?.data
      const rawError = data?.non_field_errors?.[0] || data?.user?.[0] || data?.error
      const msg = rawError?.includes("unique set")
        ? "This assignment already exists for this user."
        : rawError || "Failed to create assignment. Please try again."
      toast.error(msg)
    } finally {
      setIsAssigning(false)
    }
  }

  // Handle temporary permission override delegation
  const handleGrantTemporary = async () => {
    if (!selectedRole || !reason.trim() || !validUntil) {
      toast.error("Please fill in all required fields.")
      return
    }
    if (scopeType === "SPACE" && !selectedVenue) {
      toast.error("Please select a venue.")
      return
    }
    if (scopeType === "BLOCK" && !selectedBlock) {
      toast.error("Please select a block.")
      return
    }

    setIsAssigning(true)
    try {
      const payload = {
        user: parseInt(userId, 10),
        role: parseInt(selectedRole.id, 10),
        valid_until: new Date(validUntil).toISOString(),
        reason: reason.trim()
      }
      if (scopeType === "BLOCK") {
        payload.block = String(selectedBlock.id)
      } else if (scopeType === "SPACE") {
        payload.space = parseInt(selectedVenue.id, 10)
      }
      await roleOverrideService.grantOverride(payload)
      toast.success("Temporary assignment created successfully.")
      setIsGrantTemporaryOpen(false)
      fetchAssignments()
      // Reset
      setSelectedRole(null)
      setScopeType("SPACE")
      setSelectedVenue(null)
      setSelectedBlock(null)
      setReason("")
      setValidUntil("")
      setVenueSearch("")
      setBlockSearch("")
    } catch (err) {
      const data = err.response?.data
      const rawError = data?.non_field_errors?.[0] || data?.user?.[0] || data?.error
      const msg = rawError?.includes("unique set")
        ? "This temporary access already exists for this user."
        : rawError || "Failed to create temporary access. Please try again."
      toast.error(msg)
    } finally {
      setIsAssigning(false)
    }
  }

  // Handle Remove Approver
  const handleConfirmRemove = async () => {
    setIsRemoving(true)
    try {
      await spaceAdminService.deleteApprover(removingApprover.id)
      toast.success("Venue assignment removed.")
      setRemoving(null)
      fetchAssignments()
    } catch {
      toast.error("Failed to remove assignment.")
    } finally {
      setIsRemoving(false)
    }
  }

  // Handle Revoke Delegation
  const handleConfirmRevoke = async () => {
    setIsRevokingOvr(true)
    try {
      await roleOverrideService.revokeOverride(revokingOverride.id)
      toast.success("Temporary access removed successfully.")
      setRevokingOvr(null)
      fetchAssignments()
    } catch {
      toast.error("Failed to remove temporary access.")
    } finally {
      setIsRevokingOvr(false)
    }
  }

  // Handle Edit Approver Submit
  const handleEditConfirm = async (e) => {
    e.preventDefault()
    setIsEditing(true)
    try {
      const selectedRoleId = e.target.role.value
      const isActive = e.target.isActive.checked
      await spaceAdminService.updateApprover(editingApprover.id, {
        role: parseInt(selectedRoleId, 10),
        is_active: isActive
      })
      toast.success("Assignment updated.")
      setEditingApprover(null)
      fetchAssignments()
    } catch {
      toast.error("Failed to update assignment.")
    } finally {
      setIsEditing(false)
    }
  }

  const handleOpenEditDetails = () => {
    setDetailsForm({
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      designation: user?.designation || "",
      department: user?.department || "",
      is_active: user?.is_active ?? true
    })
    setIsEditDetailsOpen(true)
  }

  const handleSaveDetails = async (e) => {
    e.preventDefault()
    setIsSavingDetails(true)
    try {
      const payload = {
        first_name: detailsForm.first_name,
        last_name: detailsForm.last_name,
        email: detailsForm.email,
        phone: detailsForm.phone,
        designation: detailsForm.designation,
        department: detailsForm.department ? parseInt(detailsForm.department, 10) : null,
        is_active: detailsForm.is_active
      }
      const res = await api.patch(`/auth/admin-users/${userId}/`, payload)
      setUser(res.data)
      setIsEditDetailsOpen(false)
      toast.success("User details updated successfully.")
    } catch (err) {
      const errData = err.response?.data
      let errMsg = ""
      if (errData) {
        if (errData.email) {
          errMsg = `Email error: ${Array.isArray(errData.email) ? errData.email.join(", ") : errData.email}`
        } else {
          const keys = Object.keys(errData)
          if (keys.length > 0) {
            const firstVal = errData[keys[0]]
            errMsg = Array.isArray(firstVal) ? firstVal.join(", ") : firstVal
          }
        }
      }
      toast.error(errMsg || "Could not update user details. Please try again.")
    } finally {
      setIsSavingDetails(false)
    }
  }

  if (userLoading) {
    return (
      <div className="min-h-full bg-[#f6fbf8] flex items-center justify-center p-10">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-[#15803d]/20 border-t-[#15803d] animate-spin" />
          <p className="text-[13.5px] font-semibold text-[#6b7280]">Loading profile…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-full bg-[#f6fbf8] flex items-center justify-center p-10">
        <div className="text-center">
          <p className="text-[16px] font-bold text-[#0f172a]">User not found</p>
          <button onClick={() => navigate(backRoute)}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d] text-white text-[13.5px] font-bold hover:bg-[#166534] transition">
            ← Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#f6fbf8] p-6 md:p-8">
      <div className="max-w-[1100px] mx-auto space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(backRoute)}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#6b7280] hover:text-[#15803d] transition">
            <Svg d="M15 18l-6-6 6-6" className="w-4 h-4" />
            {backLabel}
          </button>
          <span className="text-[#d1d5db]">/</span>
          <span className="text-[13px] font-semibold text-[#0f172a] truncate max-w-[220px]">{displayName}</span>
        </div>

        {/* Persistent User Profile Header Card (Hero Section) */}
        <div className="bg-white rounded-2xl border border-[#e8f5ee] px-6 py-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Left: Avatar */}
            <Avatar name={displayName} photo={user.profile_image} size="xl" />
            {/* Center: Identity details */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5 items-center mb-1">
                {user.designation && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-slate-50 text-slate-700 border-slate-200">
                    {user.designation}
                  </span>
                )}
                {user.department_name && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-green-50 text-[#15803d] border-green-200">
                    {user.department_name}
                  </span>
                )}
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${user.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                  {user.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <h1 className="text-[20px] font-extrabold text-[#0f172a] leading-tight truncate">{displayName}</h1>
              <div className="flex items-center gap-1.5 text-[12.5px] text-[#475569] mt-0.5">
                <Svg d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" className="w-3.5 h-3.5 text-[#94a3b8]" />
                <span>{user.email}</span>
              </div>
              {/* Role Badges */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(user.role_details ?? []).map(r => (
                  <span key={r.id}
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${ROLE_COLOR[r.name] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                    {getRoleDisplayName(r)}
                  </span>
                ))}
              </div>
            </div>
            {/* Right: Actions */}
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleOpenEditDetails}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#e2e8f0] text-[13px] font-bold text-[#374151] bg-white hover:bg-gray-50 transition"
              >
                <Svg d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z" className="w-3.5 h-3.5 text-gray-500" />
                Edit Details
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16M9 21V11h6v10", color: "bg-blue-50 text-blue-600 border-blue-100", label: "Managed Venues", value: apvLoading ? null : approvers.length },
            { icon: "M9 12l2 2 4-4", color: "bg-green-50 text-[#15803d] border-green-100", label: "Active Assignments", value: apvLoading ? null : approvers.filter(a => a.is_active).length },
            { icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", color: "bg-purple-50 text-purple-600 border-purple-100", label: "Assigned Roles", value: userLoading ? null : (user?.role_details ?? []).length },
            { icon: "M7 11V7a5 5 0 0110 0v4M5 11h14v10H5z", color: "bg-amber-50 text-amber-600 border-amber-100", label: "Temporary Accesses", value: _ovrLoading ? null : overrides.length },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-[#e8f5ee] rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${s.color}`}>
                <Svg d={s.icon} className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#94a3b8] mb-0.5">{s.label}</p>
                {s.value === null
                  ? <span className="inline-block w-4 h-4 rounded-full border-2 border-[#15803d]/20 border-t-[#15803d] animate-spin" />
                  : <p className="text-[16px] font-black text-[#0f172a] leading-tight">{s.value}</p>
                }
              </div>
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-white rounded-t-2xl border border-[#e8f5ee] overflow-hidden">
          {[
            { id: "personal", label: "Personal Details", path: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
            { id: "spaces", label: "Managed Venues", path: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16M9 21V11h6v10" },
            { id: "roles", label: "Roles & Permissions", path: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
            { id: "special", label: "Special Access", path: "M7 11V7a5 5 0 0110 0v4M5 11h14v10H5z" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5
                text-[13px] font-bold transition border-b-2
                ${activeTab === tab.id
                  ? "border-[#15803d] text-[#15803d] bg-white"
                  : "border-transparent text-[#6b7280] hover:text-[#374151] hover:bg-[#f6fbf8]"
                }`}
            >
              <Svg d={tab.path} className="w-4 h-4" />
              <span>{tab.label}</span>

              {tab.id === "spaces" && approvers.length > 0 && !apvLoading && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#15803d] text-white text-[10px] font-bold">
                  {approvers.length}
                </span>
              )}
              {tab.id === "roles" && (user?.role_details ?? []).length > 0 && !userLoading && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#475569] text-white text-[10px] font-bold">
                  {(user?.role_details ?? []).length}
                </span>
              )}
              {tab.id === "special" && overrides.length > 0 && !_ovrLoading && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#475569] text-white text-[10px] font-bold">
                  {overrides.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Contents Frame */}
        <div className="bg-white rounded-b-2xl border border-[#e8f5ee] border-t-0 overflow-hidden shadow-sm">
          {/* Tab 1 — Personal Details */}
          {activeTab === "personal" && (
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#94a3b8] mb-0.5">Overview</p>
                <h2 className="text-[17px] font-bold text-[#0f172a]">Personal Details</h2>
                <p className="text-[12.5px] text-[#6b7280]">Comprehensive profile information for this user account.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <DetailItem label="Full Name" value={displayName} />
                <DetailItem label="Email" value={user.email} />
                <DetailItem label="Phone" value={user.phone} />
                <DetailItem label="Department" value={user.department_name} />
                <DetailItem label="Designation" value={user.designation} />
                <DetailItem label="Account Status" value={user.is_active ? "Active" : "Inactive"} />
                <DetailItem label="Created Date" value={user.date_joined ? new Date(user.date_joined).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"} />
                <DetailItem label="Last Login" value={user.last_login ? new Date(user.last_login).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"} />
              </div>
            </div>
          )}

          {/* Tab 2 — Managed Spaces */}
          {activeTab === "spaces" && (
            <div>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#e8f5ee]">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#94a3b8] mb-0.5">Managed Resources</p>
                  <h2 className="text-[17px] font-bold text-[#0f172a]">Managed Venues</h2>
                  <p className="text-[12.5px] text-[#6b7280] mt-0.5">Venues and blocks where this user has approval authority.</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedRole(null)
                    setScopeType("SPACE")
                    setSelectedVenue(null)
                    setSelectedBlock(null)
                    setVenueSearch("")
                    setBlockSearch("")
                    setIsAssignSpaceOpen(true)
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-[13px] font-bold transition shadow-sm shrink-0"
                >
                  <Svg d="M12 4v16m8-8H4" className="w-4 h-4" strokeWidth={2.5} />
                  Assign Venue
                </button>
              </div>

              {/* Spaces List */}
              <div className="p-6 space-y-4">
                {apvLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-20 rounded-2xl bg-[#f6fbf8] border border-[#e8f5ee] animate-pulse" />
                    ))}
                  </div>
                ) : approvers.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="w-14 h-14 rounded-full bg-[#f0fdf4] flex items-center justify-center mx-auto mb-4 text-[#15803d]">
                      <Svg d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16M9 21V11h6v10" className="w-7 h-7" />
                    </div>
                    <p className="text-[14.5px] font-bold text-[#374151]">No managed venues assigned</p>
                    <p className="text-[13px] text-[#94a3b8] mt-1 max-w-[320px] mx-auto">
                      Assign a venue or block to grant this user venue management approvals.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedRole(null)
                        setScopeType("SPACE")
                        setSelectedVenue(null)
                        setSelectedBlock(null)
                        setVenueSearch("")
                        setBlockSearch("")
                        setIsAssignSpaceOpen(true)
                      }}
                      className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-[13.5px] font-bold transition shadow-sm"
                    >
                      <Svg d="M12 4v16m8-8H4" className="w-4 h-4" strokeWidth={2.5} />
                      Assign Space
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {paginatedApprovers.map(a => {
                        const isBlock = a.scope_type === "BLOCK"
                        return isBlock ? (
                          /* Block Card */
                          <div key={a.id} className="relative flex flex-col justify-between p-5 bg-white rounded-2xl border border-[#e8f5ee] hover:shadow-md transition group">
                            <div>
                              {/* Header with Title and Three-Dots Menu */}
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16M9 21V11h6v10" />
                                    </svg>
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="text-[15px] font-extrabold text-[#0f172a] truncate" title={a.block_name || `Block #${a.block}`}>
                                      {a.block_name || `Block #${a.block}`}
                                    </h3>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mt-0.5">
                                      Block Wide Scope
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Three-dots menu button */}
                                <div className="relative shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuId(prev => prev === a.id ? null : a.id);
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
                                  >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                    </svg>
                                  </button>

                                  {activeMenuId === a.id && (
                                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-20 animate-in fade-in slide-in-from-top-2 duration-100 text-left" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingApprover(a);
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 transition font-medium"
                                      >
                                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z" />
                                        </svg>
                                        Edit Assignment
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRemoving(a);
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-[13px] text-red-600 hover:bg-red-50 transition font-bold border-t border-slate-100"
                                      >
                                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Remove Block
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Body Details */}
                              <div className="mt-5 space-y-3 pt-3 border-t border-[#f8fafc]">
                                <div className="flex justify-between items-center text-[12.5px]">
                                  <span className="text-[#94a3b8] font-semibold">Assigned Role</span>
                                  <span className="text-[#374151] font-bold bg-[#f1f5f9] px-2 py-0.5 rounded-lg text-[11.5px]">
                                    {a.role_display || getRoleDisplayName(a.role)}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[12.5px]">
                                  <span className="text-[#94a3b8] font-semibold">Assigned On</span>
                                  <span className="text-[#374151] font-bold">
                                    {new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[12.5px]">
                                  <span className="text-[#94a3b8] font-semibold">Status</span>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${a.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                                    {a.is_active ? "Active" : "Inactive"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Venue Card with Image (No overflow-hidden on outer container) */
                          <div key={a.id} className="relative flex flex-col bg-white rounded-2xl border border-[#e8f5ee] hover:shadow-md transition group">
                            {/* More menu trigger on top of image (Outside overflow-hidden container to prevent clipping) */}
                            <div className="absolute top-2.5 right-2.5 z-20">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(prev => prev === a.id ? null : a.id);
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white text-slate-600 hover:text-slate-800 transition"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                </svg>
                              </button>

                              {activeMenuId === a.id && (
                                <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-100 text-left" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigate(`/admin/spaces/venues/${a.space}`, { state: { from: window.location.pathname + window.location.search, fromLabel: `${displayName}'s Profile` } });
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 transition font-medium"
                                  >
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    View Venue
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingApprover(a);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 transition font-medium"
                                  >
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z" />
                                    </svg>
                                    Edit Assignment
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRemoving(a);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-[13px] text-red-600 hover:bg-red-50 transition font-bold border-t border-slate-100"
                                  >
                                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Remove Venue
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Image Header (overflow-hidden on header itself) */}
                            <div className="relative h-36 bg-[#f0fdf4] overflow-hidden shrink-0 rounded-t-2xl">
                              {a.space_image ? (
                                <img
                                  src={getProfileImageUrl(a.space_image)}
                                  alt={a.space_name}
                                  loading="lazy"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[#d1fae5]">
                                  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
                                    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 8h.01M15 8h.01M9 13h.01M15 13h.01" />
                                  </svg>
                                </div>
                              )}

                              {/* Badges Overlays */}
                              <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-[#dcfce7] text-[#14532d] border-[#bbf7d0]">
                                  Venue Specific
                                </span>
                              </div>
                            </div>

                            {/* Body */}
                            <div className="p-4 flex flex-col flex-1 gap-3.5">
                              <div>
                                <h3 className="text-[15px] font-extrabold text-[#0f172a] leading-tight tracking-tight truncate" title={a.space_name || `Venue #${a.space}`}>
                                  {a.space_name || `Venue #${a.space}`}
                                </h3>
                                <p className="text-[12.5px] text-[#6b7280] font-semibold mt-0.5">
                                  Role: {a.role_display || getRoleDisplayName(a.role)}
                                </p>
                              </div>

                              <div className="space-y-2 pt-2 border-t border-[#f8fafc] mt-auto">
                                <div className="flex justify-between items-center text-[12px]">
                                  <span className="text-[#94a3b8] font-semibold">Assigned On</span>
                                  <span className="text-[#374151] font-bold">
                                    {new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[12px]">
                                  <span className="text-[#94a3b8] font-semibold">Status</span>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${a.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                                    {a.is_active ? "Active" : "Inactive"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Pagination */}
                    {approvers.length > 5 && (
                      <div className="flex items-center justify-between border-t border-[#f1f5f9] px-2 py-4 mt-6">
                        <button
                          disabled={spacesPage === 1}
                          onClick={() => setSpacesPage(prev => Math.max(1, prev - 1))}
                          className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-[12px] font-semibold text-[#374151] hover:bg-gray-50 transition disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="text-[12px] font-medium text-[#6b7280]">
                          Page {spacesPage} of {Math.ceil(approvers.length / 5)}
                        </span>
                        <button
                          disabled={spacesPage === Math.ceil(approvers.length / 5)}
                          onClick={() => setSpacesPage(prev => Math.min(Math.ceil(approvers.length / 5), prev + 1))}
                          className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-[12px] font-semibold text-[#374151] hover:bg-gray-50 transition disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tab 3 — Roles & Permissions */}
          {activeTab === "roles" && (
            <div className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e8f5ee] pb-4">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#94a3b8] mb-0.5">Authority Matrix</p>
                  <h2 className="text-[17px] font-bold text-[#0f172a]">Roles &amp; Permissions</h2>
                  <p className="text-[12.5px] text-[#6b7280]">Assigned roles and authority boundaries for this account.</p>
                </div>
                <button
                  onClick={() => setIsEditRolesOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-[13px] font-bold transition shadow-sm shrink-0"
                >
                  <Svg d="M12 4v16m8-8H4" className="w-4 h-4" strokeWidth={2.5} />
                  Add / Edit Roles
                </button>
              </div>

              <div className="space-y-6">
                {[
                  { title: "Base Identity", items: baseIdentity, path: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", desc: "Institutional core identification role" },
                  { title: "Scoped Roles (Venue Specific)", items: scopedRoles, path: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16M9 21V11h6v10", desc: "Venue-specific approval and management roles" },
                  { title: "Module Managers (Catering, Transport, etc.)", items: moduleManagers, path: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", desc: "Departmental resources and module manager permissions" },
                  { title: "System Roles", items: systemRoles, path: "M7 11V7a5 5 0 0110 0v4M5 11h14v10H5z", desc: "Global administrative or executive oversight permissions" },
                ].map(group => (
                  <div key={group.title} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Svg d={group.path} className="w-4 h-4 text-[#15803d]" />
                      <h3 className="text-[12.5px] font-extrabold uppercase tracking-wider text-[#475569]">{group.title}</h3>
                    </div>
                    {group.items.length === 0 ? (
                      <div className="border border-dashed border-[#e8f5ee] rounded-xl p-4 bg-[#f6fbf8]/10 text-[13px] text-[#94a3b8] italic">
                        No roles active in this category
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {group.items.map(role => (
                          <div key={role.id} className="flex items-center justify-between gap-4 px-5 py-4 bg-white rounded-xl border border-[#e8f5ee] hover:shadow-sm transition group">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-[14.5px] font-bold text-[#0f172a] leading-tight">
                                {role.name === 'FLEET_MANAGER' ? 'Transport Manager' : (role.display_name || role.name)}
                              </h4>
                              <p className="text-[12.5px] text-[#6b7280] mt-1.5 leading-relaxed">
                                {role.description || getRoleDescription(role.name) || "Provides access and permissions matching this role."}
                              </p>
                              <p className="text-[11px] text-[#94a3b8] mt-2">
                                Assigned: <span className="font-semibold text-gray-600">{user.date_joined ? new Date(user.date_joined).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "System Default"}</span>
                              </p>
                            </div>
                            <div className="shrink-0 flex flex-col items-end">
                              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-white ${ROLE_COLOR[role.name] ?? "text-gray-600 border-gray-200"}`}>
                                {role.name}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4 — Special Access */}
          {activeTab === "special" && (
            <div>
              {/* Header and Grant Button */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#e8f5ee]">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#94a3b8] mb-0.5">Privilege Escalation</p>
                  <h2 className="text-[17px] font-bold text-[#0f172a]">Special Access</h2>
                  <p className="text-[12.5px] text-[#6b7280] mt-0.5">Temporary access delegations and override configurations.</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedRole(null)
                    setScopeType("GLOBAL") // Default to Global for delegation
                    setSelectedVenue(null)
                    setSelectedBlock(null)
                    setReason("")
                    setValidUntil("")
                    setVenueSearch("")
                    setBlockSearch("")
                    setIsGrantTemporaryOpen(true)
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-[13px] font-bold transition shadow-sm shrink-0"
                >
                  <Svg d="M12 4v16m8-8H4" className="w-4 h-4" strokeWidth={2.5} />
                  Grant Temporary Access
                </button>
              </div>

              {/* Sub-tab Swapper */}
              <div className="flex px-6 border-b border-[#e8f5ee] bg-[#fafafa]">
                {[
                  { id: "active", label: "Active Temporary Access", count: overrides.filter(o => o.is_active && new Date(o.valid_until) >= new Date()).length },
                  { id: "history", label: "Temporary Access History", count: overrides.length },
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setSpecialTab(sub.id)}
                    className={`px-4 py-3 text-[12.5px] font-bold transition-all border-b-2 -mb-px flex items-center gap-1.5 ${
                      specialTab === sub.id
                        ? "border-[#15803d] text-[#15803d]"
                        : "border-transparent text-[#6b7280] hover:text-[#0f172a]"
                    }`}
                  >
                    {sub.label}
                    {sub.count > 0 && (
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                        specialTab === sub.id ? "bg-[#15803d] text-white" : "bg-gray-200 text-gray-600"
                      }`}>
                        {sub.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Sub-tab Content */}
              <div className="p-6">
                {specialTab === "active" && (
                  <div className="space-y-4">
                    {overrides.filter(o => o.is_active && new Date(o.valid_until) >= new Date()).length === 0 ? (
                      <div className="py-16 text-center">
                        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4 text-amber-600">
                          <Svg d="M7 11V7a5 5 0 0110 0v4M5 11h14v10H5z" className="w-7 h-7" />
                        </div>
                        <p className="text-[14.5px] font-bold text-[#374151]">No active temporary access</p>
                        <p className="text-[13px] text-[#94a3b8] mt-1 max-w-[320px] mx-auto">
                          Click <strong className="text-amber-600">Grant Temporary Access</strong> to assign temporary delegation scopes to this user.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {overrides.filter(o => o.is_active && new Date(o.valid_until) >= new Date()).map(o => (
                          <div key={o.id} className="flex flex-col justify-between p-5 bg-white rounded-2xl border border-[#e8f5ee] hover:shadow-sm transition">
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <h4 className="text-[15.5px] font-extrabold text-[#0f172a]">
                                    {o.role_name}
                                  </h4>
                                  <p className="text-[12.5px] font-semibold text-[#15803d] mt-0.5">
                                    {o.scope_type === "SPACE" && o.space_name ? `Venue: ${o.space_name}` :
                                      o.scope_type === "BLOCK" && o.block_name ? `Block: ${o.block_name}` :
                                        "Global Delegation"}
                                  </p>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Active
                                </span>
                              </div>

                              <div className="space-y-2.5 mt-4 pt-3.5 border-t border-[#f1f5f9] text-[12.5px] text-[#475569]">
                                <div className="flex justify-between">
                                  <span className="text-gray-400 font-medium">Valid Until:</span>
                                  <span className="font-bold text-gray-900">
                                    {new Date(o.valid_until).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                {o.reason && (
                                  <div className="flex flex-col gap-1 pt-2 border-t border-[#f8fafc]">
                                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-gray-400">Reason</span>
                                    <p className="text-gray-600 bg-slate-50/50 p-2 rounded-lg border border-slate-100 text-[12px] italic">
                                      "{o.reason}"
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-5 pt-3.5 border-t border-[#f1f5f9] flex justify-end">
                              <button
                                onClick={() => setRevokingOvr(o)}
                                className="px-3.5 py-1.5 rounded-xl bg-red-50 text-red-600 text-[12px] font-bold hover:bg-red-100 border border-red-100 transition"
                              >
                                Revoke Access
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {specialTab === "active" && overrides.filter(o => o.is_active && new Date(o.valid_until) >= new Date()).length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between px-6">
                    <p className="text-[12.5px] text-[#6b7280]">
                      Showing active delegation profiles. See full log under the <strong className="text-gray-700">Temporary Access History</strong> tab.
                    </p>
                  </div>
                )}

                {specialTab === "history" && (
                  <TemporaryAccessHistoryTab
                    overrides={overrides}
                    onRevoke={setRevokingOvr}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Assign Managed Space Modal ── */}
      {isAssignSpaceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#f1f5f9] bg-[#f6fbf8] flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#15803d]">Assign Responsibility</p>
                <h3 className="text-[16px] font-bold text-[#0f172a]">Assign Managed Space</h3>
              </div>
              <button 
                onClick={() => {
                  setIsAssignSpaceOpen(false)
                  setSelectedRole(null)
                  setSelectedVenue(null)
                  setSelectedBlock(null)
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              
              {/* Step 1: Select Role */}
              <div className="space-y-2">
                <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[#94a3b8]">1. Select Role</label>
                <div className="grid grid-cols-1 gap-2">
                  {roles.filter(r => SCOPED_ROLES.includes(r.name)).map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedRole(r)
                        // If role changes, reset selections to be safe
                        setSelectedVenue(null)
                        setSelectedBlock(null)
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between
                        ${selectedRole?.id === r.id 
                          ? "border-[#15803d] bg-[#f6fbf8] shadow-sm" 
                          : "border-[#e2e8f0] hover:border-[#15803d] hover:bg-[#f6fbf8]/40"}`}
                    >
                      <div className="flex-1 pr-2">
                        <p className="text-[13.5px] font-bold text-[#0f172a]">{getRoleDisplayName(r)}</p>
                        <p className="text-[11.5px] text-[#6b7280] mt-0.5">{ROLE_DESCRIPTIONS[r.name] || r.name}</p>
                      </div>
                      {selectedRole?.id === r.id && (
                        <div className="w-5 h-5 rounded-full bg-[#15803d] flex items-center justify-center text-white shrink-0">
                          <Svg d="M5 13l4 4L19 7" className="w-3 h-3" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Select Scope */}
              {selectedRole && (
                <div className="space-y-2 animate-fadeIn">
                  <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[#94a3b8]">2. Select Scope</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "SPACE", label: "Venue Specific", desc: "Single venue approval" },
                      { key: "BLOCK", label: "Block Wide", desc: "Whole block approval" }
                    ].map(s => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => {
                          setScopeType(s.key)
                          setSelectedVenue(null)
                          setSelectedBlock(null)
                        }}
                        className={`text-left p-3 rounded-xl border transition flex flex-col justify-between
                          ${scopeType === s.key 
                            ? "border-[#15803d] bg-[#f6fbf8] shadow-sm" 
                            : "border-[#e2e8f0] hover:border-gray-300"}`}
                      >
                        <p className="text-[13px] font-bold text-[#0f172a]">{s.label}</p>
                        <p className="text-[11px] text-[#6b7280] mt-0.5">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Choose Space / Block */}
              {selectedRole && scopeType === "SPACE" && (
                <div className="space-y-2 animate-fadeIn">
                  <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[#94a3b8]">3. Select Venue</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full border border-[#e2e8f0] rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-[#15803d] focus:ring-1 focus:ring-[#15803d]"
                      placeholder="Search Venue..."
                      value={venueSearch}
                      onChange={(e) => setVenueSearch(e.target.value)}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Svg d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="border border-[#e8f5ee] rounded-xl max-h-40 overflow-y-auto divide-y divide-gray-100 bg-white">
                    {filteredSpaces.length === 0 ? (
                      <p className="p-3 text-xs text-gray-500 text-center">No venues found</p>
                    ) : (
                      filteredSpaces.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedVenue(s)}
                          className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#f6fbf8] transition flex items-center justify-between
                            ${selectedVenue?.id === s.id ? "bg-[#f0fdf4] font-semibold text-[#15803d]" : "text-[#374151]"}`}
                        >
                          <div>
                            <p className="font-bold text-[#0f172a]">{s.name}</p>
                            <p className="text-[11px] text-[#6b7280]">Room: {s.room_number || "—"} • Capacity: {s.capacity_hard ?? "—"}</p>
                          </div>
                          {selectedVenue?.id === s.id && (
                            <Svg d="M5 13l4 4L19 7" className="w-4 h-4 text-[#15803d]" strokeWidth={2.5} />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {selectedRole && scopeType === "BLOCK" && (
                <div className="space-y-2 animate-fadeIn">
                  <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[#94a3b8]">3. Select Block</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full border border-[#e2e8f0] rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-[#15803d] focus:ring-1 focus:ring-[#15803d]"
                      placeholder="Search Block..."
                      value={blockSearch}
                      onChange={(e) => setBlockSearch(e.target.value)}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Svg d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="border border-[#e8f5ee] rounded-xl max-h-40 overflow-y-auto divide-y divide-gray-100 bg-white">
                    {filteredBlocks.length === 0 ? (
                      <p className="p-3 text-xs text-gray-500 text-center">No blocks found</p>
                    ) : (
                      filteredBlocks.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBlock(b)}
                          className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#f6fbf8] transition flex items-center justify-between
                            ${selectedBlock?.id === b.id ? "bg-[#f0fdf4] font-semibold text-[#15803d]" : "text-[#374151]"}`}
                        >
                          <div>
                            <p className="font-bold text-[#0f172a]">{b.name}</p>
                            <p className="text-[11px] text-[#6b7280]">Code: {b.code}</p>
                          </div>
                          {selectedBlock?.id === b.id && (
                            <Svg d="M5 13l4 4L19 7" className="w-4 h-4 text-[#15803d]" strokeWidth={2.5} />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#f1f5f9] bg-[#fafafa] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsAssignSpaceOpen(false)
                  setSelectedRole(null)
                  setSelectedVenue(null)
                  setSelectedBlock(null)
                }}
                className="px-4 py-2 rounded-xl border border-[#e2e8f0] text-[13px] font-semibold text-[#374151] hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAssigning || !selectedRole || (scopeType === "SPACE" && !selectedVenue) || (scopeType === "BLOCK" && !selectedBlock)}
                onClick={handleAssignSpace}
                className="px-4 py-2 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-[13px] font-bold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isAssigning ? "Assigning..." : "Assign Space"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Grant Temporary Access Modal ── */}
      {isGrantTemporaryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#f1f5f9] bg-[#f6fbf8] flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#15803d]">Privilege Escalation</p>
                <h3 className="text-[16px] font-bold text-[#0f172a]">Grant Temporary Access</h3>
              </div>
              <button 
                onClick={() => {
                  setIsGrantTemporaryOpen(false)
                  setSelectedRole(null)
                  setSelectedVenue(null)
                  setSelectedBlock(null)
                  setReason("")
                  setValidUntil("")
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              
              {/* Role Selector */}
              <div className="space-y-1">
                <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[#94a3b8]">Select Role *</label>
                <select
                  required
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#15803d] focus:border-[#15803d] transition"
                  value={selectedRole?.id || ""}
                  onChange={(e) => {
                    const r = roles.find(role => String(role.id) === String(e.target.value))
                    setSelectedRole(r)
                    if (r && SCOPED_ROLES.includes(r.name)) {
                      setScopeType("SPACE")
                    } else {
                      setScopeType("GLOBAL")
                    }
                    setSelectedVenue(null)
                    setSelectedBlock(null)
                  }}
                >
                  <option value="" disabled>-- Select a Role --</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {getRoleDisplayName(r)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scope Selection */}
              {selectedRole && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[#94a3b8]">Scope *</label>
                  {SCOPED_ROLES.includes(selectedRole.name) ? (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: "SPACE", label: "Venue" },
                        { key: "BLOCK", label: "Block" },
                        { key: "GLOBAL", label: "Global" }
                      ].map(s => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => {
                            setScopeType(s.key)
                            setSelectedVenue(null)
                            setSelectedBlock(null)
                          }}
                          className={`py-2 px-3 text-[12.5px] font-bold rounded-xl border text-center transition
                            ${scopeType === s.key 
                              ? "border-[#15803d] bg-[#f6fbf8] text-[#15803d]" 
                              : "border-[#e2e8f0] hover:border-gray-300 text-gray-600"}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-medium">
                      This is a global role. Scope is automatically set to <strong className="text-slate-800">Global Scope</strong>.
                    </div>
                  )}
                </div>
              )}

              {/* Search Space / Block */}
              {selectedRole && SCOPED_ROLES.includes(selectedRole.name) && scopeType === "SPACE" && (
                <div className="space-y-2 animate-fadeIn">
                  <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[#94a3b8]">Select Venue *</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full border border-[#e2e8f0] rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-[#15803d]"
                      placeholder="Search Venue..."
                      value={venueSearch}
                      onChange={(e) => setVenueSearch(e.target.value)}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Svg d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="border border-[#e8f5ee] rounded-xl max-h-36 overflow-y-auto divide-y divide-gray-100 bg-white">
                    {filteredSpaces.length === 0 ? (
                      <p className="p-3 text-xs text-gray-500 text-center">No venues found</p>
                    ) : (
                      filteredSpaces.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedVenue(s)}
                          className={`w-full text-left px-3.5 py-2 hover:bg-[#f6fbf8] text-[12.5px] transition flex items-center justify-between
                            ${selectedVenue?.id === s.id ? "bg-[#f0fdf4] font-semibold text-[#15803d]" : "text-[#374151]"}`}
                        >
                          <span>{s.name} Room {s.room_number || "—"}</span>
                          {selectedVenue?.id === s.id && (
                            <Svg d="M5 13l4 4L19 7" className="w-3.5 h-3.5 text-[#15803d]" strokeWidth={2.5} />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {selectedRole && SCOPED_ROLES.includes(selectedRole.name) && scopeType === "BLOCK" && (
                <div className="space-y-2 animate-fadeIn">
                  <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[#94a3b8]">Select Block *</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full border border-[#e2e8f0] rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-[#15803d]"
                      placeholder="Search Block..."
                      value={blockSearch}
                      onChange={(e) => setBlockSearch(e.target.value)}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Svg d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="border border-[#e8f5ee] rounded-xl max-h-36 overflow-y-auto divide-y divide-gray-100 bg-white">
                    {filteredBlocks.length === 0 ? (
                      <p className="p-3 text-xs text-gray-500 text-center">No blocks found</p>
                    ) : (
                      filteredBlocks.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBlock(b)}
                          className={`w-full text-left px-3.5 py-2 hover:bg-[#f6fbf8] text-[12.5px] transition flex items-center justify-between
                            ${selectedBlock?.id === b.id ? "bg-[#f0fdf4] font-semibold text-[#15803d]" : "text-[#374151]"}`}
                        >
                          <span>{b.name}</span>
                          {selectedBlock?.id === b.id && (
                            <Svg d="M5 13l4 4L19 7" className="w-3.5 h-3.5 text-[#15803d]" strokeWidth={2.5} />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Reason Input */}
              <div className="space-y-1">
                <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[#94a3b8]">Reason for temporary access *</label>
                <input
                  type="text"
                  required
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#15803d]"
                  placeholder="e.g., Covering for receptionist leave"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              {/* Valid Until Input */}
              <div className="space-y-1">
                <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[#94a3b8]">Valid Until *</label>
                <input
                  type="datetime-local"
                  required
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#15803d]"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#f1f5f9] bg-[#fafafa] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsGrantTemporaryOpen(false)
                  setSelectedRole(null)
                  setSelectedVenue(null)
                  setSelectedBlock(null)
                  setReason("")
                  setValidUntil("")
                }}
                className="px-4 py-2 rounded-xl border border-[#e2e8f0] text-[13px] font-semibold text-[#374151] hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAssigning || !selectedRole || !reason.trim() || !validUntil || (SCOPED_ROLES.includes(selectedRole.name) && scopeType === "SPACE" && !selectedVenue) || (SCOPED_ROLES.includes(selectedRole.name) && scopeType === "BLOCK" && !selectedBlock)}
                onClick={handleGrantTemporary}
                className="px-4 py-2 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-[13px] font-bold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isAssigning ? "Granting..." : "Grant Temporary Access"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Edit Manager Dialog ── */}
      {editingApprover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f1f5f9] bg-[#f6fbf8]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#15803d] mb-0.5">Edit Assignment</p>
              <h3 className="text-[16px] font-bold text-[#0f172a]">Edit Venue Manager</h3>
            </div>
            <form onSubmit={handleEditConfirm}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">Approval Role *</label>
                  <select name="role" required className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm bg-white" defaultValue={editingApprover.role}>
                    {roles.map(r => <option key={r.id} value={r.id}>{getRoleDisplayName(r)}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2.5">
                  <input type="checkbox" name="isActive" id="edit-active" defaultChecked={editingApprover.is_active} className="w-4 h-4 text-[#15803d] focus:ring-[#15803d]" />
                  <label htmlFor="edit-active" className="text-[13px] font-semibold text-[#374151]">Active Assignment</label>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-3 border-t border-[#f1f5f9] bg-[#fafafa]">
                <button type="button" onClick={() => setEditingApprover(null)} className="px-4 py-2 border rounded-xl text-[12.5px] font-bold">Cancel</button>
                <button type="submit" disabled={isEditing} className="px-4 py-2 bg-[#15803d] text-white rounded-xl text-[12.5px] font-bold">{isEditing ? "Saving..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Remove Dialog ── */}
      {removingApprover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-100 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f1f5f9] bg-red-50/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-0.5">Remove Assignment</p>
              <h3 className="text-[16px] font-bold text-[#0f172a]">Remove Assignment?</h3>
            </div>
            <div className="p-6">
              <p className="text-[13.5px] text-[#374151]">
                Are you sure you want to remove the assignment for <strong>{removingApprover.space_name || removingApprover.block_name || "this resource"}</strong>?
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-3 border-t border-[#f1f5f9] bg-[#fafafa]">
              <button onClick={() => setRemoving(null)} className="px-4 py-2 border rounded-xl text-[12.5px] font-bold">Cancel</button>
              <button onClick={handleConfirmRemove} disabled={isRemoving} className="px-4 py-2 bg-red-600 text-white rounded-xl text-[12.5px] font-bold">{isRemoving ? "Removing..." : "Remove"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Revoke Delegation Dialog ── */}
      {revokingOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-100 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f1f5f9] bg-red-50/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-0.5">Revoke Temporary Access</p>
              <h3 className="text-[16px] font-bold text-[#0f172a]">Remove Temporary Access?</h3>
            </div>
            <div className="p-6">
              <p className="text-[13.5px] text-[#374151]">
                Are you sure you want to revoke temporary access for <strong>{revokingOverride.role_name}</strong>? They will lose permissions immediately.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-3 border-t border-[#f1f5f9] bg-[#fafafa]">
              <button onClick={() => setRevokingOvr(null)} className="px-4 py-2 border rounded-xl text-[12.5px] font-bold">Cancel</button>
              <button onClick={handleConfirmRevoke} disabled={isRevokingOvr} className="px-4 py-2 bg-red-600 text-white rounded-xl text-[12.5px] font-bold">{isRevokingOvr ? "Removing..." : "Remove Access"}</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Edit Roles Modal Overlay ── */}
      {isEditRolesOpen && (
        <UserRoleModal
          user={user}
          roles={roles}
          onClose={() => setIsEditRolesOpen(false)}
          onSave={handleSaveRoles}
          isSaving={isSavingRoles}
        />
      )}

      {/* ── Edit User Details Modal Overlay ── */}
      {isEditDetailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#f1f5f9] bg-[#f6fbf8] flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#15803d]">Profile Management</p>
                <h3 className="text-[16px] font-bold text-[#0f172a]">Edit User Details</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsEditDetailsOpen(false)} 
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveDetails} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                
                {/* First Name & Last Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      className="w-full border border-[#e2e8f0] rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#15803d] focus:ring-1 focus:ring-[#15803d]"
                      value={detailsForm.first_name}
                      onChange={(e) => setDetailsForm({ ...detailsForm, first_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">Last Name</label>
                    <input
                      type="text"
                      className="w-full border border-[#e2e8f0] rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#15803d] focus:ring-1 focus:ring-[#15803d]"
                      value={detailsForm.last_name}
                      onChange={(e) => setDetailsForm({ ...detailsForm, last_name: e.target.value })}
                    />
                  </div>
                </div>

                {/* Email Address & Phone Number */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      className="w-full border border-[#e2e8f0] rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#15803d] focus:ring-1 focus:ring-[#15803d]"
                      value={detailsForm.email}
                      onChange={(e) => setDetailsForm({ ...detailsForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">Phone Number</label>
                    <input
                      type="tel"
                      className="w-full border border-[#e2e8f0] rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#15803d] focus:ring-1 focus:ring-[#15803d]"
                      value={detailsForm.phone}
                      onChange={(e) => setDetailsForm({ ...detailsForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                {/* Designation & Department */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">Designation</label>
                    <input
                      type="text"
                      className="w-full border border-[#e2e8f0] rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#15803d] focus:ring-1 focus:ring-[#15803d]"
                      placeholder="e.g. Assistant Professor"
                      value={detailsForm.designation}
                      onChange={(e) => setDetailsForm({ ...detailsForm, designation: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">Department</label>
                    <select
                      className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-[#15803d] focus:ring-1 focus:ring-[#15803d]"
                      value={detailsForm.department}
                      onChange={(e) => setDetailsForm({ ...detailsForm, department: e.target.value })}
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.department_name} ({d.department_code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Account Status */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="is_active_checkbox"
                    className="w-4 h-4 rounded text-[#15803d] focus:ring-[#15803d] border-gray-300"
                    checked={detailsForm.is_active}
                    onChange={(e) => setDetailsForm({ ...detailsForm, is_active: e.target.checked })}
                  />
                  <label htmlFor="is_active_checkbox" className="text-sm font-semibold text-[#374151] select-none cursor-pointer">
                    Account Active / Allowed to Log In
                  </label>
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-[#f1f5f9] bg-[#fafafa] flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditDetailsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#e2e8f0] text-[13px] font-semibold text-[#374151] hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDetails}
                  className="px-4 py-2 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-[13px] font-bold transition disabled:opacity-50"
                >
                  {isSavingDetails ? "Saving..." : "Save Details"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  )
}

function UserRoleModal({ user, roles, onClose, onSave, isSaving }) {
  const [selectedRoles, setSelectedRoles] = useState(
    (user?.role_details ?? []).map((r) => r.id)
  )

  const toggleRole = (roleId) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    )
  }

  const roleGroups = useMemo(() => {
    const baseIdentity = roles.filter((r) =>
      ["STUDENT", "FACULTY", "STAFF"].includes(r.name)
    )
    const scopedRoles = roles.filter((r) =>
      ["RECEPTIONIST", "LAB_INCHARGE", "LIBRARIAN"].includes(r.name)
    )
    const moduleManagers = roles.filter((r) =>
      ["MESS_MANAGER", "MEDIA_INCHARGE", "FLEET_MANAGER"].includes(r.name)
    )
    const systemRoles = roles.filter((r) =>
      ["IT_ADMIN", "HOD", "PRINCIPAL"].includes(r.name)
    )

    return [
      { title: "Base Identity", items: baseIdentity },
      { title: "Scoped Roles (Venue Specific)", items: scopedRoles },
      { title: "Module Managers (Transport, Catering, etc.)", items: moduleManagers },
      { title: "System Roles", items: systemRoles },
    ]
  }, [roles])

  const getUserName = (u) => {
    return [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || ""
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-green-100 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between border-b border-green-100 px-6 py-5 bg-[#f6fbf8]">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-green-700">Manage User Roles</p>
            <h2 className="mt-1 text-[20px] font-bold text-gray-950">{getUserName(user)}</h2>
            <p className="mt-1 text-[13.5px] text-gray-500">{user?.email}</p>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
          {roleGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.1em] text-gray-500">{group.title}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {group.items.map((role) => {
                  const isChecked = selectedRoles.includes(role.id)
                  return (
                    <label key={role.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${isChecked ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white hover:border-green-100 hover:bg-green-50/40'}`}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleRole(role.id)}
                        className="mt-1 h-4 w-4 accent-green-700" />
                      <span>
                        <span className="block text-[14.5px] font-bold text-gray-950">
                          {role.name === 'FLEET_MANAGER' ? 'Transport Manager' : (role.display_name || role.name)}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] font-medium text-gray-500">{getRoleDescription(role.name)}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 border-t border-green-100 px-6 py-5 bg-[#fafafa]">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-[14px] font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={() => onSave(user.id, selectedRoles)} disabled={isSaving}
            className="rounded-xl bg-green-700 px-5 py-2.5 text-[14px] font-bold text-white transition hover:bg-green-800 disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-xl bg-[#fafafa] border border-gray-100 px-4 py-3.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">{label}</p>
      <p className="text-[14.5px] font-bold text-[#0f172a] mt-1 break-words">
        {value || '—'}
      </p>
    </div>
  )
}

function getRoleDescription(roleName) {
  const descriptions = {
    STUDENT: "Standard booking requester access.",
    FACULTY: "In-charge of student requests and schedules venues.",
    STAFF: "Requests resources and coordinates events.",
    RECEPTIONIST: "Manages front desk check-ins and spaces.",
    LAB_INCHARGE: "Approves laboratory and resource use.",
    LIBRARIAN: "Manages library halls and study spaces.",
    MESS_MANAGER: "Catering services and meal approvals.",
    MEDIA_INCHARGE: "Media team and equipment scheduling.",
    FLEET_MANAGER: "Vehicle scheduling and transport manager.",
    IT_ADMIN: "Global system configuration and administration.",
    HOD: "Departmental academic and resource permissions.",
    PRINCIPAL: "Ultimate institutional oversight and approvals."
  }
  return descriptions[roleName.toUpperCase()] || ""
}

function TemporaryAccessHistoryTab({ overrides, onRevoke }) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [sortOrder, setSortOrder] = useState("desc")
  const [page, setPage] = useState(1)
  const pageSize = 5

  const getStatus = (o) => {
    const isPast = new Date(o.valid_until) < new Date()
    if (o.is_active) {
      return isPast ? "EXPIRED" : "ACTIVE"
    }
    return isPast ? "EXPIRED" : "REVOKED"
  }

  const getStatusMeta = (status) => {
    if (status === "ACTIVE") return { label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    if (status === "EXPIRED") return { label: "Expired", color: "bg-purple-50 text-purple-700 border-purple-200" }
    return { label: "Revoked", color: "bg-red-50 text-red-700 border-red-200" }
  }

  const filtered = useMemo(() => {
    return overrides.filter(o => {
      const term = search.toLowerCase().trim()
      const scopeText = (o.scope_type === "SPACE" && o.space_name ? o.space_name :
        o.scope_type === "BLOCK" && o.block_name ? o.block_name : "Global").toLowerCase()
      const matchesSearch = !term ||
        o.role_name?.toLowerCase().includes(term) ||
        scopeText.includes(term) ||
        o.reason?.toLowerCase().includes(term)

      const status = getStatus(o)
      const matchesStatus = statusFilter === "ALL" || status === statusFilter

      return matchesSearch && matchesStatus
    }).sort((a, b) => {
      const timeA = new Date(a.created_at || a.valid_until).getTime()
      const timeB = new Date(b.created_at || b.valid_until).getTime()
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB
    })
  }, [overrides, search, statusFilter, sortOrder])

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page])

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pb-4 border-b border-gray-100">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]"
            viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor"
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]"
            placeholder="Search role, scope, or reason..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            className="border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm bg-white focus:outline-none"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="REVOKED">Revoked</option>
          </select>

          {/* Date Sort */}
          <select
            className="border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm bg-white focus:outline-none"
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value)
              setPage(1)
            }}
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border border-[#e8f5ee] rounded-2xl overflow-hidden shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-[#e8f5ee] text-[#475569] font-extrabold uppercase tracking-wider text-[10.5px]">
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Scope</th>
                <th className="px-5 py-3.5">Granted On</th>
                <th className="px-5 py-3.5">Expired On</th>
                <th className="px-5 py-3.5">Reason</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8f5ee]">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#94a3b8] italic">
                    No matching temporary access history found.
                  </td>
                </tr>
              ) : (
                paginated.map(o => {
                  const status = getStatus(o)
                  const meta = getStatusMeta(status)
                  const scopeText = o.scope_type === "SPACE" && o.space_name ? o.space_name :
                    o.scope_type === "BLOCK" && o.block_name ? o.block_name : "Global"
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-4 font-bold text-gray-900">{o.role_name}</td>
                      <td className="px-5 py-4 text-[#374151] font-semibold">{scopeText}</td>
                      <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                        {new Date(o.created_at || o.valid_until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                        {new Date(o.valid_until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-4 text-gray-600 max-w-[200px] truncate" title={o.reason}>{o.reason || "—"}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-block text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {status === "ACTIVE" ? (
                          <button
                            onClick={() => onRevoke(o)}
                            className="px-2.5 py-1 rounded bg-red-50 text-red-600 font-bold hover:bg-red-100 transition text-[11.5px]"
                          >
                            Revoke
                          </button>
                        ) : (
                          <span className="text-gray-400 text-[11px] font-semibold">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-[12px] font-semibold text-[#374151] hover:bg-gray-50 transition disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-[12px] font-medium text-[#6b7280]">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-[12px] font-semibold text-[#374151] hover:bg-gray-50 transition disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
