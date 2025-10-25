// WebRTC Manager - Enhanced with Quality Systems
class WebRTCManager {
  constructor() {
    this.currentCallId = null;
    this.pc = null;
    this.localStream = null;
    this.intervals = [];
    this.processedCandidates = new Set();
    this._polling = false;
    
    // Enhanced systems
    this.audioProcessor = null;
    this.audioLevelManager = null;
    this.videoQualityManager = null;
    this.networkMonitor = null;
    this.mobileOptimizer = null;
    this.batteryOptimizer = null;
    this.smartBitrateController = null;
    
    // Quality tracking
    this.qualityLevel = 3; // 1-5 scale
    this.currentBitrate = 1000000;
    this.isInitialized = false;
  }

  async initConnection(callId) {
    this.currentCallId = callId;

    try {
      LoadingManager.show('Gelişmiş ses-görüntü sistemi başlatılıyor...');
      
      // Initialize enhanced systems
      await this.initializeEnhancedSystems();
      
      LoadingManager.update('Kamera ve mikrofon erişimi isteniyor...');
      
      // Get optimal constraints based on device and network
      const constraints = await this.getOptimalConstraints();
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      LoadingManager.update('Ses işleme sistemi aktifleştiriliyor...');
      
      // Initialize audio processing
      if (this.audioProcessor) {
        await this.audioProcessor.processStream(this.localStream);
      }
      
      if (this.audioLevelManager) {
        await this.audioLevelManager.processStream(this.localStream);
      }

      LoadingManager.update('Bağlantı kuruluyor...');

      const localVideo = document.getElementById('fullLocalVideo');
      if (localVideo) localVideo.srcObject = this.localStream;

      // Use enhanced ICE servers
      const pcConfig = { 
        iceServers: this.getEnhancedIceServers(),
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      };
      this.pc = new RTCPeerConnection(pcConfig);

      this.localStream.getTracks().forEach(track => {
        this.pc.addTrack(track, this.localStream);
      });

      this.pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (event.track.kind === 'video') {
          const remoteVideo = document.getElementById('fullRemoteVideo');
          if (remoteVideo) remoteVideo.srcObject = stream;
        } else {
          const remoteAudio = document.getElementById('fullRemoteAudio');
          if (remoteAudio) {
            remoteAudio.srcObject = stream;
            remoteAudio.play().catch(e => console.log('Audio autoplay:', e));
          }
        }
      };

      this.pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await this.sendSignal('ice', { candidate: event.candidate });
        }
      };

      this.pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE state:', this.pc.iceConnectionState);
        if (this.pc.iceConnectionState === 'failed') {
          this.pc.restartIce();
        }
      };

      this.pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', this.pc.connectionState);
        if (this.pc.connectionState === 'connected') {
          LoadingManager.hide();
          ErrorHandler.show('Gelişmiş bağlantı kuruldu', 'success');
          this.startEnhancedMonitoring();
        } else if (this.pc.connectionState === 'failed') {
          ErrorHandler.show('Bağlantı başarısız. Yeniden deneniyor...', 'warning');
          this.reconnect();
        } else if (this.pc.connectionState === 'disconnected') {
          ErrorHandler.show('Bağlantı kesildi', 'warning');
        }
      };

      this.optimizeAudioTracks();
      this.startSignalPolling();
      this.isInitialized = true;
      
    } catch (err) {
      LoadingManager.hide();
      ErrorHandler.handle(err, 'Enhanced WebRTC Init');
    }
  }

  async initializeEnhancedSystems() {
    try {
      // Initialize audio processing
      if (window.AudioProcessor) {
        this.audioProcessor = new AudioProcessor();
        await this.audioProcessor.initialize();
      }
      
      if (window.AudioLevelManager) {
        this.audioLevelManager = new AudioLevelManager();
        await this.audioLevelManager.initialize();
      }

      // Initialize video quality management
      if (window.VideoQualityManager) {
        this.videoQualityManager = new VideoQualityManager();
        await this.videoQualityManager.initialize();
      }

      // Initialize network monitoring
      if (window.NetworkMonitor) {
        this.networkMonitor = new NetworkMonitor();
        await this.networkMonitor.initialize();
      }

      // Initialize mobile optimization
      if (window.MobileOptimizer) {
        this.mobileOptimizer = new MobileOptimizer();
        await this.mobileOptimizer.initialize();
      }

      // Initialize battery optimization
      if (window.BatteryOptimizer) {
        this.batteryOptimizer = new BatteryOptimizer();
        await this.batteryOptimizer.initialize();
      }

      // Initialize smart bitrate control
      if (window.SmartBitrateController) {
        this.smartBitrateController = new SmartBitrateController();
      }

      console.log('[WebRTC] Enhanced systems initialized');
    } catch (error) {
      console.error('[WebRTC] Failed to initialize enhanced systems:', error);
    }
  }

  async getOptimalConstraints() {
    let constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1,
        latency: 0.01,
        googEchoCancellation: true,
        googAutoGainControl: true,
        googNoiseSuppression: true,
        googHighpassFilter: true,
        googTypingNoiseDetection: true,
        googAudioMirroring: false
      },
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      }
    };

    // Apply mobile optimizations
    if (this.mobileOptimizer) {
      const mobileConstraints = this.mobileOptimizer.getOptimalConstraints();
      constraints = { ...constraints, ...mobileConstraints };
    }

    // Apply network-based optimizations
    if (this.networkMonitor) {
      const networkStats = await this.networkMonitor.getDetailedStats();
      if (networkStats.bandwidth < 1000000) {
        constraints.video.width.ideal = 854;
        constraints.video.height.ideal = 480;
        constraints.video.frameRate.ideal = 24;
      }
    }

    return constraints;
  }

  getEnhancedIceServers() {
    // Use WebRTCConfig if available, otherwise fallback
    if (typeof WebRTCConfig !== 'undefined') {
      return WebRTCConfig.iceServers;
    }
    
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
    ];
  }

  optimizeAudioTracks() {
    if (!this.localStream) return;
    
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      const sender = this.pc.getSenders().find(s => s.track?.kind === 'audio');
      if (sender) {
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        
        // Enhanced audio settings
        params.encodings[0].maxBitrate = 128000;
        params.encodings[0].priority = 'high';
        params.encodings[0].networkPriority = 'high';
        params.encodings[0].maxFramerate = 30;
        
        sender.setParameters(params).catch(e => console.log('Audio optimization:', e));
      }
    }
  }

  async startEnhancedMonitoring() {
    // Start network monitoring
    if (this.networkMonitor) {
      await this.networkMonitor.startMonitoring(this.pc);
    }

    // Start video quality management
    if (this.videoQualityManager) {
      // Video quality manager will handle its own monitoring
    }

    // Start stats monitoring
    this.startStatsMonitoring();
  }

  startSignalPolling() {
    if (this._polling) return;
    this._polling = true;
    this.pollInterval = 2000;
    this.maxPollInterval = 5000;
    this.errorCount = 0;

    const poll = async () => {
      if (!this.currentCallId || !this.pc) return;

      try {
        const res = await fetch('/api/poll-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: this.currentCallId })
        });
        const data = await res.json();

        if (data.success) {
          this.errorCount = 0;
          this.pollInterval = Math.max(2000, this.pollInterval - 500);

          if (data.offer && !this.pc.currentLocalDescription) {
            await this.pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await this.pc.createAnswer();
            
            // Apply SDP optimizations
            let sdp = answer.sdp;
            if (typeof WebRTCHelpers !== 'undefined') {
              if (WebRTCHelpers.applyOpusSettings) {
                sdp = WebRTCHelpers.applyOpusSettings(sdp, {
                  maxaveragebitrate: 128000,
                  stereo: 1,
                  useinbandfec: 1,
                  usedtx: 1,
                  maxplaybackrate: 48000,
                  complexity: 10,
                  packetloss: 0,
                  fec: 1,
                  cbr: 0,
                  application: 'voip'
                });
              }
              
              if (WebRTCHelpers.preferCodec) {
                sdp = WebRTCHelpers.preferCodec(sdp, 'VP9', 'video');
              }
            }
            
            await this.pc.setLocalDescription({type: 'answer', sdp});
            await this.sendSignal('answer', { answer: {type: 'answer', sdp} });
          }

          if (data.answer && !this.pc.currentRemoteDescription) {
            await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          }

          if (data.ice_candidates && data.ice_candidates.length > 0) {
            for (const candidate of data.ice_candidates) {
              const candidateKey = JSON.stringify(candidate);
              if (!this.processedCandidates.has(candidateKey)) {
                await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
                this.processedCandidates.add(candidateKey);
              }
            }
          }
        }
      } catch (err) {
        console.error('[WebRTC] Poll error:', err);
        this.errorCount++;
        this.pollInterval = Math.min(this.maxPollInterval, this.pollInterval + 1000);
        
        if (this.errorCount > 5) {
          this.reconnect();
        }
      }

      if (this._polling) {
        setTimeout(poll, this.pollInterval);
      }
    };

    poll();
  }

  async sendSignal(type, payload) {
    try {
      await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, callId: this.currentCallId, ...payload })
      });
    } catch (err) {
      console.error('[WebRTC] sendSignal error:', err);
    }
  }

  startStatsMonitoring() {
    const statsInterval = setInterval(async () => {
      if (!this.pc) return;

      try {
        const stats = await this.pc.getStats();
        let packetsLost = 0, jitter = 0, audioLevel = 0, bitrate = 0;

        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            packetsLost = report.packetsLost || 0;
            jitter = report.jitter || 0;
            audioLevel = report.audioLevel || 0;
          }
          if (report.type === 'outbound-rtp' && report.kind === 'audio') {
            bitrate = report.bytesSent || 0;
          }
        });

        // Enhanced quality adjustment
        await this.adjustQualityBasedOnStats(packetsLost, jitter, bitrate);

        const lossEl = document.getElementById('perfLoss');
        const jitterEl = document.getElementById('perfJitter');
        const bitrateEl = document.getElementById('perfBitrate');

        if (lossEl) lossEl.textContent = packetsLost;
        if (jitterEl) jitterEl.textContent = Math.round(jitter * 1000) + 'ms';
        if (bitrateEl) bitrateEl.textContent = Math.round(bitrate / 1000) + 'kb/s';
      } catch (err) {
        console.error('Stats error:', err);
      }
    }, 2000);

    this.intervals.push(statsInterval);
  }

  async adjustQualityBasedOnStats(packetsLost, jitter, bitrate) {
    // Use smart bitrate controller if available
    if (this.smartBitrateController && this.networkMonitor) {
      const networkStats = await this.networkMonitor.getDetailedStats();
      const newBitrate = await this.smartBitrateController.adjustBitrate(networkStats);
      
      if (newBitrate !== this.currentBitrate) {
        this.currentBitrate = newBitrate;
        await this.applyBitrateToVideo(newBitrate);
      }
    }

    // Traditional quality adjustment
    if (packetsLost > 10) {
      this.degradeQuality();
    } else if (packetsLost < 2 && this.qualityLevel < 3) {
      this.improveQuality();
    }
  }

  async applyBitrateToVideo(bitrate) {
    const sender = this.pc.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = bitrate;
      
      try {
        await sender.setParameters(params);
        console.log(`[WebRTC] Applied bitrate: ${bitrate}`);
      } catch (error) {
        console.error('[WebRTC] Failed to set bitrate:', error);
      }
    }
  }

  applyBatteryOptimizations(settings) {
    if (!this.pc || !this.localStream) return;
    
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      const constraints = {
        width: { ideal: 1280 * settings.resolution },
        height: { ideal: 720 * settings.resolution },
        frameRate: { ideal: 30 * settings.frameRate }
      };
      videoTrack.applyConstraints(constraints).catch(e => console.log('Battery optimization:', e));
    }
    
    // Apply bitrate optimization
    this.currentBitrate *= settings.videoBitrate;
    this.applyBitrateToVideo(this.currentBitrate);
  }

  degradeQuality() {
    if (!this.pc || !this.localStream) return;
    this.qualityLevel = Math.max(1, (this.qualityLevel || 3) - 1);
    
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      const constraints = {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 15 }
      };
      videoTrack.applyConstraints(constraints).catch(e => console.log('Degrade:', e));
    }
  }

  improveQuality() {
    if (!this.pc || !this.localStream) return;
    this.qualityLevel = Math.min(3, (this.qualityLevel || 1) + 1);
    
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      const constraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      };
      videoTrack.applyConstraints(constraints).catch(e => console.log('Improve:', e));
    }
  }

  hideLoading() {
    const overlay = document.getElementById('fullLoadingOverlay');
    if (overlay) overlay.classList.add('hidden');
  }

  toggleMic() {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      return track.enabled;
    }
    return false;
  }

  toggleVideo() {
    if (!this.localStream) return false;
    const track = this.localStream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      return track.enabled;
    }
    return false;
  }

  async reconnect() {
    console.log('[WebRTC] Attempting enhanced reconnect...');
    this.cleanup();
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (this.currentCallId) {
      await this.initConnection(this.currentCallId);
    }
  }

  cleanup() {
    console.log('[WebRTC] Enhanced cleanup...');
    this._polling = false;
    this.intervals.forEach(id => clearInterval(id));
    this.intervals = [];
    this.processedCandidates.clear();

    // Cleanup enhanced systems
    if (this.audioProcessor) {
      this.audioProcessor.destroy();
    }
    
    if (this.audioLevelManager) {
      this.audioLevelManager.destroy();
    }
    
    if (this.videoQualityManager) {
      this.videoQualityManager.destroy();
    }
    
    if (this.networkMonitor) {
      this.networkMonitor.destroy();
    }
    
    if (this.mobileOptimizer) {
      this.mobileOptimizer.destroy();
    }
    
    if (this.batteryOptimizer) {
      this.batteryOptimizer.destroy();
    }

    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      this.localStream = null;
    }

    this.currentCallId = null;
    this.isInitialized = false;
  }
}
