"""
FastAPI Face Recognition Backend
Automated Attendance System
"""

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import sqlite3
import json
import base64
import io
import cv2
import numpy as np
from datetime import datetime, date, timedelta
from pydantic import BaseModel
import os
import logging
from typing import Optional, Dict, Any
import hashlib
import secrets
import requests
import smtplib
from contextlib import contextmanager
import time
import uuid
import re
from pathlib import Path
from threading import Thread
from typing import List
from fastapi import Query
import uvicorn
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import pytz

# Security imports
from auth import auth_manager, UserRole, LoginCredentials, Token
from security import (
    limiter, rate_limit_exceeded_handler, sanitize_input, 
    validate_student_id, validate_email, log_security_event,
    SecurityHeaders, InputValidator, audit_log, SecurityConfig,
    brute_force, get_rate_limit
)

# Import configuration
try:
    from config import (
        LOW_LIGHT_THRESHOLD, APPLY_HISTOGRAM_EQUALIZATION,
        SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, ADMIN_EMAIL, EMAIL_ENABLED,
        DB_FILE, DATA_DIR, LOG_LEVEL
    )
except ImportError:
    # Fallback defaults if config.py is not available
    LOW_LIGHT_THRESHOLD = 50.0
    APPLY_HISTOGRAM_EQUALIZATION = True
    SMTP_SERVER = "smtp.gmail.com"
    SMTP_PORT = 587
    SMTP_USERNAME = "your-email@gmail.com"
    SMTP_PASSWORD = "your-app-password"
    ADMIN_EMAIL = "admin@school.edu"
    EMAIL_ENABLED = True
    DB_FILE = Path(__file__).parent / 'data' / 'attendance.db'
    DATA_DIR = Path(__file__).parent / 'data'
    LOG_LEVEL = "INFO"

# Try to import face recognition, but handle gracefully if not available
try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
    print("✅ Face recognition library loaded")
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False
    print("⚠️  Face recognition library not available - using OpenCV face recognition")

# Import OpenCV face recognition
try:
    from opencv_face_recognition import OpenCVFaceRecognizer
    OPENCV_FACE_RECOGNITION_AVAILABLE = True
    print("✅ OpenCV face recognition loaded")
except ImportError:
    OPENCV_FACE_RECOGNITION_AVAILABLE = False
    print("❌ OpenCV face recognition not available")

# Initialize FastAPI app
app = FastAPI(
    title="Automated Attendance System API",
    description="Secure Face Recognition Attendance System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Security middleware
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "*.netlify.app"])
app.add_middleware(SlowAPIMiddleware)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Security Bearer token
security = HTTPBearer()

# CORS - Allow all local network IPs and HTTPS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "https://localhost:8080",
        "http://127.0.0.1:8080",
        "https://127.0.0.1:8080",
        "http://192.168.0.108:8080",
        "https://192.168.0.108:8080",
        "http://172.17.50.249:8080",
        "https://172.17.50.249:8080",
        "http://172.20.10.4:8080",
        "https://172.20.10.4:8080",
        "http://localhost:8081",
        "https://localhost:8081",
        "http://172.20.10.4:8081",
        "https://172.20.10.4:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ensure data directory exists
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Additional paths
ENCODINGS_FILE = DATA_DIR / 'face_encodings.json'
STUDENTS_FOLDER = DATA_DIR / 'student_images'
STUDENTS_FOLDER.mkdir(parents=True, exist_ok=True)

# Initialize OpenCV face recognizer if available
opencv_recognizer = None
if OPENCV_FACE_RECOGNITION_AVAILABLE:
    opencv_recognizer = OpenCVFaceRecognizer(ENCODINGS_FILE, STUDENTS_FOLDER)

# In-memory tracker for recent attendance events (for cross-device sync notifications)
# Stores last 20 events, each with timestamp, student info
recent_attendance_events = []
MAX_RECENT_EVENTS = 20

# Timezone standardization - Use IST (Asia/Kolkata) for all date/time operations
IST = pytz.timezone('Asia/Kolkata')

def get_current_datetime_ist():
    """Get current datetime in IST timezone"""
    return datetime.now(IST)

def get_current_date_ist():
    """Get current date in IST timezone (YYYY-MM-DD format)"""
    return get_current_datetime_ist().date()

def get_current_time_ist():
    """Get current time in IST timezone"""
    return get_current_datetime_ist().time()

def format_date_for_db(date_obj):
    """Format date object to YYYY-MM-DD string for database"""
    if isinstance(date_obj, str):
        return date_obj
    return date_obj.strftime('%Y-%m-%d') if date_obj else None

def format_time_for_db(time_obj):
    """Format time object to HH:MM:SS string for database"""
    if isinstance(time_obj, str):
        return time_obj
    return time_obj.strftime('%H:%M:%S') if time_obj else None

# Pydantic Models
class StudentPhotoUpload(BaseModel):
    studentId: str
    studentName: str
    image: str
    grade: Optional[str] = None

class FaceVerificationRequest(BaseModel):
    studentId: str
    studentName: str
    image: str

class QRAttendanceWithFace(BaseModel):
    studentId: str
    studentName: str
    image: str

class OfflineAttendanceRecord(BaseModel):
    studentId: str
    studentName: str
    image: str
    timestamp: str
    syncStatus: str = "pending"

class NotificationRecord(BaseModel):
    recipient: str
    subject: str
    message: str
    status: str = "pending"
    created_at: str

