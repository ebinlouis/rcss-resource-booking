import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useCreateAdminUser, useUpdateAdminUser, useDeleteAdminUser, useToggleUserActive } from '../../hooks/useAdminUserQueries';

const inputCls =
    'w-full border border-[#e2e8f0] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] bg-white outline-none transition focus:ring-2 focus:ring-[#15803d] focus:border-transparent placeholder:text-[#94a3b8] hover:border-[#94a3b8]';

const selectCls =
    'w-full border border-[#e2e8f0] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] bg-white outline-none transition focus:ring-2 focus:ring-[#15803d] focus:border-transparent hover:border-[#94a3b8]';

const getProfileImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `http://localhost:8000${url}`;
};

export default function AdminFacultiesPage() {
    const { id: routeDeptId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const createAdminUser = useCreateAdminUser();
    const updateAdminUser = useUpdateAdminUser();
    const deleteAdminUser = useDeleteAdminUser();
    const toggleUserActive = useToggleUserActive();

    // Determine the active department ID
    // IT Admin uses route parameter, HOD uses their own department
    const isHOD = user?.effective_roles?.includes('HOD') && !user?.effective_roles?.includes('IT_ADMIN');
    const departmentId = routeDeptId ? parseInt(routeDeptId, 10) : user?.department;

    const [deptInfo, setDeptInfo] = useState(null);
    const [faculties, setFaculties] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [roles, setRoles] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState(null);
    const isBlockingHodSetup = !isHOD && !loading && !listError && faculties.length === 0;

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    // CSV Upload Modal
    const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
    const [csvFile, setCsvFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [csvUploadError, setCsvUploadError] = useState(null);

    // CSV Results Modal
    const [csvUploadResult, setCsvUploadResult] = useState(null);
    const [csvResultTab, setCsvResultTab] = useState('created');

    // Add / Edit Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formError, setFormError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState({
        employee_student_id: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        designation: '',
        department: '',
        selected_role: '',
        is_active: true
    });

    // Reset Password Modal / Alert
    const [resetSuccessMsg, setResetSuccessMsg] = useState(null);
    const [isResetting, setIsResetting] = useState(false);
    const [resetTargetUser, setResetTargetUser] = useState(null);

    // Profile View Modal
    const [viewingUser, setViewingUser] = useState(null);

    // Dropdown Action Menu
    const [openMenuUserId, setOpenMenuUserId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpenMenuUserId(null);
            }
        };
        const handleScroll = (e) => {
            if (menuRef.current && menuRef.current.contains(e.target)) return;
            setOpenMenuUserId(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, []);

    // Delete/Deactivate Confirmation Modal
    const [actionTargetUser, setActionTargetUser] = useState(null);
    const [isActionSubmitting, setIsActionSubmitting] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsModalOpen(false);
                setViewingUser(null);
                setResetTargetUser(null);
                setActionTargetUser(null);
                setIsCSVModalOpen(false);
                setCsvUploadResult(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Fetch initial page data
    const fetchData = useCallback(async () => {
        setLoading(true);
        setListError(null);
        try {
            // 1. Fetch Department Info
            if (departmentId) {
                try {
                    const deptRes = await api.get(`/auth/departments/${departmentId}/`);
                    setDeptInfo(deptRes.data);
                } catch (err) {
                    console.error('Failed to load department details:', err);
                }
            }

            // 2. Fetch faculties
            // IT Admin: filter by department. HOD: backend automatically filters.
            const userParams = {};
            if (!isHOD && departmentId) {
                userParams.department = departmentId;
            }
            const usersRes = await api.get('/auth/admin-users/', { params: userParams });
            
            // For IT Admin, we should filter users to only show faculties/HODs in this view
            const rawUsers = usersRes.data.results || usersRes.data || [];
            if (!isHOD) {
                const filtered = rawUsers.filter(u => 
                    u.effective_roles?.includes('FACULTY') || 
                    u.effective_roles?.includes('HOD')
                );
                setFaculties(filtered);
            } else {
                setFaculties(rawUsers);
            }

            // 3. Fetch Departments list (for dropdown, IT Admin only)
            if (!isHOD) {
                const deptsRes = await api.get('/auth/departments/');
                setDepartments(deptsRes.data.results || deptsRes.data || []);
            }

            // 4. Fetch Roles
            try {
                const rolesRes = await api.get('/auth/roles/');
                const allRoles = rolesRes.data || [];
                // Only show relevant roles for faculty view
                let filteredRoles;
                if (isHOD) {
                    filteredRoles = allRoles.filter(r => ['FACULTY', 'STAFF'].includes(r.name));
                } else {
                    filteredRoles = allRoles.filter(r => ['FACULTY', 'HOD'].includes(r.name));
                }
                setRoles(filteredRoles);
            } catch (err) {
                console.error('Failed to load roles:', err);
                // Fallback roles if API fails or restricted
                if (isHOD) {
                    setRoles([
                        { id: 2, name: 'FACULTY', display_name: 'Faculty' },
                        { id: 3, name: 'STAFF', display_name: 'Staff' }
                    ]);
                } else {
                    setRoles([
                        { id: 2, name: 'FACULTY', display_name: 'Faculty' },
                        { id: 11, name: 'HOD', display_name: 'Head of Department' }
                    ]);
                }
            }

        } catch (err) {
            console.error(err);
            setListError('Failed to load page data. Please verify your connection and permissions.');
        } finally {
            setLoading(false);
        }
    }, [departmentId, isHOD]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchData();
    }, [fetchData]);

    const location = useLocation();

    useEffect(() => {
        if (!loading && !listError) {
            const params = new URLSearchParams(location.search);
            if (params.get('onboard') === 'true') {
                navigate(location.pathname, { replace: true });
            }
        }
    }, [loading, listError, location.search, location.pathname, navigate]);

    // HOD is displayed separately in a Highlighted HOD Card
    const activeHOD = faculties.find(f => f.effective_roles?.includes('HOD'));
    const regularFaculties = faculties.filter(f => !f.effective_roles?.includes('HOD'));

    // Handle search query
    const filteredFaculties = regularFaculties.filter((fac) => {
        const query = searchQuery.toLowerCase();
        const fullName = `${fac.first_name || ''} ${fac.last_name || ''}`.toLowerCase();
        return (
            fullName.includes(query) ||
            (fac.email || '').toLowerCase().includes(query) ||
            (fac.phone || '').toLowerCase().includes(query) ||
            (fac.designation || '').toLowerCase().includes(query) ||
            (fac.employee_student_id || '').toLowerCase().includes(query)
        );
    });

    const openAddModal = () => {
        setEditingUser(null);
        setFormError(null);
        const generatedId = 'FAC' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
        
        // Auto-select HOD if no active HOD is present
        const hasHOD = faculties.some(f => f.effective_roles?.includes('HOD') && f.is_active);
        const hodRoleObj = roles.find(r => r.name === 'HOD');
        const facRoleObj = roles.find(r => r.name === 'FACULTY');
        
        setForm({
            employee_student_id: generatedId,
            first_name: '',
            last_name: '',
            email: '',
            phone: '',
            designation: '',
            department: departmentId || '',
            selected_role: !hasHOD && hodRoleObj ? hodRoleObj.id.toString() : (facRoleObj ? facRoleObj.id.toString() : ''),
            is_active: true
        });
        setIsModalOpen(true);
    };

    const openEditModal = (fac) => {
        setEditingUser(fac);
        setFormError(null);
        // Find existing role ID if any
        const mainRoleId = roles.find(r => fac.effective_roles?.includes(r.name))?.id || '';
        setForm({
            employee_student_id: fac.employee_student_id ?? '',
            first_name: fac.first_name ?? '',
            last_name: fac.last_name ?? '',
            email: fac.email ?? '',
            phone: fac.phone ?? '',
            designation: fac.designation ?? '',
            department: fac.department ?? departmentId ?? '',
            selected_role: mainRoleId || fac.roles?.[0] || '',
            is_active: fac.is_active ?? true
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setEditingUser(null);
        setFormError(null);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setFormError(null);

        const payload = {
            employee_student_id: form.employee_student_id,
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email,
            phone: form.phone,
            designation: form.designation,
            department: form.department ? parseInt(form.department, 10) : null,
            is_active: form.is_active,
            roles: form.selected_role ? [parseInt(form.selected_role, 10)] : []
        };

        try {
            if (editingUser) {
                await updateAdminUser.mutateAsync({ id: editingUser.id, payload });
                toast.success('Faculty updated successfully');
            } else {
                await createAdminUser.mutateAsync(payload);
                toast.success('Faculty added successfully');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            console.error(err);
            const errData = err.response?.data;
            let errMsg = '';
            if (errData) {
                if (errData.email) {
                    if (Array.isArray(errData.email) && errData.email[0].includes('already exists')) {
                        errMsg = 'Faculty email already exists';
                    } else {
                        errMsg = `Email error: ${Array.isArray(errData.email) ? errData.email.join(', ') : errData.email}`;
                    }
                } else if (errData.roles) {
                    if (Array.isArray(errData.roles) && errData.roles[0].includes('already has a Head of Department')) {
                        errMsg = 'Only one HOD is allowed per department';
                    } else {
                        errMsg = Array.isArray(errData.roles) ? errData.roles.join(', ') : errData.roles;
                    }
                } else {
                    const keys = Object.keys(errData);
                    if (keys.length > 0) {
                        const firstVal = errData[keys[0]];
                        errMsg = Array.isArray(firstVal) ? firstVal.join(', ') : firstVal;
                    }
                }
            }
            const finalError = errMsg || (editingUser ? 'Unable to save faculty changes' : 'Error adding faculty');
            setFormError(finalError);
            toast.error(finalError);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetPassword = async () => {
        if (!resetTargetUser) return;
        setIsResetting(true);
        try {
            await api.post(`/auth/admin-users/${resetTargetUser.id}/reset-password/`, {
                password: 'Rajagiri@123'
            });
            toast.success('Password reset successfully');
            setResetTargetUser(null);
        } catch (err) {
            console.error(err);
            toast.error('Failed to reset password');
        } finally {
            setIsResetting(false);
        }
    };

    const handleCSVUpload = async () => {
        if (!csvFile) return;
        setIsUploading(true);
        setCsvUploadError(null);
        try {
            const formData = new FormData();
            formData.append('file', csvFile);
            const res = await api.post('/auth/admin-users/csv-upload/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setCsvUploadResult(res.data);
            setCsvResultTab('created');
            setIsCSVModalOpen(false);
            setCsvFile(null);
            // Refresh the faculty list to reflect new/updated users
            fetchData();
            toast.success(
                `CSV imported: ${res.data.summary.created_count} created, ${res.data.summary.updated_count} updated.`
            );
        } catch (err) {
            const data = err.response?.data;
            if (data?.validation_errors) {
                // Show validation errors directly inside the results modal
                setCsvUploadResult({
                    _validationErrors: data.validation_errors,
                    _detail: data.detail,
                });
                setCsvResultTab('errors');
                setIsCSVModalOpen(false);
                setCsvFile(null);
            } else {
                setCsvUploadError(data?.detail || 'Upload failed. Please try again.');
            }
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveAction = async (actionType) => {
        if (!actionTargetUser) return;
        setIsActionSubmitting(true);
        try {
            if (actionType === 'delete') {
                await deleteAdminUser.mutateAsync(actionTargetUser.id);
                toast.success('Faculty removed successfully');
            } else {
                // Deactivate
                await toggleUserActive.mutateAsync({ id: actionTargetUser.id, is_active: false });
                toast.success('Faculty deactivated successfully');
            }
            setActionTargetUser(null);
            fetchData();
        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.message || 'Error occurred. This user may have bookings, consider deactivating them instead.';
            toast.error(errMsg);
        } finally {
            setIsActionSubmitting(false);
        }
    };

    return (
        <div className="min-h-full bg-[#f6fbf8] p-6 md:p-8">
            <div className="max-w-[1200px] mx-auto">
                
                {/* Back button for IT Admin */}
                {!isHOD && (
                    <button
                        onClick={() => navigate('/admin/departments')}
                        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#4a6b58] hover:text-[#15803d] transition mb-4"
                    >
                        ← Back to Departments
                    </button>
                )}

                {/* Header Section */}
                <div className="bg-white border border-[#e8f5ee] rounded-2xl p-6 mb-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <p className="caps-label mb-1">
                            {deptInfo ? `${deptInfo.department_code} Department` : 'Department Management'}
                        </p>
                        <h1 className="text-2xl font-bold text-[#0f172a] tracking-tight flex flex-wrap items-center gap-2">
                            <span>{deptInfo?.department_name || 'Loading details...'}</span>
                            {!activeHOD && !loading && (
                                <span 
                                    className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full select-none cursor-help"
                                    title="This department is not configured yet. Please add a Head of Department using the button above."
                                >
                                    No faculty members found
                                </span>
                            )}
                        </h1>
                        <div className="flex items-center gap-4 mt-3 text-[14px] text-[#475569]">
                            <span className="inline-flex items-center gap-1">
                                <strong>Code:</strong> 
                                <span className="px-2 py-0.5 bg-[#f1f5f9] rounded-lg text-xs font-mono uppercase font-bold text-[#334155]">
                                    {deptInfo?.department_code || '---'}
                                </span>
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            <span>
                                <strong>Faculty Members:</strong> {regularFaculties.length} total
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
                        {/* Upload CSV — HOD only */}
                        {isHOD && (
                            <button
                                id="btn-csv-upload"
                                type="button"
                                onClick={() => { setCsvFile(null); setCsvUploadError(null); setIsCSVModalOpen(true); }}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#15803d]/30 bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#15803d] text-[13px] font-semibold transition"
                            >
                                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                Upload CSV
                            </button>
                        )}
                        <button
                            id="btn-add-faculty"
                            type="button"
                            onClick={openAddModal}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-[13.5px] font-semibold transition shadow-sm"
                        >
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 4v16m8-8H4" />
                            </svg>
                            {activeHOD ? 'Add Faculty' : 'Add Head of Department'}
                        </button>
                    </div>
                </div>

                {/* Alert for password reset */}
                {resetSuccessMsg && (
                    <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between">
                        <span>{resetSuccessMsg}</span>
                        <button onClick={() => setResetSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
                    </div>
                )}

                {/* Highlighted HOD Card or Empty State */}
                {activeHOD ? (
                    <div 
                        onClick={() => setViewingUser(activeHOD)}
                        className="bg-white border border-[#15803d]/20 rounded-2xl p-6 mb-8 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-[#f0fdf4]/25 cursor-pointer hover:border-[#15803d]/45 hover:shadow-md transition duration-300 group"
                    >
                        {/* Decorative corner accent */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#15803d]/5 rounded-bl-full pointer-events-none group-hover:scale-105 transition-transform duration-300"></div>
                        
                        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                            {/* Profile Photo */}
                            <div 
                                className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-white text-3xl font-bold shrink-0 shadow-md ring-4 ring-[#15803d]/10 group-hover:ring-[#15803d]/30 transition duration-300"
                                style={activeHOD.profile_image ? {} : { background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)' }}
                            >
                                {activeHOD.profile_image ? (
                                    <img src={getProfileImageUrl(activeHOD.profile_image)} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    activeHOD.first_name?.charAt(0).toUpperCase() || 'H'
                                )}
                            </div>
                            
                            {/* Info Details */}
                            <div className="flex-1 text-center md:text-left space-y-1.5">
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                                    <h4 className="text-[19px] font-bold text-[#0f172a] tracking-tight">
                                        {`${activeHOD.first_name} ${activeHOD.last_name || ''}`.trim()}
                                    </h4>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#15803d] text-white tracking-wide uppercase shadow-sm">
                                        Head of Department
                                    </span>
                                    {!activeHOD.is_active && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">
                                            Inactive
                                        </span>
                                    )}
                                </div>
                                <p className="text-[13px] text-slate-500 font-semibold uppercase tracking-wider">
                                    {activeHOD.designation || 'Head of Department'}
                                </p>
                                
                                <div className="pt-1.5 flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 text-[13.5px] text-[#475569]">
                                    <div className="flex items-center gap-1.5 hover:text-slate-900 transition">
                                        <svg className="w-4 h-4 text-[#15803d]/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        <span>{activeHOD.email}</span>
                                    </div>
                                    {activeHOD.phone && (
                                        <div className="flex items-center gap-1.5 hover:text-slate-900 transition">
                                            <svg className="w-4 h-4 text-[#15803d]/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            <span>{activeHOD.phone}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-[#15803d]/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-10v4m0 10V4m-12 16h12" />
                                        </svg>
                                        <span>{deptInfo?.department_name} ({deptInfo?.department_code})</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Action Buttons inside Card for Admin */}
                            {!isHOD && (
                                <div className="shrink-0 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(activeHOD)}
                                        className="px-4 py-2 text-[12.5px] font-bold text-[#15803d] border border-[#15803d]/20 bg-white hover:bg-[#15803d]/5 rounded-xl transition"
                                    >
                                        Edit Department Head
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setResetTargetUser(activeHOD); }}
                                        className="px-4 py-2 text-[12.5px] font-bold text-amber-700 border border-amber-200 bg-white hover:bg-amber-50 rounded-xl transition"
                                    >
                                        Reset Password
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}

                {/* Search Bar */}
                <div className="mb-6 max-w-md relative">
                    <input
                        type="text"
                        placeholder="Search by name, email or designation..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`${inputCls} pl-10`}
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </span>
                </div>

                {/* Faculty List Table */}
                {listError ? (
                    <div className="bg-white border border-[#e8f5ee] rounded-2xl py-16 text-center px-8">
                        <p className="text-[15px] font-semibold text-[#0f172a]">Could not load faculties</p>
                        <p className="text-[13.5px] text-[#94a3b8] mt-1.5">{listError}</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-[#e8f5ee] overflow-x-auto shadow-sm">
                        <table className="w-full min-w-[800px] text-left border-collapse">
                            <thead>
                                <tr className="bg-[#f6fbf8] border-b border-[#e8f5ee]">
                                    <th className="caps-label px-6 py-4">Profile</th>
                                    <th className="caps-label px-6 py-4">Name</th>
                                    <th className="caps-label px-6 py-4">Email</th>
                                    <th className="caps-label px-6 py-4">Phone</th>
                                    <th className="caps-label px-6 py-4">Designation</th>
                                    <th className="caps-label px-6 py-4">Status</th>
                                    <th className="caps-label px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e8f5ee]">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="text-center py-10 text-[#94a3b8] text-[13.5px]">
                                            Loading faculties...
                                        </td>
                                    </tr>
                                ) : filteredFaculties.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="text-center py-10 text-[#94a3b8] text-[13.5px]">
                                            {searchQuery ? 'No faculties match your search.' : 'No faculty members assigned yet.'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredFaculties.map((fac) => (
                                        <tr key={fac.id} className="hover:bg-[#f0fdf4]/50 transition">
                                            <td className="px-6 py-4">
                                                <div 
                                                    className="w-10 h-10 rounded-full text-white text-[14px] font-bold flex items-center justify-center shrink-0 shadow-sm overflow-hidden"
                                                    style={fac.profile_image ? {} : { background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)' }}
                                                >
                                                    {fac.profile_image ? (
                                                        <img src={getProfileImageUrl(fac.profile_image)} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        fac.first_name?.charAt(0).toUpperCase() || 'F'
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-[14px] font-semibold text-[#0f172a]">
                                                <span>{`${fac.first_name} ${fac.last_name || ''}`.trim()}</span>
                                            </td>
                                            <td className="px-6 py-4 text-[13.5px] text-[#334155]">
                                                {fac.email}
                                            </td>
                                            <td className="px-6 py-4 text-[13.5px] text-[#475569]">
                                                {fac.phone || '—'}
                                            </td>
                                            <td className="px-6 py-4 text-[13.5px] font-medium text-[#475569]">
                                                {fac.designation || '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                                                    fac.is_active 
                                                        ? 'bg-[#f0fdf4] text-[#14532d] border border-[#d1fae5]' 
                                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${fac.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                                    {fac.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="inline-block text-left">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            if (openMenuUserId === fac.id) {
                                                                setOpenMenuUserId(null);
                                                            } else {
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const spaceBelow = window.innerHeight - rect.bottom;
                                                                const isUpward = spaceBelow < 180;
                                                                const rightPos = window.innerWidth - rect.right;
                                                                if (isUpward) {
                                                                    setMenuPos({ top: undefined, bottom: window.innerHeight - rect.top + 4, right: rightPos, isUpward: true });
                                                                } else {
                                                                    setMenuPos({ bottom: undefined, top: rect.bottom + 4, right: rightPos, isUpward: false });
                                                                }
                                                                setOpenMenuUserId(fac.id);
                                                            }
                                                        }}
                                                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
                                                    >
                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                                        </svg>
                                                    </button>
                                                    {openMenuUserId === fac.id && createPortal(
                                                        <div
                                                            ref={menuRef}
                                                            style={{ 
                                                                ...(menuPos.top ? { top: menuPos.top } : {}),
                                                                ...(menuPos.bottom ? { bottom: menuPos.bottom } : {}),
                                                                right: menuPos.right 
                                                            }}
                                                            className={`fixed w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-[9999] animate-in fade-in duration-100 text-left ${
                                                                menuPos.isUpward ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'
                                                            }`}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => { setViewingUser(fac); setOpenMenuUserId(null); }}
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 transition font-medium"
                                                            >
                                                                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                </svg>
                                                                View Profile
                                                            </button>
                                                            {!(isHOD && fac.effective_roles?.includes('HOD')) && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { openEditModal(fac); setOpenMenuUserId(null); }}
                                                                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 transition font-medium"
                                                                    >
                                                                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                        </svg>
                                                                        Edit Details
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setResetTargetUser(fac); setOpenMenuUserId(null); }}
                                                                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 transition font-medium"
                                                                    >
                                                                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m-5 8a2 2 0 01-2-2V9a2 2 0 012-2h3m-1 1v-5a1 1 0 10-2 0v5m-1 4H6a2 2 0 00-2 2v2a2 2 0 002 2h8a2 2 0 002-2v-2a2 2 0 00-2-2H9" />
                                                                        </svg>
                                                                        Reset Password
                                                                    </button>
                                                                    <div className="border-t border-slate-100 my-1"></div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setActionTargetUser(fac); setOpenMenuUserId(null); }}
                                                                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-[13px] text-red-600 hover:bg-red-50 transition font-medium"
                                                                    >
                                                                        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                        Remove Faculty
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>,
                                                        document.body
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={closeModal}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start mb-5">
                            <div>
                                <p className="text-[10.5px] font-bold text-[#15803d] uppercase tracking-[0.12em] mb-0.5">
                                    {editingUser ? 'Faculty Update' : (isBlockingHodSetup ? 'Onboarding Guided Step' : (!activeHOD ? 'Onboarding Guided Step' : 'New Faculty Assignment'))}
                                </p>
                                <h3 className="text-[20px] font-bold text-[#0f172a] tracking-tight">
                                    {editingUser ? 'Edit Faculty Details' : (isBlockingHodSetup ? 'Setup Head of Department' : (!activeHOD ? 'Setup Head of Department' : 'Add New Faculty'))}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={isSubmitting}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f1f5f9] text-[#94a3b8] transition disabled:opacity-40"
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            <div>
                                <label className="block caps-label mb-1.5">
                                    Designation
                                </label>
                                <input
                                    value={form.designation}
                                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                                    placeholder="e.g. Assistant Professor"
                                    className={inputCls}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block caps-label mb-1.5">
                                        First Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        required
                                        value={form.first_name}
                                        onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                                        placeholder="e.g. John"
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className="block caps-label mb-1.5">
                                        Last Name
                                    </label>
                                    <input
                                        value={form.last_name}
                                        onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                                        placeholder="e.g. Doe"
                                        className={inputCls}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block caps-label mb-1.5">
                                        Email Address <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        required
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        placeholder="e.g. john.doe@rcss.ac.in"
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className="block caps-label mb-1.5">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        placeholder="e.g. +91 9876543210"
                                        className={inputCls}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block caps-label mb-1.5">Department</label>
                                    {isHOD ? (
                                        <div className="px-3.5 py-2.5 bg-slate-50 border border-[#e2e8f0] rounded-xl text-sm font-semibold text-slate-700">
                                            {deptInfo?.department_name || 'My Department'}
                                        </div>
                                    ) : (
                                        <select
                                            value={form.department}
                                            onChange={(e) => setForm({ ...form, department: e.target.value })}
                                            className={selectCls}
                                            required
                                        >
                                            <option value="">Select Department</option>
                                            {departments.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.department_name} ({d.department_code})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div>
                                    <label className="block caps-label mb-1.5">Role</label>
                                    {(() => {
                                        const hasHOD = faculties.some(f => f.effective_roles?.includes('HOD') && f.is_active);
                                        const isFirstHod = !editingUser && !hasHOD;
                                        if (isFirstHod) {
                                            // Lock the role to HOD for the first faculty — show a read-only pill
                                            return (
                                                <>
                                                    <div className="px-3.5 py-2.5 bg-[#f0fdf4] border border-[#d1fae5] rounded-xl text-sm font-bold text-[#15803d] flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-[#15803d] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                        </svg>
                                                        Head of Department
                                                    </div>
                                                    <p className="mt-1.5 text-[11px] font-semibold text-[#15803d]">
                                                        First faculty member is automatically assigned as Department Head.
                                                    </p>
                                                </>
                                            );
                                        }
                                        return (
                                            <select
                                                value={form.selected_role}
                                                onChange={(e) => setForm({ ...form, selected_role: e.target.value })}
                                                className={selectCls}
                                                required
                                            >
                                                <option value="">Select Role</option>
                                                {roles.map((r) => {
                                                    // Disable HOD option in ADD mode if HOD already exists
                                                    const isHodOptionDisabled = !editingUser && hasHOD && r.name === 'HOD';
                                                    return (
                                                        <option key={r.id} value={r.id} disabled={isHodOptionDisabled}>
                                                            {r.display_name}{isHodOptionDisabled ? ' (Already Assigned)' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        );
                                    })()}
                                </div>

                            </div>

                            {/* HOD Warning / Replacement Banner */}
                            {(() => {
                                const activeHOD = faculties.find(f => f.effective_roles?.includes('HOD') && f.is_active);
                                const hodRoleObj = roles.find(r => r.name === 'HOD');
                                const isSelectingHOD = hodRoleObj && (form.selected_role === hodRoleObj.id.toString() || form.selected_role === 'HOD');
                                
                                if (activeHOD && isSelectingHOD && (!editingUser || editingUser.id !== activeHOD.id)) {
                                    return (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12.5px] text-amber-800 font-medium space-y-1">
                                            <div className="flex items-center gap-1.5 font-bold">
                                                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                <span>Department Head Already Assigned</span>
                                            </div>
                                            <p>This department already has a Head of Department assigned: <strong className="font-semibold">{activeHOD.first_name} {activeHOD.last_name || ''}</strong>.</p>
                                            <p className="text-[11.5px] text-amber-700/90 mt-0.5">Saving this change will make this person the Department Head and change the current Department Head to a Faculty Member.</p>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={form.is_active}
                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                    className="h-4.5 w-4.5 accent-[#15803d] cursor-pointer"
                                />
                                <label htmlFor="is_active" className="text-sm font-semibold text-[#0f172a] cursor-pointer select-none">
                                    Active Account
                                </label>
                            </div>

                            {formError && (
                                <p className="text-xs text-red-500 font-medium">{formError}</p>
                            )}

                            <div className="flex flex-wrap gap-3 justify-end pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={isSubmitting}
                                    className="px-4 py-2.5 text-[13px] font-semibold text-[#4a6b58] border border-[#d1fae5] bg-white hover:bg-[#f0fdf4] rounded-xl transition disabled:opacity-40"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2.5 text-[13px] font-semibold text-white bg-[#15803d] hover:bg-[#166534] rounded-xl transition disabled:opacity-50"
                                >
                                    {isSubmitting
                                        ? 'Saving...'
                                        : editingUser
                                            ? 'Save Changes'
                                            : isBlockingHodSetup
                                                ? 'Setup Head of Department'
                                                : 'Save Faculty'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Profile View Modal */}
            {viewingUser && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setViewingUser(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-[10.5px] font-bold text-[#15803d] uppercase tracking-[0.12em] mb-0.5">Faculty Member Profile</p>
                                <h3 className="text-[20px] font-bold text-[#0f172a] tracking-tight">
                                    {`${viewingUser.first_name} ${viewingUser.last_name || ''}`.trim()}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewingUser(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f1f5f9] text-[#94a3b8] transition"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-center mb-4">
                                <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-white text-3xl font-bold ring-4 ring-[#d1fae5] ring-offset-2"
                                     style={viewingUser.profile_image ? {} : { background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)' }}>
                                    {viewingUser.profile_image 
                                        ? <img src={getProfileImageUrl(viewingUser.profile_image)} alt="" className="w-full h-full object-cover" />
                                        : viewingUser.first_name?.charAt(0).toUpperCase() || 'F'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-[13.5px] border-t border-slate-100 pt-4">
                                <div>
                                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Designation</p>
                                    <p className="font-semibold text-slate-800 mt-0.5">{viewingUser.designation || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Department</p>
                                    <p className="font-semibold text-slate-800 mt-0.5">{viewingUser.department_name || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">System Badges</p>
                                    <p className="font-semibold text-slate-800 mt-0.5">
                                        {viewingUser.effective_roles?.includes('HOD') ? 'Head of Department' : 'Faculty'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Email Address</p>
                                    <p className="font-semibold text-slate-800 mt-0.5 break-all">{viewingUser.email}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Phone Number</p>
                                    <p className="font-semibold text-slate-800 mt-0.5">{viewingUser.phone || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Date Joined</p>
                                    <p className="font-semibold text-slate-800 mt-0.5">
                                        {viewingUser.date_joined ? new Date(viewingUser.date_joined).toLocaleDateString() : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Status</p>
                                    <p className="font-semibold mt-0.5">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                            viewingUser.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {viewingUser.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end mt-6 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setViewingUser(null)}
                                className="px-4 py-2.5 text-[13px] font-semibold text-[#4a6b58] border border-[#d1fae5] bg-white hover:bg-[#f0fdf4] rounded-xl transition"
                            >
                                Close Profile
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Confirmation Modal */}
            {resetTargetUser && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setResetTargetUser(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-[18px] font-bold text-[#0f172a] tracking-tight mb-3">
                            Reset Password?
                        </h3>
                        <p className="text-[14px] text-slate-600 leading-relaxed">
                            Are you sure you want to reset the password for <strong className="text-slate-900">{resetTargetUser.first_name} {resetTargetUser.last_name || ''}</strong>? The password will be reset to a temporary password that can be changed after login.
                        </p>
                        <p className="text-[13px] text-amber-600 font-medium mt-2 bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                            The password will be reset to the default: <strong>Rajagiri@123</strong>. The user can change this later from their profile.
                        </p>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setResetTargetUser(null)}
                                disabled={isResetting}
                                className="px-4 py-2.5 text-[13px] font-semibold text-[#4a6b58] border border-[#d1fae5] bg-white hover:bg-[#f0fdf4] rounded-xl transition disabled:opacity-40"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleResetPassword}
                                disabled={isResetting}
                                className="px-4 py-2.5 text-[13px] font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition disabled:opacity-50"
                            >
                                {isResetting ? 'Resetting...' : 'Confirm Reset'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Remove / Deactivate Confirmation Modal */}
            {actionTargetUser && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setActionTargetUser(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-[18px] font-bold text-[#0f172a] tracking-tight mb-3">
                            Remove Faculty?
                        </h3>
                        <p className="text-[14px] text-slate-600 leading-relaxed">
                            Are you sure you want to remove this faculty member?
                        </p>
                        <p className="text-[13px] text-slate-400 mt-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                            Note: Deleting will remove <strong className="text-slate-700">{actionTargetUser.first_name} {actionTargetUser.last_name || ''}</strong> completely. If they have active bookings or resources assigned, you should choose <strong>Deactivate</strong> instead, which blocks system access but keeps previous bookings and records.
                        </p>

                        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setActionTargetUser(null)}
                                disabled={isActionSubmitting}
                                className="order-3 sm:order-none px-4 py-2.5 text-[13px] font-semibold text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => handleRemoveAction('deactivate')}
                                disabled={isActionSubmitting}
                                className="px-4 py-2.5 text-[13px] font-semibold text-[#4a6b58] border border-[#d1fae5] bg-emerald-50 hover:bg-emerald-100 rounded-xl transition"
                            >
                                Deactivate Account
                            </button>
                            <button
                                type="button"
                                onClick={() => handleRemoveAction('delete')}
                                disabled={isActionSubmitting}
                                className="px-4 py-2.5 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition"
                            >
                                {isActionSubmitting ? 'Processing...' : 'Remove Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── CSV Upload Modal ──────────────────────────────────── */}
            {isCSVModalOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => { if (!isUploading) setIsCSVModalOpen(false); }}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-lg p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-5">
                            <div>
                                <p className="caps-label mb-0.5">Import Faculty List</p>
                                <h3 className="text-[20px] font-bold text-[#0f172a] tracking-tight">Upload Faculty CSV</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCSVModalOpen(false)}
                                disabled={isUploading}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f1f5f9] text-[#94a3b8] transition disabled:opacity-40"
                            >✕</button>
                        </div>

                        {/* Info banner */}
                        <div className="mb-5 p-3.5 rounded-xl bg-[#f0fdf4] border border-[#d1fae5] text-[12.5px] text-[#166534] space-y-1.5">
                            <p className="font-bold flex items-center gap-1.5">
                                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                CSV Format Requirements
                            </p>
                            <p>Required headers: <code className="bg-[#dcfce7] px-1.5 py-0.5 rounded font-mono text-[11px]">Sl No, Name, Dept., mail id, Mobile Number</code></p>
                            <p>Max <strong>500 rows</strong> per upload. Encoding: <strong>UTF-8</strong> (Excel-exported CSVs are supported).</p>
                            <p>New users get password <code className="bg-[#dcfce7] px-1.5 py-0.5 rounded font-mono text-[11px]">RCSS@&lt;email-prefix&gt;</code>. Department is auto-set to yours.</p>
                        </div>

                        {/* File drop zone */}
                        <label
                            htmlFor="csv-file-input"
                            className={`block w-full border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                                csvFile
                                    ? 'border-[#15803d] bg-[#f0fdf4]'
                                    : 'border-[#e2e8f0] bg-[#f8fafc] hover:border-[#15803d]/50 hover:bg-[#f0fdf4]/50'
                            }`}
                        >
                            <input
                                id="csv-file-input"
                                type="file"
                                accept=".csv"
                                className="sr-only"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) { setCsvFile(f); setCsvUploadError(null); }
                                }}
                                disabled={isUploading}
                            />
                            {csvFile ? (
                                <div className="space-y-1">
                                    <div className="w-10 h-10 rounded-xl bg-[#15803d] text-white flex items-center justify-center mx-auto shadow-sm">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <p className="text-[13.5px] font-bold text-[#0f172a] mt-2">{csvFile.name}</p>
                                    <p className="text-[12px] text-[#64748b]">{(csvFile.size / 1024).toFixed(1)} KB — click to change</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="w-10 h-10 rounded-xl bg-[#e2e8f0] flex items-center justify-center mx-auto">
                                        <svg className="w-5 h-5 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                    </div>
                                    <p className="text-[13.5px] font-semibold text-[#475569]">Click to select a CSV file</p>
                                    <p className="text-[12px] text-[#94a3b8]">Only .csv files are accepted</p>
                                </div>
                            )}
                        </label>

                        {/* Error */}
                        {csvUploadError && (
                            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-[12.5px] text-red-700 font-medium flex items-start gap-2">
                                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                {csvUploadError}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex flex-wrap gap-3 justify-end pt-5 mt-5 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsCSVModalOpen(false)}
                                disabled={isUploading}
                                className="px-4 py-2.5 text-[13px] font-semibold text-[#4a6b58] border border-[#d1fae5] bg-white hover:bg-[#f0fdf4] rounded-xl transition disabled:opacity-40"
                            >Cancel</button>
                            <button
                                id="btn-csv-submit"
                                type="button"
                                onClick={handleCSVUpload}
                                disabled={!csvFile || isUploading}
                                className="px-5 py-2.5 text-[13px] font-semibold text-white bg-[#15803d] hover:bg-[#166534] rounded-xl transition disabled:opacity-40 flex items-center gap-2"
                            >
                                {isUploading ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                                        Importing...
                                    </>
                                ) : 'Import CSV'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── CSV Results Modal ─────────────────────────────────── */}
            {csvUploadResult && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setCsvUploadResult(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-[#e8f5ee] w-full max-w-2xl max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start shrink-0">
                            <div>
                                <p className="caps-label mb-0.5">
                                    {csvUploadResult._validationErrors ? 'Some Rows Need Attention' : 'Import Complete'}
                                </p>
                                <h3 className="text-[20px] font-bold text-[#0f172a] tracking-tight">
                                    Upload Results
                                </h3>
                                {csvUploadResult._detail && (
                                    <p className="text-[12.5px] text-red-600 font-medium mt-1">{csvUploadResult._detail}</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setCsvUploadResult(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f1f5f9] text-[#94a3b8] transition"
                            >✕</button>
                        </div>

                        {/* Summary cards — only for successful imports */}
                        {!csvUploadResult._validationErrors && (
                            <div className="px-6 pt-5 grid grid-cols-3 gap-3 shrink-0">
                                {[
                                    { label: 'Created', count: csvUploadResult.summary?.created_count ?? 0, color: 'text-[#15803d]', bg: 'bg-[#f0fdf4]', border: 'border-[#d1fae5]', tab: 'created' },
                                    { label: 'Updated', count: csvUploadResult.summary?.updated_count ?? 0, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', tab: 'updated' },
                                    { label: 'Errors', count: csvUploadResult.summary?.error_count ?? 0, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', tab: 'errors' },
                                ].map(({ label, count, color, bg, border, tab }) => (
                                    <button
                                        key={tab}
                                        onClick={() => setCsvResultTab(tab)}
                                        className={`rounded-xl border p-3 text-left transition ${bg} ${border} ${
                                            csvResultTab === tab ? 'ring-2 ring-offset-1 ring-[#15803d]/40' : 'hover:opacity-80'
                                        }`}
                                    >
                                        <p className={`text-2xl font-black ${color}`}>{count}</p>
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">{label}</p>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Tab strip */}
                        {!csvUploadResult._validationErrors && (
                            <div className="px-6 pt-4 flex gap-1 shrink-0 border-b border-slate-100">
                                {['created', 'updated', 'errors'].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setCsvResultTab(t)}
                                        className={`px-4 py-2 rounded-t-lg text-[12.5px] font-bold capitalize transition ${
                                            csvResultTab === t
                                                ? 'bg-white border-x border-t border-slate-200 text-[#0f172a] -mb-px'
                                                : 'text-[#64748b] hover:text-[#0f172a]'
                                        }`}
                                    >{t}</button>
                                ))}
                            </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-2">
                            {csvUploadResult._validationErrors ? (
                                // Validation error rows
                                csvUploadResult._validationErrors.map((err, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                                        <span className="shrink-0 w-7 h-7 rounded-lg bg-red-100 text-red-600 text-[11px] font-black flex items-center justify-center">
                                            {err.sl_no || i + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-semibold text-[#0f172a] truncate">{err.email || '—'}</p>
                                            <ul className="mt-0.5 space-y-0.5">
                                                {err.errors.map((e, j) => (
                                                    <li key={j} className="text-[12px] text-red-600 font-medium">• {e}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                ))
                            ) : csvResultTab === 'created' ? (
                                csvUploadResult.created?.length > 0 ? (
                                    csvUploadResult.created.map((u, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#f0fdf4] border border-[#d1fae5]">
                                            <div className="w-8 h-8 rounded-full bg-[#15803d] text-white text-[13px] font-bold flex items-center justify-center shrink-0">
                                                {u.name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13.5px] font-semibold text-[#0f172a] truncate">{u.name || '—'}</p>
                                                <p className="text-[12px] text-[#64748b] truncate">{u.email}</p>
                                            </div>
                                            <span className="shrink-0 text-[10.5px] font-bold text-[#15803d] bg-white border border-[#d1fae5] px-2 py-0.5 rounded-full">NEW</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-[13.5px] text-[#94a3b8] py-8">No new users were created.</p>
                                )
                            ) : csvResultTab === 'updated' ? (
                                csvUploadResult.updated?.length > 0 ? (
                                    csvUploadResult.updated.map((u, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-[13px] font-bold flex items-center justify-center shrink-0">
                                                {u.name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13.5px] font-semibold text-[#0f172a] truncate">{u.name || '—'}</p>
                                                <p className="text-[12px] text-[#64748b] truncate">{u.email}</p>
                                            </div>
                                            <span className="shrink-0 text-[10.5px] font-bold text-blue-700 bg-white border border-blue-200 px-2 py-0.5 rounded-full">UPDATED</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-[13.5px] text-[#94a3b8] py-8">No existing users were updated.</p>
                                )
                            ) : (
                                csvUploadResult.errors?.length > 0 ? (
                                    csvUploadResult.errors.map((err, i) => (
                                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                                            <p className="text-[13px] text-red-700 font-medium">{JSON.stringify(err)}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-[13.5px] text-[#94a3b8] py-8">No errors reported.</p>
                                )
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end shrink-0">
                            <button
                                id="btn-csv-results-close"
                                type="button"
                                onClick={() => setCsvUploadResult(null)}
                                className="px-5 py-2.5 text-[13px] font-semibold text-[#4a6b58] border border-[#d1fae5] bg-white hover:bg-[#f0fdf4] rounded-xl transition"
                            >Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
