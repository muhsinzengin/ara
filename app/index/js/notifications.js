(function() {
    const container = document.getElementById('notificationContainer') || (function() {
        const el = document.createElement('div');
        el.id = 'notificationContainer';
        el.className = 'notification-container';
        document.body.appendChild(el);
        return el;
    })();

    function createNotification({ type = 'info', title = '', message = '' }) {
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.setAttribute('role', 'alert');
        notif.setAttribute('aria-live', 'polite');

        const icon = document.createElement('div');
        icon.className = 'notification-icon';
        icon.textContent = {
            success: '✔',
            error: '✕',
            warning: '⚠',
            info: 'ℹ',
            call: '📞'
        }[type] || 'ℹ';

        const content = document.createElement('div');
        content.className = 'notification-content';

        const titleEl = document.createElement('h4');
        titleEl.className = 'notification-title';
        titleEl.textContent = title;

        const messageEl = document.createElement('p');
        messageEl.className = 'notification-message';
        messageEl.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => {
            notif.classList.add('removing');
            setTimeout(() => notif.remove(), 400);
        });

        content.appendChild(titleEl);
        content.appendChild(messageEl);

        notif.appendChild(icon);
        notif.appendChild(content);
        notif.appendChild(closeBtn);

        notif.addEventListener('click', (e) => {
            if (e.target !== closeBtn) {
                notif.classList.add('removing');
                setTimeout(() => notif.remove(), 400);
            }
        });

        container.appendChild(notif);

        setTimeout(() => {
            if (document.body.contains(notif)) {
                notif.classList.add('removing');
                setTimeout(() => notif.remove(), 400);
            }
        }, 5000);
    }

    window.Notifications = {
        success(message, title = 'Başarılı') {
            createNotification({ type: 'success', title, message });
        },
        error(message, title = 'Hata') {
            createNotification({ type: 'error', title, message });
        },
        warning(message, title = 'Uyarı') {
            createNotification({ type: 'warning', title, message });
        },
        info(message, title = 'Bilgi') {
            createNotification({ type: 'info', title, message });
        },
        call(message, title = 'Arama') {
            createNotification({ type: 'call', title, message });
        }
    };
})();
