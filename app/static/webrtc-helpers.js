// WebRTC Helpers - Shared between index and admin (global, non-module)
;(function(){
  const isSecureContext = () => (
    location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1'
  );

  async function detectNetworkQuality() {
    try {
      const navConn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (navConn && navConn.effectiveType) {
        const type = String(navConn.effectiveType || '').toLowerCase();
        if (type.includes('4g')) return 'good';
        if (type.includes('3g')) return 'medium';
        return 'low';
      }
    } catch {}
    // Fallback: assume good on secure contexts, medium otherwise
    return isSecureContext() ? 'good' : 'medium';
  }

  function getOptimalConstraints(quality = 'good') {
    // Base audio constraints
    const audio = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };

    // Video constraints by quality
    let video;
    switch (quality) {
      case 'good':
        video = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
        break;
      case 'medium':
        video = { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24 } };
        break;
      default:
        video = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 20 } };
        break;
    }
    return { audio, video };
  }

  window.WebRTCHelpers = { detectNetworkQuality, getOptimalConstraints };
  // SDP helpers (wrap WebRTCConfig if available, else provide defaults)
  function applyOpusSettings(sdp, settings){
    try {
      if (typeof WebRTCConfig !== 'undefined' && WebRTCConfig.applyOpusSettings) {
        return WebRTCConfig.applyOpusSettings(sdp, settings);
      }
      // Minimal local implementation
      const {
        maxaveragebitrate = 64000,
        stereo = 0,
        useinbandfec = 1,
        usedtx = 1,
        maxplaybackrate = 48000
      } = settings || {};
      const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000/);
      if (!opusMatch) return sdp;
      const opusPayload = opusMatch[1];
      const fmtpLine = `a=fmtp:${opusPayload} minptime=10;useinbandfec=${useinbandfec};usedtx=${usedtx};maxaveragebitrate=${maxaveragebitrate};stereo=${stereo};maxplaybackrate=${maxplaybackrate}`;
      const fmtpRegex = new RegExp(`a=fmtp:${opusPayload}.*\\r\\n`, 'g');
      if (fmtpRegex.test(sdp)) {
        return sdp.replace(fmtpRegex, fmtpLine + '\r\n');
      } else {
        return sdp.replace(new RegExp(`(a=rtpmap:${opusPayload}.*\\r\\n)`, 'g'), `$1${fmtpLine}\r\n`);
      }
    } catch { return sdp; }
  }

  function preferCodec(sdp, codecName, mimeType = 'video'){
    try {
      if (typeof WebRTCConfig !== 'undefined' && WebRTCConfig.preferCodec) {
        return WebRTCConfig.preferCodec(sdp, codecName, mimeType);
      }
      const lines = sdp.split('\r\n');
      const mLineIndex = lines.findIndex(line => line.startsWith(`m=${mimeType}`));
      if (mLineIndex === -1) return sdp;
      const codecRegex = new RegExp(`a=rtpmap:(\\\d+) ${codecName}\\/`, 'i');
      const codecLine = lines.find(line => codecRegex.test(line));
      if (!codecLine) return sdp;
      const codecPayload = codecLine.match(codecRegex)[1];
      const mLine = lines[mLineIndex];
      const elements = mLine.split(' ');
      const payloads = elements.slice(3);
      const newPayloads = [codecPayload, ...payloads.filter(p => p !== codecPayload)];
      lines[mLineIndex] = `${elements.slice(0, 3).join(' ')} ${newPayloads.join(' ')}`;
      return lines.join('\r\n');
    } catch { return sdp; }
  }

  function applyBitrateConstraints(sdp, profile='auto'){
    if (typeof WebRTCConfig !== 'undefined' && WebRTCConfig.applyBitrateConstraints){
      return WebRTCConfig.applyBitrateConstraints(sdp, profile);
    }
    return sdp;
  }

  function enableHardwareAcceleration(sdp){
    if (typeof WebRTCConfig !== 'undefined' && WebRTCConfig.enableHardwareAcceleration){
      return WebRTCConfig.enableHardwareAcceleration(sdp);
    }
    return sdp;
  }

  function applySimulcast(sdp){
    if (typeof WebRTCConfig !== 'undefined' && WebRTCConfig.applySimulcast){
      return WebRTCConfig.applySimulcast(sdp);
    }
    return sdp;
  }

  Object.assign(window.WebRTCHelpers, {
    applyOpusSettings,
    preferCodec,
    applyBitrateConstraints,
    enableHardwareAcceleration,
    applySimulcast
  });

  // ICE/TURN config loader (env-driven if available)
  let _iceCache = null;
  async function getIceServers() {
    if (_iceCache) return _iceCache;
    try {
      const res = await fetch('/api/ice-servers');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.iceServers)) {
          _iceCache = data.iceServers;
          return _iceCache;
        }
      }
    } catch {}
    if (typeof WebRTCConfig !== 'undefined' && Array.isArray(WebRTCConfig.iceServers)) {
      _iceCache = WebRTCConfig.iceServers;
      return _iceCache;
    }
    _iceCache = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ];
    return _iceCache;
  }

  async function getPeerConfig() {
    const iceServers = await getIceServers();
    return {
      iceServers,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };
  }

  Object.assign(window.WebRTCHelpers, { getIceServers, getPeerConfig });
})();
