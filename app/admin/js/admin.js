'use strict';

/* ========== STATE ========== */
const state = {
    authenticated: false,
    peer: null,
    call: null,
    stream: null,
    currentCallId: null,
    currentCustomer: null,
    customerPeerId: null,
    pendingCall: null,
    videoEnabled: true,
    audioEnabled: true,
    speakerEnabled: true,
    proximitySensorMode: false,
    startTime: 0,
    timerInterval: null,
    statsInterval: null,
    onlineCheckInterval: null
};

// ========== ELEMENTS ==========
const els = {
    otpScreen: document.getElementById('otpScreen'),
    requestOtpBtn: document.getElementById('requestOtpBtn'),
    otpInputSection: document.getElementById('otpInputSection'),
    otpInput: document.getElementById('otpInput'),
    verifyOtpBtn: document.getElementById('verifyOtpBtn'),
    otpError: document.getElementById('otpError'),
    
    dashboardScreen: document.getElementById('dashboardScreen'),
    logoutBtn: document.getElementById('logoutBtn'),
    statToday: document.getElementById('statToday'),
    statWeek: document.getElementById('statWeek'),
    statMonth: document.getElementById('statMonth'),
    statYear: document.getElementById('statYear'),
    onlineUsers: document.getElementById('onlineUsers'),
    callHistory: document.getElementById('callHistory'),
    
    callScreen: document.getElementById('callScreen'),
    statusText: document.getElementById('statusText'),
    timer: document.getElementById('timer'),
    remoteVideo: document.getElementById('remoteVideo'),
    localVideo: document.getElementById('localVideo'),
    pipCamera: document.getElementById('pipCamera'),
    customerInfo: document.getElementById('customerInfo'),
    customerName: document.getElementById('customerName'),
    
    videoBtn: document.getElementById('videoBtn'),
    micBtn: document.getElementById('micBtn'),
    speakerBtn: document.getElementById('speakerBtn'),
    proximitySensorBtn: document.getElementById('audioSettingsBtn'),
    endBtn: document.getElementById('endBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    transferBtn: document.getElementById('transferBtn'),

    incomingCallNotification: document.getElementById('incomingCallNotification'),
    incomingCallerName: document.getElementById('incomingCallerName'),
    acceptCallBtn: document.getElementById('acceptCallBtn'),
    rejectCallBtn: document.getElementById('rejectCallBtn'),

    transferModal: document.getElementById('transferModal'),
    transferModalClose: document.getElementById('transferModalClose'),
    adminSelect: document.getElementById('adminSelect'),
    transferConfirmBtn: document.getElementById('transferConfirmBtn'),
    transferCancelBtn: document.getElementById('transferCancelBtn')
};

// ========== OTP FONKSÄ°YONLARI ==========

// OTP Ä°ste
async function requestOtp() {
    console.log('🔐 OTP isteniyor...');
    try {
        els.requestOtpBtn.disabled = true;
        els.requestOtpBtn.textContent = 'Gönderiliyor...';

        const response = await fetch('/api/request-admin-otp', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });

        const data = await response.json();

        if (data.success) {
            els.otpInputSection.classList.remove('hidden');
            els.otpInput.focus();
            notify.success('OTP Gönderildi', 'Telegram\'dan 6 haneli kodu girin');
        } else {
            throw new Error(data.error || 'OTP gönderilemedi');
        }
    } catch (err) {
        notify.error('OTP Hatası', err.message);
        els.requestOtpBtn.disabled = false;
        els.requestOtpBtn.textContent = 'Şifre İste 📱';
    }
}

// OTP Doğrula
async function verifyOtp() {
    const otp = els.otpInput.value.trim();

    // Format kontrolü (6 haneli sayı)
    if (!/^\d{6}$/.test(otp)) {
        notify.warning('Geçersiz Kod', '6 haneli sayı girin');
        return;
    }

    try {
        els.verifyOtpBtn.disabled = true;
        els.verifyOtpBtn.textContent = 'Kontrol ediliyor...';

        const response = await fetch('/api/verify-otp', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ otp })
        });

        const data = await response.json();

        if (data.success) {
            state.authenticated = true;
            notify.success('Giriş Başarılı', 'Admin paneline yönlendiriliyorsunuz...');
            setTimeout(() => showDashboard(), 1000);
        } else {
            throw new Error(data.error || 'Geçersiz OTP');
        }
    } catch (err) {
        notify.error('Doğrulama Hatası', err.message);
        els.verifyOtpBtn.disabled = false;
        els.verifyOtpBtn.textContent = 'Giriş Yap 🔑';
    }
}

// ========== DASHBOARD FONKSÄ°YONLARI ==========

function showDashboard() {
    els.otpScreen.classList.add('hidden');
    els.dashboardScreen.classList.remove('hidden');
    
    initPeer();
    loadStats();
    loadOnlineUsers();
    loadCallHistory();
    
    // Optimize polling intervals
    state.statsInterval = setInterval(loadStats, 60000); // Stats every 1 minute
    checkIncomingCalls(); // Ä°lk kontrol hemen
    state.onlineCheckInterval = setInterval(() => {
        checkIncomingCalls();
        loadOnlineUsers();
    }, 3000); // 3 saniyede bir kontrol
}

