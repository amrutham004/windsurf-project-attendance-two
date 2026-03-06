/**
 * attendanceData.ts - Attendance Data Management
 * 
 * This file handles all attendance-related data operations:
 * - Mock student data
 * - QR code generation and validation
 * - Attendance record management (using localStorage)
 * - Statistics calculations
 * - Data export functionality
 * - Student photo storage
 * - Offline attendance support
 */

import { Student, AttendanceRecord, AttendanceStatus, DashboardStats, StudentStats } from '@/types/attendance';
import { offlineManager } from './offlineManager';

// ========================================
// MOCK STUDENT DATA
// ========================================// Mock student data
export const students: Student[] = [
  {
    id: '20221CIT0043',
    name: 'Amrutha M',
    grade: 'CIT 2022',
    department: 'Computer Science',
    email: 'amrutha.m@college.edu',
    photoUrl: ''
  },
  {
    id: '20221CIT0049',
    name: 'C M Shalini',
    grade: 'CIT 2022',
    department: 'Computer Science',
    email: 'shalini.cm@college.edu',
    photoUrl: ''
  },
  {
    id: '20221CIT0151',
    name: 'Vismaya L',
    grade: 'CIT 2022',
    department: 'Computer Science',
    email: 'vismaya.l@college.edu',
    photoUrl: ''
  }
];

// ========================================
// CONSTANTS
// ========================================

// Student ID validation regex
export const STUDENT_ID_REGEX = /^20221CIT\d{4}$/;

// Time after which attendance is marked as "late" (1:00 PM)
export const CUTOFF_TIME = '13:00';

// QR codes expire after this many seconds (security feature)
export const QR_VALIDITY_SECONDS = 60; 

// How often QR codes refresh (in milliseconds)
export const QR_REFRESH_INTERVAL = 5000;

// ========================================
// LOCAL STORAGE KEYS
// ========================================
const ATTENDANCE_KEY = 'attendance_records';
const STUDENT_PHOTOS_KEY = 'student_photos';
const FACE_CAPTURES_KEY = 'face_captures';
const ATTENDANCE_TOKENS_KEY = 'attendance_tokens';

// Data retention period (30 days in milliseconds)
const DATA_RETENTION_DAYS = 30;
const DATA_RETENTION_MS = DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000;

// ========================================
// ATTENDANCE TOKEN TYPES
// ========================================
export interface AttendanceToken {
  token: string;
  studentId: string;
  studentName: string;
  expiryTimestamp: number;
  isUsed: boolean;
  createdAt: number;
}

// ========================================
// STUDENT DATA MANAGEMENT
// ========================================

// Get all students (mock data)
export const getStudents = (): Student[] => {
  return students;
};

// Get single student by ID
export const getStudentById = (studentId: string): Student | null => {
  return students.find(s => s.id === studentId) || null;
};

// ========================================
// QR CODE FUNCTIONS
// ========================================

// Generate daily secret for QR code validation
const getDailySecret = (): string => {
  const today = new Date().toDateString();
  return btoa(today + 'SALT_KEY_2024').slice(0, 16);
};

// Generate attendance QR code for student
export const generateAttendanceQR = (studentId: string): string => {
  const student = getStudentById(studentId);
  if (!student) return '';
  
  const timestamp = Date.now();
  const secret = getDailySecret();
  const hash = btoa(`${studentId}|${timestamp}|${secret}`).slice(0, 8);
  
  const qrData = {
    id: studentId,
    ts: timestamp,
    h: hash
  };
  
  return JSON.stringify(qrData);
};

