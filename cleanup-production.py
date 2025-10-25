#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Production Cleanup Script
Automatically removes unnecessary files and prepares for production
"""
import os
import shutil
from pathlib import Path

class ProductionCleanup:
    def __init__(self, root_dir='.'):
        self.root = Path(root_dir)
        self.removed_files = []
        self.removed_dirs = []
        self.total_size_saved = 0
    
    def get_file_size(self, path):
        """Get file size in bytes"""
        try:
            return os.path.getsize(path)
        except:
            return 0
    
    def remove_file(self, filepath):
        """Remove a file and track it"""
        try:
            size = self.get_file_size(filepath)
            os.remove(filepath)
            self.removed_files.append(str(filepath))
            self.total_size_saved += size
            print(f"[OK] Removed: {filepath} ({size/1024:.1f} KB)")
            return True
        except Exception as e:
            print(f"[FAIL] Failed to remove {filepath}: {e}")
            return False
    
    def remove_directory(self, dirpath):
        """Remove a directory and track it"""
        try:
            size = sum(self.get_file_size(f) for f in Path(dirpath).rglob('*') if f.is_file())
            shutil.rmtree(dirpath)
            self.removed_dirs.append(str(dirpath))
            self.total_size_saved += size
            print(f"[OK] Removed directory: {dirpath} ({size/1024:.1f} KB)")
            return True
        except Exception as e:
            print(f"[FAIL] Failed to remove {dirpath}: {e}")
            return False
    
    def cleanup_test_files(self):
        """Remove test and documentation files"""
        print("\n[*] Cleaning test files...")
        
        test_files = [
            'SMOKE_TEST.md',
            'TEST_QUALITY.md',
            'TEST_INDEX_ADMIN_INTEGRATION.md',
            'TEST_RESULTS.md',
            'ADMIN_REAL_DATA_TEST.md',
            'INTEGRATION_TEST.md',
            'smoke-test.js'
        ]
        
        for filename in test_files:
            filepath = self.root / filename
            if filepath.exists():
                self.remove_file(filepath)
    
    def cleanup_backup_files(self):
        """Remove backup and old files"""
        print("\n[*] Cleaning backup files...")
        
        backup_files = [
            'app/admin/admin-modular.html',
            'app/admin/admin_backup.html',
            'app/admin/admin_old.html',
            'app/admin/js/admin.js',
            'app/admin/js/admin_pro.js',
            'app/admin/js/admin-main.js',
            'app/admin/js/webrtc-manager.js',
            'app/admin/js/ui-manager.js',
            'app/admin/js/storage-manager.js',
            'app/admin/js/performance-utils.js',
            'app/admin/css/admin-main.css',
            'app/admin/css/admin-components.css',
            'app/admin/css/admin-modals.css',
            'app/admin/css/style.css',
            'app/admin/css/call-screen.css',
            'app/admin/css/notifications.css',
            'app/admin/js/notifications.js'
        ]
        
        for filename in backup_files:
            filepath = self.root / filename
            if filepath.exists():
                self.remove_file(filepath)
    
    def cleanup_unused_dirs(self):
        """Remove unused directories"""
        print("\n[*] Cleaning unused directories...")
        
        unused_dirs = [
            'referans',
            'src/aiortc'
        ]
        
        for dirname in unused_dirs:
            dirpath = self.root / dirname
            if dirpath.exists():
                self.remove_directory(dirpath)
    
    def archive_documentation(self):
        """Move documentation to docs folder"""
        print("\n[*] Archiving documentation...")
        
        docs_dir = self.root / 'docs'
        docs_dir.mkdir(exist_ok=True)
        
        doc_files = [
            'OPTIMIZATION_PLAN.md',
            'UPGRADE_SUMMARY.md',
            'MODULAR_STRUCTURE.md',
            'QUALITY_README.md',
            'PERFORMANCE_DATA_GUIDE.md',
            'MD_DOSYALARI_ANALIZ.md',
            'TODO.md',
            'TODO_call_transfer.md',
            'PRE_PRODUCTION_AUDIT.md'
        ]
        
        for filename in doc_files:
            src = self.root / filename
            dst = docs_dir / filename
            if src.exists():
                try:
                    shutil.move(str(src), str(dst))
                    print(f"[ARCHIVE] {filename} -> docs/")
                except Exception as e:
                    print(f"[FAIL] Failed to archive {filename}: {e}")
    
    def create_gitignore(self):
        """Create .gitignore file"""
        print("\n[*] Creating .gitignore...")
        
        gitignore_content = """# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
