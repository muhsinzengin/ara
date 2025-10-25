// Admin Main Controller - CSRF Protected
const $ = (id) => document.getElementById(id.startsWith('#') ? id.substring(1) : id);

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
  }

  bindEvents() {
    $('#requestOtpBtn')?.addEventListener('click', () => this.requestOTP());
    $('#verifyOtpBtn')?.addEventListener('click', () => this.verifyOTP());
    $('#otpInput')?.addEventListener('keypress', (e) => e.key === 'Enter' && this.verifyOTP());
  }

  async requestOTP() {
    try {
      const res = await fetch('/api/request-admin-otp', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        $('#otpInputSection').classList.remove('hidden');
        $('#otpInput').dataset.callId = data.callId;
        $('#otpInput').focus();
      }
    } catch (err) {
      console.error('OTP request error:', err);
    }
  }

  async verifyOTP() {
    const otp = $('#otpInput').value.trim();
    const callId = $('#otpInput').dataset.callId;

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
    const errorEl = $('#otpError');
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
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  window.adminPanel = new AdminPanel();
});
