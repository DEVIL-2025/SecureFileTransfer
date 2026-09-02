import React, { useState, useEffect } from 'react';
import api from '../api/client';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import {
  UploadCloud,
  File,
  Download,
  Trash2,
  Share2,
  Users,
  Search,
  HardDrive,
  Lock,
  FolderMinus
} from 'lucide-react';

export default function Dashboard() {
  const [myFiles, setMyFiles] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [shareModal, setShareModal] = useState({ open: false, file: null, targetUser: '', error: '', loading: false });
  const [deleteModal, setDeleteModal] = useState({ open: false, file: null, loading: false });
  const [clearSharedModal, setClearSharedModal] = useState({ open: false, loading: false });
  
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await api.get('/files');
      setMyFiles(res.data.my_files || []);
      setSharedFiles(res.data.shared_files || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast(res.data.message || 'File uploaded safely!');
      fetchFiles();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = (fileId, originalName) => {
    showToast(`Downloading ${originalName}...`, 'info');
    window.location.href = `/api/files/download/${fileId}`;
  };

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (!shareModal.targetUser.trim()) return;

    setShareModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await api.post(`/files/share/${shareModal.file.id}`, {
        username: shareModal.targetUser.trim()
      });
      showToast(res.data.message);
      setShareModal({ open: false, file: null, targetUser: '', error: '', loading: false });
    } catch (err) {
      setShareModal((prev) => ({ ...prev, error: err.message, loading: false }));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.file) return;

    setDeleteModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.post(`/files/delete/${deleteModal.file.id}`);
      showToast(res.data.message);
      setDeleteModal({ open: false, file: null, loading: false });
      fetchFiles();
    } catch (err) {
      showToast(err.message, 'error');
      setDeleteModal({ open: false, file: null, loading: false });
    }
  };

  const handleClearSharedConfirm = async () => {
    setClearSharedModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.post('/files/shared/clear');
      showToast(res.data.message || 'Shared files list cleared.');
      setClearSharedModal({ open: false, loading: false });
      fetchFiles();
    } catch (err) {
      showToast(err.message, 'error');
      setClearSharedModal({ open: false, loading: false });
    }
  };

  const handleRemoveSingleShared = async (fileId) => {
    try {
      const res = await api.post(`/files/shared/remove/${fileId}`);
      showToast(res.data.message || 'Removed from shared files.');
      fetchFiles();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredMyFiles = myFiles.filter(f => 
    (f.original_filename || f.filename).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSharedFiles = sharedFiles.filter(f => 
    (f.original_filename || f.filename).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-cyan-200/80 pb-6 gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#0077B6]">
            PRIVATE CLOUD
          </span>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 font-serif">
            <HardDrive className="w-8 h-8 text-[#0077B6]" />
            My Saved Files
          </h1>
        </div>

        {/* Upload Button */}
        <label className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white shadow-md transition-all cursor-pointer ${
          uploading ? 'bg-slate-500 opacity-60 cursor-not-allowed' : 'btn-gradient-primary'
        }`}>
          <UploadCloud className="w-5 h-5" />
          <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search your files..."
          className="w-full pl-10 pr-4 py-2.5 soft-input rounded-xl text-sm font-semibold placeholder:text-slate-500 outline-none"
        />
      </div>

      {/* My Stored Files Section */}
      <div className="soft-card p-6 sm:p-8 rounded-3xl space-y-6">
        <div className="flex items-center justify-between border-b border-cyan-100 pb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-serif">
            <Lock className="w-5 h-5 text-[#0077B6]" />
            <span>My Files</span>
            <span className="text-xs text-slate-600 font-bold">({filteredMyFiles.length})</span>
          </h2>
          <span className="text-xs badge-blue px-3 py-1 rounded-full font-bold">
            Encrypted & Safe
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-600 font-semibold text-sm">Loading your files...</div>
        ) : filteredMyFiles.length === 0 ? (
          <div className="text-center py-12 text-slate-600 font-medium border border-dashed border-cyan-200 rounded-2xl text-sm">
            No files uploaded yet. Click "Upload File" to save documents safely.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-medium">
              <thead className="text-slate-700 uppercase text-xs font-bold border-b border-cyan-100">
                <tr>
                  <th className="py-3 px-3 font-serif">File Name</th>
                  <th className="py-3 px-3 font-serif">Size</th>
                  <th className="py-3 px-3 font-serif">Date</th>
                  <th className="py-3 px-3 text-right font-serif">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-50/50">
                {filteredMyFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-cyan-50/40 transition-colors">
                    <td className="py-4 px-3 flex items-center gap-3 font-bold text-slate-900">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-[#E0F2FE] to-[#BAE6FD] border border-[#7DD3FC] text-[#0077B6]">
                        <File className="w-4 h-4" />
                      </div>
                      <span className="max-w-xs truncate" title={file.original_filename || file.filename}>
                        {file.original_filename || file.filename.split('_').slice(1).join('_')}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-slate-700 font-semibold">{formatBytes(file.file_size)}</td>
                    <td className="py-4 px-3 text-slate-600">{file.created_at ? new Date(file.created_at).toLocaleDateString() : 'Recent'}</td>
                    <td className="py-4 px-3 text-right space-x-2">
                      <button
                        onClick={() => handleDownload(file.id, file.original_filename || file.filename)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold transition-colors cursor-pointer"
                        title="Download File"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShareModal({ open: true, file, targetUser: '', error: '', loading: false })}
                        className="p-2 rounded-xl bg-gradient-to-br from-[#E0F2FE] to-[#BAE6FD] hover:bg-[#BAE6FD] text-[#0077B6] font-bold border border-[#7DD3FC] transition-colors cursor-pointer"
                        title="Share File"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteModal({ open: true, file, loading: false })}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold transition-colors cursor-pointer"
                        title="Delete File"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shared With Me Section */}
      <div className="soft-card p-6 sm:p-8 rounded-3xl space-y-6">
        <div className="flex items-center justify-between border-b border-cyan-100 pb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-serif">
              <Users className="w-5 h-5 text-[#065F46]" />
              <span>Shared With Me</span>
              <span className="text-xs text-slate-600 font-bold">({filteredSharedFiles.length})</span>
            </h2>
            <span className="text-xs badge-green px-3 py-1 rounded-full font-bold ml-2">
              Shared Access
            </span>
          </div>

          {/* Clear Shared Files Button */}
          {sharedFiles.length > 0 && (
            <button
              onClick={() => setClearSharedModal({ open: true, loading: false })}
              className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Clear all files shared with me"
            >
              <FolderMinus className="w-3.5 h-3.5" />
              <span>Clear Shared List</span>
            </button>
          )}
        </div>

        {filteredSharedFiles.length === 0 ? (
          <div className="text-center py-10 text-slate-600 font-medium border border-dashed border-cyan-200 rounded-2xl text-sm">
            No files have been shared with you yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-medium">
              <thead className="text-slate-700 uppercase text-xs font-bold border-b border-cyan-100">
                <tr>
                  <th className="py-3 px-3 font-serif">File Name</th>
                  <th className="py-3 px-3 font-serif">Shared By</th>
                  <th className="py-3 px-3 font-serif">Size</th>
                  <th className="py-3 px-3 text-right font-serif">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-50/50">
                {filteredSharedFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-cyan-50/40 transition-colors">
                    <td className="py-4 px-3 flex items-center gap-3 font-bold text-slate-900">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-[#E0F2FE] to-[#BAE6FD] border border-[#7DD3FC] text-[#0077B6]">
                        <File className="w-4 h-4" />
                      </div>
                      <span className="max-w-xs truncate">
                        {file.original_filename || file.filename.split('_').slice(1).join('_')}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-[#065F46] font-bold">@{file.shared_by}</td>
                    <td className="py-4 px-3 text-slate-700 font-semibold">{formatBytes(file.file_size)}</td>
                    <td className="py-4 px-3 text-right space-x-2">
                      <button
                        onClick={() => handleDownload(file.id, file.original_filename || file.filename)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold transition-colors cursor-pointer"
                        title="Download File"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveSingleShared(file.id)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold transition-colors cursor-pointer"
                        title="Remove from shared list"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Share Modal */}
      <Modal
        isOpen={shareModal.open}
        onClose={() => setShareModal({ open: false, file: null, targetUser: '', error: '', loading: false })}
        title={`Share "${shareModal.file?.original_filename || 'File'}"`}
      >
        <form onSubmit={handleShareSubmit} className="space-y-4">
          <p className="text-sm text-slate-700 font-medium">
            Enter the username of the person you want to share this file with:
          </p>

          {shareModal.error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {shareModal.error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5 uppercase font-serif">Recipient Username</label>
            <input
              type="text"
              required
              value={shareModal.targetUser}
              onChange={(e) => setShareModal((prev) => ({ ...prev, targetUser: e.target.value }))}
              placeholder="e.g. alice"
              className="w-full px-4 py-2.5 rounded-xl soft-input text-sm font-semibold outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShareModal({ open: false, file: null, targetUser: '', error: '', loading: false })}
              className="px-4 py-2 rounded-xl text-slate-700 hover:text-slate-900 text-sm font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={shareModal.loading}
              className="px-5 py-2 rounded-xl btn-gradient-primary text-white text-sm font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {shareModal.loading ? 'Sharing...' : 'Share File'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, file: null, loading: false })}
        title="Delete File"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 font-medium">
            Are you sure you want to delete this file? It will be permanently removed.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteModal({ open: false, file: null, loading: false })}
              className="px-4 py-2 rounded-xl text-slate-700 hover:text-slate-900 text-sm font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteModal.loading}
              onClick={handleDeleteConfirm}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {deleteModal.loading ? 'Deleting...' : 'Delete File'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Clear All Shared Files Modal */}
      <Modal
        isOpen={clearSharedModal.open}
        onClose={() => setClearSharedModal({ open: false, loading: false })}
        title="Clear All Shared Files"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 font-medium">
            Are you sure you want to clear your shared files list? This will remove access to all files shared with you.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setClearSharedModal({ open: false, loading: false })}
              className="px-4 py-2 rounded-xl text-slate-700 hover:text-slate-900 text-sm font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={clearSharedModal.loading}
              onClick={handleClearSharedConfirm}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {clearSharedModal.loading ? 'Clearing...' : 'Clear All Shared'}
            </button>
          </div>
        </div>
      </Modal>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