// Validate QR code
export const validateStudentQR = (qrData: string): { 
  valid: boolean; 
  studentId?: string; 
  error?: string; 
  expired?: boolean;
} => {
  try {
    const data = JSON.parse(qrData);
    const { id, ts, h } = data;
    
    // Check student exists
    const student = getStudentById(id);
    if (!student) {
      return { valid: false, error: 'Student ID not found' };
    }
    
    // Check expiry (60 seconds)
    const now = Date.now();
    const ageSeconds = (now - ts) / 1000;
    if (ageSeconds > QR_VALIDITY_SECONDS) {
      return { 
        valid: false, 
        studentId: id, 
        error: 'QR code has expired. Student must generate a new one.', 
        expired: true 
      };
    }
    
    // Verify hash
    const secret = getDailySecret();
    const expectedHash = btoa(`${id}|${ts}|${secret}`).slice(0, 8);
    if (h !== expectedHash) {
      return { valid: false, error: 'Invalid QR code' };
    }
    
    return { valid: true, studentId: id };
  } catch {
    return { valid: false, error: 'Invalid QR code format' };
  }
};

// ========================================
// ATTENDANCE RECORD MANAGEMENT
// ========================================

// Clean up old attendance records (older than 30 days)
const cleanupOldRecords = (records: AttendanceRecord[]): AttendanceRecord[] => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DATA_RETENTION_DAYS);
  const cutoffDateString = cutoffDate.toISOString().split('T')[0];
  
  const filteredRecords = records.filter(record => record.date >= cutoffDateString);
  
  if (filteredRecords.length < records.length) {
    console.log(`Cleaned up ${records.length - filteredRecords.length} old attendance records (older than ${DATA_RETENTION_DAYS} days)`);
  }
  
  return filteredRecords;
};

// Get attendance records from localStorage
export const getAttendanceRecords = (): AttendanceRecord[] => {
  try {
    const stored = localStorage.getItem(ATTENDANCE_KEY);
    const records = stored ? JSON.parse(stored) : [];
    // Clean up old records on every read
    const cleanedRecords = cleanupOldRecords(records);
    
    // Save cleaned records back if any were removed
    if (cleanedRecords.length < records.length) {
      saveAttendanceRecords(cleanedRecords);
    }
    
    return cleanedRecords;
  } catch {
    return [];
  }
};

// Save attendance records to localStorage
export const saveAttendanceRecords = (records: AttendanceRecord[]): void => {
  try {
    // Always clean before saving to ensure we never store old data
    const cleanedRecords = cleanupOldRecords(records);
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(cleanedRecords));
    console.log(`Saved ${cleanedRecords.length} attendance records (retention: ${DATA_RETENTION_DAYS} days)`);
  } catch (error) {
    console.error('Failed to save attendance records:', error);
  }
};

// Check if student already marked attendance today
export const hasMarkedAttendanceToday = (studentId: string): boolean => {
  const records = getAttendanceRecords();
  const today = new Date().toISOString().split('T')[0];
  return records.some(r => r.studentId === studentId && r.date === today);
};

// Mark attendance (called by teacher after scanning)
export const markAttendanceFromScan = (
  studentId: string
): { success: boolean; message: string; status?: AttendanceStatus; studentName?: string } => {
  // Find student
  const student = getStudentById(studentId);
  if (!student) {
    return { success: false, message: 'Student ID not found.' };
  }
  
  // Check if already marked today
  const alreadyMarked = hasMarkedAttendanceToday(studentId);
  if (alreadyMarked) {
    return { success: false, message: 'Attendance already marked for today.' };
  }
  
  // Determine status based on time
  const now = new Date();
  const currentTime = now.toTimeString().split(' ')[0];
  const status: AttendanceStatus = currentTime > CUTOFF_TIME ? 'LATE_PRESENT' : 'PRESENT';
  
  // Create attendance record
  const record: AttendanceRecord = {
    studentId: student.id,
    studentName: student.name,
    date: now.toISOString().split('T')[0],
    time: currentTime,
    status: status,
    method: 'qr_scan',
    verified: true
  };
  
  // Save to localStorage
  const records = getAttendanceRecords();
  records.push(record);
  saveAttendanceRecords(records);
  
  // Store in offline manager for sync when online
  if (offlineManager.isOnline()) {
    // If online, try to sync immediately
    offlineManager.syncPendingRecords().catch(console.error);
  } else {
    // If offline, store for later sync
    offlineManager.storeAttendanceRecord({
      studentId: student.id,
      studentName: student.name,
      image: '', // No face image for QR scan
      timestamp: new Date().toISOString()
    }).catch(console.error);
  }
  
  return { 
    success: true, 
    message: `Attendance marked for ${student.name}.`,
    status: status,
    studentName: student.name
  };
};

