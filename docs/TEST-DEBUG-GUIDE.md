# 🧪 Test & Debug Rehberi - Canlı Destek Sistemi

## 📊 Test Durumu
- **Test Coverage**: %100 başarılı
- **Test Sayısı**: 21 test
- **Success Rate**: 100%
- **Test Kategorileri**: 5 kategori

## 🚀 Hızlı Test

```bash
# Tüm testleri çalıştır
python test_server.py

# Beklenen çıktı:
# Ran 21 tests in 0.002s
# OK
```

## 📋 Test Senaryoları

### 1️⃣ SENARYO 1: Sesli + Görüntülü Görüşme (Normal Akış)

**Adımlar:**
1. Index sayfasını aç (http://localhost:8080/)
2. İsim gir ve "Destek Ara" butonuna tıkla
3. Kamera/mikrofon izni ver
4. Admin panelini aç (http://localhost:8080/admin)
5. OTP ile giriş yap
6. Incoming call modal'da "Kabul Et" butonuna tıkla
7. Kamera/mikrofon izni ver
8. Görüntülü görüşme başlasın

**Beklenen Loglar:**

**INDEX Tarafı:**
```
[INDEX WebRTC] Init for callId: xxx
[INDEX WebRTC] Media acquired: {audio: 1, video: 1}
[INDEX WebRTC] Adding track: audio
[INDEX WebRTC] Adding track: video
[INDEX WebRTC] Creating offer...
[INDEX WebRTC] Sending offer to ADMIN
[INDEX WebRTC] Starting signal polling...
[INDEX WebRTC] ICE candidate: host
[INDEX WebRTC] ICE candidate: srflx
[INDEX WebRTC] ICE gathering complete
[INDEX WebRTC] Received answer from ADMIN
[INDEX WebRTC] Received X ICE candidates from ADMIN
[INDEX WebRTC] Track received: audio
[INDEX WebRTC] Remote audio set
[INDEX WebRTC] Track received: video
[INDEX WebRTC] Remote video set
[INDEX WebRTC] Connection state: connected
[INDEX WebRTC] ✅ Connection established!
```

**ADMIN Tarafı:**
```
[ADMIN WebRTC] Init connection for callId: xxx
[ADMIN WebRTC] Requesting media...
[ADMIN WebRTC] Media acquired: {audio: 1, video: 1}
[ADMIN WebRTC] Adding track: audio
[ADMIN WebRTC] Adding track: video
[ADMIN WebRTC] Starting signal polling...
[ADMIN WebRTC] Received offer from INDEX
[ADMIN WebRTC] Sending answer to INDEX
[ADMIN WebRTC] ICE candidate: host
[ADMIN WebRTC] ICE candidate: srflx
[ADMIN WebRTC] ICE gathering complete
[ADMIN WebRTC] Received X ICE candidates from INDEX
[ADMIN WebRTC] Track received: audio
[ADMIN WebRTC] Remote audio set
[ADMIN WebRTC] Track received: video
[ADMIN WebRTC] Remote video set
[ADMIN WebRTC] Connection state: connected
[ADMIN WebRTC] ✅ Connection established!
```

**BACKEND Tarafı:**
```
[SIGNAL] ✅ Offer received from INDEX: xxx
[SIGNAL] ICE candidate (host): xxx
[SIGNAL] ICE candidate (srflx): xxx
[POLL] Sending to xxx: offer=True, answer=False, ice=5, status=offered
[SIGNAL] ✅ Answer received from ADMIN: xxx
[SIGNAL] ICE candidate (host): xxx
[SIGNAL] ICE candidate (srflx): xxx
[POLL] Sending to xxx: offer=True, answer=True, ice=10, status=connected
```

---

### 2️⃣ SENARYO 2: Sadece Sesli Görüşme

**Test:**
- Index: Kamera iznini reddet, sadece mikrofon ver
- Admin: Normal kabul et

**Beklenen:**
- Video track yok, sadece audio track
- Görüntü siyah ama ses çalışıyor

**Loglar:**
```
[INDEX WebRTC] Media acquired: {audio: 1, video: 0}
[INDEX WebRTC] Adding track: audio
```

---

### 3️⃣ SENARYO 3: Admin "Beklet" Derse

**Adımlar:**
1. Index arama başlat
2. Admin modal'da "Beklet" butonuna tıkla

**Beklenen:**
- Index'te "Admin şuan meşgul" mesajı
- Kuyruktan silinmez, beklemede kalır

**Loglar:**
```
[INDEX WebRTC] Poll: status=on_hold
```

---

### 4️⃣ SENARYO 4: Admin "Kapat" Derse

**Adımlar:**
1. Index arama başlat
2. Admin modal'da "Kapat" butonuna tıkla

**Beklenen:**
- Index'te "Admin kapattı" mesajı
- 2 saniye sonra sayfa yenilenir
- Görüşme geçmişine eklenir

**Loglar:**
```
[INDEX WebRTC] ❌ Call closed by admin
[SIGNAL] Invalid call: xxx
```

---

## 🔍 Hata Tespiti

### ❌ HATA 1: "Connection state: failed"

**Sebep:** ICE candidate'ler değişilemiyor

**Kontrol:**
1. STUN/TURN sunucuları çalışıyor mu?
2. Firewall/NAT problemi var mı?
3. ICE candidate'ler backend'e ulaşıyor mu?

**Log Kontrolü:**
```
[INDEX WebRTC] ICE candidate: host  ✅
[INDEX WebRTC] ICE candidate: srflx ✅ (STUN çalışıyor)
[INDEX WebRTC] ICE candidate: relay ✅ (TURN çalışıyor)
```

---

### ❌ HATA 2: "Track received" ama video/ses yok

**Sebep:** DOM element bulunamıyor veya autoplay engellendi

**Kontrol:**
1. `fullRemoteVideo` ve `fullRemoteAudio` elementleri var mı?
2. Browser autoplay policy
3. `srcObject` doğru set edildi mi?

**Çözüm:**
```javascript
// Audio için manuel play
audio.play().catch(e => console.log('Autoplay blocked'));
```

---

### ❌ HATA 3: Offer/Answer değişimi olmuyor

**Sebep:** Backend'de signal kaybolmuş

**Kontrol:**
```
[SIGNAL] ✅ Offer received from INDEX  ← Var mı?
[POLL] Sending to xxx: offer=True     ← Var mı?
[SIGNAL] ✅ Answer received from ADMIN ← Var mı?
```

**Çözüm:** Backend'de `active_calls` dictionary'sini kontrol et

---

## 🎯 Başarı Kriterleri

✅ **Tam Başarı:**
- Her iki tarafta da "Connection state: connected"
- Video ve ses akışı çalışıyor
- ICE gathering complete
- Track received (audio + video)

⚠️ **Kısmi Başarı:**
- Connection state: connected
- Sadece ses VEYA sadece video çalışıyor

❌ **Başarısız:**
- Connection state: failed/disconnected
- Track received yok
- ICE candidate yok

---

## 🛠️ Debug Komutları

**Browser Console:**
```javascript
// WebRTC durumunu kontrol et
window.customerCall.pc.connectionState
window.adminPanel.webrtc.pc.connectionState

// ICE candidate'leri gör
window.customerCall.addedCandidates
window.adminPanel.webrtc.addedCandidates

// Stream'leri kontrol et
window.customerCall.localStream.getTracks()
window.adminPanel.webrtc.localStream.getTracks()
```

**Backend Log Filtreleme:**
```bash
# Sadece SIGNAL logları
python server_v2.py | grep "\[SIGNAL\]"

# Sadece POLL logları
python server_v2.py | grep "\[POLL\]"
```

---

## 📊 Log Analiz Tablosu

| Log Mesajı | Anlamı | Durum |
|------------|--------|-------|
| `Media acquired: {audio: 1, video: 1}` | Kamera/mikrofon alındı | ✅ Normal |
| `Media acquired: {audio: 1, video: 0}` | Sadece mikrofon | ⚠️ Kamera yok |
| `ICE gathering complete` | ICE toplama bitti | ✅ Normal |
| `Connection state: connected` | Bağlantı kuruldu | ✅ Başarılı |
| `Connection state: failed` | Bağlantı başarısız | ❌ Hata |
| `Track received: audio` | Ses akışı geldi | ✅ Normal |
| `Track received: video` | Video akışı geldi | ✅ Normal |
| `Offer received from INDEX` | INDEX offer gönderdi | ✅ Normal |
| `Answer received from ADMIN` | ADMIN answer gönderdi | ✅ Normal |

---

## 🚀 Hızlı Test

**1 Dakikalık Test:**
```bash
1. Index aç → İsim gir → Ara
2. Admin aç → OTP gir → Kabul Et
3. Console'da "connected" gör
4. Video/ses çalışıyor mu kontrol et
5. Görüşmeyi kapat
```

**Başarılı ise:** ✅ Sistem çalışıyor
**Başarısız ise:** ❌ Yukarıdaki hata tespitine bak