async function loadStats() {
    try {
        const response = await fetch('/api/call-logs');
        const data = await response.json();
        
        if (data.success) {
            const logs = data.logs || [];
            const now = new Date();
            
            const today = logs.filter(l => isToday(new Date(l.start_time))).length;
            const week = logs.filter(l => isThisWeek(new Date(l.start_time))).length;
            const month = logs.filter(l => isThisMonth(new Date(l.start_time))).length;
            const year = logs.filter(l => isThisYear(new Date(l.start_time))).length;
            
            els.statToday.textContent = today;
            els.statWeek.textContent = week;
            els.statMonth.textContent = month;
            els.statYear.textContent = year;
        }
    } catch (err) {
        console.error('Stats error:', err);
    }
}

async function loadOnlineUsers() {
    try {
        const response = await fetch('/api/active-calls');
        const data = await response.json();
        
        if (data.success && data.active_calls && data.active_calls.length > 0) {
            document.getElementById('bulkActionsContainer').classList.remove('hidden');
            
            els.onlineUsers.innerHTML = data.active_calls.map(call => {
                const timeAgo = getTimeAgo(call.minutes_ago);
                const statusIcon = call.status === 'online' ? 'ğŸŸ¢' : 'ğŸ”´';
                const statusText = call.status === 'online' ? 'Ã‡evrimiÃ§i' : 'Ã‡evrimdÄ±ÅŸÄ±';
                
                return `
                    <div class="user-card ${call.status}" data-call-id="${call.call_id}">
                        <input type="checkbox" class="user-checkbox" data-call-id="${call.call_id}" onchange="updateBulkActions()">
                        <div class="user-info">
                            <div class="user-avatar">ğŸ‘¤</div>
                            <div class="user-details">
                                <div class="user-name">${call.customer_name}</div>
                                <div class="user-status">${statusIcon} ${statusText}</div>
                                <div class="user-activity">
                                    <div class="activity-time">${call.formatted_date} ${call.formatted_time}</div>
                                    <div class="activity-ago">${timeAgo}</div>
                                </div>
                            </div>
                        </div>
                        <div class="user-actions">
                            <button class="call-user-btn" onclick="callUser('${call.call_id}', '${call.customer_name}')" 
                                    ${call.status !== 'online' ? 'disabled' : ''}>
                                ${call.status === 'online' ? 'Ara ğŸ“' : 'Ã‡evrimdÄ±ÅŸÄ±'}
                            </button>
                            <button class="remove-user-btn" onclick="removeUserActivity('${call.call_id}', '${call.customer_name}')" 
                                    title="KullanÄ±cÄ±yÄ± listeden kaldÄ±r">
                                ğŸ—‘ï¸
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            
            setupBulkActions();
        } else {
            document.getElementById('bulkActionsContainer').classList.add('hidden');
            els.onlineUsers.innerHTML = '<p class="empty-state">KullanÄ±cÄ± yok</p>';
        }
    } catch (err) {
        console.error('Online users error:', err);
    }
}

function getTimeAgo(minutes) {
    if (minutes === 0) {
        return 'Åu anda aktif';
    } else if (minutes === 1) {
        return '1 dakika Ã¶nce';
    } else if (minutes < 60) {
        return `${minutes} dakika Ã¶nce`;
    } else if (minutes < 1440) { // Less than 24 hours
        const hours = Math.floor(minutes / 60);
        return hours === 1 ? '1 saat Ã¶nce' : `${hours} saat Ã¶nce`;
    } else {
        const days = Math.floor(minutes / 1440);
        return days === 1 ? '1 gÃ¼n Ã¶nce' : `${days} gÃ¼n Ã¶nce`;
    }
}

// Tek kullanÄ±cÄ± aktivitesini silme fonksiyonu
window.removeUserActivity = async function(callId, customerName) {
    if (!confirm(`${customerName} kullanÄ±cÄ±sÄ±nÄ± listeden kaldÄ±rmak istediÄŸinizden emin misiniz?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/remove-user-activity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ call_id: callId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // KullanÄ±cÄ± kartÄ±nÄ± DOM'dan kaldÄ±r
            const userCard = document.querySelector(`[data-call-id="${callId}"]`);
            if (userCard) {
                userCard.remove();
            }
            
            const remainingCards = document.querySelectorAll('.user-card');
            if (remainingCards.length === 0) {
                document.getElementById('bulkActionsContainer').classList.add('hidden');
                els.onlineUsers.innerHTML = '<p class="empty-state">KullanÄ±cÄ± yok</p>';
            }
            
            console.log('âœ… KullanÄ±cÄ± baÅŸarÄ±yla kaldÄ±rÄ±ldÄ±:', customerName);
        } else {
            notify.error('Hata', 'KullanÄ±cÄ± kaldÄ±rÄ±lÄ±rken hata oluÅŸtu: ' + (data.error || 'Bilinmeyen hata'));
        }
    } catch (error) {
        console.error('Remove user error:', error);
        notify.error('Hata', 'KullanÄ±cÄ± kaldÄ±rÄ±lÄ±rken hata oluÅŸtu');
    }
}

    function setupBulkActions() {
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        const clearAllBtn = document.getElementById('clearAllBtn');
        const clearCallsBtn = document.getElementById('clearCallsBtn');

        if (bulkDeleteBtn) {
            bulkDeleteBtn.onclick = bulkDeleteUsers;
        }

        if (clearAllBtn) {
            clearAllBtn.onclick = clearAllActivities;
        }

        if (clearCallsBtn) {
            clearCallsBtn.onclick = clearAllActiveCalls;
        }

        updateBulkActions();
    }

    window.updateBulkActions = function() {
        const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        
        if (bulkDeleteBtn) {
            bulkDeleteBtn.disabled = selectedCheckboxes.length === 0;
            bulkDeleteBtn.textContent = selectedCheckboxes.length > 0 
                ? `SeÃ§ilenleri Sil (${selectedCheckboxes.length}) ğŸ—‘ï¸`
                : 'SeÃ§ilenleri Sil ğŸ—‘ï¸';
        }
        
        document.querySelectorAll('.user-card').forEach(card => {
            const checkbox = card.querySelector('.user-checkbox');
            if (checkbox && checkbox.checked) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }

    // SeÃ§ili kullanÄ±cÄ±larÄ± toplu silme
    async function bulkDeleteUsers() {
        const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
        const callIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.callId);
        
        if (callIds.length === 0) {
            notify.warning('SeÃ§im YapÄ±lmadÄ±', 'LÃ¼tfen silmek istediÄŸiniz kullanÄ±cÄ±larÄ± seÃ§in');
            return;
        }
        
        if (!confirm(`${callIds.length} kullanÄ±cÄ±yÄ± listeden kaldÄ±rmak istediÄŸinizden emin misiniz?`)) {
            return;
        }
        
        try {
            const response = await fetch('/api/remove-multiple-activities', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ call_ids: callIds })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // SeÃ§ili kullanÄ±cÄ± kartlarÄ±nÄ± DOM'dan kaldÄ±r
                callIds.forEach(callId => {
                    const userCard = document.querySelector(`[data-call-id="${callId}"]`);
                    if (userCard) {
                        userCard.remove();
                    }
                });
                
                const remainingCards = document.querySelectorAll('.user-card');
                if (remainingCards.length === 0) {
                    document.getElementById('bulkActionsContainer').classList.add('hidden');
                    els.onlineUsers.innerHTML = '<p class="empty-state">KullanÄ±cÄ± yok</p>';
                } else {
                    updateBulkActions();
                }
                
                console.log('âœ… SeÃ§ili kullanÄ±cÄ±lar baÅŸarÄ±yla kaldÄ±rÄ±ldÄ±');
            } else {
                notify.error('Hata', 'KullanÄ±cÄ±lar kaldÄ±rÄ±lÄ±rken hata oluÅŸtu: ' + (data.error || 'Bilinmeyen hata'));
            }
        } catch (error) {
            console.error('Bulk delete error:', error);
            notify.error('Hata', 'KullanÄ±cÄ±lar kaldÄ±rÄ±lÄ±rken hata oluÅŸtu');
        }
    }

    // TÃ¼m aktiviteleri temizleme
    window.clearAllActivities = async function() {
        if (!confirm('TÃœM kullanÄ±cÄ± aktivitelerini temizlemek istediÄŸinizden emin misiniz? Bu iÅŸlem geri alÄ±namaz!')) {
            return;
        }

        try {
            const response = await fetch('/api/clear-all-activities', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();

            if (data.success) {
                document.getElementById('bulkActionsContainer').classList.add('hidden');
                els.onlineUsers.innerHTML = '<p class="empty-state">KullanÄ±cÄ± yok</p>';
                notify.success('Temizlendi', 'TÃ¼m kullanÄ±cÄ± aktiviteleri temizlendi');
                console.log('âœ… TÃ¼m kullanÄ±cÄ± aktiviteleri temizlendi');
            } else {
                notify.error('Hata', 'Aktiviteler temizlenirken hata oluÅŸtu: ' + (data.error || 'Bilinmeyen hata'));
            }
        } catch (error) {
            console.error('Clear all error:', error);
            notify.error('Hata', 'Aktiviteler temizlenirken hata oluÅŸtu');
        }
    }

    // TÃ¼m aktif aramalarÄ± temizleme
    window.clearAllActiveCalls = async function() {
        if (!confirm('TÃœM aktif aramalarÄ± temizlemek istediÄŸinizden emin misiniz? Bu iÅŸlem geri alÄ±namaz!')) {
            return;
        }

        try {
            const response = await fetch('/api/clear-active-calls', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();

            if (data.success) {
                document.getElementById('bulkActionsContainer').classList.add('hidden');
                els.onlineUsers.innerHTML = '<p class="empty-state">KullanÄ±cÄ± yok</p>';
                notify.success('Temizlendi', 'TÃ¼m aktif aramalar temizlendi');
                console.log('âœ… TÃ¼m aktif aramalar temizlendi');
            } else {
                notify.error('Hata', 'Aktif aramalar temizlenirken hata oluÅŸtu: ' + (data.error || 'Bilinmeyen hata'));
            }
        } catch (error) {
            console.error('Clear active calls error:', error);
            notify.error('Hata', 'Aktif aramalar temizlenirken hata oluÅŸtu');
        }
    }
 
 async function loadCallHistory(filter = 'all') {
    try {
        const response = await fetch('/api/call-logs');
        const data = await response.json();
        
        if (data.success && data.logs && data.logs.length > 0) {
            let logs = data.logs;
            
            if (filter === 'today') logs = logs.filter(l => isToday(new Date(l.start_time)));
            else if (filter === 'week') logs = logs.filter(l => isThisWeek(new Date(l.start_time)));
            else if (filter === 'month') logs = logs.filter(l => isThisMonth(new Date(l.start_time)));
            
            if (logs.length === 0) {
                els.callHistory.innerHTML = '<p class="empty-state">Bu filtrede gÃ¶rÃ¼ÅŸme yok</p>';
                return;
            }
            
            els.callHistory.innerHTML = logs.map(log => `
                <div class="history-card">
                    <div class="history-header">
                        <span class="history-name">ğŸ‘¤ ${log.customer_name}</span>
                        <span class="history-duration">â±ï¸ ${log.duration}</span>
                        ${log.has_recording ? `<button class="download-recording-btn" onclick="downloadRecording('${log.recording_id}')" title="Kayıt İndir">ğŸ“·</button>` : ''}
                    </div>
                    <div class="history-details">
                        <span>ğŸ“… ${formatDate(new Date(log.start_time))}</span>
                        <span>ğŸ• ${formatTime(new Date(log.start_time))}</span>
                        <span>âœ… ${log.status}</span>
                    </div>
                </div>
            `).join('');
        } else {
            els.callHistory.innerHTML = '<p class="empty-state">GÃ¶rÃ¼ÅŸme geÃ§miÅŸi yok</p>';
        }
    } catch (err) {
        console.error('Call history error:', err);
    }
}

// ========== ARAMA FONKSÄ°YONLARI ==========

function initPeer() {
    if (typeof Peer === 'undefined') {
        console.warn('PeerJS yok, native WebRTC kullanÄ±lacak');
        return;
    }
    // PeerJS with TURN servers
    state.peer = new Peer('operator', {
        debug: 2,
        config: {
            iceServers: [
                { urls: ['stun:stun.l.google.com:19302'] },
                { urls: ['stun:global.stun.twilio.com:3478?transport=udp'] }
                // Add your TURN servers here:
                // { urls: ['turn:YOUR_TURN_SERVER:3478'], username: 'sohbetson', credential: 'PASSWORD' },
                // { urls: ['turns:YOUR_TURN_SERVER:5349'], username: 'sohbetson', credential: 'PASSWORD' }
            ]
        }
    });
    
    state.peer.on('open', (id) => {
        console.log('ğŸ†” OperatÃ¶r Peer ID:', id);
    });


    state.peer.on('error', (err) => {
        console.error('Peer error:', err);
    });
}



async function acceptCall() {
    if (window.webrtcClient && typeof window.webrtcClient.acceptAdminCall === 'function') {
        window.webrtcClient.acceptAdminCall();
        return;
    }
    els.incomingCallNotification.classList.add('hidden');
    
    // Ã–nceki stream varsa temizle
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
        state.stream = null;
    }
    
    try {
        // Backend'e kabul bildir
        await fetch('/api/update-call-status', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                callId: state.currentCallId,
                status: 'accepted'
            })
        });
        
        // Kamera/mikrofon al
        let hasVideo = false;
        let hasAudio = false;

        try {
            state.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 },
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            hasVideo = true;
            hasAudio = true;
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                notify.error('Ä°zin Gerekli', 'TarayÄ±cÄ± adres Ã§ubuÄŸundaki kilit ikonuna tÄ±klayÄ±p kamera/mikrofon izinlerini aÃ§Ä±n.');
                els.incomingCallNotification.classList.remove('hidden');
                return;
            }

            try {
                state.stream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true }
                });
                hasAudio = true;
                els.pipCamera.style.display = 'none';
            } catch (audioErr) {
                if (audioErr.name === 'NotAllowedError') {
                    notify.error('Ä°zin Gerekli', 'TarayÄ±cÄ± adres Ã§ubuÄŸundaki kilit ikonuna tÄ±klayÄ±p mikrofon izinini aÃ§Ä±n.');
                    els.incomingCallNotification.classList.remove('hidden');
                    return;
                }

                try {
                    state.stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'user', width: 640, height: 480 }
                    });
                    hasVideo = true;
                } catch (videoErr) {
                    if (videoErr.name === 'NotAllowedError') {
                        notify.error('Ä°zin Gerekli', 'TarayÄ±cÄ± adres Ã§ubuÄŸundaki kilit ikonuna tÄ±klayÄ±p kamera izinini aÃ§Ä±n.');
                    } else if (videoErr.name === 'NotFoundError') {
                        notify.error('Cihaz BulunamadÄ±', 'Kamera veya mikrofon bulunamadÄ±.');
                    } else {
                        notify.error('Medya HatasÄ±', 'Kamera/mikrofon eriÅŸimi baÅŸarÄ±sÄ±z: ' + videoErr.message);
                    }

                    els.incomingCallNotification.classList.remove('hidden');
                    return;
                }
            }
        }

        if (!state.stream) {
            notify.error('Hata', 'Medya akÄ±ÅŸÄ± baÅŸlatÄ±lamadÄ±');
            els.incomingCallNotification.classList.remove('hidden');
            return;
        }

        els.localVideo.srcObject = state.stream;
        
        // MÃ¼ÅŸteriye WebRTC Ã¼zerinden ara
        if (state.customerPeerId) {
            console.log(`ğŸ“ MÃ¼ÅŸteriye arama baÅŸlatÄ±lÄ±yor: ${state.customerPeerId}`);
            const call = state.peer.call(state.customerPeerId, state.stream);

            call.on('stream', (remoteStream) => {
                console.log('ğŸ“º MÃ¼ÅŸteri video alÄ±ndÄ±');
                els.remoteVideo.srcObject = remoteStream;
                notify.success('BaÄŸlantÄ± Kuruldu', 'MÃ¼ÅŸteri ile baÄŸlantÄ± saÄŸlandÄ±');
            });
            
            call.on('close', () => {
                console.log('ğŸ“ MÃ¼ÅŸteri aramayÄ± kapattÄ±');
                notify.warning('GÃ¶rÃ¼ÅŸme SonlandÄ±', 'MÃ¼ÅŸteri gÃ¶rÃ¼ÅŸmeyi sonlandÄ±rdÄ±');
                setTimeout(() => endCall(), 2000);
            });
            
            call.on('error', (err) => {
                console.error('ğŸ”´ Call error:', err);
                notify.error('BaÄŸlantÄ± HatasÄ±', 'MÃ¼ÅŸteri ile baÄŸlantÄ± kurulamadÄ±');
            });
            
            state.call = call;
        } else {
            console.error('âŒ customerPeerId yok!');
            notify.error('Hata', 'MÃ¼ÅŸteri bilgisi bulunamadÄ±');
            
            if (state.stream) {
                state.stream.getTracks().forEach(track => track.stop());
                state.stream = null;
            }
            
            els.incomingCallNotification.classList.remove('hidden');
            return;
        }
        
        els.customerName.textContent = state.currentCustomer;
        showCallScreen();
        
    } catch (err) {
        console.error('ğŸ”´ Accept call error:', err);
        notify.error('Arama HatasÄ±', 'Arama baÅŸlatÄ±lamadÄ±: ' + err.message);
        
        if (state.stream) {
            state.stream.getTracks().forEach(track => track.stop());
            state.stream = null;
        }
        
        els.incomingCallNotification.classList.remove('hidden');
    }
}

