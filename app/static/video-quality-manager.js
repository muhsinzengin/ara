// Adaptive Video Quality System
class VideoQualityManager {
  constructor() {
    this.qualityLevels = {
      ultra: { 
        width: 1920, 
        height: 1080, 
        frameRate: 60, 
        bitrate: 4000000,
        label: 'Ultra HD'
      },
      high: { 
        width: 1920, 
        height: 1080, 
        frameRate: 30, 
        bitrate: 2500000,
        label: 'Full HD'
      },
      medium: { 
        width: 1280, 
        height: 720, 
        frameRate: 30, 
        bitrate: 1000000,
        label: 'HD'
      },
      low: { 
        width: 854, 
        height: 480, 
        frameRate: 24, 
        bitrate: 500000,
        label: 'SD'
      },
      mobile: { 
        width: 640, 
        height: 360, 
        frameRate: 20, 
        bitrate: 250000,
        label: 'Mobile'
      }
    };
    
    this.currentQuality = 'medium';
    this.networkMonitor = new NetworkMonitor();
    this.deviceOptimizer = new DeviceOptimizer();
    this.qualityHistory = [];
    this.adaptationEnabled = true;
    this.manualOverride = false;
  }

  async initialize() {
    await this.networkMonitor.initialize();
    await this.deviceOptimizer.initialize();
    this.createQualityIndicator();
    this.startAdaptationLoop();
  }

  createQualityIndicator() {
    const container = document.createElement('div');
    container.id = 'video-quality-indicator';
    container.className = 'video-quality-indicator';
    container.innerHTML = `
      <div class="quality-header">
        <span class="quality-label">Video Kalitesi</span>
        <button id="quality-toggle" class="quality-toggle">Otomatik</button>
      </div>
      <div class="quality-level">
        <span id="current-quality">${this.qualityLevels[this.currentQuality].label}</span>
      </div>
      <div class="quality-stats">
        <div class="stat-item">
          <span class="stat-label">Çözünürlük:</span>
          <span id="resolution">${this.qualityLevels[this.currentQuality].width}x${this.qualityLevels[this.currentQuality].height}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">FPS:</span>
          <span id="fps">${this.qualityLevels[this.currentQuality].frameRate}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Bitrate:</span>
          <span id="bitrate">${Math.round(this.qualityLevels[this.currentQuality].bitrate / 1000)}k</span>
        </div>
      </div>
      <div class="quality-controls">
        <button class="quality-btn" data-quality="mobile">Mobile</button>
        <button class="quality-btn" data-quality="low">SD</button>
        <button class="quality-btn" data-quality="medium">HD</button>
        <button class="quality-btn" data-quality="high">Full HD</button>
        <button class="quality-btn" data-quality="ultra">Ultra HD</button>
      </div>
    `;

    document.body.appendChild(container);
    this.bindQualityControls();
  }

