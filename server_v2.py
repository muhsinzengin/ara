#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import secrets
import threading
import time
import os
import ssl
import logging
import traceback
import signal
import sys
from datetime import datetime, timedelta
from urllib.parse import urlparse, urlencode
import urllib.request
from dotenv import load_dotenv
from otp_manager import OTPManager
from metrics import (
    record_request_metrics, record_call_metrics, record_rate_limit_metrics,
    get_system_metrics, get_historical_metrics, export_metrics
)
from metrics import metrics_collector
from database import DatabaseManager
from typing import Dict, List, Optional, Any

# Load .env file
load_dotenv()

# Config (Environment variables)
TELEGRAM_BOT_TOKEN: Optional[str] = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID: Optional[str] = os.getenv('TELEGRAM_CHAT_ID')
BASE_URL: str = os.getenv('BASE_URL', 'http://localhost:8080')
HTTPS_ENABLED: bool = os.getenv('HTTPS_ENABLED', 'false').lower() == 'true'
ALLOWED_ORIGINS: List[str] = os.getenv('ALLOWED_ORIGINS', 'http://localhost:8080').split(',')
RATE_LIMIT_ENABLED: bool = os.getenv('RATE_LIMIT_ENABLED', 'true').lower() == 'true'
LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO').upper()
PRODUCTION_MODE: bool = os.getenv('PRODUCTION', 'false').lower() == 'true'

# Production Configuration
SESSION_TIMEOUT_HOURS: int = int(os.getenv('SESSION_TIMEOUT_HOURS', '8'))
RATE_LIMIT_CALLS: int = int(os.getenv('RATE_LIMIT_CALLS', '20'))
RATE_LIMIT_PERIOD: int = int(os.getenv('RATE_LIMIT_PERIOD', '60'))
HEARTBEAT_INTERVAL: int = int(os.getenv('HEARTBEAT_INTERVAL', '30'))
CLEANUP_INTERVAL: int = int(os.getenv('CLEANUP_INTERVAL', '60'))
MAX_CALL_DURATION_HOURS: int = int(os.getenv('MAX_CALL_DURATION_HOURS', '2'))
DB_PATH: str = os.getenv('DB_PATH', 'production_data.db')
DATABASE_URL: Optional[str] = os.getenv('DATABASE_URL')
LOG_FILE: str = os.getenv('LOG_FILE', 'production.log')
LOG_MAX_SIZE_MB: int = int(os.getenv('LOG_MAX_SIZE_MB', '10'))
LOG_BACKUP_COUNT: int = int(os.getenv('LOG_BACKUP_COUNT', '5'))

# Logging configuration
def setup_logging() -> logging.Logger:
    """Production-ready structured logging setup"""
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(getattr(logging, LOG_LEVEL))
    console_formatter = logging.Formatter(log_format)
    console_handler.setFormatter(console_formatter)
    
    # File handler (production)
    if PRODUCTION_MODE:
        from logging.handlers import RotatingFileHandler
        file_handler = RotatingFileHandler(
            LOG_FILE, 
            maxBytes=LOG_MAX_SIZE_MB * 1024 * 1024, 
            backupCount=LOG_BACKUP_COUNT,
            encoding='utf-8'
        )
    else:
        file_handler = logging.FileHandler('app.log', encoding='utf-8')
    
    file_handler.setLevel(logging.INFO)
    file_formatter = logging.Formatter(log_format)
    file_handler.setFormatter(file_formatter)
    
    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    
    return root_logger

# Initialize logging
logger = setup_logging()

# Global server instance for graceful shutdown
server_instance: Optional[HTTPServer] = None

# Custom exceptions
class APIError(Exception):
    """Custom API exception"""
    def __init__(self, message: str, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class ValidationError(APIError):
    """Input validation error"""
    def __init__(self, message: str) -> None:
        super().__init__(message, 422)

class RateLimitError(APIError):
    """Rate limit exceeded error"""
    def __init__(self, message: str = "Rate limit exceeded") -> None:
        super().__init__(message, 429)

class AuthenticationError(APIError):
    """Authentication error"""
    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(message, 401)

# Error handling decorator - Currently unused but kept for future use

if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
    if os.getenv('DEBUG', 'false').lower() == 'true':
        print('WARNING: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID not set. Telegram notifications disabled.')
    TELEGRAM_ENABLED = False
else:
    TELEGRAM_ENABLED = True

# Rate limiting configuration

def check_rate_limit(client_ip):
    """Rate limiting kontrolü - OTPManager kullanarak"""
    if not RATE_LIMIT_ENABLED:
        return True
    
    # OTPManager'daki rate limiting'i kullan
    if not OTPManager.check_rate_limit(client_ip):
        logger.warning(f"Rate limit exceeded for IP: {client_ip}")
        record_rate_limit_metrics(client_ip)
        raise RateLimitError()
    
    return True

def validate_input(data, required_fields=None, max_length=None):
    """Input validation"""
    if required_fields:
        for field in required_fields:
            if field not in data:
                raise ValidationError(f"Missing required field: {field}")
    
    if max_length:
        for field, value in data.items():
            if isinstance(value, str) and len(value) > max_length.get(field, 1000):
                raise ValidationError(f"Field {field} too long")
    
    # XSS protection
    for field, value in data.items():
        if isinstance(value, str):
            if any(char in value for char in ['<', '>', '"', "'", '&']):
                raise ValidationError(f"Invalid characters in field {field}")
    
    return True

def sanitize_input(text):
    """Input sanitization"""
    if not isinstance(text, str):
        return text
    
    # HTML entities
    replacements = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
    }
    
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)
    
    return text

