import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import ProfileHeader from '../components/ProfileHeader';
import ProfileCompletionCard from '../components/ProfileCompletionCard';
import ProfileForm from '../components/ProfileForm';
import profileApi from '../api/profileApi';
import { useAuth } from '../hooks/useAuth';
import { CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast'


const DetailItem = ({ label, value }) => (
  <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
    <p className="text-sm font-semibold text-gray-800 mt-1 break-words">
      {value || 'Not added'}
    </p>
  </div>
);

const Profile = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const { updateUser } = useAuth();

  // Load user profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const profileData = await profileApi.getCurrentProfile();
        setUser(profileData);
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError('Failed to load profile. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleProfileUpdate = (updatedUser) => {
    setUser(updatedUser);
  };

  const handleProfileSaved = (updatedUser) => {
    setUser(updatedUser);
    updateUser?.(updatedUser);
    setShowEditModal(false);
    toast.success('Profile updated successfully.');
  };

  // Calculate booking eligibility
  const canBookResources = user && (
    user.first_name &&
    user.phone &&
    user.department &&
    user.employee_student_id
  );

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="flex items-center space-x-2 text-gray-600">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading profile...</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-4 sm:p-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            <p className="text-sm text-gray-500 mt-1">
            Manage your institutional profile and booking eligibility
            </p>
          </div>
        </div>

        {/* Profile Header Card */}
        <ProfileHeader user={user} onEdit={() => setShowEditModal(true)} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <div className="xl:col-span-2 space-y-6">
            {/* Account details */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-gray-900">Account Details</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Your information used across booking requests and approvals.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailItem
                  label="Full Name"
                  value={[user.first_name, user.last_name].filter(Boolean).join(' ')}
                />
                <DetailItem label="Email" value={user.email} />
                <DetailItem label="Phone" value={user.phone} />
                <DetailItem label="Department" value={user.department_name} />
                <DetailItem label="Designation" value={user.designation} />
                <DetailItem
                  label="Role"
                  value={(user.effective_roles || []).map((role) => role.replaceAll('_', ' ')).join(', ')}
                />
              </div>
            </div>

          </div>

          <div className="space-y-6">
            {/* Profile Completion Status */}
            <ProfileCompletionCard user={user} />

            {/* Booking Eligibility Notice */}
            {canBookResources && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <p className="text-green-800 text-sm font-medium">
                    Your profile is complete and verified for booking services
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {showEditModal && (
        <ProfileForm
          user={user}
          onUpdate={handleProfileUpdate}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleProfileSaved}
        />
      )}
    </MainLayout>
  );
};

export default Profile
