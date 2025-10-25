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
    this.loadTheme();
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

    // Theme toggle
    const themeToggle = $('#themeToggle');
    if (themeToggle) {
      themeToggle.onclick = () => this.toggleTheme();
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

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('admin-theme', newTheme);
    
    // Update theme icon
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
      themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }
  }

  loadTheme() {
    const savedTheme = localStorage.getItem('admin-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Update theme icon
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
      themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }
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
      console.log('[ADMIN] Loading real data...');
      
      // Admin stats yükle
      const statsResponse = await fetch('/api/admin-stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success) {
          this.updateStats(statsData.stats);
        }
      }
      
      // Aktif çağrıları yükle
      const callsResponse = await fetch('/api/admin-calls');
      if (callsResponse.ok) {
        const callsData = await callsResponse.json();
        if (callsData.success) {
          this.updateActiveCalls(callsData.calls);
        }
      }
      
      // Sistem metriklerini yükle
      const metricsResponse = await fetch('/api/metrics');
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        if (metricsData.success) {
          this.updateMetrics(metricsData.metrics);
        }
      }
      
      console.log('[ADMIN] Real data loaded successfully');
    } catch (error) {
      console.error('[ADMIN] Load real data error:', error);
    }
  }

  updateStats(stats) {
    // Aktif çağrı sayısı
    const activeElement = $('#lblActive');
    if (activeElement) {
      activeElement.textContent = stats.active_calls || 0;
    }
    
    // Kuyruk sayısı
    const queueElement = $('#lblQueue');
    if (queueElement) {
      queueElement.textContent = stats.queue_count || 0;
    }
    
    // Bugünkü çağrılar
    const todayElement = $('#todayCalls');
    if (todayElement) {
      todayElement.textContent = stats.today_calls || 0;
    }
    
    // Haftalık çağrılar
    const weekElement = $('#weekCalls');
    if (weekElement) {
      weekElement.textContent = stats.week_calls || 0;
    }
    
    // Aylık çağrılar
    const monthElement = $('#monthCalls');
    if (monthElement) {
      monthElement.textContent = stats.month_calls || 0;
    }
    
    // Yıllık çağrılar
    const yearElement = $('#yearCalls');
    if (yearElement) {
      yearElement.textContent = stats.year_calls || 0;
    }
  }

  updateMetrics(metrics) {
    // Paket kaybı
    const lossElement = $('#perfLoss');
    const lossBarElement = $('#perfLossBar');
    if (lossElement && metrics.packet_loss !== undefined) {
      const loss = Math.round(metrics.packet_loss * 100);
      lossElement.textContent = loss + '%';
      if (lossBarElement) {
        lossBarElement.style.height = Math.min(loss, 100) + '%';
        lossBarElement.style.backgroundColor = loss > 5 ? 'var(--danger)' : 'var(--success)';
      }
    }
    
    // Gecikme
    const jitterElement = $('#perfJitter');
    const jitterBarElement = $('#perfJitterBar');
    if (jitterElement && metrics.jitter !== undefined) {
      const jitter = Math.round(metrics.jitter);
      jitterElement.textContent = jitter + 'ms';
      if (jitterBarElement) {
        const height = Math.min((jitter / 100) * 100, 100);
        jitterBarElement.style.height = height + '%';
        jitterBarElement.style.backgroundColor = jitter > 50 ? 'var(--danger)' : 'var(--success)';
      }
    }
    
    // Bitrate
    const bitrateElement = $('#perfBitrate');
    const bitrateBarElement = $('#perfBitrateBar');
    if (bitrateElement && metrics.bitrate !== undefined) {
      const bitrate = Math.round(metrics.bitrate / 1000);
      bitrateElement.textContent = bitrate + 'kbps';
      if (bitrateBarElement) {
        const height = Math.min((bitrate / 1000) * 100, 100);
        bitrateBarElement.style.height = height + '%';
        bitrateBarElement.style.backgroundColor = bitrate < 500 ? 'var(--warning)' : 'var(--success)';
      }
    }
    
    // CPU kullanımı
    const cpuElement = $('#perfCpu');
    const cpuBarElement = $('#perfCpuBar');
    if (cpuElement && metrics.cpu_usage !== undefined) {
      const cpu = Math.round(metrics.cpu_usage);
      cpuElement.textContent = cpu + '%';
      if (cpuBarElement) {
        cpuBarElement.style.height = cpu + '%';
        cpuBarElement.style.backgroundColor = cpu > 80 ? 'var(--danger)' : cpu > 60 ? 'var(--warning)' : 'var(--success)';
      }
    }
  }

  updateActiveCalls(calls) {
    // Aktif çağrıları güncelle
    this.active.clear();
    calls.forEach(call => {
      this.active.set(call.call_id, {
        id: call.call_id,
        name: call.customer_name,
        status: call.status,
        timestamp: call.start_time,
        admin_connected: call.admin_connected
      });
    });
    
    // UI'yi güncelle
    this.renderActiveCalls();
    this.updateKPIs();
    
    // Otomatik kabul
    if (this.autoAccept) {
      const waitingCalls = Array.from(this.active.values()).filter(c => c.status === 'waiting');
      if (waitingCalls.length > 0) {
        this.acceptCall(waitingCalls[0].id);
      }
    }
  }

  renderActiveCalls() {
    const callsContainer = $('#activeCallsList');
    if (!callsContainer) return;
    
    callsContainer.innerHTML = '';
    
    if (this.active.size === 0) {
      callsContainer.innerHTML = '<div class="empty-state">📞 Aktif çağrı yok</div>';
      return;
    }
    
    this.active.forEach((call, callId) => {
      const callElement = document.createElement('div');
      callElement.className = 'call-item';
      callElement.innerHTML = `
        <div class="call-info">
          <div class="call-name">${call.name || 'Bilinmeyen'}</div>
          <div class="call-status ${call.status}">${this.getStatusText(call.status)}</div>
          <div class="call-time">${this.formatTime(call.timestamp)}</div>
        </div>
        <div class="call-actions">
          ${call.status === 'waiting' ? 
            `<button class="btn btn--primary" onclick="window.adminPanel.acceptCall('${callId}')">📞 Kabul Et</button>` :
            call.status === 'active' ?
            `<button class="btn btn--danger" onclick="window.adminPanel.endCall('${callId}')">📞 Bitir</button>` :
            ''
          }
        </div>
      `;
      callsContainer.appendChild(callElement);
    });
  }

  getStatusText(status) {
    const statusMap = {
      'waiting': 'Bekliyor',
      'active': 'Aktif',
      'ended': 'Bitti',
      'cancelled': 'İptal'
    };
    return statusMap[status] || status;
  }

  formatTime(timeString) {
    if (!timeString) return '-';
    try {
      const time = new Date(timeString);
      return time.toLocaleTimeString('tr-TR');
    } catch {
      return timeString;
    }
  }

  updateKPIs() {
    // KPI'ları güncelle
    const activeCount = Array.from(this.active.values()).filter(call => call.status === 'active').length;
    const waitingCount = Array.from(this.active.values()).filter(call => call.status === 'waiting').length;
    
    const activeElement = $('#lblActive');
    if (activeElement) {
      activeElement.textContent = activeCount;
    }
    
    const queueElement = $('#lblQueue');
    if (queueElement) {
      queueElement.textContent = waitingCount;
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
        if (!this.webrtc || !this.webrtc.pc) {
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
        this.showNotification('Geçmiş temizlendi', 'success');
        this.loadRealData();
        this.ui.updateHistory();
        this.ui.updateKPIs();
      }
    } catch (err) {
      console.error('Clear history error:', err);
    }
  }

  // UI Manager referansı
  get ui() {
    return this._ui;
  }
  set ui(value) {
    this._ui = value;
  }

  // WebRTC Manager referansı
  get webrtc() {
    return this._webrtc;
  }
  set webrtc(value) {
    this._webrtc = value;
  }

  async initWebRTC() {
    try {
      this.webrtc = new WebRTCManager();
      await this.webrtc.initConnection(this.currentCallId);
      return true;
    } catch (err) {
      console.error('Init WebRTC error:', err);
      this.showPermissionWarning();
      return false;
    }
  }

  showCallUI() {
    if (this.ui && typeof this.ui.showCallScreen === 'function') {
      this.ui.showCallScreen(this.currentCallId);
    } else {
      const otp = $('#otpScreen');
      const dash = $('#dashboardScreen');
      const full = $('#fullCallScreen');
      if (otp) otp.classList.add('hidden');
      if (dash) dash.classList.add('hidden');
      if (full) full.classList.remove('hidden');
    }
  }

  async waitForOffer(callId) {
    // WebRTCManager kendi içinde sinyal beklemeyi başlatıyor
    return Promise.resolve();
  }

  toggleMic() {
    if (this.webrtc) {
      return this.webrtc.toggleMic();
    }
    return false;
  }

  toggleVideo() {
    if (this.webrtc) {
      return this.webrtc.toggleVideo();
    }
    return false;
  }

  toggleSpeaker() {
    if (this.webrtc) {
      return this.webrtc.toggleSpeaker();
    }
    return false;
  }

  endCall() {
    if (this.webrtc) {
      this.closeCall(this.webrtc.currentCallId);
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
  
  // Show permission warning (matched with Index design)
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
