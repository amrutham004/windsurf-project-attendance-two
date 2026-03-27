import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/attendance/Header';
import Footer from '@/components/attendance/Footer';
import Scene3D from '@/components/3d/Scene3D';
import FloatingCard from '@/components/3d/FloatingCard';
import { Input } from '@/components/ui/input';
import { 
  getStudentAttendance,
  getStudentStats
} from '@/lib/api';
import { getStudentById } from '@/lib/attendanceData';
import { StudentStats, Student, AttendanceRecord } from '@/types/attendance';
import { User, Calendar, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const StudentDashboard = () => {
  const [studentId, setStudentId] = useState('');
  const [searchedStudent, setSearchedStudent] = useState<Student | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const activeStudentRef = useRef<Student | null>(null);

  // Fetch attendance data for a student (reusable for polling)
  const fetchStudentData = useCallback(async (student: Student, isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true);
      
      // Fetch stats from backend (includes absent days auto-marked at midnight)
      const [backendStats, records] = await Promise.all([
        getStudentStats(student.id),
        getStudentAttendance(student.id)
      ]);
      
      setStats({
        totalDays: backendStats.totalDays,
        daysPresent: backendStats.daysPresent,
        daysLate: backendStats.daysLate,
        daysAbsent: backendStats.daysAbsent,
        attendancePercentage: backendStats.attendancePercentage
      });
      
      const filteredRecords = records
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30);
      setStudentRecords(filteredRecords);
      setLastSynced(new Date());
    } catch (err) {
      console.error('Error fetching student attendance:', err);
      if (isManualRefresh) {
        // Don't clear existing data on background refresh failure
      } else {
        setError('Failed to fetch attendance data. Please try again.');
      }
    } finally {
      if (isManualRefresh) setIsRefreshing(false);
    }
  }, []);

  // Auto-refresh every 15 seconds when a student is being viewed
  useEffect(() => {
    if (!activeStudentRef.current) return;
    
    const interval = setInterval(() => {
      if (activeStudentRef.current) {
        fetchStudentData(activeStudentRef.current);
      }
    }, 15000);
    
    return () => clearInterval(interval);
  }, [fetchStudentData, searchedStudent]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const student = getStudentById(studentId.toUpperCase());
    if (!student) {
      setError('Student ID not found. Please check and try again.');
      setSearchedStudent(null);
      activeStudentRef.current = null;
      setStats(null);
      setStudentRecords([]);
      return;
    }

    setSearchedStudent(student);
    activeStudentRef.current = student;
    await fetchStudentData(student);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-900 via-teal-800 to-emerald-900 text-white overflow-hidden">
      <Scene3D />
      <Header />

      <main className="container relative z-10 py-8 max-w-4xl mx-auto px-4 flex-1">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Student Dashboard
          </h1>
          <p className="text-teal-100/70 text-sm">
            View your attendance history and statistics
          </p>
        </div>

        {/* Search Form */}
        <FloatingCard className="mb-6 bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
          <form onSubmit={handleSearch}>
            <div className="mb-2">
              <label className="text-teal-100 text-sm mb-2 block font-medium">Enter Your Student ID</label>
              <div className="flex gap-3">
                <Input
                  type="text"
                  placeholder="20221CIT0043"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="flex-1 bg-white/10 border-teal-500/30 text-white placeholder-teal-200/40 h-11 rounded-xl focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                />
                <button
                  type="submit"
                  disabled={!studentId.trim()}
                  className="px-6 h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  View Dashboard
                </button>
              </div>
              <p className="text-teal-200/50 text-xs mt-2">Enter IDs: 20221CIT0043, 20221CIT0044, 20221CIT0045, 20221CIT0046</p>
            </div>
            {error && (
              <div className="mt-3 bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-red-200 text-sm">
                {error}
              </div>
            )}
          </form>
        </FloatingCard>

        {/* Student Results */}
        {searchedStudent && stats && (
          <div className="space-y-5">
            {/* Student Info Card */}
            <FloatingCard className="bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-teal-500/30 flex items-center justify-center">
                    <User size={28} className="text-teal-200" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{searchedStudent.name}</h2>
                    <p className="text-teal-200/70 text-sm">ID: {searchedStudent.id} • Grade: {searchedStudent.grade}</p>
                    {lastSynced && (
                      <p className="text-teal-300/50 text-xs mt-1 flex items-center gap-1">
                        <RefreshCw size={10} className={isRefreshing ? 'animate-spin' : ''} />
                        Last synced: {lastSynced.toLocaleTimeString()} • Auto-refreshing every 15s
                      </p>
                    )}
                  </div>
                </div>
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="35"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.1)"
                      strokeWidth="6"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="35"
                      fill="none"
                      stroke={stats.attendancePercentage >= 90 ? '#f59e0b' : stats.attendancePercentage >= 75 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${(stats.attendancePercentage / 100) * 220} 220`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{stats.attendancePercentage}%</span>
                  </div>
                </div>
                <button
                  onClick={() => activeStudentRef.current && fetchStudentData(activeStudentRef.current, true)}
                  disabled={isRefreshing}
                  className="ml-3 p-2 bg-teal-700/40 hover:bg-teal-600/50 border border-teal-500/30 rounded-xl text-teal-200 transition-all disabled:opacity-50"
                  title="Refresh data"
                >
                  <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
              </div>
            </FloatingCard>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Total Days */}
              <FloatingCard className="p-5 bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={20} className="text-teal-300" />
                  </div>
                  <p className="text-3xl font-bold text-white mb-1">{stats.totalDays}</p>
                  <p className="text-sm text-teal-200/70">Total Days</p>
                </div>
              </FloatingCard>

              {/* Present */}
              <FloatingCard className="p-5 bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle size={20} className="text-green-400" />
                  </div>
                  <p className="text-3xl font-bold text-white mb-1">{stats.daysPresent}</p>
                  <p className="text-sm text-teal-200/70">Present</p>
                </div>
              </FloatingCard>

              {/* Late */}
              <FloatingCard className="p-5 bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={20} className="text-yellow-400" />
                  </div>
                  <p className="text-3xl font-bold text-white mb-1">{stats.daysLate}</p>
                  <p className="text-sm text-teal-200/70">Late</p>
                </div>
              </FloatingCard>

              {/* Absent */}
              <FloatingCard className="p-5 bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle size={20} className="text-red-400" />
                  </div>
                  <p className="text-3xl font-bold text-white mb-1">{stats.daysAbsent}</p>
                  <p className="text-sm text-teal-200/70">Absent</p>
                </div>
              </FloatingCard>
            </div>

            {/* Attendance Status Bar */}
            <FloatingCard className="p-5 bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-teal-400 rounded-full"></div>
                <h3 className="text-sm font-semibold text-white">Attendance Status</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-3 bg-teal-900/40 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${stats.attendancePercentage}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-teal-200/70">100% Excellent</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      <span className="text-teal-200/70">75-89% Needs Improvement</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      <span className="text-teal-200/70">&lt;75% Critical</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-yellow-400">{stats.attendancePercentage}%</p>
                </div>
              </div>
            </FloatingCard>

            {/* Recent Attendance Records */}
            <FloatingCard className="p-5 bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
              <h3 className="text-base font-semibold text-white mb-4">Recent Attendance Records</h3>
              {studentRecords.length > 0 ? (
                <div className="space-y-2">
                  {studentRecords.slice(0, 10).map((record, index) => (
                    <div key={index} className="flex items-center justify-between py-3 border-b border-teal-700/30 last:border-0">
                      <div>
                        <p className="text-white text-sm font-medium">{record.date}</p>
                        <p className="text-teal-200/60 text-xs">Time: {record.time}</p>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-xs font-semibold ${
                        record.status === 'PRESENT' ? 'bg-green-500/90 text-white' :
                        record.status === 'LATE_PRESENT' ? 'bg-yellow-500/90 text-white' :
                        'bg-red-500/90 text-white'
                      }`}>
                        {record.status === 'PRESENT' ? 'Present' :
                         record.status === 'LATE_PRESENT' ? 'Late' : 'Absent'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar size={40} className="mx-auto mb-3 text-teal-400/30" />
                  <p className="text-teal-200/60 text-sm">No attendance records found</p>
                </div>
              )}
            </FloatingCard>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
};

export default StudentDashboard;
