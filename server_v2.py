#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import secrets
import threading
import time
import os
from datetime import datetime, timedelta
from urllib.parse import urlparse
import urllib.request
import urllib.parse as urlparse_lib

# Config (Railway environment variables)
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '8147965705:AAEcP0TEzq2G8DYW4INCD2wrH_0yki8Fjx0')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '5874850928')

# Storage
active_calls = {}
call_logs = []
otp_codes = {}
admin_sessions = {}
data_lock = threading.Lock()

def send_telegram(text):
    """Telegram mesaj gonder"""
    try:
        url = f'https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage'
        data = urlparse_lib.urlencode({
            'chat_id': TELEGRAM_CHAT_ID,
            'text': text,
            'parse_mode': 'HTML'
        }).encode()
        urllib.request.urlopen(url, data=data, timeout=5)
        return True
    except Exception as e:
        print(f"Telegram error: {e}")
        return False

def send_telegram_async(text):
    """Asenkron Telegram mesaj"""
    threading.Thread(target=lambda: send_telegram(text), daemon=True).start()

def generate_otp():
    """6 haneli OTP uret"""
    return f"{secrets.randbelow(900000) + 100000:06d}"

def create_otp(call_id):
    """OTP olustur ve kaydet"""
    otp = generate_otp()
    with data_lock:
        otp_codes[call_id] = {
            'code': otp,
            'expires': datetime.now() + timedelta(minutes=10),
            'attempts': 0,
            'created_at': datetime.now()
        }
    return otp

def verify_otp(call_id, otp_input):
    """OTP dogrula"""
    with data_lock:
        if call_id not in otp_codes:
            return False, 'Gecersiz veya suresi dolmus OTP'
        
        otp_data = otp_codes[call_id]
        
        if datetime.now() >= otp_data['expires']:
            del otp_codes[call_id]
            return False, 'OTP suresi dolmus (10 dakika)'
        
        if otp_data['attempts'] >= 5:
            del otp_codes[call_id]
            return False, 'Cok fazla yanlis deneme'
        
        if otp_data['code'] == otp_input:
            del otp_codes[call_id]
            return True, 'OTP dogrulandi'
        else:
            otp_data['attempts'] += 1
            remaining = 5 - otp_data['attempts']
            if remaining > 0:
                return False, f'Yanlis OTP. {remaining} deneme hakkiniz kaldi'
            else:
                del otp_codes[call_id]
                return False, 'Cok fazla yanlis deneme'

def cleanup_expired():
    """Suresi dolmus OTP'leri temizle"""
    with data_lock:
        current_time = datetime.now()
        expired = [cid for cid, data in otp_codes.items() if current_time >= data['expires']]
        for cid in expired:
            del otp_codes[cid]
        if expired:
            print(f"Cleaned {len(expired)} expired OTPs")

