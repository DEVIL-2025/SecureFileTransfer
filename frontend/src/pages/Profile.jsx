import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import {
  User,
  Mail,
  Edit2,
  Clock,
  Key,
  Lock,
  CheckCircle,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';

export default function Profile() {
  const { user: authUser, updateUserData } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Profile Edit Modal State
  const [editModal, setEditModal] = useState({
    open: false,
    focusPassword: false,
    newUsername: '',
    newEmail: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    error: '',
    loading: false
  });

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users/profile');
      setProfile(res.data);
      return res.data;
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const openEditModal = (focusPassword = false) => {
    setEditModal({
      open: true,
      focusPassword,
      newUsername: profile?.username || authUser?.username || '',
      newEmail: profile?.email || authUser?.email || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      error: '',
      loading: false
    });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setEditModal((prev) => ({ ...prev, loading: true, error: '' }));

    if (editModal.newPassword) {
      if (!editModal.currentPassword) {
        setEditModal((prev) => ({
          ...prev,
          loading: false,
          error: 'Current password is required to change your password.'
        }));
        return;
      }
      if (editModal.newPassword !== editModal.confirmPassword) {
        setEditModal((prev) => ({
          ...prev,
          loading: false,
          error: 'New passwords do not match.'
        }));
        return;
      }
      if (editModal.newPassword.length < 6) {
        setEditModal((prev) => ({
          ...prev,
          loading: false,
          error: 'New password must be at least 6 characters long.'
        }));
        return;
      }
    }

    try {
      const res = await api.post('/users/update-profile', {
        username: editModal.newUsername || undefined,
        email: editModal.newEmail || undefined,
        currentPassword: editModal.currentPassword || undefined,
        newPassword: editModal.newPassword || undefined
      });

      showToast(res.data.message || 'Profile updated successfully!');
      if (res.data.user) {
        updateUserData(res.data.user);
      }

      setEditModal((prev) => ({
        ...prev,
        open: false,
        loading: false
      }));

      fetchProfile();
    } catch (err) {
      setEditModal((prev) => ({
        ...prev,
        error: err.response?.data?.error || err.message,
        loading: false
      }));
    }
  };

  const currentUsername = profile?.username || authUser?.username || 'User';
  const currentEmail = profile?.email || authUser?.email || '';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-serif">
            Profile Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
            Manage your personal account details and security credentials.
          </p>
        </div>

        <button
          onClick={() => openEditModal(false)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl btn-gradient-primary text-white text-xs font-bold uppercase tracking-wider shadow-xs transition-all cursor-pointer min-h-[38px]"
        >
          <Edit2 className="w-4 h-4" />
          <span>Edit Profile</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 font-semibold text-sm">
          Loading profile...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* Card 1: Personal Information */}
          <div className="soft-card p-6 sm:p-8 rounded-2xl sm:rounded-3xl space-y-6 border-slate-200">
            {/* Avatar & Identity */}
            <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#070B14] via-[#0F172A] to-[#1E293B] text-white flex items-center justify-center font-bold text-2xl shadow-xs shrink-0 font-serif">
                {currentUsername.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
                  @{currentUsername}
                </h2>
                <p className="text-xs font-medium text-slate-600 truncate">
                  {currentEmail}
                </p>
                <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] text-[11px] font-extrabold">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  Active Account
                </span>
              </div>
            </div>

            {/* Info Fields */}
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-600 flex items-center gap-2 shrink-0">
                  <User className="w-4 h-4 text-slate-500" />
                  Username
                </span>
                <span className="font-extrabold text-slate-900 truncate">@{currentUsername}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-600 flex items-center gap-2 shrink-0">
                  <Mail className="w-4 h-4 text-slate-500" />
                  Email
                </span>
                <span className="font-extrabold text-slate-900 truncate max-w-[200px]">{currentEmail}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-600 flex items-center gap-2 shrink-0">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Member Since
                </span>
                <span className="font-extrabold text-slate-900 truncate">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Active'}
                </span>
              </div>
            </div>

            <button
              onClick={() => openEditModal(false)}
              className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-900 text-xs font-bold uppercase transition-all cursor-pointer min-h-[38px]"
            >
              Change Username or Email
            </button>
          </div>

          {/* Card 2: Security & Password */}
          <div className="soft-card p-6 sm:p-8 rounded-2xl sm:rounded-3xl space-y-6 border-slate-200">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 font-serif flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0077B6]" />
                <span>Security & Password</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Manage your login credentials and security settings.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-600 flex items-center gap-2 shrink-0">
                  <Lock className="w-4 h-4 text-slate-500" />
                  Password
                </span>
                <span className="font-mono text-slate-700 tracking-wider">••••••••••••</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-600 flex items-center gap-2 shrink-0">
                  <Key className="w-4 h-4 text-slate-500" />
                  Password Security
                </span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Bcrypt Encrypted</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-600 flex items-center gap-2 shrink-0">
                  <ShieldCheck className="w-4 h-4 text-slate-500" />
                  End-to-End Encryption
                </span>
                <span className="text-[#0077B6] font-bold">Client ECDH + AES-256</span>
              </div>
            </div>

            <button
              onClick={() => openEditModal(true)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase transition-all cursor-pointer min-h-[38px] shadow-xs"
            >
              Change Password
            </button>
          </div>

        </div>
      )}

      {/* Edit Profile / Password Modal */}
      <Modal
        isOpen={editModal.open}
        onClose={() => setEditModal((prev) => ({ ...prev, open: false, error: '' }))}
        title="Update Account Settings"
      >
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          {editModal.error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{editModal.error}</span>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-900" />
              <span>Account Information</span>
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={editModal.newUsername}
                onChange={(e) => setEditModal((prev) => ({ ...prev, newUsername: e.target.value }))}
                placeholder="Enter username"
                className="w-full px-4 py-2.5 soft-input rounded-xl outline-none text-slate-900 font-semibold text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={editModal.newEmail}
                onChange={(e) => setEditModal((prev) => ({ ...prev, newEmail: e.target.value }))}
                placeholder="Enter email address"
                className="w-full px-4 py-2.5 soft-input rounded-xl outline-none text-slate-900 font-semibold text-sm"
                required
              />
            </div>
          </div>

          {/* Section 2: Security & Password */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-900" />
              <span>Change Password (Optional)</span>
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Current Password <span className="text-slate-400 font-normal">(Required if changing password)</span>
              </label>
              <input
                type="password"
                value={editModal.currentPassword}
                onChange={(e) => setEditModal((prev) => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="Enter current password"
                className="w-full px-4 py-2.5 soft-input rounded-xl outline-none text-slate-900 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={editModal.newPassword}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Min 6 characters"
                  className="w-full px-4 py-2.5 soft-input rounded-xl outline-none text-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={editModal.confirmPassword}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm password"
                  className="w-full px-4 py-2.5 soft-input rounded-xl outline-none text-slate-900 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setEditModal((prev) => ({ ...prev, open: false, error: '' }))}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-700 hover:text-slate-900 text-xs font-bold uppercase cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editModal.loading}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl btn-gradient-primary text-white text-xs font-bold uppercase tracking-wider shadow-xs transition-all disabled:opacity-50 cursor-pointer text-center"
            >
              {editModal.loading ? 'Saving Changes...' : 'Save All Changes'}
            </button>
          </div>
        </form>
      </Modal>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
