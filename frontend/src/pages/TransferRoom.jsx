import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../api/client';
import Modal from '../components/Modal';
import {
  Radio,
  UserPlus,
  FileUp,
  XCircle,
  Wifi,
  ShieldCheck,
  Users,
  Search,
  ArrowRight,
  Zap,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  HardDrive
} from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function TransferRoom() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetPeerFromQuery = searchParams.get('peer');

  const {
    onlineUsers,
    connectedPeers,
    incomingRequest,
    incomingFileRequest,
    transferState,
    sendConnectionRequest,
    acceptConnectionRequest,
    rejectConnectionRequest,
    startFileTransfer,
    acceptIncomingFile,
    rejectIncomingFile,
    cancelTransfer,
    disconnectPeer
  } = useSocket();

  const fileInputRef = useRef(null);
  const [selectedPeerForSend, setSelectedPeerForSend] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [searchFilter, setSearchFilter] = useState(targetPeerFromQuery || '');

  const fetchContacts = async () => {
    try {
      setLoadingContacts(true);
      const res = await api.get('/contacts');
      setContacts(res.data.contacts || []);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleSelectFileToTransfer = (peer) => {
    setSelectedPeerForSend(peer);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && selectedPeerForSend) {
      startFileTransfer(selectedPeerForSend, file);
    }
    e.target.value = '';
  };

  const enrichedContacts = contacts.map((c) => ({
    ...c,
    online: onlineUsers.includes(c.username)
  }));

  const filteredContacts = enrichedContacts.filter((c) => {
    const q = searchFilter.toLowerCase();
    return c.username.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
            FAST & SAFE SHARING
          </span>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Radio className="w-8 h-8 text-slate-900 animate-pulse" />
            Live File Transfer
          </h1>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] text-xs font-extrabold shadow-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
          <span>Online as @{user?.username}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Contacts List */}
        <div className="lg:col-span-2 soft-card p-6 sm:p-8 rounded-3xl space-y-6 border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-900" />
              <h2 className="text-lg font-bold text-slate-900">
                My Contacts ({filteredContacts.length})
              </h2>
            </div>
            
            <Link
              to="/contacts"
              className="text-xs font-bold text-slate-900 hover:underline flex items-center gap-1"
            >
              <span>Add / Manage Contacts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-10 pr-4 py-2.5 soft-input rounded-xl text-sm font-semibold placeholder:text-slate-500 outline-none"
            />
          </div>

          {loadingContacts ? (
            <div className="text-center py-12 text-slate-600 font-semibold text-sm">
              Loading your contacts...
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-16 text-slate-600 border border-dashed border-slate-300 rounded-2xl space-y-3 font-medium">
              <Users className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="font-bold text-lg text-slate-900">No contacts yet</p>
              <p className="text-sm text-slate-600 max-w-sm mx-auto">
                Generate or enter a connection key to add contacts and start sharing files.
              </p>
              <Link
                to="/contacts"
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl btn-gradient-primary text-white text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                <span>Go to Contacts</span>
              </Link>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-10 text-slate-600 font-medium border border-dashed border-slate-300 rounded-2xl text-sm">
              No contacts match "{searchFilter}".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredContacts.map((contact) => {
                const isConnected = connectedPeers.has(contact.username);

                return (
                  <div
                    key={contact.username}
                    className={`p-5 rounded-2xl border transition-all ${
                      isConnected
                        ? 'bg-[#ECFDF5] border-[#A7F3D0] shadow-sm'
                        : contact.online
                        ? 'bg-white border-slate-200 hover:border-slate-400'
                        : 'bg-slate-50/70 border-slate-200 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                          isConnected
                            ? 'bg-[#065F46] text-white'
                            : contact.online
                            ? 'bg-gradient-to-br from-[#070B14] to-[#1E293B] text-white shadow-xs'
                            : 'bg-slate-400 text-white'
                        }`}>
                          {contact.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900">
                            @{contact.username}
                          </h4>
                          <span className={`text-xs font-bold ${
                            isConnected
                              ? 'text-[#065F46]'
                              : contact.online
                              ? 'text-[#059669]'
                              : 'text-slate-500'
                          }`}>
                            {isConnected ? '● Connected' : contact.online ? '● Online' : '○ Offline'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      {isConnected ? (
                        <>
                          <button
                            onClick={() => handleSelectFileToTransfer(contact.username)}
                            disabled={transferState.active}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#065F46] hover:bg-[#044734] text-white text-xs font-bold uppercase transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                          >
                            <FileUp className="w-3.5 h-3.5" />
                            <span>Send File</span>
                          </button>
                          <button
                            onClick={() => disconnectPeer(contact.username)}
                            className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold uppercase transition-all cursor-pointer"
                          >
                            Disconnect
                          </button>
                        </>
                      ) : contact.online ? (
                        <button
                          onClick={() => sendConnectionRequest(contact.username)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl btn-gradient-primary text-white text-xs font-bold uppercase tracking-wide transition-all cursor-pointer shadow-xs"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Connect</span>
                        </button>
                      ) : (
                        <div className="w-full text-center py-1.5 text-xs font-bold text-slate-500">
                          Contact is offline
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Clean & Real-Time Transfer Progress */}
        <div className="soft-card p-6 sm:p-8 rounded-3xl space-y-6 flex flex-col justify-between border-slate-200">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
              <h2 className="text-lg font-bold text-slate-900">
                Transfer Progress
              </h2>
              <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                transferState.active
                  ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] animate-pulse'
                  : transferState.progress === 100
                  ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]'
                  : 'badge-neutral'
              }`}>
                {transferState.active 
                  ? (transferState.mode === 'sending' ? 'Sending' : 'Receiving')
                  : transferState.progress === 100
                  ? 'Done'
                  : 'Ready'}
              </span>
            </div>

            {/* Dynamic Transfer Display */}
            {transferState.active || transferState.progress === 100 || transferState.fileName ? (
              <div className="space-y-4 text-xs">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  
                  {/* Person */}
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      {transferState.mode === 'sending' ? (
                        <ArrowUpCircle className="w-4 h-4 text-slate-900" />
                      ) : (
                        <ArrowDownCircle className="w-4 h-4 text-[#065F46]" />
                      )}
                      <span>{transferState.mode === 'sending' ? 'Sending to:' : 'Receiving from:'}</span>
                    </span>
                    <span className="font-extrabold text-slate-900">
                      @{transferState.peer || 'Contact'}
                    </span>
                  </div>

                  {/* File Name */}
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <span>File:</span>
                    <span className="font-extrabold text-slate-900 max-w-[180px] truncate" title={transferState.fileName}>
                      {transferState.fileName}
                    </span>
                  </div>

                  {/* Size Progress */}
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <span>Size:</span>
                    <span className="font-extrabold text-slate-900 font-mono">
                      {formatBytes(transferState.transferredBytes)} of {formatBytes(transferState.fileSize)}
                    </span>
                  </div>

                  {/* Live Speed & Remaining Time */}
                  {transferState.active && (
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between font-bold text-[11px]">
                      <span className="text-[#059669] flex items-center gap-1 font-extrabold">
                        <Zap className="w-3.5 h-3.5 text-[#10B981]" />
                        {transferState.speedText || 'Measuring speed...'}
                      </span>
                      <span className="text-slate-600 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {transferState.etaText || 'Calculating...'}
                      </span>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-150 ${
                        transferState.isCancelled
                          ? 'bg-rose-600'
                          : transferState.progress === 100
                          ? 'bg-[#065F46]'
                          : 'bg-gradient-to-r from-[#070B14] via-[#0F172A] to-[#1E293B]'
                      }`}
                      style={{ width: `${transferState.progress}%` }}
                    />
                  </div>

                  {/* Percentage */}
                  <div className="flex items-center justify-between text-xs font-black text-slate-900 pt-1">
                    <span className="text-xs font-bold text-slate-600">
                      {transferState.statusText}
                    </span>
                    <span>{transferState.progress}%</span>
                  </div>
                </div>

                {/* Download / Open File Button if Complete */}
                {transferState.downloadUrl && (
                  <a
                    href={transferState.downloadUrl}
                    download={transferState.downloadName || transferState.fileName}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#065F46] hover:bg-[#044734] text-white font-bold text-xs uppercase transition-all shadow-xs cursor-pointer"
                  >
                    <ArrowDownCircle className="w-4 h-4" />
                    <span>Open / Save {transferState.downloadName || 'File'}</span>
                  </a>
                )}

                {/* Cancel Button */}
                {transferState.active && (
                  <button
                    onClick={cancelTransfer}
                    className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs uppercase transition-all cursor-pointer"
                  >
                    Cancel Transfer
                  </button>
                )}
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-slate-500 text-xs space-y-2 font-medium">
                <HardDrive className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-bold text-slate-900 text-sm">Ready to Transfer</p>
                <p>Connect with any online contact to send or receive files.</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4 text-xs text-slate-700 space-y-1.5 font-medium">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#065F46]" />
              Direct & Private
            </h4>
            <p className="leading-relaxed">
              Files stream directly to the receiver. No files are saved on the server.
            </p>
          </div>
        </div>

      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Connection Request Modal */}
      <Modal
        isOpen={Boolean(incomingRequest)}
        onClose={rejectConnectionRequest}
        title="Connection Request"
      >
        <div className="space-y-4 text-sm text-slate-800 font-medium">
          <p>
            User <span className="font-bold text-slate-900">@{incomingRequest}</span> wants to connect and share files with you.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={rejectConnectionRequest}
              className="px-4 py-2 rounded-xl text-slate-700 hover:text-slate-900 font-bold cursor-pointer"
            >
              Decline
            </button>
            <button
              onClick={acceptConnectionRequest}
              className="px-5 py-2 rounded-xl btn-gradient-primary text-white font-bold shadow-xs transition-all cursor-pointer"
            >
              Accept
            </button>
          </div>
        </div>
      </Modal>

      {/* File Request Modal */}
      <Modal
        isOpen={Boolean(incomingFileRequest)}
        onClose={rejectIncomingFile}
        title="Incoming File"
      >
        <div className="space-y-4 text-sm text-slate-800 font-medium">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex justify-between">
              <span>From:</span>
              <span className="font-bold text-slate-900">@{incomingFileRequest?.from}</span>
            </div>
            <div className="flex justify-between">
              <span>File:</span>
              <span className="font-bold text-slate-900 truncate max-w-[200px]">{incomingFileRequest?.fileName}</span>
            </div>
            <div className="flex justify-between">
              <span>Size:</span>
              <span className="font-bold text-slate-900 font-mono">
                {formatBytes(incomingFileRequest?.totalSize)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={rejectIncomingFile}
              className="px-4 py-2 rounded-xl text-slate-700 hover:text-slate-900 font-bold cursor-pointer"
            >
              Decline
            </button>
            <button
              onClick={acceptIncomingFile}
              className="px-5 py-2 rounded-xl bg-[#065F46] hover:bg-[#044734] text-white font-bold shadow-xs transition-all cursor-pointer"
            >
              Accept & Download
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