# Storage
active_calls: Dict[str, Dict[str, Any]] = {}
call_logs: List[Dict[str, Any]] = []
otp_codes: Dict[str, Any] = {}
admin_sessions: Dict[str, Dict[str, Any]] = {}
data_lock: threading.Lock = threading.Lock()


def generate_csrf_token():
    """CSRF token üret"""
    return secrets.token_urlsafe(32)

def validate_csrf_token(token, session_token):
    """CSRF token doğrula"""
    if not token or not session_token:
        return False
    return token == session_token

def create_secure_session(call_id, ip_address):
    """Güvenli session oluştur"""
    csrf_token = generate_csrf_token()
    session_data = {
        'authenticated': True,
        'timestamp': datetime.now(),
        'expires': datetime.now() + timedelta(hours=SESSION_TIMEOUT_HOURS),
        'ip_address': ip_address,
        'csrf_token': csrf_token,
        'user_agent': None  # Will be set by handler
    }
    return session_data, csrf_token

def send_telegram(text: str) -> bool:
    """
    Send message to Telegram bot.
    
    Args:
        text (str): Message text to send (HTML format supported)
        
    Returns:
        bool: True if message sent successfully, False otherwise
        
    Note:
        Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables
    """
    if not TELEGRAM_ENABLED:
        return False
    try:
        url = f'https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage'
        data = urlencode({
            'chat_id': TELEGRAM_CHAT_ID,
            'text': text,
            'parse_mode': 'HTML'
        }).encode()
        urllib.request.urlopen(url, data=data, timeout=5)
        return True
    except Exception as e:
        logger.error(f"Telegram error: {e}")
        return False

def send_telegram_async(text):
    """Asenkron Telegram mesaj"""
    threading.Thread(target=lambda: send_telegram(text), daemon=True).start()

# OTP functions now use OTPManager
create_otp = OTPManager.create_otp
verify_otp = OTPManager.verify_otp

# Utility functions for common operations
def log_call_event(call_id: str, event_type: str, customer_name: str = None, duration: int = None) -> None:
    """Log call events consistently"""
    event_data = {
        'call_id': call_id[:8] if call_id else 'unknown',
        'event_type': event_type,
        'timestamp': datetime.now(),
        'customer_name': customer_name,
        'duration': duration
    }
    logger.info(f"Call event: {event_type} - {event_data}")

def create_call_log_entry(call_data: dict, status: str, duration: int = None) -> dict:
    """Create standardized call log entry"""
    return {
        'customer_name': call_data['customer_name'],
        'start_time': call_data['timestamp'],
        'duration': duration or int((datetime.now() - call_data['timestamp']).total_seconds()),
        'status': status
    }

def remove_call_from_active(call_id: str, reason: str = 'unknown') -> bool:
    """Remove call from active calls and log the event"""
    if call_id not in active_calls:
        return False
    
    call_data = active_calls[call_id]
    
    # Create log entry
    duration = None
    if call_data.get('status') == 'connected':
        duration = int((datetime.now() - call_data['timestamp']).total_seconds())
        call_logs.append(create_call_log_entry(call_data, reason, duration))
    
    # Record metrics
    record_call_metrics(f'call_{reason}', call_id, call_data['customer_name'], duration)
    
    # Remove from active calls
    del active_calls[call_id]
    log_call_event(call_id, f'call_{reason}', call_data['customer_name'])
    
    return True

def cleanup_expired():
    """Suresi dolmus OTP, session ve offline cagrılari temizle"""
    try:
        # OTP ve session temizleme (OTPManager kullan)
        OTPManager.cleanup_expired()
        
        # Offline cagrı temizleme
        with data_lock:
            current_time = datetime.now()
            offline_calls = [
                cid for cid, call in active_calls.items()
                if 'last_heartbeat' in call and (current_time - call['last_heartbeat']).total_seconds() > 120
            ]
            
            for cid in offline_calls:
                remove_call_from_active(cid, 'disconnected')
            
            if offline_calls:
                logger.info(f"Cleaned {len(offline_calls)} offline calls")
                
    except Exception as e:
        logger.error(f"Error in cleanup_expired: {str(e)}")

