# 🚂 Railway Deployment Guide

## 🚀 Hızlı Deployment

### 1. Railway'e Git
1. [Railway.app](https://railway.app) hesabı oluştur
2. "New Project" → "Deploy from GitHub repo"
3. Bu repository'yi seç

### 2. Environment Variables Ayarla
Railway dashboard'da Variables sekmesine git:

```env
TELEGRAM_BOT_TOKEN=your_actual_bot_token
TELEGRAM_CHAT_ID=your_actual_chat_id
BASE_URL=https://your-app.railway.app
HTTPS_ENABLED=true
PORT=8080
HOST=0.0.0.0
LOG_LEVEL=INFO
DEBUG=false
ALLOWED_ORIGINS=https://your-app.railway.app
RATE_LIMIT_CALLS=10
RATE_LIMIT_PERIOD=60
```

### 3. Deploy
Railway otomatik olarak deploy edecek:
- ✅ Dependencies kurulumu
- ✅ Server başlatma
- ✅ Public URL oluşturma

### 4. Erişim URL'leri
Railway size otomatik bir URL verecek:
- **Müşteri**: `https://your-app.railway.app/`
- **Admin**: `https://your-app.railway.app/admin`
- **Dashboard**: `https://your-app.railway.app/dashboard`
- **Health Check**: `https://your-app.railway.app/api/healthz`
- **Metrics**: `https://your-app.railway.app/api/metrics`

## 🔧 Önemli Notlar

### Port Configuration
Railway otomatik olarak `PORT` environment variable'ı sağlar. Server bu portu kullanacak şekilde ayarlandı.

### Database
SQLite database Railway'in persistent storage'ında saklanacak.

### Logs
Railway dashboard'da "Deployments" → "Logs" sekmesinden logları görebilirsin.

### Custom Domain
Railway'de Settings → Domains'den custom domain ekleyebilirsin.

## 🎯 Deployment Checklist

- [ ] Railway hesabı oluştur
- [ ] GitHub repository'yi bağla
- [ ] Environment variables ayarla
- [ ] Deploy butonuna tıkla
- [ ] Health check test et
- [ ] Admin paneline giriş yap
- [ ] Telegram bildirimlerini test et

## 📊 Monitoring

Railway dashboard'da:
- **Metrics**: CPU, Memory, Network kullanımı
- **Logs**: Real-time application logs
- **Deployments**: Deployment history

## 🔒 Security

Railway otomatik olarak sağlar:
- ✅ HTTPS encryption
- ✅ DDoS protection
- ✅ Automatic SSL certificates
- ✅ Environment variable encryption

## 💰 Pricing

Railway free tier:
- $5 credit/month
- 500 hours execution time
- 1GB RAM
- 1GB storage

Bu proje için yeterli!

## 🎉 Deployment Sonrası

1. **Health Check**: `https://your-app.railway.app/api/healthz`
2. **Admin Login**: OTP ile giriş yap
3. **Test Call**: Müşteri arayüzünden test araması yap
4. **Telegram**: Bildirimleri kontrol et

**Başarılı deployment! 🚀**