def cleanup_loop():
    """Otomatik temizlik"""
    while True:
        time.sleep(3600)
        cleanup_expired()

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Sessiz log
    
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        
        if path == '/':
            self.serve_file('app/index/index.html')
        elif path == '/admin':
            self.serve_file('app/admin/admin.html')
        elif path.startswith('/admin/'):
            self.serve_file('app' + path)
        elif path.startswith('/index/'):
            self.serve_file('app' + path)
        elif path.startswith('/static/'):
            self.serve_file('app' + path)
        elif path.startswith('/api/'):
            self.handle_api_get(path)
        else:
            self.send_error(404)
    
    def do_POST(self):
        path = urlparse(self.path).path
        if path.startswith('/api/'):
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body) if body else {}
            self.handle_api_post(path, data)
        else:
            self.send_error(404)
    
    def serve_file(self, file_path):
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            
            if file_path.endswith('.html'):
                content_type = 'text/html; charset=utf-8'
            elif file_path.endswith('.css'):
                content_type = 'text/css; charset=utf-8'
            elif file_path.endswith('.js'):
                content_type = 'application/javascript; charset=utf-8'
            elif file_path.endswith('.json'):
                content_type = 'application/json'
            elif file_path.endswith('.svg'):
                content_type = 'image/svg+xml'
            else:
                content_type = 'text/plain'
            
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', len(content))
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404)
    
    def handle_api_get(self, path):
        if path == '/healthz':
            self.send_json({
                'status': 'ok',
                'timestamp': datetime.now().isoformat(),
                'active_otps': len(otp_codes),
                'active_sessions': len(admin_sessions),
                'active_calls': len(active_calls)
            })
        
        elif path == '/api/active-calls':
            calls = []
            for call_id, call_data in active_calls.items():
                minutes_ago = int((datetime.now() - call_data['timestamp']).total_seconds() / 60)
                calls.append({
                    'call_id': call_id,
                    'customer_name': call_data['customer_name'],
                    'customer_peer_id': call_data.get('peer_id'),
                    'status': call_data['status'],
                    'formatted_date': call_data['timestamp'].strftime('%d.%m.%Y'),
                    'formatted_time': call_data['timestamp'].strftime('%H:%M'),
                    'minutes_ago': minutes_ago
                })
            self.send_json({'success': True, 'active_calls': calls})
        
        elif path == '/api/call-logs':
            logs = [{
                'customer_name': log['customer_name'],
                'start_time': log['start_time'].isoformat(),
                'duration': log['duration'],
                'status': log['status']
            } for log in call_logs]
            self.send_json({'success': True, 'logs': logs})
        
        elif path == '/api/check-session':
            self.send_json({'success': True, 'authenticated': False})
        
        else:
            self.send_json({'success': False, 'error': 'Unknown endpoint'})
    
    def handle_api_post(self, path, data):
        if path == '/api/request-admin-otp':
            call_id = secrets.token_urlsafe(16)
            otp = create_otp(call_id)
            
            current_time = datetime.now().strftime('%H:%M:%S')
            message = (
                f"🔐 <b>Admin Giris Talebi</b>\n\n"
                f"🕐 Saat: {current_time}\n"
                f"🔑 OTP: <code>{otp}</code>\n"
                f"🆔 Session: <code>{call_id[:8]}...</code>\n\n"
                f"⚠️ 10 dakika gecerli, 5 deneme hakki"
            )
            send_telegram_async(message)
            print(f"OTP created: {call_id[:8]}... -> {otp}")
            self.send_json({'success': True, 'callId': call_id})
        
        elif path == '/api/verify-otp':
            otp_input = data.get('otp', '').strip()
            call_id = data.get('callId', '')
            
            if not otp_input or len(otp_input) != 6 or not otp_input.isdigit():
                self.send_json({'success': False, 'error': 'OTP 6 haneli sayi olmali'})
                return
            
            if not call_id:
                with data_lock:
                    for cid, otp_data in otp_codes.items():
                        if otp_data['code'] == otp_input:
                            call_id = cid
                            break
            
            if not call_id:
                self.send_json({'success': False, 'error': 'Gecersiz OTP'})
                return
            
            success, message = verify_otp(call_id, otp_input)
            
            if success:
                with data_lock:
                    admin_sessions[call_id] = {
                        'authenticated': True,
                        'timestamp': datetime.now()
                    }
                print(f"Admin authenticated: {call_id[:8]}")
                self.send_json({'success': True, 'callId': call_id})
            else:
                self.send_json({'success': False, 'error': message})
        
        elif path == '/api/create-call':
            call_id = secrets.token_urlsafe(16)
            customer_name = data.get('customer_name', 'Misafir')
            otp = create_otp(call_id)
            
            active_calls[call_id] = {
                'customer_name': customer_name,
                'peer_id': data.get('peer_id'),
                'status': 'online',
                'timestamp': datetime.now()
            }
            
            current_time = datetime.now().strftime('%H:%M:%S')
            message = (
                f"📞 <b>{customer_name}</b> arama sayfasina girdi!\n\n"
                f"🔥 <b>Sizi ariyor ve baglanti bekliyor!</b>\n"
                f"⏰ Saat: {current_time}\n"
                f"🔐 Kod: <code>{otp}</code>\n"
                f"🆔 ID: <code>{call_id[:8]}...</code>\n\n"
                f"⚡ Musteriyi bekletmeyin!"
            )
            send_telegram_async(message)
            print(f"New call: {customer_name} ({call_id[:8]})")
            self.send_json({'success': True, 'call_id': call_id})
        
        elif path == '/api/update-call-status':
            call_id = data.get('callId')
            if call_id in active_calls:
                active_calls[call_id]['status'] = data.get('status')
                self.send_json({'success': True})
            else:
                self.send_json({'success': False})
        
        elif path == '/api/remove-user-activity':
            call_id = data.get('call_id')
            if call_id in active_calls:
                del active_calls[call_id]
                self.send_json({'success': True})
            else:
                self.send_json({'success': False})
        
        elif path == '/api/remove-multiple-activities':
            for call_id in data.get('call_ids', []):
                if call_id in active_calls:
                    del active_calls[call_id]
            self.send_json({'success': True})
        
        elif path == '/api/clear-all-activities':
            active_calls.clear()
            self.send_json({'success': True})
        
        else:
            self.send_json({'success': False, 'error': 'Unknown endpoint'})
    
    def send_json(self, data):
        content = json.dumps(data).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(content))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(content)

if __name__ == '__main__':
    threading.Thread(target=cleanup_loop, daemon=True).start()
    
    # Railway için PORT environment variable
    PORT = int(os.getenv('PORT', 8080))
    server = HTTPServer(('0.0.0.0', PORT), Handler)
    print(f'''
========================================
   Canli Destek Sistemi v2.0
========================================

Musteri: http://localhost:{PORT}/
Admin:   http://localhost:{PORT}/admin

Ozellikler:
- OTP Guvenlik: 6 haneli, 10 dk
- Telegram Bildirim: Aktif
- Otomatik Temizlik: Her 1 saat

Sunucu calisiyor... (Ctrl+C ile durdur)
''')
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n\nSunucu durduruldu.')
        with data_lock:
            print(f"\nSon durum:")
            print(f"- Aktif OTP: {len(otp_codes)}")
            print(f"- Aktif Session: {len(admin_sessions)}")
            print(f"- Aktif Arama: {len(active_calls)}")
        print("\nGule gule!\n")
