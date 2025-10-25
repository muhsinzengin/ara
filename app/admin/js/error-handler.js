// Centralized Error Handler
class ErrorHandler {
  static show(message, type = 'error') {
    const container = document.getElementById('errorContainer') || this.createContainer();
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
      <span class="alert-icon">${this.getIcon(type)}</span>
      <span class="alert-message">${message}</span>
      <button class="alert-close" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
  }

  static createContainer() {
    const container = document.createElement('div');
    container.id = 'errorContainer';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;max-width:400px;';
    document.body.appendChild(container);
    return container;
  }

  static getIcon(type) {
    const icons = { error: '❌', success: '✅', warning: '⚠️', info: 'ℹ️' };
    return icons[type] || icons.info;
  }

  static async handle(error, context = '') {
    console.error(`[${context}]`, error);
    
    if (error.name === 'NotAllowedError') {
      this.show('Kamera/mikrofon izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.', 'error');
    } else if (error.name === 'NotFoundError') {
      this.show('Kamera veya mikrofon bulunamadı.', 'error');
    } else if (error.message?.includes('network')) {
      this.show('Bağlantı hatası. İnternet bağlantınızı kontrol edin.', 'warning');
    } else {
      this.show(error.message || 'Bir hata oluştu', 'error');
    }
  }
}

// Loading Manager
class LoadingManager {
  static show(message = 'Yükleniyor...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loadingOverlay';
      overlay.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">${message}</div>
      `;
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9998;';
      document.body.appendChild(overlay);
    }
    overlay.querySelector('.loading-text').textContent = message;
    overlay.classList.remove('hidden');
  }

  static hide() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
  }

  static update(message) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.querySelector('.loading-text').textContent = message;
  }
}

// Export
window.ErrorHandler = ErrorHandler;
window.LoadingManager = LoadingManager;
