@echo off
chcp 65001 >nul
echo ========================================
echo    SMOKE TEST - API Kontrolleri
echo ========================================
echo.

set PORT=8080
set BASE=http://localhost:%PORT%

echo [1/5] Health Check...
curl -s %BASE%/api/check-session
echo.
echo.

echo [2/5] Active Calls...
curl -s %BASE%/api/active-calls
echo.
echo.

echo [3/5] Call Logs...
curl -s %BASE%/api/call-logs
echo.
echo.

echo [4/5] OTP Request Test...
curl -s -X POST %BASE%/api/request-admin-otp -H "Content-Type: application/json"
echo.
echo.

echo [5/5] Static Files...
curl -s -I %BASE%/static/favicon.svg | findstr "200"
echo.

echo ========================================
echo    Test Tamamlandi
echo ========================================
pause
