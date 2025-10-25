// Performance Utils - Optimizasyon yardımcıları
class PerformanceUtils {
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  static loadModule(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = path;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load module: ${path}`));
      document.head.appendChild(script);
    });
  }

  static calculateVisibleItems(scrollTop, itemHeight, containerHeight) {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight),
      startIndex + 20 // Max 20 öğe göster
    );
    return { startIndex, endIndex };
  }

  static batchUpdates(updates, batchSize = 10) {
    const batches = [];
    for (let i = 0; i < updates.length; i += batchSize) {
      batches.push(updates.slice(i, i + batchSize));
    }
    return batches;
  }

  static async preloadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  static measurePerformance(name, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
    return result;
  }

  static async measureAsyncPerformance(name, fn) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
    return result;
  }

  static createVirtualList(items, container, itemHeight, renderItem) {
    let scrollTop = 0;
    let visibleItems = [];

    const updateVisibleItems = () => {
      const { startIndex, endIndex } = this.calculateVisibleItems(
        scrollTop,
        itemHeight,
        container.clientHeight
      );

      visibleItems = items.slice(startIndex, endIndex);
      container.innerHTML = visibleItems.map((item, idx) =>
        renderItem(item, startIndex + idx)
      ).join('');
    };

    container.addEventListener('scroll', () => {
      scrollTop = container.scrollTop;
      updateVisibleItems();
    });

    updateVisibleItems();
    return { updateVisibleItems };
  }

  static optimizeEventListener(element, event, handler, options = {}) {
    const throttledHandler = options.throttle ?
      this.throttle(handler, options.throttle) :
      options.debounce ?
        this.debounce(handler, options.debounce) :
        handler;

    element.addEventListener(event, throttledHandler, options);
    return () => element.removeEventListener(event, throttledHandler);
  }

  static createIntersectionObserver(callback, options = {}) {
    const defaultOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1,
      ...options
    };

    return new IntersectionObserver(callback, defaultOptions);
  }

  static lazyLoadImages(container) {
    const images = container.querySelectorAll('img[data-src]');
    const observer = this.createIntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          observer.unobserve(img);
        }
      });
    });

    images.forEach(img => observer.observe(img));
  }

  static compressImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(resolve, 'image/jpeg', quality);
      };

      img.src = URL.createObjectURL(file);
    });
  }

  static cache = new Map();

  static memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
    return (...args) => {
      const key = keyFn(...args);
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }
      const result = fn.apply(this, args);
      this.cache.set(key, result);
      return result;
    };
  }

  static createWorker(fn) {
    const blob = new Blob([`(${fn.toString()})()`], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    return worker;
  }

  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static getDeviceInfo() {
    return {
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown',
      deviceMemory: navigator.deviceMemory || 'Unknown',
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      }
    };
  }

  static benchmarkFunction(fn, iterations = 1000) {
    const times = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      const end = performance.now();
      times.push(end - start);
    }

    const avg = times.reduce((a, b) => a + b) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    return {
      average: avg,
      min,
      max,
      iterations,
      total: times.reduce((a, b) => a + b)
    };
  }
}

// WebRTC performans optimizasyonları
class WebRTCPerformance {
  static optimizeSDP(sdp) {
    // Gereksiz codec'leri kaldır
    sdp = sdp.replace(/a=rtpmap:\d+ (?!opus|vp8|vp9|h264).*\r\n/g, '');

    // Bandwidth limitleri ekle
    sdp = sdp.replace(/(m=video.*\r\n)/g, '$1b=AS:500\r\n');

    return sdp;
  }

  static monitorConnection(pc, callback) {
    const statsInterval = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        const report = this.processStats(stats);
        callback(report);
      } catch (err) {
        console.error('Connection monitoring error:', err);
      }
    }, 2000);

    return () => clearInterval(statsInterval);
  }

  static processStats(stats) {
    const report = {
      audio: { bitrate: 0, packetsLost: 0, jitter: 0 },
      video: { bitrate: 0, packetsLost: 0, jitter: 0, fps: 0 },
      connection: { roundTripTime: 0, availableBandwidth: 0 }
    };

    stats.forEach(stat => {
      if (stat.type === 'inbound-rtp') {
        if (stat.kind === 'audio') {
          report.audio.bitrate = stat.bytesReceived ? (stat.bytesReceived * 8) / (stat.timestamp - stat.timestamp) : 0;
          report.audio.packetsLost = stat.packetsLost || 0;
          report.audio.jitter = stat.jitter || 0;
        } else if (stat.kind === 'video') {
          const timeDiff = stat.timestamp - (stat.timestamp || 0);
          report.video.bitrate = stat.bytesReceived && timeDiff > 0 ? (stat.bytesReceived * 8) / timeDiff : 0;
          report.video.packetsLost = stat.packetsLost || 0;
          report.video.jitter = stat.jitter || 0;
          report.video.fps = stat.framesPerSecond || 0;
        }
      } else if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        report.connection.roundTripTime = stat.currentRoundTripTime || 0;
        report.connection.availableBandwidth = stat.availableOutgoingBitrate || 0;
      }
    });

    return report;
  }

  static suggestOptimizations(stats) {
    const suggestions = [];

    if (stats.audio.packetsLost > 5) {
      suggestions.push('Ses paketi kaybı yüksek - ağ bağlantınızı kontrol edin');
    }

    if (stats.video.packetsLost > 10) {
      suggestions.push('Video paketi kaybı yüksek - codec ayarlarını düşürün');
    }

    if (stats.connection.roundTripTime > 200) {
      suggestions.push('Gecikme yüksek - daha yakın bir STUN/TURN sunucusu kullanın');
    }

    if (stats.video.bitrate > 1000000) {
      suggestions.push('Video bitrate çok yüksek - kalite ayarlarını düşürün');
    }

    return suggestions;
  }
}
