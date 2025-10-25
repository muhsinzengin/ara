import secrets
import hashlib
import threading
import time
import re
import os
from datetime import datetime, timedelta
from typing import Dict, Tuple, Optional

# Sabitler
MAX_OTP_ATTEMPTS = 5
OTP_VALIDITY_MINUTES = 10
SESSION_TIMEOUT_HOURS = int(os.getenv('SESSION_TIMEOUT_HOURS', '8'))

# Rate limiting configuration - Environment variables
RATE_LIMIT_REQUESTS = int(os.getenv('RATE_LIMIT_CALLS', '50'))  # Default 50 istek
RATE_LIMIT_WINDOW = int(os.getenv('RATE_LIMIT_PERIOD', '3600'))  # Default 1 saat

# Global storage
otp_codes: Dict = {}
admin_sessions: Dict = {}
rate_limit_storage: Dict = {}  # Rate limiting storage
data_lock = threading.Lock()


class OTPManager:
    """OTP yönetim sınıfı - Telegram mantığı.txt'den uyarlandı"""

    @staticmethod
    def generate_otp() -> str:
        """Kriptografik olarak güvenli 6 haneli OTP üret"""
        # secrets.randbelow(900000) -> 0-899999 arası
        # + 100000 -> 100000-999999 arası garanti
        # :06d -> 6 haneli sıfır ile doldurulmuş
        return f"{secrets.randbelow(900000) + 100000:06d}"

    @staticmethod
    def hash_sensitive_data(data: str) -> str:
        """Hassas veriyi hash'le (loglama için)"""
        return hashlib.sha256(str(data).encode()).hexdigest()[:8]

    @staticmethod
    def validate_otp_format(otp_input: str) -> bool:
        """OTP formatını doğrula (6 haneli sayı)"""
        pattern = re.compile(r'^\d{6}$')
        return bool(pattern.match(otp_input))

    @staticmethod
    def create_otp(call_id: str, otp_type: str = 'admin') -> str:
        """OTP oluştur ve kaydet"""
        otp = OTPManager.generate_otp()

        with data_lock:
            otp_codes[call_id] = {
                'code': otp,
                'expires': datetime.now() + timedelta(minutes=OTP_VALIDITY_MINUTES),
                'attempts': 0,
                'type': otp_type,
                'created_at': datetime.now()
            }

            # Yedekleme (opsiyonel)
            try:
                backup_data = {
                    cid: {
                        'code': data['code'],
                        'expires': data['expires'].isoformat(),
                        'type': data['type']
                    } for cid, data in otp_codes.items()
                }
                with open('otp_backup.json', 'w') as f:
                    import json
                    json.dump(backup_data, f)
            except Exception as e:
                print(f"OTP backup failed: {e}")

        # Hassas veriyi loglamadan hash'le
        print(f"OTP created: hash={OTPManager.hash_sensitive_data(otp)}, type={otp_type}")
        return otp

    @staticmethod
    def verify_otp(call_id: str, otp_input: str) -> Tuple[bool, str]:
        """OTP doğrula - gelişmiş validasyon"""
        # Format kontrolü
        if not OTPManager.validate_otp_format(otp_input):
            return False, 'OTP 6 haneli sayi olmali'

        with data_lock:
            # 1. OTP kaydı var mı?
            if call_id not in otp_codes:
                return False, 'Gecersiz veya suresi dolmus OTP'

            otp_data = otp_codes[call_id]

            # 2. Süre kontrolü (10 dakika)
            if datetime.now() >= otp_data['expires']:
                del otp_codes[call_id]
                return False, 'OTP suresi dolmus'

            # 3. Deneme sayısı kontrolü (max 5)
            if otp_data.get('attempts', 0) >= MAX_OTP_ATTEMPTS:
                del otp_codes[call_id]
                return False, 'Cok fazla yanlis deneme'

            # 4. Kod eşleşmesi
            if otp_data['code'] == otp_input:
                del otp_codes[call_id]
                return True, 'OTP dogrulandi'
            else:
                # Yanlış kod: Deneme sayısını artır
                otp_data['attempts'] += 1
                remaining = MAX_OTP_ATTEMPTS - otp_data['attempts']

                if remaining > 0:
                    return False, f'Yanlis OTP. {remaining} deneme hakkiniz kaldi'
                else:
                    del otp_codes[call_id]
                    return False, 'Cok fazla yanlis deneme'

    @staticmethod
    def cleanup_expired() -> int:
        """Süresi dolmuş OTP'leri temizle"""
        current_time = datetime.now()
        cleaned = 0

        with data_lock:
            expired_otps = [
                call_id for call_id, otp_data in otp_codes.items()
                if current_time >= otp_data['expires']
            ]
            for call_id in expired_otps:
                del otp_codes[call_id]
                cleaned += 1

            # Süresi dolmuş session'ları da temizle
            expired_sessions = [
                call_id for call_id, session in admin_sessions.items()
                if current_time >= session['expires']
            ]
            for call_id in expired_sessions:
                del admin_sessions[call_id]

        if cleaned > 0:
            print(f"Cleaned {cleaned} expired OTPs")

        return cleaned

    @staticmethod
    def create_session(call_id: str, ip_address: str) -> Dict:
        """Admin session oluştur (12 saat)"""
        with data_lock:
            admin_sessions[call_id] = {
                'authenticated': True,
                'timestamp': datetime.now(),
                'expires': datetime.now() + timedelta(hours=SESSION_TIMEOUT_HOURS),
                'ip_address': ip_address
            }
        return admin_sessions[call_id]

    @staticmethod
    def verify_session(call_id: str) -> bool:
        """Session doğrula"""
        with data_lock:
            if call_id not in admin_sessions:
                return False

            session = admin_sessions[call_id]
            if datetime.now() >= session['expires']:
                del admin_sessions[call_id]
                return False

            return True

    @staticmethod
    def check_rate_limit(identifier: str) -> bool:
        """Rate limiting kontrolü"""
        current_time = time.time()

        with data_lock:
            if identifier not in rate_limit_storage:
                rate_limit_storage[identifier] = []

            # Eski istekleri temizle
            rate_limit_storage[identifier] = [
                req_time for req_time in rate_limit_storage[identifier]
                if current_time - req_time < RATE_LIMIT_WINDOW
            ]

            # Limit kontrolü
            if len(rate_limit_storage[identifier]) >= RATE_LIMIT_REQUESTS:
                return False

            # Yeni isteği ekle
            rate_limit_storage[identifier].append(current_time)
            return True

    @staticmethod
    def get_stats() -> Dict:
        """OTP istatistikleri"""
        with data_lock:
            return {
                'active_otps': len(otp_codes),
                'active_sessions': len(admin_sessions),
                'otp_details': [
                    {
                        'type': data['type'],
                        'attempts': data['attempts'],
                        'remaining_seconds': int((data['expires'] - datetime.now()).total_seconds())
                    }
                    for data in otp_codes.values()
                ]
            }

    @staticmethod
    def find_call_id_by_code(otp_input: str) -> Optional[str]:
        """OTP kodundan call_id bul"""
        with data_lock:
            for cid, data in otp_codes.items():
                if data['code'] == otp_input and datetime.now() < data['expires']:
                    return cid
        return None


def start_cleanup_thread():
    """Otomatik temizlik thread'i başlat"""
    def cleanup_loop():
        while True:
            time.sleep(3600)  # Her 1 saatte bir
            OTPManager.cleanup_expired()

    thread = threading.Thread(target=cleanup_loop, daemon=True)
    thread.start()
    print("OTP cleanup thread started")
