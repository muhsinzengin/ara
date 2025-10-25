// Admin Main Controller - Güvenli ve optimize edilmiş

// Safe DOM selector
const $ = (id) => {
  // Remove # if present
  const cleanId = id.startsWith('#') ? id.substring(1) : id;
  const element = document.getElementById(cleanId);
  // Don't log error for optional elements
  if (!element) {
    return null;
  }
  return element;
};

class AdminPanel {
  constructor() {
    this.active = new Map();
    this.history = [];
    this.ui = new UIManager();
    this.webrtc = null;
    this.intervals = [];
    this.autoAccept = false;
    this.pc = null;
    this.localStream = null;
    this.currentCallId = null;
    this.isInCall = false;
    this.init();
  }

  init() {
    // Güvenli event listeners
    this.bindEvents();
    this.loadSession();
    this.startPolling();
    this.loadRealData();
  }

  bindEvents() {
    // OTP sistemi
    const requestOtpBtn = $('#requestOtpBtn');
    const verifyOtpBtn = $('#verifyOtpBtn');
    const otpInput = $('#otpInput');
    
    if (requestOtpBtn) requestOtpBtn.onclick = () => this.requestOTP();
    if (verifyOtpBtn) verifyOtpBtn.onclick = () => this.verifyOTP();
    if (otpInput) {
      otpInput.onkeypress = (e) => {
        if (e.key === 'Enter') this.verifyOTP();
      };
    }

    // Arama kontrolleri
    const autoAcceptToggle = $('#autoAcceptToggle');
    if (autoAcceptToggle) autoAcceptToggle.onclick = () => this.toggleAutoAccept();

    // Temizlik butonları (optional - may not exist in HTML)
    const clearActiveBtn = $('#clearActiveBtn');
    const clearHistoryBtn = $('#clearHistoryBtn');
    if (clearActiveBtn) clearActiveBtn.onclick = () => this.clearActiveCalls();
    if (clearHistoryBtn) clearHistoryBtn.onclick = () => this.clearHistory();
    
    // Call control buttons
    const fullVideoBtn = $('#fullVideoBtn');
    const fullMicBtn = $('#fullMicBtn');
    const fullSpeakerBtn = $('#fullSpeakerBtn');
    const fullEndBtn = $('#fullEndBtn');
    
    if (fullVideoBtn) fullVideoBtn.onclick = () => this.toggleVideo();
    if (fullMicBtn) fullMicBtn.onclick = () => this.toggleMic();
    if (fullSpeakerBtn) fullSpeakerBtn.onclick = () => this.toggleSpeaker();
    if (fullEndBtn) fullEndBtn.onclick = () => this.endCall();

    // Ses ayarları
    this.bindAudioSettings();

    // Opus codec ayarları
    this.bindCodecSettings();
  }

  bindAudioSettings() {
    // Mikrofon ses seviyesi
    $('#micVolume').oninput = (e) => {
      const val = e.target.value;
      $('#micVolumeVal').textContent = val + '%';
      this.updateAudioConstraints();
    };

    // Hoparlör ses seviyesi
    $('#speakerVolume').oninput = (e) => {
      const val = e.target.value;
      $('#speakerVolumeVal').textContent = val + '%';
      this.updateSpeakerVolume();
    };

    // Toggle butonları
    ['toggleNoiseSuppression', 'toggleEchoCancellation', 'toggleAutoGain'].forEach(id => {
      $(`#${id}`).onclick = () => {
        $(`#${id}`).classList.toggle('on');
        this.updateAudioConstraints();
      };
    });

    // Mikrofon cihaz seçimi
    $('#micDevice').onchange = () => this.changeAudioDevice('audioinput');
    $('#speakerDevice').onchange = () => this.changeAudioDevice('audiooutput');
  }

  bindCodecSettings() {
    // Codec modu
    $('#codecAuto').onclick = () => this.setCodecMode('auto');
    $('#codecManual').onclick = () => this.setCodecMode('manual');

    // Bitrate ayarı
    $('#codecBitrate').oninput = (e) => {
      const val = e.target.value;
      $('#codecBitrateVal').textContent = val + 'kb/s';
      this.updateCodecSettings();
    };

    // DTX ve FEC
    ['toggleDTX', 'toggleFEC'].forEach(id => {
      $(`#${id}`).onclick = () => {
        $(`#${id}`).classList.toggle('on');
        this.updateCodecSettings();
      };
    });
  }

