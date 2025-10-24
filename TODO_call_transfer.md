# Adminler Arası Çağrı Transferi Uygulama Planı

## 📊 Mevcut Sistem Durumu
- **server_v2.py**: HTTP server, OTP ve çağrı yönetimi
- **admin.html**: Çağrı ekranı var, kontroller mevcut
- **signaling.js**: WebRTC client, temel signaling
- **Eksik**: WebSocket server, çoklu admin desteği, transfer mekanizması

## 🎯 Hedef
Bir admin, aktif çağrıyı başka bir admin'e transfer edebilmeli.

## 🛠️ Gerekli Bileşenler

### 1. Backend - WebSocket Server
```python
# Yeni dosya: server_ws.py
- WebSocket bağlantı yönetimi
- Admin listesi (online/offline)
- Transfer mesajı routing
- Call state yönetimi
```

### 2. Frontend - Admin Panel
```javascript
// app/admin/admin.html güncellemesi
- Transfer butonu (çağrı ekranında)
- Online admin listesi modal
- Transfer onay dialog
```

### 3. Signaling - Transfer Logic
```javascript
// app/static/js/signaling.js güncellemesi
- transferCall(targetAdminId) fonksiyonu
- Transfer mesajı gönderme
- Bağlantı temizleme ve yeniden kurma
```

## 📝 Uygulama Adımları

### Faz 1: WebSocket Server (Öncelik: Yüksek)
- [ ] server_ws.py oluştur (asyncio + websockets)
- [ ] Admin bağlantı yönetimi
- [ ] Online admin listesi API
- [ ] Transfer mesaj routing
- [ ] Port: 8081 (HTTP: 8080)

### Faz 2: Admin UI (Öncelik: Orta)
- [ ] Transfer butonu ekle (call screen)
- [ ] Online admin listesi modal
- [ ] Transfer onay dialog
- [ ] Transfer durumu göstergesi

### Faz 3: Signaling Logic (Öncelik: Orta)
- [ ] WebSocket bağlantısı (signaling.js)
- [ ] transferCall() fonksiyonu
- [ ] Transfer mesajı handle
- [ ] PeerConnection yeniden kurma

### Faz 4: Test (Öncelik: Düşük)
- [ ] 2 admin ile transfer testi
- [ ] Video/audio kesintisiz geçiş
- [ ] Hata senaryoları (admin offline, reject, vb.)

## 📊 Transfer Akışı

```
[Admin A] ---Çağrıda--- [Müşteri]
    |
    | 1. Transfer butonu
    v
[Online Admin Listesi]
    |
    | 2. Admin B seç
    v
[WebSocket Server]
    |
    | 3. Admin B'ye bildirim
    v
[Admin B] ---Kabul Et---
    |
    | 4. WebRTC yeniden bağlan
    v
[Admin B] ---Çağrıda--- [Müşteri]
```

## 🚧 Teknik Zorluklar
1. **WebRTC Renegotiation**: PeerConnection yeniden kurulmalı
2. **State Sync**: Call state tüm adminlerde senkron
3. **Network Latency**: Transfer sırasında kesinti
4. **Admin Offline**: Hedef admin çevrimdışı olursa

## 💻 Kod Örnekleri

### Backend (server_ws.py)
```python
async def handle_transfer(websocket, data):
    call_id = data['call_id']
    target_admin_id = data['target_admin_id']
    
    # Call state güncelle
    call_states[call_id]['admin_id'] = target_admin_id
    
    # Hedef admin'e bildir
    await notify_admin(target_admin_id, {
        'type': 'transfer_request',
        'call_id': call_id,
        'customer_name': call_states[call_id]['customer_name']
    })
```

### Frontend (admin.html)
```javascript
function showTransferModal() {
    // Online adminleri getir
    fetch('/api/online-admins')
        .then(r => r.json())
        .then(admins => {
            // Modal göster
            displayAdminList(admins);
        });
}
```

### Signaling (signaling.js)
```javascript
async transferCall(targetAdminId) {
    // Mevcut bağlantıyı kapat
    this.pc.close();
    
    // Transfer mesajı gönder
    this.ws.send(JSON.stringify({
        type: 'transfer',
        call_id: this.callId,
        target_admin_id: targetAdminId
    }));
}
```

## ⏱️ Tahmini Süre
- **Faz 1 (WebSocket):** 4-6 saat
- **Faz 2 (UI):** 2-3 saat
- **Faz 3 (Signaling):** 3-4 saat
- **Faz 4 (Test):** 2-3 saat
- **Toplam:** 11-16 saat

## 📌 Notlar
- Önce temel WebSocket server kurulmalı
- Mevcut HTTP server (server_v2.py) korunacak
- WebSocket sadece signaling için kullanılacak
- Transfer önceliği düşük (temel özellikler önce)
