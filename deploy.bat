@echo off
chcp 65001 >nul
cls
echo ========================================
echo    Git ve Railway Deployment Hazırlık
echo ========================================
echo.

echo [1/5] Git durumu kontrol ediliyor...
git status >nul 2>&1
if %errorlevel% neq 0 (
    echo Git repository yok, başlatılıyor...
    git init
    echo ✅ Git başlatıldı
) else (
    echo ✅ Git repository mevcut
)
echo.

echo [2/5] Dosyalar ekleniyor...
git add .
echo ✅ Dosyalar staged
echo.

echo [3/5] Commit oluşturuluyor...
set /p commit_msg="Commit mesajı (Enter=varsayılan): "
if "%commit_msg%"=="" set commit_msg=Update: deployment hazırlığı
git commit -m "%commit_msg%"
echo ✅ Commit oluşturuldu
echo.

echo [4/5] Remote kontrol ediliyor...
git remote -v | findstr origin >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Remote repository ayarlanmamış
    echo.
    echo GitHub'da yeni repo oluştur: https://github.com/new
    echo Sonra şu komutu çalıştır:
    echo   git remote add origin https://github.com/USERNAME/REPO.git
    echo   git push -u origin main
) else (
    echo ✅ Remote repository mevcut
    echo.
    echo [5/5] Push yapılıyor...
    git push
    echo ✅ Push tamamlandı
)
echo.

echo ========================================
echo    Railway Deployment Adımları
echo ========================================
echo.
echo 1. https://railway.app/ aç
echo 2. GitHub ile giriş yap
echo 3. "New Project" → "Deploy from GitHub repo"
echo 4. Repository'yi seç
echo 5. Environment Variables ekle:
echo    - TELEGRAM_BOT_TOKEN=8033290671:AAF4QdGB6AsGQDbnYXxUpXakcsb9aAeyW6M
echo    - TELEGRAM_CHAT_ID=5874850928
echo 6. Deploy başlasın, URL'yi al
echo.
echo Detaylı kılavuz: README_DEPLOY.md
echo.
pause
