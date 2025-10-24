// Admin Pro - Real-time monitoring & controls
class AdminPro {
  constructor() {
    this.pc = null;
    this.prevStats = null;
    this.perfInterval = null;
    this.audioSettings = {
      micLevel: 75,
      spkLevel: 80,
      route: 'speaker',
      micMuted: false,
      remoteMuted: false
    };
    this.codecSettings = {
      mode: 'auto',
      bitrate: 24,
      dtx: true
    };
  }

  // Start monitoring
  startMonitoring(peerConnection) {
    this.pc = peerConnection;
    if (this.perfInterval) clearInterval(this.perfInterval);
    
    this.perfInterval = setInterval(async () => {
      if (!this.pc || this.pc.connectionState !== 'connected') {
        this.stopMonitoring();
        return;
      }
      await this.updateMetrics();
    }, 2000);
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.perfInterval) {
      clearInterval(this.perfInterval);
      this.perfInterval = null;
    }
    this.resetMetrics();
  }

  // Update metrics
  async updateMetrics() {
    try {
      const stats = await this.pc.getStats();
      const metrics = {
        quality: 0,
        latency: 0,
        bandwidth: 0,
        packetLoss: 0
      };

      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          const pktsRx = report.packetsReceived || 0;
          const pktsLost = report.packetsLost || 0;
          
          if (pktsRx > 0) {
            const lossRate = pktsLost / (pktsRx + pktsLost);
            metrics.packetLoss = (lossRate * 100).toFixed(1);
            metrics.quality = Math.max(0, Math.min(100, (1 - lossRate) * 100)).toFixed(0);
          }

          if (report.jitter) {
            metrics.latency = Math.round(report.jitter * 1000);
          }

          if (this.prevStats && report.bytesReceived) {
            const prev = this.prevStats.get(report.id);
            if (prev) {
              const bytes = report.bytesReceived - prev.bytesReceived;
              const time = (report.timestamp - prev.timestamp) / 1000;
              if (time > 0) {
                metrics.bandwidth = Math.round((bytes * 8) / time / 1000);
              }
            }
          }
        }

        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (report.currentRoundTripTime) {
            metrics.latency = Math.round(report.currentRoundTripTime * 1000);
          }
        }
      });

      this.prevStats = stats;
      this.displayMetrics(metrics);
    } catch (err) {
      console.error('Metrics error:', err);
    }
  }

  // Display metrics
  displayMetrics(m) {
    const $ = (s) => document.getElementById(s);
    
    // Top bar
    if ($('topQuality')) $('topQuality').textContent = m.quality + '%';
    if ($('topLatency')) $('topLatency').textContent = m.latency + 'ms';
    if ($('topBandwidth')) $('topBandwidth').textContent = m.bandwidth + 'k';
    
    // Performance cards
    if ($('audioQuality')) $('audioQuality').textContent = m.quality + '%';
    if ($('qualityBar')) $('qualityBar').style.width = m.quality + '%';
    
    if ($('latency')) $('latency').textContent = m.latency + 'ms';
    if ($('latencyBar')) {
      const pct = Math.max(0, 100 - (m.latency / 2));
      $('latencyBar').style.width = pct + '%';
    }
    
    if ($('bandwidth')) $('bandwidth').textContent = m.bandwidth + ' kbps';
    if ($('bandwidthBar')) {
      const pct = Math.min(100, (m.bandwidth / 512) * 100);
      $('bandwidthBar').style.width = pct + '%';
    }
    
    if ($('packetLoss')) $('packetLoss').textContent = m.packetLoss + '%';
    if ($('lossBar')) {
      const pct = Math.max(0, 100 - (m.packetLoss * 10));
      $('lossBar').style.width = pct + '%';
    }

    // Status
    if ($('perfStatus')) {
      if (m.quality >= 90 && m.latency < 100 && m.packetLoss < 1) {
        $('perfStatus').textContent = 'Mükemmel';
        $('perfStatus').style.color = 'var(--success)';
      } else if (m.quality >= 70 && m.latency < 200 && m.packetLoss < 3) {
        $('perfStatus').textContent = 'İyi';
        $('perfStatus').style.color = '#3b82f6';
      } else {
        $('perfStatus').textContent = 'Zayıf';
        $('perfStatus').style.color = 'var(--danger)';
      }
    }
  }

  // Reset metrics
  resetMetrics() {
    const $ = (s) => document.getElementById(s);
    const ids = ['topQuality', 'topLatency', 'topBandwidth', 'audioQuality', 'latency', 'bandwidth', 'packetLoss'];
    ids.forEach(id => {
      if ($(id)) $(id).textContent = '--';
    });
    
    const bars = ['qualityBar', 'latencyBar', 'bandwidthBar', 'lossBar'];
    bars.forEach(id => {
      if ($(id)) $(id).style.width = '0%';
    });

    if ($('perfStatus')) {
      $('perfStatus').textContent = 'Anlık';
      $('perfStatus').style.color = 'var(--muted)';
    }
  }

  // Apply audio settings
  async applyAudioSettings() {
    if (!this.pc) return;

    const sender = this.pc.getSenders().find(s => s.track?.kind === 'audio');
    if (!sender?.track) return;

    try {
      await sender.track.applyConstraints({
        echoCancellation: document.getElementById('echoChk')?.checked ?? true,
        noiseSuppression: document.getElementById('noiseChk')?.checked ?? true,
        autoGainControl: document.getElementById('agcChk')?.checked ?? true
      });
    } catch (err) {
      console.error('Audio settings error:', err);
    }
  }

  // Apply codec settings
  async applyCodecSettings() {
    if (!this.pc || this.codecSettings.mode === 'auto') return;

    const sender = this.pc.getSenders().find(s => s.track?.kind === 'audio');
    if (!sender) return;

    try {
      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];
      params.encodings[0].maxBitrate = this.codecSettings.bitrate * 1000;
      await sender.setParameters(params);
    } catch (err) {
      console.error('Codec settings error:', err);
    }
  }
}

window.AdminPro = AdminPro;