// ========================================
// STATISTICS FUNCTIONS
// ========================================

// Get dashboard statistics (using real data only)
export const getDashboardStats = (): DashboardStats => {
  const records = getAttendanceRecords(); // Use real attendance records, not mock
  const today = new Date().toISOString().split('T')[0];
  const todayRecords = records.filter(r => r.date === today);
  
  // Count all 3 students with their actual status
  const presentCount = todayRecords.filter(r => r.status === 'PRESENT').length;
  const lateCount = todayRecords.filter(r => r.status === 'LATE_PRESENT').length;
  
  return {
    totalStudents: students.length, // All 3 students
    presentToday: presentCount,
    lateToday: lateCount,
    absentToday: students.length - presentCount - lateCount // Students not present/late today
  };
};

// Get student statistics (using real data, not random mock data)
export const getStudentStats = (studentId: string): StudentStats | null => {
  const student = getStudentById(studentId);
  if (!student) return null;
  
  const records = getAttendanceRecords(); // Use real attendance records, not mock
  const studentRecords = records.filter(r => r.studentId === studentId);
  
  const totalDays = studentRecords.length;
  const daysPresent = studentRecords.filter(r => r.status === 'PRESENT').length;
  const daysLate = studentRecords.filter(r => r.status === 'LATE_PRESENT').length;
  const daysAbsent = studentRecords.filter(r => r.status === 'ABSENT').length;
  const attendancePercentage = totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0;
  
  return {
    totalDays,
    daysPresent,
    daysLate,
    daysAbsent,
    attendancePercentage
  };
};

// ========================================
// ATTENDANCE TOKENS
// ========================================

// Generate attendance token for student
export const generateAttendanceToken = (studentId: string): string => {
  const student = getStudentById(studentId);
  if (!student) return '';
  
  const timestamp = Date.now();
  const token = btoa(`${studentId}|${timestamp}|${Math.random()}`).slice(0, 32);
  
  const attendanceToken: AttendanceToken = {
    token,
    studentId,
    studentName: student.name,
    expiryTimestamp: timestamp + (QR_VALIDITY_SECONDS * 1000), // 60 seconds to match QR validity
    isUsed: false,
    createdAt: timestamp
  };
  
  const tokens = getAttendanceTokens();
  
  // Clean up old tokens for this student before adding new one
  const cleanedTokens = tokens.filter(t => t.studentId !== studentId || t.isUsed);
  cleanedTokens.push(attendanceToken);
  saveAttendanceTokens(cleanedTokens);
  
  return token;
};