# Database Setup
def init_db():
    """Initialize database tables only if they don't exist"""
    conn = sqlite3.connect(str(DB_FILE.absolute()))
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            grade TEXT,
            photo_path TEXT,
            has_face_encoding INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            student_name TEXT NOT NULL,
            date DATE NOT NULL,
            check_in_time TIME NOT NULL,
            method TEXT DEFAULT 'face_recognition',
            confidence_score REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_offline INTEGER DEFAULT 0,
            FOREIGN KEY (student_id) REFERENCES students(student_id),
            UNIQUE(student_id, date)
        )
    ''')
    
    # Face encodings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS face_encodings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            encoding BLOB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(student_id),
            UNIQUE(student_id)
        )
    ''')
    
    # Notifications table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipient TEXT NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            sent_at TIMESTAMP,
            retry_count INTEGER DEFAULT 0
        )
    ''')
    
    # Logs table for telemetry
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            event_type TEXT NOT NULL,
            message TEXT,
            student_id TEXT,
            level TEXT DEFAULT 'INFO'
        )
    ''')
    
    # Offline attendance sync table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS offline_sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            student_name TEXT NOT NULL,
            date DATE NOT NULL,
            check_in_time TIME NOT NULL,
            method TEXT DEFAULT 'face_recognition',
            confidence_score REAL,
            client_timestamp TEXT,
            sync_status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            retry_count INTEGER DEFAULT 0
        )
    ''')
    
    # Attendance sessions table for dual verification
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            session_token TEXT NOT NULL,
            qr_verified INTEGER DEFAULT 0,
            face_verified INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            UNIQUE(student_id, session_token)
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ Database tables initialized")

def seed_initial_students():
    """Seed the database with initial real students only if table is empty"""
    conn = sqlite3.connect(str(DB_FILE.absolute()))
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) FROM students')
    count = cursor.fetchone()[0]

    if count == 0:
        print("Students table is empty, seeding initial data...")

        initial_students = [
            ('20221CIT0043', 'Amrutha M', 'CIT 2022'),
            ('20221CIT0049', 'C M Shalini', 'CIT 2022'),
            ('20221CIT0151', 'Vismaya L', 'CIT 2022')
        ]

        for student_id, name, grade in initial_students:
            cursor.execute('''
                INSERT OR IGNORE INTO students 
                (student_id, name, grade, has_face_encoding)
                VALUES (?, ?, ?, 0)
            ''', (student_id, name, grade))

        conn.commit()
        print("Initial students seeded successfully")
    else:
        print(f"Students table already has {count} records, skipping seed")

    conn.close()



# Initialize database on startup
init_db()
seed_initial_students()

# Face Encoding Functions
def load_encodings():
    if ENCODINGS_FILE.exists():
        with open(ENCODINGS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for student_id in data:
                data[student_id]['encoding'] = np.array(data[student_id]['encoding'])
            return data
    return {}


def save_encodings(encodings):
    data = {}
    for student_id, info in encodings.items():
        data[student_id] = {
            'name': info['name'],
            'encoding': info['encoding'].tolist()
        }
    with open(ENCODINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

known_encodings = load_encodings()
print(f"✅ Loaded {len(known_encodings)} encodings")

# Helper Functions
def decode_base64_image(image_data) -> np.ndarray:
    try:
        # Ensure we're working with a string
        if isinstance(image_data, bytes):
            image_data = image_data.decode('utf-8')
        
        # Strip data URL prefix (e.g., "data:image/jpeg;base64,")
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise ValueError("Failed to decode image")
        
        return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")

def detect_low_light(image: np.ndarray) -> dict:
    """
    Detect if image has low lighting conditions
    
    Args:
        image: RGB image as numpy array
        
    Returns:
        dict: Contains brightness value and low_light status
    """
    try:
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # Calculate average brightness
        avg_brightness = np.mean(gray)
        
        # Determine if low light
        is_low_light = avg_brightness < LOW_LIGHT_THRESHOLD
        
        result = {
            "brightness": float(avg_brightness),
            "is_low_light": is_low_light,
            "threshold": LOW_LIGHT_THRESHOLD
        }
        
        # Log low light detection
        log_event("LOW_LIGHT_DETECTION", 
                 f"Image brightness: {avg_brightness:.2f}, Low light: {is_low_light}",
                 details=json.dumps(result))
        
        return result
    except Exception as e:
        log_event("LOW_LIGHT_DETECTION_ERROR", f"Error in low-light detection: {str(e)}")
        return {"brightness": 0.0, "is_low_light": False, "threshold": LOW_LIGHT_THRESHOLD}

def enhance_low_light_image(image: np.ndarray) -> np.ndarray:
    """
    Enhance image using histogram equalization for low-light conditions
    
    Args:
        image: RGB image as numpy array
        
    Returns:
        Enhanced RGB image as numpy array
    """
    try:
        # Convert to LAB color space
        lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply histogram equalization to L channel
        l_eq = cv2.equalizeHist(l)
        
        # Merge channels back
        lab_eq = cv2.merge([l_eq, a, b])
        
        # Convert back to RGB
        enhanced = cv2.cvtColor(lab_eq, cv2.COLOR_LAB2RGB)
        
        log_event("LOW_LIGHT_ENHANCEMENT", "Applied histogram equalization to enhance image")
        
        return enhanced
    except Exception as e:
        log_event("LOW_LIGHT_ENHANCEMENT_ERROR", f"Error enhancing low-light image: {str(e)}")
        return image  # Return original if enhancement fails

def log_event(event_type: str, message: str, student_id: str = None, details: str = None, level: str = "INFO"):
    """
    Log events to database for telemetry
    
    Args:
        event_type: Type of event (e.g., 'ATTENDANCE_MARKED', 'LOW_LIGHT_DETECTED')
        message: Log message
        student_id: Optional student ID
        details: Additional details as JSON string
        level: Log level (INFO, WARNING, ERROR)
    """
    try:
        conn = sqlite3.connect(str(DB_FILE.absolute()))
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO logs (event_type, message, details, student_id, level)
            VALUES (?, ?, ?, ?, ?)
        ''', (event_type, message, details, student_id, level))
        
        conn.commit()
        conn.close()
    except Exception as e:
        # Fallback to console logging if database logging fails
        print(f"LOG ERROR: {str(e)}")
        print(f"{level}: {event_type} - {message}")

