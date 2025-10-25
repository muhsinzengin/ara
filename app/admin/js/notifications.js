// Notifications Manager - Güvenli bildirim sistemi
class NotificationsManager {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.init();
  }

  init() {
    // Container oluştur
    this.container = document.createElement('div');
    this.container.className = 'notification-container';
    document.body.appendChild(this.container);

    // Stil ekle
    this.addStyles();
  }

  addStyles() {
    if (document.getElementById('notification-styles')) return;

    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      .notification-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .notification {
        min-width: 320px;
        max-width: 420px;
        background: linear-gradient(135deg, rgba(255,255,255,.95), rgba(255,255,255,.98));
        backdrop-filter: blur(20px);
        border-radius: 16px;
        padding: 16px 20px;
        box-shadow: 0 8px 32px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.08);
        border: 1px solid rgba(255,255,255,.6);
        display: flex;
        align-items: flex-start;
        gap: 14px;
        pointer-events: all;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        transform: translateX(450px) scale(.9);
        opacity: 0;
        animation: slideIn .5s cubic-bezier(.34,1.56,.64,1) forwards;
        font-size: 14px;
        line-height: 1.4;
      }

      @keyframes slideIn {
        0% { transform: translateX(450px) scale(.9); opacity: 0; }
        100% { transform: translateX(0) scale(1); opacity: 1; }
      }

      .notification.removing {
        animation: slideOut .4s cubic-bezier(.55,.085,.68,.53) forwards;
      }

      @keyframes slideOut {
        0% { transform: translateX(0) scale(1); opacity: 1; }
        100% { transform: translateX(450px) scale(.8); opacity: 0; }
      }

      .notification::before {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: linear-gradient(90deg, var(--notification-color), var(--notification-color-light));
        width: 100%;
        transform-origin: left;
        animation: progress 5s linear forwards;
      }

      @keyframes progress {
        from { transform: scaleX(1); }
        to { transform: scaleX(0); }
      }

      .notification-icon {
        font-size: 32px;
        line-height: 1;
        flex-shrink: 0;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,.1));
        animation: iconPop .6s cubic-bezier(.34,1.56,.64,1);
      }

      @keyframes iconPop {
        0% { transform: scale(0) rotate(-180deg); }
        50% { transform: scale(1.2) rotate(10deg); }
        100% { transform: scale(1) rotate(0deg); }
      }

      .notification-content {
        flex: 1;
        min-width: 0;
      }

      .notification-title {
        font-size: 15px;
        font-weight: 700;
        color: #1a1a1a;
        margin: 0 0 4px;
        line-height: 1.3;
      }

      .notification-message {
        font-size: 13px;
        color: #666;
        margin: 0;
        line-height: 1.4;
      }

      .notification-close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(0,0,0,.05);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        color: #666;
        transition: all .2s;
        opacity: 0;
      }

      .notification:hover .notification-close {
        opacity: 1;
      }

      .notification-close:hover {
        background: rgba(0,0,0,.1);
        transform: scale(1.1);
      }

      .notification.success {
        --notification-color: #4CAF50;
        --notification-color-light: #81C784;
        border-left: 4px solid #4CAF50;
      }

      .notification.error {
        --notification-color: #f44336;
        --notification-color-light: #e57373;
        border-left: 4px solid #f44336;
      }

      .notification.warning {
        --notification-color: #FF9800;
        --notification-color-light: #FFB74D;
        border-left: 4px solid #FF9800;
      }

      .notification.info {
        --notification-color: #2196F3;
        --notification-color-light: #64B5F6;
        border-left: 4px solid #2196F3;
      }

      @media (max-width: 480px) {
        .notification-container {
          top: 10px;
          right: 10px;
          left: 10px;
        }

        .notification {
          min-width: auto;
          max-width: none;
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  show({ type = 'info', title = '', message = '', duration = 5000 }) {
    const id = Date.now() + Math.random();

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-icon">${this.getIcon(type)}</div>
      <div class="notification-content">
        <h4 class="notification-title">${this.escapeHtml(title)}</h4>
        <p class="notification-message">${this.escapeHtml(message)}</p>
      </div>
      <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    // Tıklama ile kapat
    notification.onclick = (e) => {
      if (e.target.className !== 'notification-close') {
        this.hide(id);
      }
    };

    this.container.appendChild(notification);
    this.notifications.set(id, notification);

    // Otomatik gizleme
    setTimeout(() => {
      if (this.notifications.has(id)) {
        this.hide(id);
      }
    }, duration);

    return id;
  }

  hide(id) {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.classList.add('removing');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        this.notifications.delete(id);
      }, 400);
    }
  }

  success(message, title = 'Başarılı') {
    return this.show({ type: 'success', title, message });
  }

  error(message, title = 'Hata') {
    return this.show({ type: 'error', title, message });
  }

  warning(message, title = 'Uyarı') {
    return this.show({ type: 'warning', title, message });
  }

  info(message, title = 'Bilgi') {
    return this.show({ type: 'info', title, message });
  }

  getIcon(type) {
    const icons = {
      success: '✔',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || 'ℹ';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  clear() {
    this.notifications.forEach((notification, id) => {
      this.hide(id);
    });
  }
}

// Global instance
window.Notifications = new NotificationsManager();