async function rejectCall() {
    els.incomingCallNotification.classList.add('hidden');
    
    try {
        await fetch('/api/update-call-status', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                callId: state.currentCallId,
                status: 'rejected'
            })
        });
        
        // EÄŸer bir stream baÅŸlatÄ±lmÄ±ÅŸsa temizle
        if (state.stream) {
            state.stream.getTracks().forEach(track => track.stop());
            state.stream = null;
        }
        
        state.currentCallId = null;
        state.currentCustomer = null;
        state.customerPeerId = null;
        
        console.log('âŒ Arama reddedildi');
    } catch (err) {
        console.error('Reject call error:', err);
    }
}

function showCallScreen() {
    els.dashboardScreen.classList.add('hidden');
    els.callScreen.classList.remove('hidden');
    startTimer();
}

async function endCall() {
    if (!confirm('GÃ¶rÃ¼ÅŸmeyi sonlandÄ±rmak istediÄŸinize emin misiniz?')) return;

    // Save call recording before ending
    if (window.webrtcClient && typeof window.webrtcClient.saveCallRecording === 'function') {
        const duration = Math.floor((Date.now() - state.startTime) / 1000);
        await window.webrtcClient.saveCallRecording(
            state.currentCallId,
            state.currentCustomer,
            duration
        );
    }

    // Signaling tarafÄ±na hangup gÃ¶nder
    if (window.webrtcClient && typeof window.webrtcClient.hangup === 'function') {
        window.webrtcClient.hangup();
    }

    // Backend'e bildir
    if (state.currentCallId) {
        try {
            await fetch('/api/update-call-status', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    callId: state.currentCallId,
                    status: 'ended'
                })
            });
        } catch (err) {
            console.error('End call error:', err);
        }
    }
    
    // Timer'Ä± durdur
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    
    // WebRTC baÄŸlantÄ±sÄ±nÄ± kapat
    if (state.call) {
        state.call.close();
        state.call = null;
    }
    
    // Medya stream'lerini temizle
    if (state.stream) {
        state.stream.getTracks().forEach(track => {
            track.stop();
            console.log(`ğŸ›‘ Track durduruldu: ${track.kind}`);
        });
        state.stream = null;
    }
    
    // Video elementlerini temizle
    if (els.localVideo.srcObject) {
        els.localVideo.srcObject.getTracks().forEach(track => track.stop());
        els.localVideo.srcObject = null;
    }

    if (els.remoteVideo.srcObject) {
        els.remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        els.remoteVideo.srcObject = null;
    }
    
    // State'i sÄ±fÄ±rla
    state.currentCallId = null;
    state.currentCustomer = null;
    state.customerPeerId = null;
    state.videoEnabled = true;
    state.audioEnabled = true;
    state.speakerEnabled = true;
    state.proximitySensorMode = false;
    
    // UI'Ä± sÄ±fÄ±rla
    els.remoteVideo.muted = false;
    els.callScreen.classList.add('hidden');
    els.dashboardScreen.classList.remove('hidden');
    els.timer.textContent = '00:00';
    els.videoBtn.classList.remove('off');
    els.micBtn.classList.remove('off');
    els.speakerBtn.classList.remove('off');
    els.proximitySensorBtn.classList.remove('off');
    els.pipCamera.style.display = '';
    els.pipCamera.style.opacity = '1';
    els.pipCamera.style.filter = 'none';
    
    console.log('âœ… GÃ¶rÃ¼ÅŸme sonlandÄ±rÄ±ldÄ±, tÃ¼m kaynaklar temizlendi');
    
    loadStats();
    loadCallHistory();
}

