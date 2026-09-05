import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../api/client';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import {
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Search,
  Trash2,
  ArrowRight,
  Clock,
  File,
  CheckCircle2,
  Users,
  Activity,
  Radio
} from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function Dashboard() {
  const { user } = useAuth();
  const { onlineUsers } = useSocket() || {};
  const [transfers, setTransfers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [clearModal, setClearModal] = useState({ open: false, loading: false });
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchContacts = async () => {
    try {
      const res = await api.get('/contacts');
      setContacts(res.data.contacts || []);
    } catch (err) {
      console.error('Failed to load contacts for dashboard:', err);
    }
  };

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users/transfers?limit=100');
      setTransfers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      showToast(err.message || 'Failed to load transfer history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
    fetchContacts();
  }, []);

  const handleClearHistory = async () => {
    setClearModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.post('/users/transfers/clear');
      showToast(res.data.message || 'Transfer history cleared.');
      setClearModal({ open: false, loading: false });
      setTransfers([]);
    } catch (err) {
      showToast(err.message || 'Failed to clear transfer history', 'error');
      setClearModal({ open: false, loading: false });
    }
  };

  const filteredTransfers = transfers.filter((t) => {
    const q = searchQuery.toLowerCase();
    const filename = (t.filename || '').toLowerCase();
    const sender = (t.sender || '').toLowerCase();
    const receiver = (t.receiver || '').toLowerCase();
    return filename.includes(q) || sender.includes(q) || receiver.includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-cyan-200/80 pb-6 gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#0077B6]">
            REAL-TIME TRANSFERS
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2.5 sm:gap-3 font-serif">
            <Activity className="w-7 h-7 sm:w-8 sm:h-8 text-[#0077B6] shrink-0" />
            <span>Transfer Activity Hub</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-semibold mt-1">
            Zero server file storage. All transfers stream directly between authenticated peers with End-to-End Encryption.
          </p>
        </div>

        {/* Quick Launch Button */}
        <Link
          to="/transfer"
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-white shadow-md transition-all btn-gradient-primary cursor-pointer hover:shadow-lg"
        >
          <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
          <span>Start Live Transfer</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Files Sent */}
        <div className="soft-card p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex items-center gap-3 sm:gap-4">
          <div className="p-3 rounded-2xl bg-cyan-50 border border-cyan-200 text-[#0077B6] shrink-0">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Files Sent</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-serif">{user?.sent ?? 0}</p>
          </div>
        </div>

        {/* Files Received */}
        <div className="soft-card p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex items-center gap-3 sm:gap-4">
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 shrink-0">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Files Received</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-serif">{user?.received ?? 0}</p>
          </div>
        </div>

        {/* Online Contacts */}
        <div className="soft-card p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex items-center gap-3 sm:gap-4">
          <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Online Contacts</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-serif">
              {(() => {
                const myName = (user?.username || '').toLowerCase();
                return contacts.filter((c) => {
                  const cName = (c.username || '').toLowerCase();
                  return (
                    cName !== myName &&
                    onlineUsers &&
                    onlineUsers.some((u) => (u || '').toLowerCase() === cName)
                  );
                }).length;
              })()}
            </p>
          </div>
        </div>

        {/* Security Architecture */}
        <div className="soft-card p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex items-center gap-3 sm:gap-4">
          <div className="p-3 rounded-2xl bg-violet-50 border border-violet-200 text-violet-600 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Storage</p>
            <p className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5">0% Server Disk</p>
            <p className="text-[10px] text-slate-500 font-bold">100% Client E2EE</p>
          </div>
        </div>
      </div>

      {/* Quick Launch Banner */}
      <div className="soft-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-cyan-50 via-sky-50 to-white border border-cyan-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-[#0077B6] text-white shadow-md shrink-0">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 font-serif">Instant Device-to-Device Streaming</h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
              Select any contact or enter a connection key to transfer documents, videos, photos, and archives without size limits or server storage.
            </p>
          </div>
        </div>
        <Link
          to="/transfer"
          className="self-stretch sm:self-auto px-5 py-2.5 rounded-xl bg-[#0077B6] hover:bg-[#005f92] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer shrink-0"
        >
          <span>Open Transfer Room</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Transfer History Section */}
      <div className="soft-card p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-cyan-100 pb-4 gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 font-serif">
              <Clock className="w-5 h-5 text-[#0077B6]" />
              <span>Transfer History</span>
              <span className="text-xs text-slate-600 font-bold">({filteredTransfers.length})</span>
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by file or peer..."
                className="w-full pl-9 pr-3 py-1.5 soft-input rounded-xl text-xs sm:text-sm font-semibold placeholder:text-slate-500 outline-none"
              />
            </div>

            {/* Clear History Button */}
            {transfers.length > 0 && (
              <button
                onClick={() => setClearModal({ open: true, loading: false })}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                title="Clear all transfer activity records"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-600 font-semibold text-sm">
            Loading transfer activity...
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="text-center py-12 text-slate-600 font-medium border border-dashed border-cyan-200 rounded-2xl text-sm px-4 space-y-3">
            <p>No transfers recorded yet.</p>
            <Link
              to="/transfer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0077B6] hover:underline"
            >
              <span>Connect with a contact to start transferring</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile Cards View (< sm) */}
            <div className="space-y-3 sm:hidden">
              {filteredTransfers.map((t, idx) => {
                const isSender = t.sender === user?.username;
                const peerName = isSender ? t.receiver : t.sender;
                return (
                  <div key={idx} className="p-4 rounded-2xl border border-cyan-100 bg-white shadow-2xs space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl shrink-0 ${
                        isSender 
                          ? 'bg-cyan-50 border border-cyan-200 text-[#0077B6]' 
                          : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                      }`}>
                        {isSender ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-slate-900 truncate" title={t.filename}>
                          {t.filename}
                        </p>
                        <div className="flex items-center gap-2 text-xs font-semibold mt-1">
                          <span className={isSender ? 'text-[#0077B6]' : 'text-emerald-700'}>
                            {isSender ? `To @${peerName}` : `From @${peerName}`}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-600">{formatBytes(t.file_size)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500 font-semibold">
                      <span>{t.timestamp ? new Date(t.timestamp).toLocaleString() : 'Recent'}</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Completed</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm font-medium min-w-[600px]">
                <thead className="text-slate-700 uppercase text-xs font-bold border-b border-cyan-100">
                  <tr>
                    <th className="py-3 px-3 font-serif">File Name</th>
                    <th className="py-3 px-3 font-serif">Type / Peer</th>
                    <th className="py-3 px-3 font-serif">Size</th>
                    <th className="py-3 px-3 font-serif">Date & Time</th>
                    <th className="py-3 px-3 text-right font-serif">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-50/50">
                  {filteredTransfers.map((t, idx) => {
                    const isSender = t.sender === user?.username;
                    const peerName = isSender ? t.receiver : t.sender;
                    return (
                      <tr key={idx} className="hover:bg-cyan-50/40 transition-colors">
                        <td className="py-3.5 px-3 flex items-center gap-3 font-bold text-slate-900">
                          <div className={`p-2 rounded-xl shrink-0 ${
                            isSender 
                              ? 'bg-gradient-to-br from-[#E0F2FE] to-[#BAE6FD] border border-[#7DD3FC] text-[#0077B6]' 
                              : 'bg-gradient-to-br from-[#DCFCE7] to-[#BBF7D0] border border-[#86EFAC] text-emerald-700'
                          }`}>
                            <File className="w-4 h-4" />
                          </div>
                          <span className="max-w-xs truncate" title={t.filename}>
                            {t.filename}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                            isSender
                              ? 'bg-cyan-50 text-[#0077B6] border border-cyan-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isSender ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                            <span>{isSender ? `Sent to @${peerName}` : `Received from @${peerName}`}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-slate-700 font-semibold">{formatBytes(t.file_size)}</td>
                        <td className="py-3.5 px-3 text-slate-600 text-xs">
                          {t.timestamp ? new Date(t.timestamp).toLocaleString() : 'Recent'}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Completed</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Clear History Confirmation Modal */}
      <Modal
        isOpen={clearModal.open}
        onClose={() => setClearModal({ open: false, loading: false })}
        title="Clear Transfer History"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 font-medium">
            Are you sure you want to clear your transfer activity records? This action cannot be undone.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setClearModal({ open: false, loading: false })}
              className="px-4 py-2 rounded-xl text-slate-700 hover:text-slate-900 text-sm font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={clearModal.loading}
              onClick={handleClearHistory}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {clearModal.loading ? 'Clearing...' : 'Clear History'}
            </button>
          </div>
        </div>
      </Modal>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
