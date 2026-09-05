import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import {
  generateEcdhKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedAesGcmKey,
  encryptChunkBinary,
  decryptChunkBinary,
  encryptChunk,
  decryptChunk,
  base64ToArrayBuffer
} from '../crypto/e2ee';
import { WebRtcPeer } from '../crypto/webrtc';

const SocketContext = createContext(null);

const STORAGE_KEY = 'secure_transfer_connected_peers';
const WEBRTC_RAW_CHUNK_SIZE = 60 * 1024;     // 60 KB for WebRTC SCTP frames
const WEBSOCKET_RAW_CHUNK_SIZE = 128 * 1024; // 128 KB for WebSocket Relay

function getStoredPeers() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredPeers(peersSet) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(peersSet)));
  } catch {}
}

function resolveMimeType(fileName, fallbackMime) {
  if (fallbackMime && fallbackMime !== 'application/octet-stream') {
    return fallbackMime;
  }
  const ext = (fileName || '').split('.').pop().toLowerCase();
  const mimeMap = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    flv: 'video/x-flv',
    wmv: 'video/x-ms-wmv',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    json: 'application/json',
    txt: 'text/plain',
    csv: 'text/csv',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  };
  return mimeMap[ext] || fallbackMime || 'application/octet-stream';
}

function isInitiatorFor(myUsername, peerUsername) {
  if (!myUsername || !peerUsername) return false;
  return myUsername.localeCompare(peerUsername) > 0;
}

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  const [connectedPeers, setConnectedPeers] = useState(() => new Set(getStoredPeers()));
  const connectedPeersRef = useRef(new Set(getStoredPeers()));
  
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [incomingFileRequest, setIncomingFileRequest] = useState(null);

  const [transferState, setTransferState] = useState({
    active: false,
    mode: 'idle', // 'sending' | 'receiving' | 'idle'
    fileName: '',
    fileSize: 0,
    transferredBytes: 0,
    progress: 0,
    statusText: 'Idle',
    speedText: '',
    etaText: '',
    transport: 'Direct',
    isCancelled: false,
    peer: null,
    downloadUrl: null,
    downloadName: ''
  });

  const ecdhKeyPairsRef = useRef({});
  const webrtcPeersRef = useRef({});

  const transferRef = useRef({
    file: null,
    offset: 0,
    chunkSize: WEBRTC_RAW_CHUNK_SIZE,
    receivedChunks: [],
    receivedSize: 0,
    totalSize: 0,
    fileName: '',
    mimeType: '',
    peer: null,
    isCancelled: false,
    transport: 'Direct',
    startTime: 0,
    lastSampleTime: 0,
    lastSampleBytes: 0,
    lastSyncTime: 0,
    slidingWindowInFlight: 0,
    maxWindowSize: 16
  });

  const initiateEcdh = async (peer, sockInstance) => {
    const currentSock = sockInstance || socket;
    if (!currentSock) return;
    try {
      const keyPair = await generateEcdhKeyPair();
      const publicJwk = await exportPublicKey(keyPair.publicKey);
      ecdhKeyPairsRef.current[peer] = { keyPair, sharedAesKey: null };

      currentSock.emit('ecdh_key_exchange', {
        to: peer,
        publicKey: publicJwk,
        isInitiator: true
      });
    } catch (err) {
      console.error('[E2EE] initiateEcdh error:', err);
    }
  };

  const getOrCreateWebRtcPeer = (peer, sockInstance) => {
    const currentSock = sockInstance || socket;
    if (webrtcPeersRef.current[peer]) return webrtcPeersRef.current[peer];

    const rtc = new WebRtcPeer(
      peer,
      currentSock,
      () => {
        console.log(`[WebRTC] DataChannel ready with @${peer}`);
      },
      () => {
        console.log(`[WebRTC] DataChannel closed with @${peer}`);
      },
      (binaryData) => {
        handleReceiveWebRtcChunk(binaryData, currentSock);
      }
    );

    webrtcPeersRef.current[peer] = rtc;
    return rtc;
  };

  const setupPeerSession = (peer, sockInstance) => {
    const currentSock = sockInstance || socket;
    if (!currentSock || !user) return;

    const amInitiator = isInitiatorFor(user.username, peer);
    const rtc = getOrCreateWebRtcPeer(peer, currentSock);

    if (amInitiator) {
      initiateEcdh(peer, currentSock);
      rtc.createOffer().catch((err) => console.warn('[WebRTC] offer error:', err));
    }
  };

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setConnectedPeers(new Set());
      connectedPeersRef.current = new Set();
      sessionStorage.removeItem(STORAGE_KEY);
      setOnlineUsers([]);
      return;
    }

    const socketServerUrl = import.meta.env.VITE_API_URL || undefined;
    const newSocket = io(socketServerUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      const stored = getStoredPeers();
      for (const peer of stored) {
        newSocket.emit('send_request', { to: peer });
      }
    });

    newSocket.on('update_users', (users) => {
      setOnlineUsers(users);
    });

    newSocket.on('restore_connections', (peers) => {
      if (Array.isArray(peers)) {
        const currentStored = new Set([...getStoredPeers(), ...peers]);
        setConnectedPeers(currentStored);
        connectedPeersRef.current = currentStored;
        saveStoredPeers(currentStored);

        for (const peer of peers) {
          setupPeerSession(peer, newSocket);
        }
      }
    });

    // --- Signaling ---
    newSocket.on('receive_request', (data) => {
      if (data && data.from && data.from !== user.username) {
        if (!connectedPeersRef.current.has(data.from)) {
          setIncomingRequest(data.from);
        } else {
          newSocket.emit('accept_request', { to: data.from });
        }
      }
    });

    newSocket.on('request_accepted', async (data) => {
      const peer = data?.peer || data?.from;
      if (!peer || peer === user.username) return;

      setIncomingRequest(null);
      connectedPeersRef.current.add(peer);
      setConnectedPeers(new Set(connectedPeersRef.current));
      saveStoredPeers(connectedPeersRef.current);
      
      setupPeerSession(peer, newSocket);
    });

    newSocket.on('ecdh_key_exchange', async (data) => {
      const peer = data.from;
      const peerPublicJwk = data.publicKey;
      const isPeerInitiator = data.isInitiator;
      if (!peer || !peerPublicJwk) return;

      connectedPeersRef.current.add(peer);
      setConnectedPeers(new Set(connectedPeersRef.current));
      saveStoredPeers(connectedPeersRef.current);
      
      try {
        if (isPeerInitiator) {
          // Responder role: generate own keypair, derive shared key, and reply
          const keyPair = await generateEcdhKeyPair();
          const publicJwk = await exportPublicKey(keyPair.publicKey);
          const peerPublicKey = await importPublicKey(peerPublicJwk);
          const sharedAesKey = await deriveSharedAesGcmKey(keyPair.privateKey, peerPublicKey);
          
          ecdhKeyPairsRef.current[peer] = { keyPair, sharedAesKey };

          newSocket.emit('ecdh_key_exchange', {
            to: peer,
            publicKey: publicJwk,
            isInitiator: false
          });
        } else {
          // Initiator role: use existing keypair to derive shared key with responder
          let myData = ecdhKeyPairsRef.current[peer];
          if (!myData || !myData.keyPair) {
            const keyPair = await generateEcdhKeyPair();
            myData = { keyPair, sharedAesKey: null };
            ecdhKeyPairsRef.current[peer] = myData;
          }

          const peerPublicKey = await importPublicKey(peerPublicJwk);
          const sharedAesKey = await deriveSharedAesGcmKey(myData.keyPair.privateKey, peerPublicKey);
          myData.sharedAesKey = sharedAesKey;
        }
      } catch (err) {
        console.error('[E2EE] Key derivation error:', err);
      }
    });

    newSocket.on('webrtc_offer', async (data) => {
      const peer = data.from;
      const rtc = getOrCreateWebRtcPeer(peer, newSocket);
      await rtc.handleOffer(data.sdp);
    });

    newSocket.on('webrtc_answer', async (data) => {
      const peer = data.from;
      const rtc = webrtcPeersRef.current[peer];
      if (rtc) {
        await rtc.handleAnswer(data.sdp);
      }
    });

    newSocket.on('webrtc_ice_candidate', async (data) => {
      const peer = data.from;
      const rtc = webrtcPeersRef.current[peer];
      if (rtc && data.candidate) {
        await rtc.addIceCandidate(data.candidate);
      }
    });

    newSocket.on('user_disconnected', (data) => {
      if (data && data.user) {
        connectedPeersRef.current.delete(data.user);
        setConnectedPeers(new Set(connectedPeersRef.current));
        saveStoredPeers(connectedPeersRef.current);
        delete ecdhKeyPairsRef.current[data.user];
        if (webrtcPeersRef.current[data.user]) {
          webrtcPeersRef.current[data.user].close();
          delete webrtcPeersRef.current[data.user];
        }
      }
    });

    // --- Live Transfer Handlers ---
    newSocket.on('incoming_file', (data) => {
      setIncomingFileRequest(data);
    });

    newSocket.on('start_file_transfer', (data) => {
      startStreamingSender(newSocket, data);
    });

    newSocket.on('file_rejected', () => {
      setTransferState((prev) => ({
        ...prev,
        active: false,
        statusText: 'Declined by recipient',
        speedText: '',
        etaText: '',
        isCancelled: false
      }));
    });

    newSocket.on('next_chunk', () => {
      const t = transferRef.current;
      t.slidingWindowInFlight = Math.max(0, t.slidingWindowInFlight - 1);
      fillWebSocketPipeline(newSocket);
    });

    newSocket.on('receive_chunk', async (data) => {
      await handleReceiveWebSocketChunk(data, newSocket);
    });

    newSocket.on('transfer_progress_sync', (data) => {
      if (data && data.receivedBytes !== undefined && data.totalBytes) {
        updateSpeedMetrics(data.receivedBytes, data.totalBytes, 'sending');
      }
    });

    newSocket.on('transfer_finished_sync', (data) => {
      setTransferState((prev) => ({
        ...prev,
        active: false,
        progress: 100,
        transferredBytes: prev.fileSize || 0,
        statusText: prev.mode === 'sending' ? 'File sent successfully ✅' : 'File received and saved ✅',
        speedText: '',
        etaText: 'Completed'
      }));
    });

    newSocket.on('transfer_cancelled', () => {
      transferRef.current.isCancelled = true;
      setTransferState((prev) => ({
        ...prev,
        active: false,
        statusText: '❌ Transfer Cancelled',
        speedText: '',
        etaText: '',
        isCancelled: true
      }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // --- Real-Time Speed & Progress Calculator ---
  const updateSpeedMetrics = (transferredBytes, totalBytes, mode) => {
    const t = transferRef.current;
    const now = performance.now();
    const elapsedSinceLast = (now - t.lastSampleTime) / 1000;

    if (elapsedSinceLast >= 0.15 || transferredBytes >= totalBytes) {
      const bytesInSample = transferredBytes - t.lastSampleBytes;
      const bytesPerSec = elapsedSinceLast > 0 ? bytesInSample / elapsedSinceLast : 0;
      const mBps = bytesPerSec / (1024 * 1024);

      let speedStr = mBps >= 1 
        ? `${mBps.toFixed(1)} MB/s` 
        : `${Math.round(bytesPerSec / 1024)} KB/s`;
      
      const remainingBytes = Math.max(0, totalBytes - transferredBytes);
      const remainingSecs = bytesPerSec > 0 ? Math.ceil(remainingBytes / bytesPerSec) : 0;
      let etaStr = remainingSecs > 60 
        ? `${Math.floor(remainingSecs / 60)}m ${remainingSecs % 60}s left`
        : `${remainingSecs}s left`;

      if (transferredBytes >= totalBytes) {
        etaStr = 'Complete';
        speedStr = '';
      }

      t.lastSampleTime = now;
      t.lastSampleBytes = transferredBytes;

      const pct = totalBytes > 0 ? Math.min(100, Math.floor((transferredBytes / totalBytes) * 100)) : 0;

      setTransferState((prev) => ({
        ...prev,
        active: pct < 100,
        progress: pct,
        transferredBytes: transferredBytes,
        fileSize: totalBytes,
        speedText: speedStr ? `⚡ ${speedStr}` : '',
        etaText: etaStr,
        statusText: pct >= 100 
          ? (mode === 'sending' ? 'File sent successfully ✅' : 'File received and saved ✅') 
          : (mode === 'sending' ? `Sending file (${pct}%)...` : `Receiving file (${pct}%)...`)
      }));
    }
  };

  // --- WebRTC Sender Streamer ---
  const streamOverWebRtc = async (rtc, sock) => {
    const t = transferRef.current;
    const sessionData = ecdhKeyPairsRef.current[t.peer];
    t.chunkSize = WEBRTC_RAW_CHUNK_SIZE;

    while (t.offset < t.file.size && !t.isCancelled) {
      const chunkEnd = Math.min(t.file.size, t.offset + t.chunkSize);
      const isLast = chunkEnd >= t.file.size;
      const slice = t.file.slice(t.offset, chunkEnd);
      const arrayBuffer = await slice.arrayBuffer();

      let payloadBuffer;
      if (sessionData && sessionData.sharedAesKey) {
        payloadBuffer = await encryptChunkBinary(sessionData.sharedAesKey, arrayBuffer);
      } else {
        payloadBuffer = arrayBuffer;
      }

      const frame = new Uint8Array(1 + payloadBuffer.byteLength);
      frame[0] = isLast ? 1 : 0;
      frame.set(new Uint8Array(payloadBuffer), 1);

      await rtc.sendBinaryChunk(frame.buffer);
      t.offset = chunkEnd;
    }
  };

  // --- WebSocket Sender Fallback ---
  const fillWebSocketPipeline = async (sock) => {
    const t = transferRef.current;
    if (t.isCancelled || !t.file || !t.peer) return;

    while (t.slidingWindowInFlight < t.maxWindowSize && t.offset < t.file.size && !t.isCancelled) {
      const chunkEnd = Math.min(t.file.size, t.offset + t.chunkSize);
      const isLast = chunkEnd >= t.file.size;
      const slice = t.file.slice(t.offset, chunkEnd);
      t.offset = chunkEnd;
      t.slidingWindowInFlight++;

      const arrayBuffer = await slice.arrayBuffer();

      const sessionData = ecdhKeyPairsRef.current[t.peer];
      let chunkPayload = arrayBuffer;
      let ivString = '';

      if (sessionData && sessionData.sharedAesKey) {
        const encrypted = await encryptChunk(sessionData.sharedAesKey, arrayBuffer);
        chunkPayload = encrypted.ciphertext;
        ivString = encrypted.iv;
      }

      sock.emit('file_chunk', {
        to: t.peer,
        fileName: t.file.name,
        chunk: chunkPayload,
        iv: ivString,
        isLast: isLast,
        totalSize: t.file.size,
        mimeType: t.file.type
      });
    }
  };

  const startStreamingSender = async (sock) => {
    const t = transferRef.current;
    t.startTime = performance.now();
    t.lastSampleTime = performance.now();
    t.lastSampleBytes = 0;
    t.offset = 0;

    const rtc = webrtcPeersRef.current[t.peer];
    if (rtc && rtc.isOpen) {
      t.transport = 'Direct';
      setTransferState((prev) => ({ ...prev, transport: 'Direct', statusText: 'Sending file via Direct P2P ⚡' }));
      try {
        await streamOverWebRtc(rtc, sock);
        return;
      } catch (err) {
        console.warn('[WebRTC] Direct stream error, switching to relay:', err);
      }
    }

    t.transport = 'Relay';
    t.chunkSize = WEBSOCKET_RAW_CHUNK_SIZE;
    setTransferState((prev) => ({ ...prev, transport: 'Relay', statusText: 'Sending file via Relay...' }));
    fillWebSocketPipeline(sock);
  };

  // --- WebRTC Receiver Handler ---
  const handleReceiveWebRtcChunk = async (binaryData, sock) => {
    const t = transferRef.current;
    const view = new Uint8Array(binaryData);
    const isLast = view[0] === 1;
    const payloadBuffer = view.slice(1).buffer;

    const sessionData = ecdhKeyPairsRef.current[t.peer];
    let decryptedBuffer;

    try {
      if (sessionData && sessionData.sharedAesKey) {
        decryptedBuffer = await decryptChunkBinary(sessionData.sharedAesKey, payloadBuffer);
      } else {
        decryptedBuffer = payloadBuffer;
      }
    } catch (err) {
      console.error('[E2EE] WebRTC Decryption failed:', err);
      decryptedBuffer = payloadBuffer;
    }

    t.receivedChunks.push(decryptedBuffer);
    t.receivedSize += decryptedBuffer.byteLength;
    updateSpeedMetrics(t.receivedSize, t.totalSize, 'receiving');

    const now = performance.now();
    if (now - t.lastSyncTime > 150 || isLast) {
      t.lastSyncTime = now;
      if (sock) {
        sock.emit('transfer_progress_sync', {
          to: t.peer,
          receivedBytes: t.receivedSize,
          totalBytes: t.totalSize
        });
      }
    }

    if (isLast) {
      finalizeReceivedFile(sock);
    }
  };

  // --- WebSocket Receiver Handler ---
  const handleReceiveWebSocketChunk = async (data, sock) => {
    const t = transferRef.current;
    t.totalSize = data.totalSize || t.totalSize;
    if (data.fileName && !t.fileName) t.fileName = data.fileName;
    if (data.mimeType && !t.mimeType) t.mimeType = data.mimeType;

    const senderPeer = data.from || t.peer;
    const sessionData = ecdhKeyPairsRef.current[senderPeer];
    let decryptedBuffer;

    try {
      if (sessionData && sessionData.sharedAesKey && data.iv) {
        decryptedBuffer = await decryptChunk(sessionData.sharedAesKey, data.chunk, data.iv);
      } else if (typeof data.chunk === 'string') {
        decryptedBuffer = base64ToArrayBuffer(data.chunk);
      } else {
        decryptedBuffer = data.chunk;
      }
    } catch (err) {
      console.error('[E2EE] WebSocket Decryption failed:', err);
      decryptedBuffer = typeof data.chunk === 'string' ? base64ToArrayBuffer(data.chunk) : data.chunk;
    }

    t.receivedChunks.push(decryptedBuffer);
    t.receivedSize += (decryptedBuffer.byteLength || 0);

    sock.emit('ack_chunk', { to: data.from || t.peer });
    updateSpeedMetrics(t.receivedSize, t.totalSize, 'receiving');

    const now = performance.now();
    if (now - t.lastSyncTime > 150 || data.isLast) {
      t.lastSyncTime = now;
      if (sock) {
        sock.emit('transfer_progress_sync', {
          to: t.peer,
          receivedBytes: t.receivedSize,
          totalBytes: t.totalSize
        });
      }
    }

    if (data.isLast) {
      finalizeReceivedFile(sock);
    }
  };

  const finalizeReceivedFile = (sock) => {
    const t = transferRef.current;
    const finalMime = resolveMimeType(t.fileName, t.mimeType);

    const blob = new Blob(t.receivedChunks, { type: finalMime });
    const url = URL.createObjectURL(blob);
    
    // Automatic browser download
    const a = document.createElement('a');
    a.href = url;
    a.download = t.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTransferState((prev) => ({
      ...prev,
      active: false,
      progress: 100,
      transferredBytes: t.totalSize,
      statusText: 'File received and saved ✅',
      downloadUrl: url,
      downloadName: t.fileName,
      speedText: '',
      etaText: 'Completed'
    }));

    if (sock) {
      sock.emit('p2p_transfer_completed', {
        to: t.peer,
        fileName: t.fileName,
        totalSize: t.totalSize
      });
    }

    t.receivedChunks = [];
    t.receivedSize = 0;
  };

  const sendConnectionRequest = (targetUser) => {
    if (socket) socket.emit('send_request', { to: targetUser });
  };

  const acceptConnectionRequest = () => {
    if (socket && incomingRequest) {
      const peer = incomingRequest;
      connectedPeersRef.current.add(peer);
      setConnectedPeers(new Set(connectedPeersRef.current));
      saveStoredPeers(connectedPeersRef.current);
      socket.emit('accept_request', { to: peer });
      setIncomingRequest(null);
      setupPeerSession(peer, socket);
    }
  };

  const rejectConnectionRequest = () => {
    if (socket && incomingRequest) {
      socket.emit('reject_request', { to: incomingRequest });
      setIncomingRequest(null);
    }
  };

  const startFileTransfer = (targetUser, file) => {
    if (!socket || !file) return;

    const rtc = webrtcPeersRef.current[targetUser];
    const initialTransport = (rtc && rtc.isOpen) ? 'Direct' : 'Relay';

    transferRef.current = {
      file: file,
      offset: 0,
      chunkSize: WEBRTC_RAW_CHUNK_SIZE,
      receivedChunks: [],
      receivedSize: 0,
      totalSize: file.size,
      fileName: file.name,
      mimeType: resolveMimeType(file.name, file.type),
      peer: targetUser,
      isCancelled: false,
      transport: initialTransport,
      startTime: performance.now(),
      lastSampleTime: performance.now(),
      lastSampleBytes: 0,
      lastSyncTime: 0,
      slidingWindowInFlight: 0,
      maxWindowSize: 16
    };

    setTransferState({
      active: true,
      mode: 'sending',
      fileName: file.name,
      fileSize: file.size,
      transferredBytes: 0,
      progress: 0,
      statusText: 'Waiting for recipient...',
      speedText: '',
      etaText: '',
      transport: initialTransport,
      isCancelled: false,
      peer: targetUser,
      downloadUrl: null,
      downloadName: ''
    });

    socket.emit('file_send_request', {
      to: targetUser,
      fileName: file.name,
      totalSize: file.size,
      mimeType: resolveMimeType(file.name, file.type),
      transport: initialTransport
    });
  };

  const acceptIncomingFile = () => {
    if (!socket || !incomingFileRequest) return;
    const req = incomingFileRequest;

    const rtc = webrtcPeersRef.current[req.from];
    const initialTransport = (rtc && rtc.isOpen) ? 'Direct' : 'Relay';
    const finalMime = resolveMimeType(req.fileName, req.mimeType);

    transferRef.current = {
      file: null,
      offset: 0,
      chunkSize: WEBRTC_RAW_CHUNK_SIZE,
      receivedChunks: [],
      receivedSize: 0,
      totalSize: req.totalSize,
      fileName: req.fileName,
      mimeType: finalMime,
      peer: req.from,
      isCancelled: false,
      transport: initialTransport,
      startTime: performance.now(),
      lastSampleTime: performance.now(),
      lastSampleBytes: 0,
      lastSyncTime: 0,
      slidingWindowInFlight: 0,
      maxWindowSize: 16
    };

    setTransferState({
      active: true,
      mode: 'receiving',
      fileName: req.fileName,
      fileSize: req.totalSize,
      transferredBytes: 0,
      progress: 0,
      statusText: 'Starting download...',
      speedText: '',
      etaText: 'Calculating...',
      transport: initialTransport,
      isCancelled: false,
      peer: req.from,
      downloadUrl: null,
      downloadName: ''
    });

    socket.emit('file_accept', {
      to: req.from,
      fileName: req.fileName,
      totalSize: req.totalSize
    });
    setIncomingFileRequest(null);
  };

  const rejectIncomingFile = () => {
    if (socket && incomingFileRequest) {
      socket.emit('file_reject', { to: incomingFileRequest.from });
      setIncomingFileRequest(null);
    }
  };

  const cancelTransfer = () => {
    if (socket && transferRef.current.peer) {
      transferRef.current.isCancelled = true;
      socket.emit('cancel_transfer', { to: transferRef.current.peer });
      setTransferState((prev) => ({
        ...prev,
        active: false,
        statusText: '❌ Transfer Cancelled',
        speedText: '',
        etaText: '',
        isCancelled: true
      }));
    }
  };

  const disconnectPeer = (targetUser) => {
    if (socket) {
      connectedPeersRef.current.delete(targetUser);
      setConnectedPeers(new Set(connectedPeersRef.current));
      saveStoredPeers(connectedPeersRef.current);
      delete ecdhKeyPairsRef.current[targetUser];
      if (webrtcPeersRef.current[targetUser]) {
        webrtcPeersRef.current[targetUser].close();
        delete webrtcPeersRef.current[targetUser];
      }
      socket.emit('disconnect_user', { to: targetUser });
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
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
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
