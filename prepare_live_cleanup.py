#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Prepare Live Cleanup
- Purges in-memory storages (calls, logs, OTPs, sessions, rate limiting)
- Clears production logs
- Optionally wipes the production database (calls, call_logs, otp_codes)
- Removes stray backup/test artifacts
"""
import os
import shutil
import argparse
from datetime import datetime
from pathlib import Path

import server_v2
from otp_manager import otp_codes, admin_sessions, rate_limit_storage
from database import DatabaseManager

ROOT = Path(__file__).resolve().parent


def purge_runtime_state():
    # In-memory storages
    server_v2.active_calls.clear()
    server_v2.call_logs.clear()
    otp_codes.clear()
    admin_sessions.clear()
    rate_limit_storage.clear()
    
    return {
        'active_calls': len(server_v2.active_calls),
        'call_logs': len(server_v2.call_logs),
        'otp_codes': len(otp_codes),
        'admin_sessions': len(admin_sessions),
        'rate_limit_storage': len(rate_limit_storage),
    }


def clear_logs():
    removed = []
    for log_path in [server_v2.LOG_FILE, ROOT / 'app.log']:
        try:
            p = Path(log_path)
            if p.exists():
                backup = p.with_suffix(f".{datetime.now().strftime('%Y%m%d_%H%M%S')}.bak")
                shutil.copy2(str(p), str(backup))
                os.remove(str(p))
                removed.append(str(p))
        except Exception as e:
            print(f"[WARN] Could not remove log {log_path}: {e}")
    return removed


def wipe_database(db_path: str):
    removed_counts = {'calls': 0, 'call_logs': 0, 'otp_codes': 0}
    dbm = DatabaseManager(db_path)
    
    # Backup file before wiping
    db_file = Path(db_path)
    if db_file.exists():
        backup_path = db_file.with_name(f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db")
        shutil.copy2(str(db_file), str(backup_path))
        print(f"[BACKUP] Database copied to {backup_path}")
    
    with dbm.get_connection() as conn:
        cur = conn.cursor()
        for table in ['calls', 'call_logs', 'otp_codes']:
            try:
                cur.execute(f'DELETE FROM {table}')
                removed_counts[table] = cur.rowcount if cur.rowcount is not None else 0
            except Exception as e:
                print(f"[WARN] Could not clear table {table}: {e}")
        try:
            cur.execute('VACUUM')
        except Exception:
            pass
    return removed_counts


def remove_artifacts():
    removed = []
    artifacts = [ROOT / 'otp_backup.json']
    for art in artifacts:
        try:
            if Path(art).exists():
                os.remove(str(art))
                removed.append(str(art))
        except Exception as e:
            print(f"[WARN] Could not remove artifact {art}: {e}")
    return removed


def print_env_summary():
    print("\n[ENV] Summary:")
    print(f"  PRODUCTION_MODE: {server_v2.PRODUCTION_MODE}")
    print(f"  HTTPS_ENABLED: {server_v2.HTTPS_ENABLED}")
    print(f"  BASE_URL: {server_v2.BASE_URL}")
    print(f"  TELEGRAM_ENABLED: {getattr(server_v2, 'TELEGRAM_ENABLED', False)}")
    print(f"  DB_PATH: {server_v2.DB_PATH}")
    print(f"  LOG_FILE: {server_v2.LOG_FILE}")
    if not server_v2.TELEGRAM_BOT_TOKEN or not server_v2.TELEGRAM_CHAT_ID:
        print("  [WARN] Telegram credentials missing; notifications disabled.")


def main():
    parser = argparse.ArgumentParser(description='Prepare live: purge caches, logs, and optionally DB')
    parser.add_argument('--wipe-db', action='store_true',
                        help='Wipe production database tables')
    args = parser.parse_args()
    
    print("[START] Live cleanup starting...")
    print_env_summary()
    
    # Purge runtime state
    state = purge_runtime_state()
    print("\n[OK] Runtime state purged:")
    for k, v in state.items():
        print(f"  - {k}: {v}")
    
    # Remove artifacts
    art_removed = remove_artifacts()
    if art_removed:
        print("\n[OK] Artifacts removed:")
        for f in art_removed:
            print(f"  - {f}")
    
    # Clear logs
    logs_removed = clear_logs()
    if logs_removed:
        print("\n[OK] Logs removed:")
        for lp in logs_removed:
            print(f"  - {lp}")
    
    # Wipe DB
    if args.wipe_db:
        removed_counts = wipe_database(server_v2.DB_PATH)
        print("\n[OK] Database wiped:")
        for table, count in removed_counts.items():
            print(f"  - {table}: removed={count}")
    else:
        print("\n[SKIP] Database wipe skipped")
    
    print("\n[DONE] Live cleanup complete.")


if __name__ == '__main__':
    main()