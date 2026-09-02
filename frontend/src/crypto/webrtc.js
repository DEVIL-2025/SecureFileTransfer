/**
 * WebRTC P2P DataChannel Manager for High-Speed Direct P2P File Streaming
 * Full wire-speed direct browser-to-browser data transfer with STUN hole-punching
 */

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ],
  iceCandidatePoolSize: 10
};

// 512 KB buffer threshold for optimal continuous throughput
const BUFFERED_AMOUNT_LOW_THRESHOLD = 512 * 1024;

export class WebRtcPeer {
  constructor(peerUsername, socket, onChannelOpen, onChannelClose, onDataReceived) {
    this.peerUsername = peerUsername;
    this.socket = socket;
    this.onChannelOpen = onChannelOpen;
    this.onChannelClose = onChannelClose;
    this.onDataReceived = onDataReceived;

    this.pc = new RTCPeerConnection(RTC_CONFIG);
    this.dataChannel = null;
    this.isOpen = false;
    this.queuedCandidates = [];
    this.makingOffer = false;

    this._setupPeerConnection();
  }

  _setupPeerConnection() {
    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('webrtc_ice_candidate', {
          to: this.peerUsername,
          candidate: event.candidate
        });
      }
    };

    this.pc.ondatachannel = (event) => {
      this._setupDataChannel(event.channel);
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      if (['disconnected', 'failed', 'closed'].includes(state)) {
        this.isOpen = false;
        if (this.onChannelClose) this.onChannelClose();
      }
    };
  }

  _setupDataChannel(channel) {
    this.dataChannel = channel;
    this.dataChannel.binaryType = 'arraybuffer';
    this.dataChannel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_THRESHOLD;

    if (channel.readyState === 'open') {
      this.isOpen = true;
      if (this.onChannelOpen) this.onChannelOpen();
    }

    this.dataChannel.onopen = () => {
      this.isOpen = true;
      if (this.onChannelOpen) this.onChannelOpen();
    };

    this.dataChannel.onclose = () => {
      this.isOpen = false;
      if (this.onChannelClose) this.onChannelClose();
    };

    this.dataChannel.onmessage = (event) => {
      if (this.onDataReceived) {
        this.onDataReceived(event.data);
      }
    };

    this.dataChannel.onerror = (err) => {
      console.error(`[WebRTC] DataChannel error with @${this.peerUsername}:`, err);
    };
  }

  async createOffer() {
    if (this.dataChannel && this.dataChannel.readyState === 'open') return;
    if (this.makingOffer) return;

    try {
      this.makingOffer = true;
      const channel = this.pc.createDataChannel('fileTransferChannel', {
        ordered: true
      });
      this._setupDataChannel(channel);

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      this.socket.emit('webrtc_offer', {
        to: this.peerUsername,
        sdp: this.pc.localDescription
      });
    } catch (err) {
      console.error('[WebRTC] createOffer error:', err);
    } finally {
      this.makingOffer = false;
    }
  }

  async handleOffer(offerSdp) {
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
      await this._flushQueuedCandidates();

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      this.socket.emit('webrtc_answer', {
        to: this.peerUsername,
        sdp: this.pc.localDescription
      });
    } catch (err) {
      console.error('[WebRTC] handleOffer error:', err);
    }
  }

  async handleAnswer(answerSdp) {
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
      await this._flushQueuedCandidates();
    } catch (err) {
      console.error('[WebRTC] handleAnswer error:', err);
    }
  }

  async addIceCandidate(candidate) {
    if (!candidate) return;
    try {
      if (this.pc && this.pc.remoteDescription && this.pc.remoteDescription.type) {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        this.queuedCandidates.push(candidate);
      }
    } catch (e) {
      console.warn('[WebRTC] addIceCandidate error:', e);
    }
  }

  async _flushQueuedCandidates() {
    while (this.queuedCandidates.length > 0) {
      const c = this.queuedCandidates.shift();
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.warn('[WebRTC] flush candidate error:', e);
      }
    }
  }

  async sendBinaryChunk(data) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('DataChannel is not open');
    }

    // Backpressure flow control
    if (this.dataChannel.bufferedAmount > BUFFERED_AMOUNT_LOW_THRESHOLD) {
      await new Promise((resolve) => {
        let timeoutId;
        const handler = () => {
          clearTimeout(timeoutId);
          this.dataChannel.removeEventListener('bufferedamountlow', handler);
          resolve();
        };
        timeoutId = setTimeout(() => {
          if (this.dataChannel) {
            this.dataChannel.removeEventListener('bufferedamountlow', handler);
          }
          resolve();
        }, 1000);
        this.dataChannel.addEventListener('bufferedamountlow', handler);
      });
    }

    this.dataChannel.send(data);
  }

  close() {
    this.isOpen = false;
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch {}
    }
  }
}
