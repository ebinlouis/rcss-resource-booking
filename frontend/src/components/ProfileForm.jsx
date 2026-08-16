import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Loader2, Save, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import profileApi from '../api/profileApi';

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition disabled:bg-gray-50 disabled:text-gray-400';

const ProfileForm = ({ user, onUpdate, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [departments, setDepartments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const previewObjectRef = useRef('');

  useEffect(() => {
    if (!user) return undefined;

    const timer = window.setTimeout(() => {
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        designation: user.designation || '',
        department: user.department ?? '',
      });
      setPreviewUrl(user.profile_image || '');
      setImageFile(null);
      setError('');
      setFieldErrors({});
    }, 0);

    return () => window.clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    return () => {
      if (previewObjectRef.current) {
        URL.revokeObjectURL(previewObjectRef.current);
      }
    };
  }, []);

  useEffect(() => {
    profileApi.getDepartments()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.results ?? []);
        setDepartments(list);
      })
      .catch(() => {
        // Department loading is non-critical; the rest of the profile can still be edited.
      });
  }, []);

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const fullName = [form.first_name, form.last_name].filter(Boolean).join(' ') || 'User';
  const initials = fullName
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        profile_image: 'Upload a JPG, PNG, JPEG, or WEBP image.',
      }));
      return;
    }

    setFieldErrors((prev) => ({ ...prev, profile_image: '' }));
    if (previewObjectRef.current) {
      URL.revokeObjectURL(previewObjectRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    previewObjectRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setImageFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setFieldErrors({});

    const selectedDepartment = departments.find((d) => String(d.id) === String(form.department));
    const optimisticUser = {
      ...user,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      designation: form.designation.trim(),
      department: form.department || null,
      department_name: selectedDepartment?.department_name || user?.department_name,
      profile_image: previewUrl || user?.profile_image,
    };

    try {
      onUpdate?.(optimisticUser);

      const payload = new FormData();
      payload.append('first_name', form.first_name.trim());
      payload.append('last_name', form.last_name.trim());
      payload.append('email', form.email.trim());
      payload.append('phone', form.phone.trim());
      payload.append('designation', form.designation.trim());

      if (form.department) {
        payload.append('department', Number(form.department));
      }
      if (imageFile) {
        payload.append('profile_image', imageFile);
      }

      const updated = await profileApi.updateProfile(payload);
      setImageFile(null);
      onUpdate?.(updated);
      onSuccess?.(updated);
    } catch (err) {
      onUpdate?.(user);
      const errData = err?.response?.data;
      if (errData && typeof errData === 'object') {
        const fields = {};
        let generic = '';
        Object.entries(errData).forEach(([key, val]) => {
          const msg = Array.isArray(val) ? val.join(' ') : String(val);
          if (key === 'non_field_errors' || key === 'detail') {
            generic += `${msg} `;
          } else {
            fields[key] = msg;
          }
        });
        setFieldErrors(fields);
        const errMsg = generic.trim() || Object.values(fields)[0] || 'Failed to update profile. Please check the form errors.';
        if (generic) setError(generic.trim());
        toast.error(errMsg);
      } else {
        const errMsg = 'Failed to update profile. Please try again.';
        setError(errMsg);
        toast.error(errMsg);
      }
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4 animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-white">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Edit Profile</h3>
            <p className="text-sm text-gray-400 mt-0.5">
              Update your contact details and profile photo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition disabled:opacity-50"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-5 rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
              <div className="relative w-24 h-24 shrink-0">
                <div 
                  className="w-24 h-24 rounded-full overflow-hidden text-white flex items-center justify-center text-2xl font-bold shadow-sm"
                  style={previewUrl ? {} : { background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)' }}
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl.startsWith('blob:') || previewUrl.startsWith('http') ? previewUrl : `http://localhost:8000${previewUrl.startsWith('/') ? '' : '/'}${previewUrl}`}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="absolute -right-1 -bottom-1 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-green-700">
                  <Camera className="w-4 h-4" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Profile Photo</p>
                <p className="text-xs text-gray-500 mt-1">
                  JPG, PNG, JPEG, or WEBP. The preview is shown in a circular crop.
                </p>
                <label className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition cursor-pointer shadow-sm">
                  <Upload className="w-4 h-4 text-green-700" />
                  {previewUrl ? 'Change Photo' : 'Upload Photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg,image/webp"
                    className="sr-only"
                    onChange={handleImageSelect}
                  />
                </label>
                {fieldErrors.profile_image && (
                  <p className="text-xs text-red-500 mt-2">{fieldErrors.profile_image}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-400">*</span>
                </label>
                <input
                  className={inputCls}
                  value={form.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                  placeholder="e.g. John"
                  required
                />
                {fieldErrors.first_name && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.first_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  className={inputCls}
                  value={form.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                  placeholder="e.g. Doe"
                />
                {fieldErrors.last_name && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.last_name}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  className={inputCls}
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="name@rajalakshmi.edu.in"
                  type="email"
                  required
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  className={inputCls}
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  type="tel"
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Designation
                </label>
                <input
                  className={inputCls}
                  value={form.designation}
                  onChange={(e) => set('designation', e.target.value)}
                  placeholder="e.g. Associate Professor"
                />
                {fieldErrors.designation && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.designation}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department <span className="text-red-400">*</span>
                </label>
                <select
                  className={inputCls}
                  value={form.department}
                  onChange={(e) => set('department', e.target.value)}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.department_name} ({d.department_code})
                    </option>
                  ))}
                </select>
                {fieldErrors.department && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.department}</p>
                )}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 text-sm font-semibold rounded-xl transition disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-xl transition disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default ProfileForm;
