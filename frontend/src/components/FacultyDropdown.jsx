import React, { useState, useEffect } from 'react';
import spaceAdminService from '../api/spaceAdminService';

export default function FacultyDropdown({ value, onChange, disabled, error, departmentId }) {
    const [facultyList, setFacultyList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);

    useEffect(() => {
        const fetchList = async () => {
            try {
                if (!departmentId) {
                    setFacultyList([]);
                    setLoading(false);
                    return;
                }
                setLoading(true);
                const list = await spaceAdminService.fetchFacultyList(departmentId);
                setFacultyList(list);
            } catch (err) {
                console.error("Failed to load faculty list", err);
                setFetchError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchList();
    }, [departmentId]);

    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">
                Please select faculty <span className="text-red-400 ml-0.5">*</span>
            </label>
            <div className="relative">
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled || loading}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white outline-none transition focus:ring-2 focus:ring-green-700 focus:border-transparent placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 ${error ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                    <option value="">{loading ? "Loading faculty list..." : (!departmentId ? "Select a department first" : "Select a faculty member")}</option>
                    {facultyList.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
            {error && (
                <p className="text-xs text-red-500 mt-0.5">
                    {error}
                </p>
            )}
            {!error && fetchError && (
                <p className="text-xs text-red-500 mt-0.5">
                    Failed to load faculty. Please check your connection.
                </p>
            )}
            {!error && !fetchError && (
                <p className="text-xs text-gray-400 mt-0.5">
                    Required for student bookings. Your request will be sent to them for approval first.
                </p>
            )}
        </div>
    );
}
