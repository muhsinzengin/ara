import asyncio
import aiohttp
import threading
import time
from typing import Optional
from datetime import datetime


class TelegramNotifier:
    """Telegram bildirim yöneticisi - gelişmiş özelliklerle"""

    def __init__(self, bot_token: str, chat_id: str):
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.base_url = f"https://api.telegram.org/bot{bot_token}"

    async def send_message(self, text: str, parse_mode: str = "HTML", max_retries: int = 3) -> bool:
        """Telegram'a mesaj gönder (retry mekanizması ile)"""
        for attempt in range(max_retries):
            try:
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                    async with session.post(
                        f"{self.base_url}/sendMessage",
                        json={
                            "chat_id": self.chat_id,
                            "text": text,
                            "parse_mode": parse_mode,
                            "disable_web_page_preview": True
                        }
                    ) as response:
                        if response.status == 200:
                            print("Telegram sent successfully")
                            return True
                        elif response.status == 429:  # Rate limit
                            print(f"Rate limited by Telegram (attempt {attempt+1})")
                            await asyncio.sleep(2)  # 2 saniye bekle
                        else:
                            print(f"Telegram error {response.status} (attempt {attempt+1})")

            except Exception as e:
                print(f"Telegram send error (attempt {attempt+1}): {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(1)

        # Tüm denemeler başarısız - fallback'e geç
        print("All Telegram attempts failed, saving to file")
        try:
            with open('telegram_failed.log', 'a', encoding='utf-8') as f:
                f.write(f"{datetime.now()} - {text}\n")
        except Exception as e:
            print(f"Failed to write to telegram_failed.log: {e}")

        return False

    async def notify_new_call(self, customer_name: str, call_id: str) -> bool:
        """Yeni arama bildirimi"""
        current_time = datetime.now().strftime('%H:%M:%S')
        text = (
            f"📞 <b>Yeni Arama</b>\n\n"
            f"👤 Müşteri: <b>{customer_name}</b>\n"
            f"🆔 ID: <code>{call_id[:8]}...</code>\n"
            f"🕐 Zaman: {current_time}\n\n"
            f"⚡ <a href='http://localhost:8080/admin'>Hemen Admin Paneline Git</a>"
        )
        return await self.send_message(text)

    async def notify_call_ended(self, customer_name: str, duration: str) -> bool:
        """Arama sonlandı bildirimi"""
        text = (
            f"✅ <b>Görüşme Sonlandı</b>\n\n"
            f"👤 Müşteri: <b>{customer_name}</b>\n"
            f"⏱️ Süre: {duration}"
        )
        return await self.send_message(text)

    async def notify_admin_otp(self, otp_code: str) -> bool:
        """Admin OTP kodu gönder"""
        current_time = datetime.now().strftime('%H:%M:%S')
        text = (
            f"🔐 <b>Admin Giriş Talebi</b>\n\n"
            f"🕐 Saat: {current_time}\n"
            f"🔑 OTP: <code>{otp_code}</code>\n"
            f"🆔 Session ID: <code>auto-generated</code>\n\n"
            f"⚠️ Bu kod 10 dakika geçerlidir.\n"
            f"⚠️ Maksimum 5 deneme hakkınız var."
        )
        return await self.send_message(text)

    async def notify_customer_otp(self, customer_name: str, otp_code: str, call_id: str) -> bool:
        """Müşteri arama OTP'si gönder"""
        current_time = datetime.now().strftime('%H:%M:%S')
        text = (
            f"📞 <b>{customer_name}</b> arama sayfasına girdi!\n\n"
            f"🔥 <b>Sizi arıyor ve bağlantı bekliyor!</b>\n"
            f"⏰ Giriş Saati: {current_time}\n"
            f"🔐 Doğrulama Kodu: <code>{otp_code}</code>\n"
            f"🆔 Arama ID: <code>{call_id[:8]}...</code>\n\n"
            f"👨💼 <a href='http://localhost:8080/admin'>Hemen Admin Paneline Git</a>\n"
            f"⚡ Müşteriyi bekletmeyin!"
        )
        return await self.send_message(text)

    async def notify_error(self, error_msg: str) -> bool:
        """Hata bildirimi"""
        text = f"❌ <b>Hata</b>\n\n{error_msg}"
        return await self.send_message(text)


# Singleton instance
_notifier: Optional[TelegramNotifier] = None


def init_notifier(bot_token: str, chat_id: str):
    """Notifier'ı başlat"""
    global _notifier
    _notifier = TelegramNotifier(bot_token, chat_id)


def get_notifier() -> Optional[TelegramNotifier]:
    """Notifier instance'ını al"""
    return _notifier


async def send_telegram(text: str) -> bool:
    """Hızlı mesaj gönderme"""
    if _notifier:
        return await _notifier.send_message(text)
    return False


def send_telegram_sync(text: str) -> bool:
    """Senkron Telegram mesajı gönder (blocking)"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(send_telegram(text))
        loop.close()
        return result
    except Exception as e:
        print(f"Sync Telegram error: {e}")
        return False


def send_telegram_async(text: str):
    """Asenkron Telegram mesajı gönder (non-blocking)"""
    def send_in_background():
        try:
            send_telegram_sync(text)
        except Exception as e:
            print(f"Background Telegram error: {e}")

    thread = threading.Thread(target=send_in_background, daemon=True)
    thread.start()
