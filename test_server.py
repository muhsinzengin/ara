#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unit tests for server_v2.py
"""
import unittest
import sys
import os
import tempfile
import json
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import server modules
import server_v2
from server_v2 import (
    APIError, ValidationError, RateLimitError, AuthenticationError,
    validate_input, sanitize_input, check_rate_limit,
    log_call_event, create_call_log_entry, remove_call_from_active
)


class TestCustomExceptions(unittest.TestCase):
    """Test custom exception classes"""
    
    def test_api_error(self):
        """Test APIError exception"""
        error = APIError("Test error", 400)
        self.assertEqual(error.message, "Test error")
        self.assertEqual(error.status_code, 400)
    
    def test_validation_error(self):
        """Test ValidationError exception"""
        error = ValidationError("Validation failed")
        self.assertEqual(error.message, "Validation failed")
        self.assertEqual(error.status_code, 422)
    
    def test_rate_limit_error(self):
        """Test RateLimitError exception"""
        error = RateLimitError()
        self.assertEqual(error.message, "Rate limit exceeded")
        self.assertEqual(error.status_code, 429)
    
    def test_authentication_error(self):
        """Test AuthenticationError exception"""
        error = AuthenticationError()
        self.assertEqual(error.message, "Authentication required")
        self.assertEqual(error.status_code, 401)


class TestInputValidation(unittest.TestCase):
    """Test input validation functions"""
    
    def test_validate_input_success(self):
        """Test successful input validation"""
        data = {'customer_name': 'Ahmet', 'otp': '123456'}
        result = validate_input(data, max_length={'customer_name': 50, 'otp': 6})
        self.assertTrue(result)
    
    def test_validate_input_missing_field(self):
        """Test validation with missing required field"""
        data = {'customer_name': 'Ahmet'}
        with self.assertRaises(ValidationError):
            validate_input(data, required_fields=['otp'])
    
    def test_validate_input_too_long(self):
        """Test validation with field too long"""
        data = {'customer_name': 'A' * 100}
        with self.assertRaises(ValidationError):
            validate_input(data, max_length={'customer_name': 50})
    
    def test_validate_input_xss_protection(self):
        """Test XSS protection in validation"""
        data = {'customer_name': '<script>alert(1)</script>'}
        with self.assertRaises(ValidationError):
            validate_input(data)


class TestInputSanitization(unittest.TestCase):
    """Test input sanitization functions"""
    
    def test_sanitize_input_basic(self):
        """Test basic input sanitization"""
        result = sanitize_input('<script>alert(1)</script>')
        expected = '&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;'
        self.assertEqual(result, expected)
    
    def test_sanitize_input_multiple_chars(self):
        """Test sanitization of multiple dangerous characters"""
        result = sanitize_input('Test "quotes" & <tags>')
        expected = 'Test &amp;quot;quotes&amp;quot; &amp; &amp;lt;tags&amp;gt;'
        self.assertEqual(result, expected)
    
    def test_sanitize_input_non_string(self):
        """Test sanitization with non-string input"""
        result = sanitize_input(123)
        self.assertEqual(result, 123)


class TestRateLimiting(unittest.TestCase):
    """Test rate limiting functionality"""
    
    def setUp(self):
        """Set up test environment"""
        # Clear rate limit storage from otp_manager
        from otp_manager import rate_limit_storage
        rate_limit_storage.clear()
        # Enable rate limiting for tests
        server_v2.RATE_LIMIT_ENABLED = True
        server_v2.RATE_LIMIT_CALLS = 2
        server_v2.RATE_LIMIT_PERIOD = 60
    
    def test_rate_limit_first_request(self):
        """Test first request should pass"""
        result = check_rate_limit('192.168.1.1')
        self.assertTrue(result)
    
    def test_rate_limit_within_limit(self):
        """Test requests within limit should pass"""
        check_rate_limit('192.168.1.1')
        result = check_rate_limit('192.168.1.1')
        self.assertTrue(result)
    
    def test_rate_limit_exceeded(self):
        """Test exceeding rate limit should raise exception"""
        # OTPManager uses different limits, need to exceed them
        from otp_manager import RATE_LIMIT_REQUESTS
        for i in range(RATE_LIMIT_REQUESTS):
            check_rate_limit('192.168.1.1')
        with self.assertRaises(RateLimitError):
            check_rate_limit('192.168.1.1')
    
    def test_rate_limit_different_ips(self):
        """Test different IPs have separate limits"""
        check_rate_limit('192.168.1.1')
        check_rate_limit('192.168.1.1')
        
        # Different IP should still work
        result = check_rate_limit('192.168.1.2')
        self.assertTrue(result)


class TestUtilityFunctions(unittest.TestCase):
    """Test utility functions"""
    
    def setUp(self):
        """Set up test environment"""
        server_v2.active_calls.clear()
        server_v2.call_logs.clear()
    
    def test_log_call_event(self):
        """Test call event logging"""
        with patch('server_v2.logger') as mock_logger:
            log_call_event('test123', 'test_event', 'Test User', 30)
            mock_logger.info.assert_called_once()
    
    def test_create_call_log_entry(self):
        """Test call log entry creation"""
        call_data = {
            'customer_name': 'Test User',
            'timestamp': datetime.now() - timedelta(minutes=5)
        }
        entry = create_call_log_entry(call_data, 'completed', 300)
        
        self.assertEqual(entry['customer_name'], 'Test User')
        self.assertEqual(entry['status'], 'completed')
        self.assertEqual(entry['duration'], 300)
    
    def test_remove_call_from_active_exists(self):
        """Test removing existing call from active calls"""
        call_id = 'test123'
        call_data = {
            'customer_name': 'Test User',
            'timestamp': datetime.now(),
            'status': 'connected'
        }
        server_v2.active_calls[call_id] = call_data
        
        result = remove_call_from_active(call_id, 'test_reason')
        
        self.assertTrue(result)
        self.assertNotIn(call_id, server_v2.active_calls)
        self.assertEqual(len(server_v2.call_logs), 1)
    
    def test_remove_call_from_active_not_exists(self):
        """Test removing non-existing call from active calls"""
        result = remove_call_from_active('nonexistent', 'test_reason')
        self.assertFalse(result)


class TestServerConfiguration(unittest.TestCase):
    """Test server configuration"""
    
    def test_environment_variables(self):
        """Test environment variable loading"""
        # Test that environment variables are loaded
        self.assertIsNotNone(server_v2.BASE_URL)
        self.assertIsInstance(server_v2.HTTPS_ENABLED, bool)
        self.assertIsInstance(server_v2.RATE_LIMIT_ENABLED, bool)
        self.assertIsInstance(server_v2.ALLOWED_ORIGINS, list)
    
    def test_logging_setup(self):
        """Test logging configuration"""
        logger = server_v2.setup_logging()
        self.assertIsInstance(logger, server_v2.logging.Logger)
        self.assertGreaterEqual(len(logger.handlers), 2)  # At least Console + File handlers


class TestOTPManagerCore(unittest.TestCase):
    """Test OTPManager core behaviors: create, verify, stats, find by code"""

    def setUp(self):
        # Temiz başlangıç için internal storage temizle
        from otp_manager import otp_codes, admin_sessions
        otp_codes.clear()
        admin_sessions.clear()

    def test_create_increments_stats(self):
        from otp_manager import OTPManager
        code = OTPManager.create_otp('cid1')
        self.assertIsInstance(code, str)
        stats = OTPManager.get_stats()
        self.assertEqual(stats.get('active_otps'), 1)

    def test_verify_decrements_stats(self):
        from otp_manager import OTPManager
        code = OTPManager.create_otp('cid2')
        ok, msg = OTPManager.verify_otp('cid2', code)
        self.assertTrue(ok)
        stats = OTPManager.get_stats()
        self.assertEqual(stats.get('active_otps'), 0)

    def test_find_call_id_by_code(self):
        from otp_manager import OTPManager
        code = OTPManager.create_otp('cid3')
        found = OTPManager.find_call_id_by_code(code)
        self.assertEqual(found, 'cid3')
        # Doğrulama sonrası kod kaydı silinir, yeniden bulunmamalı
        OTPManager.verify_otp('cid3', code)
        self.assertIsNone(OTPManager.find_call_id_by_code(code))


class TestTelegramNotifications(unittest.TestCase):
    """Test send_telegram behavior under different conditions"""

    def setUp(self):
        # Token ve chat id test değerleri (env üzerinden alınır, kodda sabit yok)
        server_v2.TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
        server_v2.TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '')

    def test_send_telegram_disabled(self):
        server_v2.TELEGRAM_ENABLED = False
        result = server_v2.send_telegram('hello')
        self.assertFalse(result)

    def test_send_telegram_success(self):
        server_v2.TELEGRAM_ENABLED = True
        with patch('server_v2.urllib.request.urlopen') as mock_urlopen:
            mock_urlopen.return_value = MagicMock()
            result = server_v2.send_telegram('hello')
            self.assertTrue(result)
            mock_urlopen.assert_called_once()

    def test_send_telegram_error(self):
        server_v2.TELEGRAM_ENABLED = True
        with patch('server_v2.urllib.request.urlopen', side_effect=Exception('fail')):
            result = server_v2.send_telegram('hello')
            self.assertFalse(result)


if __name__ == '__main__':
    # Create test suite
    test_suite = unittest.TestSuite()
    
    # Add test classes
    test_classes = [
        TestCustomExceptions,
        TestInputValidation,
        TestInputSanitization,
        TestRateLimiting,
        TestUtilityFunctions,
        TestServerConfiguration,
        TestOTPManagerCore,
        TestTelegramNotifications
    ]
    
    for test_class in test_classes:
        tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
        test_suite.addTests(tests)
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    # Print summary
    print(f"\n{'='*50}")
    print(f"Test Summary:")
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success rate: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%")
    print(f"{'='*50}")
    
    # Exit with appropriate code
    sys.exit(0 if result.wasSuccessful() else 1)
