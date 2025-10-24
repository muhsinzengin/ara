// WebRTC Call Quality Monitor
class QualityMonitor {
    constructor() {
        this.qualityThresholds = {
            videoBitrate: {
                excellent: 1000,  // kbps
                good: 500,
                poor: 100,
                critical: 50
            },
            audioBitrate: {
                excellent: 64,   // kbps
                good: 32,
                poor: 16,
                critical: 8
            },
            packetLoss: {
                excellent: 0.1,  // %
                good: 1,
                poor: 5,
                critical: 10
            },
            roundTripTime: {
                excellent: 50,   // ms
                good: 150,
                poor: 300,
                critical: 500
            }
        };

        this.currentQuality = {
            overall: 'unknown',
            video: 'unknown',
            audio: 'unknown',
            network: 'unknown'
        };

        this.alertHistory = [];
        this.audioContext = null;
        this.isMuted = false;
        this.lastAlertTime = 0;
        this.alertCooldown = 5000; // 5 seconds between alerts
    }

    // Kalite değerlendirme
    assessQuality(stats) {
        const videoQuality = this.assessVideoQuality(stats.videoBitrate);
        const audioQuality = this.assessAudioQuality(stats.audioBitrate);
        const networkQuality = this.assessNetworkQuality(stats.packetLoss, stats.roundTripTime);

        // Genel kalite en kötü olan metrikten belirlenir
        const qualities = [videoQuality, audioQuality, networkQuality];
        const overallQuality = this.getWorstQuality(qualities);

        const newQuality = {
            overall: overallQuality,
            video: videoQuality,
            audio: audioQuality,
            network: networkQuality,
            timestamp: Date.now(),
            stats: stats
        };

        // Kalite değişikliği varsa uyarı oluştur
        if (this.hasQualityChanged(newQuality)) {
            this.handleQualityChange(newQuality);
        }

        this.currentQuality = newQuality;
        return newQuality;
    }

    assessVideoQuality(bitrate) {
        if (bitrate >= this.qualityThresholds.videoBitrate.excellent) return 'excellent';
        if (bitrate >= this.qualityThresholds.videoBitrate.good) return 'good';
        if (bitrate >= this.qualityThresholds.videoBitrate.poor) return 'poor';
        if (bitrate >= this.qualityThresholds.videoBitrate.critical) return 'critical';
        return 'disconnected';
    }

    assessAudioQuality(bitrate) {
        if (bitrate >= this.qualityThresholds.audioBitrate.excellent) return 'excellent';
        if (bitrate >= this.qualityThresholds.audioBitrate.good) return 'good';
        if (bitrate >= this.qualityThresholds.audioBitrate.poor) return 'poor';
        if (bitrate >= this.qualityThresholds.audioBitrate.critical) return 'critical';
        return 'disconnected';
    }

    assessNetworkQuality(packetLoss, rtt) {
        const lossQuality = packetLoss <= this.qualityThresholds.packetLoss.excellent ? 'excellent' :
                           packetLoss <= this.qualityThresholds.packetLoss.good ? 'good' :
                           packetLoss <= this.qualityThresholds.packetLoss.poor ? 'poor' :
                           packetLoss <= this.qualityThresholds.packetLoss.critical ? 'critical' : 'disconnected';

        const rttQuality = rtt <= this.qualityThresholds.roundTripTime.excellent ? 'excellent' :
                          rtt <= this.qualityThresholds.roundTripTime.good ? 'good' :
                          rtt <= this.qualityThresholds.roundTripTime.poor ? 'poor' :
                          rtt <= this.qualityThresholds.roundTripTime.critical ? 'critical' : 'disconnected';

        return this.getWorstQuality([lossQuality, rttQuality]);
    }

    getWorstQuality(qualities) {
        const order = ['excellent', 'good', 'poor', 'critical', 'disconnected'];
        let worstIndex = 0;

        qualities.forEach(quality => {
            const index = order.indexOf(quality);
            if (index > worstIndex) worstIndex = index;
        });

        return order[worstIndex];
    }

    hasQualityChanged(newQuality) {
        return this.currentQuality.overall !== newQuality.overall ||
               this.currentQuality.video !== newQuality.video ||
               this.currentQuality.audio !== newQuality.audio ||
               this.currentQuality.network !== newQuality.network;
    }

