from flask import Flask, render_template, send_from_directory, jsonify, request, session
from flask_cors import CORS
import secrets
import os
from datetime import datetime, timedelta
from telegram_notifier import init_notifier, get_notifier
import asyncio

app = Flask(__name__, 
            static_folder='app/static',
            template_folder='app')
app.secret_key = secrets.token_hex(32)
CORS(app)

# Telegram config
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '')

if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
    init_notifier(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)

# In-memory storage
active_calls = {}
call_logs = []
admin_otp = None
otp_expiry = None

@app.route('/')
def index():
    return send_from_directory('app/index', 'index.html')

@app.route('/admin')
def admin():
    return send_from_directory('app/admin', 'admin.html')

@app.route('/admin/<path:filename>')
def admin_files(filename):
    return send_from_directory('app/admin', filename)

@app.route('/index/<path:filename>')
def index_files(filename):
    return send_from_directory('app/index', filename)

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('app/static', filename)

# API Endpoints
@app.route('/api/request-admin-otp', methods=['POST'])
def request_admin_otp():
    global admin_otp, otp_expiry
    admin_otp = str(secrets.randbelow(900000) + 100000)
    otp_expiry = datetime.now() + timedelta(minutes=5)
    
    notifier = get_notifier()
    if notifier:
        asyncio.run(notifier.notify_admin_otp(admin_otp))
    
    return jsonify({'success': True})

@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    global admin_otp, otp_expiry
    data = request.json
    otp = data.get('otp')
    
    if not admin_otp or not otp_expiry:
        return jsonify({'success': False, 'error': 'OTP istenmedi'})
    
    if datetime.now() > otp_expiry:
        admin_otp = None
        otp_expiry = None
        return jsonify({'success': False, 'error': 'OTP süresi doldu'})
    
    if otp == admin_otp:
        session['admin_authenticated'] = True
        admin_otp = None
        otp_expiry = None
        return jsonify({'success': True})
    
    return jsonify({'success': False, 'error': 'Geçersiz OTP'})

@app.route('/api/check-session', methods=['GET'])
def check_session():
    return jsonify({
        'success': True,
        'authenticated': session.get('admin_authenticated', False)
    })

@app.route('/api/active-calls', methods=['GET'])
def get_active_calls():
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
    return jsonify({'success': True, 'active_calls': calls})

@app.route('/api/call-logs', methods=['GET'])
def get_call_logs():
    logs = []
    for log in call_logs:
        logs.append({
            'customer_name': log['customer_name'],
            'start_time': log['start_time'].isoformat(),
            'duration': log['duration'],
            'status': log['status']
        })
    return jsonify({'success': True, 'logs': logs})

@app.route('/api/create-call', methods=['POST'])
def create_call():
    data = request.json
    customer_name = data.get('customer_name')
    peer_id = data.get('peer_id')
    
    call_id = secrets.token_urlsafe(16)
    active_calls[call_id] = {
        'customer_name': customer_name,
        'peer_id': peer_id,
        'status': 'online',
        'timestamp': datetime.now()
    }
    
    notifier = get_notifier()
    if notifier:
        asyncio.run(notifier.notify_new_call(customer_name, call_id))
    
    return jsonify({'success': True, 'call_id': call_id})

@app.route('/api/update-call-status', methods=['POST'])
def update_call_status():
    data = request.json
    call_id = data.get('callId')
    status = data.get('status')
    
    if call_id in active_calls:
        active_calls[call_id]['status'] = status
        return jsonify({'success': True})
    
    return jsonify({'success': False, 'error': 'Call not found'})

@app.route('/api/call-status/<call_id>', methods=['GET'])
def get_call_status(call_id):
    if call_id in active_calls:
        call = active_calls[call_id]
        return jsonify({
            'success': True,
            'customer_peer_id': call.get('peer_id'),
            'customerName': call['customer_name'],
            'status': call['status']
        })
    return jsonify({'success': False})

@app.route('/api/remove-user-activity', methods=['POST'])
def remove_user_activity():
    data = request.json
    call_id = data.get('call_id')
    
    if call_id in active_calls:
        del active_calls[call_id]
        return jsonify({'success': True})
    
    return jsonify({'success': False, 'error': 'Call not found'})

@app.route('/api/remove-multiple-activities', methods=['POST'])
def remove_multiple_activities():
    data = request.json
    call_ids = data.get('call_ids', [])
    
    for call_id in call_ids:
        if call_id in active_calls:
            del active_calls[call_id]
    
    return jsonify({'success': True})

@app.route('/api/clear-all-activities', methods=['POST'])
def clear_all_activities():
    active_calls.clear()
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
