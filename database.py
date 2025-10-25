#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database Manager - SQLite for persistent storage
"""
import sqlite3
import json
from datetime import datetime
from contextlib import contextmanager

class DatabaseManager:
    def __init__(self, db_path='admin_data.db'):
        self.db_path = db_path
        self.init_database()
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
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
            
            # Calls table
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
            
            # Call logs table
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
            
            # Settings table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # OTP codes table
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
            
            # Create indexes
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_calls_start_time ON calls(start_time)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_logs_start_time ON call_logs(start_time)')
    
    # Calls
    def save_call(self, call_id, customer_name, peer_id=None, status='waiting'):
        """Save a new call"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO calls (call_id, customer_name, peer_id, status, start_time)
                VALUES (?, ?, ?, ?, ?)
            ''', (call_id, customer_name, peer_id, status, datetime.now()))
            return cursor.lastrowid
    
    def update_call_status(self, call_id, status, end_time=None, duration=None):
        """Update call status"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if end_time and duration:
                cursor.execute('''
                    UPDATE calls 
                    SET status = ?, end_time = ?, duration = ?
                    WHERE call_id = ?
                ''', (status, end_time, duration, call_id))
            else:
                cursor.execute('''
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
            cursor.execute('DELETE FROM calls WHERE call_id = ?', (call_id,))
    
    # Call Logs
    def save_call_log(self, customer_name, start_time, duration, status):
        """Save call to history"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO call_logs (customer_name, start_time, duration, status)
                VALUES (?, ?, ?, ?)
            ''', (customer_name, start_time, duration, status))
            return cursor.lastrowid
    
    def get_call_logs(self, limit=100):
        """Get call history"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM call_logs 
                ORDER BY start_time DESC 
                LIMIT ?
            ''', (limit,))
            return [dict(row) for row in cursor.fetchall()]
    
    def clear_call_logs(self):
        """Clear all call logs"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM call_logs')
    
    # Statistics
    def get_stats(self):
        """Get call statistics"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Today
            cursor.execute('''
                SELECT COUNT(*) as count FROM call_logs 
                WHERE DATE(start_time) = DATE('now')
            ''')
            today = cursor.fetchone()['count']
            
            # This week
            cursor.execute('''
                SELECT COUNT(*) as count FROM call_logs 
                WHERE start_time >= DATE('now', '-7 days')
            ''')
            week = cursor.fetchone()['count']
            
            # This month
            cursor.execute('''
                SELECT COUNT(*) as count FROM call_logs 
                WHERE start_time >= DATE('now', 'start of month')
            ''')
            month = cursor.fetchone()['count']
            
            # This year
            cursor.execute('''
                SELECT COUNT(*) as count FROM call_logs 
                WHERE start_time >= DATE('now', 'start of year')
            ''')
            year = cursor.fetchone()['count']
            
            # Average duration
            cursor.execute('SELECT AVG(duration) as avg_duration FROM call_logs')
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
            cursor.execute('''
                INSERT OR REPLACE INTO settings (key, value, updated_at)
                VALUES (?, ?, ?)
            ''', (key, json.dumps(value), datetime.now()))
    
    def get_setting(self, key, default=None):
        """Get a setting"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT value FROM settings WHERE key = ?', (key,))
            row = cursor.fetchone()
            if row:
                return json.loads(row['value'])
            return default
    
    # OTP
    def save_otp(self, call_id, code, expires):
        """Save OTP code"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO otp_codes (call_id, code, expires)
                VALUES (?, ?, ?)
            ''', (call_id, code, expires))
    
    def get_otp(self, call_id):
        """Get OTP code"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM otp_codes 
                WHERE call_id = ? AND expires > ?
            ''', (call_id, datetime.now()))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def increment_otp_attempts(self, call_id):
        """Increment OTP attempts"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE otp_codes 
                SET attempts = attempts + 1 
                WHERE call_id = ?
            ''', (call_id,))
    
    def delete_otp(self, call_id):
        """Delete OTP code"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM otp_codes WHERE call_id = ?', (call_id,))
    
    def cleanup_expired_otps(self):
        """Delete expired OTP codes"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM otp_codes WHERE expires < ?', (datetime.now(),))
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
            
            # Import calls
            for call in data.get('calls', []):
                cursor.execute('''
                    INSERT OR REPLACE INTO calls 
                    (call_id, customer_name, peer_id, status, start_time, end_time, duration)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (call['call_id'], call['customer_name'], call.get('peer_id'), 
                      call['status'], call['start_time'], call.get('end_time'), call.get('duration', 0)))
            
            # Import logs
            for log in data.get('call_logs', []):
                cursor.execute('''
                    INSERT INTO call_logs (customer_name, start_time, duration, status)
                    VALUES (?, ?, ?, ?)
                ''', (log['customer_name'], log['start_time'], log['duration'], log['status']))
            
            # Import settings
            for setting in data.get('settings', []):
                cursor.execute('''
                    INSERT OR REPLACE INTO settings (key, value)
                    VALUES (?, ?)
                ''', (setting['key'], setting['value']))

# Singleton instance
db = DatabaseManager()
