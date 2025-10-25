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
    this.sessionData = null;
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
    this.sessionData = { callId, expires };
    localStorage.setItem('adminSession', JSON.stringify(this.sessionData));
  }

  loadSession() {
    const sessionData = localStorage.getItem('adminSession');
    if (!sessionData) return false;

    try {
      const session = JSON.parse(sessionData);
      if (new Date(session.expires) > new Date()) {
        this.sessionData = session;
        $('#otpInput').dataset.callId = session.callId;
        this.showDashboard();
        return true;
      } else {
        localStorage.removeItem('adminSession');
        this.sessionData = null;
      }
    } catch (err) {
      localStorage.removeItem('adminSession');
      this.sessionData = null;
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
    this.sessionData = null;
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

  getSessionCallId() {
    return this.sessionData?.callId || '';
  }

  async acceptCall(callId) {
    try {
      const res = await fetch('/api/accept-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Call-ID': this.getSessionCallId()
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
          'X-Call-ID': this.getSessionCallId()
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
          'X-Call-ID': this.getSessionCallId()
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
          'X-Call-ID': this.getSessionCallId()
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
          'X-Call-ID': this.getSessionCallId()
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

  // WebRTC Functions removed - duplicate code

  // Cleanup
  cleanup() {
    this.intervals.forEach(id => clearInterval(id));
    this.intervals = [];

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