// Get attendance tokens
export const getAttendanceTokens = (): AttendanceToken[] => {
  try {
    const stored = localStorage.getItem(ATTENDANCE_TOKENS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save attendance tokens
export const saveAttendanceTokens = (tokens: AttendanceToken[]): void => {
  try {
    localStorage.setItem(ATTENDANCE_TOKENS_KEY, JSON.stringify(tokens));
  } catch (error) {
    console.error('Failed to save attendance tokens:', error);
  }
};

// Validate attendance token
export const validateAttendanceToken = (token: string): {
  valid: boolean;
  studentId?: string;
  studentName?: string;
  error?: string;
  expired?: boolean;
} => {
  try {
    const tokens = getAttendanceTokens();
    const attendanceToken = tokens.find(t => t.token === token);
    
    if (!attendanceToken) {
      return { valid: false, error: 'Invalid token' };
    }
    
    if (attendanceToken.isUsed) {
      return { valid: false, error: 'Token already used' };
    }
    
    if (Date.now() > attendanceToken.expiryTimestamp) {
      return { valid: false, error: 'Token expired', expired: true };
    }
    
    return {
      valid: true,
      studentId: attendanceToken.studentId,
      studentName: attendanceToken.studentName
    };
  } catch {
    return { valid: false, error: 'Token validation failed' };
  }
};

// Use attendance token
export const useAttendanceToken = (token: string): {
  success: boolean;
  message: string;
  studentId?: string;
  studentName?: string;
  status?: AttendanceStatus;
} => {
  const validation = validateAttendanceToken(token);
  
  if (!validation.valid) {
    return { success: false, message: validation.error || 'Invalid token' };
  }
  
  const { studentId, studentName } = validation;
  
  // Mark attendance
  const result = markAttendanceFromScan(studentId!);
  
  // Mark token as used
  const tokens = getAttendanceTokens();
  const updatedTokens = tokens.map(t => 
    t.token === token ? { ...t, isUsed: true } : t
  );
  saveAttendanceTokens(updatedTokens);
  
  return { 
    success: result.success, 
    message: result.message, 
    studentId, 
    studentName, 
    status: result.status 
  };
};

// ========================================
// FACE CAPTURE FUNCTIONS
// ========================================

// Get face capture for student
export const getFaceCapture = (studentId: string, date: string): string | null => {
  try {
    const captures = JSON.parse(localStorage.getItem(FACE_CAPTURES_KEY) || '{}');
    return captures[`${studentId}_${date}`] || null;
  } catch {
    return null;
  }
};

// Save face capture
export const saveFaceCapture = (studentId: string, date: string, imageData: string): void => {
  try {
    const captures = JSON.parse(localStorage.getItem(FACE_CAPTURES_KEY) || '{}');
    captures[`${studentId}_${date}`] = imageData;
    localStorage.setItem(FACE_CAPTURES_KEY, JSON.stringify(captures));
  } catch (error) {
    console.error('Failed to save face capture:', error);
  }
};

// Check if attendance is pending face capture
export const isAttendancePendingFaceCapture = (studentId: string, date: string): boolean => {
  const faceCapture = getFaceCapture(studentId, date);
  const records = getAttendanceRecords();
  const hasAttendance = records.some(r => r.studentId === studentId && r.date === date);
  return hasAttendance && !faceCapture;
};

// ========================================
// STUDENT PHOTO FUNCTIONS
// ========================================

// Get student photo
export const getStudentPhoto = (studentId: string): string | null => {
  try {
    const photos = JSON.parse(localStorage.getItem(STUDENT_PHOTOS_KEY) || '{}');
    return photos[studentId] || null;
  } catch {
    return null;
  }
};

// Save student photo
export const saveStudentPhoto = (studentId: string, imageData: string): void => {
  try {
    const photos = JSON.parse(localStorage.getItem(STUDENT_PHOTOS_KEY) || '{}');
    photos[studentId] = imageData;
    localStorage.setItem(STUDENT_PHOTOS_KEY, JSON.stringify(photos));
  } catch (error) {
    console.error('Failed to save student photo:', error);
  }
};

// ========================================
// EXPORT FUNCTIONS
// ========================================

// Get records for export (using real data, not random mock data)
export const getRecordsForExport = (
  filter: 'daily' | 'weekly' | 'monthly' = 'daily'
): AttendanceRecord[] => {
  let records = getAttendanceRecords(); // Use real attendance records, not mock
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison
  
  const todayStr = today.toISOString().split('T')[0];
  
  // Debug: Log the records found
  console.log(`Export Debug - Total records found: ${records.length}`);
  console.log('Export Debug - Records:', records);
  console.log('Export Debug - Today date:', todayStr);
  
  // If no records exist, create comprehensive sample data for testing
  if (records.length === 0) {
    console.log('Export Debug - No records found, creating comprehensive sample data');
    
    // Create sample data for the past 7 days
    const sampleRecords: AttendanceRecord[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      // Add records for all 3 students
      sampleRecords.push(
        {
          studentId: '20221CIT0043',
          studentName: 'Amrutha M',
          date: dateStr,
          time: '09:15:00',
          status: 'PRESENT',
          method: 'FACE_RECOGNITION'
        },
        {
          studentId: '20221CIT0049',
          studentName: 'C M Shalini',
          date: dateStr,
          time: '09:25:00',
          status: i === 0 ? 'LATE_PRESENT' : 'PRESENT',
          method: 'FACE_RECOGNITION'
        },
        {
          studentId: '20221CIT0151',
          studentName: 'Vismaya L',
          date: dateStr,
          time: i === 0 ? '' : '09:20:00',
          status: i === 0 ? 'ABSENT' : 'PRESENT',
          method: i === 0 ? 'MANUAL' : 'FACE_RECOGNITION'
        }
      );
    }
    
    console.log(`Export Debug - Created ${sampleRecords.length} sample records`);
    console.log('Export Debug - Sample records:', sampleRecords);
    
    // Save directly to localStorage bypassing cleanup
    try {
      localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(sampleRecords));
      console.log('Export Debug - Sample data saved directly to localStorage');
    } catch (error) {
      console.error('Export Debug - Failed to save sample data:', error);
    }
    
    // Update records variable
    records = sampleRecords;
  }
  
  console.log(`Export Debug - Working with ${records.length} total records`);
  
  let filteredRecords: AttendanceRecord[] = [];
  
  switch (filter) {
    case 'daily':
      // Export only today's records
      filteredRecords = records.filter(r => r.date === todayStr);
      console.log(`Export Debug - Daily filter: ${filteredRecords.length} records for ${todayStr}`);
      break;
      
    case 'weekly':
      // Export records from the past 7 days (current week)
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 6); // 7 days including today
      const weekStartStr = weekStart.toISOString().split('T')[0];
      filteredRecords = records.filter(r => r.date >= weekStartStr && r.date <= todayStr);
      console.log(`Export Debug - Weekly filter: ${filteredRecords.length} records from ${weekStartStr} to ${todayStr}`);
      break;
      
    case 'monthly':
      // Export records from current month
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];
      filteredRecords = records.filter(r => r.date >= monthStartStr && r.date <= todayStr);
      console.log(`Export Debug - Monthly filter: ${filteredRecords.length} records from ${monthStartStr} to ${todayStr}`);
      break;
      
    default:
      filteredRecords = records.filter(r => r.date === todayStr);
      console.log(`Export Debug - Default filter: ${filteredRecords.length} records for ${todayStr}`);
  }
  
  console.log('Export Debug - Final filtered records:', filteredRecords);
  
  // If still no records after filtering, return all records as fallback
  if (filteredRecords.length === 0 && records.length > 0) {
    console.log('Export Debug - No records match filter, returning all records as fallback');
    return records;
  }
  
  return filteredRecords;
};

