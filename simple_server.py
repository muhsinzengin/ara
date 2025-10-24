from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import json
from urllib.parse import urlparse, parse_qs
import secrets
from datetime import datetime, timedelta
import urllib.request
import urllib.parse as urlparse_lib
import threading
from otp_manager import OTPManager, start_cleanup_thread
from telegram_notifier import send_telegram_async

# Telegram config
TELEGRAM_BOT_TOKEN = '8033290671:AAF4QdGB6AsGQDbnYXxUpXakcsb9aAeyW6M'
TELEGRAM_CHAT_ID = '5874850928'

# In-memory storage
active_calls = {}
call_logs = []
call_recordings = {}  # call_id -> recording data

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        
        # Route handling
        if path == '/':
            self.serve_file('app/index/index.html')
        elif path == '/admin':
            self.serve_file('app/admin/admin.html')
        elif path.startswith('/admin/'):
            file_path = 'app' + path
            self.serve_file(file_path)
        elif path.startswith('/static/'):
            file_path = 'app' + path
            self.serve_file(file_path)
        elif path.startswith('/api/'):
            self.handle_api_get(path)
        else:
            self.send_error(404)
    
    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        
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
            
            # Content type
            if file_path.endswith('.html'):
                content_type = 'text/html'
            elif file_path.endswith('.css'):
                content_type = 'text/css'
            elif file_path.endswith('.js'):
                content_type = 'application/javascript'
            elif file_path.endswith('.json'):
                content_type = 'application/json'
            elif file_path.endswith('.svg'):
                content_type = 'image/svg+xml'
            else:
                content_type = 'text/plain'
            
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404)
    
    def handle_api_get(self, path):
        global active_calls, call_logs
        
        if path == '/api/active-calls':
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
            logs = []
            for log in call_logs:
                log_data = {
                    'customer_name': log['customer_name'],
                    'start_time': log['start_time'].isoformat(),
                    'duration': log['duration'],
                    'status': log['status']
                }
                # Add recording info if available
                if log.get('call_id') and log['call_id'] in call_recordings:
                    log_data['has_recording'] = True
                    log_data['recording_id'] = log['call_id']
                else:
                    log_data['has_recording'] = False
                logs.append(log_data)
            self.send_json({'success': True, 'logs': logs})
        
        elif path == '/api/check-session':
            self.send_json({'success': True, 'authenticated': False})

        elif path.startswith('/api/download-recording/'):
            recording_id = path.split('/')[-1]
            if recording_id and recording_id in call_recordings:
                recording = call_recordings[recording_id]
                content = json.dumps(recording, indent=2).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Disposition', f'attachment; filename="call_recording_{recording_id}.json"')
                self.send_header('Content-Length', str(len(content)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404, 'Recording not found')

        else:
            self.send_json({'success': False, 'error': 'Unknown endpoint'})
    
    def handle_api_post(self, path, data):
        global admin_otp, otp_expiry, active_calls, call_logs
        
        if path == '/api/request-admin-otp':
            call_id = secrets.token_urlsafe(16)
            otp = OTPManager.create_otp(call_id, 'admin')
            
            current_time = datetime.now().strftime('%H:%M:%S')
            message = (
                f"🔐 <b>Admin Giris Talebi</b>\n\n"
                f"🕐 Saat: {current_time}\n"
                f"🔑 OTP: <code>{otp}</code>\n"
                f"🆔 Session ID: <code>{call_id[:8]}...</code>\n\n"
                f"⚠️ Bu kod 10 dakika gecerlidir.\n"
                f"⚠️ Maksimum 5 deneme hakkiniz var."
            )
            
            send_telegram_async(message)
            self.send_json({'success': True, 'callId': call_id})
        
        elif path == '/api/verify-otp':
            otp_input = data.get('otp', '').strip()
            call_id = data.get('callId', '')
            
            # OTP format kontrolü
            if not otp_input or len(otp_input) != 6 or not otp_input.isdigit():
                self.send_json({'success': False, 'error': 'OTP 6 haneli sayi olmali'})
                return
            
            # Call ID yoksa OTP ile ara
            if not call_id:
                from otp_manager import otp_codes, data_lock
                with data_lock:
                    for cid, otp_data in otp_codes.items():
                        if otp_data['code'] == otp_input:
                            call_id = cid
                            break
            
            if not call_id:
                self.send_json({'success': False, 'error': 'Gecersiz OTP'})
                return
            
            # OTP doğrula
            success, message = OTPManager.verify_otp(call_id, otp_input)
            
            if success:
                # Session oluştur
                OTPManager.create_session(call_id, 'localhost')
                print(f"Admin authenticated: {call_id[:8]}")
                self.send_json({'success': True, 'callId': call_id})
            else:
                self.send_json({'success': False, 'error': message})
        
        elif path == '/api/create-call':
            call_id = secrets.token_urlsafe(16)
            customer_name = data.get('customer_name', 'Misafir')
            otp = OTPManager.create_otp(call_id, 'customer')
            
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
                f"⏰ Giris Saati: {current_time}\n"
                f"🔐 Dogrulama Kodu: <code>{otp}</code>\n"
                f"🆔 Arama ID: <code>{call_id[:8]}...</code>\n\n"
                f"👨💼 Hemen Admin Paneline Git\n"
                f"⚡ Musteriyi bekletmeyin!"
            )
            
            send_telegram_async(message)
            print(f'Yeni arama: {customer_name} ({call_id[:8]})')
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

        elif path == '/api/clear-active-calls':
            active_calls.clear()
            self.send_json({'success': True})

        elif path == '/api/save-call-recording':
            call_id = data.get('call_id')
            recording_data = data.get('recording_data', {})

            if call_id:
                call_recordings[call_id] = {
                    'call_id': call_id,
                    'customer_name': recording_data.get('customer_name', 'Unknown'),
                    'start_time': recording_data.get('start_time'),
                    'end_time': recording_data.get('end_time'),
                    'duration': recording_data.get('duration', 0),
                    'webrtc_stats': recording_data.get('webrtc_stats', {}),
                    'connection_info': recording_data.get('connection_info', {}),
                    'saved_at': datetime.now().isoformat()
                }
                self.send_json({'success': True, 'recording_id': call_id})
            else:
                self.send_json({'success': False, 'error': 'Call ID required'})

        elif path == '/api/download-call-recording':
            recording_id = data.get('recording_id')
            if recording_id and recording_id in call_recordings:
                recording = call_recordings[recording_id]
                self.send_json({
                    'success': True,
                    'recording': recording
                })
            else:
                self.send_json({'success': False, 'error': 'Recording not found'})

        else:
            self.send_json({'success': False, 'error': 'Unknown endpoint'})
    
    def send_json(self, data):
        content = json.dumps(data).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(content)

if __name__ == '__main__':
    # OTP temizlik thread'ini başlat
    start_cleanup_thread()
    
    port = 8080
    server = HTTPServer(('0.0.0.0', port), Handler)
    print(f'''
========================================
   Canli Destek Sistemi Baslatildi
========================================

Musteri: http://localhost:{port}/
Admin:   http://localhost:{port}/admin

Ozellikler:
- OTP Guvenlik: 6 haneli, 10 dk gecerli
- Telegram Bildirim: Aktif
- Otomatik Temizlik: Her 1 saat

Sunucu calisiyor... (Ctrl+C ile durdur)
''')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n\nSunucu durduruldu.')
        # İstatistikleri göster
        stats = OTPManager.get_stats()
        print(f"\nSon durum:")
        print(f"- Aktif OTP: {stats['active_otps']}")
        print(f"- Aktif Session: {stats['active_sessions']}")
        print(f"- Aktif Arama: {len(active_calls)}")
        print(f"- Toplam Log: {len(call_logs)}")
        print("\nGule gule!\n")