async function checkIncomingCalls() {
    try {
        const response = await fetch('/api/active-calls');
        const data = await response.json();
        
        if (data.success && data.active_calls && data.active_calls.length > 0) {
            // Online olan ve henÃ¼z aranmamÄ±ÅŸ kullanÄ±cÄ±larÄ± bul
            const onlineCalls = data.active_calls.filter(c => 
                c.status === 'online' && 
                c.customer_peer_id && 
                !state.call && 
                !state.currentCallId
            );
            
            if (onlineCalls.length > 0) {
                const call = onlineCalls[0];
                state.currentCallId = call.call_id;
                state.currentCustomer = call.customer_name;
                state.customerPeerId = call.customer_peer_id;
                
                els.incomingCallerName.textContent = call.customer_name;
                els.incomingCallNotification.classList.remove('hidden');
                
                notify.call('Gelen Arama', `${call.customer_name} sizi arÄ±yor!`, null, 0);
            }
        }
    } catch (err) {
        console.error('Check calls error:', err);
    }
}

// ========== KONTROL FONKSÄ°YONLARI ==========

function startTimer() {
    state.startTime = Date.now();
    state.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        els.timer.textContent = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    }, 1000);
}

function toggleVideo() {
    if (!state.stream) return;
    const videoTracks = state.stream.getVideoTracks();
    if (videoTracks.length === 0) {
        notify.info('Sadece Ses Modu', 'Video yok - sadece ses modu aktif');
        return;
    }
    state.videoEnabled = !state.videoEnabled;
    videoTracks.forEach(t => t.enabled = state.videoEnabled);
    els.videoBtn.classList.toggle('off', !state.videoEnabled);
    els.pipCamera.style.opacity = state.videoEnabled ? '1' : '0.3';
    els.pipCamera.style.filter = state.videoEnabled ? 'none' : 'grayscale(1)';
}

