# Yapı Bütünlüğü Test Planı

## 1. DOSYA YAPISI TESTİ

### ✅ Kontrol Edilecekler:
- [ ] app/admin/ klasörü var mı?
- [ ] app/index/ klasörü var mı?
- [ ] app/static/ klasörü var mı?
- [ ] server_v2.py çalışıyor mu?
- [ ] Telegram config doğru mu?

### 📁 Beklenen Yapı:
```
ara/
├── app/
│   ├── admin/
│   │   ├── css/ (3 dosya)
│   │   ├── js/ (2 dosya)
│   │   └── admin.html
│   ├── index/
│   │   ├── css/ (1 dosya)
│   │   ├── js/ (2 dosya)
│   │   └── index.html
│   └── static/
│       ├── js/ (signaling.js)
│       ├── favicon.svg
│       └── manifest.json
├── server_v2.py
├── otp_manager.py
├── telegram_notifier.py
└── .env
```

---

## 2. SERVER TESTİ

### Test 1: Server Başlatma
```bash
python server_v2.py
```
**Beklenen:** Port 8080'de başlamalı

### Test 2: Ana Sayfa Erişimi
```
URL: http://localhost:8080/
```
**Beklenen:** index.html yüklenmeli

### Test 3: Admin Sayfası Erişimi
```
URL: http://localhost:8080/admin
```
**Beklenen:** admin.html yüklenmeli

### Test 4: Static Dosyalar
```
URL: http://localhost:8080/static/favicon.svg
```
**Beklenen:** SVG dosyası yüklenmeli

---

## 3. API ENDPOINTLERİ TESTİ

### Test 5: OTP İsteme
```json
POST /api/request-admin-otp
Body: {}
```
**Beklenen:**
```json
{
  "success": true,
  "callId": "abc123..."
}
```
**Telegram:** OTP mesajı gelmeli

### Test 6: OTP Doğrulama (Doğru Kod)
```json
POST /api/verify-otp
Body: {
  "otp": "123456",
  "callId": "abc123..."
}
```
**Beklenen:**
```json
{
  "success": true,
  "callId": "abc123..."
}
```

### Test 7: OTP Doğrulama (Yanlış Kod)
```json
POST /api/verify-otp
Body: {
  "otp": "999999",
  "callId": "abc123..."
}
```
**Beklenen:**
```json
{
  "success": false,
  "error": "Yanlis OTP. 4 deneme hakkiniz kaldi"
}
```

### Test 8: Aktif Aramalar
```json
GET /api/active-calls
```
**Beklenen:**
```json
{
  "success": true,
  "active_calls": []
}
```

### Test 9: Arama Oluşturma
```json
POST /api/create-call
Body: {
  "customer_name": "Test User",
  "peer_id": "test123"
}
```
**Beklenen:**
```json
{
  "success": true,
  "call_id": "xyz789..."
}
```
**Telegram:** Yeni arama bildirimi gelmeli

---

## 4. FRONTEND TESTİ

### Test 10: Index Sayfası
1. http://localhost:8080/ aç
2. İsim gir: "Test Kullanıcı"
3. "Destek Ara" butonuna tıkla
**Beklenen:** 
- Bildirim gösterilmeli
- Telegram'a mesaj gitmeli

### Test 11: Admin Sayfası - OTP İsteme
1. http://localhost:8080/admin aç
2. "Şifre İste" butonuna tıkla
**Beklenen:**
- OTP input alanı görünmeli
- Telegram'dan kod gelmeli

### Test 12: Admin Sayfası - OTP Girişi
1. Telegram'dan gelen kodu kopyala
2. Admin panelde kodu gir
3. "Giriş Yap" butonuna tıkla
**Beklenen:**
- Dashboard açılmalı
- İstatistikler görünmeli

---

## 5. TELEGRAM TESTİ

### Test 13: Bot Token Kontrolü
```python
TELEGRAM_BOT_TOKEN = '8033290671:AAF4QdGB6AsGQDbnYXxUpXakcsb9aAeyW6M'
TELEGRAM_CHAT_ID = '5874850928'
```
**Kontrol:**
- Token formatı doğru mu?
- Chat ID sayı mı?

### Test 14: Mesaj Gönderme
```python
send_telegram("Test mesajı")
```
**Beklenen:** Telegram'da mesaj görünmeli

### Test 15: HTML Formatlama
```python
send_telegram("<b>Kalın</b> <code>kod</code>")
```
**Beklenen:** Formatlanmış mesaj görünmeli

---

## 6. OTP GÜVENLİK TESTİ

### Test 16: Süre Aşımı
1. OTP iste
2. 11 dakika bekle
3. Kodu gir
**Beklenen:** "OTP suresi dolmus" hatası

### Test 17: Deneme Limiti
1. OTP iste
2. 5 kez yanlış kod gir
**Beklenen:** "Cok fazla yanlis deneme" hatası

### Test 18: Geçersiz Format
1. OTP iste
2. "abc123" gir
**Beklenen:** "OTP 6 haneli sayi olmali" hatası

---

## 7. PERFORMANS TESTİ

### Test 19: Çoklu İstek
- 10 adet OTP isteği gönder
**Beklenen:** Hepsi başarılı olmalı

### Test 20: Asenkron Telegram
- OTP iste
- Response süresi < 500ms olmalı
**Beklenen:** Telegram arka planda gönderilmeli

---

## 8. HATA YÖNETİMİ TESTİ

### Test 21: Olmayan Endpoint
```
GET /api/nonexistent
```
**Beklenen:** 404 veya error response

### Test 22: Geçersiz JSON
```json
POST /api/verify-otp
Body: "invalid json"
```
**Beklenen:** Error response

### Test 23: Eksik Parametre
```json
POST /api/verify-otp
Body: {}
```
**Beklenen:** "OTP 6 haneli sayi olmali" hatası

---

## 9. ENTEGRASYON TESTİ

### Test 24: Tam Akış (Admin)
1. Admin sayfası aç
2. OTP iste
3. Telegram'dan kodu al
4. Kodu gir
5. Dashboard'a gir
6. İstatistikleri kontrol et
**Beklenen:** Tüm adımlar başarılı

### Test 25: Tam Akış (Müşteri)
1. Index sayfası aç
2. İsim gir
3. Ara butonuna tıkla
4. Admin'e bildirim git
5. Admin kabul et
6. Video görüşme başlasın
**Beklenen:** Tüm adımlar başarılı

---

## 10. SONUÇ RAPORU

### ✅ Başarılı Testler: __/25
### ❌ Başarısız Testler: __/25
### ⚠️ Uyarılar: __

### Kritik Sorunlar:
- [ ] Yok

### Öneriler:
- [ ] Yok

---

## TEST KOMUTLARI

### Manuel Test:
```bash
# Server başlat
python server_v2.py

# Tarayıcıda test et
http://localhost:8080/
http://localhost:8080/admin
```

### API Test (curl):
```bash
# OTP iste
curl -X POST http://localhost:8080/api/request-admin-otp

# OTP doğrula
curl -X POST http://localhost:8080/api/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"otp":"123456","callId":"abc"}'

# Aktif aramalar
curl http://localhost:8080/api/active-calls
```
