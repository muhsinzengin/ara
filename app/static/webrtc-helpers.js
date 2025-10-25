// WebRTC Helpers - Enhanced and Clean
(function() {
  'use strict';

  // Network quality detection
  async function detectNetworkQuality() {
    try {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!connection) return 'unknown';
      
      const { effectiveType, downlink, rtt } = connection;
      
      if (effectiveType === '4g' && downlink > 2 && rtt < 100) return 'excellent';
      if (effectiveType === '4g' && downlink > 1 && rtt < 200) return 'good';
      if (effectiveType === '3g' || (downlink > 0.5 && rtt < 300)) return 'fair';
      return 'poor';
    } catch {
      return 'unknown';
    }
  }

  // Optimal constraints based on network quality
  function getOptimalConstraints(quality = 'good') {
    const profiles = {
      excellent: {
        audio: { sampleRate: 48000, channelCount: 2, bitrate: 128000 },
        video: { width: 1920, height: 1080, frameRate: 30, bitrate: 4000000 }
      },
      good: {
        audio: { sampleRate: 48000, channelCount: 1, bitrate: 64000 },
        video: { width: 1280, height: 720, frameRate: 30, bitrate: 2000000 }
      },
      fair: {
        audio: { sampleRate: 44100, channelCount: 1, bitrate: 32000 },
        video: { width: 854, height: 480, frameRate: 24, bitrate: 1000000 }
      },
      poor: {
        audio: { sampleRate: 22050, channelCount: 1, bitrate: 16000 },
        video: { width: 640, height: 360, frameRate: 15, bitrate: 500000 }
      }
    };
    
    const profile = profiles[quality] || profiles.good;
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: profile.audio.sampleRate,
        channelCount: profile.audio.channelCount
      },
      video: {
        width: { ideal: profile.video.width },
        height: { ideal: profile.video.height },
        frameRate: { ideal: profile.video.frameRate }
      }
    };
  }

  // SDP helpers
  function applyOpusSettings(sdp, settings) {
    try {
      if (typeof WebRTCConfig !== 'undefined' && WebRTCConfig.applyOpusSettings) {
        return WebRTCConfig.applyOpusSettings(sdp, settings);
      }
      
      const {
        maxaveragebitrate = 64000,
        stereo = 0,
        useinbandfec = 1,
        usedtx = 1,
        maxplaybackrate = 48000,
        complexity = 10,
        packetloss = 0,
        fec = 1,
        cbr = 0,
        application = 'voip'
      } = settings || {};
      
      const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000/);
      if (!opusMatch) return sdp;
      
      const opusPayload = opusMatch[1];
      const fmtpLine = `a=fmtp:${opusPayload} minptime=10;useinbandfec=${useinbandfec};usedtx=${usedtx};maxaveragebitrate=${maxaveragebitrate};stereo=${stereo};maxplaybackrate=${maxplaybackrate};complexity=${complexity};packetloss=${packetloss};fec=${fec};cbr=${cbr};application=${application}`;
      
      const fmtpRegex = new RegExp(`a=fmtp:${opusPayload}.*\\r\\n`, 'g');
      if (fmtpRegex.test(sdp)) {
        return sdp.replace(fmtpRegex, fmtpLine + '\r\n');
      } else {
        return sdp.replace(new RegExp(`(a=rtpmap:${opusPayload}.*\\r\\n)`, 'g'), `$1${fmtpLine}\r\n`);
      }
    } catch {
      return sdp;
    }
  }

  function preferCodec(sdp, codecName, mimeType = 'video') {
    try {
      if (typeof WebRTCConfig !== 'undefined' && WebRTCConfig.preferCodec) {
        return WebRTCConfig.preferCodec(sdp, codecName, mimeType);
      }
      
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
      const newPayloads = [codecPayload, ...payloads.filter(p => p !== codecPayload)];
      lines[mLineIndex] = `${elements.slice(0, 3).join(' ')} ${newPayloads.join(' ')}`;
      
      return lines.join('\r\n');
    } catch {
      return sdp;
    }
  }

  function applyBitrateConstraints(sdp, profile = 'auto') {
    try {
      if (typeof WebRTCConfig !== 'undefined' && WebRTCConfig.applyBitrateConstraints) {
        return WebRTCConfig.applyBitrateConstraints(sdp, profile);
      }
      return sdp;
    } catch {
      return sdp;
    }
  }

  function enableHardwareAcceleration(sdp) {
    try {
      if (typeof WebRTCConfig !== 'undefined' && WebRTCConfig.enableHardwareAcceleration) {
        return WebRTCConfig.enableHardwareAcceleration(sdp);
      }
      return sdp;
    } catch {
      return sdp;
    }
  }

  function applySimulcast(sdp) {
    try {
      if (typeof WebRTCConfig !== 'undefined' && WebRTCConfig.applySimulcast) {
        return WebRTCConfig.applySimulcast(sdp);
      }
      return sdp;
    } catch {
      return sdp;
    }
  }

  function getIceServers() {
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

  function getPeerConfig() {
    return {
      iceServers: getIceServers(),
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };
  }

  // Export to global scope
  window.WebRTCHelpers = {
    detectNetworkQuality,
    getOptimalConstraints,
    applyOpusSettings,
    preferCodec,
    applyBitrateConstraints,
    enableHardwareAcceleration,
    applySimulcast,
    getIceServers,
    getPeerConfig
  };

})();