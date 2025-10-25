// Common Utilities - Shared JavaScript utilities
class CommonUtils {
  /**
   * Initialize Chrome extension error suppression
   * Suppresses common Chrome extension errors that don't affect functionality
   */
  static initChromeExtensionErrorSuppression() {
    // Error event suppression
    window.addEventListener('error', (e) => {
      if (e.message && this.isChromeExtensionError(e.message)) {
        e.preventDefault();
        e.stopPropagation();
        return true;
      }
    }, true);

    // Unhandled rejection suppression
    window.addEventListener('unhandledrejection', (e) => {
      if (e.reason && e.reason.message && this.isChromeExtensionError(e.reason.message)) {
        e.preventDefault();
        e.stopPropagation();
        return true;
      }
    }, true);

    // Console error suppression
    const originalError = console.error;
    console.error = function(...args) {
      const msg = args.join(' ');
      if (CommonUtils.isChromeExtensionError(msg)) {
        return;
      }
      originalError.apply(console, args);
    };
  }

  /**
   * Check if error message is from Chrome extension
   */
  static isChromeExtensionError(message) {
    const extensionErrors = [
      'Could not establish connection',
      'Receiving end does not exist',
      'Extension context invalidated'
    ];
    return extensionErrors.some(error => message.includes(error));
  }

  /**
   * Safe DOM selector with error handling
   */
  static $(selector) {
    try {
      return document.querySelector(selector);
    } catch (e) {
      return null;
    }
  }

  /**
   * Create notification container if it doesn't exist
   */
  static ensureNotificationContainer() {
    let container = document.querySelector('.notification-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'notification-container';
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Create notification element
   */
  static createNotification({type = 'info', title = '', message = ''}) {
    const container = this.ensureNotificationContainer();
    const notif = document.createElement('div');
    
    notif.className = `notification ${type}`;
    notif.innerHTML = `
      <div class="notification-icon">${this.getNotificationIcon(type)}</div>
      <div class="notification-content">
        <h4 class="notification-title">${title}</h4>
        <p class="notification-message">${message}</p>
      </div>
      <button class="notification-close">×</button>
    `;
    
    // Close button functionality
    notif.querySelector('.notification-close').onclick = () => {
      this.removeNotification(notif);
    };
    
    // Click to close functionality
    notif.onclick = (e) => {
      if (e.target.className !== 'notification-close') {
        this.removeNotification(notif);
      }
    };
    
    container.appendChild(notif);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(notif)) {
        this.removeNotification(notif);
      }
    }, 5000);
    
    return notif;
  }

  /**
   * Remove notification with animation
   */
  static removeNotification(notif) {
    notif.classList.add('removing');
    setTimeout(() => notif.remove(), 400);
  }

  /**
   * Get notification icon for type
   */
  static getNotificationIcon(type) {
    const icons = {
      success: '✔',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || 'ℹ';
  }

  /**
   * Notification API
   */
  static Notifications = {
    success: (message, title = 'Başarılı') => CommonUtils.createNotification({type: 'success', title, message}),
    error: (message, title = 'Hata') => CommonUtils.createNotification({type: 'error', title, message}),
    warning: (message, title = 'Uyarı') => CommonUtils.createNotification({type: 'warning', title, message}),
    info: (message, title = 'Bilgi') => CommonUtils.createNotification({type: 'info', title, message})
  };
}

// Initialize Chrome extension error suppression
CommonUtils.initChromeExtensionErrorSuppression();

// Make utilities globally available
window.CommonUtils = CommonUtils;
window.$ = CommonUtils.$;
window.Notifications = CommonUtils.Notifications;
