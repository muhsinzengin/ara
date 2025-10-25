// Mobile Optimization System
class MobileOptimizer {
  constructor() {
    this.deviceInfo = this.detectDevice();
    this.batteryLevel = 1.0;
    this.isCharging = false;
    this.thermalState = 'nominal';
    this.orientation = 'portrait';
    this.isLowPowerMode = false;
    this.capabilities = this.detectCapabilities();
    this.optimizationSettings = this.getOptimizationSettings();
  }

  async initialize() {
    await this.setupBatteryMonitoring();
    await this.setupOrientationMonitoring();
    await this.setupThermalMonitoring();
    await this.setupLowPowerModeDetection();
    
    console.log('[MobileOptimizer] Initialized for:', this.deviceInfo.type);
  }

  detectDevice() {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    
    if (/iPhone|iPad/.test(ua)) {
      return { 
        type: 'ios', 
        version: this.getIOSVersion(ua),
        model: this.getIOSModel(ua),
        isTablet: /iPad/.test(ua)
      };
    } else if (/Android/.test(ua)) {
      return { 
        type: 'android', 
        version: this.getAndroidVersion(ua),
        isTablet: /Android.*Tablet|Android.*Pad/.test(ua)
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
      supportsHardwareAcceleration: false,
      supportsHDR: false,
      supportsHighFrameRate: false,
      supportsStereoAudio: false,
      maxResolution: { width: 1280, height: 720 },
      recommendedQuality: 'medium',
      batteryOptimized: false,
      thermalOptimized: false
    };

    // Check WebGL for hardware acceleration
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    capabilities.supportsHardwareAcceleration = !!gl;

    // Device-specific capabilities
    if (this.deviceInfo.type === 'ios') {
      capabilities.supportsHDR = this.deviceInfo.version >= 14;
      capabilities.supportsHighFrameRate = this.deviceInfo.version >= 12;
      capabilities.supportsStereoAudio = this.deviceInfo.version >= 13;
      
      if (this.deviceInfo.isTablet) {
        capabilities.maxResolution = { width: 2048, height: 1536 };
        capabilities.recommendedQuality = 'high';
      } else {
        capabilities.maxResolution = { width: 1920, height: 1080 };
        capabilities.recommendedQuality = 'medium';
      }
      
      // iPhone 12+ specific optimizations
      if (this.deviceInfo.model === 'iPhone 12+') {
        capabilities.supportsHDR = true;
        capabilities.supportsHighFrameRate = true;
        capabilities.maxResolution = { width: 2532, height: 1170 };
      }
      
    } else if (this.deviceInfo.type === 'android') {
      capabilities.supportsHighFrameRate = this.deviceInfo.version >= 8;
      capabilities.supportsStereoAudio = this.deviceInfo.version >= 9;
      
      if (this.deviceInfo.isTablet) {
        capabilities.maxResolution = { width: 1920, height: 1200 };
        capabilities.recommendedQuality = 'high';
      } else {
        capabilities.maxResolution = capabilities.supportsHighFrameRate ? 
          { width: 1920, height: 1080 } : { width: 1280, height: 720 };
        capabilities.recommendedQuality = capabilities.supportsHighFrameRate ? 'high' : 'medium';
      }
      
    } else {
      // Desktop
      capabilities.supportsHDR = true;
      capabilities.supportsHighFrameRate = true;
      capabilities.supportsStereoAudio = true;
      capabilities.maxResolution = { width: 3840, height: 2160 };
      capabilities.recommendedQuality = 'high';
    }

    return capabilities;
  }

  async setupBatteryMonitoring() {
    if ('getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery();
        this.batteryLevel = battery.level;
        this.isCharging = battery.charging;
        
        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level;
          this.adjustQualityForBattery();
        });
        
        battery.addEventListener('chargingchange', () => {
          this.isCharging = battery.charging;
          this.adjustQualityForBattery();
        });
        
        console.log('[MobileOptimizer] Battery monitoring enabled');
      } catch (error) {
        console.warn('[MobileOptimizer] Battery API not available:', error);
      }
    }
  }

  async setupOrientationMonitoring() {
    if ('orientation' in screen) {
      this.orientation = screen.orientation?.type || 'portrait';
      
      screen.orientation?.addEventListener('change', () => {
        this.orientation = screen.orientation.type;
        this.adjustForOrientation();
      });
    }
    
    // Fallback to window orientation
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        this.adjustForOrientation();
      }, 100);
    });
  }

  async setupThermalMonitoring() {
    if ('thermalState' in navigator) {
      this.thermalState = navigator.thermalState || 'nominal';
      
      navigator.addEventListener('thermalstatechange', () => {
        this.thermalState = navigator.thermalState;
        this.adjustForThermalState();
      });
    }
  }

  async setupLowPowerModeDetection() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      // Check for low power mode indicators
      if (connection.saveData) {
        this.isLowPowerMode = true;
        this.adjustForLowPowerMode();
      }
      
      connection.addEventListener('change', () => {
        this.isLowPowerMode = connection.saveData;
        this.adjustForLowPowerMode();
      });
    }
  }

  adjustQualityForBattery() {
    if (this.batteryLevel < 0.2 && !this.isCharging) {
      // Critical battery - minimum quality
      this.setBatteryOptimizedQuality('mobile');
    } else if (this.batteryLevel < 0.5 && !this.isCharging) {
      // Low battery - reduced quality
      this.setBatteryOptimizedQuality('low');
    } else if (this.batteryLevel < 0.8 && !this.isCharging) {
      // Medium battery - moderate quality
      this.setBatteryOptimizedQuality('medium');
    } else {
      // High battery or charging - normal quality
      this.setBatteryOptimizedQuality('high');
    }
  }

  setBatteryOptimizedQuality(quality) {
    this.optimizationSettings.batteryQuality = quality;
    this.capabilities.batteryOptimized = true;
    this.notifyQualityChange('battery', quality);
  }

  adjustForOrientation() {
    const isLandscape = this.orientation === 'landscape';
    
    if (isLandscape) {
      // Landscape - can use higher resolution
      this.optimizationSettings.orientationMultiplier = 1.2;
    } else {
      // Portrait - reduce resolution
      this.optimizationSettings.orientationMultiplier = 0.8;
    }
    
    this.notifyQualityChange('orientation', this.orientation);
  }

  adjustForThermalState() {
    switch (this.thermalState) {
      case 'critical':
        this.optimizationSettings.thermalQuality = 'mobile';
        this.optimizationSettings.frameRateReduction = 0.5;
        break;
      case 'serious':
        this.optimizationSettings.thermalQuality = 'low';
        this.optimizationSettings.frameRateReduction = 0.7;
        break;
      case 'fair':
        this.optimizationSettings.thermalQuality = 'medium';
        this.optimizationSettings.frameRateReduction = 0.9;
        break;
      default:
        this.optimizationSettings.thermalQuality = 'high';
        this.optimizationSettings.frameRateReduction = 1.0;
    }
    
    this.capabilities.thermalOptimized = true;
    this.notifyQualityChange('thermal', this.thermalState);
  }

  adjustForLowPowerMode() {
    if (this.isLowPowerMode) {
      this.optimizationSettings.lowPowerMode = true;
      this.optimizationSettings.lowPowerQuality = 'mobile';
      this.optimizationSettings.bitrateReduction = 0.5;
    } else {
      this.optimizationSettings.lowPowerMode = false;
      this.optimizationSettings.bitrateReduction = 1.0;
    }
    
    this.notifyQualityChange('lowPower', this.isLowPowerMode);
  }

  getOptimalConstraints() {
    const baseConstraints = this.getBaseConstraints();
    const optimizedConstraints = this.applyOptimizations(baseConstraints);
    
    return optimizedConstraints;
  }

  getBaseConstraints() {
    if (this.deviceInfo.type === 'ios') {
      return {
        video: { 
          width: { ideal: 1280, max: 1920 }, 
          height: { ideal: 720, max: 1080 }, 
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user'
        },
        audio: { 
          sampleRate: 48000, 
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
    } else if (this.deviceInfo.type === 'android') {
      return {
        video: { 
          width: { ideal: 854, max: 1280 }, 
          height: { ideal: 480, max: 720 }, 
          frameRate: { ideal: 24, max: 30 },
          facingMode: 'user'
        },
        audio: { 
          sampleRate: 44100, 
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
    }
    
    return this.getDesktopConstraints();
  }

  getDesktopConstraints() {
    return {
      video: { 
        width: { ideal: 1920, max: 3840 }, 
        height: { ideal: 1080, max: 2160 }, 
        frameRate: { ideal: 30, max: 60 }
      },
      audio: { 
        sampleRate: 48000, 
        channelCount: 2,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };
  }

  applyOptimizations(constraints) {
    const optimized = JSON.parse(JSON.stringify(constraints));
    
    // Apply battery optimizations
    if (this.optimizationSettings.batteryQuality) {
      const batteryQuality = this.optimizationSettings.batteryQuality;
      if (batteryQuality === 'mobile') {
        optimized.video.width.ideal = 640;
        optimized.video.height.ideal = 360;
        optimized.video.frameRate.ideal = 20;
      } else if (batteryQuality === 'low') {
        optimized.video.width.ideal = 854;
        optimized.video.height.ideal = 480;
        optimized.video.frameRate.ideal = 24;
      }
    }
    
    // Apply thermal optimizations
    if (this.optimizationSettings.frameRateReduction < 1.0) {
      optimized.video.frameRate.ideal *= this.optimizationSettings.frameRateReduction;
    }
    
    // Apply orientation optimizations
    if (this.optimizationSettings.orientationMultiplier) {
      optimized.video.width.ideal *= this.optimizationSettings.orientationMultiplier;
      optimized.video.height.ideal *= this.optimizationSettings.orientationMultiplier;
    }
    
    // Apply low power mode optimizations
    if (this.optimizationSettings.lowPowerMode) {
      optimized.video.width.ideal *= 0.7;
      optimized.video.height.ideal *= 0.7;
      optimized.video.frameRate.ideal *= 0.8;
    }
    
    return optimized;
  }

  getOptimizationSettings() {
    return {
      batteryQuality: null,
      thermalQuality: 'high',
      frameRateReduction: 1.0,
      orientationMultiplier: 1.0,
      lowPowerMode: false,
      lowPowerQuality: null,
      bitrateReduction: 1.0
    };
  }

  notifyQualityChange(reason, value) {
    console.log(`[MobileOptimizer] Quality change due to ${reason}:`, value);
    
    // Notify other systems
    if (window.videoQualityManager) {
      window.videoQualityManager.handleMobileOptimization(reason, value);
    }
  }

  getDeviceInfo() {
    return this.deviceInfo;
  }

  getCapabilities() {
    return this.capabilities;
  }

  getOptimizationSettings() {
    return this.optimizationSettings;
  }

  destroy() {
    // Cleanup event listeners
    if ('getBattery' in navigator) {
      // Battery listeners are automatically cleaned up
    }
    
    if ('orientation' in screen) {
      screen.orientation?.removeEventListener('change', this.adjustForOrientation);
    }
    
    window.removeEventListener('orientationchange', this.adjustForOrientation);
    
    if ('thermalState' in navigator) {
      navigator.removeEventListener('thermalstatechange', this.adjustForThermalState);
    }
  }
}

// Battery Optimizer
class BatteryOptimizer {
  constructor() {
    this.batteryLevel = 1.0;
    this.isCharging = false;
    this.optimizationLevel = 'normal';
    this.monitoringInterval = null;
  }

  async initialize() {
    await this.setupBatteryMonitoring();
    this.startMonitoring();
  }

  async setupBatteryMonitoring() {
    if ('getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery();
        this.batteryLevel = battery.level;
        this.isCharging = battery.charging;
        
        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level;
          this.updateOptimizationLevel();
        });
        
        battery.addEventListener('chargingchange', () => {
          this.isCharging = battery.charging;
          this.updateOptimizationLevel();
        });
        
        console.log('[BatteryOptimizer] Monitoring enabled');
      } catch (error) {
        console.warn('[BatteryOptimizer] Battery API not available:', error);
      }
    }
  }

  startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this.updateOptimizationLevel();
    }, 30000); // Check every 30 seconds
  }

  updateOptimizationLevel() {
    let newLevel = 'normal';
    
    if (this.batteryLevel < 0.2 && !this.isCharging) {
      newLevel = 'critical';
    } else if (this.batteryLevel < 0.5 && !this.isCharging) {
      newLevel = 'low';
    } else if (this.batteryLevel < 0.8 && !this.isCharging) {
      newLevel = 'medium';
    } else if (this.isCharging) {
      newLevel = 'charging';
    }
    
    if (newLevel !== this.optimizationLevel) {
      this.optimizationLevel = newLevel;
      this.applyBatteryOptimizations();
    }
  }

  applyBatteryOptimizations() {
    const optimizations = {
      critical: {
        videoBitrate: 0.3,
        audioBitrate: 0.5,
        frameRate: 0.5,
        resolution: 0.6
      },
      low: {
        videoBitrate: 0.5,
        audioBitrate: 0.7,
        frameRate: 0.7,
        resolution: 0.8
      },
      medium: {
        videoBitrate: 0.7,
        audioBitrate: 0.8,
        frameRate: 0.8,
        resolution: 0.9
      },
      normal: {
        videoBitrate: 1.0,
        audioBitrate: 1.0,
        frameRate: 1.0,
        resolution: 1.0
      },
      charging: {
        videoBitrate: 1.2,
        audioBitrate: 1.1,
        frameRate: 1.1,
        resolution: 1.1
      }
    };
    
    const settings = optimizations[this.optimizationLevel];
    
    // Apply optimizations to WebRTC
    if (window.webrtcManager) {
      window.webrtcManager.applyBatteryOptimizations(settings);
    }
    
    console.log(`[BatteryOptimizer] Applied ${this.optimizationLevel} optimizations:`, settings);
  }

  getOptimizationLevel() {
    return this.optimizationLevel;
  }

  getBatteryLevel() {
    return this.batteryLevel;
  }

  isCharging() {
    return this.isCharging;
  }

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}

// Make globally available
window.MobileOptimizer = MobileOptimizer;
window.BatteryOptimizer = BatteryOptimizer;
