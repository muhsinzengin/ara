#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Yapı bütünlüğü kontrol scripti"""

import os
import sys

def check_file(path, name):
    """Dosya kontrolü"""
    exists = os.path.exists(path)
    status = "✅" if exists else "❌"
    print(f"{status} {name}: {path}")
    return exists

def check_dir(path, name):
    """Klasör kontrolü"""
    exists = os.path.isdir(path)
    status = "✅" if exists else "❌"
    print(f"{status} {name}: {path}")
    return exists

def main():
    print("=" * 50)
    print("  YAPI BÜTÜNLÜĞÜ KONTROLÜ")
    print("=" * 50)
    print()
    
    results = []
    
    # Ana klasörler
    print("📁 ANA KLASÖRLER:")
    results.append(check_dir("app", "app/"))
    results.append(check_dir("app/admin", "app/admin/"))
    results.append(check_dir("app/index", "app/index/"))
    results.append(check_dir("app/static", "app/static/"))
    print()
    
    # Admin dosyaları
    print("📁 ADMIN DOSYALARI:")
    results.append(check_file("app/admin/admin.html", "admin.html"))
    results.append(check_dir("app/admin/css", "admin/css/"))
    results.append(check_file("app/admin/css/style.css", "style.css"))
    results.append(check_file("app/admin/css/call-screen.css", "call-screen.css"))
    results.append(check_file("app/admin/css/notifications.css", "notifications.css"))
    results.append(check_dir("app/admin/js", "admin/js/"))
    results.append(check_file("app/admin/js/admin.js", "admin.js"))
    results.append(check_file("app/admin/js/notifications.js", "notifications.js"))
    print()
    
    # Index dosyaları
    print("📁 INDEX DOSYALARI:")
    results.append(check_file("app/index/index.html", "index.html"))
    results.append(check_dir("app/index/css", "index/css/"))
    results.append(check_file("app/index/css/style.css", "style.css"))
    results.append(check_dir("app/index/js", "index/js/"))
    results.append(check_file("app/index/js/app.js", "app.js"))
    results.append(check_file("app/index/js/notifications.js", "notifications.js"))
    print()
    
    # Static dosyaları
    print("📁 STATIC DOSYALARI:")
    results.append(check_dir("app/static/js", "static/js/"))
    results.append(check_file("app/static/js/signaling.js", "signaling.js"))
    results.append(check_file("app/static/favicon.svg", "favicon.svg"))
    results.append(check_file("app/static/manifest.json", "manifest.json"))
    print()
    
    # Backend dosyaları
    print("📁 BACKEND DOSYALARI:")
    results.append(check_file("server_v2.py", "server_v2.py"))
    results.append(check_file("otp_manager.py", "otp_manager.py"))
    results.append(check_file("telegram_notifier.py", "telegram_notifier.py"))
    results.append(check_file(".env", ".env"))
    results.append(check_file("start_server.bat", "start_server.bat"))
    print()
    
    # Sonuç
    total = len(results)
    passed = sum(results)
    failed = total - passed
    
    print("=" * 50)
    print(f"SONUÇ: {passed}/{total} test başarılı")
    print(f"✅ Başarılı: {passed}")
    print(f"❌ Başarısız: {failed}")
    print("=" * 50)
    
    if failed > 0:
        print("\n⚠️  UYARI: Bazı dosyalar eksik!")
        sys.exit(1)
    else:
        print("\n🎉 Tüm dosyalar mevcut!")
        sys.exit(0)

if __name__ == '__main__':
    main()
