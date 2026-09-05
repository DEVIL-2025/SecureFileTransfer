import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import {
  User,
  Mail,
  Send,
  Download,
  Edit2,
  Clock,
  Trash2,
  Search,
  Key,
  Lock,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2
} from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function Profile() {
  const { user: authUser, updateUserData } = useAuth();
  const [profile, setProfile] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transfersOffset, setTransfersOffset] = useState(0);
  const [hasMoreTransfers, setHasMoreTransfers] = useState(true);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  
  // Profile Edit Modal State
  const [editModal, setEditModal] = useState({
    open: false,
    activeTab: 'general',
    newUsername: '',
    newEmail: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    error: '',
    loading: false
  });

  const [clearHistoryModal, setClearHistoryModal] = useState({ open: false, loading: false });
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchProfile = async () => {
    try {
      const res = await api.get('/users/profile');
      setProfile(res.data);
      return res.data;
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const fetchTransfers = async (offset = 0, reset = false) => {
    try {
      const res = await api.get(`/users/transfers?start=${offset}&limit=10`);
      const data = res.data || [];
      if (reset) {
        setTransfers(data);
      } else {
        setTransfers((prev) => [...prev, ...data]);
      }
      setHasMoreTransfers(data.length === 10);
      setTransfersOffset(offset + data.length);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchTransfers(0, true)]);
      setLoading(false);
    };
    init();
  }, []);

  const openEditModal = () => {
    setEditModal({
      open: true,
      activeTab: 'general',
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

  const handleClearHistoryConfirm = async () => {
    setClearHistoryModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.post('/users/transfers/clear');
      showToast(res.data.message || 'Transfer history cleared.');
      setClearHistoryModal({ open: false, loading: false });
      fetchTransfers(0, true);
    } catch (err) {
      showToast(err.message, 'error');
      setClearHistoryModal({ open: false, loading: false });
    }
  };

  const filteredTransfers = transfers.filter((t) => {
    const q = historySearchQuery.toLowerCase();
    const filename = (t.filename || '').toLowerCase();
    const sender = (t.sender || '').toLowerCase();
    const receiver = (t.receiver || '').toLowerCase();
    return filename.includes(q) || sender.includes(q) || receiver.includes(q);
  });

  // Limit items in compact view to 5 rows to prevent column height stretching
  const visibleTransfers = isHistoryExpanded ? filteredTransfers : filteredTransfers.slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
            ACCOUNT OVERVIEW
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            User Profile
          </h1>
        </div>

        <button
          onClick={openEditModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl btn-gradient-primary text-white text-xs font-bold uppercase tracking-wider shadow-xs transition-all cursor-pointer min-h-[38px]"
        >
          <Edit2 className="w-4 h-4" />
          <span>Edit Profile Details</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        
        {/* Left Column: Account Details Card (Fixed height proportion) */}
        <div className="soft-card p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl space-y-6 flex flex-col justify-between border-slate-200">
          <div className="space-y-6">
            
            {/* User Avatar & Identity */}
            <div className="flex items-center gap-3 sm:gap-4 border-b border-slate-200 pb-6">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#070B14] via-[#0F172A] to-[#1E293B] text-white flex items-center justify-center font-bold text-xl sm:text-2xl shadow-xs shrink-0">
                {(profile?.username || authUser?.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
                  @{profile?.username || authUser?.username}
                </h2>
                <p className="text-xs font-medium text-slate-600 truncate">
                  {profile?.email || authUser?.email}
                </p>
                <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] text-[11px] font-extrabold">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  Active User
                </span>
              </div>
            </div>

            {/* Profile Info Fields */}
            <div className="space-y-3 text-xs">
              <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-600 flex items-center gap-2 shrink-0">
                  <User className="w-4 h-4 text-slate-500" />
                  Username:
                </span>
                <span className="font-extrabold text-slate-900 truncate">@{profile?.username || authUser?.username}</span>
              </div>

              <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-600 flex items-center gap-2 shrink-0">
                  <Mail className="w-4 h-4 text-slate-500" />
                  Email:
                </span>
                <span className="font-extrabold text-slate-900 truncate max-w-[140px] xs:max-w-[200px] sm:max-w-[160px] md:max-w-[200px]">{profile?.email || authUser?.email}</span>
              </div>

              <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-600 flex items-center gap-2 shrink-0">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Member Since:
                </span>
                <span className="font-extrabold text-slate-900 truncate">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Active'}
                </span>
              </div>
            </div>

            {/* Transfer Stats */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-2">
              <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                <div className="flex items-center justify-center gap-1 text-slate-600 text-xs font-bold">
                  <Send className="w-3.5 h-3.5 text-slate-900" />
                  <span>Files Sent</span>
                </div>
                <p className="text-xl sm:text-2xl font-black text-slate-900">{profile?.sent || 0}</p>
              </div>

              <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                <div className="flex items-center justify-center gap-1 text-slate-600 text-xs font-bold">
                  <Download className="w-3.5 h-3.5 text-[#065F46]" />
                  <span>Received</span>
                </div>
                <p className="text-xl sm:text-2xl font-black text-slate-900">{profile?.received || 0}</p>
              </div>
            </div>

          </div>

          <button
            onClick={openEditModal}
            className="w-full mt-6 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-900 text-xs font-bold uppercase transition-all cursor-pointer min-h-[38px]"
          >
            Update Account Settings
          </button>
        </div>

        {/* Right Column: Controlled Height Transfer History Activity */}
        <div className="lg:col-span-2 soft-card p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl space-y-6 border-slate-200 flex flex-col justify-between">
          <div className="space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Transfer History ({filteredTransfers.length})
                </h2>
                {filteredTransfers.length > 5 && (
                  <button
                    onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    {isHistoryExpanded ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>Collapse</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Expand</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {transfers.length > 0 && (
                <button
                  onClick={() => setClearHistoryModal({ open: true, loading: false })}
                  className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer self-start sm:self-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear History</span>
                </button>
              )}
            </div>

            {/* Search History Filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder="Search file name, sender, or receiver..."
                className="w-full pl-10 pr-4 py-2.5 soft-input rounded-xl text-sm font-semibold placeholder:text-slate-500 outline-none"
              />
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-600 font-semibold text-sm">
                Loading transfer history...
              </div>
            ) : transfers.length === 0 ? (
              <div className="text-center py-12 sm:py-16 px-4 text-slate-600 border border-dashed border-slate-300 rounded-2xl space-y-2 font-medium">
                <p className="font-bold text-slate-900">No transfer history yet</p>
                <p className="text-xs">Your completed file transfers will be logged here.</p>
              </div>
            ) : filteredTransfers.length === 0 ? (
              <div className="text-center py-10 text-slate-600 font-medium border border-dashed border-slate-300 rounded-2xl text-sm">
                No transfers match "{historySearchQuery}".
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Mobile View: Cards (< sm) */}
                <div className={`space-y-3 block sm:hidden ${
                  isHistoryExpanded ? 'max-h-[500px] overflow-y-auto' : 'max-h-[350px] overflow-y-auto'
                }`}>
                  {visibleTransfers.map((t, idx) => {
                    const isSender = t.sender === (profile?.username || authUser?.username);
                    return (
                      <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-900 truncate max-w-[190px]" title={t.filename}>
                            {t.filename}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#ECFDF5] text-[#065F46] font-bold text-[10px] shrink-0">
                            {t.status || 'completed'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600 gap-2">
                          <span className={`inline-flex items-center gap-1 font-bold truncate ${
                            isSender ? 'text-slate-900' : 'text-[#065F46]'
                          }`}>
                            {isSender ? <Send className="w-3 h-3 shrink-0" /> : <Download className="w-3 h-3 shrink-0" />}
                            {isSender ? 'To' : 'From'} @{isSender ? t.receiver : t.sender}
                          </span>
                          <span className="font-mono text-slate-500 shrink-0">{formatBytes(t.file_size)}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 text-right border-t border-slate-100 pt-1.5">
                          {t.timestamp ? new Date(t.timestamp).toLocaleDateString() : 'Recent'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Table (>= sm) */}
                <div className={`hidden sm:block overflow-x-auto rounded-xl border border-slate-100 ${
                  isHistoryExpanded ? 'max-h-[500px] overflow-y-auto' : 'max-h-[300px] overflow-y-auto'
                }`}>
                  <table className="min-w-[550px] w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-10">
                      <tr className="border-b border-slate-200 text-slate-700 font-extrabold uppercase">
                        <th className="py-2.5 px-3">File</th>
                        <th className="py-2.5 px-3">Direction</th>
                        <th className="py-2.5 px-3">Peer</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800 bg-white">
                      {visibleTransfers.map((t, idx) => {
                        const isSender = t.sender === (profile?.username || authUser?.username);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-slate-900 max-w-[140px] truncate" title={t.filename}>
                              {t.filename}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex items-center gap-1 font-bold ${
                                isSender ? 'text-slate-900' : 'text-[#065F46]'
                              }`}>
                                {isSender ? <Send className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                                {isSender ? 'Sent' : 'Received'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              @{isSender ? t.receiver : t.sender}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {formatBytes(t.file_size)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-[#ECFDF5] text-[#065F46] font-bold text-[10px]">
                                {t.status || 'completed'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                              {t.timestamp ? new Date(t.timestamp).toLocaleDateString() : 'Recent'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Expand / Collapse Control */}
                {filteredTransfers.length > 5 && (
                  <button
                    onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                    className="w-full py-2 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                  >
                    {isHistoryExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4 text-slate-600" />
                        <span>Collapse Transfer History</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                        <span>Expand to View All ({filteredTransfers.length} Records)</span>
                      </>
                    )}
                  </button>
                )}

                {/* Load More Pagination (Only when expanded or more exist) */}
                {hasMoreTransfers && isHistoryExpanded && (
                  <button
                    onClick={() => fetchTransfers(transfersOffset)}
                    className="w-full py-2 border border-slate-300 hover:bg-slate-50 rounded-xl text-slate-900 text-xs font-bold uppercase transition-all cursor-pointer"
                  >
                    Load Older Transfers
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Comprehensive Profile Updation Modal */}
      <Modal
        isOpen={editModal.open}
        onClose={() => setEditModal((prev) => ({ ...prev, open: false, error: '' }))}
        title="Update Profile Details"
      >
        <form onSubmit={handleUpdateProfile} className="space-y-5 text-sm font-medium">
          
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
              <span>Personal Information</span>
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
                className="w-full px-4 py-2.5 soft-input rounded-xl outline-none text-slate-900 font-semibold"
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
                className="w-full px-4 py-2.5 soft-input rounded-xl outline-none text-slate-900 font-semibold"
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
                Current Password <span className="text-slate-400 font-normal">(Required if setting a new password)</span>
              </label>
              <input
                type="password"
                value={editModal.currentPassword}
                onChange={(e) => setEditModal((prev) => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="Enter your current password"
                className="w-full px-4 py-2.5 soft-input rounded-xl outline-none text-slate-900"
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
                  className="w-full px-4 py-2.5 soft-input rounded-xl outline-none text-slate-900"
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
                  placeholder="Re-enter new password"
                  className="w-full px-4 py-2.5 soft-input rounded-xl outline-none text-slate-900"
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

      {/* Clear Transfer History Confirmation Modal */}
      <Modal
        isOpen={clearHistoryModal.open}
        onClose={() => setClearHistoryModal({ open: false, loading: false })}
        title="Clear Transfer History"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 font-medium">
            Are you sure you want to clear your transfer history logs? This action cannot be undone.
          </p>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setClearHistoryModal({ open: false, loading: false })}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-700 hover:text-slate-900 text-sm font-bold cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={clearHistoryModal.loading}
              onClick={handleClearHistoryConfirm}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer text-center"
            >
              {clearHistoryModal.loading ? 'Clearing...' : 'Clear History'}
            </button>
          </div>
        </div>
      </Modal>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