def cleanup_old_logs():
    """Clean up old log files in production"""
    try:
        import glob
        log_files = glob.glob(f"{LOG_FILE}.*")
        for log_file in log_files:
            if os.path.exists(log_file):
                file_age = time.time() - os.path.getmtime(log_file)
                if file_age > 7 * 24 * 3600:  # 7 days
                    os.remove(log_file)
                    logger.info(f"Removed old log file: {log_file}")
    except Exception as e:
        logger.error(f"Error cleaning old logs: {str(e)}")

def cleanup_database():
    """Clean up database in production"""
    try:
        cutoff_time = datetime.now() - timedelta(days=30)
        dbm = DatabaseManager(DB_PATH)
        removed_calls = 0
        removed_logs = 0
        with dbm.get_connection() as conn:
            cur = conn.cursor()
            # Remove calls that ended before cutoff
            cur.execute(
                "DELETE FROM calls WHERE end_time IS NOT NULL AND end_time < ?",
                (cutoff_time.strftime('%Y-%m-%d %H:%M:%S'),)
            )
            removed_calls = cur.rowcount if cur.rowcount is not None else 0
            # Remove call logs older than cutoff
            cur.execute(
                "DELETE FROM call_logs WHERE start_time < ?",
                (cutoff_time.strftime('%Y-%m-%d %H:%M:%S'),)
            )
            removed_logs = cur.rowcount if cur.rowcount is not None else 0
            conn.commit()
        logger.info(f"Database cleanup completed: calls={removed_calls}, logs={removed_logs}")
    except Exception as e:
        logger.error(f"Error cleaning database: {str(e)}")

def cleanup_loop():
    """Production cleanup loop with configurable intervals"""
    while True:
        try:
            time.sleep(CLEANUP_INTERVAL)
            cleanup_expired()
            
            # Update system metrics: active calls and memory usage
            try:
                import psutil
                memory_usage_mb = psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)
            except Exception:
                memory_usage_mb = 0.0
            metrics_collector.update_system_metrics(
                active_calls=len(active_calls),
                memory_usage_mb=memory_usage_mb
            )
            
            # Production-specific cleanup
            if PRODUCTION_MODE:
                cleanup_old_logs()
                cleanup_database()
                
        except Exception as e:
            logger.error(f"Error in cleanup_loop: {str(e)}")
            time.sleep(5)  # Hata durumunda kısa bekle

