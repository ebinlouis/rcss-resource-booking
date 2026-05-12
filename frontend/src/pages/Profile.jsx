import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import ProfileHeader from '../components/ProfileHeader';
import ProfileCompletionCard from '../components/ProfileCompletionCard';
import ProfileForm from '../components/ProfileForm';
import profileApi from '../api/profileApi';
import { Loader2 } from 'lucide-react';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 mt-1">
            Manage your institutional profile and booking eligibility
          </p>
        </div>

        {/* Profile Header Card */}
        <ProfileHeader user={user} />

        {/* Profile Completion Status */}
        <ProfileCompletionCard user={user} />

        {/* Profile Form */}
        <ProfileForm user={user} onUpdate={handleProfileUpdate} />

        {/* Booking Eligibility Notice */}
        {canBookResources && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-green-800 font-medium">
                Your profile is complete and verified for booking services
              </p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Profile
