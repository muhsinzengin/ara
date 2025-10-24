# Canlı Destek Sistemi TODO

## ✅ Tamamlanan Görevler
- [x] Production server (server_v2.py) hazır
- [x] OTP sistemi (6 haneli, 10 dk, 5 deneme)
- [x] Telegram bildirimleri entegre
- [x] Railway deployment yapılandırması
- [x] Admin panel UI (OTP, dashboard, call screen)
- [x] Müşteri arayüzü (video, audio, controls)
- [x] WebRTC signaling client (signaling.js)
- [x] API endpoints (/api/request-admin-otp, /api/verify-otp, /api/create-call, vb.)
- [x] Health check endpoint (/healthz)
- [x] Otomatik OTP temizleme (her 1 saat)
- [x] GitHub repository (https://github.com/muhsinzengin/ara)
- [x] Production deployment (https://ara-ara.up.railway.app/)

## 🔥 Acil Görevler
- [ ] Telegram bot token değiştir (mevcut token geçersiz - 401 error)
- [ ] WebRTC bağlantı testi (admin-müşteri video)
- [ ] Production'da end-to-end test

## 🔄 Devam Eden Görevler
- [ ] WebRTC signaling test (offer/answer/ICE)
- [ ] Video/audio kalite optimizasyonu
- [ ] Mobil responsive test (iOS/Android)
- [ ] Çapraz tarayıcı test (Chrome, Firefox, Safari)
- [ ] Network hatası yönetimi

## 📋 Özellik Geliştirme
- [ ] Çağrı kalitesi izleme (bandwidth, latency, packet loss)
- [ ] Ekran paylaşımı (screen sharing)
- [ ] Çağrı kaydı (call recording)
- [ ] Çağrı istatistikleri dashboard
- [ ] Admin çevrimdışı durumu (offline mode)
- [ ] Çağrı bekleme kuyruğu
- [ ] Ses aktivite göstergesi (speaking indicator)
- [ ] Arka plan bulanıklaştırma (background blur)

## 🚀 Gelecek Özellikler
- [ ] Adminler arası çağrı transferi (TODO_call_transfer.md)
- [ ] Çoklu admin desteği
- [ ] Adminler arası mesajlaşma
- [ ] Otomatik çağrı dağıtımı
- [ ] Çağrı analitik raporları
- [ ] WebRTC stats görselleştirme

## 🐛 Bilinen Sorunlar
- [ ] Telegram bot token geçersiz (401 Unauthorized)
- [ ] WebSocket signaling henüz test edilmedi
- [ ] ICE candidate gathering testi gerekli

## 📝 Teknik Notlar
- **Server:** server_v2.py (Python stdlib only, Railway compatible)
- **Port:** Railway otomatik (local: 8080)
- **Signaling:** HTTP polling (WebSocket yok)
- **STUN:** Google + Twilio
- **Deployment:** Railway auto-deploy from GitHub
- **Environment:** TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, PORT
