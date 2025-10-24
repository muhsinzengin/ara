// WebRTC Signaling Client
class WebRTCSignaling {
    constructor() {
        this.ws = null;
        this.pc = null;
        this.localStream = null;
        this.isAdmin = window.location.pathname.includes('admin');
    }

    connect(url = 'ws://localhost:8080/ws') {
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
        };
    }

    async handleMessage(data) {
        console.log('📨 Mesaj alındı:', data.type);
        
        switch(data.type) {
            case 'offer':
                await this.handleOffer(data.offer);
                break;
            case 'answer':
                await this.handleAnswer(data.answer);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(data.candidate);
                break;
            case 'hangup':
                this.handleHangup();
                break;
        }
    }

    async handleOffer(offer) {
        if (!this.pc) {
            this.createPeerConnection();
        }
        
        await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        
        this.send({
            type: 'answer',
            answer: answer
        });
    }

    async handleAnswer(answer) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    }

    async handleIceCandidate(candidate) {
        if (this.pc && candidate) {
            await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    }

    handleHangup() {
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
    }

    createPeerConnection() {
        this.pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        });

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.send({
                    type: 'ice-candidate',
                    candidate: event.candidate
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

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.pc.addTrack(track, this.localStream);
            });
        }
    }

    async startCall(stream) {
        this.localStream = stream;
        this.createPeerConnection();
        
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        
        this.send({
            type: 'offer',
            offer: offer
        });
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    hangup() {
        this.send({ type: 'hangup' });
        this.handleHangup();
    }
}

// Global instance
window.webrtcClient = new WebRTCSignaling();
