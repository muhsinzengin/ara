import os
import subprocess
import time
import requests


def wait_for_server(url, timeout=10):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(url, timeout=1)
            return True
        except Exception:
            time.sleep(0.3)
    return False


def test_health_and_create_call():
    env = os.environ.copy()
    env['PORT'] = '8099'
    env['HOST'] = '127.0.0.1'
    proc = subprocess.Popen(['python', 'server_v2.py'], env=env)
    try:
        assert wait_for_server('http://127.0.0.1:8099/api/healthz')

        # Health
        r = requests.get('http://127.0.0.1:8099/api/healthz', timeout=3)
        assert r.status_code == 200
        data = r.json()
        assert data.get('status') == 'ok'

        # Create call
        r = requests.post('http://127.0.0.1:8099/api/create-call', json={'customer_name': 'Test'}, timeout=3)
        assert r.status_code == 200
        data = r.json()
        assert data.get('success') is True
        assert 'call_id' in data

        # ICE servers endpoint
        r = requests.get('http://127.0.0.1:8099/api/ice-servers', timeout=3)
        assert r.status_code == 200
        js = r.json()
        assert js.get('success') is True
        assert isinstance(js.get('iceServers'), list)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

