// Real-time Network Monitoring System
class NetworkMonitor {
  constructor() {
    this.stats = {
      bandwidth: 0,
      latency: 0,
      packetLoss: 0,
      jitter: 0,
      connectionType: 'unknown',
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0
    };
    
    this.history = [];
    this.maxHistorySize = 100;
    this.isMonitoring = false;
    this.pc = null;
    this.lastStatsTime = 0;
    this.bandwidthHistory = [];
    this.latencyHistory = [];
  }

  async initialize() {
    // Initialize connection API if available
    if ('connection' in navigator) {
      this.connection = navigator.connection;
      this.updateConnectionInfo();
      
      this.connection.addEventListener('change', () => {
        this.updateConnectionInfo();
      });
    }
    
    console.log('[NetworkMonitor] Initialized');
  }

  updateConnectionInfo() {
    if (this.connection) {
      this.stats.connectionType = this.connection.type || 'unknown';
      this.stats.effectiveType = this.connection.effectiveType || 'unknown';
      this.stats.downlink = this.connection.downlink || 0;
      this.stats.rtt = this.connection.rtt || 0;
    }
  }

  async startMonitoring(peerConnection) {
    this.pc = peerConnection;
    this.isMonitoring = true;
    this.monitorLoop();
  }

  async monitorLoop() {
    if (!this.isMonitoring || !this.pc) return;

    try {
      const stats = await this.pc.getStats();
      await this.processStats(stats);
      this.updateHistory();
    } catch (error) {
      console.error('[NetworkMonitor] Error getting stats:', error);
    }

    // Monitor every 2 seconds
    setTimeout(() => this.monitorLoop(), 2000);
  }

  async processStats(stats) {
    let inboundStats = null;
    let outboundStats = null;
    let candidatePairStats = null;

    stats.forEach(report => {
      if (report.type === 'inbound-rtp') {
        inboundStats = report;
      } else if (report.type === 'outbound-rtp') {
        outboundStats = report;
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        candidatePairStats = report;
      }
    });

    if (inboundStats) {
      this.stats.packetLoss = inboundStats.packetsLost || 0;
      this.stats.jitter = inboundStats.jitter || 0;
    }

    if (candidatePairStats) {
      this.stats.latency = candidatePairStats.currentRoundTripTime * 1000 || 0;
    }

    // Calculate bandwidth
    await this.calculateBandwidth(inboundStats, outboundStats);
  }

  async calculateBandwidth(inboundStats, outboundStats) {
    const now = Date.now();
    
    if (this.lastStatsTime > 0) {
      const timeDiff = (now - this.lastStatsTime) / 1000;
      
      if (inboundStats && outboundStats) {
        const bytesReceived = inboundStats.bytesReceived || 0;
        const bytesSent = outboundStats.bytesSent || 0;
        
        if (this.lastBytesReceived !== undefined && this.lastBytesSent !== undefined) {
          const receivedDiff = bytesReceived - this.lastBytesReceived;
          const sentDiff = bytesSent - this.lastBytesSent;
          const totalDiff = receivedDiff + sentDiff;
          
          const bandwidth = (totalDiff * 8) / timeDiff; // Convert to bits per second
          this.stats.bandwidth = bandwidth;
          
          this.bandwidthHistory.push({
            timestamp: now,
            bandwidth: bandwidth
          });
          
          // Keep only last 50 measurements
          if (this.bandwidthHistory.length > 50) {
            this.bandwidthHistory.shift();
          }
        }
        
        this.lastBytesReceived = bytesReceived;
        this.lastBytesSent = bytesSent;
      }
    }
    
    this.lastStatsTime = now;
  }

