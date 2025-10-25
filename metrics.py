#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Metrics and Analytics System for Canli Destek Sistemi
"""
import time
import json
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from collections import defaultdict, deque
import logging

logger = logging.getLogger(__name__)


class MetricsCollector:
    """Centralized metrics collection system"""
    
    def __init__(self):
        self.metrics_lock = threading.Lock()
        self.start_time = time.time()
        
        # System metrics
        self.system_metrics = {
            'uptime_seconds': 0,
            'total_requests': 0,
            'total_calls': 0,
            'active_calls': 0,
            'completed_calls': 0,
            'failed_calls': 0,
            'rate_limit_hits': 0,
            'errors_total': 0,
            'memory_usage_mb': 0
        }
        
        # Performance metrics
        self.performance_metrics = {
            'avg_response_time_ms': 0,
            'max_response_time_ms': 0,
            'requests_per_minute': 0,
            'calls_per_hour': 0,
            'error_rate_percent': 0
        }
        
        # Call analytics
        self.call_analytics = {
            'total_duration_seconds': 0,
            'avg_call_duration_seconds': 0,
            'max_call_duration_seconds': 0,
            'calls_by_hour': defaultdict(int),
            'calls_by_day': defaultdict(int),
            'customer_names': defaultdict(int),
            'call_outcomes': defaultdict(int)
        }
        
        # Real-time data (last 24 hours)
        self.realtime_data = {
            'response_times': deque(maxlen=1000),
            'error_logs': deque(maxlen=100),
            'call_events': deque(maxlen=500),
            'request_counts': deque(maxlen=1440)  # 24 hours * 60 minutes
        }
        
        # Historical data (last 30 days)
        self.historical_data = {
            'daily_stats': defaultdict(dict),
            'hourly_stats': defaultdict(dict),
            'weekly_stats': defaultdict(dict)
        }
    
    def record_request(self, endpoint: str, response_time_ms: float, status_code: int) -> None:
        """Record API request metrics"""
        with self.metrics_lock:
            self.system_metrics['total_requests'] += 1
            
            # Update response time metrics
            self.realtime_data['response_times'].append(response_time_ms)
            self.performance_metrics['avg_response_time_ms'] = self._calculate_avg_response_time()
            self.performance_metrics['max_response_time_ms'] = max(
                self.performance_metrics['max_response_time_ms'], 
                response_time_ms
            )
            
            # Record error if status code >= 400
            if status_code >= 400:
                self.system_metrics['errors_total'] += 1
                self.realtime_data['error_logs'].append({
                    'timestamp': datetime.now(),
                    'endpoint': endpoint,
                    'status_code': status_code,
                    'response_time_ms': response_time_ms
                })
            
            logger.debug(f"Request recorded: {endpoint} - {response_time_ms}ms - {status_code}")
    
    def record_call_event(self, event_type: str, call_id: str, customer_name: str, 
                         duration_seconds: Optional[int] = None) -> None:
        """Record call-related events"""
        with self.metrics_lock:
            current_time = datetime.now()
            
            # Update call analytics
            if event_type == 'call_started':
                self.system_metrics['total_calls'] += 1
                self.system_metrics['active_calls'] += 1
                self.call_analytics['calls_by_hour'][current_time.hour] += 1
                self.call_analytics['calls_by_day'][current_time.strftime('%Y-%m-%d')] += 1
                self.call_analytics['customer_names'][customer_name] += 1
            
            elif event_type == 'call_completed':
                self.system_metrics['active_calls'] = max(0, self.system_metrics['active_calls'] - 1)
                self.system_metrics['completed_calls'] += 1
                self.call_analytics['call_outcomes']['completed'] += 1
                
                if duration_seconds:
                    self.call_analytics['total_duration_seconds'] += duration_seconds
                    self.call_analytics['avg_call_duration_seconds'] = (
                        self.call_analytics['total_duration_seconds'] / 
                        self.system_metrics['completed_calls']
                    )
                    self.call_analytics['max_call_duration_seconds'] = max(
                        self.call_analytics['max_call_duration_seconds'],
                        duration_seconds
                    )
            
            elif event_type == 'call_failed':
                self.system_metrics['active_calls'] = max(0, self.system_metrics['active_calls'] - 1)
                self.system_metrics['failed_calls'] += 1
                self.call_analytics['call_outcomes']['failed'] += 1
            
            # Record in real-time data
            self.realtime_data['call_events'].append({
                'timestamp': current_time,
                'event_type': event_type,
                'call_id': call_id[:8],
                'customer_name': customer_name,
                'duration_seconds': duration_seconds
            })
            
            logger.debug(f"Call event recorded: {event_type} - {call_id[:8]}")
    
    def record_rate_limit_hit(self, client_ip: str) -> None:
        """Record rate limiting event"""
        with self.metrics_lock:
            self.system_metrics['rate_limit_hits'] += 1
            logger.warning(f"Rate limit hit recorded for IP: {client_ip}")
    
    def update_system_metrics(self, active_calls: int, memory_usage_mb: float) -> None:
        """Update system-level metrics"""
        with self.metrics_lock:
            self.system_metrics['active_calls'] = active_calls
            self.system_metrics['memory_usage_mb'] = memory_usage_mb
            self.system_metrics['uptime_seconds'] = int(time.time() - self.start_time)
    
    def _calculate_avg_response_time(self) -> float:
        """Calculate average response time from recent requests"""
        if not self.realtime_data['response_times']:
            return 0.0
        return sum(self.realtime_data['response_times']) / len(self.realtime_data['response_times'])
    
    def _calculate_error_rate(self) -> float:
        """Calculate error rate percentage"""
        total_requests = self.system_metrics['total_requests']
        if total_requests == 0:
            return 0.0
        return (self.system_metrics['errors_total'] / total_requests) * 100
    
    def _calculate_requests_per_minute(self) -> float:
        """Calculate requests per minute"""
        uptime_minutes = self.system_metrics['uptime_seconds'] / 60
        if uptime_minutes == 0:
            return 0.0
        return self.system_metrics['total_requests'] / uptime_minutes
    
    def _calculate_calls_per_hour(self) -> float:
        """Calculate calls per hour"""
        uptime_hours = self.system_metrics['uptime_seconds'] / 3600
        if uptime_hours == 0:
            return 0.0
        return self.system_metrics['total_calls'] / uptime_hours
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current system metrics"""
        with self.metrics_lock:
            # Update calculated metrics
            self.performance_metrics['avg_response_time_ms'] = self._calculate_avg_response_time()
            self.performance_metrics['error_rate_percent'] = self._calculate_error_rate()
            self.performance_metrics['requests_per_minute'] = self._calculate_requests_per_minute()
            self.performance_metrics['calls_per_hour'] = self._calculate_calls_per_hour()
            
            return {
                'timestamp': datetime.now().isoformat(),
                'system': dict(self.system_metrics),
                'performance': dict(self.performance_metrics),
                'call_analytics': dict(self.call_analytics),
                'realtime': {
                    'recent_response_times': list(self.realtime_data['response_times'])[-10:],
                    'recent_errors': list(self.realtime_data['error_logs'])[-5:],
                    'recent_call_events': list(self.realtime_data['call_events'])[-10:]
                }
            }
    
    def get_historical_data(self, days: int = 7) -> Dict[str, Any]:
        """Get historical data for specified number of days"""
        with self.metrics_lock:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            historical = {
                'period': f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
                'daily_stats': {},
                'hourly_stats': {},
                'summary': {
                    'total_calls': sum(self.call_analytics['calls_by_day'].values()),
                    'total_duration': self.call_analytics['total_duration_seconds'],
                    'avg_duration': self.call_analytics['avg_call_duration_seconds'],
                    'top_customers': dict(sorted(
                        self.call_analytics['customer_names'].items(),
                        key=lambda x: x[1], reverse=True
                    )[:10])
                }
            }
            
            # Filter data by date range
            for date_str, count in self.call_analytics['calls_by_day'].items():
                date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                if start_date <= date_obj <= end_date:
                    historical['daily_stats'][date_str] = count
            
            return historical
    
    def export_metrics(self, format_type: str = 'json') -> str:
        """Export metrics in specified format"""
        metrics = self.get_current_metrics()
        
        if format_type == 'json':
            return json.dumps(metrics, indent=2, default=str)
        elif format_type == 'csv':
            # Simple CSV export for key metrics
            csv_lines = [
                'metric,value',
                f'uptime_seconds,{metrics["system"]["uptime_seconds"]}',
                f'total_requests,{metrics["system"]["total_requests"]}',
                f'total_calls,{metrics["system"]["total_calls"]}',
                f'active_calls,{metrics["system"]["active_calls"]}',
                f'avg_response_time_ms,{metrics["performance"]["avg_response_time_ms"]:.2f}',
                f'error_rate_percent,{metrics["performance"]["error_rate_percent"]:.2f}'
            ]
            return '\n'.join(csv_lines)
        else:
            raise ValueError(f"Unsupported format: {format_type}")


# Global metrics collector instance
metrics_collector = MetricsCollector()


def record_request_metrics(endpoint: str, response_time_ms: float, status_code: int) -> None:
    """Convenience function to record request metrics"""
    metrics_collector.record_request(endpoint, response_time_ms, status_code)


def record_call_metrics(event_type: str, call_id: str, customer_name: str, 
                       duration_seconds: Optional[int] = None) -> None:
    """Convenience function to record call metrics"""
    metrics_collector.record_call_event(event_type, call_id, customer_name, duration_seconds)


def record_rate_limit_metrics(client_ip: str) -> None:
    """Convenience function to record rate limit metrics"""
    metrics_collector.record_rate_limit_hit(client_ip)


def get_system_metrics() -> Dict[str, Any]:
    """Get current system metrics"""
    return metrics_collector.get_current_metrics()


def get_historical_metrics(days: int = 7) -> Dict[str, Any]:
    """Get historical metrics"""
    return metrics_collector.get_historical_data(days)


def export_metrics(format_type: str = 'json') -> str:
    """Export metrics in specified format"""
    return metrics_collector.export_metrics(format_type)
