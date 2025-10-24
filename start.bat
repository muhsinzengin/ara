@echo off
echo ========================================
echo   Canli Destek Sistemi Baslatiliyor
echo ========================================
echo.

if not exist .env (
    echo [UYARI] .env dosyasi bulunamadi!
    echo .env.example dosyasini .env olarak kopyalayin ve duzenleyin.
    echo.
    pause
    exit /b
)

echo [1/2] Bagimliliklari kontrol ediliyor...
pip install -q -r requirements.txt

echo [2/2] Sunucu baslatiliyor...
echo.
echo Erisim adresleri:
echo   - Musteri: http://localhost:8080/
echo   - Admin:   http://localhost:8080/admin
echo.
python server.py
