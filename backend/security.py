"""
Security Middleware and Utilities
"""
import time
import re
import bleach
from typing import Dict, List
from fastapi import Request, HTTPException, status
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from functools import wraps
import logging

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

# Security logging
security_logger = logging.getLogger("security")

def sanitize_input(input_data: str) -> str:
    """Sanitize user input to prevent XSS and injection"""
    if not input_data:
        return ""
    
    # Remove HTML tags
    clean_data = bleach.clean(input_data)
    
    # Remove potentially dangerous characters
    clean_data = re.sub(r'[<>"\';&]', '', clean_data)
    
    # Remove SQL injection patterns
    sql_patterns = [
        r'(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)',
        r'(\b(UNION|OR|AND)\b.*\b(=|LIKE)\b)',
        r'(--|#|/\*|\*/)',
        r'(\b(SCRIPT|JAVASCRIPT|VBSCRIPT|ONLOAD|ONERROR)\b)'
    ]
    
    for pattern in sql_patterns:
        clean_data = re.sub(pattern, '', clean_data, flags=re.IGNORECASE)
    
    return clean_data.strip()

def validate_student_id(student_id: str) -> bool:
    """Validate student ID format (e.g., 20221CIT0043)"""
    pattern = r'^\d{4,5}CIT\d{4}$'
    return bool(re.match(pattern, student_id))

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def log_security_event(event_type: str, details: Dict, level: str = "WARNING"):
    """Log security events"""
    security_logger.log(
        getattr(logging, level),
        f"SECURITY_EVENT: {event_type} - {details}"
    )

class SecurityHeaders:
    """Security headers middleware"""
    
    @staticmethod
    def add_headers(request: Request, call_next):
        """Add security headers to response"""
        response = call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        
        return response

class InputValidator:
    """Input validation utilities"""
    
    @staticmethod
    def validate_face_image(image_data: str) -> bool:
        """Validate face image data"""
        if not image_data or not isinstance(image_data, str):
            return False
        
        # Check if base64 (strip data URL prefix if present)
        try:
            import base64
            raw_data = image_data
            if ',' in raw_data:
                raw_data = raw_data.split(',')[1]
            base64.b64decode(raw_data)
            return True
        except:
            return False
    
    @staticmethod
    def validate_attendance_data(data: Dict) -> bool:
        """Validate attendance data"""
        required_fields = ['studentId', 'studentName', 'image']
        
        for field in required_fields:
            if field not in data or not data[field]:
                return False
        
        if not validate_student_id(data['studentId']):
            return False
        
        if not InputValidator.validate_face_image(data['image']):
            return False
        
        return True

def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Custom rate limit exceeded handler"""
    log_security_event("RATE_LIMIT_EXCEEDED", {
        "ip": get_remote_address(request),
        "path": request.url.path,
        "method": request.method
    })
    
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Rate limit exceeded. Please try again later."
    )

# Rate limit configurations
RATE_LIMITS = {
    "login": "5/minute",
    "face_verify": "10/minute",
    "admin_upload": "20/hour",
    "general": "100/hour"
}

def get_rate_limit(endpoint: str) -> str:
    """Get rate limit for endpoint"""
    return RATE_LIMITS.get(endpoint, RATE_LIMITS["general"])

def audit_log(action: str, user_id: str = None, details: Dict = None):
    """Create audit log entry"""
    log_entry = {
        "timestamp": time.time(),
        "action": action,
        "user_id": user_id,
        "details": details or {}
    }
    
    log_security_event("AUDIT_LOG", log_entry, "INFO")

class SecurityConfig:
    """Security configuration"""
    
    # Password requirements
    MIN_PASSWORD_LENGTH = 8
    REQUIRE_UPPERCASE = True
    REQUIRE_LOWERCASE = True
    REQUIRE_NUMBERS = True
    REQUIRE_SPECIAL_CHARS = True
    
    # Session settings
    SESSION_TIMEOUT_MINUTES = 1440  # 24 hours
    MAX_LOGIN_ATTEMPTS = 5
    LOCKOUT_DURATION_MINUTES = 15
    
    # File upload limits
    MAX_IMAGE_SIZE_MB = 5
    ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg']
    
    @staticmethod
    def validate_password(password: str) -> tuple[bool, str]:
        """Validate password strength"""
        errors = []
        
        if len(password) < SecurityConfig.MIN_PASSWORD_LENGTH:
            errors.append(f"Password must be at least {SecurityConfig.MIN_PASSWORD_LENGTH} characters")
        
        if SecurityConfig.REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
            errors.append("Password must contain uppercase letter")
        
        if SecurityConfig.REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
            errors.append("Password must contain lowercase letter")
        
        if SecurityConfig.REQUIRE_NUMBERS and not re.search(r'\d', password):
            errors.append("Password must contain number")
        
        if SecurityConfig.REQUIRE_SPECIAL_CHARS and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append("Password must contain special character")
        
        return len(errors) == 0, "; ".join(errors) if errors else ""

class BruteForceProtection:
    """Brute force attack protection"""
    
    def __init__(self):
        self.failed_attempts = {}
    
    def record_failed_attempt(self, identifier: str):
        """Record failed login attempt"""
        if identifier not in self.failed_attempts:
            self.failed_attempts[identifier] = []
        
        self.failed_attempts[identifier].append(time.time())
        
        # Remove old attempts (older than lockout duration)
        cutoff = time.time() - (SecurityConfig.LOCKOUT_DURATION_MINUTES * 60)
        self.failed_attempts[identifier] = [
            attempt for attempt in self.failed_attempts[identifier] 
            if attempt > cutoff
        ]
    
    def is_locked_out(self, identifier: str) -> bool:
        """Check if identifier is locked out"""
        if identifier not in self.failed_attempts:
            return False
        
        recent_attempts = len(self.failed_attempts[identifier])
        return recent_attempts >= SecurityConfig.MAX_LOGIN_ATTEMPTS
    
    def get_remaining_lockout_time(self, identifier: str) -> int:
        """Get remaining lockout time in seconds"""
        if not self.is_locked_out(identifier):
            return 0
        
        oldest_attempt = min(self.failed_attempts[identifier])
        lockout_end = oldest_attempt + (SecurityConfig.LOCKOUT_DURATION_MINUTES * 60)
        remaining = lockout_end - time.time()
        
        return max(0, int(remaining))

# Global brute force protection instance
brute_force = BruteForceProtection()