  updateHistory() {
    this.history.push({
      timestamp: Date.now(),
      ...this.stats
    });

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  async getDetailedStats() {
    // Perform additional network tests if needed
    const pingLatency = await this.measurePingLatency();
    
    return {
      ...this.stats,
      pingLatency,
      averageBandwidth: this.getAverageBandwidth(),
      averageLatency: this.getAverageLatency(),
      networkStability: this.calculateNetworkStability()
    };
  }

  async measurePingLatency() {
    const start = performance.now();
    
    try {
      // Simple ping measurement using fetch
      const response = await fetch('/api/healthz', {
        method: 'GET',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const end = performance.now();
        return end - start;
      }
    } catch (error) {
      console.warn('[NetworkMonitor] Ping measurement failed:', error);
    }
    
    return 0;
  }

  getAverageBandwidth() {
    if (this.bandwidthHistory.length === 0) return 0;
    
    const sum = this.bandwidthHistory.reduce((acc, item) => acc + item.bandwidth, 0);
    return sum / this.bandwidthHistory.length;
  }

  getAverageLatency() {
    if (this.latencyHistory.length === 0) return this.stats.latency;
    
    const sum = this.latencyHistory.reduce((acc, item) => acc + item.latency, 0);
    return sum / this.latencyHistory.length;
  }

  calculateNetworkStability() {
    if (this.history.length < 10) return 100;
    
    const recentHistory = this.history.slice(-10);
    const bandwidthVariance = this.calculateVariance(
      recentHistory.map(h => h.bandwidth)
    );
    const latencyVariance = this.calculateVariance(
      recentHistory.map(h => h.latency)
    );
    
    // Stability score (0-100)
    const bandwidthStability = Math.max(0, 100 - (bandwidthVariance / 1000000));
    const latencyStability = Math.max(0, 100 - (latencyVariance / 100));
    
    return (bandwidthStability + latencyStability) / 2;
  }

  calculateVariance(values) {
    const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  getNetworkQuality() {
    const bandwidth = this.stats.bandwidth;
    const latency = this.stats.latency;
    const packetLoss = this.stats.packetLoss;
    const stability = this.calculateNetworkStability();

    // Quality scoring algorithm
    let score = 100;

    // Bandwidth scoring
    if (bandwidth < 500000) score -= 40; // < 500kbps
    else if (bandwidth < 1000000) score -= 20; // < 1Mbps
    else if (bandwidth < 2000000) score -= 10; // < 2Mbps

    // Latency scoring
    if (latency > 300) score -= 30; // > 300ms
    else if (latency > 200) score -= 20; // > 200ms
    else if (latency > 100) score -= 10; // > 100ms

    // Packet loss scoring
    if (packetLoss > 5) score -= 25; // > 5%
    else if (packetLoss > 2) score -= 15; // > 2%
    else if (packetLoss > 1) score -= 5; // > 1%

    // Stability scoring
    if (stability < 50) score -= 20; // Low stability
    else if (stability < 70) score -= 10; // Medium stability

    return Math.max(0, Math.min(100, score));
  }

  getQualityRecommendation() {
    const quality = this.getNetworkQuality();
    const bandwidth = this.stats.bandwidth;

    if (quality >= 90 && bandwidth > 3000000) {
      return 'ultra';
    } else if (quality >= 80 && bandwidth > 1500000) {
      return 'high';
    } else if (quality >= 60 && bandwidth > 800000) {
      return 'medium';
    } else if (quality >= 40 && bandwidth > 400000) {
      return 'low';
    } else {
      return 'mobile';
    }
  }

  stopMonitoring() {
    this.isMonitoring = false;
  }

  getHistory() {
    return this.history;
  }

  destroy() {
    this.stopMonitoring();
    this.history = [];
    this.bandwidthHistory = [];
    this.latencyHistory = [];
  }
}

// Smart Bitrate Controller
class SmartBitrateController {
  constructor() {
    this.history = [];
    this.predictionModel = new BitratePredictionModel();
    this.currentBitrate = 1000000; // Start with 1Mbps
    this.minBitrate = 250000; // 250kbps minimum
    this.maxBitrate = 4000000; // 4Mbps maximum
    this.adaptationSpeed = 0.1; // How fast to adapt
  }

  async adjustBitrate(networkStats) {
    const predictedQuality = this.predictionModel.predict(networkStats);
    
    let targetBitrate = this.currentBitrate;

    switch (predictedQuality) {
      case 'excellent':
        targetBitrate = Math.min(this.maxBitrate, this.currentBitrate * 1.2);
        break;
      case 'good':
        targetBitrate = Math.min(this.maxBitrate, this.currentBitrate * 1.1);
        break;
      case 'fair':
        targetBitrate = this.currentBitrate;
        break;
      case 'poor':
        targetBitrate = Math.max(this.minBitrate, this.currentBitrate * 0.8);
        break;
      case 'critical':
        targetBitrate = Math.max(this.minBitrate, this.currentBitrate * 0.6);
        break;
    }

    // Smooth transition
    const diff = targetBitrate - this.currentBitrate;
    this.currentBitrate += diff * this.adaptationSpeed;

    this.history.push({
      timestamp: Date.now(),
      currentBitrate: this.currentBitrate,
      targetBitrate,
      networkStats,
      predictedQuality
    });

    return Math.round(this.currentBitrate);
  }

  preemptivelyReduceBitrate() {
    this.currentBitrate = Math.max(this.minBitrate, this.currentBitrate * 0.7);
  }

  graduallyIncreaseBitrate() {
    this.currentBitrate = Math.min(this.maxBitrate, this.currentBitrate * 1.3);
  }

  getCurrentBitrate() {
    return this.currentBitrate;
  }
}

// Simple Bitrate Prediction Model
class BitratePredictionModel {
  constructor() {
    this.thresholds = {
      bandwidth: {
        excellent: 3000000,
        good: 1500000,
        fair: 800000,
        poor: 400000
      },
      latency: {
        excellent: 50,
        good: 100,
        fair: 200,
        poor: 300
      },
      packetLoss: {
        excellent: 0.5,
        good: 1,
        fair: 2,
        poor: 5
      }
    };
  }

  predict(networkStats) {
    const { bandwidth, latency, packetLoss } = networkStats;
    
    let score = 0;
    
    // Bandwidth scoring
    if (bandwidth >= this.thresholds.bandwidth.excellent) score += 3;
    else if (bandwidth >= this.thresholds.bandwidth.good) score += 2;
    else if (bandwidth >= this.thresholds.bandwidth.fair) score += 1;
    
    // Latency scoring
    if (latency <= this.thresholds.latency.excellent) score += 3;
    else if (latency <= this.thresholds.latency.good) score += 2;
    else if (latency <= this.thresholds.latency.fair) score += 1;
    
    // Packet loss scoring
    if (packetLoss <= this.thresholds.packetLoss.excellent) score += 3;
    else if (packetLoss <= this.thresholds.packetLoss.good) score += 2;
    else if (packetLoss <= this.thresholds.packetLoss.fair) score += 1;
    
    // Determine quality
    if (score >= 8) return 'excellent';
    if (score >= 6) return 'good';
    if (score >= 4) return 'fair';
    if (score >= 2) return 'poor';
    return 'critical';
  }
}

// Make globally available
window.NetworkMonitor = NetworkMonitor;
window.SmartBitrateController = SmartBitrateController;
window.BitratePredictionModel = BitratePredictionModel;
