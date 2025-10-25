// Admin Main Controller - CSRF Protected
class AdminPanel {
  constructor() {
    this.sessionData = null;
    this.active = new Map();
    this.init();
  }

  init() {
    this.loadSession();
    this.bindEvents();
    this.startPolling();
    this.startDatabaseMonitoring();
  }

  bindEvents() {
    // OTP Buttons
    CommonUtils.$('#requestOtpBtn')?.addEventListener('click', () => this.requestOTP());
    CommonUtils.$('#verifyOtpBtn')?.addEventListener('click', () => this.verifyOTP());
    CommonUtils.$('#otpInput')?.addEventListener('keypress', (e) => e.key === 'Enter' && this.verifyOTP());
    
    // Settings Toggle Buttons
    CommonUtils.$('#toggleNoiseSuppression')?.addEventListener('click', () => this.toggleSetting('noiseSuppression'));
    CommonUtils.$('#toggleEchoCancellation')?.addEventListener('click', () => this.toggleSetting('echoCancellation'));
    CommonUtils.$('#toggleAutoGain')?.addEventListener('click', () => this.toggleSetting('autoGain'));
    CommonUtils.$('#toggleDTX')?.addEventListener('click', () => this.toggleSetting('dtx'));
    CommonUtils.$('#toggleFEC')?.addEventListener('click', () => this.toggleSetting('fec'));
    CommonUtils.$('#toggleSimulcast')?.addEventListener('click', () => this.toggleSetting('simulcast'));
    CommonUtils.$('#toggleHWAccel')?.addEventListener('click', () => this.toggleSetting('hwAccel'));
    
    // Codec Mode Buttons
    CommonUtils.$('#codecAuto')?.addEventListener('click', () => this.setCodecMode('auto'));
    CommonUtils.$('#codecManual')?.addEventListener('click', () => this.setCodecMode('manual'));
    
    // Call Control Buttons
    CommonUtils.$('#fullVideoBtn')?.addEventListener('click', () => this.toggleVideo());
    CommonUtils.$('#fullMicBtn')?.addEventListener('click', () => this.toggleMic());
    CommonUtils.$('#fullSpeakerBtn')?.addEventListener('click', () => this.toggleSpeaker());
    CommonUtils.$('#fullEndBtn')?.addEventListener('click', () => this.endCall());
  }

  async requestOTP() {
    try {
      const res = await fetch('/api/request-admin-otp', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        CommonUtils.$('#otpInputSection').classList.remove('hidden');
        CommonUtils.$('#otpInput').dataset.callId = data.callId;
        CommonUtils.$('#otpInput').focus();
      }
    } catch (err) {
      console.error('OTP request error:', err);
    }
  }