function toggleMic() {
    if (!state.stream) return;
    const audioTracks = state.stream.getAudioTracks();
    if (audioTracks.length === 0) {
        notify.info('Sadece Video Modu', 'Mikrofon yok - sadece video modu aktif');
        return;
    }
    state.audioEnabled = !state.audioEnabled;
    audioTracks.forEach(t => t.enabled = state.audioEnabled);
    els.micBtn.classList.toggle('off', !state.audioEnabled);
}

function toggleSpeaker() {
    state.speakerEnabled = !state.speakerEnabled;
    els.remoteVideo.muted = !state.speakerEnabled;
    els.speakerBtn.classList.toggle('off', !state.speakerEnabled);
    
    if (!state.speakerEnabled && state.proximitySensorMode) {
        toggleProximitySensor();
    }
}

function toggleFullscreen() {
    const elem = els.callScreen;
    
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement) {
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
            elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }
        els.fullscreenBtn.classList.add('active');
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        els.fullscreenBtn.classList.remove('active');
    }
}

function toggleProximitySensor() {
    state.proximitySensorMode = !state.proximitySensorMode;
    els.proximitySensorBtn.classList.toggle('off', !state.proximitySensorMode);
    
    console.log('ğŸ“± YakÄ±nlÄ±k SensÃ¶rÃ¼:', state.proximitySensorMode ? 'AÃ§Ä±k' : 'KapalÄ±');
    
    if (state.proximitySensorMode) {
        if (state.speakerEnabled) {
            state.speakerEnabled = false;
            els.remoteVideo.muted = true;
            els.speakerBtn.classList.add('off');
        }
        
        const videoTracks = state.stream.getVideoTracks();
        if (state.videoEnabled && videoTracks.length > 0) {
            state.videoEnabled = false;
            videoTracks.forEach(t => t.enabled = false);
            els.videoBtn.classList.add('off');
            els.pipCamera.style.opacity = '0.3';
            els.pipCamera.style.filter = 'grayscale(1)';
        }
    }
}

