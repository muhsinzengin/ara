// WebRTC Diagnostics & Quality Monitor
class WebRTCDiagnostics {
  constructor() {
    this.metrics = {
      rtt: 0,
      jitter: 0,
      packetLoss: 0,
      bitrate: { in: 0, out: 0 },
      quality: 0,
      mos: 0
    };
    this.prevStats = null;
    this.testResults = [];
    this.startTime = null;
  }

  // 1) Kurulum & İzinler
  async testPermissions() {
    const result = { step: 'permissions', pass: false, details: {} };
    const start = Date.now();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      result.details.granted = true;
      result.details.deviceId = stream.getAudioTracks()[0].getSettings().deviceId;
      result.details.duration = Date.now() - start;
      result.pass = true;
      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      result.details.error = err.message;
      result.details.granted = false;
    }
    
    this.testResults.push(result);
    return result;
  }

  // 2) ICE Gathering
  async testICEGathering() {
    const result = { step: 'ice_gathering', pass: false, details: {} };
    const start = Date.now();
    
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    return new Promise((resolve) => {
      const candidates = [];
      
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          candidates.push({
            type: e.candidate.type,
            protocol: e.candidate.protocol,
            address: e.candidate.address
          });
        } else {
          // Gathering complete
          result.details.duration = Date.now() - start;
          result.details.candidates = candidates;
          result.details.count = candidates.length;
          result.pass = result.details.duration < 5000;
          result.details.rating = result.details.duration < 2000 ? 'excellent' : 'acceptable';
          
          pc.close();
          this.testResults.push(result);
          resolve(result);
        }
      };

      pc.createDataChannel('test');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      // Timeout after 10s
      setTimeout(() => {
        if (candidates.length === 0) {
          result.details.error = 'ICE gathering timeout';
          pc.close();
          this.testResults.push(result);
          resolve(result);
        }
      }, 10000);
    });
  }

  // 3) Cihaz & Rota
  async testDevices() {
    const result = { step: 'devices', pass: false, details: {} };
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
      
      result.details.audioOutputCount = audioOutputs.length;
      result.details.devices = audioOutputs.map(d => ({
        id: d.deviceId,
        label: d.label || 'Unknown'
      }));
      
      // Test setSinkId support
      const audio = new Audio();
      result.details.setSinkIdSupported = typeof audio.setSinkId === 'function';
      
      result.pass = audioOutputs.length > 0;
      this.testResults.push(result);
    } catch (err) {
      result.details.error = err.message;
      this.testResults.push(result);
    }
    
    return result;
  }

  // 4) Ağ Kalitesi (Real-time)
  async measureQuality(pc) {
    if (!pc || pc.connectionState !== 'connected') return null;

    try {
      const stats = await pc.getStats();
      const metrics = {
        rtt: 0,
        jitter: 0,
        packetLoss: 0,
        bitrate: { in: 0, out: 0 },
        timestamp: Date.now()
      };

      stats.forEach(report => {
        // Inbound audio
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          const packetsReceived = report.packetsReceived || 0;
          const packetsLost = report.packetsLost || 0;
          
          if (packetsReceived > 0) {
            metrics.packetLoss = (packetsLost / (packetsReceived + packetsLost) * 100).toFixed(2);
          }
          
          if (report.jitter) {
            metrics.jitter = Math.round(report.jitter * 1000);
          }

          // Bitrate calculation
          if (this.prevStats && report.bytesReceived) {
            const prevReport = this.prevStats.get(report.id);
            if (prevReport) {
              const bytesDiff = report.bytesReceived - prevReport.bytesReceived;
              const timeDiff = (report.timestamp - prevReport.timestamp) / 1000;
              if (timeDiff > 0) {
                metrics.bitrate.in = Math.round((bytesDiff * 8) / timeDiff / 1000);
              }
            }
          }
        }

        // Outbound audio
        if (report.type === 'outbound-rtp' && report.kind === 'audio') {
          if (this.prevStats && report.bytesSent) {
            const prevReport = this.prevStats.get(report.id);
            if (prevReport) {
              const bytesDiff = report.bytesSent - prevReport.bytesSent;
              const timeDiff = (report.timestamp - prevReport.timestamp) / 1000;
              if (timeDiff > 0) {
                metrics.bitrate.out = Math.round((bytesDiff * 8) / timeDiff / 1000);
              }
            }
          }
        }

        // RTT from candidate pair
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (report.currentRoundTripTime) {
            metrics.rtt = Math.round(report.currentRoundTripTime * 1000);
          }
        }
      });

      this.prevStats = stats;
      this.metrics = metrics;
      
      // Calculate MOS (Mean Opinion Score)
      metrics.mos = this.calculateMOS(metrics);
      metrics.quality = this.getQualityRating(metrics);
      
      return metrics;
    } catch (err) {
      console.error('Quality measurement error:', err);
      return null;
    }
  }

  // MOS Calculation (E-Model approximation)
  calculateMOS(metrics) {
    // R-factor calculation
    let R = 93.2; // Base R-factor
    
    // RTT penalty
    if (metrics.rtt > 0) {
      const delay = metrics.rtt / 2; // One-way delay
      if (delay < 160) {
        R -= 0;
      } else {
        R -= (delay - 160) * 0.024;
      }
    }
    
    // Packet loss penalty
    if (metrics.packetLoss > 0) {
      R -= metrics.packetLoss * 2.5;
    }
    
    // Jitter penalty
    if (metrics.jitter > 0) {
      R -= metrics.jitter * 0.1;
    }
    
    // Convert R to MOS
    let mos;
    if (R < 0) {
      mos = 1;
    } else if (R > 100) {
      mos = 4.5;
    } else {
      mos = 1 + 0.035 * R + 0.000007 * R * (R - 60) * (100 - R);
    }
    
    return Math.max(1, Math.min(4.5, mos)).toFixed(2);
  }

  // Quality Rating
  getQualityRating(metrics) {
    const { rtt, jitter, packetLoss } = metrics;
    
    let score = 100;
    
    // RTT scoring
    if (rtt > 200) score -= 30;
    else if (rtt > 100) score -= 15;
    
    // Jitter scoring
    if (jitter > 30) score -= 25;
    else if (jitter > 15) score -= 10;
    
    // Packet loss scoring
    if (packetLoss > 3) score -= 35;
    else if (packetLoss > 1) score -= 15;
    
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  }

  // 5) Codec/Bitrate Test
  async testCodec(pc, targetBitrate) {
    const result = { step: 'codec', pass: false, details: {} };
    
    try {
      const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
      if (!sender) {
        result.details.error = 'No audio sender found';
        return result;
      }

      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];
      params.encodings[0].maxBitrate = targetBitrate * 1000;
      
      await sender.setParameters(params);
      
      // Wait 3 seconds and measure
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const stats = await pc.getStats();
      let measuredBitrate = 0;
      
      stats.forEach(report => {
        if (report.type === 'outbound-rtp' && report.kind === 'audio') {
          if (this.prevStats) {
            const prevReport = this.prevStats.get(report.id);
            if (prevReport) {
              const bytesDiff = report.bytesSent - prevReport.bytesSent;
              const timeDiff = (report.timestamp - prevReport.timestamp) / 1000;
              measuredBitrate = Math.round((bytesDiff * 8) / timeDiff / 1000);
            }
          }
        }
      });
      
      result.details.target = targetBitrate;
      result.details.measured = measuredBitrate;
      result.details.diff = Math.abs(targetBitrate - measuredBitrate);
      result.pass = result.details.diff < targetBitrate * 0.2; // 20% tolerance
      
      this.testResults.push(result);
    } catch (err) {
      result.details.error = err.message;
      this.testResults.push(result);
    }
    
    return result;
  }

  // Generate Report
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      browser: navigator.userAgent,
      platform: navigator.platform,
      tests: this.testResults,
      currentMetrics: this.metrics,
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(t => t.pass).length,
        failed: this.testResults.filter(t => !t.pass).length
      }
    };
    
    return report;
  }

  // Download Report
  downloadReport() {
    const report = this.generateReport();
    
    // JSON
    const jsonBlob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `webrtc-diagnostics-${Date.now()}.json`;
    jsonLink.click();
    
    // TXT (Human readable)
    const txt = this.formatReportText(report);
    const txtBlob = new Blob([txt], { type: 'text/plain' });
    const txtUrl = URL.createObjectURL(txtBlob);
    const txtLink = document.createElement('a');
    txtLink.href = txtUrl;
    txtLink.download = `webrtc-diagnostics-${Date.now()}.txt`;
    txtLink.click();
  }

  formatReportText(report) {
    let txt = '='.repeat(60) + '\n';
    txt += 'WebRTC Diagnostics Report\n';
    txt += '='.repeat(60) + '\n\n';
    txt += `Timestamp: ${report.timestamp}\n`;
    txt += `Browser: ${report.browser}\n`;
    txt += `Platform: ${report.platform}\n\n`;
    
    txt += 'Test Results:\n';
    txt += '-'.repeat(60) + '\n';
    report.tests.forEach((test, idx) => {
      txt += `${idx + 1}. ${test.step.toUpperCase()}: ${test.pass ? 'PASS ✓' : 'FAIL ✗'}\n`;
      txt += `   Details: ${JSON.stringify(test.details, null, 2)}\n\n`;
    });
    
    txt += '\nCurrent Metrics:\n';
    txt += '-'.repeat(60) + '\n';
    txt += `RTT: ${report.currentMetrics.rtt} ms\n`;
    txt += `Jitter: ${report.currentMetrics.jitter} ms\n`;
    txt += `Packet Loss: ${report.currentMetrics.packetLoss}%\n`;
    txt += `Bitrate In: ${report.currentMetrics.bitrate.in} kbps\n`;
    txt += `Bitrate Out: ${report.currentMetrics.bitrate.out} kbps\n`;
    txt += `MOS: ${report.currentMetrics.mos}\n`;
    txt += `Quality: ${report.currentMetrics.quality}\n\n`;
    
    txt += 'Summary:\n';
    txt += '-'.repeat(60) + '\n';
    txt += `Total Tests: ${report.summary.total}\n`;
    txt += `Passed: ${report.summary.passed}\n`;
    txt += `Failed: ${report.summary.failed}\n`;
    
    return txt;
  }
}

// Export
window.WebRTCDiagnostics = WebRTCDiagnostics;
