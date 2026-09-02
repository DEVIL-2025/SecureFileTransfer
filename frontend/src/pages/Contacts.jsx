import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { useSocket } from '../context/SocketContext';
import {
  Users,
  UserPlus,
  Key,
  Copy,
  Check,
  RefreshCw,
  Send,
  Trash2,
  Search,
  Clock,
  ShieldCheck,
  Radio,
  ArrowRight,
  Sparkles,
  Wifi,
  WifiOff
} from 'lucide-react';

export default function Contacts() {
  const navigate = useNavigate();
  const { onlineUsers } = useSocket();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add Contact Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('generate'); // 'generate' | 'enter'
  
  // Key Generation State
  const [generatedKey, setGeneratedKey] = useState(null);
  const [keyExpiresAt, setKeyExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Key Consumption State
  const [inputKey, setInputKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connectSuccess, setConnectSuccess] = useState(null);

  // Delete Contact Modal State
  const [deleteModal, setDeleteModal] = useState({ open: false, contact: null, loading: false });

  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/contacts');
      setContacts(res.data.contacts || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // Countdown timer effect for generated key
  useEffect(() => {
    if (!keyExpiresAt) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const exp = typeof keyExpiresAt === 'number' ? keyExpiresAt : new Date(keyExpiresAt).getTime();
      const diff = Math.max(0, Math.floor((exp - now) / 1000));
      
      if (diff <= 0) {
        setTimeLeft('Expired');
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        const mins = Math.floor(diff / 60).toString().padStart(2, '0');
        const secs = (diff % 60).toString().padStart(2, '0');
        setTimeLeft(`${mins}:${secs}`);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [keyExpiresAt]);

  const handleGenerateKey = async () => {
    setGenerating(true);
    setCopied(false);
    try {
      const res = await api.post('/contacts/key', { expiry_minutes: 15 });
      const keyStr = res.data.key;
      const expiresInSec = res.data.expires_in_seconds || 900;
      const targetExpTime = Date.now() + expiresInSec * 1000;
      
      setGeneratedKey(keyStr);
      setKeyExpiresAt(targetExpTime);
      showToast('New temporary connection key generated!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    showToast('Connection key copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleFormatKeyInput = (e) => {
    // Auto format input to XXXX-XXXX-XXXX uppercase
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.length > 12) val = val.slice(0, 12);
    
    const parts = [];
    for (let i = 0; i < val.length; i += 4) {
      parts.push(val.slice(i, i + 4));
    }
    setInputKey(parts.join('-'));
  };

  const handleConnectWithKey = async (e) => {
    e.preventDefault();
    if (!inputKey.trim()) return;

    setConnecting(true);
    setConnectError('');
    setConnectSuccess(null);

    try {
      const res = await api.post('/contacts/key/consume', { key: inputKey.trim() });
      setConnectSuccess(res.data.contact);
      showToast(res.data.message || 'Connected successfully!');
      setInputKey('');
      fetchContacts();
    } catch (err) {
      setConnectError(err.message || 'Failed to connect with key.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!deleteModal.contact) return;

    setDeleteModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.delete(`/contacts/${deleteModal.contact.username}`);
      showToast(res.data.message || 'Contact removed.');
      setDeleteModal({ open: false, contact: null, loading: false });
      fetchContacts();
    } catch (err) {
      showToast(err.message, 'error');
      setDeleteModal({ open: false, contact: null, loading: false });
    }
  };

  const handleSendFileToContact = (contact) => {
    navigate(`/transfer?peer=${contact.username}`);
  };

  // Contacts with live presence
  const enrichedContacts = contacts.map((c) => ({
    ...c,
    online: onlineUsers.includes(c.username)
  }));

  const filteredContacts = enrichedContacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    return c.username.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-cyan-200/80 pb-6 gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#0077B6]">
            TRUSTED NETWORK
          </span>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 font-serif">
            <Users className="w-8 h-8 text-[#0077B6]" />
            My Trusted Contacts
          </h1>
        </div>

        {/* Add Contact CTA Button */}
        <button
          onClick={() => {
            setAddModalOpen(true);
            setConnectError('');
            setConnectSuccess(null);
          }}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl btn-gradient-primary font-bold text-white shadow-md transition-all cursor-pointer"
        >
          <UserPlus className="w-5 h-5" />
          <span>+ Add Contact</span>
        </button>
      </div>

      {/* Search Bar & Stats */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts by username or email..."
            className="w-full pl-10 pr-4 py-2.5 soft-input rounded-xl text-sm font-semibold placeholder:text-slate-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
          <span className="px-3.5 py-1.5 rounded-xl bg-white border border-cyan-200 shadow-xs">
            Total: <strong className="text-slate-900">{contacts.length}</strong>
          </span>
          <span className="px-3.5 py-1.5 rounded-xl bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] shadow-xs">
            Online: <strong>{enrichedContacts.filter((c) => c.online).length}</strong>
          </span>
        </div>
      </div>

      {/* Contacts Grid */}
      <div className="soft-card p-6 sm:p-8 rounded-3xl space-y-6">
        <div className="flex items-center justify-between border-b border-cyan-100 pb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-serif">
            <ShieldCheck className="w-5 h-5 text-[#0077B6]" />
            <span>Trusted Contacts List</span>
            <span className="text-xs text-slate-600 font-bold">({filteredContacts.length})</span>
          </h2>
          <span className="text-xs badge-blue px-3 py-1 rounded-full font-bold">
            End-to-End Paired
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-600 font-semibold text-sm">
            Loading contacts...
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-16 text-slate-600 border border-dashed border-cyan-200 rounded-2xl space-y-3 font-medium">
            <Users className="w-10 h-10 text-cyan-400 mx-auto" />
            <p className="font-bold text-lg text-slate-900 font-serif">No contacts added yet</p>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Share a one-time connection key or enter someone's key to add them to your trusted network for instant file sharing.
            </p>
            <button
              onClick={() => {
                setAddModalOpen(true);
                setConnectError('');
                setConnectSuccess(null);
              }}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl btn-gradient-primary text-white text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer"
            >
              <Key className="w-4 h-4" />
              <span>Generate or Enter Key</span>
            </button>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-10 text-slate-600 font-medium border border-dashed border-cyan-200 rounded-2xl text-sm">
            No contacts match "{searchQuery}".
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContacts.map((contact) => (
              <div
                key={contact.username}
                className="p-5 rounded-2xl border border-cyan-100 bg-white hover:border-cyan-300 transition-all shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E0F2FE] to-[#BAE6FD] border border-[#7DD3FC] text-[#0077B6] flex items-center justify-center font-black text-lg shadow-xs font-serif">
                      {contact.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 font-serif">
                        @{contact.username}
                      </h3>
                      <p className="text-xs text-slate-600 truncate max-w-[150px]">
                        {contact.email || 'No email'}
                      </p>
                    </div>
                  </div>

                  {/* Presence Status */}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      contact.online
                        ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {contact.online ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                        <span>Online</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <span>Offline</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleSendFileToContact(contact)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl btn-gradient-primary text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs"
                    title={contact.online ? "Send File Live" : "Open Transfer Room"}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send File</span>
                  </button>
                  
                  <button
                    onClick={() => setDeleteModal({ open: true, contact, loading: false })}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer border border-rose-100"
                    title="Remove Contact"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Trusted Contact"
      >
        <div className="space-y-6">
          
          {/* Tabs Selector */}
          <div className="flex rounded-2xl bg-cyan-50/60 p-1 border border-cyan-200/80">
            <button
              onClick={() => {
                setActiveTab('generate');
                setConnectError('');
                setConnectSuccess(null);
              }}
              className={`flex-1 py-2.5 text-xs font-extrabold uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'generate'
                  ? 'bg-white text-[#0077B6] shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>Generate Key</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('enter');
                setConnectError('');
                setConnectSuccess(null);
              }}
              className={`flex-1 py-2.5 text-xs font-extrabold uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'enter'
                  ? 'bg-white text-[#0077B6] shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Enter Key</span>
            </button>
          </div>

          {/* Tab 1: Generate Key */}
          {activeTab === 'generate' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-slate-700 font-medium">
                Generate a temporary one-time connection key to share with the person you want to pair with.
              </p>

              {generatedKey ? (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#E0F2FE] to-[#BAE6FD] border border-[#7DD3FC] space-y-3">
                  <div className="text-xs font-bold text-[#0077B6] uppercase tracking-wider">
                    Your One-Time Connection Key
                  </div>
                  
                  <div className="font-mono text-2xl sm:text-3xl font-black text-slate-900 tracking-wider bg-white py-3 px-4 rounded-xl shadow-xs border border-cyan-200">
                    {generatedKey}
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#0077B6]">
                    <Clock className="w-4 h-4" />
                    <span>Expires in: {timeLeft || '15:00'}</span>
                  </div>

                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      onClick={handleCopyKey}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#0077B6] text-xs font-bold shadow-xs border border-cyan-200 transition-all cursor-pointer"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied!' : 'Copy Key'}</span>
                    </button>

                    <button
                      onClick={handleGenerateKey}
                      disabled={generating}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0077B6] hover:bg-[#023E8A] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                    >
                      <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                      <span>Regenerate</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-6">
                  <button
                    onClick={handleGenerateKey}
                    disabled={generating}
                    className="px-6 py-3.5 rounded-2xl btn-gradient-primary text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{generating ? 'Generating...' : 'Generate Connection Key'}</span>
                  </button>
                </div>
              )}

              <p className="text-xs text-slate-500 font-medium">
                The key expires in 15 minutes and will be invalidated immediately after single use.
              </p>
            </div>
          )}

          {/* Tab 2: Enter Key */}
          {activeTab === 'enter' && (
            <form onSubmit={handleConnectWithKey} className="space-y-4">
              <p className="text-sm text-slate-700 font-medium">
                Enter the temporary connection key shared by another registered user to connect.
              </p>

              {connectError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  {connectError}
                </div>
              )}

              {connectSuccess && (
                <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs space-y-1 font-medium">
                  <div className="font-bold text-sm">Connection Established ✓</div>
                  <div>You are now connected with <strong>@{connectSuccess.username}</strong>.</div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5 uppercase font-serif">
                  Connection Key
                </label>
                <input
                  type="text"
                  required
                  value={inputKey}
                  onChange={handleFormatKeyInput}
                  placeholder="e.g. 7K4X-92MP-Q8ZT"
                  className="w-full px-4 py-3 soft-input rounded-xl text-base font-mono font-bold tracking-widest text-center outline-none"
                  maxLength={14}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-700 hover:text-slate-900 text-sm font-bold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={connecting || !inputKey.trim()}
                  className="px-6 py-2.5 rounded-xl btn-gradient-primary text-white text-sm font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {connecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </form>
          )}

        </div>
      </Modal>

      {/* Delete Contact Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, contact: null, loading: false })}
        title="Remove Contact"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 font-medium">
            Are you sure you want to remove <strong className="text-slate-900">@{deleteModal.contact?.username}</strong> from your trusted contacts?
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteModal({ open: false, contact: null, loading: false })}
              className="px-4 py-2 rounded-xl text-slate-700 hover:text-slate-900 text-sm font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteModal.loading}
              onClick={handleDeleteContact}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {deleteModal.loading ? 'Removing...' : 'Remove Contact'}
            </button>
          </div>
        </div>
      </Modal>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