  bindQualityControls() {
    const toggleBtn = document.getElementById('quality-toggle');
    const qualityBtns = document.querySelectorAll('.quality-btn');

    toggleBtn.addEventListener('click', () => {
      this.adaptationEnabled = !this.adaptationEnabled;
      this.manualOverride = !this.adaptationEnabled;
      toggleBtn.textContent = this.adaptationEnabled ? 'Otomatik' : 'Manuel';
      toggleBtn.classList.toggle('manual', !this.adaptationEnabled);
    });

    qualityBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const quality = btn.dataset.quality;
        this.setQuality(quality, true);
        this.updateQualityButtons();
      });
    });
  }

  async startAdaptationLoop() {
    const adapt = async () => {
      if (this.adaptationEnabled && !this.manualOverride) {
        await this.adaptQuality();
      }
      setTimeout(adapt, 5000); // Check every 5 seconds
    };
    adapt();
  }

  async adaptQuality() {
    const networkStats = await this.networkMonitor.getDetailedStats();
    const deviceCapabilities = this.deviceOptimizer.getCapabilities();
    const cpuUsage = await this.getCPUUsage();

    let targetQuality = this.currentQuality;

    // Network-based adaptation
    if (networkStats.bandwidth > 5000000 && cpuUsage < 50 && deviceCapabilities.supportsUltra) {
      targetQuality = 'ultra';
    } else if (networkStats.bandwidth > 2000000 && cpuUsage < 70 && deviceCapabilities.supportsHigh) {
      targetQuality = 'high';
    } else if (networkStats.bandwidth > 1000000 && cpuUsage < 80) {
      targetQuality = 'medium';
    } else if (networkStats.bandwidth > 500000) {
      targetQuality = 'low';
    } else {
      targetQuality = 'mobile';
    }

    // Packet loss consideration
    if (networkStats.packetLoss > 5) {
      targetQuality = this.downgradeQuality(targetQuality);
    }

    // Latency consideration
    if (networkStats.latency > 200) {
      targetQuality = this.downgradeQuality(targetQuality);
    }

    if (targetQuality !== this.currentQuality) {
      this.setQuality(targetQuality);
      this.logQualityChange(targetQuality, networkStats);
    }
  }

  downgradeQuality(currentQuality) {
    const qualityOrder = ['mobile', 'low', 'medium', 'high', 'ultra'];
    const currentIndex = qualityOrder.indexOf(currentQuality);
    return qualityOrder[Math.max(0, currentIndex - 1)];
  }

  upgradeQuality(currentQuality) {
    const qualityOrder = ['mobile', 'low', 'medium', 'high', 'ultra'];
    const currentIndex = qualityOrder.indexOf(currentQuality);
    return qualityOrder[Math.min(qualityOrder.length - 1, currentIndex + 1)];
  }

  async setQuality(quality, manual = false) {
    if (!this.qualityLevels[quality]) return;

    this.currentQuality = quality;
    this.manualOverride = manual;

    // Update UI
    this.updateQualityDisplay();
    this.updateQualityButtons();

    // Apply to WebRTC
    await this.applyQualityToWebRTC();

    // Store in history
    this.qualityHistory.push({
      quality,
      timestamp: Date.now(),
      manual,
      networkStats: await this.networkMonitor.getDetailedStats()
    });

    // Keep only last 50 entries
    if (this.qualityHistory.length > 50) {
      this.qualityHistory.shift();
    }
  }

  updateQualityDisplay() {
    const quality = this.qualityLevels[this.currentQuality];
    
    document.getElementById('current-quality').textContent = quality.label;
    document.getElementById('resolution').textContent = `${quality.width}x${quality.height}`;
    document.getElementById('fps').textContent = quality.frameRate;
    document.getElementById('bitrate').textContent = `${Math.round(quality.bitrate / 1000)}k`;
  }

  updateQualityButtons() {
    const qualityBtns = document.querySelectorAll('.quality-btn');
    qualityBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.quality === this.currentQuality);
    });
  }

  async applyQualityToWebRTC() {
    // This will be called by WebRTC manager
    if (window.webrtcManager && window.webrtcManager.pc) {
      const quality = this.qualityLevels[this.currentQuality];
      
      // Update video track constraints
      const videoTrack = window.webrtcManager.localStream?.getVideoTracks()[0];
      if (videoTrack) {
        await videoTrack.applyConstraints({
          width: { ideal: quality.width },
          height: { ideal: quality.height },
          frameRate: { ideal: quality.frameRate }
        });
      }

      // Update bitrate
      const sender = window.webrtcManager.pc.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );
      
      if (sender) {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = quality.bitrate;
        params.encodings[0].maxFramerate = quality.frameRate;
        
        try {
          await sender.setParameters(params);
          console.log(`[VideoQuality] Applied ${quality.label} quality`);
        } catch (error) {
          console.error('[VideoQuality] Failed to set parameters:', error);
        }
      }
    }
  }

  async getCPUUsage() {
    // Simple CPU usage estimation based on performance
    const start = performance.now();
    await new Promise(resolve => setTimeout(resolve, 10));
    const end = performance.now();
    
    // Rough estimation - in real implementation, use Performance Observer
    return Math.min(100, (end - start) * 10);
  }

  logQualityChange(quality, networkStats) {
    console.log(`[VideoQuality] Changed to ${quality}:`, {
      bandwidth: Math.round(networkStats.bandwidth / 1000) + 'kbps',
      latency: networkStats.latency + 'ms',
      packetLoss: networkStats.packetLoss + '%'
    });
  }

  getQualityHistory() {
    return this.qualityHistory;
  }

  getCurrentQuality() {
    return this.currentQuality;
  }

  destroy() {
    const indicator = document.getElementById('video-quality-indicator');
    if (indicator) {
      indicator.remove();
    }
    this.networkMonitor.destroy();
    this.deviceOptimizer.destroy();
  }
}

