#!/bin/bash
# Production Monitoring Script for Canlı Destek Sistemi

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SERVICE_NAME="canli-destek"
APP_DIR="/opt/canli-destek"
LOG_FILE="$APP_DIR/production.log"

# Function to check service status
check_service() {
    if systemctl is-active --quiet $SERVICE_NAME; then
        echo -e "${GREEN}✓${NC} Service is running"
        return 0
    else
        echo -e "${RED}✗${NC} Service is not running"
        return 1
    fi
}

# Function to check API health
check_api() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/healthz)
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓${NC} API is responding"
        return 0
    else
        echo -e "${RED}✗${NC} API is not responding (HTTP $response)"
        return 1
    fi
}

# Function to check disk space
check_disk() {
    local usage=$(df -h $APP_DIR | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$usage" -lt 80 ]; then
        echo -e "${GREEN}✓${NC} Disk usage: ${usage}%"
        return 0
    elif [ "$usage" -lt 90 ]; then
        echo -e "${YELLOW}⚠${NC} Disk usage: ${usage}% (warning)"
        return 1
    else
        echo -e "${RED}✗${NC} Disk usage: ${usage}% (critical)"
        return 1
    fi
}

# Function to check memory usage
check_memory() {
    local usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ "$usage" -lt 80 ]; then
        echo -e "${GREEN}✓${NC} Memory usage: ${usage}%"
        return 0
    elif [ "$usage" -lt 90 ]; then
        echo -e "${YELLOW}⚠${NC} Memory usage: ${usage}% (warning)"
        return 1
    else
        echo -e "${RED}✗${NC} Memory usage: ${usage}% (critical)"
        return 1
    fi
}

# Function to check log file size
check_logs() {
    if [ -f "$LOG_FILE" ]; then
        local size=$(du -h "$LOG_FILE" | cut -f1)
        echo -e "${GREEN}✓${NC} Log file size: $size"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} Log file not found"
        return 1
    fi
}

# Function to show recent errors
show_errors() {
    echo -e "\n${YELLOW}Recent Errors (last 10):${NC}"
    if [ -f "$LOG_FILE" ]; then
        grep -i "error\|exception\|traceback" "$LOG_FILE" | tail -10
    else
        echo "No log file found"
    fi
}

# Function to show active calls
show_calls() {
    echo -e "\n${YELLOW}Active Calls:${NC}"
    local calls=$(curl -s http://localhost:8080/api/active-calls | jq -r '.active_calls | length')
    echo "Active calls: $calls"
}

# Function to restart service
restart_service() {
    echo -e "\n${YELLOW}Restarting service...${NC}"
    systemctl restart $SERVICE_NAME
    sleep 5
    check_service
}

# Main monitoring function
monitor() {
    echo -e "${GREEN}=== Canlı Destek Sistemi Monitoring ===${NC}\n"
    
    local issues=0
    
    echo "Service Status:"
    if ! check_service; then
        ((issues++))
    fi
    
    echo -e "\nAPI Health:"
    if ! check_api; then
        ((issues++))
    fi
    
    echo -e "\nSystem Resources:"
    if ! check_disk; then
        ((issues++))
    fi
    if ! check_memory; then
        ((issues++))
    fi
    
    echo -e "\nLogs:"
    if ! check_logs; then
        ((issues++))
    fi
    
    show_calls
    show_errors
    
    echo -e "\n${YELLOW}=== Summary ===${NC}"
    if [ $issues -eq 0 ]; then
        echo -e "${GREEN}✓ All systems operational${NC}"
    else
        echo -e "${RED}✗ $issues issues detected${NC}"
        echo -e "${YELLOW}Consider restarting the service${NC}"
    fi
}

# Continuous monitoring mode
continuous_monitor() {
    while true; do
        clear
        monitor
        echo -e "\n${YELLOW}Press Ctrl+C to exit${NC}"
        sleep 30
    done
}

# Main script
case "${1:-monitor}" in
    "monitor")
        monitor
        ;;
    "continuous")
        continuous_monitor
        ;;
    "restart")
        restart_service
        ;;
    "status")
        check_service
        check_api
        ;;
    *)
        echo "Usage: $0 {monitor|continuous|restart|status}"
        echo "  monitor     - Run single monitoring check"
        echo "  continuous  - Run continuous monitoring"
        echo "  restart     - Restart the service"
        echo "  status      - Quick status check"
        exit 1
        ;;
esac
