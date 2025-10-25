# Canlı Destek Sistemi v2.0 - Production Guide

## 🚀 Production Deployment

### Prerequisites
- Ubuntu 20.04+ or CentOS 8+
- Root access
- Domain name configured
- Telegram bot token and chat ID

### Quick Deployment
```bash
# Clone repository
git clone <your-repo-url>
cd canli-destek

# Make deployment script executable
chmod +x deploy-production.sh

# Run deployment (as root)
sudo ./deploy-production.sh
```

### Manual Configuration

#### 1. Environment Variables
Update `.env` file with production values:
```env
# Telegram Configuration (RECOMMENDED for notifications)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Domain Configuration
BASE_URL=https://yourdomain.com
HTTPS_ENABLED=true
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Session Configuration
SESSION_TIMEOUT_HOURS=8

# Production Settings
PRODUCTION=true
DEBUG=false
LOG_LEVEL=INFO
```

#### 2. System Service
```bash
# Create systemd service
sudo cp canli-destek.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable canli-destek
sudo systemctl start canli-destek
```

#### 3. Nginx Configuration
```bash
# Copy nginx config
sudo cp nginx-canli-destek.conf /etc/nginx/sites-available/canli-destek
sudo ln -s /etc/nginx/sites-available/canli-destek /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 4. SSL Certificate
```bash
# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 📊 Monitoring

### Health Check
```bash
# Check service status
sudo systemctl status canli-destek

# Check API health
curl https://yourdomain.com/api/healthz

# View logs
sudo journalctl -u canli-destek -f
```

### Monitoring Script
```bash
# Run monitoring
chmod +x monitor-production.sh
./monitor-production.sh

# Continuous monitoring
./monitor-production.sh continuous
```

## 🔧 Configuration

### Telegram Bot Setup
1. Create bot with @BotFather
2. Get chat ID from @userinfobot
3. Update `.env` file
4. Restart service

### Security Settings
- Rate limiting: 20 requests/minute
- Session timeout: 8 hours
- HTTPS enforced
- CORS configured
- Input validation enabled

### Performance Tuning
- Cleanup interval: 60 seconds
- Max call duration: 2 hours
- Log rotation: 10MB files, 5 backups
- Database cleanup: 30 days retention

## 📈 Features

### Customer Interface
- **URL**: https://yourdomain.com/
- **Features**: WebRTC video/audio calls
- **Security**: Input validation, rate limiting
- **Mobile**: Responsive design

### Admin Interface
- **URL**: https://yourdomain.com/admin
- **Authentication**: OTP via Telegram
- **Features**: Call management, real-time stats
- **Security**: CSRF protection, session management

### API Endpoints
- **Health**: `/api/healthz`
- **Metrics**: `/api/metrics`
- **Active Calls**: `/api/active-calls`
- **WebRTC Signaling**: `/api/webrtc-*`

## 🛠️ Maintenance

### Log Management
```bash
# View production logs
tail -f production.log

# Rotate logs manually
sudo logrotate -f /etc/logrotate.d/canli-destek
```

### Database Maintenance
```bash
# Backup database
cp production_data.db backup_$(date +%Y%m%d).db

# Clean old records (automatic)
# Runs every 60 seconds in production mode
```

### Updates
```bash
# Stop service
sudo systemctl stop canli-destek

# Backup current version
cp -r /opt/canli-destek /opt/canli-destek.backup

# Update code
git pull origin main

# Restart service
sudo systemctl start canli-destek
```

## 🚨 Troubleshooting

### Common Issues

#### Service Not Starting
```bash
# Check logs
sudo journalctl -u canli-destek -n 50

# Check configuration
python3 -c "import server_v2"
```

#### Telegram Not Working
```bash
# Test bot token
curl "https://api.telegram.org/bot<TOKEN>/getMe"

# Check chat ID
curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
```

#### WebRTC Issues
- Ensure HTTPS is enabled
- Check browser console for errors
- Verify STUN/TURN servers

#### High Memory Usage
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Restart service
sudo systemctl restart canli-destek
```

### Emergency Procedures

#### Service Recovery
```bash
# Quick restart
sudo systemctl restart canli-destek

# Full restart with cleanup
sudo systemctl stop canli-destek
sudo rm -f /tmp/canli-destek*
sudo systemctl start canli-destek
```

#### Database Recovery
```bash
# Restore from backup
sudo systemctl stop canli-destek
cp backup_20250101.db production_data.db
sudo systemctl start canli-destek
```

## 📞 Support

### Monitoring Alerts
- Service down: Check systemd status
- High memory: Restart service
- API errors: Check logs
- Telegram errors: Verify credentials

### Performance Metrics
- Response time: < 100ms
- Memory usage: < 512MB
- CPU usage: < 50%
- Disk usage: < 80%

### Backup Strategy
- Database: Daily automated backup
- Logs: Weekly rotation
- Configuration: Version controlled
- SSL certificates: Auto-renewal

---

## 🎯 Production Checklist

- [ ] Domain configured and DNS updated
- [ ] SSL certificate installed
- [ ] Telegram bot configured
- [ ] Environment variables set
- [ ] Service running and enabled
- [ ] Nginx configured
- [ ] Firewall configured
- [ ] Monitoring setup
- [ ] Backup strategy implemented
- [ ] Health checks passing
- [ ] All features tested
- [ ] Documentation updated

**System Status**: ✅ Production Ready
