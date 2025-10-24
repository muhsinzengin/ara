class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.maxNotifications = 5;
        this.defaultDuration = 5000;
        this.init();
    }

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        }
    }

    show(options) {
        const {
            type = 'info',
            title = '',
            message = '',
            duration = this.defaultDuration,
            icon = this.getDefaultIcon(type),
            onClick = null
        } = options;

        if (this.notifications.length >= this.maxNotifications) {
            this.remove(this.notifications[0]);
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <h4 class="notification-title">${title}</h4>
                <p class="notification-message">${message}</p>
            </div>
            <button class="notification-close">×</button>
        `;

        this.container.appendChild(notification);
        this.notifications.push(notification);

        this.playSound(type);

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.remove(notification);
        });

        if (onClick) {
            notification.style.cursor = 'pointer';
            notification.addEventListener('click', () => {
                onClick();
                this.remove(notification);
            });
        }

        if (duration > 0) {
            setTimeout(() => {
                this.remove(notification);
            }, duration);
        }

        return notification;
    }

    remove(notification) {
        if (!notification || !notification.parentElement) return;

        notification.classList.add('removing');
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }, 400);
    }

    getDefaultIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            call: '📞'
        };
        return icons[type] || icons.info;
    }

    playSound(type) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            const frequencies = {
                success: 800,
                error: 400,
                warning: 600,
                info: 700,
                call: 900
            };

            oscillator.frequency.value = frequencies[type] || 700;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            // Silent fail
        }
    }

    success(title, message, duration) {
        return this.show({ type: 'success', title, message, duration });
    }

    error(title, message, duration) {
        return this.show({ type: 'error', title, message, duration });
    }

    warning(title, message, duration) {
        return this.show({ type: 'warning', title, message, duration });
    }

    info(title, message, duration) {
        return this.show({ type: 'info', title, message, duration });
    }

    call(title, message, onClick, duration = 0) {
        return this.show({ type: 'call', title, message, onClick, duration });
    }

    clear() {
        this.notifications.forEach(notification => this.remove(notification));
    }
}

window.notify = new NotificationManager();

window.showNotification = function(message, type = 'info') {
    const titles = {
        success: 'Başarılı',
        error: 'Hata',
        warning: 'Uyarı',
        info: 'Bilgi'
    };
    
    window.notify.show({
        type: type,
        title: titles[type] || 'Bilgi',
        message: message
    });
};