  async requestOTP() {
    try {
      const res = await fetch('/api/request-admin-otp', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        $('#otpInputSection').classList.remove('hidden');
        $('#otpError').classList.add('hidden');
        $('#otpInput').dataset.callId = data.callId; // CallId'yi dataset'e set et
        $('#otpInput').focus();
      }
    } catch (err) {
      console.error('OTP request error:', err);
    }
  }

  async verifyOTP() {
    const otp = $('#otpInput').value.trim();
    const callId = $('#otpInput').dataset.callId || '';

    if (!otp || otp.length !== 6) {
      this.showOTPError('6 haneli OTP girin');
      return;
    }

    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp, callId })
      });
      const data = await res.json();

      if (data.success) {
        this.saveSession(data.callId);
        this.showDashboard();
      } else {
        this.showOTPError(data.error || 'Geçersiz OTP');
      }
    } catch (err) {
      console.error('OTP verify error:', err);
      this.showOTPError('Bağlantı hatası');
    }
  }

  showOTPError(message) {
    $('#otpError').textContent = message;
    $('#otpError').classList.remove('hidden');
  }

  saveSession(callId) {
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    localStorage.setItem('adminSession', JSON.stringify({ callId, expires }));
  }

  loadSession() {
    const sessionData = localStorage.getItem('adminSession');
    if (!sessionData) return false;

    try {
      const session = JSON.parse(sessionData);
      if (new Date(session.expires) > new Date()) {
        $('#otpInput').dataset.callId = session.callId;
        this.showDashboard();
        return true;
      } else {
        localStorage.removeItem('adminSession');
      }
    } catch (err) {
      localStorage.removeItem('adminSession');
    }
    return false;
  }

  showDashboard() {
    $('#otpScreen').classList.add('hidden');
    $('#dashboardScreen').classList.remove('hidden');
    this.ui.updateKPIs();
  }

  logout() {
    localStorage.removeItem('adminSession');
    this.ui.showOTPScreen();
  }

  toggleAutoAccept() {
    this.autoAccept = !this.autoAccept;
    localStorage.setItem('autoAcceptEnabled', String(this.autoAccept));
    // Toggle button için text güncelleme yerine data attribute kullan
    $('#autoAcceptToggle').setAttribute('data-label', `Oto Kabul: ${this.autoAccept ? 'ON' : 'OFF'}`);
    $('#autoAcceptToggle').classList.toggle('active', this.autoAccept);
  }

  startPolling() {
    // Aktif çağrıları güncelle - her 3 saniyede bir
    const pollInterval = setInterval(() => {
      this.loadRealData();
    }, 3000);
    this.intervals.push(pollInterval);
  }

  async loadRealData() {
    try {
      const res = await fetch('/api/active-calls');
      const data = await res.json();

      if (data.success && data.active_calls) {
        this.updateActiveCalls(data.active_calls);
      }
    } catch (err) {
      console.error('Load real data error:', err);
    }
  }

  updateActiveCalls(calls) {
    const currentIds = new Set(calls.map(c => c.call_id));

    // Eski çağrıları kaldır
    for (const [id, call] of this.active) {
      if (!currentIds.has(id)) {
        this.active.delete(id);
      }
    }

    // Yeni çağrıları ekle/güncelle
    calls.forEach(call => {
      const existing = this.active.get(call.call_id);
      if (!existing || existing.status !== call.status) {
        this.active.set(call.call_id, {
          id: call.call_id,
          name: call.customer_name,
          status: call.status,
          timestamp: call.formatted_time,
          date: call.formatted_date,
          minutesAgo: call.minutes_ago
        });
      }
    });

    this.ui.updateActiveCalls();
    this.ui.updateKPIs();

    // Otomatik kabul
    if (this.autoAccept) {
      const waitingCalls = Array.from(this.active.values()).filter(c => c.status === 'waiting');
      if (waitingCalls.length > 0) {
        this.acceptCall(waitingCalls[0].id);
      }
    }
  }

  async acceptCall(callId) {
    try {
      const res = await fetch('/api/accept-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Call-ID': JSON.parse(localStorage.getItem('adminSession') || '{}').callId || ''
        },
        body: JSON.stringify({ callId: callId })
      });
      const data = await res.json();

      if (data.success) {
        console.log('[ADMIN] Call accepted:', callId);
        this.currentCallId = callId;
        
        // Initialize WebRTC if not already done
        if (!this.pc) {
          const success = await this.initWebRTC();
          if (!success) {
            throw new Error('WebRTC initialization failed');
          }
        }
        
        // Show call UI
        this.showCallUI();
        
        // Wait for offer from customer
        await this.waitForOffer(callId);
        
        this.loadRealData();
      }
    } catch (err) {
      console.error('Accept call error:', err);
    }
  }

  async holdCall(callId) {
    try {
      const res = await fetch('/api/hold-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Call-ID': JSON.parse(localStorage.getItem('adminSession') || '{}').callId || ''
        },
        body: JSON.stringify({ callId })
      });
      const data = await res.json();

      if (data.success) {
        this.ui.showDashboard();
      }
    } catch (err) {
      console.error('Hold call error:', err);
    }
  }

  async closeCall(callId) {
    try {
      const res = await fetch('/api/close-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Call-ID': JSON.parse(localStorage.getItem('adminSession') || '{}').callId || ''
        },
        body: JSON.stringify({ callId })
      });
      const data = await res.json();

      if (data.success) {
        if (this.webrtc) {
          this.webrtc.cleanup();
          this.webrtc = null;
        }
        this.ui.showDashboard();
      }
    } catch (err) {
      console.error('Close call error:', err);
    }
  }

  async clearActiveCalls() {
    if (!confirm('Tüm aktif çağrıları temizlemek istediğinizden emin misiniz?')) return;

    try {
      const res = await fetch('/api/clear-active-calls', {
        method: 'POST',
        headers: {
          'X-Call-ID': JSON.parse(localStorage.getItem('adminSession') || '{}').callId || ''
        }
      });
      const data = await res.json();

      if (data.success) {
        this.active.clear();
        this.ui.updateActiveCalls();
        this.ui.updateKPIs();
      }
    } catch (err) {
      console.error('Clear active calls error:', err);
    }
  }

  async clearHistory() {
    if (!confirm('Tüm geçmiş kayıtları silmek istediğinizden emin misiniz?')) return;

    try {
      const res = await fetch('/api/clear-history', {
        method: 'POST',
        headers: {
          'X-Call-ID': JSON.parse(localStorage.getItem('adminSession') || '{}').callId || ''
        }
      });
      const data = await res.json();

      if (data.success) {
        this.history = [];
        this.ui.updateHistory();
        this.ui.updateKPIs();
      }
    } catch (err) {
      console.error('Clear history error:', err);
    }
  }

  // Ses ayarları
  updateAudioConstraints() {
    if (!this.webrtc) return;

    const constraints = {
      echoCancellation: $('#toggleEchoCancellation').classList.contains('on'),
      noiseSuppression: $('#toggleNoiseSuppression').classList.contains('on'),
      autoGainControl: $('#toggleAutoGain').classList.contains('on')
    };

    this.webrtc.updateAudioConstraints(constraints);
  }

  updateSpeakerVolume() {
    const volume = parseInt($('#speakerVolume').value) / 100;
    if (this.webrtc) {
      this.webrtc.setSpeakerVolume(volume);
    }
  }

  async changeAudioDevice(kind) {
    const deviceId = $(`#${kind === 'audioinput' ? 'mic' : 'speaker'}Device`).value;
    if (this.webrtc) {
      await this.webrtc.changeAudioDevice(kind, deviceId);
    }
  }

  // Codec ayarları
  setCodecMode(mode) {
    $('#codecAuto').classList.toggle('active', mode === 'auto');
    $('#codecManual').classList.toggle('active', mode === 'manual');

    if (mode === 'auto') {
      // Otomatik ayarlar
      $('#codecBitrate').value = 64;
      $('#codecBitrateVal').textContent = '64kb/s';
      $('#toggleDTX').classList.add('on');
      $('#toggleFEC').classList.add('on');
    }

    this.updateCodecSettings();
  }

  updateCodecSettings() {
    if (!this.webrtc) return;

    const settings = {
      bitrate: parseInt($('#codecBitrate').value) * 1000,
      dtx: $('#toggleDTX').classList.contains('on'),
      fec: $('#toggleFEC').classList.contains('on')
    };

    this.webrtc.updateCodecSettings(settings);
  }

  // WebRTC Functions
  async initWebRTC() {
    try {
      console.log('[ADMIN WebRTC] Initializing...');
      
      // Check if we're in a secure context
      const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      if (!isSecure) {
        throw new Error('HTTPS veya localhost gerekli');
      }
      
      // Check WebRTC support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('WebRTC not supported');
      }
      
      // Skip permission check - let getUserMedia handle it
      console.log('[ADMIN WebRTC] İzin kontrolü atlanıyor, direkt medya erişimi deneniyor...');
      
      // Get local media with simplified constraints
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true},
        video: {width: {ideal: 640}, height: {ideal: 480}, frameRate: {ideal: 15}}
      });
      
      console.log('[ADMIN WebRTC] Media acquired:', {
        audio: this.localStream.getAudioTracks().length,
        video: this.localStream.getVideoTracks().length
      });
      
      // Set local video
      const localVideo = $('#fullLocalVideo');
      if (localVideo) {
        localVideo.srcObject = this.localStream;
      }
      
      // Create peer connection
      this.pc = new RTCPeerConnection({
        iceServers: [
          {urls: 'stun:stun.l.google.com:19302'},
          {urls: 'stun:global.stun.twilio.com:3478'}
        ]
      });
      
      // Add local tracks
      this.localStream.getTracks().forEach(track => {
        console.log('[ADMIN WebRTC] Adding track:', track.kind);
        this.pc.addTrack(track, this.localStream);
      });
      
      // Handle remote tracks
      this.pc.ontrack = (event) => {
        console.log('[ADMIN WebRTC] Remote track received:', event.track.kind);
        const stream = event.streams[0];
        
        if (event.track.kind === 'video') {
          const remoteVideo = $('#fullRemoteVideo');
          if (remoteVideo) {
            remoteVideo.srcObject = stream;
          }
        } else {
          const remoteAudio = $('#fullRemoteAudio');
          if (remoteAudio) {
            remoteAudio.srcObject = stream;
            remoteAudio.play().catch(e => console.log('[ADMIN WebRTC] Audio autoplay:', e));
          }
        }
      };
      
      // Handle ICE candidates
      this.pc.onicecandidate = async (event) => {
        if (event.candidate && this.currentCallId) {
          console.log('[ADMIN WebRTC] Sending ICE candidate');
          await this.sendSignal('ice-candidate', {candidate: event.candidate});
        }
      };
      
      // Handle connection state
      this.pc.onconnectionstatechange = () => {
        console.log('[ADMIN WebRTC] Connection state:', this.pc.connectionState);
        if (this.pc.connectionState === 'connected') {
          console.log('[ADMIN WebRTC] ✅ Connected!');
          this.isInCall = true;
          this.updateCallUI(true);
        }
      };
      
      console.log('[ADMIN WebRTC] ✅ Initialized successfully');
      return true;
    } catch (error) {
      console.error('[ADMIN WebRTC] Init error:', error);
      
      // Show permission warning if needed
      if (error.message && (error.message.includes('izni reddedildi') || error.message.includes('Permission denied'))) {
        this.showPermissionWarning();
      }
      
      return false;
    }
  }
  
  async acceptCall(callId) {
    try {
      console.log('[ADMIN WebRTC] Accepting call:', callId);
      this.currentCallId = callId;
      
      // Initialize WebRTC if not already done
      if (!this.pc) {
        const success = await this.initWebRTC();
        if (!success) {
          throw new Error('WebRTC initialization failed');
        }
      }
      
      // Show call UI
      this.showCallUI();
      
      // Send accept signal to server
      const response = await fetch('/api/accept-call', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({callId: callId})
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to accept call');
      }
      
      // Wait for offer from customer
      await this.waitForOffer(callId);
      
    } catch (error) {
      console.error('[ADMIN WebRTC] Accept call error:', error);
      this.hideCallUI();
    }
  }
  
  async waitForOffer(callId) {
    console.log('[ADMIN WebRTC] Waiting for offer...');
    
    const pollOffer = async () => {
      try {
        const response = await fetch(`/api/call-status/${callId}`);
        const data = await response.json();
        
        if (data.success && data.offer) {
          console.log('[ADMIN WebRTC] Offer received, creating answer...');
          await this.handleOffer(data.offer);
          return;
        }
        
        // Continue polling if no offer yet
        setTimeout(pollOffer, 1000);
      } catch (error) {
        console.error('[ADMIN WebRTC] Poll offer error:', error);
      }
    };
    
    pollOffer();
  }
  
  async handleOffer(offer) {
    try {
      console.log('[ADMIN WebRTC] Handling offer...');
      
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      
      console.log('[ADMIN WebRTC] Sending answer...');
      await this.sendSignal('answer', {answer: answer});
      
    } catch (error) {
      console.error('[ADMIN WebRTC] Handle offer error:', error);
    }
  }
  
  async sendSignal(type, data) {
    try {
      let endpoint = '';
      switch(type) {
        case 'answer':
          endpoint = '/api/webrtc-answer';
          break;
        case 'ice-candidate':
          endpoint = '/api/ice-candidate';
          break;
        default:
          console.error('Unknown signal type:', type);
          return;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          callId: this.currentCallId,
          ...data
        })
      });
      
      const result = await response.json();
      if (!result.success) {
        console.error('[ADMIN WebRTC] Signal error:', result.error);
      }
    } catch (error) {
      console.error('[ADMIN WebRTC] Send signal error:', error);
    }
  }
  
  async endCall() {
    try {
      console.log('[ADMIN WebRTC] Ending call...');
      
      if (this.currentCallId) {
        await fetch('/api/end-call', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({callId: this.currentCallId})
        });
      }
      
      this.cleanupWebRTC();
      this.hideCallUI();
      
    } catch (error) {
      console.error('[ADMIN WebRTC] End call error:', error);
    }
  }
  
  cleanupWebRTC() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    
    this.currentCallId = null;
    this.isInCall = false;
  }
  
  showCallUI() {
    const callUI = $('#callUI');
    if (callUI) {
      callUI.classList.remove('hidden');
    }
  }
  
  hideCallUI() {
    const callUI = $('#callUI');
    if (callUI) {
      callUI.classList.add('hidden');
    }
  }
  
  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log('[ADMIN] Video toggled:', videoTrack.enabled);
        
        const videoBtn = $('#fullVideoBtn');
        if (videoBtn) {
          videoBtn.classList.toggle('muted', !videoTrack.enabled);
        }
      }
    }
  }
  
  toggleMic() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log('[ADMIN] Mic toggled:', audioTrack.enabled);
        
        const micBtn = $('#fullMicBtn');
        if (micBtn) {
          micBtn.classList.toggle('muted', !audioTrack.enabled);
        }
      }
    }
  }
  
  toggleSpeaker() {
    const remoteAudio = $('#fullRemoteAudio');
    if (remoteAudio) {
      remoteAudio.muted = !remoteAudio.muted;
      console.log('[ADMIN] Speaker toggled:', !remoteAudio.muted);
      
      const speakerBtn = $('#fullSpeakerBtn');
      if (speakerBtn) {
        speakerBtn.classList.toggle('muted', remoteAudio.muted);
      }
    }
  }

  updateCallUI(inCall) {
    const videoBtn = $('#fullVideoBtn');
    const micBtn = $('#fullMicBtn');
    const endBtn = $('#fullEndBtn');
    
    if (videoBtn) videoBtn.disabled = !inCall;
    if (micBtn) micBtn.disabled = !inCall;
    if (endBtn) endBtn.disabled = !inCall;
  }

  // Cleanup
  cleanup() {
    this.intervals.forEach(id => clearInterval(id));
    this.intervals = [];
    this.cleanupWebRTC();

    if (this.webrtc) {
      this.webrtc.cleanup();
      this.webrtc = null;
    }
  }
  
  // Show permission warning
  showPermissionWarning() {
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(244, 67, 54, 0.95);
      color: white;
      padding: 20px;
      border-radius: 15px;
      z-index: 10000;
      text-align: center;
      max-width: 90%;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    `;
    warningDiv.innerHTML = `
      <h3>🚫 İZİNLER REDDEDİLDİ!</h3>
      <p><strong>Admin Panel Çözümü:</strong></p>
      <p>1️⃣ Tarayıcı adres çubuğundaki 🔒 ikonuna tıklayın</p>
      <p>2️⃣ Kamera ve Mikrofon izinlerini "İzin Ver" yapın</p>
      <p>3️⃣ Sayfayı yenileyin</p>
      <button onclick="location.reload()" style="background: white; color: #f44336; border: none; padding: 10px 20px; border-radius: 5px; margin-top: 10px; cursor: pointer;">
        🔄 Sayfayı Yenile
      </button>
      <button onclick="this.parentElement.remove()" style="background: #666; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin-top: 10px; margin-left: 10px; cursor: pointer;">
        ❌ Kapat
      </button>
    `;
    document.body.appendChild(warningDiv);
  }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  window.adminPanel = new AdminPanel();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.adminPanel) {
    window.adminPanel.cleanup();
  }
});
