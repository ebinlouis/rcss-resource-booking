import React, { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import profileApi from '../api/profileApi';

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition disabled:bg-gray-50 disabled:text-gray-400';

const ProfileForm = ({ user, onUpdate }) => {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    designation: '',
    department: '',
  });
  const [departments, setDepartments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Pre-fill form from user prop
  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
        designation: user.designation || '',
        // Department FK returns the ID in the me/ response
        department: user.department ?? '',
      });
    }
  }, [user]);

  // Fetch departments for the select dropdown
  useEffect(() => {
    profileApi.getDepartments()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.results ?? []);
        setDepartments(list);
      })
      .catch(() => {
        // Non-critical; user can still save other fields
      });
  }, []);

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    setFieldErrors({});

    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        designation: form.designation.trim(),
      };
      // Only include department if the user selected one
      if (form.department) {
        payload.department = Number(form.department);
      }

      const updated = await profileApi.updateProfile(payload);
      setSuccess('Profile updated successfully.');
      onUpdate?.(updated);
    } catch (err) {
      const errData = err?.response?.data;
      if (errData && typeof errData === 'object') {
        const fields = {};
        let generic = '';
        Object.entries(errData).forEach(([key, val]) => {
          const msg = Array.isArray(val) ? val.join(' ') : String(val);
          if (key === 'non_field_errors' || key === 'detail') {
            generic += msg + ' ';
          } else {
            fields[key] = msg;
          }
        });
        setFieldErrors(fields);
        if (generic) setError(generic.trim());
      } else {
        setError('Failed to update profile. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-5">Edit Profile</h3>

      {success && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-100 text-sm text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* First Name */}
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

          {/* Last Name */}
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

          {/* Phone */}
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

          {/* Designation */}
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

          {/* Department */}
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

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-xl transition disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileForm;
