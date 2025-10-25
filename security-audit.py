#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import re
from pathlib import Path

class SecurityAudit:
    def __init__(self, root_dir='.'):
        self.root = Path(root_dir)
        self.issues = []
        self.warnings = []
    
    def add_issue(self, severity, category, file, line, message, recommendation):
        self.issues.append({'severity': severity, 'category': category, 'file': str(file), 'line': line, 'message': message, 'recommendation': recommendation})
    
    def scan_hardcoded_secrets(self):
        print("[*] Scanning for hardcoded secrets...")
        patterns = [(r'TELEGRAM_BOT_TOKEN\s*=\s*["\'][\d:A-Za-z_-]+["\']', 'Hardcoded Telegram Bot Token'), (r'TELEGRAM_CHAT_ID\s*=\s*["\'][\d]+["\']', 'Hardcoded Telegram Chat ID')]
        for py_file in self.root.rglob('*.py'):
            try:
                with open(py_file, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        for pattern, desc in patterns:
                            if re.search(pattern, line, re.IGNORECASE):
                                self.add_issue('CRITICAL', 'Hardcoded Secrets', py_file.relative_to(self.root), line_num, f'{desc} found', 'Use environment variables')
            except: pass
    
    def scan_security_headers(self):
        print("[*] Checking security headers...")
        # Security headers kontrolü
        security_headers = [
            'X-Content-Type-Options',
            'X-Frame-Options', 
            'X-XSS-Protection',
            'Referrer-Policy',
            'Permissions-Policy'
        ]
        
        # server_v2.py'de security headers var mı kontrol et
        try:
            with open('server_v2.py', 'r', encoding='utf-8') as f:
                content = f.read()
                for header in security_headers:
                    if header not in content:
                        self.add_issue('MEDIUM', 'Security Headers', 'server_v2.py', 0, 
                                     f'Missing security header: {header}', 
                                     f'Add {header} header to end_headers() method')
        except:
            pass
    
    def scan_rate_limiting(self):
        print("[*] Checking rate limiting...")
        has_rate_limit = any('rate_limit' in open(f, 'r', encoding='utf-8').read().lower() 
                           for f in self.root.rglob('*.py') if f.is_file())
        if not has_rate_limit:
            self.add_issue('HIGH', 'Rate Limiting', 'server_v2.py', 0, 'No rate limiting detected', 'Implement rate limiting')
        else:
            print("  [OK] Rate limiting detected")
    
    def scan_input_validation(self):
        print("[*] Checking input validation...")
        try:
            with open('server_v2.py', 'r', encoding='utf-8') as f:
                content = f.read()
                if 'validate_input' not in content:
                    self.add_issue('HIGH', 'Input Validation', 'server_v2.py', 0, 
                                 'No input validation detected', 'Implement input validation')
                else:
                    print("  [OK] Input validation detected")
                    
                if 'sanitize_input' not in content:
                    self.add_issue('MEDIUM', 'Input Sanitization', 'server_v2.py', 0,
                                 'No input sanitization detected', 'Implement input sanitization')
                else:
                    print("  [OK] Input sanitization detected")
        except:
            pass
    
    def check_env_file(self):
        print("[*] Checking environment configuration...")
        if not (self.root / '.env.example').exists():
            self.warnings.append({'category': 'Configuration', 'message': '.env.example missing', 'recommendation': 'Create .env.example'})
        if not (self.root / '.env').exists():
            self.warnings.append({'category': 'Configuration', 'message': '.env missing', 'recommendation': 'Create .env file'})
    
    def generate_report(self):
        print("\n" + "="*70)
        print("SECURITY AUDIT REPORT")
        print("="*70)
        critical = [i for i in self.issues if i['severity'] == 'CRITICAL']
        high = [i for i in self.issues if i['severity'] == 'HIGH']
        medium = [i for i in self.issues if i['severity'] == 'MEDIUM']
        print(f"\nSummary:")
        print(f"  [CRITICAL] {len(critical)}")
        print(f"  [HIGH] {len(high)}")
        print(f"  [MEDIUM] {len(medium)}")
        print(f"  [WARNING] {len(self.warnings)}")
        score = max(0, 100 - (len(critical) * 20) - (len(high) * 10) - (len(medium) * 5))
        print(f"\nSecurity Score: {score}/100")
        if score >= 90: print("   [OK] Excellent - Production ready")
        elif score >= 70: print("   [WARN] Good - Minor issues")
        else: print("   [FAIL] Critical issues must be fixed")
        if critical:
            print("\n[CRITICAL] ISSUES:")
            for issue in critical:
                print(f"  {issue['file']}:{issue['line']} - {issue['message']}")
                print(f"  Fix: {issue['recommendation']}")
        if high:
            print("\n[HIGH] ISSUES:")
            for issue in high:
                print(f"  {issue['file']}:{issue['line']} - {issue['message']}")
                print(f"  Fix: {issue['recommendation']}")
        if self.warnings:
            print("\n[WARNING]:")
            for w in self.warnings:
                print(f"  {w['message']} - {w['recommendation']}")
        print("\n" + "="*70)
    
    def run(self):
        print("[START] Starting security audit...\n")
        self.scan_hardcoded_secrets()
        self.scan_security_headers()
        self.scan_rate_limiting()
        self.scan_input_validation()
        self.check_env_file()
        self.generate_report()

if __name__ == '__main__':
    print("="*60)
    print("SECURITY AUDIT SCRIPT")
    print("Canli Destek Sistemi")
    print("="*60 + "\n")
    SecurityAudit().run()