def signal_handler(signum, frame):
    """Graceful shutdown handler"""
    logger.info(f"Received signal {signum}, initiating graceful shutdown...")
    
    # Cleanup
    cleanup_expired()
    
    # Close server
    if server_instance:
        logger.info("Shutting down server...")
        server_instance.shutdown()
        server_instance.server_close()
    
    logger.info("Graceful shutdown completed")
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Sessiz log
    
    def _record_request_metrics(self, start_time: float, status_code: int = 200) -> None:
        """Record request metrics"""
        response_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        record_request_metrics(self.path, response_time, status_code)
    
    def end_headers(self):
        # Security headers
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        # Allow camera/microphone on same-origin; remove unsupported speaker-selection
        self.send_header('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()')
        
        # CORS headers
        origin = self.headers.get('Origin', '')
        host_header = self.headers.get('Host', '')
        origin_host = urlparse(origin).netloc if origin else ''
        
        if origin and (origin in ALLOWED_ORIGINS or '*' in ALLOWED_ORIGINS or (origin_host == host_header)):
            # Allow listed origins or same-origin dynamically
            self.send_header('Access-Control-Allow-Origin', origin)
        else:
            # Fallback to configured base or first allowed origin
            fallback_origin = ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else BASE_URL
            self.send_header('Access-Control-Allow-Origin', fallback_origin)
        
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Call-ID')
        self.send_header('Access-Control-Allow-Credentials', 'true')
        # HTTPS enforcement
        if HTTPS_ENABLED:
            self.send_header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
        
        # Performance headers
        self.send_header('Cache-Control', 'public, max-age=3600')  # 1 hour cache for static files
        self.send_header('X-Content-Type-Options', 'nosniff')
        
        super().end_headers()
    
    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        start_time = time.time()
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            
            if path == '/':
                self.serve_file('app/index/index.html')
            elif path == '/favicon.ico':
                # Provide favicon for all pages
                self.serve_file('app/static/favicon.svg')
            elif path == '/admin':
                self.serve_file('app/admin/admin.html')
            elif path == '/webrtc-test':
                self.serve_file('webrtc-test.html')
            elif path == '/dashboard':
                self.serve_file('app/dashboard/dashboard.html')
            elif path.startswith('/admin/'):
                self.serve_file('app' + path)
            elif path.startswith('/index/'):
                self.serve_file('app' + path)
            elif path.startswith('/static/'):
                self.serve_file('app' + path)
            elif path == '/healthz':
                # Alias to API health endpoint for compatibility with docs
                self.handle_api_get('/api/healthz')
            elif path.startswith('/api/'):
                self.handle_api_get(path)
            else:
                self.send_error(404)
        finally:
            self._record_request_metrics(start_time)
    
    def do_POST(self):
        start_time = time.time()
        try:
            path = urlparse(self.path).path
            if path.startswith('/api/'):
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length).decode('utf-8')
                
                # Safe JSON parsing
                try:
                    data = json.loads(body) if body else {}
                except json.JSONDecodeError as e:
                    logger.warning(f"Invalid JSON in POST request: {e}")
                    self.send_json({'success': False, 'error': 'Invalid JSON format'})
                    return
                
                self.handle_api_post(path, data)
            else:
                self.send_error(404)
        finally:
            self._record_request_metrics(start_time)
    
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
        if path == '/api/healthz':
            self.send_json({
                'status': 'ok',
                'timestamp': datetime.now().isoformat(),
                'uptime': int(time.time() - server_start_time),
                'active_otps': OTPManager.get_stats()['active_otps'],
                'active_sessions': len(admin_sessions),
                'active_calls': len(active_calls),
                'version': '2.0'
            })
        
        elif path == '/api/metrics':
            # System metrics
            metrics = get_system_metrics()
            self.send_json({'success': True, 'metrics': metrics})
        
        elif path == '/api/admin-stats':
            # Admin panel için istatistikler
            with data_lock:
                stats = {
                    'active_calls': len(active_calls),
                    'queue_count': len([c for c in active_calls.values() if c.get('status') == 'waiting']),
                    'today_calls': len([c for c in active_calls.values() if c.get('start_time', '').startswith(datetime.now().strftime('%Y-%m-%d'))]),
                    'week_calls': len([c for c in active_calls.values() if c.get('start_time', '').startswith(datetime.now().strftime('%Y-%W'))]),
                    'month_calls': len([c for c in active_calls.values() if c.get('start_time', '').startswith(datetime.now().strftime('%Y-%m'))]),
                    'year_calls': len([c for c in active_calls.values() if c.get('start_time', '').startswith(datetime.now().strftime('%Y'))])
                }
                self.send_json({'success': True, 'stats': stats})
        
        elif path == '/api/admin-calls':
            # Admin panel için aktif görüşmeler
            with data_lock:
                calls_list = []
                for call_id, call_data in active_calls.items():
                    calls_list.append({
                        'call_id': call_id,
                        'customer_name': call_data.get('customer_name', ''),
                        'status': call_data.get('status', 'waiting'),
                        'start_time': call_data.get('start_time', ''),
                        'admin_connected': call_data.get('admin_connected', False)
                    })
                self.send_json({'success': True, 'calls': calls_list})
        
        elif path == '/api/webrtc-offer':
            # WebRTC offer al
            call_id = self.headers.get('X-Call-ID', '')
            if not call_id:
                self.send_json({'success': False, 'error': 'Call ID required'})
                return
            
            with data_lock:
                if call_id in active_calls and 'offer' in active_calls[call_id]:
                    self.send_json({
                        'success': True,
                        'offer': active_calls[call_id]['offer'],
                        'offer_time': active_calls[call_id].get('offer_time', '')
                    })
                else:
                    self.send_json({'success': False, 'error': 'No offer available'})
        
        elif path == '/api/webrtc-answer':
            # WebRTC answer al
            call_id = self.headers.get('X-Call-ID', '')
            if not call_id:
                self.send_json({'success': False, 'error': 'Call ID required'})
                return
            
            with data_lock:
                if call_id in active_calls and 'answer' in active_calls[call_id]:
                    self.send_json({
                        'success': True,
                        'answer': active_calls[call_id]['answer'],
                        'answer_time': active_calls[call_id].get('answer_time', '')
                    })
                else:
                    self.send_json({'success': False, 'error': 'No answer available'})
        
        elif path == '/api/ice-candidates':
            # ICE candidates al
            call_id = self.headers.get('X-Call-ID', '')
            if not call_id:
                self.send_json({'success': False, 'error': 'Call ID required'})
                return
            
            with data_lock:
                if call_id in active_calls and 'ice_candidates' in active_calls[call_id]:
                    self.send_json({
                        'success': True,
                        'candidates': active_calls[call_id]['ice_candidates']
                    })
                else:
                    self.send_json({'success': False, 'error': 'No ICE candidates available'})
        
        elif path.startswith('/api/call-status/'):
            # Get call status with offer
            call_id = path.split('/')[-1]
            
            with data_lock:
                if call_id in active_calls:
                    call_data = active_calls[call_id]
                    self.send_json({
                        'success': True,
                        'call_id': call_id,
                        'status': call_data.get('status', 'unknown'),
                        'offer': call_data.get('offer'),
                        'answer': call_data.get('answer'),
                        'ice_candidates': call_data.get('ice_candidates', [])
                    })
                else:
                    self.send_json({'success': False, 'error': 'Call not found'})
        
        elif path == '/api/metrics/export':
            format_type = self.headers.get('X-Format', 'json')
            try:
                exported = export_metrics(format_type)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json' if format_type == 'json' else 'text/csv')
                self.end_headers()
                self.wfile.write(exported.encode('utf-8'))
            except Exception as e:
                self.send_json({'success': False, 'error': str(e)})
        
        elif path == '/api/active-calls':
            calls = []
            for call_id, call_data in active_calls.items():
                # Parse start_time if it's a string
                start_time = call_data.get('start_time')
                if isinstance(start_time, str):
                    start_time = datetime.fromisoformat(start_time)
                
                minutes_ago = int((datetime.now() - start_time).total_seconds() / 60)
                calls.append({
                    'call_id': call_id,
                    'customer_name': call_data['customer_name'],
                    'customer_peer_id': call_data.get('peer_id'),
                    'status': call_data['status'],
                    'formatted_date': start_time.strftime('%d.%m.%Y'),
                    'formatted_time': start_time.strftime('%H:%M'),
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
            call_id = self.headers.get('X-Call-ID')
            authenticated = False
            
            if call_id and call_id in admin_sessions:
                session = admin_sessions[call_id]
                if datetime.now() < session['expires']:
                    authenticated = True
                else:
                    with data_lock:
                        del admin_sessions[call_id]
            
            self.send_json({'success': True, 'authenticated': authenticated})
        
        else:
            self.send_json({'success': False, 'error': 'Unknown endpoint'})
    
    def check_admin_auth(self):
        """Admin session kontrolu - gelişmiş güvenlik"""
        call_id = self.headers.get('X-Call-ID')
        if not call_id or call_id not in admin_sessions:
            return False
        
        session = admin_sessions[call_id]
        
        # Süre kontrolü
        if datetime.now() >= session['expires']:
            with data_lock:
                if call_id in admin_sessions:
                    del admin_sessions[call_id]
            return False
        
        # IP adresi kontrolü
        client_ip = self.client_address[0]
        if session.get('ip_address') != client_ip:
            if os.getenv('DEBUG', 'false').lower() == 'true':
                print(f"IP mismatch: session={session.get('ip_address')}, client={client_ip}")
            return False
        
        # User-Agent kontrolü (opsiyonel)
        user_agent = self.headers.get('User-Agent', '')
        if session.get('user_agent') and session.get('user_agent') != user_agent:
            if os.getenv('DEBUG', 'false').lower() == 'true':
                print(f"User-Agent mismatch detected")
            # User-Agent değişikliği kritik değil, sadece logla
        
        return True
    
    def handle_api_post(self, path, data):
        try:
            # Rate limiting kontrolü
            client_ip = self.client_address[0]
            check_rate_limit(client_ip)
            
            # Input validation
            validate_input(data, max_length={'customer_name': 50, 'otp': 6})
            
            # Sanitize input
            for key, value in data.items():
                if isinstance(value, str):
                    data[key] = sanitize_input(value)
                    
        except (RateLimitError, ValidationError) as e:
            self.send_json({'success': False, 'error': e.message})
            return
        except Exception as e:
            logger.error(f"Error in handle_api_post: {str(e)}")
            self.send_json({'success': False, 'error': 'Internal server error'})
            return
        if path == '/api/request-admin-otp':
            call_id = secrets.token_urlsafe(16)
            otp = create_otp(call_id)
            
            current_time = datetime.now().strftime('%H:%M:%S')
            message = (
                f"🔐 Admin Giriş Talebi\n\n"
                f"🕐 Saat: {current_time}\n"
                f"🔑 OTP: <code>{otp}</code>\n"
                f"🆔 Session ID: <code>{call_id[:8]}...</code>\n\n"
                f"⚠ Bu kod 10 dakika geçerlidir."
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
                call_id = OTPManager.find_call_id_by_code(otp_input) or ''
            
            if not call_id:
                self.send_json({'success': False, 'error': 'Gecersiz OTP'})
                return
            
            success, message = verify_otp(call_id, otp_input)
            
            if success:
                client_ip = self.client_address[0]
                user_agent = self.headers.get('User-Agent', '')
                session_data, csrf_token = create_secure_session(call_id, client_ip)
                session_data['user_agent'] = user_agent
                
                with data_lock:
                    admin_sessions[call_id] = session_data
                
                if os.getenv('DEBUG', 'false').lower() == 'true':
                    print(f"Admin authenticated: {call_id[:8]} (12 saat gecerli, IP: {client_ip})")
                
                self.send_json({'success': True, 'callId': call_id, 'csrfToken': csrf_token})
            else:
                self.send_json({'success': False, 'error': message})
        
        elif path == '/api/create-call':
            call_id = secrets.token_urlsafe(16)
            customer_name = data.get('customer_name', 'Misafir')
            
            # Create call record
            with data_lock:
                active_calls[call_id] = {
                    'customer_name': customer_name,
                    'status': 'waiting',
                    'start_time': datetime.now().isoformat(),
                    'admin_connected': False,
                    'last_heartbeat': datetime.now()
                }
            
            # Send Telegram notification
            current_time = datetime.now().strftime('%H:%M:%S')
            message = (
                f"📞 <b>{customer_name}</b> arama sayfasına girdi!\n\n"
                f"🔥 Sizi arıyor ve bağlantı bekliyor!\n"
                f"⏰ Giriş Saati: {current_time}\n"
                f"🆔 Arama ID: <code>{call_id[:8]}</code>\n\n"
                f"👨‍💼 Hemen Admin Paneline Git\n"
                f"http://localhost:8080/admin\n"
                f"⚡ Müşteriyi bekletmeyin!"
            )
            send_telegram_async(message)
            
            # Record metrics
            record_call_metrics('call_started', call_id, customer_name)
            
            self.send_json({'success': True, 'call_id': call_id})
        
        elif path == '/api/heartbeat':
            call_id = data.get('callId', '')
            if not call_id:
                self.send_json({'success': False, 'error': 'Call ID required'})
                return
            
            # Update last heartbeat time
            with data_lock:
                if call_id in active_calls:
                    active_calls[call_id]['last_heartbeat'] = datetime.now()
                    self.send_json({'success': True, 'status': 'alive'})
                else:
                    self.send_json({'success': False, 'error': 'Call not found'})
        
        elif path == '/api/call-status':
            call_id = data.get('callId', '')
            if not call_id:
                self.send_json({'success': False, 'error': 'Call ID required'})
                return
            
            with data_lock:
                if call_id in active_calls:
                    call_data = active_calls[call_id]
                    self.send_json({
                        'success': True,
                        'status': call_data.get('status', 'waiting'),
                        'customer_name': call_data.get('customer_name', ''),
                        'start_time': call_data.get('start_time', ''),
                        'admin_connected': call_data.get('admin_connected', False)
                    })
                else:
                    self.send_json({'success': False, 'error': 'Call not found'})
        
        elif path == '/api/admin-stats':
            # Admin panel için istatistikler
            with data_lock:
                stats = {
                    'active_calls': len(active_calls),
                    'queue_count': len([c for c in active_calls.values() if c.get('status') == 'waiting']),
                    'today_calls': len([c for c in active_calls.values() if c.get('start_time', '').startswith(datetime.now().strftime('%Y-%m-%d'))]),
                    'week_calls': len([c for c in active_calls.values() if c.get('start_time', '').startswith(datetime.now().strftime('%Y-%W'))]),
                    'month_calls': len([c for c in active_calls.values() if c.get('start_time', '').startswith(datetime.now().strftime('%Y-%m'))]),
                    'year_calls': len([c for c in active_calls.values() if c.get('start_time', '').startswith(datetime.now().strftime('%Y'))])
                }
                self.send_json({'success': True, 'stats': stats})
        
        elif path == '/api/admin-calls':
            # Admin panel için aktif görüşmeler
            with data_lock:
                calls_list = []
                for call_id, call_data in active_calls.items():
                    calls_list.append({
                        'call_id': call_id,
                        'customer_name': call_data.get('customer_name', ''),
                        'status': call_data.get('status', 'waiting'),
                        'start_time': call_data.get('start_time', ''),
                        'admin_connected': call_data.get('admin_connected', False)
                    })
                self.send_json({'success': True, 'calls': calls_list})
        
        elif path == '/api/accept-call':
            # Admin authentication check
            if not self.check_admin_auth():
                self.send_json({'success': False, 'error': 'Unauthorized'})
                return
                
            call_id = data.get('callId', '')
            if not call_id:
                self.send_json({'success': False, 'error': 'Call ID required'})
                return
            
            with data_lock:
                if call_id in active_calls:
                    active_calls[call_id]['status'] = 'connected'
                    active_calls[call_id]['admin_connected'] = True
                    active_calls[call_id]['admin_connect_time'] = datetime.now().isoformat()
                    self.send_json({'success': True, 'message': 'Call accepted'})
                else:
                    self.send_json({'success': False, 'error': 'Call not found'})
        
        elif path == '/api/end-call':
            call_id = data.get('callId', '')
            if not call_id:
                self.send_json({'success': False, 'error': 'Call ID required'})
                return
            
            with data_lock:
                if call_id in active_calls:
                    call_data = active_calls.pop(call_id)
                    # Log call end
                    log_call_event(call_id, 'call_ended', {
                        'customer_name': call_data.get('customer_name', ''),
                        'duration': 'unknown',
                        'admin_connected': call_data.get('admin_connected', False)
                    })
                    self.send_json({'success': True, 'message': 'Call ended'})
                else:
                    self.send_json({'success': False, 'error': 'Call not found'})
        
        elif path == '/api/webrtc-offer':
            # WebRTC offer exchange
            call_id = data.get('callId', '')
            offer = data.get('offer', '')
            
            if not call_id or not offer:
                self.send_json({'success': False, 'error': 'Call ID and offer required'})
                return
            
            with data_lock:
                if call_id in active_calls:
                    active_calls[call_id]['offer'] = offer
                    active_calls[call_id]['offer_time'] = datetime.now().isoformat()
                    self.send_json({'success': True, 'message': 'Offer received'})
                else:
                    self.send_json({'success': False, 'error': 'Call not found'})
        
        elif path == '/api/webrtc-answer':
            # WebRTC answer exchange
            call_id = data.get('callId', '')
            answer = data.get('answer', '')
            
            if not call_id or not answer:
                self.send_json({'success': False, 'error': 'Call ID and answer required'})
                return
            
            with data_lock:
                if call_id in active_calls:
                    active_calls[call_id]['answer'] = answer
                    active_calls[call_id]['answer_time'] = datetime.now().isoformat()
                    self.send_json({'success': True, 'message': 'Answer received'})
                else:
                    self.send_json({'success': False, 'error': 'Call not found'})
        
        elif path == '/api/ice-candidate':
            # ICE candidate exchange
            call_id = data.get('callId', '')
            candidate = data.get('candidate', '')
            
            if not call_id or not candidate:
                self.send_json({'success': False, 'error': 'Call ID and candidate required'})
                return
            
            with data_lock:
                if call_id in active_calls:
                    if 'ice_candidates' not in active_calls[call_id]:
                        active_calls[call_id]['ice_candidates'] = []
                    active_calls[call_id]['ice_candidates'].append(candidate)
                    self.send_json({'success': True, 'message': 'ICE candidate received'})
                else:
                    self.send_json({'success': False, 'error': 'Call not found'})
            
            # Record call start metrics
            record_call_metrics('call_started', call_id, customer_name)
            
            active_calls[call_id] = {
                'customer_name': customer_name,
                'peer_id': data.get('peer_id'),
                'status': 'waiting',
                'timestamp': datetime.now(),
                'last_heartbeat': datetime.now(),
                'offer': None,
                'answer': None,
                'ice_candidates': []
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
        
        elif path == '/api/signal':
            call_id = data.get('callId')
            signal_type = data.get('type')
            
            if not call_id or call_id not in active_calls:
                print(f"[SIGNAL] Invalid call: {call_id[:8] if call_id else 'None'}")
                self.send_json({'success': False, 'error': 'Invalid call'})
                return
            
            if signal_type == 'offer':
                active_calls[call_id]['offer'] = data.get('offer')
                active_calls[call_id]['status'] = 'offered'
                print(f"[SIGNAL] ✅ Offer received from INDEX: {call_id[:8]}")
                self.send_json({'success': True})
            
            elif signal_type == 'answer':
                active_calls[call_id]['answer'] = data.get('answer')
                active_calls[call_id]['status'] = 'connected'
                print(f"[SIGNAL] ✅ Answer received from ADMIN: {call_id[:8]}")
                self.send_json({'success': True})
            
            elif signal_type == 'ice':
                active_calls[call_id]['ice_candidates'].append(data.get('candidate'))
                candidate_type = data.get('candidate', {}).get('type', 'unknown')
                print(f"[SIGNAL] ICE candidate ({candidate_type}): {call_id[:8]}")
                self.send_json({'success': True})
            
            else:
                print(f"[SIGNAL] Unknown signal type: {signal_type}")
                self.send_json({'success': False, 'error': 'Unknown signal type'})
        
        elif path == '/api/poll-signal':
            call_id = data.get('callId')
            
            if not call_id or call_id not in active_calls:
                self.send_json({'success': False, 'error': 'Invalid call'})
                return
            
            call_data = active_calls[call_id]
            response = {
                'success': True,
                'offer': call_data.get('offer'),
                'answer': call_data.get('answer'),
                'ice_candidates': call_data.get('ice_candidates', []),
                'status': call_data.get('status')
            }
            
            # Log only when there's new data
            if response['offer'] or response['answer'] or response['ice_candidates']:
                print(f"[POLL] Sending to {call_id[:8]}: offer={bool(response['offer'])}, answer={bool(response['answer'])}, ice={len(response['ice_candidates'])}, status={response['status']}")
            
            # ICE adaylarini gonderdikten sonra temizle
            if call_data.get('ice_candidates'):
                with data_lock:
                    call_data['ice_candidates'] = []
            self.send_json(response)
        
        elif path == '/api/update-call-status':
            if not self.check_admin_auth():
                self.send_json({'success': False, 'error': 'Unauthorized'})
                return
            call_id = data.get('callId')
            if call_id in active_calls:
                active_calls[call_id]['status'] = data.get('status')
                self.send_json({'success': True})
            else:
                self.send_json({'success': False})
        
        elif path == '/api/remove-user-activity':
            if not self.check_admin_auth():
                self.send_json({'success': False, 'error': 'Unauthorized'})
                return
            call_id = data.get('call_id')
            if call_id in active_calls:
                del active_calls[call_id]
                self.send_json({'success': True})
            else:
                self.send_json({'success': False})
        
        elif path == '/api/remove-multiple-activities':
            if not self.check_admin_auth():
                self.send_json({'success': False, 'error': 'Unauthorized'})
                return
            for call_id in data.get('call_ids', []):
                if call_id in active_calls:
                    del active_calls[call_id]
            self.send_json({'success': True})
        
        elif path == '/api/clear-all-activities':
            if not self.check_admin_auth():
                self.send_json({'success': False, 'error': 'Unauthorized'})
                return
            active_calls.clear()
            self.send_json({'success': True})
        
        elif path == '/api/clear-history':
            if not self.check_admin_auth():
                self.send_json({'success': False, 'error': 'Unauthorized'})
                return
            with data_lock:
                call_logs.clear()
            print("Call history cleared")
            self.send_json({'success': True, 'message': 'Gecmis temizlendi'})
        
        elif path == '/api/clear-active-calls':
            if not self.check_admin_auth():
                self.send_json({'success': False, 'error': 'Unauthorized'})
                return
            with data_lock:
                active_calls.clear()
            print("Active calls cleared")
            self.send_json({'success': True, 'message': 'Aktif cagrılar temizlendi'})
        
        elif path == '/api/heartbeat':
            call_id = data.get('callId')
            if call_id in active_calls:
                active_calls[call_id]['last_heartbeat'] = datetime.now()
                self.send_json({'success': True})
            else:
                self.send_json({'success': False, 'error': 'Call not found'})
        
        elif path == '/api/hold-call':
            if not self.check_admin_auth():
                self.send_json({'success': False, 'error': 'Unauthorized'})
                return
            call_id = data.get('callId')
            if call_id in active_calls:
                active_calls[call_id]['status'] = 'on_hold'
                active_calls[call_id]['hold_message'] = 'Admin şuan meşgul'
                print(f"Call on hold: {call_id[:8]}")
                self.send_json({'success': True})
            else:
                self.send_json({'success': False})
        
        elif path == '/api/close-call':
            if not self.check_admin_auth():
                self.send_json({'success': False, 'error': 'Unauthorized'})
                return
            call_id = data.get('callId')
            if remove_call_from_active(call_id, 'closed_by_admin'):
                self.send_json({'success': True})
            else:
                self.send_json({'success': False})
        
        elif path == '/api/end-call':
            call_id = data.get('callId')
            if remove_call_from_active(call_id, 'completed'):
                self.send_json({'success': True})
            else:
                self.send_json({'success': False})
        
        else:
            self.send_json({'success': False, 'error': 'Unknown endpoint'})
    
    def send_json(self, data, status_code: int = 200):
        """Send JSON response with proper headers"""
        content = json.dumps(data).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(content))
        self.end_headers()
        self.wfile.write(content)

if __name__ == '__main__':
    # Start time for uptime calculation
    server_start_time = time.time()
    
    # Start cleanup thread
    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()
    logger.info("Cleanup thread started")
    
    # Railway için PORT environment variable
    PORT = int(os.getenv('PORT', 8080))
    HOST = os.getenv('HOST', '0.0.0.0')
    
    try:
        server_instance = HTTPServer((HOST, PORT), Handler)
        
        # HTTPS configuration (if enabled)
        if HTTPS_ENABLED:
            cert_file = os.getenv('CERT_FILE')
            key_file = os.getenv('KEY_FILE')
            if cert_file and key_file and os.path.exists(cert_file) and os.path.exists(key_file):
                context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                context.load_cert_chain(certfile=cert_file, keyfile=key_file)
                server_instance.socket = context.wrap_socket(server_instance.socket, server_side=True)
                logger.info(f"HTTPS enabled with cert: {cert_file}")
            else:
                logger.warning("HTTPS_ENABLED=true ancak CERT_FILE/KEY_FILE bulunamadı veya erişilemedi. HTTP olarak devam ediliyor.")
        
        logger.info(f'''
========================================
   Canli Destek Sistemi v2.0
   {'PRODUCTION MODE' if PRODUCTION_MODE else 'DEVELOPMENT MODE'}
========================================

Musteri: {BASE_URL}/
Admin:   {BASE_URL}/admin
Dashboard: {BASE_URL}/dashboard

 Ozellikler:
- OTP Guvenlik: 6 haneli, {SESSION_TIMEOUT_HOURS} saat
- Telegram Bildirim: {'Aktif' if TELEGRAM_ENABLED else 'Devre Disi'}
- Otomatik Temizlik: Her {CLEANUP_INTERVAL} saniye
- Rate Limiting: {'Aktif' if RATE_LIMIT_ENABLED else 'Devre Disi'} ({RATE_LIMIT_CALLS}/{RATE_LIMIT_PERIOD}s)
- Logging: {LOG_LEVEL} level
- Database: {'Postgres' if DATABASE_URL else DB_PATH}
- Max Call Duration: {MAX_CALL_DURATION_HOURS} saat

 Sunucu calisiyor... (Ctrl+C ile durdur)
''')
    
        server_instance.serve_forever()
        
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
    except Exception as e:
        logger.error(f"Server error: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
    finally:
        logger.info("Server stopped")
        with data_lock:
            logger.info(f"Final state:")
            logger.info(f"- Aktif OTP: {OTPManager.get_stats()['active_otps']}")
            logger.info(f"- Aktif Session: {len(admin_sessions)}")
            logger.info(f"- Aktif Arama: {len(active_calls)}")
        logger.info("Gule gule!")
