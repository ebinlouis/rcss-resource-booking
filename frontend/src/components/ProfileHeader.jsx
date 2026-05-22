import React from 'react';
import { Pencil } from 'lucide-react';

const ProfileHeader = ({ user, onEdit }) => {
  if (!user) return null;

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';
  const initials = fullName
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';
  const roles = user.effective_roles || (user.effective_role ? [user.effective_role] : []);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-white text-2xl font-bold shadow-sm shrink-0 bg-green-700">
          {user.profile_image ? (
            <img
              src={user.profile_image}
              alt={`${fullName} profile`}
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">
            {fullName}
          </h2>
          <p className="text-sm text-gray-500 truncate">{user.email}</p>
          {user.department_name && (
            <p className="text-sm text-gray-500 truncate mt-0.5">{user.department_name}</p>
          )}
          {user.employee_student_id && (
            <p className="text-xs font-mono text-gray-400 mt-1">
              ID: {user.employee_student_id}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:items-end gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-2xl shadow-sm text-sm font-semibold transition-all"
          >
            <Pencil className="w-4 h-4" />
            Edit Profile
          </button>

          {/* Role badge */}
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {roles.length > 0 ? roles.map((role) => (
              <span
                key={role}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-100 shrink-0"
              >
                {role.replaceAll('_', ' ')}
              </span>
            )) : (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 border border-gray-100 shrink-0">
                User
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
