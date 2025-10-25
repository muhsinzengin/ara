// WebRTC Manager - Güvenli ve optimize edilmiş
class WebRTCManager {
  constructor() {
    this.currentCallId = null;
    this.pc = null;
    this.localStream = null;
    this.audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };
    this.codecSettings = {
      bitrate: 64000,
      dtx: true,
      fec: true
    };
    this.speakerVolume = 0.75;
    this.intervals = [];
    this.logger = window.Logger;
  }

  async initConnection(callId) {
    this.currentCallId = callId;

    try {
      console.log('[ADMIN WebRTC] Requesting media...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: this.audioConstraints,
        video: { width: 1280, height: 720, facingMode: 'user' }
      }).catch(err => {
        console.error('[ADMIN WebRTC] getUserMedia error:', err);
        this.hideLoading();
        throw err;
      });

      console.log('[ADMIN WebRTC] Media acquired:', {
        audio: this.localStream.getAudioTracks().length,
        video: this.localStream.getVideoTracks().length
      });

      // Local video'yu göster
      const localVideo = document.getElementById('fullLocalVideo');
      if (localVideo) {
        localVideo.srcObject = this.localStream;
      }

      this.pc = new RTCPeerConnection({
        iceServers: (typeof WebRTCConfig !== 'undefined' && WebRTCConfig.iceServers) ? WebRTCConfig.iceServers : [
          {urls: 'stun:stun.l.google.com:19302'},
          {urls: 'stun:global.stun.twilio.com:3478'}
        ]
      });

      this.localStream.getTracks().forEach(track => {
        console.log('[ADMIN WebRTC] Adding track:', track.kind);
        this.pc.addTrack(track, this.localStream);
      });

      this.pc.ontrack = (event) => {
        console.log('[ADMIN WebRTC] Track received:', event.track.kind);
        const stream = event.streams[0];

        if (event.track.kind === 'video') {
          const remoteVideo = document.getElementById('fullRemoteVideo');
          if (remoteVideo) {
            remoteVideo.srcObject = stream;
            console.log('[ADMIN WebRTC] Remote video set');
          }
        } else {
          const remoteAudio = document.getElementById('fullRemoteAudio');
          if (remoteAudio) {
            remoteAudio.srcObject = stream;
            remoteAudio.volume = this.speakerVolume;
            remoteAudio.play().catch(e => console.log('[ADMIN WebRTC] Audio autoplay:', e));
            console.log('[ADMIN WebRTC] Remote audio set');
          }
        }
      };

      this.pc.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('[ADMIN WebRTC] ICE candidate:', event.candidate.type);
          await this.sendSignal('ice', { candidate: event.candidate });
        } else {
          console.log('[ADMIN WebRTC] ICE gathering complete');
        }
      };

      this.pc.onconnectionstatechange = () => {
        console.log('[ADMIN WebRTC] Connection state:', this.pc.connectionState);
        if (this.pc.connectionState === 'connected') {
          console.log('[ADMIN WebRTC] ✅ Connection established!');
          this.startStatsMonitoring();
        }
      };

      // Poll for signals
      this.startSignalPolling();

      console.log('[ADMIN WebRTC] Connection initialized for call:', callId);
    } catch (err) {
      console.error('[ADMIN WebRTC] Init error:', err);
      this.hideLoading();
      throw err;
    }
  }

  showLoading(text) {
    const overlay = document.getElementById('fullLoadingOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
    }
  }

  hideLoading() {
    const overlay = document.getElementById('fullLoadingOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  startSignalPolling() {
    const pollInterval = setInterval(async () => {
      if (!this.currentCallId) return;

      try {
        const res = await fetch('/api/poll-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: this.currentCallId })
        });
        const data = await res.json();

        if (data.success) {
          // Answer varsa işle
          if (data.answer && !this.pc.currentRemoteDescription) {
            console.log('[ADMIN WebRTC] Received answer from INDEX');
            await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          }

          // ICE adayları varsa işle
          if (data.ice_candidates && data.ice_candidates.length > 0) {
            console.log('[ADMIN WebRTC] Received', data.ice_candidates.length, 'ICE candidates from INDEX');
            for (const candidate of data.ice_candidates) {
              if (candidate) {
                await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
              }
            }
          }

          // Offer varsa answer gönder
          if (data.offer && !this.pc.currentLocalDescription) {
            console.log('[ADMIN WebRTC] Received offer from INDEX, creating answer...');
            await this.pc.setRemoteDescription(new RTCSessionDescription(data.offer));

            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);

            console.log('[ADMIN WebRTC] Sending answer to INDEX');
            await this.sendSignal('answer', { answer });
          }
        }
      } catch (err) {
        console.error('[ADMIN WebRTC] Poll error:', err);
      }
    }, 1000);

    this.intervals.push(pollInterval);
  }

  async sendSignal(type, data) {
    try {
      await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: this.currentCallId,
          type,
          ...data
        })
      });
    } catch (err) {
      console.error('Signal send error:', err);
    }
  }

  startStatsMonitoring() {
    const statsInterval = setInterval(async () => {
      if (!this.pc) return;

      try {
        const stats = await this.pc.getStats();
        this.updateStats(stats);
      } catch (err) {
        console.error('Stats error:', err);
      }
    }, 2000);

    this.intervals.push(statsInterval);
  }

  updateStats(stats) {
    let audioStats = { packetsLost: 0, jitter: 0, roundTripTime: 0 };

    stats.forEach(report => {
      if (report.type === 'inbound-rtp' && report.kind === 'audio') {
        audioStats.packetsLost = report.packetsLost || 0;
        audioStats.jitter = report.jitter || 0;
        audioStats.roundTripTime = report.roundTripTime || 0;
      }
    });

    // UI güncelle
    const lossEl = document.getElementById('perfLoss');
    const jitterEl = document.getElementById('perfJitter');

    if (lossEl) {
      const lossPercent = audioStats.packetsLost > 0 ? (audioStats.packetsLost / (audioStats.packetsLost + 1)) * 100 : 0;
      lossEl.textContent = lossPercent.toFixed(1) + '%';
      lossEl.parentElement.querySelector('.progress__bar').style.width = Math.min(lossPercent * 2, 100) + '%';
    }

    if (jitterEl) {
      jitterEl.textContent = (audioStats.jitter * 1000).toFixed(0) + 'ms';
      jitterEl.parentElement.querySelector('.progress__bar').style.width = Math.min(audioStats.jitter * 20000, 100) + '%';
    }
  }

  // Ses ayarları
  updateAudioConstraints(constraints) {
    this.audioConstraints = { ...this.audioConstraints, ...constraints };

    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.applyConstraints({
          advanced: [{
            echoCancellation: this.audioConstraints.echoCancellation,
            noiseSuppression: this.audioConstraints.noiseSuppression,
            autoGainControl: this.audioConstraints.autoGainControl
          }]
        }).catch(err => console.error('Audio constraints error:', err));
      }
    }
  }

  setSpeakerVolume(volume) {
    this.speakerVolume = volume;
    const remoteAudio = document.getElementById('fullRemoteAudio');
    if (remoteAudio) {
      remoteAudio.volume = volume;
    }
  }

  async changeAudioDevice(kind, deviceId) {
    try {
      const newConstraints = {
        audio: { ...this.audioConstraints, deviceId: deviceId ? { exact: deviceId } : undefined },
        video: false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(newConstraints);

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
      }

      this.localStream = newStream;

      // Peer connection'ı güncelle
      if (this.pc) {
        const sender = this.pc.getSenders().find(s => s.track && s.track.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(this.localStream.getAudioTracks()[0]);
        }
      }

      console.log(`[ADMIN WebRTC] ${kind} device changed`);
    } catch (err) {
      console.error('Change audio device error:', err);
    }
  }

  // Codec ayarları
  updateCodecSettings(settings) {
    this.codecSettings = { ...this.codecSettings, ...settings };

    if (this.pc && this.pc.currentLocalDescription) {
      // SDP'yi güncelle
      let sdp = this.pc.currentLocalDescription.sdp;

      if (typeof WebRTCConfig !== 'undefined' && WebRTCConfig.applyOpusSettings) {
        sdp = WebRTCConfig.applyOpusSettings(sdp, {
          maxaveragebitrate: this.codecSettings.bitrate,
          useinbandfec: this.codecSettings.fec ? 1 : 0,
          usedtx: this.codecSettings.dtx ? 1 : 0
        });
      }

      this.pc.setLocalDescription({ type: 'offer', sdp }).catch(err => {
        console.error('Codec settings error:', err);
      });
    }
  }

  // Toggle fonksiyonları
  toggleMic() {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      return track.enabled;
    }
    return false;
  }

  toggleVideo() {
    if (!this.localStream) return false;
    const track = this.localStream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      return track.enabled;
    }
    return false;
  }

  toggleSpeaker() {
    const remoteAudio = document.getElementById('fullRemoteAudio');
    if (remoteAudio) {
      remoteAudio.muted = !remoteAudio.muted;
      return !remoteAudio.muted;
    }
    return false;
  }

  // Cleanup
  cleanup() {
    console.log('[ADMIN WebRTC] Cleaning up...');

    this.intervals.forEach(id => clearInterval(id));
    this.intervals = [];

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.currentCallId = null;
    console.log('[ADMIN WebRTC] Cleanup complete');
  }
}