  async verifyOTP() {
    const otp = CommonUtils.$('#otpInput').value.trim();
    const callId = CommonUtils.$('#otpInput').dataset.callId;

    if (!otp || otp.length !== 6) {
      this.showError('6 haneli OTP girin');
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
        this.sessionData = {
          callId: data.callId,
          csrfToken: data.csrfToken,
          expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
        };
        localStorage.setItem('adminSession', JSON.stringify(this.sessionData));
        this.showDashboard();
      } else {
        this.showError(data.error || 'Geçersiz OTP');
      }
    } catch (err) {
      console.error('OTP verify error:', err);
      this.showError('Bağlantı hatası');
    }
  }

  showError(message) {
    const errorEl = CommonUtils.$('#otpError');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  }

  loadSession() {
    const sessionData = localStorage.getItem('adminSession');
    if (!sessionData) return false;

    try {
      const session = JSON.parse(sessionData);
      if (new Date(session.expires) > new Date()) {
        this.sessionData = session;
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
    this.loadRealData();
  }

  logout() {
    localStorage.removeItem('adminSession');
    this.sessionData = null;
    location.reload();
  }

  async apiCall(url, options = {}) {
    if (!this.sessionData) throw new Error('No session');

    const headers = {
      'Content-Type': 'application/json',
      'X-Call-ID': this.sessionData.callId,
      'X-CSRF-Token': this.sessionData.csrfToken,
      ...options.headers
    };

    return fetch(url, { ...options, headers });
  }

  async loadRealData() {
    try {
      const res = await this.apiCall('/api/active-calls');
      const data = await res.json();

      if (data.success && data.active_calls) {
        this.updateActiveCalls(data.active_calls);
      }
    } catch (err) {
      console.error('Load data error:', err);
    }
  }

  updateActiveCalls(calls) {
    this.active.clear();
    calls.forEach(call => {
      this.active.set(call.call_id, {
        id: call.call_id,
        name: call.customer_name,
        status: call.status,
        timestamp: call.formatted_time
      });
    });

    const activeCount = Array.from(this.active.values()).filter(c => c.status !== 'waiting').length;
    const queueCount = Array.from(this.active.values()).filter(c => c.status === 'waiting').length;

    $('#lblActive').textContent = activeCount;
    $('#lblQueue').textContent = queueCount;
  }

  startPolling() {
    setInterval(() => this.loadRealData(), 3000);
  }

  async acceptCall(callId) {
    try {
      const res = await this.apiCall('/api/accept-call', {
        method: 'POST',
        body: JSON.stringify({ callId })
      });
      const data = await res.json();
      if (data.success) {
        console.log('Call accepted:', callId);
      }
    } catch (err) {
      console.error('Accept call error:', err);
    }
  }

  async closeCall(callId) {
    try {
      const res = await this.apiCall('/api/close-call', {
        method: 'POST',
        body: JSON.stringify({ callId })
      });
      const data = await res.json();
      if (data.success) {
        console.log('Call closed:', callId);
      }
    } catch (err) {
      console.error('Close call error:', err);
    }
  }

  refreshData() {
    this.loadRealData();
  }

  // Settings Toggle Methods
  toggleSetting(settingName) {
    const button = CommonUtils.$(`#toggle${settingName.charAt(0).toUpperCase() + settingName.slice(1)}`);
    if (!button) return;
    
    const isOn = button.classList.contains('on');
    button.classList.toggle('on', !isOn);
    button.textContent = !isOn ? 'Açık' : 'Kapalı';
    
    // Apply setting to WebRTC if available
    if (window.webrtcManager) {
      this.applySettingToWebRTC(settingName, !isOn);
    }
    
    console.log(`Setting ${settingName} ${!isOn ? 'enabled' : 'disabled'}`);
  }

  setCodecMode(mode) {
    const autoBtn = CommonUtils.$('#codecAuto');
    const manualBtn = CommonUtils.$('#codecManual');
    
    if (mode === 'auto') {
      autoBtn?.classList.add('active');
      manualBtn?.classList.remove('active');
    } else {
      manualBtn?.classList.add('active');
      autoBtn?.classList.remove('active');
    }
    
    console.log(`Codec mode set to: ${mode}`);
  }

  applySettingToWebRTC(settingName, enabled) {
    if (!window.webrtcManager || !window.webrtcManager.localStream) return;
    
    const audioTrack = window.webrtcManager.localStream.getAudioTracks()[0];
    if (!audioTrack) return;
    
    const constraints = {};
    switch (settingName) {
      case 'noiseSuppression':
        constraints.noiseSuppression = enabled;
        break;
      case 'echoCancellation':
        constraints.echoCancellation = enabled;
        break;
      case 'autoGain':
        constraints.autoGainControl = enabled;
        break;
    }
    
    if (Object.keys(constraints).length > 0) {
      audioTrack.applyConstraints({ advanced: [constraints] })
        .catch(e => console.error('Failed to apply audio constraints:', e));
    }
  }

  // Call Control Methods
  toggleVideo() {
    if (window.webrtcManager) {
      const enabled = window.webrtcManager.toggleVideo();
      CommonUtils.$('#fullVideoBtn').classList.toggle('off', !enabled);
    }
  }

  toggleMic() {
    if (window.webrtcManager) {
      const enabled = window.webrtcManager.toggleMic();
      CommonUtils.$('#fullMicBtn').classList.toggle('off', !enabled);
    }
  }

  toggleSpeaker() {
    const audio = CommonUtils.$('#fullRemoteAudio');
    if (audio) {
      audio.muted = !audio.muted;
      CommonUtils.$('#fullSpeakerBtn').classList.toggle('off', audio.muted);
    }
  }

  endCall() {
    if (window.webrtcManager) {
      window.webrtcManager.cleanup();
    }
    
    // Hide call screen and show dashboard
    CommonUtils.$('#fullCallScreen').classList.add('hidden');
    CommonUtils.$('#dashboardScreen').classList.remove('hidden');
    
    console.log('Call ended');
  }

  // Database Monitoring Methods
  async checkDatabaseStatus() {
    try {
      const response = await fetch('/api/database/status');
      const data = await response.json();
      
      if (data.success) {
        this.updateDatabaseStatus(data.database);
      } else {
        this.showDatabaseError(data.error);
      }
    } catch (error) {
      this.showDatabaseError('Database bağlantı hatası: ' + error.message);
    }
  }

  updateDatabaseStatus(dbData) {
    const statusEl = CommonUtils.$('#dbStatus');
    const typeEl = CommonUtils.$('#dbType');
    const connectionTimeEl = CommonUtils.$('#dbConnectionTime');
    const lastCheckEl = CommonUtils.$('#dbLastCheck');
    const tableCountEl = CommonUtils.$('#dbTableCount');
    const errorEl = CommonUtils.$('#databaseError');

    // Hide error message
    errorEl.classList.add('hidden');

    // Update status
    if (dbData.info && dbData.info.type) {
      statusEl.textContent = 'Bağlı';
      statusEl.className = 'status-value connected';
      typeEl.textContent = dbData.info.type.toUpperCase();
      
      if (dbData.info.version) {
        typeEl.textContent += ` (${dbData.info.version.split(' ')[0]})`;
      }
    } else {
      statusEl.textContent = 'Hata';
      statusEl.className = 'status-value error';
      typeEl.textContent = 'Bilinmiyor';
    }

    // Update connection time
    if (dbData.info && dbData.info.connection_time_ms) {
      connectionTimeEl.textContent = `${dbData.info.connection_time_ms}ms`;
    } else {
      connectionTimeEl.textContent = '-';
    }

    // Update last check
    lastCheckEl.textContent = new Date().toLocaleTimeString('tr-TR');

    // Update table count
    if (dbData.stats && dbData.stats.tables) {
      tableCountEl.textContent = dbData.stats.tables.length;
    } else {
      tableCountEl.textContent = '-';
    }
  }

  showDatabaseError(errorMessage) {
    const errorEl = CommonUtils.$('#databaseError');
    const statusEl = CommonUtils.$('#dbStatus');
    
    errorEl.textContent = errorMessage;
    errorEl.classList.remove('hidden');
    
    statusEl.textContent = 'Hata';
    statusEl.className = 'status-value error';
  }

  // Auto-refresh database status every 30 seconds
  startDatabaseMonitoring() {
    // Initial check
    this.checkDatabaseStatus();
    
    // Set up interval
    setInterval(() => {
      this.checkDatabaseStatus();
    }, 30000);
  }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  window.adminPanel = new AdminPanel();
});
