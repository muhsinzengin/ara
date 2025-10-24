# Railway Deployment Checklist

## ✅ Hazırlık (Tamamlandı)

- [x] `server_v2.py` - Railway uyumlu (PORT env var)
- [x] `Procfile` - web: python server_v2.py
- [x] `runtime.txt` - python-3.12.0
- [x] `railway.json` - Railway config
- [x] `nixpacks.toml` - Build config
- [x] `requirements.txt` - Bağımlılıklar (yok)
- [x] `.gitignore` - Hassas dosyalar hariç
- [x] Environment variables hazır

## 📋 Deployment Adımları

### 1. Git Push
```bash
cd c:\Users\ASUS\Desktop\ara
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USERNAME/canli-destek.git
git push -u origin main
```

### 2. Railway Setup
1. https://railway.app/ → Login with GitHub
2. New Project → Deploy from GitHub repo
3. Select: canli-destek repository
4. Add Environment Variables:
   ```
   TELEGRAM_BOT_TOKEN=8033290671:AAF4QdGB6AsGQDbnYXxUpXakcsb9aAeyW6M
   TELEGRAM_CHAT_ID=5874850928
   ```
5. Deploy başlar otomatik

### 3. Test
```bash
# URL'yi al (örnek: https://canli-destek-production.up.railway.app)
curl https://YOUR-APP.up.railway.app/healthz
```

## 🔧 Railway Environment Variables

```
TELEGRAM_BOT_TOKEN=8033290671:AAF4QdGB6AsGQDbnYXxUpXakcsb9aAeyW6M
TELEGRAM_CHAT_ID=5874850928
```

## 🚀 Hızlı Başlangıç

```bash
# Tek komutla hazırla
deploy.bat
```

## 📊 Beklenen Sonuç

✅ Build başarılı
✅ Server başladı (Port: Railway tarafından atanan)
✅ Health check: OK
✅ Admin panel: https://YOUR-APP.up.railway.app/admin
✅ Müşteri: https://YOUR-APP.up.railway.app/

## 🔍 Sorun Giderme

### Build Hatası
- Logs kontrol et
- Python version doğru mu? (3.12)

### Runtime Hatası
- Environment variables eklenmiş mi?
- PORT variable Railway tarafından otomatik atanıyor

### 404 Hatası
- Dosya yolları doğru mu? (app/admin/, app/index/)
- Static files yüklü mü?

## 📝 Notlar

- Railway FREE tier: $5 kredi/ay
- HTTPS otomatik sağlanır
- Custom domain eklenebilir
- Auto-deploy: Her push'ta yeniden deploy
