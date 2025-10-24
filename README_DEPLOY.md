# Railway Deployment Kılavuzu

## 1. Git Repository Hazırlama

```bash
# Git başlat
git init

# Dosyaları ekle
git add .

# İlk commit
git commit -m "Initial commit: Canli Destek Sistemi"

# GitHub'a push (opsiyonel)
git remote add origin https://github.com/USERNAME/canli-destek.git
git branch -M main
git push -u origin main
```

## 2. Railway Deployment

### Adım 1: Railway'e Giriş
1. https://railway.app/ aç
2. GitHub ile giriş yap

### Adım 2: Yeni Proje Oluştur
1. "New Project" tıkla
2. "Deploy from GitHub repo" seç
3. Repository'yi seç (canli-destek)

### Adım 3: Environment Variables Ayarla
Railway Dashboard → Variables sekmesi:

```
TELEGRAM_BOT_TOKEN=8033290671:AAF4QdGB6AsGQDbnYXxUpXakcsb9aAeyW6M
TELEGRAM_CHAT_ID=5874850928
PORT=8080
```

### Adım 4: Deploy
- Railway otomatik deploy başlatır
- Build loglarını izle
- Deploy tamamlandığında URL verilir

## 3. Deployment Sonrası

### URL'yi Al
```
https://canli-destek-production.up.railway.app
```

### Test Et
```bash
# Health check
curl https://YOUR-APP.up.railway.app/healthz

# Admin sayfası
https://YOUR-APP.up.railway.app/admin

# Müşteri sayfası
https://YOUR-APP.up.railway.app/
```

## 4. Güncelleme

```bash
# Değişiklikleri commit et
git add .
git commit -m "Update: yeni özellik"
git push

# Railway otomatik yeniden deploy eder
```

## 5. Logları İzleme

Railway Dashboard → Deployments → View Logs

## 6. Domain Bağlama (Opsiyonel)

Railway Dashboard → Settings → Domains
- Custom domain ekle
- DNS ayarlarını yap

## 7. Sorun Giderme

### Build Hatası
- `requirements.txt` kontrol et
- Python versiyonu kontrol et (`runtime.txt`)

### Runtime Hatası
- Environment variables kontrol et
- Logs'u incele

### Port Hatası
- Railway otomatik PORT atar
- `os.getenv('PORT', 8080)` kullanıldığından emin ol

## 8. Maliyet

- **Free Tier**: $5 kredi/ay
- **Hobby Plan**: $5/ay (500 saat)
- **Pro Plan**: $20/ay (sınırsız)

## 9. Önemli Notlar

✅ **Yapılması Gerekenler:**
- `.env` dosyası Git'e eklenmemeli (`.gitignore`'da)
- Environment variables Railway'de ayarlanmalı
- HTTPS otomatik sağlanır

❌ **Yapılmaması Gerekenler:**
- Hassas bilgileri commit etme
- `.env` dosyasını push etme
- Hardcoded secrets kullanma

## 10. Alternatif Deployment

### Render.com
```yaml
# render.yaml
services:
  - type: web
    name: canli-destek
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: python server_v2.py
```

### Heroku
```
# Procfile zaten var
heroku create canli-destek
git push heroku main
```

### Vercel (Serverless)
```json
{
  "builds": [
    {
      "src": "server_v2.py",
      "use": "@vercel/python"
    }
  ]
}
```