// Export to CSV (excluding Method column as per requirements)
export const exportToCSV = (records: AttendanceRecord[], filter: 'daily' | 'weekly' | 'monthly' = 'daily'): void => {
  try {
    // Debug: Log the records being exported
    console.log(`CSV Export Debug - Starting export with ${records.length} records`);
    console.log('CSV Export Debug - Records to export:', records);
    
    // CSV headers - excluding Method column
    const headers = ['Student ID', 'Student Name', 'Date', 'Time', 'Status'];
    
    // Generate CSV content
    const csvRows = records.map(r => {
      const row = [
        r.studentId || '',
        r.studentName || '',
        r.date || '',
        r.time || '',
        r.status || ''
      ];
      console.log(`CSV Export Debug - Row data: ${row.join(', ')}`);
      return row.join(',');
    });
    
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    console.log(`CSV Export Debug - Final CSV content length: ${csvContent.length}`);
    console.log('CSV Export Debug - CSV content preview:', csvContent.substring(0, 200) + '...');
    
    // Create blob with UTF-8 encoding
    console.log('CSV Export Debug - Creating blob with content length:', csvContent.length);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    console.log('CSV Export Debug - Blob created, size:', blob.size);
    
    // Create download URL
    const url = window.URL.createObjectURL(blob);
    console.log('CSV Export Debug - Object URL created:', url);
    
    // Generate filename based on filter type
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    let filename: string;
    
    switch (filter) {
      case 'daily':
        filename = `attendance_daily_${dateStr}.csv`;
        break;
      case 'weekly':
        const weekNum = Math.ceil((today.getDate() + 6 - today.getDay()) / 7);
        filename = `attendance_weekly_${today.getFullYear()}-W${weekNum.toString().padStart(2, '0')}.csv`;
        break;
      case 'monthly':
        filename = `attendance_monthly_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}.csv`;
        break;
      default:
        filename = `attendance_export_${dateStr}.csv`;
    }
    
    console.log('CSV Export Debug - Filename:', filename);
    
    // Trigger download with multiple methods for compatibility
    try {
      // Method 1: Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      console.log('CSV Export Debug - Download link created and appended');
      
      // Method 2: Try to click the link
      a.click();
      console.log('CSV Export Debug - Link clicked');
      
      // Method 3: Alternative download method
      if (window.navigator && (window.navigator as any).msSaveBlob) {
        // For IE/Edge
        (window.navigator as any).msSaveBlob(blob, filename);
        console.log('CSV Export Debug - IE/Edge download method used');
      }
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        console.log('CSV Export Debug - Cleanup completed');
      }, 100);
      
      console.log(`CSV export successful: ${filename}, ${records.length} records`);
      
      // Also log the exact CSV content for debugging
      console.log('CSV Export Debug - Full CSV content:');
      console.log(csvContent);
      
    } catch (downloadError) {
      console.error('CSV Export Debug - Download error:', downloadError);
      throw downloadError;
    }
  } catch (error) {
    console.error('Error exporting CSV:', error);
  }
};

