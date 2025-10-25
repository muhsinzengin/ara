// Advanced Audio Processing System
class AudioProcessor {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.microphoneLevel = 0;
    this.targetLevel = 0.7;
    this.gainNode = null;
    this.compressor = null;
    this.eqNode = null;
    this.noiseGate = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.setupAudioNodes();
      this.isInitialized = true;
      console.log('[AudioProcessor] Initialized successfully');
    } catch (error) {
      console.error('[AudioProcessor] Initialization failed:', error);
    }
  }

  setupAudioNodes() {
    // Gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1.0;

    // Compressor for dynamic range control
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    // EQ for frequency shaping
    this.eqNode = this.audioContext.createBiquadFilter();
    this.eqNode.type = 'highpass';
    this.eqNode.frequency.value = 80; // Remove low-frequency noise

    // Noise gate
    this.noiseGate = this.audioContext.createDynamicsCompressor();
    this.noiseGate.threshold.value = -50;
    this.noiseGate.knee.value = 0;
    this.noiseGate.ratio.value = 20;
    this.noiseGate.attack.value = 0.01;
    this.noiseGate.release.value = 0.1;

    // Analyser for level monitoring
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    // Connect the chain
    this.gainNode.connect(this.compressor);
    this.compressor.connect(this.eqNode);
    this.eqNode.connect(this.noiseGate);
    this.noiseGate.connect(this.analyser);
  }

  async processStream(stream) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.gainNode);

    // Start level monitoring
    this.startLevelMonitoring();

    return this.analyser;
  }

  startLevelMonitoring() {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const monitor = () => {
      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      this.microphoneLevel = Math.sqrt(sum / dataArray.length) / 255;

      // Auto-adjust gain
      this.adjustGain();

      requestAnimationFrame(monitor);
    };

    monitor();
  }

  adjustGain() {
    if (this.microphoneLevel > 0) {
      const adjustment = this.targetLevel / this.microphoneLevel;
      const newGain = Math.min(Math.max(adjustment, 0.1), 3.0);
      
      // Smooth gain changes
      this.gainNode.gain.setTargetAtTime(newGain, this.audioContext.currentTime, 0.1);
    }
  }

  setCompressionSettings(settings) {
    if (this.compressor) {
      this.compressor.threshold.value = settings.threshold || -24;
      this.compressor.ratio.value = settings.ratio || 12;
      this.compressor.attack.value = settings.attack || 0.003;
      this.compressor.release.value = settings.release || 0.25;
    }
  }

  setEQSettings(settings) {
    if (this.eqNode) {
      this.eqNode.frequency.value = settings.highpass || 80;
      this.eqNode.Q.value = settings.q || 1;
    }
  }

  setNoiseGateThreshold(threshold) {
    if (this.noiseGate) {
      this.noiseGate.threshold.value = threshold;
    }
  }

  getAudioLevel() {
    return this.microphoneLevel;
  }

  destroy() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isInitialized = false;
  }
}

// Audio Level Manager for UI
class AudioLevelManager {
  constructor() {
    this.processor = new AudioProcessor();
    this.levelBars = [];
    this.isMonitoring = false;
  }

  async initialize() {
    await this.processor.initialize();
    this.createLevelIndicator();
  }

  createLevelIndicator() {
    const container = document.createElement('div');
    container.id = 'audio-level-indicator';
    container.className = 'audio-level-indicator';
    container.innerHTML = `
      <div class="level-label">Ses Seviyesi</div>
      <div class="level-bars">
        <div class="level-bar"></div>
        <div class="level-bar"></div>
        <div class="level-bar"></div>
        <div class="level-bar"></div>
        <div class="level-bar"></div>
        <div class="level-bar"></div>
        <div class="level-bar"></div>
        <div class="level-bar"></div>
        <div class="level-bar"></div>
        <div class="level-bar"></div>
      </div>
      <div class="level-value">0%</div>
    `;

    document.body.appendChild(container);
    this.levelBars = container.querySelectorAll('.level-bar');
    this.levelValue = container.querySelector('.level-value');
  }

  async processStream(stream) {
    await this.processor.processStream(stream);
    this.startVisualMonitoring();
  }

  startVisualMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    const updateVisuals = () => {
      const level = this.processor.getAudioLevel();
      const percentage = Math.round(level * 100);
      
      if (this.levelValue) {
        this.levelValue.textContent = `${percentage}%`;
      }

      // Update level bars
      this.levelBars.forEach((bar, index) => {
        const threshold = (index + 1) / this.levelBars.length;
        if (level >= threshold) {
          bar.classList.add('active');
        } else {
          bar.classList.remove('active');
        }
      });

      if (this.isMonitoring) {
        requestAnimationFrame(updateVisuals);
      }
    };

    updateVisuals();
  }

  stopMonitoring() {
    this.isMonitoring = false;
  }

  destroy() {
    this.stopMonitoring();
    this.processor.destroy();
    const indicator = document.getElementById('audio-level-indicator');
    if (indicator) {
      indicator.remove();
    }
  }
}

// Make globally available
window.AudioProcessor = AudioProcessor;
window.AudioLevelManager = AudioLevelManager;
