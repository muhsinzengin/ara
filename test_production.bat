@echo off
chcp 65001 >nul
echo ========================================
echo    PRODUCTION TEST
echo    https://ara-ara.up.railway.app/
echo ========================================
echo.

set BASE=https://ara-ara.up.railway.app

echo [1/6] Health Check...
curl -s %BASE%/healthz
echo.
echo.

echo [2/6] Ana Sayfa...
curl -s -I %BASE%/ | findstr "200"
echo.

echo [3/6] Admin Sayfasi...
curl -s -I %BASE%/admin | findstr "200"
echo.

echo [4/6] Static Files...
curl -s -I %BASE%/static/favicon.svg | findstr "200"
echo.

echo [5/6] API - Active Calls...
curl -s %BASE%/api/active-calls
echo.
echo.

echo [6/6] API - OTP Request...
curl -s -X POST %BASE%/api/request-admin-otp -H "Content-Type: application/json"
echo.
echo.

echo ========================================
echo    Test Tamamlandi
echo ========================================
echo.
echo Tarayicida test et:
echo - Musteri: %BASE%/
echo - Admin:   %BASE%/admin
echo.
pause