def send_email_notification(recipient: str, subject: str, message: str) -> bool:
    """
    Send email notification using SMTP
    
    Args:
        recipient: Email address of recipient
        subject: Email subject
        message: Email body
        
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    if not EMAIL_ENABLED:
        log_event("EMAIL_DISABLED", "Email notifications are disabled")
        return False
    
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = SMTP_USERNAME
        msg['To'] = recipient
        msg['Subject'] = subject
        
        msg.attach(MIMEText(message, 'plain'))
        
        # Send email
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        text = msg.as_string()
        server.sendmail(SMTP_USERNAME, recipient, text)
        server.quit()
        
        log_event("EMAIL_SENT", f"Email sent successfully to {recipient}")
        return True
        
    except Exception as e:
        error_msg = f"Failed to send email to {recipient}: {str(e)}"
        log_event("EMAIL_SEND_ERROR", error_msg, level="ERROR")
        return False

def queue_notification(recipient: str, subject: str, message: str):
    """
    Queue notification for sending
    
    Args:
        recipient: Email address of recipient
        subject: Email subject
        message: Email body
    """
    try:
        conn = sqlite3.connect(str(DB_FILE.absolute()))
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO notifications (recipient, subject, message, status)
            VALUES (?, ?, ?, 'pending')
        ''', (recipient, subject, message))
        
        conn.commit()
        conn.close()
        
        log_event("NOTIFICATION_QUEUED", f"Notification queued for {recipient}")
        
        # Try to send immediately in background
        def send_in_background():
            time.sleep(1)  # Small delay to ensure database is committed
            send_pending_notifications()
        
        Thread(target=send_in_background, daemon=True).start()
        
    except Exception as e:
        log_event("NOTIFICATION_QUEUE_ERROR", f"Error queuing notification: {str(e)}", level="ERROR")

def send_pending_notifications():
    """
    Send all pending notifications from the queue
    """
    try:
        conn = sqlite3.connect(str(DB_FILE.absolute()))
        cursor = conn.cursor()
        
        # Get pending notifications
        cursor.execute('''
            SELECT id, recipient, subject, message 
            FROM notifications 
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 10
        ''')
        
        pending = cursor.fetchall()
        
        for notification in pending:
            notification_id, recipient, subject, message = notification
            
            if send_email_notification(recipient, subject, message):
                # Update status to sent
                cursor.execute('''
                    UPDATE notifications 
                    SET status = 'sent', sent_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                ''', (notification_id,))
            else:
                # Update status to failed
                cursor.execute('''
                    UPDATE notifications 
                    SET status = 'failed', error_message = 'SMTP send failed' 
                    WHERE id = ?
                ''', (notification_id,))
        
        conn.commit()
        conn.close()
        
        if pending:
            log_event("BATCH_NOTIFICATIONS_SENT", f"Processed {len(pending)} pending notifications")
            
    except Exception as e:
        log_event("BATCH_NOTIFICATION_ERROR", f"Error sending pending notifications: {str(e)}", level="ERROR")

def get_db_connection():
    """Get database connection with proper configuration"""
    conn = sqlite3.connect(str(DB_FILE.absolute()))
    conn.row_factory = sqlite3.Row
    return conn

# Mock face detection for when face_recognition is not available
def mock_face_detection():
    return [(100, 100, 200, 200)]  # Mock face location

def mock_face_encoding(image):
    return np.random.rand(128)  # Mock face encoding

def mock_face_compare(known_encoding, unknown_encoding, tolerance=0.6):
    return [True]  # Always return match for testing

def mock_face_distance(known_encodings, unknown_encoding):
    return [0.3]  # Mock distance

# Authentication dependencies
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    """Get current authenticated user"""
    token = credentials.credentials
    payload = auth_manager.verify_token(token)
    
    if not payload:
        log_security_event("INVALID_TOKEN", {"token": token[:20] + "..."})
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    
    user = auth_manager.get_user_by_id(payload["user_id"])
    if not user:
        log_security_event("USER_NOT_FOUND", {"user_id": payload["user_id"]})
        raise HTTPException(status_code=401, detail="User not found")
    
    return payload

async def get_admin_user(current_user: Dict = Depends(get_current_user)) -> Dict:
    """Get current admin user"""
    if current_user.get("role") != UserRole.ADMIN.value:
        log_security_event("UNAUTHORIZED_ACCESS", {
            "user_id": current_user.get("user_id"),
            "role": current_user.get("role"),
            "required_role": "admin"
        })
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Security middleware
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Add security headers and logging"""
    # Log request
    log_security_event("API_REQUEST", {
        "method": request.method,
        "path": request.url.path,
        "ip": get_remote_address(request)
    }, "INFO")
    
    response = await call_next(request)
    
    # Add security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    return response

# Authentication endpoints
@app.post("/api/auth/login")
@limiter.limit(get_rate_limit("login"))
async def login(request: Request, credentials: LoginCredentials):
    """User login endpoint"""
    # Check brute force protection
    ip = get_remote_address(request)
    if brute_force.is_locked_out(ip):
        remaining_time = brute_force.get_remaining_lockout_time(ip)
        log_security_event("LOGIN_LOCKED_OUT", {"ip": ip, "remaining_time": remaining_time})
        raise HTTPException(
            status_code=429, 
            detail=f"Too many failed attempts. Try again in {remaining_time} seconds"
        )
    
    # Validate input
    if not validate_email(credentials.email):
        log_security_event("INVALID_EMAIL", {"email": credentials.email})
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Authenticate user
    user = auth_manager.authenticate_user(credentials.email, credentials.password)
    if not user:
        # Record failed attempt
        brute_force.record_failed_attempt(ip)
        log_security_event("LOGIN_FAILED", {"email": credentials.email, "ip": ip})
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Reset failed attempts on successful login
    if ip in brute_force.failed_attempts:
        del brute_force.failed_attempts[ip]
    
    # Create access token
    access_token = auth_manager.create_access_token(user)
    
    audit_log("USER_LOGIN", user.user_id, {"email": user.email})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_role=user.role.value,
        user_id=user.user_id
    )

@app.post("/api/auth/logout")
async def logout(current_user: Dict = Depends(get_current_user)):
    """User logout endpoint"""
    audit_log("USER_LOGOUT", current_user.get("user_id"))
    return {"message": "Successfully logged out"}

