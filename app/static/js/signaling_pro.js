// WebRTC Signaling Client - Admin Pro Version
class WebRTCSignaling {
    constructor() {
        this.ws = null;
        this.pc = null;
        this.localStream = null;
        this.isAdmin = window.location.pathname.includes('admin');
        this.callId = null;
        this.clientId = null;
        this.statsInterval = null;
    }

    connect(url = 'ws://localhost:8081/ws/admin') {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('✅ WebSocket bağlandı');
        };

        this.ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            await this.handleMessage(data);
        };

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket hatası:', error);
        };

        this.ws.onclose = () => {
            console.log('🔌 WebSocket bağlantısı kapandı');
            this.cleanup();
        };
    }

    async handleMessage(data) {
        console.log('📨 Mesaj alındı:', data.type);

        switch(data.type) {
            case 'new_call':
                this.handleNewCall(data);
                break;
            case 'answer':
                await this.handleAnswer(data.answer);
                break;
            case 'ice_candidate':
                await this.handleIceCandidate(data.candidate);
                break;
            case 'hangup':
                this.handleHangup();
                break;
            case 'call_accepted':
                this.handleCallAccepted(data);
                break;
            case 'call_transfer':
                this.handleCallTransfer(data);
                break;
        }
    }

    handleNewCall(data) {
        console.log('📞 Yeni arama:', data);
        // Admin panelinde gösterilecek
        if (window.showIncomingCall) {
            window.showIncomingCall(data.call_id, data.customer_name);
        }
    }

    handleCallAccepted(data) {
        console.log('✅ Arama kabul edildi:', data.call_id);
        // Görüşme başlat
        if (window.startCall) {
            window.startCall(data.call_id);
        }
    }

    async acceptAdminCall(callId, clientId) {
        this.callId = callId;
        this.clientId = clientId;

        // WebRTC bağlantısı başlat
        await this.startWebRTC();

        // Admin kabul ettiğini bildir
        this.send({
            type: 'accept_call',
            call_id: callId
        });

        // Offer gönder
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);

        this.send({
            type: 'offer',
            offer: offer,
            call_id: callId,
            client_id: clientId
        });
    }

    async startWebRTC() {
        this.pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        });

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.send({
                    type: 'ice_candidate',
                    candidate: event.candidate,
                    call_id: this.callId
                });
            }
        };

        this.pc.ontrack = (event) => {
            console.log('📺 Remote stream alındı');
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo) {
                remoteVideo.srcObject = event.streams[0];
            }
        };

        // WebRTC istatistikleri
        this.startStatsMonitoring();
    }

    async handleAnswer(answer) {
        if (this.pc) {
            await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
    }

    async handleIceCandidate(candidate) {
        if (this.pc && candidate) {
            await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    }

    handleHangup() {
        console.log('📞 Görüşme sonlandırıldı');
        this.cleanup();
    }

    handleCallTransfer(data) {
        console.log('👥 Çağrı transfer edildi:', data);
        // Transfer sonrası cleanup
        this.cleanup();
        // UI güncellemesi
        if (window.handleCallTransfer) {
            window.handleCallTransfer(data);
        }
    }

    async startCall(stream) {
        this.localStream = stream;
        if (this.pc && this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.pc.addTrack(track, this.localStream);
            });
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    hangup() {
        this.send({
            type: 'hangup',
            call_id: this.callId
        });
        this.cleanup();
    }

    transferCall(targetAdminId) {
        this.send({
            type: 'transfer_call',
            call_id: this.callId,
            target_admin_id: targetAdminId,
            from_admin_id: 'admin1' // Geçici olarak sabit, dinamik yapılabilir
        });
        this.cleanup();
    }

    cleanup() {
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
        this.callId = null;
        this.clientId = null;
    }

    startStatsMonitoring() {
        this.statsInterval = setInterval(async () => {
            if (this.pc) {
                try {
                    const stats = await this.pc.getStats();
                    this.processStats(stats);
                } catch (e) {
                    console.warn('Stats error:', e);
                }
            }
        }, 2000);
    }

    processStats(stats) {
        let videoBitrate = 0;
        let audioBitrate = 0;
        let packetsLost = 0;
        let roundTripTime = 0;

        stats.forEach(report => {
            if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
                videoBitrate = report.bytesSent ? (report.bytesSent * 8) / 2 : 0;
            }
            if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
                audioBitrate = report.bytesSent ? (report.bytesSent * 8) / 2 : 0;
            }
            if (report.type === 'remote-inbound-rtp') {
                packetsLost = report.packetsLost || 0;
            }
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                roundTripTime = report.currentRoundTripTime * 1000 || 0;
            }
        });

        // İstatistikleri göster
        this.updateStatsDisplay({
            videoBitrate: Math.round(videoBitrate),
            audioBitrate: Math.round(audioBitrate),
            packetsLost,
            roundTripTime: Math.round(roundTripTime)
        });
    }

    updateStatsDisplay(stats) {
        const statsEl = document.getElementById('webrtcStats');
        if (statsEl) {
            // Kalite değerlendirmesi yap
            const quality = window.qualityMonitor ? window.qualityMonitor.assessQuality(stats) : null;

            const getQualityIndicator = (metric, value) => {
                if (!quality) return '';

                const qualityLevel = quality[metric];
                const color = window.qualityMonitor.getQualityColor(qualityLevel);
                const icon = window.qualityMonitor.getQualityIcon(qualityLevel);

                return `<span style="color: ${color}; margin-left: 5px;">${icon}</span>`;
            };

            statsEl.innerHTML = `
                <div class="stat-item">📹 Video: ${stats.videoBitrate} kbps ${getQualityIndicator('video', stats.videoBitrate)}</div>
                <div class="stat-item">🎤 Ses: ${stats.audioBitrate} kbps ${getQualityIndicator('audio', stats.audioBitrate)}</div>
                <div class="stat-item">📊 Kayıp: ${stats.packetsLost} ${getQualityIndicator('network', stats.packetsLost)}</div>
                <div class="stat-item">⏱️ Gecikme: ${stats.roundTripTime}ms ${getQualityIndicator('network', stats.roundTripTime)}</div>
            `;
        }
        // Store stats for recording
        this.lastStats = stats;
    }

    async saveCallRecording(callId, customerName, duration) {
        if (!this.lastStats) {
            console.warn('No stats available for recording');
            return;
        }

        const recordingData = {
            call_id: callId,
            customer_name: customerName,
            start_time: new Date(Date.now() - duration * 1000).toISOString(),
            end_time: new Date().toISOString(),
            duration: duration,
            webrtc_stats: this.lastStats,
            connection_info: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                connection: navigator.connection ? {
                    effectiveType: navigator.connection.effectiveType,
                    downlink: navigator.connection.downlink
                } : null
            }
        };

        try {
            // Save via HTTP API
            const response = await fetch('/api/save-call-recording', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    call_id: callId,
                    recording_data: recordingData
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log('✅ Call recording saved:', result.recording_id);
            } else {
                console.error('❌ Failed to save recording:', result.error);
            }
        } catch (error) {
            console.error('❌ Recording save error:', error);
        }
    }
}

// Global instance
window.webrtcClient = new WebRTCSignaling();
