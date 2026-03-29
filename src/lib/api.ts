/**
 * API Service Layer for Backend Communication
 * Handles all HTTP requests to the FastAPI backend
 */

import { AttendanceRecord, AttendanceStatus } from '@/types/attendance';
import { offlineManager } from '@/lib/offlineManager';

// Backend API base URL - empty string means use relative URLs (goes through Vite proxy)
const API_BASE_URL = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : 'http://localhost:8000';

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface MarkAttendanceRequest {
  studentId: string;
  studentName: string;
  image: string;
}

interface MarkAttendanceResponse {
  success: boolean;
  verified: boolean;
  message: string;
  studentId: string;
  studentName: string;
  confidenceScore: number;
  method: string;
  offline?: boolean;
}

interface StudentAttendanceResponse {
  success: boolean;
  records: AttendanceRecord[];
  count: number;
}

interface TodayStatsResponse {
  success: boolean;
  percentage: number;
  presentCount: number;
  lateCount?: number;
  absentCount: number;
  totalStudents: number;
  date: string;
}

interface TodayAttendanceListResponse {
  success: boolean;
  attendance: Array<{
    studentId: string;
    studentName: string;
    checkInTime: string;
    method: string;
    confidenceScore: number;
    grade: string;
  }>;
  count: number;
  date: string;
}

/**
 * Mark attendance with face verification
 * Uses /mark-attendance endpoint which doesn't require QR session
 */
export async function markAttendance(
  studentId: string,
  studentName: string,
  image: string
): Promise<MarkAttendanceResponse> {
  // If clearly offline, skip the network request and store locally
  if (!navigator.onLine) {
    return storeOfflineAndReturn(studentId, studentName, image);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(`${API_BASE_URL}/mark-attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId,
        studentName,
        image,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to mark attendance');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Network errors (offline, timeout, DNS failure) → store offline
    if (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      console.warn('[API] Network unavailable, saving attendance offline');
      return storeOfflineAndReturn(studentId, studentName, image);
    }
    // Server-side errors (4xx/5xx with a parsed message) → re-throw
    console.error('Error marking attendance:', error);
    throw error;
  }
}

async function storeOfflineAndReturn(
  studentId: string,
  studentName: string,
  image: string
): Promise<MarkAttendanceResponse> {
  await offlineManager.storeRecord({ studentId, studentName, image });
  return {
    success: true,
    verified: true,
    message: 'Attendance saved offline. It will sync automatically when you are back online.',
    studentId,
    studentName,
    method: 'offline',
    confidenceScore: 0,
    offline: true,
  };
}

/**
 * Get attendance records for a specific student
 */
export async function getStudentAttendance(
  studentId: string,
  startDate?: string,
  endDate?: string
): Promise<AttendanceRecord[]> {
  try {
    const params = new URLSearchParams();
    params.append('student_id', studentId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await fetch(
      `${API_BASE_URL}/api/attendance/report?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch student attendance');
    }

    const data: any = await response.json();
    
    // Transform backend response to frontend format
    return data.records.map((record: any) => ({
      studentId: record.studentId,
      studentName: record.studentName,
      date: record.date,
      time: record.checkInTime || '',
      status: determineStatus(record.checkInTime),
      method: record.method || 'FACE_RECOGNITION',
    }));
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    return [];
  }
}

/**
 * Get today's attendance statistics
 */
export async function getTodayStats(): Promise<{
  totalStudents: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
}> {
  try {
    console.log('Fetching today stats from:', `${API_BASE_URL}/api/attendance/today-stats`);
    const response = await fetch(`${API_BASE_URL}/api/attendance/today-stats`);

    if (!response.ok) {
      console.error('Failed to fetch today stats. Status:', response.status);
      throw new Error('Failed to fetch today stats');
    }

    const data: TodayStatsResponse = await response.json();
    console.log('Today stats received:', data);
    
    return {
      totalStudents: data.totalStudents,
      presentToday: data.presentCount,
      lateToday: data.lateCount || 0,
      absentToday: data.absentCount,
    };
  } catch (error) {
    console.error('Error fetching today stats:', error);
    console.error('Make sure backend server is running at:', API_BASE_URL);
    return {
      totalStudents: 0,
      presentToday: 0,
      lateToday: 0,
      absentToday: 0,
    };
  }
}

/**
 * Get today's attendance list
 */
