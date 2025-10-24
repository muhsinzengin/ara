# Telegram Bot Kurulum Kılavuzu

## Sorun: 401 Unauthorized

Bot token geçersiz veya yanlış. Yeni bot oluştur:

## Adım 1: Yeni Bot Oluştur

1. Telegram'da **@BotFather** ara
2. `/newbot` komutunu gönder
3. Bot adı gir: `Canli Destek Bot`
4. Bot username gir: `CanliDestekBot` (veya benzersiz bir isim)
5. Token'ı kopyala (örnek: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

## Adım 2: Chat ID Bul

### Yöntem 1: Bot ile konuş
1. Yeni oluşturduğun bot ile konuşmaya başla
2. `/start` komutunu gönder
3. Şu URL'yi tarayıcıda aç:
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
4. `"chat":{"id":123456789}` değerini bul

### Yöntem 2: @userinfobot kullan
1. Telegram'da **@userinfobot** ara
2. `/start` komutunu gönder
3. Chat ID'ni göreceksin

## Adım 3: Token'ları Güncelle

### Lokal (.env)
```bash
TELEGRAM_BOT_TOKEN=YENI_TOKEN_BURAYA
TELEGRAM_CHAT_ID=YENI_CHAT_ID_BURAYA
```

### Railway (Production)
1. Railway Dashboard aç
2. Variables sekmesi
3. Güncelle:
   ```
   TELEGRAM_BOT_TOKEN=YENI_TOKEN_BURAYA
   TELEGRAM_CHAT_ID=YENI_CHAT_ID_BURAYA
   ```
4. Redeploy

## Adım 4: Test Et

```bash
python telegram_check.py
```

Beklenen çıktı:
```
OK - Bot aktif!
  Bot ID: 1234567890
  Bot Adi: Canli Destek Bot
  Username: @CanliDestekBot

OK - Mesaj gonderildi!
  Message ID: 123
```

## Mevcut Token Sorunu

Şu anki token: `8033290671:AAF4QdGB6AsGQDbnYXxUpXakcsb9aAeyW6M`

Bu token:
- ❌ Geçersiz (401 Unauthorized)
- ❌ İptal edilmiş olabilir
- ❌ Yanlış kopyalanmış olabilir

**Çözüm:** Yukarıdaki adımları takip et ve yeni token al.

## Hızlı Test Komutu

```bash
# Bot bilgisi
curl https://api.telegram.org/bot<TOKEN>/getMe

# Mesaj gönder
curl -X POST https://api.telegram.org/bot<TOKEN>/sendMessage \
  -H "Content-Type: application/json" \
  -d '{"chat_id":"<CHAT_ID>","text":"Test"}'
```

## Alternatif: Mevcut Botu Kontrol Et

Eğer @Sohbet_Admin_Bot senin botunsa:

1. @BotFather'a git
2. `/mybots` komutunu gönder
3. @Sohbet_Admin_Bot'u seç
4. "API Token" seç
5. Yeni token al (eski iptal olur)
6. Token'ı güncelle