    handleQualityChange(newQuality) {
        const alert = {
            type: 'quality_change',
            quality: newQuality,
            previousQuality: this.currentQuality,
            timestamp: Date.now()
        };

        this.alertHistory.push(alert);

        // Kritik uyarılar için ses çal
        if (newQuality.overall === 'critical' || newQuality.overall === 'disconnected') {
            this.playAlertSound();
        }

        // Görsel uyarı göster
        this.showQualityAlert(newQuality);

        // Backend'e uyarıyı kaydet
        this.saveAlertToBackend(alert);

        console.log('🔥 Kalite uyarısı:', newQuality);
    }

    showQualityAlert(quality) {
        const alertEl = document.getElementById('qualityAlert');
        if (!alertEl) return;

        const qualityConfig = {
            excellent: { icon: '✅', color: '#4CAF50', text: 'Mükemmel' },
            good: { icon: '👍', color: '#8BC34A', text: 'İyi' },
            poor: { icon: '⚠️', color: '#FF9800', text: 'Zayıf' },
            critical: { icon: '🚨', color: '#F44336', text: 'Kritik' },
            disconnected: { icon: '❌', color: '#9C27B0', text: 'Bağlantı Kesildi' },
            unknown: { icon: '❓', color: '#9E9E9E', text: 'Bilinmiyor' }
        };

        const config = qualityConfig[quality.overall] || qualityConfig.unknown;

        alertEl.innerHTML = `
            <div class="quality-alert-content" style="background: ${config.color}20; border-left: 4px solid ${config.color};">
                <span class="quality-icon">${config.icon}</span>
                <div class="quality-info">
                    <div class="quality-text">${config.text} Bağlantı Kalitesi</div>
                    <div class="quality-details">
                        Video: ${this.getQualityText(quality.video)} |
                        Ses: ${this.getQualityText(quality.audio)} |
                        Ağ: ${this.getQualityText(quality.network)}
                    </div>
                </div>
            </div>
        `;

        alertEl.classList.remove('hidden');
        alertEl.classList.add('visible');

        // 5 saniye sonra otomatik gizle (kritik değilse)
        if (quality.overall !== 'critical' && quality.overall !== 'disconnected') {
            setTimeout(() => {
                alertEl.classList.remove('visible');
                setTimeout(() => alertEl.classList.add('hidden'), 300);
            }, 5000);
        }
    }

    getQualityText(quality) {
        const texts = {
            excellent: 'Mükemmel',
            good: 'İyi',
            poor: 'Zayıf',
            critical: 'Kritik',
            disconnected: 'Kesik',
            unknown: '?'
        };
        return texts[quality] || '?';
    }

    async playAlertSound() {
        // Cooldown kontrolü
        const now = Date.now();
        if (now - this.lastAlertTime < this.alertCooldown) return;
        this.lastAlertTime = now;

        if (this.isMuted) return;

        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.3);
        } catch (e) {
            console.warn('Ses çalma hatası:', e);
        }
    }

    muteAlerts() {
        this.isMuted = true;
    }

    unmuteAlerts() {
        this.isMuted = false;
    }

    async saveAlertToBackend(alert) {
        try {
            const response = await fetch('/api/save-quality-alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    call_id: window.webrtcClient ? window.webrtcClient.callId : null,
                    alert: alert
                })
            });

            const result = await response.json();
            if (!result.success) {
                console.warn('Uyarı kaydetme hatası:', result.error);
            }
        } catch (error) {
            console.warn('Backend uyarı hatası:', error);
        }
    }

    getQualityColor(quality) {
        const colors = {
            excellent: '#4CAF50',
            good: '#8BC34A',
            poor: '#FF9800',
            critical: '#F44336',
            disconnected: '#9C27B0',
            unknown: '#9E9E9E'
        };
        return colors[quality] || colors.unknown;
    }

    getQualityIcon(quality) {
        const icons = {
            excellent: '🟢',
            good: '🟡',
            poor: '🟠',
            critical: '🔴',
            disconnected: '⚫',
            unknown: '⚪'
        };
        return icons[quality] || icons.unknown;
    }
}

// Global instance
window.qualityMonitor = new QualityMonitor();