// Device Optimizer
class DeviceOptimizer {
  constructor() {
    this.deviceInfo = this.detectDevice();
    this.capabilities = this.detectCapabilities();
  }

  async initialize() {
    // Additional initialization if needed
  }

  detectDevice() {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    
    if (/iPhone|iPad/.test(ua)) {
      return { 
        type: 'ios', 
        version: this.getIOSVersion(ua),
        model: this.getIOSModel(ua)
      };
    } else if (/Android/.test(ua)) {
      return { 
        type: 'android', 
        version: this.getAndroidVersion(ua)
      };
    } else if (/Windows/.test(platform)) {
      return { type: 'windows' };
    } else if (/Mac/.test(platform)) {
      return { type: 'macos' };
    } else if (/Linux/.test(platform)) {
      return { type: 'linux' };
    }
    
    return { type: 'unknown' };
  }

  detectCapabilities() {
    const capabilities = {
      supportsUltra: false,
      supportsHigh: false,
      supportsHardwareAcceleration: false,
      supportsHDR: false,
      maxResolution: { width: 1280, height: 720 },
      recommendedQuality: 'medium'
    };

    // Check WebGL for hardware acceleration
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    capabilities.supportsHardwareAcceleration = !!gl;

    // Device-specific capabilities
    if (this.deviceInfo.type === 'ios') {
      capabilities.supportsHigh = true;
      capabilities.maxResolution = { width: 1920, height: 1080 };
      capabilities.recommendedQuality = 'high';
      
      // Check for newer iOS devices
      if (this.deviceInfo.version >= 14) {
        capabilities.supportsUltra = true;
        capabilities.supportsHDR = true;
      }
    } else if (this.deviceInfo.type === 'android') {
      capabilities.supportsHigh = this.deviceInfo.version >= 8;
      capabilities.maxResolution = capabilities.supportsHigh ? 
        { width: 1920, height: 1080 } : { width: 1280, height: 720 };
      capabilities.recommendedQuality = capabilities.supportsHigh ? 'high' : 'medium';
    } else {
      // Desktop
      capabilities.supportsUltra = true;
      capabilities.supportsHigh = true;
      capabilities.maxResolution = { width: 3840, height: 2160 };
      capabilities.recommendedQuality = 'high';
    }

    return capabilities;
  }

  getIOSVersion(ua) {
    const match = ua.match(/OS (\d+)_/);
    return match ? parseInt(match[1]) : 0;
  }

  getIOSModel(ua) {
    if (/iPhone/.test(ua)) {
      if (/iPhone 1[2-5]/.test(ua)) return 'iPhone 12+';
      if (/iPhone 1[0-1]/.test(ua)) return 'iPhone X/11';
      return 'iPhone';
    }
    return 'iPad';
  }

  getAndroidVersion(ua) {
    const match = ua.match(/Android (\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  getCapabilities() {
    return this.capabilities;
  }

  destroy() {
    // Cleanup if needed
  }
}

// Make globally available
window.VideoQualityManager = VideoQualityManager;
window.DeviceOptimizer = DeviceOptimizer;