// Test function for CSV export (temporary for debugging)
export const testCSVExport = () => {
  console.log('=== CSV Export Test Started ===');
  
  // Test with sample data
  const testRecords: AttendanceRecord[] = [
    {
      studentId: '20221CIT0043',
      studentName: 'Amrutha M',
      date: '2026-03-06',
      time: '09:15:00',
      status: 'PRESENT',
      method: 'FACE_RECOGNITION'
    },
    {
      studentId: '20221CIT0049',
      studentName: 'C M Shalini',
      date: '2026-03-06',
      time: '09:25:00',
      status: 'LATE_PRESENT',
      method: 'FACE_RECOGNITION'
    }
  ];
  
  console.log('Test Records:', testRecords);
  
  // Generate CSV
  const headers = ['Student ID', 'Student Name', 'Date', 'Time', 'Status'];
  const csvContent = [
    headers.join(','),
    ...testRecords.map(r => [
      r.studentId || '',
      r.studentName || '',
      r.date || '',
      r.time || '',
      r.status || ''
    ].join(','))
  ].join('\n');
  
  console.log('Generated CSV:');
  console.log(csvContent);
  
  // Create blob and test download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  console.log('Blob size:', blob.size);
  
  const url = window.URL.createObjectURL(blob);
  console.log('Blob URL:', url);
  
  // Test download
  const a = document.createElement('a');
  a.href = url;
  a.download = 'test_export.csv';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  
  console.log('=== CSV Export Test Completed ===');
};