function logout() {
    if (!confirm('Ã‡Ä±kÄ±ÅŸ yapmak istediÄŸinize emin misiniz?')) return;
    
    if (state.statsInterval) clearInterval(state.statsInterval);
    if (state.onlineCheckInterval) clearInterval(state.onlineCheckInterval);
    if (state.peer) state.peer.destroy();
    
    state.authenticated = false;
    els.dashboardScreen.classList.add('hidden');
    els.otpScreen.classList.remove('hidden');
    els.otpInput.value = '';
    els.otpInputSection.classList.add('hidden');
    els.requestOtpBtn.disabled = false;
    els.requestOtpBtn.textContent = 'Åifre Ä°ste ğŸ“±';
}

// ========== YARDIMCI FONKSÄ°YONLAR ==========

function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

function isThisWeek(date) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return date >= weekAgo && date <= now;
}

function isThisMonth(date) {
    const now = new Date();
    return date.getMonth() === now.getMonth() &&
           date.getFullYear() === now.getFullYear();
}

function isThisYear(date) {
    const now = new Date();
    return date.getFullYear() === now.getFullYear();
}

function formatDate(date) {
    return date.toLocaleDateString('tr-TR');
}

function formatTime(date) {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// ========== EVENT LISTENERS ==========

els.requestOtpBtn.addEventListener('click', requestOtp);
els.verifyOtpBtn.addEventListener('click', verifyOtp);
els.otpInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') verifyOtp();
});

