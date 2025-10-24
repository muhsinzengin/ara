#!/usr/bin/env python3
import urllib.request
import json

BOT_TOKEN = '8033290671:AAF4QdGB6AsGQDbnYXxUpXakcsb9aAeyW6M'

print("=" * 60)
print("  TELEGRAM BOT DURUM KONTROLU")
print("=" * 60)
print()

# 1. Bot bilgilerini al
print("[1/3] Bot bilgileri aliniyor...")
try:
    url = f'https://api.telegram.org/bot{BOT_TOKEN}/getMe'
    response = urllib.request.urlopen(url, timeout=10)
    data = json.loads(response.read().decode())
    
    if data.get('ok'):
        bot = data['result']
        print(f"OK - Bot aktif!")
        print(f"  Bot ID: {bot['id']}")
        print(f"  Bot Adi: {bot['first_name']}")
        print(f"  Username: @{bot['username']}")
    else:
        print(f"HATA: {data}")
except Exception as e:
    print(f"HATA: {e}")

print()

# 2. Son mesajlari al
print("[2/3] Son mesajlar kontrol ediliyor...")
try:
    url = f'https://api.telegram.org/bot{BOT_TOKEN}/getUpdates'
    response = urllib.request.urlopen(url, timeout=10)
    data = json.loads(response.read().decode())
    
    if data.get('ok'):
        updates = data['result']
        print(f"OK - {len(updates)} mesaj bulundu")
        
        if updates:
            last = updates[-1]
            if 'message' in last:
                msg = last['message']
                chat = msg['chat']
                print(f"  Son mesaj:")
                print(f"    Chat ID: {chat['id']}")
                print(f"    Kullanici: {chat.get('first_name', 'N/A')}")
                print(f"    Mesaj: {msg.get('text', 'N/A')}")
        else:
            print("  UYARI: Hic mesaj yok!")
            print("  Telegram'da bot ile /start komutu gonder!")
    else:
        print(f"HATA: {data}")
except Exception as e:
    print(f"HATA: {e}")

print()

# 3. Test mesaji gonder
print("[3/3] Test mesaji gonderiliyor...")
CHAT_ID = '5874850928'
try:
    url = f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage'
    data = json.dumps({
        'chat_id': CHAT_ID,
        'text': 'Test mesaji - Bot calisiyor!'
    }).encode()
    
    req = urllib.request.Request(
        url,
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    
    response = urllib.request.urlopen(req, timeout=10)
    result = json.loads(response.read().decode())
    
    if result.get('ok'):
        print("OK - Mesaj gonderildi!")
        print(f"  Message ID: {result['result']['message_id']}")
    else:
        print(f"HATA: {result}")
except Exception as e:
    print(f"HATA: {e}")
    print()
    print("COZUM:")
    print("1. Telegram'da @Sohbet_Admin_Bot ara")
    print("2. /start komutunu gonder")
    print("3. Bu scripti tekrar calistir")

print()
print("=" * 60)
