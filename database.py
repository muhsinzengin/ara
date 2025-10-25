#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database Manager - SQLite for persistent storage
"""
import sqlite3
import json
from datetime import datetime
from contextlib import contextmanager
import os
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except Exception:
    psycopg2 = None
    RealDictCursor = None

class DatabaseManager:
    def __init__(self, db_path='admin_data.db'):
        self.database_url = os.getenv('DATABASE_URL')
        if self.database_url is None and isinstance(db_path, str) and db_path.startswith(('postgres://','postgresql://')):
            self.database_url = db_path
        self.is_postgres = bool(self.database_url)
        self.db_path = db_path if not self.is_postgres else None
        self.init_database()
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        if self.is_postgres:
            if psycopg2 is None:
                raise RuntimeError("psycopg2 is required for Postgres but not installed")
            conn = psycopg2.connect(self.database_url, cursor_factory=RealDictCursor)
        else:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def init_database(self):
        """Initialize database tables"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if self.is_postgres:
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS calls (
                        id SERIAL PRIMARY KEY,
                        call_id TEXT UNIQUE NOT NULL,
                        customer_name TEXT NOT NULL,
                        peer_id TEXT,
                        status TEXT NOT NULL,
                        start_time TIMESTAMP NOT NULL,
                        end_time TIMESTAMP,
                        duration INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS call_logs (
                        id SERIAL PRIMARY KEY,
                        customer_name TEXT NOT NULL,
                        start_time TIMESTAMP NOT NULL,
                        duration INTEGER NOT NULL,
                        status TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL,
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS otp_codes (
                        id SERIAL PRIMARY KEY,
                        call_id TEXT UNIQUE NOT NULL,
                        code TEXT NOT NULL,
                        expires TIMESTAMP NOT NULL,
                        attempts INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                ''')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_calls_start_time ON calls(start_time)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_logs_start_time ON call_logs(start_time)')
            else:
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS calls (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        call_id TEXT UNIQUE NOT NULL,
                        customer_name TEXT NOT NULL,
                        peer_id TEXT,
                        status TEXT NOT NULL,
                        start_time DATETIME NOT NULL,
                        end_time DATETIME,
                        duration INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS call_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        customer_name TEXT NOT NULL,
                        start_time DATETIME NOT NULL,
                        duration INTEGER NOT NULL,
                        status TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS otp_codes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        call_id TEXT UNIQUE NOT NULL,
                        code TEXT NOT NULL,
                        expires DATETIME NOT NULL,
                        attempts INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_calls_start_time ON calls(start_time)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_logs_start_time ON call_logs(start_time)')
    
    # Calls
    def save_call(self, call_id, customer_name, peer_id=None, status='waiting'):
        """Save a new call"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            self._execute(cursor, '''
                INSERT INTO calls (call_id, customer_name, peer_id, status, start_time)
                VALUES (?, ?, ?, ?, ?)
            ''', (call_id, customer_name, peer_id, status, datetime.now()))
            return cursor.lastrowid
    
    def update_call_status(self, call_id, status, end_time=None, duration=None):
        """Update call status"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if end_time and duration:
                self._execute(cursor, '''
                    UPDATE calls 
                    SET status = ?, end_time = ?, duration = ?
                    WHERE call_id = ?
                ''', (status, end_time, duration, call_id))
            else:
                self._execute(cursor, '''
                    UPDATE calls 
                    SET status = ?
                    WHERE call_id = ?
                ''', (status, call_id))
    
    def get_active_calls(self):
        """Get all active calls"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM calls 
                WHERE status IN ('waiting', 'accepted', 'connected')
                ORDER BY start_time DESC
            ''')
            return [dict(row) for row in cursor.fetchall()]
    
    def delete_call(self, call_id):
        """Delete a call"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            self._execute(cursor, 'DELETE FROM calls WHERE call_id = ?', (call_id,))
    
    # Call Logs
    def save_call_log(self, customer_name, start_time, duration, status):
        """Save call to history"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            self._execute(cursor, '''
                INSERT INTO call_logs (customer_name, start_time, duration, status)
                VALUES (?, ?, ?, ?)
            ''', (customer_name, start_time, duration, status))
            return cursor.lastrowid
    
    def get_call_logs(self, limit=100):
        """Get call history"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            self._execute(cursor, '''
                SELECT * FROM call_logs 
                ORDER BY start_time DESC 
                LIMIT ?
            ''', (limit,))
            return [dict(row) for row in cursor.fetchall()]
    
    def clear_call_logs(self):
        """Clear all call logs"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            self._execute(cursor, 'DELETE FROM call_logs')
    
    # Statistics
    def get_stats(self):
        """Get call statistics"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if self.is_postgres:
                cursor.execute('''
                    SELECT COUNT(*) as count FROM call_logs 
                    WHERE start_time::date = CURRENT_DATE
                ''')
                today = cursor.fetchone()['count']
                cursor.execute('''
                    SELECT COUNT(*) as count FROM call_logs 
                    WHERE start_time >= NOW() - INTERVAL '7 days'
                ''')
                week = cursor.fetchone()['count']
                cursor.execute('''
                    SELECT COUNT(*) as count FROM call_logs 
                    WHERE date_trunc('month', start_time) = date_trunc('month', NOW())
                ''')
                month = cursor.fetchone()['count']
                cursor.execute('''
                    SELECT COUNT(*) as count FROM call_logs 
                    WHERE date_trunc('year', start_time) = date_trunc('year', NOW())
                ''')
                year = cursor.fetchone()['count']
                cursor.execute('SELECT AVG(duration) as avg_duration FROM call_logs')
                avg_duration = cursor.fetchone()['avg_duration'] or 0
            else:
                self._execute(cursor, '''
                    SELECT COUNT(*) as count FROM call_logs 
                    WHERE DATE(start_time) = DATE('now')
                ''')
                today = cursor.fetchone()['count']
                self._execute(cursor, '''
                    SELECT COUNT(*) as count FROM call_logs 
                    WHERE start_time >= DATE('now', '-7 days')
                ''')
                week = cursor.fetchone()['count']
                self._execute(cursor, '''
                    SELECT COUNT(*) as count FROM call_logs 
                    WHERE start_time >= DATE('now', 'start of month')
                ''')
                month = cursor.fetchone()['count']
                self._execute(cursor, '''
                    SELECT COUNT(*) as count FROM call_logs 
                    WHERE start_time >= DATE('now', 'start of year')
                ''')
                year = cursor.fetchone()['count']
                self._execute(cursor, 'SELECT AVG(duration) as avg_duration FROM call_logs')
                avg_duration = cursor.fetchone()['avg_duration'] or 0
            return {
                'today': today,
                'week': week,
                'month': month,
                'year': year,
                'avg_duration': int(avg_duration)
            }
    
    # Settings
    def save_setting(self, key, value):
        """Save a setting"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if self.is_postgres:
                cursor.execute('''
                    INSERT INTO settings (key, value, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (key) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = NOW()
                ''', (key, json.dumps(value)))
            else:
                self._execute(cursor, '''
                    INSERT OR REPLACE INTO settings (key, value, updated_at)
                    VALUES (?, ?, ?)
                ''', (key, json.dumps(value), datetime.now()))
    
    def get_setting(self, key, default=None):
        """Get a setting"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            self._execute(cursor, 'SELECT value FROM settings WHERE key = ?', (key,))
            row = cursor.fetchone()
            if row:
                return json.loads(row['value'])
            return default
    
    # OTP
    def save_otp(self, call_id, code, expires):
        """Save OTP code"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            self._execute(cursor, '''
                INSERT INTO otp_codes (call_id, code, expires)
                VALUES (?, ?, ?)
            ''', (call_id, code, expires))
    
    def get_otp(self, call_id):
        """Get OTP code"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            self._execute(cursor, '''
                SELECT * FROM otp_codes 
                WHERE call_id = ? AND expires > ?
            ''', (call_id, datetime.now()))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def increment_otp_attempts(self, call_id):
        """Increment OTP attempts"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            self._execute(cursor, '''
                UPDATE otp_codes 
                SET attempts = attempts + 1 
                WHERE call_id = ?
            ''', (call_id,))
    
    def delete_otp(self, call_id):
        """Delete OTP code"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            self._execute(cursor, 'DELETE FROM otp_codes WHERE call_id = ?', (call_id,))
    
    def cleanup_expired_otps(self):
        """Delete expired OTP codes"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            self._execute(cursor, 'DELETE FROM otp_codes WHERE expires < ?', (datetime.now(),))
            return cursor.rowcount
    
    # Export/Import
    def export_data(self):
        """Export all data as JSON"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM calls')
            calls = [dict(row) for row in cursor.fetchall()]
            
            cursor.execute('SELECT * FROM call_logs')
            logs = [dict(row) for row in cursor.fetchall()]
            
            cursor.execute('SELECT * FROM settings')
            settings = [dict(row) for row in cursor.fetchall()]
            
            return {
                'version': 1,
                'exported_at': datetime.now().isoformat(),
                'calls': calls,
                'call_logs': logs,
                'settings': settings
            }
    
    def import_data(self, data):
        """Import data from JSON"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if self.is_postgres:
                for call in data.get('calls', []):
                    cursor.execute('''
                        INSERT INTO calls (call_id, customer_name, peer_id, status, start_time, end_time, duration)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (call_id) DO UPDATE SET
                            customer_name = EXCLUDED.customer_name,
                            peer_id = EXCLUDED.peer_id,
                            status = EXCLUDED.status,
                            start_time = EXCLUDED.start_time,
                            end_time = EXCLUDED.end_time,
                            duration = EXCLUDED.duration
                    ''', (call['call_id'], call['customer_name'], call.get('peer_id'), 
                          call['status'], call['start_time'], call.get('end_time'), call.get('duration', 0)))
                for log in data.get('call_logs', []):
                    self._execute(cursor, '''
                        INSERT INTO call_logs (customer_name, start_time, duration, status)
                        VALUES (?, ?, ?, ?)
                    ''', (log['customer_name'], log['start_time'], log['duration'], log['status']))
                for setting in data.get('settings', []):
                    cursor.execute('''
                        INSERT INTO settings (key, value)
                        VALUES (%s, %s)
                        ON CONFLICT (key) DO UPDATE SET
                            value = EXCLUDED.value
                    ''', (setting['key'], setting['value']))
            else:
                for call in data.get('calls', []):
                    self._execute(cursor, '''
                        INSERT OR REPLACE INTO calls 
                        (call_id, customer_name, peer_id, status, start_time, end_time, duration)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (call['call_id'], call['customer_name'], call.get('peer_id'), 
                          call['status'], call['start_time'], call.get('end_time'), call.get('duration', 0)))
                for log in data.get('call_logs', []):
                    self._execute(cursor, '''
                        INSERT INTO call_logs (customer_name, start_time, duration, status)
                        VALUES (?, ?, ?, ?)
                    ''', (log['customer_name'], log['start_time'], log['duration'], log['status']))
                for setting in data.get('settings', []):
                    self._execute(cursor, '''
                        INSERT OR REPLACE INTO settings (key, value)
                        VALUES (?, ?)
                    ''', (setting['key'], setting['value']))

# Singleton instance
db = DatabaseManager()
