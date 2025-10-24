# Adminler Arası Çağrı Transferi Uygulama Planı

## Bilgi Toplandı
- **server_ws.py**: WebSocket mesajlarını handle ediyor, admin_connections ve client_connections var, call_states yönetiliyor
- **admin.html**: Çağrı ekranı var, kontroller mevcut, transfer butonu eksik
- **signaling_pro.js**: WebRTC bağlantılarını yönetiyor, transfer fonksiyonları eksik
- **Mevcut Sistem**: Adminler çağrıları kabul edebilir, müşteriyle bağlantı kurabilir

## Plan
1. **server_ws.py Güncellemeleri**
   - `transfer_call` mesaj tipi ekle
   - Transfer işlemi için call_states güncelleme
   - Yeni admin'e çağrı bildirimi

2. **admin.html Güncellemeleri**
   - Transfer butonu ekle (çağrı ekranına)
   - Admin seçimi için modal/dropdown
   - Transfer UI'si

3. **signaling_pro.js Güncellemeleri**
   - `transferCall()` fonksiyonu
   - Transfer sonrası bağlantı temizleme
   - Yeni admin'e sinyal gönderme

4. **Test ve Doğrulama**
   - Transfer akışını test et
   - UI/UX kontrolü

## Bağımlı Dosyalar
- server_ws.py (backend WebSocket)
- app/admin/admin.html (frontend UI)
- app/static/js/signaling_pro.js (WebRTC signaling)

## Takip Adımları
- [x] server_ws.py'ye transfer mesajları ekle
- [ ] admin.html'ye transfer butonu ve modal ekle
- [ ] signaling_pro.js'ye transfer fonksiyonları ekle
- [ ] Transfer akışını test et
