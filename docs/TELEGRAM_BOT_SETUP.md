# Telegram Bot Kurulum Rehberi

> Not: Bildirimler `server_v2.py` içindeki yerleşik `send_telegram` fonksiyonuyla gönderilir; harici modüle gerek yoktur.

## 🤖 Telegram Bot Oluşturma

### 1. Bot Oluşturma
1. Telegram'da **@BotFather**'a git
2. `/newbot` komutunu gönder
3. Bot adını ver (örn: "Canlı Destek Bot")
4. Bot username'i ver (örn: "canli_destek_bot")
5. Bot token'ını kopyala (örn: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Chat ID Alma
1. Telegram'da **@userinfobot**'a git
2. `/start` komutunu gönder
3. Chat ID'yi kopyala (örn: `123456789`)

### 3. .env Dosyasını Güncelleme
`.env` dosyasını aç ve şu değerleri güncelle:

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

### 4. Server'ı Yeniden Başlat
```bash
# Server'ı durdur
taskkill /f /im python.exe

# Server'ı başlat
python server_v2.py
```

## ✅ Test Etme

### Call Oluşturma Testi
1. Browser'da http://localhost:8080/ aç
2. İsim yaz ve "Destek Ara" tıkla
3. Telegram'da bildirim gelmeli

### OTP Testi
1. Browser'da http://localhost:8080/admin aç
2. "OTP Kodu İste" tıkla
3. Telegram'da OTP kodu gelmeli

## 🔧 Sorun Giderme

### Telegram Hatası 401: Unauthorized
- Bot token'ı yanlış
- .env dosyasında TELEGRAM_BOT_TOKEN kontrol et

### Telegram Hatası 400: Bad Request
- Chat ID yanlış
- .env dosyasında TELEGRAM_CHAT_ID kontrol et

### Bildirim Gelmiyor
- Bot token ve chat ID doğru mu kontrol et
- Server loglarında hata var mı kontrol et
- Bot'u Telegram'da başlatmış mısın kontrol et

## 📱 Örnek Bildirimler

### Yeni Call Bildirimi
```
📞 Yeni Destek Talebi

👤 Müşteri: Test Müşteri
🕐 Saat: 14:07:30
🆔 Call ID: vcJeAm8h...

Admin panelinden kabul edebilirsiniz
```

### OTP Bildirimi
```
🔐 Admin OTP Kodu

Kod: 123456
Süre: 10 dakika
Call ID: 8HHv3b1V...

Admin panelinde giriş yapın
```

## 🚀 Production Notları

- Bot token'ını güvenli tut
- .env dosyasını git'e ekleme (.gitignore'da)
- Production'da HTTPS kullan
- Rate limiting aktif tut
