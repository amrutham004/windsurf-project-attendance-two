# Quick Startup Guide - Attendance System

## Prerequisites
- Python 3.11+ installed
- Node.js installed
- Backend dependencies installed

## Step 1: Start Backend Server

Open a terminal in the `backend` folder:

```bash
cd backend
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
✅ OpenCV face recognition loaded
✅ Database tables initialized
INFO:     Application startup complete.
```

**Test Backend:**
Open browser: `http://localhost:8000/api/health`

Should show:
```json
{
  "status": "healthy",
  "registered_students": 3,
  "face_recognition_available": false,
  "opencv_face_recognition_available": true
}
```

## Step 2: Start Frontend Server

Open a NEW terminal in the project root:

```bash
npm run dev
```

**Expected Output:**
```
VITE v5.4.19  ready in 1442 ms
➜  Local:   https://localhost:8080/
➜  Network: https://172.20.10.4:8080/
```

## Step 3: Access the Application

**Admin Dashboard:**
- URL: `https://172.20.10.4:8080/admin`
- Should show today's stats from database

**Student Dashboard:**
- URL: `https://172.20.10.4:8080/student`
- Enter student ID: `20221CIT0043`, `20221CIT0049`, or `20221CIT0151`

## Step 4: Test Attendance Flow

### On Mobile Device:

1. **Generate QR Code** (on laptop):
   - Go to Admin Dashboard
   - QR code displays student ID

2. **Scan QR Code** (on mobile):
   - Open `https://172.20.10.4:8080` on mobile
   - Scan the QR code
   - System validates token

3. **Face Verification** (on mobile):
   - Camera opens for face capture
   - System sends image to backend
   - Backend verifies face and marks attendance

4. **Verify on Laptop**:
   - Refresh Admin Dashboard
   - Should see new attendance record
   - Data synced from database

## Troubleshooting

### Backend Not Starting

**Error:** `ModuleNotFoundError: No module named 'X'`

**Solution:**
```bash
cd backend
pip install -r requirements.txt
pip install slowapi PyJWT bcrypt bleach passlib python-jose cryptography
pip uninstall opencv-python -y
pip install opencv-contrib-python==4.8.1.78
```

### Frontend Can't Connect to Backend

**Error in Console:** `Failed to fetch`

**Check:**
1. Backend is running: `http://localhost:8000/api/health`
2. `.env` file exists with: `VITE_API_URL=http://localhost:8000`
3. CORS allows your IP in `backend/app.py`

**Fix CORS:**
Edit `backend/app.py`, add your IP to `allow_origins`:
```python
allow_origins=[
    "https://YOUR_IP:8080",
]
```

### No Attendance Showing

**Check:**
1. Backend server is running
2. Open browser console (F12)
3. Look for API errors
4. Check backend logs for errors

**Verify Database:**
```bash
cd backend
python check_db.py
```

### Camera Not Working

**Issue:** HTTPS required for camera access

**Solution:** Already configured with SSL certificates
- `localhost+4.pem`
- `localhost+4-key.pem`

If still not working, regenerate certificates:
```bash
mkcert localhost 127.0.0.1 172.20.10.4 ::1
```

## System Architecture

```
Mobile (QR Scan)
    ↓
POST /api/validate-attendance-token
    ↓
Face Verification
    ↓
POST /api/verify-face
    ↓
SQLite Database
    ↓
GET /api/attendance/*
    ↓
All Devices (Dashboards)
```

## Important URLs

- **Backend API:** `http://localhost:8000`
- **API Docs:** `http://localhost:8000/docs`
- **Frontend:** `https://172.20.10.4:8080`
- **Admin Dashboard:** `https://172.20.10.4:8080/admin`
- **Student Dashboard:** `https://172.20.10.4:8080/student`

## Database Location

`backend/data/attendance.db`

## Logs

Backend logs appear in terminal where `uvicorn` is running.
Frontend logs appear in browser console (F12).

---

**Status:** ✅ Backend Running | ✅ Frontend Running | ✅ Database Synced