els.logoutBtn.addEventListener('click', logout);

// Ä°zin kontrol butonu
const checkPermissionsBtn = document.getElementById('checkPermissionsBtn');
if (checkPermissionsBtn) {
    checkPermissionsBtn.addEventListener('click', async () => {
        try {
            // Ä°zin durumlarÄ±nÄ± kontrol et
            let cameraStatus = 'âŒ Bilinmiyor';
            let micStatus = 'âŒ Bilinmiyor';
            
            try {
                const permissions = await Promise.all([
                    navigator.permissions.query({ name: 'camera' }),
                    navigator.permissions.query({ name: 'microphone' })
                ]);
                
                const cameraState = permissions[0].state;
                const micState = permissions[1].state;
                
                cameraStatus = cameraState === 'granted' ? 'âœ… Ä°zin verildi' : 
                              cameraState === 'denied' ? 'âŒ Reddedildi' : 'âš ï¸ SorulmadÄ±';
                              
                micStatus = micState === 'granted' ? 'âœ… Ä°zin verildi' : 
                           micState === 'denied' ? 'âŒ Reddedildi' : 'âš ï¸ SorulmadÄ±';
                           
                console.log(`ğŸ“¹ Kamera: ${cameraState}, ğŸ¤ Mikrofon: ${micState}`);
            } catch (e) {
                console.log('âš ï¸ Ä°zin API desteklenmiyor, medya eriÅŸimi deneniyor...');
            }
            
            // Test amaÃ§lÄ± medya eriÅŸimi dene
            try {
                const testStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                
                testStream.getTracks().forEach(track => track.stop());
                
                notify.success('Ä°zinler Tamam', `Kamera: ${cameraStatus}\nMikrofon: ${micStatus}\n\nâœ… Medya eriÅŸimi baÅŸarÄ±lÄ±!`);
            } catch (err) {
                if (err.name === 'NotAllowedError') {
                    notify.error('Ä°zin Reddedildi', `Kamera: ${cameraStatus}\nMikrofon: ${micStatus}\n\nTarayÄ±cÄ± adres Ã§ubuÄŸundaki kilit ikonuna tÄ±klayÄ±p izinleri aÃ§Ä±n.`);
                } else if (err.name === 'NotFoundError') {
                    notify.error('Cihaz BulunamadÄ±', 'Kamera veya mikrofon baÄŸlÄ± deÄŸil.');
                } else {
                    notify.error('Medya HatasÄ±', `${err.name}: ${err.message}`);
                }
            }
        } catch (err) {
            console.error('Ä°zin kontrol hatasÄ±:', err);
            notify.error('Hata', 'Ä°zin kontrolÃ¼ baÅŸarÄ±sÄ±z: ' + err.message);
        }
    });
}

els.acceptCallBtn.addEventListener('click', () => {
    if (window.webrtcClient && typeof window.webrtcClient.acceptAdminCall === 'function') {
        window.webrtcClient.acceptAdminCall();
    } else {
        acceptCall();
    }
});
els.rejectCallBtn.addEventListener('click', rejectCall);

els.videoBtn.addEventListener('click', toggleVideo);
els.micBtn.addEventListener('click', toggleMic);
els.speakerBtn.addEventListener('click', toggleSpeaker);
els.proximitySensorBtn.addEventListener('click', toggleProximitySensor);
els.endBtn.addEventListener('click', endCall);
els.fullscreenBtn.addEventListener('click', toggleFullscreen);

