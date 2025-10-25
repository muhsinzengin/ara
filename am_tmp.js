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
    const micVolume = document.getElementById("micVolume");
    if (micVolume) {
      micVolume.oninput = (e) => {
        const val = e.target.value;
        const micVal = document.getElementById("micVolumeVal");
        if (micVal) micVal.textContent = val + "%";
        this.updateAudioConstraints();
      };
    }

    const speakerVolume = document.getElementById("speakerVolume");
    if (speakerVolume) {
      speakerVolume.oninput = (e) => {
        const val = e.target.value;
        const spVal = document.getElementById("speakerVolumeVal");
        if (spVal) spVal.textContent = val + "%";
        this.updateSpeakerVolume();
      };
    }

    ["toggleNoiseSuppression", "toggleEchoCancellation", "toggleAutoGain"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.onclick = () => {
          el.classList.toggle("on");
          el.textContent = el.classList.contains('on') ? 'Açık' : 'Kapalı';
          this.updateAudioConstraints();
        };
        // initialize label
        el.textContent = el.classList.contains('on') ? 'Açık' : 'Kapalı';
      }
    });

    const micDevice = document.getElementById("micDevice");
    if (micDevice) micDevice.onchange = () => this.changeAudioDevice("audioinput");
    const speakerDevice = document.getElementById("speakerDevice");
    if (speakerDevice) speakerDevice.onchange = () => this.changeAudioDevice("audiooutput");
  }
  bindCodecSettings() {
    const codecAuto = document.getElementById("codecAuto");
    if (codecAuto) codecAuto.onclick = () => this.setCodecMode("auto");
    const codecManual = document.getElementById("codecManual");
    if (codecManual) codecManual.onclick = () => this.setCodecMode("manual");

    const codecBitrate = document.getElementById("codecBitrate");
    if (codecBitrate) {
      codecBitrate.oninput = (e) => {
        const val = e.target.value;
        const bitrateVal = document.getElementById("codecBitrateVal");
        if (bitrateVal) bitrateVal.textContent = val + "kb/s";
        this.updateCodecSettings();
      };
    }

    ["toggleDTX", "toggleFEC", "toggleSimulcast", "toggleHWAccel"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.onclick = () => {
          el.classList.toggle("on");
          el.textContent = el.classList.contains('on') ? 'Açık' : 'Kapalı';
          this.updateCodecSettings();
        };
        el.textContent = el.classList.contains('on') ? 'Açık' : 'Kapalı';
      }
    });

    const qualityProfile = document.getElementById('qualityProfile');
    if (qualityProfile) {
      qualityProfile.onchange = () => {
        // Re-apply constraints/SDP on profile change
        this.updateCodecSettings();
      };
    }
  }