*.egg-info/

# Database
*.db
*.sqlite3
admin_data.db

# Environment
.env
.env.local
.env.production

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Test
test_*.py
*_test.py
smoke-test.js

# Documentation (archived)
docs/

# Backup
*.backup
*.bak
*_old.*
*_backup.*
"""
        
        gitignore_path = self.root / '.gitignore'
        try:
            with open(gitignore_path, 'w', encoding='utf-8') as f:
                f.write(gitignore_content)
            print("[OK] Created: .gitignore")
        except Exception as e:
            print(f"[FAIL] Failed to create .gitignore: {e}")
    
    def create_env_template(self):
        """Create .env.example file"""
        print("\n[*] Creating .env.example...")
        
        env_content = """# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Server Configuration
PORT=8080
HOST=0.0.0.0

# Session Configuration
SESSION_TIMEOUT_HOURS=12

# Intervals (seconds)
HEARTBEAT_INTERVAL=30
CLEANUP_INTERVAL=30

# Security
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
RATE_LIMIT_CALLS=10
RATE_LIMIT_PERIOD=60

# Database
DB_PATH=admin_data.db
"""
        
        env_path = self.root / '.env.example'
        try:
            with open(env_path, 'w', encoding='utf-8') as f:
                f.write(env_content)
            print("[OK] Created: .env.example")
        except Exception as e:
            print(f"[FAIL] Failed to create .env.example: {e}")
    
    def create_requirements(self):
        """Create requirements.txt"""
        print("\n[*] Creating requirements.txt...")
        
        requirements = """python-dotenv==1.0.0
"""
        
        req_path = self.root / 'requirements.txt'
        try:
            with open(req_path, 'w', encoding='utf-8') as f:
                f.write(requirements)
            print("[OK] Created: requirements.txt")
        except Exception as e:
            print(f"[FAIL] Failed to create requirements.txt: {e}")
    
    def generate_report(self):
        """Generate cleanup report"""
        print("\n" + "="*60)
        print("CLEANUP REPORT")
        print("="*60)
        print(f"Files removed: {len(self.removed_files)}")
        print(f"Directories removed: {len(self.removed_dirs)}")
        print(f"Total space saved: {self.total_size_saved/1024:.1f} KB ({self.total_size_saved/1024/1024:.2f} MB)")
        print("="*60)
        
        if self.removed_files:
            print("\nRemoved Files:")
            for f in self.removed_files:
                print(f"  - {f}")
        
        if self.removed_dirs:
            print("\nRemoved Directories:")
            for d in self.removed_dirs:
                print(f"  - {d}")
        
        print("\n[OK] Cleanup completed successfully!")
        print("\nNext steps:")
        print("  1. Review .env.example and create .env with your credentials")
        print("  2. Install dependencies: pip install -r requirements.txt")
        print("  3. Run security audit: python security-audit.py")
        print("  4. Test the application")
        print("  5. Deploy to production")
    
    def run(self, dry_run=False):
        """Run all cleanup tasks"""
        if dry_run:
            print("[DRY-RUN] No files will be deleted\n")
            return
        
        print("[START] Starting production cleanup...\n")
        
        # Cleanup
        self.cleanup_test_files()
        self.cleanup_backup_files()
        self.cleanup_unused_dirs()
        
        # Archive
        self.archive_documentation()
        
        # Create config files
        self.create_gitignore()
        self.create_env_template()
        self.create_requirements()
        
        # Report
        self.generate_report()

if __name__ == '__main__':
    import sys
    
    dry_run = '--dry-run' in sys.argv or '-d' in sys.argv
    
    print("="*60)
    print("PRODUCTION CLEANUP SCRIPT")
    print("Canli Destek Sistemi")
    print("="*60)
    
    if dry_run:
        print("[!] DRY RUN MODE - No changes will be made")
    elif '--force' not in sys.argv:
        response = input("[!] This will delete files. Continue? (yes/no): ")
        if response.lower() != 'yes':
            print("[X] Cleanup cancelled")
            sys.exit(0)
    
    cleanup = ProductionCleanup()
    cleanup.run(dry_run=dry_run)
