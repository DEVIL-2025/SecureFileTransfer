/**
 * WebRTC P2P DataChannel Manager for High-Speed Large & Small File Streaming
 * Strict adherence to 64KB RTCDataChannel SCTP frame limits + Backpressure flow control
 */

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// Optimal Backpressure Threshold (512 KB) for continuous saturation without queue bloat
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
      console.log(`[WebRTC] Connection with @${this.peerUsername}: ${this.pc.connectionState}`);
      if (['disconnected', 'failed', 'closed'].includes(this.pc.connectionState)) {
        this.isOpen = false;
        if (this.onChannelClose) this.onChannelClose();
      }
    };
  }

  _setupDataChannel(channel) {
    this.dataChannel = channel;
    this.dataChannel.binaryType = 'arraybuffer';
    this.dataChannel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_THRESHOLD;

    this.dataChannel.onopen = () => {
      console.log(`[WebRTC] P2P DataChannel OPEN with @${this.peerUsername} ⚡`);
      this.isOpen = true;
      if (this.onChannelOpen) this.onChannelOpen();
    };

    this.dataChannel.onclose = () => {
      console.log(`[WebRTC] P2P DataChannel CLOSED with @${this.peerUsername}`);
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

    const channel = this.pc.createDataChannel('fileTransferChannel', {
      ordered: true
    });
    this._setupDataChannel(channel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this.socket.emit('webrtc_offer', {
      to: this.peerUsername,
      sdp: offer
    });
  }

  async handleOffer(offerSdp) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    
    while (this.queuedCandidates.length > 0) {
      const c = this.queuedCandidates.shift();
      await this.pc.addIceCandidate(c);
    }

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.socket.emit('webrtc_answer', {
      to: this.peerUsername,
      sdp: answer
    });
  }

  async handleAnswer(answerSdp) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
    
    while (this.queuedCandidates.length > 0) {
      const c = this.queuedCandidates.shift();
      await this.pc.addIceCandidate(c);
    }
  }

  async addIceCandidate(candidate) {
    if (this.pc.remoteDescription) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      this.queuedCandidates.push(new RTCIceCandidate(candidate));
    }
  }

  async sendBinaryChunk(data) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('DataChannel is not open');
    }

    // Backpressure flow control: pause if internal buffer exceeds threshold
    if (this.dataChannel.bufferedAmount > BUFFERED_AMOUNT_LOW_THRESHOLD) {
      await new Promise((resolve) => {
        const handler = () => {
          this.dataChannel.removeEventListener('bufferedamountlow', handler);
          resolve();
        };
        this.dataChannel.addEventListener('bufferedamountlow', handler);
      });
    }

    this.dataChannel.send(data);
  }

  close() {
    this.isOpen = false;
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
    }
    if (this.pc) {
      try { this.pc.close(); } catch {}
    }
  }
}
