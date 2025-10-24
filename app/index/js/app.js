(function() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    const callScreen = document.getElementById('callScreen');
    const nameInput = document.getElementById('nameInput');
    const startBtn = document.getElementById('startBtn');

    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');

    const videoBtn = document.getElementById('videoBtn');
    const micBtn = document.getElementById('micBtn');
    const speakerBtn = document.getElementById('speakerBtn');
    const endBtn = document.getElementById('endBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const audioSettingsBtn = document.getElementById('audioSettingsBtn');

    let localStream = null;
    let videoEnabled = true;
    let audioEnabled = true;
    let speakerEnabled = true;
    let callStartTime = null;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    function formatTime(ms) {
        if (!ms) return '00:00';
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const rs = s % 60;
        return `${String(m).padStart(2, '0')}:${String(rs).padStart(2, '0')}`;
    }

    function updateTimer() {
        const timer = document.getElementById('timer');
        if (!timer || !callStartTime) return;
        timer.textContent = formatTime(Date.now() - callStartTime);
    }

    function showLoading(text) {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.querySelector('.loading-text');
        if (!overlay || !loadingText) return;
        loadingText.textContent = text || 'Bağlanıyor...';
        overlay.classList.remove('hidden');
    }

    function hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) return;
        overlay.classList.add('hidden');
    }

    async function initMedia() {
        try {
            showLoading('Kamera ve mikrofon erişimi isteniyor...');
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localVideo.srcObject = localStream;
            localVideo.play();
            hideLoading();
            Notifications.success('Kamera ve mikrofon hazır');
        } catch (err) {
            console.error(err);
            hideLoading();
            Notifications.error('Kamera/mikrofon izni reddedildi veya bulunamadı');
        }
    }

    function toggleVideo() {
        videoEnabled = !videoEnabled;
        videoBtn.classList.toggle('off', !videoEnabled);
        if (localStream) {
            localStream.getVideoTracks().forEach(t => t.enabled = videoEnabled);
        }
    }

    function toggleMic() {
        audioEnabled = !audioEnabled;
        micBtn.classList.toggle('off', !audioEnabled);
        if (localStream) {
            localStream.getAudioTracks().forEach(t => t.enabled = audioEnabled);
        }
    }

    function toggleSpeaker() {
        speakerEnabled = !speakerEnabled;
        speakerBtn.classList.toggle('off', !speakerEnabled);
        remoteVideo.muted = !speakerEnabled;
    }

    function endCall() {
        if (window.webrtcClient && typeof window.webrtcClient.hangup === 'function') {
            window.webrtcClient.hangup();
        }
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
            localStream = null;
        }
        callStartTime = null;
        welcomeScreen.classList.remove('hidden');
        callScreen.classList.add('hidden');
        Notifications.info('Görüşme sonlandırıldı');
    }

    function toggleFullscreen() {
        const container = document.querySelector('.video-container');
        if (!container) return;
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(() => {});
            fullscreenBtn.classList.add('active');
        } else {
            document.exitFullscreen().catch(() => {});
            fullscreenBtn.classList.remove('active');
        }
    }

    function onMouseDown(e) {
        dragging = true;
        const rect = e.currentTarget.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
    }

    function onMouseMove(e) {
        if (!dragging) return;
        const pip = e.currentTarget;
        const containerRect = document.querySelector('.video-container').getBoundingClientRect();
        let left = e.clientX - containerRect.left - offsetX;
        let top = e.clientY - containerRect.top - offsetY;
        left = Math.max(0, Math.min(left, containerRect.width - pip.offsetWidth));
        top = Math.max(0, Math.min(top, containerRect.height - pip.offsetHeight));
        pip.style.left = left + 'px';
        pip.style.top = top + 'px';
    }

    function onMouseUp() {
        dragging = false;
    }

    function initDragging() {
        const pip = document.getElementById('pipCamera');
        if (!pip) return;
        pip.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove.bind(pip));
        document.addEventListener('mouseup', onMouseUp);
        pip.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            dragging = true;
            const rect = pip.getBoundingClientRect();
            offsetX = touch.clientX - rect.left;
            offsetY = touch.clientY - rect.top;
        });
        document.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            const touch = e.touches[0];
            const containerRect = document.querySelector('.video-container').getBoundingClientRect();
            let left = touch.clientX - containerRect.left - offsetX;
            let top = touch.clientY - containerRect.top - offsetY;
            left = Math.max(0, Math.min(left, containerRect.width - pip.offsetWidth));
            top = Math.max(0, Math.min(top, containerRect.height - pip.offsetHeight));
            pip.style.left = left + 'px';
            pip.style.top = top + 'px';
        }, { passive: true });
        document.addEventListener('touchend', () => dragging = false);
    }

    function startCall() {
        if (!nameInput.value.trim()) {
            Notifications.warning('Lütfen adınızı girin');
            return;
        }
        welcomeScreen.classList.add('hidden');
        callScreen.classList.remove('hidden');
        callStartTime = Date.now();
        initMedia();
        if (window.webrtcClient && typeof window.webrtcClient.startClientCall === 'function') {
            window.webrtcClient.startClientCall();
        }
        initDragging();
        setInterval(updateTimer, 1000);
        Notifications.call(`${nameInput.value} ile arama başlatıldı`);
    }

    if (nameInput) {
        nameInput.addEventListener('input', () => {
            startBtn.disabled = !nameInput.value.trim();
        });
    }

    if (startBtn) startBtn.addEventListener('click', startCall);
    if (videoBtn) videoBtn.addEventListener('click', toggleVideo);
    if (micBtn) micBtn.addEventListener('click', toggleMic);
    if (speakerBtn) speakerBtn.addEventListener('click', toggleSpeaker);
    if (endBtn) endBtn.addEventListener('click', endCall);
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
})();
