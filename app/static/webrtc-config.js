// WebRTC Configuration - Centralized Settings
const WebRTCConfig = {
  // ICE Servers (STUN + TURN for firewall bypass)
  iceServers: [
    // Primary STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.voiparound.com' },
    { urls: 'stun:stun.voipbuster.com' },
    { urls: 'stun:stun.voipstunt.com' },
    { urls: 'stun:stun.counterpath.com' },
    { urls: 'stun:stun.1und1.de' },
    { urls: 'stun:stun.gmx.net' },
    { urls: 'stun:stun.schlund.de' },
    { urls: 'stun:stun.voiparound.com' },
    { urls: 'stun:stun.voipbuster.com' },
    { urls: 'stun:stun.voipstunt.com' },
    { urls: 'stun:stun.counterpath.com' },
    { urls: 'stun:stun.1und1.de' },
    { urls: 'stun:stun.gmx.net' },
    { urls: 'stun:stun.schlund.de' },
    
    // Free TURN servers
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:80?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    
    // Additional TURN servers for better connectivity
    { urls: 'turn:relay.metered.ca:80', username: 'your-username', credential: 'your-credential' },
    { urls: 'turn:relay.metered.ca:443', username: 'your-username', credential: 'your-credential' },
    { urls: 'turn:relay.metered.ca:443?transport=tcp', username: 'your-username', credential: 'your-credential' },
    { urls: 'turn:relay.metered.ca:80?transport=tcp', username: 'your-username', credential: 'your-credential' },
    
    // Backup TURN servers
    { urls: 'turn:freeturn.tel:3478', username: 'free', credential: 'free' },
    { urls: 'turn:freeturn.tel:3478?transport=tcp', username: 'free', credential: 'free' },
    { urls: 'turn:freeturn.tel:3478?transport=udp', username: 'free', credential: 'free' }
  ],

  // Quality Profiles
  qualityProfiles: {
    low: {
      video: { width: 640, height: 480, frameRate: 15 },
      audio: { sampleRate: 16000, channelCount: 1 },
      videoBitrate: 250000,
      audioBitrate: 24000
    },
    medium: {
      video: { width: 1280, height: 720, frameRate: 24 },
      audio: { sampleRate: 48000, channelCount: 1 },
      videoBitrate: 800000,
      audioBitrate: 48000
    },
    high: {
      video: { width: 1920, height: 1080, frameRate: 30 },
      audio: { sampleRate: 48000, channelCount: 2 },
      videoBitrate: 2500000,
      audioBitrate: 96000
    },
    auto: {
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      audio: { sampleRate: 48000, channelCount: 1 },
      videoBitrate: null,
      audioBitrate: null
    }
  },

  // Audio Constraints
  getAudioConstraints(profile = 'auto', settings = {}) {
    const base = {
      echoCancellation: settings.echoCancellation !== false,
      noiseSuppression: settings.noiseSuppression !== false,
      autoGainControl: settings.autoGainControl !== false,
      deviceId: settings.deviceId || undefined
    };

    if (profile !== 'auto' && this.qualityProfiles[profile]) {
      const p = this.qualityProfiles[profile].audio;
      base.sampleRate = p.sampleRate;
      base.channelCount = p.channelCount;
    }

    return base;
  },

  // Video Constraints
  getVideoConstraints(profile = 'auto', facingMode = 'user') {
    if (profile === 'auto') {
      return {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        facingMode
      };
    }

    const p = this.qualityProfiles[profile]?.video;
    if (!p) return false;

    return {
      width: { exact: p.width },
      height: { exact: p.height },
      frameRate: { exact: p.frameRate },
      facingMode
    };
  },

  // Apply bitrate constraints to SDP
  applyBitrateConstraints(sdp, profile = 'auto') {
    if (profile === 'auto') return sdp;

    const p = this.qualityProfiles[profile];
    if (!p) return sdp;

    let modifiedSdp = sdp;

    // Video bitrate
    if (p.videoBitrate) {
      modifiedSdp = modifiedSdp.replace(
        /(m=video.*\r\n)/g,
        `$1b=AS:${Math.floor(p.videoBitrate / 1000)}\r\n`
      );
    }

    // Audio bitrate
    if (p.audioBitrate) {
      modifiedSdp = modifiedSdp.replace(
        /(m=audio.*\r\n)/g,
        `$1b=AS:${Math.floor(p.audioBitrate / 1000)}\r\n`
      );
    }

    return modifiedSdp;
  },

  // Opus codec settings
  applyOpusSettings(sdp, settings = {}) {
    const {
      maxaveragebitrate = 64000,
      stereo = 0,
      useinbandfec = 1,
      usedtx = 1,
      maxplaybackrate = 48000
    } = settings;

    // Find Opus payload type
    const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000/);
    if (!opusMatch) return sdp;

    const opusPayload = opusMatch[1];
    const fmtpLine = `a=fmtp:${opusPayload} minptime=10;useinbandfec=${useinbandfec};usedtx=${usedtx};maxaveragebitrate=${maxaveragebitrate};stereo=${stereo};maxplaybackrate=${maxplaybackrate}`;

    // Replace or add fmtp line
    const fmtpRegex = new RegExp(`a=fmtp:${opusPayload}.*\r\n`, 'g');
    if (fmtpRegex.test(sdp)) {
      return sdp.replace(fmtpRegex, fmtpLine + '\r\n');
    } else {
      return sdp.replace(
        new RegExp(`(a=rtpmap:${opusPayload}.*\r\n)`, 'g'),
        `$1${fmtpLine}\r\n`
      );
    }
  },

  // Prefer codec
  preferCodec(sdp, codecName, mimeType = 'video') {
    const lines = sdp.split('\r\n');
    const mLineIndex = lines.findIndex(line => line.startsWith(`m=${mimeType}`));
    if (mLineIndex === -1) return sdp;

    const codecRegex = new RegExp(`a=rtpmap:(\\d+) ${codecName}\\/`, 'i');
    const codecLine = lines.find(line => codecRegex.test(line));
    if (!codecLine) return sdp;

    const codecPayload = codecLine.match(codecRegex)[1];
    const mLine = lines[mLineIndex];
    const elements = mLine.split(' ');
    const payloads = elements.slice(3);

    // Move preferred codec to front
    const newPayloads = [codecPayload, ...payloads.filter(p => p !== codecPayload)];
    lines[mLineIndex] = `${elements.slice(0, 3).join(' ')} ${newPayloads.join(' ')}`;

    return lines.join('\r\n');
  },

  // Enable hardware acceleration hints
  enableHardwareAcceleration(sdp) {
    // Add hardware acceleration hints for supported codecs
    let modifiedSdp = sdp;
    
    // VP9 hardware acceleration
    modifiedSdp = modifiedSdp.replace(
      /(a=rtpmap:\d+ VP9\/\d+\r\n)/g,
      '$1a=rtcp-fb:* goog-remb\r\na=rtcp-fb:* transport-cc\r\n'
    );
    
    // H264 hardware acceleration
    modifiedSdp = modifiedSdp.replace(
      /(a=rtpmap:\d+ H264\/\d+\r\n)/g,
      '$1a=rtcp-fb:* goog-remb\r\na=rtcp-fb:* transport-cc\r\n'
    );
    
    return modifiedSdp;
  },

  // Apply simulcast for better quality adaptation
  applySimulcast(sdp) {
    const lines = sdp.split('\r\n');
    const videoMLineIndex = lines.findIndex(line => line.startsWith('m=video'));
    
    if (videoMLineIndex === -1) return sdp;
    
    // Add simulcast attributes
    const simulcastLine = 'a=simulcast:send 0;1;2';
    const ridLines = [
      'a=rid:0 send',
      'a=rid:1 send',
      'a=rid:2 send'
    ];
    
    // Insert after video m-line
    lines.splice(videoMLineIndex + 1, 0, simulcastLine, ...ridLines);
    
    return lines.join('\r\n');
  },

  // Get recommended settings based on device
  getRecommendedSettings() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS) {
      return {
        profile: 'high',
        codec: 'H264',
        hardwareAcceleration: true,
        simulcast: false
      };
    } else if (isAndroid) {
      return {
        profile: 'medium',
        codec: 'VP8',
        hardwareAcceleration: true,
        simulcast: false
      };
    } else {
      return {
        profile: 'high',
        codec: 'VP9',
        hardwareAcceleration: true,
        simulcast: true
      };
    }
  }
};

// Export for use in both index and admin
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebRTCConfig;
}