// Transfer modal event listeners
els.transferBtn.addEventListener('click', showTransferModal);
els.transferModalClose.addEventListener('click', hideTransferModal);
els.transferCancelBtn.addEventListener('click', hideTransferModal);
els.transferConfirmBtn.addEventListener('click', confirmTransferCall);

// Fullscreen change listeners (cross-browser)
const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
fullscreenEvents.forEach(event => {
    document.addEventListener(event, () => {
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || 
                            document.mozFullScreenElement || document.msFullscreenElement;
        if (!isFullscreen) {
            els.fullscreenBtn.classList.remove('active');
        }
    });
});

// Filter tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadCallHistory(btn.dataset.filter);
    });
});

// Session check
async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        
        if (data.success && data.authenticated) {
            showDashboard();
        }
    } catch (err) {
        console.error('Session check error:', err);
    }
}

checkSession();

// callUser fonksiyonu - Ã‡evrimiÃ§i kullanÄ±cÄ±ya arama baÅŸlat
window.callUser = async function(callId, customerName) {
    if (state.call) {
        notify.warning('GÃ¶rÃ¼ÅŸme Devam Ediyor', 'Zaten bir gÃ¶rÃ¼ÅŸme devam ediyor!');
        return;
    }
    
    if (state.currentCallId) {
        notify.warning('Arama Devam Ediyor', 'Zaten bir arama iÅŸlemi devam ediyor!');
        return;
    }
    
    try {
        const response = await fetch(`/api/call-status/${callId}`);
        const data = await response.json();
        
        if (data.success && data.customer_peer_id) {
            state.currentCallId = callId;
            state.currentCustomer = data.customerName || customerName;
            state.customerPeerId = data.customer_peer_id;
            
            els.incomingCallerName.textContent = state.currentCustomer;
            els.incomingCallNotification.classList.remove('hidden');
        } else {
            notify.error('Hata', 'KullanÄ±cÄ± bilgisi alÄ±namadÄ±');
        }
    } catch (err) {
        console.error('Call user error:', err);
        notify.error('Arama HatasÄ±', 'Arama baÅŸlatÄ±lamadÄ±');
    }
};

// Transfer modal functions
function showTransferModal() {
    if (!state.currentCallId) {
        notify.warning('Aktif Görüşme Yok', 'Transfer etmek için aktif bir görüşme olmalı');
        return;
    }

    // Load available admins
    loadAvailableAdmins();
    els.transferModal.classList.remove('hidden');
}

function hideTransferModal() {
    els.transferModal.classList.add('hidden');
    els.adminSelect.value = '';
}

async function loadAvailableAdmins() {
    try {
        // For now, we'll simulate admin list - in real implementation, this would come from backend
        const admins = [
            { id: 'admin1', name: 'Admin 1' },
            { id: 'admin2', name: 'Admin 2' },
            { id: 'admin3', name: 'Admin 3' }
        ];

        els.adminSelect.innerHTML = '<option value="">Admin seçin...</option>';
        admins.forEach(admin => {
            const option = document.createElement('option');
            option.value = admin.id;
            option.textContent = admin.name;
            els.adminSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Load admins error:', error);
        notify.error('Hata', 'Admin listesi yüklenirken hata oluştu');
    }
}

async function confirmTransferCall() {
    const targetAdminId = els.adminSelect.value;
    if (!targetAdminId) {
        notify.warning('Admin Seçilmedi', 'Lütfen transfer edilecek admini seçin');
        return;
    }

    if (!confirm('Bu görüşmeyi başka bir admin\'e transfer etmek istediğinizden emin misiniz?')) {
        return;
    }

    try {
        // Send transfer request via WebSocket
        if (window.webrtcClient && typeof window.webrtcClient.transferCall === 'function') {
            await window.webrtcClient.transferCall(state.currentCallId, targetAdminId);
        } else {
            // Fallback: send via HTTP
            const response = await fetch('/api/transfer-call', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    call_id: state.currentCallId,
                    target_admin_id: targetAdminId
                })
            });

            const data = await response.json();
            if (data.success) {
                notify.success('Transfer Başarılı', 'Görüşme başka admin\'e transfer edildi');
                hideTransferModal();
                // End current call
                setTimeout(() => endCall(), 2000);
            } else {
                throw new Error(data.error || 'Transfer başarısız');
            }
        }
    } catch (error) {
        console.error('Transfer error:', error);
        notify.error('Transfer Hatası', 'Görüşme transfer edilemedi');
    }
}

// Download recording function
window.downloadRecording = async function(recordingId) {
    try {
        const response = await fetch(`/api/download-recording/${recordingId}`);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `call_recording_${recordingId}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            notify.success('İndirme Başarılı', 'Kayıt indirildi');
        } else {
            notify.error('İndirme Hatası', 'Kayıt bulunamadı');
        }
    } catch (error) {
        console.error('Download error:', error);
        notify.error('Hata', 'Kayıt indirilirken hata oluştu');
    }
};

console.log('✅ Operatör Panel Hazır');
