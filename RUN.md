# Canlı Destek Sistemi - Çalıştırma Kılavuzu

## Kurulum

1. **Bağımlılıkları yükle:**
```bash
pip install -r requirements.txt
```

2. **Telegram Bot Ayarları:**
   - `.env.example` dosyasını `.env` olarak kopyala
   - Telegram Bot Token ve Chat ID'yi `.env` dosyasına ekle

3. **Sunucuyu başlat:**
```bash
python server.py
```

## Erişim

- **Müşteri Arayüzü:** http://localhost:8080/
- **Admin Paneli:** http://localhost:8080/admin

## Özellikler

### Müşteri Tarafı (/)
- İsim girişi
- Video/ses arama başlatma
- Kamera/mikrofon/hoparlör kontrolleri
- Tam ekran modu
- PiP kamera

### Admin Tarafı (/admin)
- OTP ile güvenli giriş (Telegram'dan kod)
- Aktif kullanıcıları görüntüleme
- Kullanıcılara arama başlatma
- Görüşme istatistikleri (bugün/hafta/ay/yıl)
- Görüşme geçmişi
- Toplu kullanıcı yönetimi

## Telegram Bildirimleri

Sistem otomatik olarak şu bildirimleri gönderir:
- Yeni arama geldiğinde
- Admin OTP kodu
- Görüşme sonlandığında
- Hata durumlarında

## Teknolojiler

- **Backend:** Flask, Python
- **Frontend:** Vanilla JS, HTML5, CSS3
- **WebRTC:** Peer-to-peer video/ses
- **Bildirimler:** Telegram Bot API
