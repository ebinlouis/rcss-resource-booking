import React from 'react';

const ProfileHeader = ({ user }) => {
  if (!user) return null;

  const initials = user.first_name
    ? user.first_name.charAt(0).toUpperCase()
    : user.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-5">
        {/* Avatar */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-sm shrink-0"
          style={{ background: 'linear-gradient(135deg, #14532d, #1e3a5f)' }}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">
            {user.first_name}
            {user.last_name ? ` ${user.last_name}` : ''}
          </h2>
          <p className="text-sm text-gray-500 truncate">{user.email}</p>
          {user.employee_student_id && (
            <p className="text-xs font-mono text-gray-400 mt-1">
              ID: {user.employee_student_id}
            </p>
          )}
        </div>

        {/* Role badge */}
        {user.effective_role && (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-100 shrink-0">
            {user.effective_role}
          </span>
        )}
      </div>
    </div>
  );
};

export default ProfileHeader;