export async function getTodayAttendanceList(): Promise<AttendanceRecord[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/attendance/today-list`);

    if (!response.ok) {
      throw new Error('Failed to fetch today attendance list');
    }

    const data: TodayAttendanceListResponse = await response.json();
    
    // Transform backend response to frontend format
    return data.attendance.map(record => ({
      studentId: record.studentId,
      studentName: record.studentName,
      date: data.date,
      time: record.checkInTime || '',
      status: determineStatus(record.checkInTime),
      method: record.method || 'FACE_RECOGNITION',
    }));
  } catch (error) {
    console.error('Error fetching today attendance list:', error);
    return [];
  }
}

/**
 * Get all attendance records (for admin dashboard)
 */
export async function getAllAttendanceRecords(
  startDate?: string,
  endDate?: string
): Promise<AttendanceRecord[]> {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const queryString = params.toString();
    const url = queryString 
      ? `${API_BASE_URL}/api/attendance/report?${queryString}`
      : `${API_BASE_URL}/api/attendance/report`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch attendance records');
    }

    const data: any = await response.json();
    
    // Transform backend response to frontend format
    return data.records.map((record: any) => ({
      studentId: record.studentId,
      studentName: record.studentName,
      date: record.date,
      time: record.checkInTime || '',
      status: determineStatus(record.checkInTime),
      method: record.method || 'FACE_RECOGNITION',
    }));
  } catch (error) {
    console.error('Error fetching all attendance records:', error);
    return [];
  }
}

/**
 * Validate QR token
 */
export async function validateQRToken(token: string): Promise<{
  success: boolean;
  message: string;
  studentId?: string;
  studentName?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/validate-attendance-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: error.detail || 'Invalid QR code',
      };
    }

    const data = await response.json();
    return {
      success: data.success,
      message: data.message,
      studentId: data.studentId,
      studentName: data.studentName,
    };
  } catch (error) {
    console.error('Error validating QR token:', error);
    return {
      success: false,
      message: 'Failed to validate QR code',
    };
  }
}

/**
 * Helper function to determine attendance status based on check-in time
 */
function determineStatus(checkInTime: string): AttendanceStatus {
  if (!checkInTime) return 'ABSENT';
  
  // Parse time (format: HH:MM:SS)
  const [hours, minutes] = checkInTime.split(':').map(Number);
  const timeInMinutes = hours * 60 + minutes;
  
  // Cutoff time: 1:00 PM = 780 minutes
  const cutoffTime = 13 * 60;
  
  if (timeInMinutes <= cutoffTime) {
    return 'PRESENT';
  } else {
    return 'LATE_PRESENT';
  }
}

/**
 * Get weekly summary for charts
 */
export async function getWeeklySummary(): Promise<Array<{
  date: string;
  present: number;
  late: number;
  absent: number;
}>> {
  try {
    // Calculate date range for past 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 6);

    const records = await getAllAttendanceRecords(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Group by date
    const weekData: Array<{
      date: string;
      present: number;
      late: number;
      absent: number;
    }> = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(endDate.getDate() - i);
      
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      const dateStr = date.toISOString().split('T')[0];
      const dayRecords = records.filter(r => r.date === dateStr);
      
      weekData.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        present: dayRecords.filter(r => r.status === 'PRESENT').length,
        late: dayRecords.filter(r => r.status === 'LATE_PRESENT').length,
        absent: dayRecords.filter(r => r.status === 'ABSENT').length,
      });
    }

    return weekData;
  } catch (error) {
    console.error('Error fetching weekly summary:', error);
    return [];
  }
}

/**
 * Export attendance records to CSV
 */
/**
 * Get attendance statistics for a specific student (calculated server-side including absent days)
 */
export async function getStudentStats(studentId: string): Promise<{
  totalDays: number;
  daysPresent: number;
  daysLate: number;
  daysAbsent: number;
  attendancePercentage: number;
}> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/attendance/student-stats?student_id=${encodeURIComponent(studentId)}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch student stats');
    }

    const data = await response.json();
    return {
      totalDays: data.totalDays || 0,
      daysPresent: data.daysPresent || 0,
      daysLate: data.daysLate || 0,
      daysAbsent: data.daysAbsent || 0,
      attendancePercentage: data.attendancePercentage || 0,
    };
  } catch (error) {
    console.error('Error fetching student stats:', error);
    return { totalDays: 0, daysPresent: 0, daysLate: 0, daysAbsent: 0, attendancePercentage: 0 };
  }
}

/**
 * Get recent attendance events for cross-device sync notifications
 * Pass 'since' timestamp to only get new events
 */
export interface AttendanceEvent {
  id: string;
  studentId: string;
  studentName: string;
  time: string;
  date: string;
  timestamp: string;
  method: string;
}

export async function getRecentAttendanceEvents(since?: string): Promise<{
  events: AttendanceEvent[];
  serverTime: string;
}> {
  try {
    const params = new URLSearchParams();
    if (since) params.append('since', since);

    const response = await fetch(
      `${API_BASE_URL}/api/attendance/recent-events?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch recent events');
    }

    const data = await response.json();
    return {
      events: data.events || [],
      serverTime: data.serverTime || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error fetching recent events:', error);
    return { events: [], serverTime: new Date().toISOString() };
  }
}

export function exportRecordsToCSV(
  records: AttendanceRecord[],
  filter: 'daily' | 'weekly' | 'monthly'
): void {
  try {
    // CSV headers - excluding Method column
    const headers = ['Student ID', 'Student Name', 'Date', 'Time', 'Status'];
    
    // Generate CSV content
    const csvRows = records.map(r => [
      r.studentId || '',
      r.studentName || '',
      r.date || '',
      r.time || '',
      r.status || ''
    ].join(','));
    
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    
    // Create blob with UTF-8 encoding
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    
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
    
    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log(`CSV export successful: ${filename}, ${records.length} records`);
  } catch (error) {
    console.error('Error exporting CSV:', error);
  }
}

/**
 * Get all registered students with face enrollment status
 */
export async function getStudentList(): Promise<{
  id: string;
  name: string;
  grade: string;
  hasFaceEncoding: boolean;
}[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/students`);
    if (!response.ok) throw new Error('Failed to fetch students');
    const data = await response.json();
    return data.students || [];
  } catch (error) {
    console.error('Error fetching student list:', error);
    return [];
  }
}

/**
 * Upload a student face photo for face recognition enrollment
 */
export async function uploadStudentPhoto(
  studentId: string,
  studentName: string,
  image: string,
  grade?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/upload-student-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        studentName,
        image,
        grade: grade || '',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to upload student photo');
    }

    return await response.json();
  } catch (error) {
    console.error('Error uploading student photo:', error);
    throw error;
  }
}
