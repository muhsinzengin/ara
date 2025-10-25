# 📦 Git Repository Setup

## 🚀 Adım Adım Git Kurulumu

### 1. Git Repository Oluştur
```bash
git init
```

### 2. Dosyaları Ekle
```bash
git add .
```

### 3. İlk Commit
```bash
git commit -m "Initial commit: Production-ready WebRTC support system"
```

### 4. GitHub Repository Oluştur
1. GitHub'da yeni repository oluştur
2. Repository adı: `canli-destek-sistemi`
3. Public veya Private seç
4. README ekleme (zaten var)

### 5. Remote Ekle
```bash
git remote add origin https://github.com/YOUR_USERNAME/canli-destek-sistemi.git
```

### 6. Push
```bash
git branch -M main
git push -u origin main
```

## 🚂 Railway'e Deploy

### 1. Railway'e Git
- [Railway.app](https://railway.app) → Login with GitHub

### 2. New Project
- "Deploy from GitHub repo"
- Repository seç: `canli-destek-sistemi`

### 3. Environment Variables
Railway dashboard'da Variables ekle:
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
BASE_URL=https://your-app.railway.app
HTTPS_ENABLED=true
PORT=8080
HOST=0.0.0.0
LOG_LEVEL=INFO
DEBUG=false
ALLOWED_ORIGINS=https://your-app.railway.app
```

### 4. Deploy
Railway otomatik deploy edecek!

## ✅ Deployment Checklist

- [ ] Git repository oluşturuldu
- [ ] GitHub'a push edildi
- [ ] Railway'e bağlandı
- [ ] Environment variables ayarlandı
- [ ] Deploy tamamlandı
- [ ] Health check test edildi
- [ ] Admin paneli test edildi
- [ ] Telegram bildirimleri test edildi

## 🎉 Tamamlandı!

Artık sisteminiz Railway'de canlı! 🚀

**URL**: `https://your-app.railway.app`