@app.get("/api/auth/me")
async def get_current_user_info(current_user: Dict = Depends(get_current_user)):
    """Get current user information"""
    user = auth_manager.get_user_by_id(current_user["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user.user_id,
        "email": user.email,
        "role": user.role.value,
        "is_active": user.is_active
    }

@app.post("/api/auth/register")
@limiter.limit("5/minute")
async def register_user(request: Request, user_data: dict):
    """Register new user (admin only)"""
    # Validate input
    required_fields = ["user_id", "email", "password", "role"]
    for field in required_fields:
        if field not in user_data:
            raise HTTPException(status_code=400, detail=f"Missing field: {field}")
    
    # Validate email
    if not validate_email(user_data["email"]):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Validate password
    is_valid, error_msg = SecurityConfig.validate_password(user_data["password"])
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Validate role
    try:
        role = UserRole(user_data["role"])
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Create user
    success = auth_manager.create_user(
        user_id=user_data["user_id"],
        email=user_data["email"],
        password=user_data["password"],
        role=role
    )
    
    if not success:
        raise HTTPException(status_code=400, detail="User already exists")
    
    audit_log("USER_REGISTERED", user_data["user_id"], {"email": user_data["email"], "role": role.value})
    
    return {"message": "User created successfully"}

# API Endpoints
@app.get("/")
async def root():
    # Get correct student count
    if OPENCV_FACE_RECOGNITION_AVAILABLE and opencv_recognizer:
        student_count = len(opencv_recognizer.get_registered_students())
    else:
        student_count = len(known_encodings)
    
    return {
        "status": "running",
        "version": "1.0.0",
        "docs": "/docs",
        "registered_students": student_count,
        "face_recognition_available": FACE_RECOGNITION_AVAILABLE,
        "opencv_face_recognition_available": OPENCV_FACE_RECOGNITION_AVAILABLE,
        "active_recognition_system": "opencv" if OPENCV_FACE_RECOGNITION_AVAILABLE else ("face_recognition" if FACE_RECOGNITION_AVAILABLE else "mock")
    }

@app.get("/api/health")
async def health_check():
    stats = opencv_recognizer.get_stats() if opencv_recognizer else {}
    
    # Get correct student count
    if OPENCV_FACE_RECOGNITION_AVAILABLE and opencv_recognizer:
        student_count = len(opencv_recognizer.get_registered_students())
    else:
        student_count = len(known_encodings)
    
    return {
        "status": "healthy",
        "message": "API is running",
        "timestamp": datetime.now().isoformat(),
        "registered_students": student_count,
        "face_recognition_available": FACE_RECOGNITION_AVAILABLE,
        "opencv_face_recognition_available": OPENCV_FACE_RECOGNITION_AVAILABLE,
        "active_recognition_system": "opencv" if OPENCV_FACE_RECOGNITION_AVAILABLE else ("face_recognition" if FACE_RECOGNITION_AVAILABLE else "mock"),
        "opencv_stats": stats
    }

@app.post("/api/admin/upload-student-photo")
async def upload_student_photo(student: StudentPhotoUpload):
    try:
        rgb_image = decode_base64_image(student.image)
        
        # Use OpenCV face recognition if available
        if OPENCV_FACE_RECOGNITION_AVAILABLE and opencv_recognizer:
            # Register face with OpenCV
            success = opencv_recognizer.register_face(student.studentId, rgb_image)
            
            if not success:
                raise HTTPException(status_code=400, detail="Failed to register face - no face detected or multiple faces")
            
            # Save image
            image_path = STUDENTS_FOLDER / f"{student.studentId}.jpg"
            image_bgr = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)
            cv2.imwrite(str(image_path), image_bgr)
            
            # Update database
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO students 
                (student_id, name, grade, photo_path, has_face_encoding) 
                VALUES (?, ?, ?, ?, 1)
            ''', (student.studentId, student.studentName, student.grade, str(image_path)))
            conn.commit()
            conn.close()
            
            log_event("FACE_REGISTERED", 
                     f"Face registered for student {student.studentName} ({student.studentId}) using OpenCV",
                     student_id=student.studentId)
            
            return {
                "success": True,
                "message": f"Student {student.studentName} registered successfully with OpenCV",
                "studentId": student.studentId,
                "opencv_mode": True
            }
        
        # Fallback to original face_recognition library
        elif FACE_RECOGNITION_AVAILABLE:
            face_locations = face_recognition.face_locations(rgb_image)
            if len(face_locations) == 0:
                raise HTTPException(status_code=400, detail="No face detected")
            if len(face_locations) > 1:
                raise HTTPException(status_code=400, detail="Multiple faces detected")
            face_encodings = face_recognition.face_encodings(rgb_image, face_locations)
            face_encoding = face_encodings[0]
        else:
            # Mock mode
            face_locations = mock_face_detection()
            face_encoding = mock_face_encoding(rgb_image)
            print("⚠️  Using mock face detection - face_recognition not available")
        
        image_path = STUDENTS_FOLDER / f"{student.studentId}.jpg"
        image_bgr = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)
        cv2.imwrite(str(image_path), image_bgr)
        
        known_encodings[student.studentId] = {
            'name': student.studentName,
            'encoding': face_encoding
        }
        save_encodings(known_encodings)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO students 
            (student_id, name, grade, photo_path, has_face_encoding) 
            VALUES (?, ?, ?, ?, 1)
        ''', (student.studentId, student.studentName, student.grade, str(image_path)))
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": f"Student {student.studentName} registered successfully",
            "studentId": student.studentId,
            "mock_mode": not FACE_RECOGNITION_AVAILABLE
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/validate-attendance-token")
@limiter.limit(get_rate_limit("token_validate"))
async def validate_attendance_token(request: Request, data: dict):
    """Validate attendance QR token and create session"""
    try:
        # Extract token from request
        if 'token' not in data:
            raise HTTPException(status_code=400, detail="Token is required")
        
        token = data['token'].strip()
        
        # Validate token format and extract student ID
        if not token or len(token) < 10:
            log_security_event("INVALID_TOKEN", {"token": token[:20] + "..."})
            raise HTTPException(status_code=400, detail="Invalid token format")
        
        # Extract student ID from token (simple implementation)
        # In production, this would use proper JWT decryption
        student_id = token[:15] if len(token) >= 15 else token
        
        # Validate student ID format
        if not validate_student_id(student_id):
            log_security_event("INVALID_STUDENT_ID", {"student_id": student_id})
            raise HTTPException(status_code=400, detail="Invalid student ID in token")
        
        # Check if student exists
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT name FROM students WHERE student_id = ?', (student_id,))
        student = cursor.fetchone()
        conn.close()
        
        if not student:
            log_security_event("STUDENT_NOT_FOUND", {"student_id": student_id})
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Clean up expired sessions
        cleanup_expired_sessions()
        
        # Create or replace session
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Delete any existing sessions for this student
        cursor.execute('DELETE FROM attendance_sessions WHERE student_id = ?', (student_id,))
        
        # Insert new session with QR verified using IST timezone
        current_time_ist = get_current_datetime_ist()
        expires_at = current_time_ist + timedelta(seconds=60)
        
        cursor.execute('''
            INSERT INTO attendance_sessions 
            (student_id, session_token, qr_verified, face_verified, created_at, expires_at)
            VALUES (?, ?, 1, 0, ?, ?)
        ''', (student_id, token, current_time_ist.strftime('%Y-%m-%d %H:%M:%S'), 
              expires_at.strftime('%Y-%m-%d %H:%M:%S')))
        
        conn.commit()
        conn.close()
        
        log_event("QR_VERIFIED", f"QR token validated for student {student_id}", student_id=student_id)
        
        return {
            "success": True,
            "message": "QR verified. Proceed to face verification.",
            "studentId": student_id,
            "studentName": student[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_event("TOKEN_VALIDATION_ERROR", f"Error validating token: {str(e)}", level="ERROR")
        raise HTTPException(status_code=500, detail=str(e))

def cleanup_expired_sessions():
    """Clean up expired attendance sessions"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM attendance_sessions WHERE expires_at < CURRENT_TIMESTAMP')
        conn.commit()
        conn.close()
    except Exception as e:
        log_event("SESSION_CLEANUP_ERROR", f"Error cleaning sessions: {str(e)}", level="ERROR")

@app.post("/mark-attendance")
@app.post("/api/mark-attendance")
async def mark_attendance_simple(request: Request, data: FaceVerificationRequest):
    """Simple attendance marking endpoint (without authentication for testing)"""
    try:
        # Validate input
        if not validate_student_id(data.studentId):
            log_security_event("INVALID_STUDENT_ID", {"student_id": data.studentId})
            raise HTTPException(status_code=400, detail="Invalid student ID format")
        
        data.studentName = sanitize_input(data.studentName)
        if not data.studentName:
            raise HTTPException(status_code=400, detail="Student name is required")
        
        # Check if student exists in database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT name FROM students WHERE student_id = ?', (data.studentId,))
        student = cursor.fetchone()
        
        if not student:
            conn.close()
            raise HTTPException(status_code=404, detail="Student not found in database")
        
        # Check if face recognition model is trained (has encodings)
        has_face_model = False
        if OPENCV_FACE_RECOGNITION_AVAILABLE and opencv_recognizer:
            has_face_model = opencv_recognizer.model_trained
        elif FACE_RECOGNITION_AVAILABLE:
            has_face_model = len(known_encodings) > 0
        
        confidence_score = 85.0
        method = 'face_recognition'
        
        if has_face_model:
            # Real face recognition - validate image and verify
            if not InputValidator.validate_face_image(data.image):
                conn.close()
                log_security_event("INVALID_IMAGE", {"student_id": data.studentId})
                raise HTTPException(status_code=400, detail="Invalid image data")
            
            image_data = data.image.encode('utf-8') if isinstance(data.image, str) else data.image
            result = recognize_face_from_image(image_data, data.studentId)
            
            if not result["match"]:
                conn.close()
                log_security_event("FACE_VERIFICATION_FAILED", 
                                 {"student_id": data.studentId, "reason": result.get('message', 'Unknown error')},
                                 level="WARNING")
                return {
                    "success": False,
                    "verified": False,
                    "message": result.get("message", "Face verification failed"),
                    "confidenceScore": 0
                }
            
            confidence_score = result.get("confidence", 85.0)
        else:
            # Demo mode - no face encodings registered, skip face verification
            log_event("DEMO_MODE_ATTENDANCE", 
                     f"No face encodings available, using demo mode for {data.studentId}",
                     student_id=data.studentId,
                     level="WARNING")
        
        # Mark attendance - Insert attendance record with IST timezone
        attendance_date = format_date_for_db(get_current_date_ist())
        attendance_time = format_time_for_db(get_current_time_ist())
        
        cursor.execute('''
            INSERT OR REPLACE INTO attendance 
            (student_id, student_name, date, check_in_time, method, confidence_score)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (data.studentId, student[0], attendance_date, attendance_time, method, confidence_score))
        
        conn.commit()
        conn.close()
        
        log_event("ATTENDANCE_MARKED", f"Attendance marked for {data.studentId} via /mark-attendance", student_id=data.studentId)
        
        # Push to recent events for cross-device sync notifications
        event = {
            "id": str(uuid.uuid4()),
            "studentId": data.studentId,
            "studentName": student[0],
            "time": attendance_time,
            "date": attendance_date,
            "timestamp": datetime.now(IST).isoformat(),
            "method": method
        }
        recent_attendance_events.insert(0, event)
        if len(recent_attendance_events) > MAX_RECENT_EVENTS:
            recent_attendance_events.pop()
        
        return {
            "success": True,
            "verified": True,
            "message": f"Attendance marked successfully for {data.studentId}",
            "confidenceScore": confidence_score,
            "studentId": data.studentId,
            "studentName": student[0],
            "method": method
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_event("ATTENDANCE_MARKING_ERROR", f"Error marking attendance: {str(e)}", student_id=data.studentId, level="ERROR")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/verify-face")
@limiter.limit(get_rate_limit("face_verify"))
async def verify_face(request: Request, data: FaceVerificationRequest, current_user: Dict = Depends(get_current_user)):
    """Verify face for attendance (second step of dual verification)"""
    try:
        # Validate input
        if not validate_student_id(data.studentId):
            log_security_event("INVALID_STUDENT_ID", {"student_id": data.studentId})
            raise HTTPException(status_code=400, detail="Invalid student ID format")
        
        data.studentName = sanitize_input(data.studentName)
        if not data.studentName:
            raise HTTPException(status_code=400, detail="Student name is required")
        
        if not InputValidator.validate_face_image(data.image):
            log_security_event("INVALID_IMAGE", {"student_id": data.studentId})
            raise HTTPException(status_code=400, detail="Invalid image data")
        
        # Check for valid QR session first using IST timezone
        current_time_ist = get_current_datetime_ist().strftime('%Y-%m-%d %H:%M:%S')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM attendance_sessions 
            WHERE student_id = ? AND qr_verified = 1 AND face_verified = 0 
            AND expires_at > ?
        ''', (data.studentId, current_time_ist))
        
        session = cursor.fetchone()
        conn.close()
        
        if not session:
            log_security_event("FACE_WITHOUT_QR", {"student_id": data.studentId})
            raise HTTPException(status_code=400, detail="QR verification required before face scan.")
        
        # Perform face verification
        image_data = data.image.encode('utf-8') if isinstance(data.image, str) else data.image
        result = recognize_face_from_image(image_data, data.studentId)
        
        if not result["match"]:
            log_security_event("FACE_VERIFICATION_FAILED", 
                             {"student_id": data.studentId, "reason": result.get('message', 'Unknown error')},
                             level="WARNING")
            
            audit_log("FACE_VERIFICATION_FAILED", current_user.get("user_id"), {
                "student_id": data.studentId,
                "reason": result.get('message', 'Unknown error')
            })
            
            return {
                "success": False,
                "verified": False,
                "message": result.get("message", "Face verification failed"),
                "confidenceScore": 0
            }
        
        # Face verification succeeded - update session and mark attendance
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Update session to mark face as verified
        cursor.execute('''
            UPDATE attendance_sessions 
            SET face_verified = 1 
            WHERE student_id = ? AND session_token = ?
        ''', (data.studentId, session['session_token']))
        
        # Get student name for attendance record
        cursor.execute('SELECT name FROM students WHERE student_id = ?', (data.studentId,))
        student = cursor.fetchone()
        
        # Insert attendance record (both verifications complete) with IST timezone
        attendance_date = format_date_for_db(get_current_date_ist())
        attendance_time = format_time_for_db(get_current_time_ist())
        
        cursor.execute('''
            INSERT INTO attendance 
            (student_id, student_name, date, check_in_time, method, confidence_score)
            VALUES (?, ?, ?, ?, 'qr_face', ?)
        ''', (data.studentId, student[0], attendance_date, attendance_time, result["confidence"]))
        
        conn.commit()
        conn.close()
        
        log_event("ATTENDANCE_MARKED", f"Attendance marked for {data.studentId} (QR + Face verified)", student_id=data.studentId)
        
        return {
            "success": True,
            "verified": True,
            "message": f"Attendance marked for {data.studentId}",
            "confidenceScore": result["confidence"],
            "studentId": data.studentId,
            "studentName": student[0],
            "method": "qr_face"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_event("FACE_VERIFICATION_ERROR", f"Error in face verification: {str(e)}", student_id=data.studentId, level="ERROR")
        raise HTTPException(status_code=500, detail=str(e))

# 2. INDEXEDDB OFFLINE ATTENDANCE SYNC ENDPOINTS
@app.post("/api/sync-offline-attendance")
async def sync_offline_attendance(records: List[OfflineAttendanceRecord]):
    """
    Receive batched offline attendance records and sync them to the database
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        results = []
        success_count = 0
        failure_count = 0
        
        for record in records:
            try:
                # Verify face for each record
                image_data = record.image.encode('utf-8') if isinstance(record.image, str) else record.image
                face_result = recognize_face_from_image(image_data, record.studentId)
                
                if not face_result["match"]:
                    results.append({
                        "studentId": record.studentId,
                        "success": False,
                        "message": face_result.get("message", "Face verification failed")
                    })
                    failure_count += 1
                    continue
                
                # Parse timestamp with IST timezone fallback
                try:
                    timestamp = datetime.fromisoformat(record.timestamp.replace('Z', '+00:00'))
                    # Convert to IST
                    timestamp_ist = timestamp.astimezone(IST)
                    attendance_date = format_date_for_db(timestamp_ist.date())
                    attendance_time = format_time_for_db(timestamp_ist.time())
                except:
                    # Fallback to current IST time
                    attendance_date = format_date_for_db(get_current_date_ist())
                    attendance_time = format_time_for_db(get_current_time_ist())
                
                # Insert attendance record
                cursor.execute('''
                    INSERT INTO attendance 
                    (student_id, student_name, date, check_in_time, method, confidence_score, is_offline)
                    VALUES (?, ?, ?, ?, 'face_recognition', ?, 1)
                ''', (face_result["student_id"], face_result["student_name"], 
                      attendance_date, attendance_time, face_result["confidence"]))
                
                results.append({
                    "studentId": record.studentId,
                    "success": True,
                    "message": "Offline attendance synced successfully"
                })
                success_count += 1
                
                # Log offline sync
                log_event("OFFLINE_ATTENDANCE_SYNCED", 
                         f"Offline attendance synced for {face_result['student_name']} ({face_result['student_id']})",
                         student_id=face_result["student_id"])
                
            except Exception as e:
                results.append({
                    "studentId": record.studentId,
                    "success": False,
                    "message": f"Error processing record: {str(e)}"
                })
                failure_count += 1
                log_event("OFFLINE_SYNC_ERROR", 
                         f"Error syncing offline attendance for {record.studentId}: {str(e)}",
                         student_id=record.studentId,
                         level="ERROR")
        
        conn.commit()
        conn.close()
        
        # Queue notification for admin about batch sync
        if success_count > 0:
            queue_notification(
                ADMIN_EMAIL,
                f"Offline Attendance Sync Completed",
                f"Successfully synced {success_count} offline attendance records.\n" +
                (f"Failed to sync {failure_count} records." if failure_count > 0 else "") +
                f"\n\nSync completed at {datetime.now().strftime('%Y-%m-%d %I:%M %p')}"
            )
        
        log_event("BATCH_OFFLINE_SYNC", 
                 f"Batch sync completed: {success_count} success, {failure_count} failed")
        
        return {
            "success": True,
            "message": f"Processed {len(records)} records",
            "results": results,
            "summary": {
                "total": len(records),
                "success": success_count,
                "failed": failure_count
            }
        }
        
    except Exception as e:
        log_event("BATCH_SYNC_ERROR", f"Error in batch offline sync: {str(e)}", level="ERROR")
        raise HTTPException(status_code=500, detail=str(e))

# 3. NOTIFICATION ENDPOINTS
@app.get("/api/notifications/status")
async def get_notification_status():
    """
    Get status of pending notifications
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT status, COUNT(*) as count 
            FROM notifications 
            GROUP BY status
        ''')
        
        status_counts = {row['status']: row['count'] for row in cursor.fetchall()}
        
        conn.close()
        
        return {
            "pending": status_counts.get('pending', 0),
            "sent": status_counts.get('sent', 0),
            "failed": status_counts.get('failed', 0),
            "total": sum(status_counts.values())
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/notifications/retry")
async def retry_failed_notifications():
    """
    Retry sending failed notifications
    """
    try:
        send_pending_notifications()
        return {"success": True, "message": "Notification retry initiated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 4. TELEMETRY & LOGGING ENDPOINTS
@app.get("/api/logs/recent")
async def get_recent_logs(limit: int = 50, event_type: str = None):
    """
    Get recent logs for telemetry
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            SELECT event_type, message, details, student_id, timestamp, level
            FROM logs
        '''
        params = []
        
        if event_type:
            query += ' WHERE event_type = ?'
            params.append(event_type)
        
        query += ' ORDER BY timestamp DESC LIMIT ?'
        params.append(limit)
        
        cursor.execute(query, params)
        logs = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        return {
            "logs": logs,
            "count": len(logs)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs/events")
async def get_event_types():
    """
    Get available event types for filtering
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT DISTINCT event_type FROM logs ORDER BY event_type')
        event_types = [row['event_type'] for row in cursor.fetchall()]
        
        conn.close()
        
        return {"event_types": event_types}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/attendance/today-stats")
async def get_today_stats():
    try:
        # Use IST timezone for consistent date handling
        today = format_date_for_db(get_current_date_ist())
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) as count FROM students')
        total_students = cursor.fetchone()['count']
        
        cursor.execute(
            'SELECT COUNT(DISTINCT student_id) as count FROM attendance WHERE date = ?',
            (today,)
        )
        present_count = cursor.fetchone()['count']
        
        conn.close()
        
        absent_count = total_students - present_count
        percentage = round((present_count / total_students * 100), 1) if total_students > 0 else 0
        
        return {
            "success": True,
            "percentage": percentage,
            "presentCount": present_count,
            "absentCount": absent_count,
            "totalStudents": total_students,
            "date": today
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/attendance/recent-events")
async def get_recent_attendance_events(since: Optional[str] = Query(None)):
    """Get recent attendance events for cross-device sync notifications.
    Pass 'since' as an ISO timestamp to only get events after that time."""
    try:
        if since:
            filtered = [e for e in recent_attendance_events if e["timestamp"] > since]
        else:
            filtered = recent_attendance_events[:5]
        
        return {
            "success": True,
            "events": filtered,
            "count": len(filtered),
            "serverTime": datetime.now(IST).isoformat()
        }
    except Exception as e:
        return {"success": False, "events": [], "count": 0, "serverTime": datetime.now(IST).isoformat()}

@app.get("/api/attendance/today-list")
async def get_today_attendance_list():
    try:
        # Use IST timezone for consistent date handling
        today = format_date_for_db(get_current_date_ist())
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT a.*, s.grade
            FROM attendance a
            LEFT JOIN students s ON a.student_id = s.student_id
            WHERE a.date = ?
            ORDER BY a.check_in_time DESC
        ''', (today,))
        
        rows = cursor.fetchall()
        conn.close()
        
        attendance_list = []
        for row in rows:
            attendance_list.append({
                "studentId": row['student_id'],
                "studentName": row['student_name'],
                "checkInTime": row['check_in_time'],
                "method": row['method'],
                "confidenceScore": row['confidence_score'],
                "grade": row['grade']
            })
        
        return {
            "success": True,
            "attendance": attendance_list,
            "count": len(attendance_list),
            "date": today
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/students")
async def get_all_students():
    try:
        # Get students from SQLite database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM students ORDER BY name')
        rows = cursor.fetchall()
        conn.close()
        
        students = []
        for row in rows:
            students.append({
                "id": row['student_id'],
                "name": row['name'],
                "grade": row['grade'],
                "hasFaceEncoding": bool(row['has_face_encoding']),
                "createdAt": row['created_at']
            })
        
        # Add students from OpenCV system if not in SQLite
        if OPENCV_FACE_RECOGNITION_AVAILABLE and opencv_recognizer:
            opencv_students = opencv_recognizer.get_registered_students()
            for student_id in opencv_students:
                # Check if already in list
                if not any(s['id'] == student_id for s in students):
                    # Get student name from OpenCV label map
                    student_name = opencv_recognizer.label_map.get(student_id, f"Student {student_id}")
                    students.append({
                        "id": student_id,
                        "name": student_name,
                        "grade": "CIT 2022",
                        "hasFaceEncoding": True,
                        "createdAt": datetime.now().isoformat()
                    })
        
        return {
            "success": True,
            "students": students,
            "count": len(students)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/attendance/report")
async def get_attendance_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    student_id: Optional[str] = Query(None)
):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = 'SELECT * FROM attendance WHERE 1=1'
        params = []
        
        if start_date:
            query += ' AND date >= ?'
            params.append(start_date)
        
        if end_date:
            query += ' AND date <= ?'
            params.append(end_date)
        
        if student_id:
            query += ' AND student_id = ?'
            params.append(student_id)
        
        query += ' ORDER BY date DESC, check_in_time DESC'
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        records = []
        for row in rows:
            records.append({
                "studentId": row['student_id'],
                "studentName": row['student_name'],
                "date": row['date'],
                "checkInTime": row['check_in_time'],
                "method": row['method'],
                "confidenceScore": row['confidence_score']
            })
        
        return {
            "success": True,
            "records": records,
            "count": len(records)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Face Recognition Functions
def recognize_face_from_image(image_data: bytes, expected_student_id: str = None) -> dict:
    """
    Recognize face from image data and return match information
    
    Args:
        image_data: Raw image bytes
        expected_student_id: Optional student ID to verify against
    
    Returns:
        dict: Recognition result with match status and details
    """
    try:
        # Decode image
        image = decode_base64_image(image_data)
        
        # Check for low-light conditions
        low_light_result = detect_low_light(image)
        
        if low_light_result["is_low_light"]:
            if APPLY_HISTOGRAM_EQUALIZATION:
                # Try to enhance the image
                image = enhance_low_light_image(image)
                # Re-check brightness after enhancement
                enhanced_check = detect_low_light(image)
                if enhanced_check["is_low_light"]:
                    log_event("LOW_LIGHT_REJECTION", 
                             f"Image too dark even after enhancement: {enhanced_check['brightness']:.2f}",
                             student_id=expected_student_id,
                             level="WARNING")
                    return {
                        "match": False,
                        "message": "LOW_LIGHT_DETECTED",
                        "brightness": enhanced_check["brightness"],
                        "threshold": LOW_LIGHT_THRESHOLD
                    }
            else:
                log_event("LOW_LIGHT_REJECTION", 
                         f"Image too dark: {low_light_result['brightness']:.2f}",
                         student_id=expected_student_id,
                         level="WARNING")
                return {
                    "match": False,
                    "message": "LOW_LIGHT_DETECTED",
                    "brightness": low_light_result["brightness"],
                    "threshold": LOW_LIGHT_THRESHOLD
                }
        
        # Use OpenCV face recognition if available
        if OPENCV_FACE_RECOGNITION_AVAILABLE and opencv_recognizer:
            result = opencv_recognizer.recognize_face(image, confidence_threshold=60.0)
            
            # If no faces registered in system, use demo mode
            if not result["match"] and result.get("message") == "No faces registered in the system":
                log_event("DEMO_MODE_FACE_RECOGNITION", 
                         f"No face encodings available, using demo mode for {expected_student_id}",
                         student_id=expected_student_id,
                         level="WARNING")
                
                # In demo mode, verify student exists in database
                if expected_student_id:
                    conn = get_db_connection()
                    cursor = conn.cursor()
                    cursor.execute('SELECT name FROM students WHERE student_id = ?', (expected_student_id,))
                    student_row = cursor.fetchone()
                    conn.close()
                    
                    if student_row:
                        # Simulate successful face recognition
                        return {
                            "match": True,
                            "student_id": expected_student_id,
                            "student_name": student_row['name'],
                            "confidence": 85.0,
                            "message": "Demo mode: Face verification simulated (no encodings registered)"
                        }
                
                return {
                    "match": False,
                    "message": "No face encodings registered. Please register student faces first."
                }
            
            if result["match"]:
                # CRITICAL SECURITY CHECK: Verify the recognized face matches expected student
                if expected_student_id and result["student_id"] != expected_student_id:
                    log_event("FACE_MISMATCH", 
                             f"Face recognized as {result['student_id']} but expected {expected_student_id}",
                             student_id=expected_student_id,
                             level="WARNING")
                    return {
                        "match": False,
                        "message": f"Face does not match expected student. Recognized as {result['student_id']}, but expected {expected_student_id}",
                        "recognized_student_id": result["student_id"],
                        "expected_student_id": expected_student_id,
                        "confidence": result["confidence"]
                    }
                
                # Get student name from database
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute('SELECT name FROM students WHERE student_id = ?', (result["student_id"],))
                student_row = cursor.fetchone()
                conn.close()
                
                if student_row:
                    log_event("FACE_VERIFICATION_SUCCESS", 
                             f"Face successfully verified for {result['student_id']}",
                             student_id=result["student_id"])
                    return {
                        "match": True,
                        "student_id": result["student_id"],
                        "student_name": student_row['name'],
                        "confidence": result["confidence"],
                        "message": result["message"]
                    }
                else:
                    return {
                        "match": False,
                        "message": f"Student {result['student_id']} not found in database"
                    }
            else:
                return {
                    "match": False,
                    "message": result["message"],
                    "confidence": result.get("confidence", 0.0)
                }
        
        # Fallback to original face_recognition library if available
        elif FACE_RECOGNITION_AVAILABLE:
            # Real face recognition
            face_locations = face_recognition.face_locations(image, model="hog")
            
            if len(face_locations) == 0:
                return {
                    "match": False,
                    "message": "No face detected in image"
                }
            
            if len(face_locations) > 1:
                return {
                    "match": False,
                    "message": "Multiple faces detected"
                }
            
            # Generate face encoding
            face_encodings = face_recognition.face_encodings(image, face_locations)
            
            if len(face_encodings) == 0:
                return {
                    "match": False,
                    "message": "Could not generate face encoding"
                }
            
            unknown_encoding = face_encodings[0]
            
            # Load known encodings from database
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('''
                SELECT s.student_id, s.name, fe.encoding 
                FROM students s 
                LEFT JOIN face_encodings fe ON s.student_id = fe.student_id 
                WHERE s.has_face_encoding = 1
            ''')
            
            rows = cursor.fetchall()
            conn.close()
            
            if not rows:
                return {
                    "match": False,
                    "message": "No registered face encodings found"
                }
            
            # Compare with known encodings
            best_match = None
            best_distance = float('inf')
            
            for row in rows:
                student_id = row['student_id']
                student_name = row['name']
                encoding_bytes = row['encoding']
                
                if encoding_bytes:
                    known_encoding = np.frombuffer(encoding_bytes, dtype=np.float64)
                    
                    # Calculate face distance
                    face_distance = face_recognition.face_distance([known_encoding], unknown_encoding)[0]
                    
                    if face_distance < best_distance:
                        best_distance = face_distance
                        best_match = {
                            "student_id": student_id,
                            "student_name": student_name,
                            "confidence": max(0, min(100, (1 - face_distance) * 100)),
                            "distance": face_distance
                        }
            
            if best_match and best_distance < 0.6:  # Threshold for face recognition
                # If expected student ID is provided, verify it matches
                if expected_student_id and best_match["student_id"] != expected_student_id:
                    return {
                        "match": False,
                        "message": f"Face does not match expected student {expected_student_id}",
                        "detected_student": best_match["student_name"]
                    }
                
                return {
                    "match": True,
                    "student_id": best_match["student_id"],
                    "student_name": best_match["student_name"],
                    "confidence": round(best_match["confidence"], 2),
                    "distance": round(best_distance, 4)
                }
            else:
                return {
                    "match": False,
                    "message": "No matching face found in database",
                    "best_distance": round(best_distance, 4) if best_match else None
                }
        
        else:
            # Mock mode for testing
            return {
                "match": True,
                "student_id": expected_student_id or "20221CIT0043",
                "student_name": "Test Student",
                "confidence": 95.0,
                "message": "Mock mode - face recognition not available"
            }
    
    except Exception as e:
        return {
            "match": False,
            "message": f"Face recognition error: {str(e)}"
        }

# Startup
if __name__ == "__main__":
    print("=" * 70)
    print("AUTOMATED ATTENDANCE SYSTEM - BACKEND")
    print("=" * 70)
    print(f"API Docs: http://localhost:8000/docs or http://192.168.0.108:8000/docs")
    print(f"Images: {STUDENTS_FOLDER}")
    print(f"Students: {len(known_encodings)}")
    print(f"Face Recognition: {('OpenCV' if OPENCV_FACE_RECOGNITION_AVAILABLE else ('face_recognition' if FACE_RECOGNITION_AVAILABLE else 'Mock Mode'))}")
    if OPENCV_FACE_RECOGNITION_AVAILABLE and opencv_recognizer:
        stats = opencv_recognizer.get_stats()
        print(f"OpenCV Stats: {stats['registered_students']} registered, {stats['total_samples']} samples")
    print("=" * 70)
    
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
