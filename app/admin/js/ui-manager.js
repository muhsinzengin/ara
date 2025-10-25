// UI Manager - Güvenli ve optimize edilmiş
class UIManager {
  constructor() {
    this.active = new Map();
    this.history = [];
    this.intervals = [];
  }

  // OTP ekranı
  showOTPScreen() {
    document.getElementById('otpScreen').classList.remove('hidden');
    document.getElementById('dashboardScreen').classList.add('hidden');
    document.getElementById('fullCallScreen').classList.add('hidden');
    document.getElementById('incomingCallModal').classList.add('hidden');
  }

  // Dashboard ekranı
  showDashboard() {
    document.getElementById('otpScreen').classList.add('hidden');
    document.getElementById('dashboardScreen').classList.remove('hidden');
    document.getElementById('fullCallScreen').classList.add('hidden');
    document.getElementById('incomingCallModal').classList.add('hidden');
  }

  // Arama ekranı
  showCallScreen(callId) {
    document.getElementById('otpScreen').classList.add('hidden');
    document.getElementById('dashboardScreen').classList.add('hidden');
    document.getElementById('fullCallScreen').classList.remove('hidden');
    document.getElementById('incomingCallModal').classList.add('hidden');

    // Timer başlat
    this.startCallTimer();
  }

  // Gelen arama modal'ı
  showIncomingCall(call) {
    const modal = document.getElementById('incomingCallModal');
    const callerName = document.getElementById('incomingCallerName');

    if (callerName) {
      callerName.textContent = call.name;
    }

    modal.classList.remove('hidden');

    // Otomatik gizleme (30 saniye)
    setTimeout(() => {
      if (!modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
      }
    }, 30000);
  }

  // Aktif çağrıları güncelle
  updateActiveCalls() {
    const activeList = document.getElementById('activeList');
    if (!activeList) return;

    const activeCalls = Array.from(window.adminPanel.active.values());

    if (activeCalls.length === 0) {
      activeList.innerHTML = '<div class="empty">Henüz aktif görüşme yok</div>';
      return;
    }

    activeList.innerHTML = activeCalls.map(call => `
      <div class="call call--${call.status}" data-call-id="${call.id}">
        <div class="call__info">
          <div class="call__name">${this.escapeHtml(call.name)}</div>
          <div class="call__status">${this.getStatusText(call.status)}</div>
          <div class="call__time">${call.minutesAgo} dakika önce</div>
        </div>
        <div class="call__actions">
          ${call.status === 'waiting' ? `
            <button class="btn btn--accept" onclick="window.adminPanel.acceptCall('${call.id}')">Kabul Et</button>
            <button class="btn btn--hold" onclick="window.adminPanel.holdCall('${call.id}')">Beklet</button>
          ` : call.status === 'connected' ? `
            <button class="btn btn--close" onclick="window.adminPanel.closeCall('${call.id}')">Kapat</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  // Kuyruğu güncelle
  updateQueue(onAccept) {
    const queueList = document.getElementById('queueList');
    if (!queueList) return;

    const waitingCalls = Array.from(window.adminPanel.active.values())
      .filter(c => c.status === 'waiting');

    if (waitingCalls.length === 0) {
      queueList.innerHTML = '<div class="empty">Kuyruk boş</div>';
      return;
    }

    queueList.innerHTML = waitingCalls.map((call, idx) => `
      <div class="queue-item" data-call-id="${call.id}">
        <div class="queue-item__num">${idx + 1}</div>
        <div class="queue-item__info">
          <div class="queue-item__name">${this.escapeHtml(call.name)}</div>
          <div class="queue-item__time">${call.minutesAgo} dk önce</div>
        </div>
        <div class="queue-item__actions">
          <button class="btn btn--small btn--accept" onclick="window.adminPanel.acceptCall('${call.id}')">✓</button>
          <button class="btn btn--small btn--hold" onclick="window.adminPanel.holdCall('${call.id}')">⏸️</button>
        </div>
      </div>
    `).join('');
  }

  // Geçmişi güncelle
  updateHistory() {
    const historyContainer = document.getElementById('historyContainer');
    if (!historyContainer) return;

    if (this.history.length === 0) {
      historyContainer.innerHTML = '<div class="empty">Henüz görüşme kaydı yok</div>';
      return;
    }

    historyContainer.innerHTML = this.history.map(call => `
      <div class="history-item">
        <div class="history-item__info">
          <div class="history-item__name">${this.escapeHtml(call.customer_name)}</div>
          <div class="history-item__time">${this.formatDateTime(call.start_time)}</div>
        </div>
        <div class="history-item__stats">
          <div class="history-item__duration">${this.formatDuration(call.duration)}</div>
          <div class="history-item__status status--${call.status}">${this.getStatusText(call.status)}</div>
        </div>
      </div>
    `).join('');
  }

  // KPI'ları güncelle
  updateKPIs() {
    const active = Array.from(window.adminPanel.active.values());
    const activeCount = active.filter(c => c.status !== 'waiting').length;
    const queueCount = active.filter(c => c.status === 'waiting').length;

    // Aktif görüşme sayısı
    const kActive = document.getElementById('kActive');
    if (kActive) kActive.textContent = activeCount;

    // Kuyruk sayısı
    const kQueue = document.getElementById('kQueue');
    if (kQueue) kQueue.textContent = queueCount;

    // Bugün
    const today = new Date().toDateString();
    const todayCalls = this.history.filter(h => new Date(h.start_time).toDateString() === today);
    const kToday = document.getElementById('kToday');
    if (kToday) kToday.textContent = todayCalls.length;

    // Bu hafta
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekCalls = this.history.filter(h => new Date(h.start_time) > weekAgo);
    const kWeek = document.getElementById('kWeek');
    if (kWeek) kWeek.textContent = weekCalls.length;

    // Bu ay
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthCalls = this.history.filter(h => new Date(h.start_time) > monthAgo);
    const kMonth = document.getElementById('kMonth');
    if (kMonth) kMonth.textContent = monthCalls.length;

    // Bu yıl
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const yearCalls = this.history.filter(h => new Date(h.start_time) >= yearStart);
    const kYear = document.getElementById('kYear');
    if (kYear) kYear.textContent = yearCalls.length;

    // Badge'ları güncelle
    const lblActive = document.getElementById('lblActive');
    if (lblActive) lblActive.textContent = `${activeCount} aktif`;

    const lblQueue = document.getElementById('lblQueue');
    if (lblQueue) lblQueue.textContent = `${queueCount} bekliyor`;

    const historyCount = document.getElementById('historyCount');
    if (historyCount) historyCount.textContent = `${this.history.length} kayıt`;
  }

  // Arama timer'ı
  startCallTimer() {
    const timerEl = document.getElementById('fullTimer');
    if (!timerEl) return;

    let seconds = 0;
    const timerInterval = setInterval(() => {
      seconds++;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);

    this.intervals.push(timerInterval);
  }

  // Yardımcı fonksiyonlar
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getStatusText(status) {
    const statusMap = {
      'waiting': 'Bekliyor',
      'accepted': 'Kabul Edildi',
      'connected': 'Bağlandı',
      'on_hold': 'Bekletildi',
      'completed': 'Tamamlandı',
      'closed_by_admin': 'Admin Tarafından Kapatıldı',
      'disconnected': 'Bağlantı Kesildi'
    };
    return statusMap[status] || status;
  }

  formatDateTime(dateTime) {
    const date = new Date(dateTime);
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  // Cleanup
  cleanup() {
    this.intervals.forEach(id => clearInterval(id));
    this.intervals = [];
  }
}