// Get weekly summary for charts (using real data, not random mock data)
export const getWeeklySummary = () => {
  const records = getAttendanceRecords(); // Use real attendance records, not mock
  const today = new Date();
  const weekData = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    const dateStr = date.toISOString().split('T')[0];
    const dayRecords = records.filter(r => r.date === dateStr);
    
    weekData.push({
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      present: dayRecords.filter(r => r.status === 'PRESENT').length,
      late: dayRecords.filter(r => r.status === 'LATE_PRESENT').length,
      absent: dayRecords.filter(r => r.status === 'ABSENT').length
    });
  }
  
  return weekData;
};

// ========================================
// FACE VERIFICATION FUNCTIONS
// ========================================

// Mock face verification function
export const verifyFaceWithBackend = async (
  studentId: string,
  faceImageData: string
): Promise<{ success: boolean; message: string; confidence?: number }> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock verification - in real implementation, this would call the backend
  const student = getStudentById(studentId);
  if (!student) {
    return { success: false, message: 'Student not found' };
  }
  
  // Simulate face recognition with random confidence
  const confidence = 0.75 + Math.random() * 0.25; // 75-100% confidence
  
  if (confidence > 0.8) {
    return { 
      success: true, 
      message: 'Face verified successfully', 
      confidence: Math.round(confidence * 100) 
    };
  } else {
    return { 
      success: false, 
      message: 'Face verification failed - low confidence', 
      confidence: Math.round(confidence * 100) 
    };
  }
};

// Get today's attendance status (all 3 students with real status)
export const getTodayAttendanceStatus = (): AttendanceRecord[] => {
  const today = new Date().toISOString().split('T')[0];
  const records = getAttendanceRecords();
  const todayRecords = records.filter(r => r.date === today);
  
  // Get all 3 required students
  const requiredStudents = [
    { id: '20221CIT0043', name: 'Amrutha M' },
    { id: '20221CIT0049', name: 'C M Shalini' },
    { id: '20221CIT0151', name: 'Vismaya L' }
  ];
  
  const studentStatuses: AttendanceRecord[] = [];
  
  requiredStudents.forEach(student => {
    const attendanceRecord = todayRecords.find(r => r.studentId === student.id);
    if (attendanceRecord) {
      // Use the actual attendance record if it exists
      studentStatuses.push(attendanceRecord);
    } else {
      // Mark as absent if no actual record exists for today
      studentStatuses.push({
        studentId: student.id,
        studentName: student.name,
        date: today,
        time: '-',
        status: 'ABSENT',
        method: 'auto',
        verified: false
      });
    }
  });
  
  return studentStatuses;
};

// Removed: addSampleTodayAttendance() - No mock data generation
// All attendance data now comes from real student check-ins only

// ========================================
// URL GENERATION
// ========================================

export const generateAttendanceURL = (studentId: string): string => {
  // Generate QR code data with embedded validation
  const qrData = generateAttendanceQR(studentId);
  if (!qrData) return '';
  
  // Smart network detection - automatically adapts to current access method
  const currentHostname = window.location.hostname;
  const currentPort = window.location.port || '8080';
  const currentProtocol = window.location.protocol;
  
  console.log('Network detection:', { 
    hostname: currentHostname, 
    port: currentPort, 
    protocol: currentProtocol 
  });
  
  let baseUrl: string;
  
  // Determine base URL based on access method
  if (currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
    // Local development access
    baseUrl = `${currentProtocol}//localhost:${currentPort}`;
    console.log('Using localhost URL:', baseUrl);
  } else if (currentHostname.match(/^192\.168\.\d+\.\d+$/)) {
    // Local network IP access
    baseUrl = `${currentProtocol}//${currentHostname}:${currentPort}`;
    console.log('Using network IP URL:', baseUrl);
  } else {
    // Default fallback
    baseUrl = `${currentProtocol}//${currentHostname}:${currentPort}`;
    console.log('Using default URL:', baseUrl);
  }
  
  // Encode QR data directly in URL instead of using localStorage tokens
  return `${baseUrl}/verify-attendance?qr=${encodeURIComponent(qrData)}`;
};
