# Testing Guide - Backend Database Synchronization

## ✅ System Status

**Backend Server:** Running on `http://localhost:8000`
**Frontend Server:** Running on `https://172.20.10.4:8080`
**Database:** SQLite at `backend/data/attendance.db`

---

## 📋 Step-by-Step Testing Instructions

### **Step 1: Verify Backend is Running**

Open terminal and check backend logs. You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
✅ OpenCV face recognition loaded
✅ Database tables initialized
INFO:     Application startup complete.
```

**Test API Health:**
Open browser: `http://localhost:8000/api/health`

Expected response:
```json
{
  "status": "healthy",
  "registered_students": 3,
  "face_recognition_available": false,
  "opencv_face_recognition_available": true
}
```

---

### **Step 2: Access Admin Dashboard (Laptop)**

1. Open browser: `https://172.20.10.4:8080/admin`
2. Open browser console (F12)
3. Check console logs:
   ```
   Fetching today stats from: http://localhost:8000/api/attendance/today-stats
   Today stats received: {totalStudents: 3, presentCount: 0, ...}
   ```

**Expected Dashboard:**
- Total Students: 3
- Present Today: 0
- Late Today: 0
- Absent Today: 3

---

### **Step 3: Mark Attendance from Mobile**

#### **Option A: Using QR Code + Face Recognition**

**On Laptop (Admin Dashboard):**
1. Generate QR code for student
2. QR code displays student ID

**On Mobile:**
1. Open `https://172.20.10.4:8080` on mobile browser
2. Scan QR code
3. System validates token
4. Camera opens for face capture
5. Capture face image
6. System sends to backend

**Backend Terminal Should Show:**
```
INFO:     POST /api/validate-attendance-token
INFO:     QR_VERIFIED for student 20221CIT0043
INFO:     POST /api/verify-face
INFO:     ATTENDANCE_MARKED for 20221CIT0043 (QR + Face verified)
```

#### **Option B: Direct Face Recognition (Without QR)**

**On Mobile:**
1. Open `https://172.20.10.4:8080/mark-attendance`
2. Enter student ID
3. Capture face image
4. System sends to backend

**Backend Terminal Should Show:**
```
INFO:     POST /api/verify-face
INFO:     FACE_VERIFICATION_SUCCESS for student 20221CIT0043
INFO:     ATTENDANCE_MARKED for 20221CIT0043
```

---

### **Step 4: Verify Attendance Synced**

**On Laptop (Admin Dashboard):**
1. Wait 10 seconds (auto-refresh)
   OR
2. Refresh page manually

**Expected Changes:**
- Present Today: 1 (increased from 0)
- Absent Today: 2 (decreased from 3)
- Today's Attendance table shows new record

**Console Logs:**
```
Fetching today stats from: http://localhost:8000/api/attendance/today-stats
Today stats received: {totalStudents: 3, presentCount: 1, ...}
```

---

### **Step 5: Verify in Student Dashboard**

**On Any Device:**
1. Open `https://172.20.10.4:8080/student`
2. Enter student ID: `20221CIT0043`
3. Click "View Dashboard"

**Expected:**
- Attendance percentage updated
- Recent records show today's attendance
- Data fetched from backend database

**Console Logs:**
```
Fetching student attendance from: http://localhost:8000/api/attendance/report?student_id=20221CIT0043
```

---

### **Step 6: Test CSV Export**

**On Admin Dashboard:**
1. Select "Daily" filter
2. Click "Download CSV"

**Expected:**
- CSV file downloads
- Contains today's attendance record
- Shows: Student ID, Name, Date, Time, Status

**Console Logs:**
```
Fetching attendance records from: http://localhost:8000/api/attendance/report?start_date=2026-03-06&end_date=2026-03-06
CSV export successful: attendance_daily_2026-03-06.csv, 1 records
```

---

## 🔍 Verification Checklist

### Backend Logs to Watch For:

✅ **QR Validation:**
```
INFO:     POST /api/validate-attendance-token
QR_VERIFIED for student 20221CIT0043
```

✅ **Face Verification:**
```
INFO:     POST /api/verify-face
FACE_VERIFICATION_SUCCESS for student 20221CIT0043
```

✅ **Attendance Marked:**
```
ATTENDANCE_MARKED for 20221CIT0043 (QR + Face verified)
```

✅ **Dashboard Data Fetch:**
```
INFO:     GET /api/attendance/today-stats
INFO:     GET /api/attendance/today-list
```

---

## 📊 Database Verification

**Check Database Directly:**
```bash
cd backend
python check_db.py
```

**Expected Output:**
```
=== Attendance Records ===
Student ID: 20221CIT0043
Name: Amrutha M
Date: 2026-03-06
Time: 10:30:15
Method: qr_face
Confidence: 0.85
```

**Or use SQLite directly:**
```bash
cd backend/data
sqlite3 attendance.db
SELECT * FROM attendance WHERE date = '2026-03-06';
```

---

## 🎯 Expected Flow

```
Mobile Device
    ↓
Scan QR Code
    ↓
POST /api/validate-attendance-token → Backend
    ↓
Session Created (qr_verified=1)
    ↓
Face Capture
    ↓
POST /api/verify-face → Backend
    ↓
Face Verified + Attendance Saved to Database
    ↓
GET /api/attendance/* ← All Devices
    ↓
Dashboards Update (Real-time)
```

---

## 🐛 Troubleshooting

### Issue: "Failed to fetch" in console

**Check:**
1. Backend server is running
2. `.env` file has `VITE_API_URL=http://localhost:8000`
3. No CORS errors in console

**Fix:**
```bash
# Restart backend
cd backend
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### Issue: Attendance not appearing

**Check Backend Logs:**
- Look for errors in terminal
- Check if POST requests are reaching backend
- Verify database write operations

**Check Frontend Console:**
- Look for API errors
- Check network tab for failed requests
- Verify data is being fetched

### Issue: Face verification fails

**Check:**
1. Student face is registered in system
2. Lighting conditions are good
3. Face is clearly visible in camera

**Register Face:**
```bash
cd backend
python register_student_face.py
```

---

## 📱 Mobile Testing Tips

1. **Use HTTPS:** Camera requires secure connection
2. **Good Lighting:** Face recognition works better in good light
3. **Clear Face:** Ensure face is clearly visible
4. **Network:** Both devices on same network

---

## 🔄 Real-time Sync Features

**Auto-refresh:** Admin Dashboard refreshes every 10 seconds
**Cross-device:** Attendance marked on mobile appears on laptop
**Persistent:** Data survives page reloads
**Database:** All data stored in SQLite database

---

## ✅ Success Indicators

1. ✅ Backend logs show POST requests
2. ✅ Console shows successful API calls
3. ✅ Dashboard stats update
4. ✅ Today's attendance table shows record
5. ✅ CSV export contains data
6. ✅ Student dashboard shows attendance
7. ✅ Database contains record

---

**Current Status:** ✅ System Ready for Testing

**Next Steps:**
1. Mark attendance from mobile
2. Watch backend terminal for logs
3. Verify dashboard updates
4. Test cross-device synchronization
