import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const REQUIRED_FIELDS = [
  { key: 'first_name', label: 'First Name' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'department', label: 'Department' },
];

const ProfileCompletionCard = ({ user }) => {
  if (!user) return null;

  const completed = REQUIRED_FIELDS.filter((f) => !!user[f.key]);
  const missing = REQUIRED_FIELDS.filter((f) => !user[f.key]);
  const percent = Math.round((completed.length / REQUIRED_FIELDS.length) * 100);
  const isComplete = missing.length === 0;

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 ${isComplete ? 'border-green-100' : 'border-yellow-100'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-yellow-500" />
          )}
          <h3 className="text-sm font-semibold text-gray-900">
            Profile Completion — {percent}%
          </h3>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${isComplete ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
          {isComplete ? 'Complete' : `${missing.length} missing`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full mb-4">
        <div
          className={`h-1.5 rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-yellow-400'}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {!isComplete && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 font-medium mb-2">
            Complete your profile to enable bookings:
          </p>
          {missing.map((f) => (
            <div key={f.key} className="flex items-center gap-2 text-xs text-yellow-700">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
              {f.label} is required
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfileCompletionCard;
