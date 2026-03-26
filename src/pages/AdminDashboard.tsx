import { useState, useEffect } from 'react';
import Header from '@/components/attendance/Header';
import Footer from '@/components/attendance/Footer';
import Scene3D from '@/components/3d/Scene3D';
import FloatingCard from '@/components/3d/FloatingCard';
import { 
  getTodayStats,
  getTodayAttendanceList,
  getAllAttendanceRecords,
  getWeeklySummary,
  exportRecordsToCSV
} from '@/lib/api';
import { AttendanceRecord } from '@/types/attendance';
import { Users, UserCheck, Clock, UserX, Download, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AdminDashboard = () => {
  const [stats, setStats] = useState({ totalStudents: 0, presentToday: 0, lateToday: 0, absentToday: 0 });
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [exportFilter, setExportFilter] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch today's stats from backend
        const statsData = await getTodayStats();
        setStats(statsData);

        // Fetch today's attendance list from backend
        const today = await getTodayAttendanceList();
        setTodayRecords(today);

        // Fetch weekly summary from backend
        const weekly = await getWeeklySummary();
        setWeeklyData(weekly);

        const date = new Date();
        setCurrentDate(date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchData();
    
    // Refresh data every 10 seconds for real-time updates
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleExport = async () => {
    try {
      // Calculate date range based on filter
      const today = new Date();
      let startDate: string | undefined;
      let endDate: string = today.toISOString().split('T')[0];

      switch (exportFilter) {
        case 'daily':
          startDate = endDate;
          break;
        case 'weekly':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - 6);
          startDate = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          startDate = monthStart.toISOString().split('T')[0];
          break;
      }

      // Fetch records from backend
      const records = await getAllAttendanceRecords(startDate, endDate);
      
      // Export to CSV
      exportRecordsToCSV(records, exportFilter);
    } catch (error) {
      console.error('Error exporting attendance:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-teal-800 to-emerald-900 text-white overflow-hidden">
      <Scene3D />
      <Header />

      <main className="container relative z-10 py-8 max-w-7xl mx-auto px-4">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-teal-100/70 text-sm">Overview for {currentDate}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Students */}
          <FloatingCard className="p-5 bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
            <div className="flex items-start justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center mb-3">
                  <Users size={20} className="text-teal-300" />
                </div>
                <p className="text-3xl font-bold text-white mb-1">{stats.totalStudents}</p>
                <p className="text-sm text-teal-200/70">Total Students</p>
              </div>
            </div>
          </FloatingCard>

          {/* Present Today */}
          <FloatingCard className="p-5 bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
            <div className="flex items-start justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center mb-3">
                  <UserCheck size={20} className="text-green-400" />
                </div>
                <p className="text-3xl font-bold text-white mb-1">{stats.presentToday}</p>
                <p className="text-sm text-teal-200/70">Present Today</p>
              </div>
            </div>
          </FloatingCard>

          {/* Late Today */}
          <FloatingCard className="p-5 bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
            <div className="flex items-start justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center mb-3">
                  <Clock size={20} className="text-yellow-400" />
                </div>
                <p className="text-3xl font-bold text-white mb-1">{stats.lateToday}</p>
                <p className="text-sm text-teal-200/70">Late Today</p>
              </div>
            </div>
          </FloatingCard>

          {/* Absent Today */}
          <FloatingCard className="p-5 bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
            <div className="flex items-start justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center mb-3">
                  <UserX size={20} className="text-red-400" />
                </div>
                <p className="text-3xl font-bold text-white mb-1">{stats.absentToday}</p>
                <p className="text-sm text-teal-200/70">Absent Today</p>
              </div>
            </div>
          </FloatingCard>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Weekly Attendance Summary Chart */}
          <FloatingCard className="lg:col-span-2 p-6 bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={20} className="text-teal-300" />
              <h3 className="text-base font-semibold text-white">Weekly Attendance Summary</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '12px',
                    padding: '8px 12px'
                  }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px' }}
                  iconType="circle"
                />
                <Bar dataKey="present" fill="#22c55e" name="Present" radius={[8, 8, 0, 0]} />
                <Bar dataKey="late" fill="#f59e0b" name="Late" radius={[8, 8, 0, 0]} />
                <Bar dataKey="absent" fill="#ef4444" name="Absent" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </FloatingCard>

          {/* Export Reports Card */}
          <FloatingCard className="p-6 bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
            <div className="flex items-center gap-2 mb-4">
              <Download size={20} className="text-teal-300" />
              <h3 className="text-base font-semibold text-white">Export Reports</h3>
            </div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setExportFilter('daily')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    exportFilter === 'daily'
                      ? 'bg-teal-500 text-white shadow-lg'
                      : 'bg-teal-900/30 text-teal-200 hover:bg-teal-900/50'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setExportFilter('weekly')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    exportFilter === 'weekly'
                      ? 'bg-teal-500 text-white shadow-lg'
                      : 'bg-teal-900/30 text-teal-200 hover:bg-teal-900/50'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setExportFilter('monthly')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    exportFilter === 'monthly'
                      ? 'bg-teal-500 text-white shadow-lg'
                      : 'bg-teal-900/30 text-teal-200 hover:bg-teal-900/50'
                  }`}
                >
                  Monthly
                </button>
              </div>
              <button
                onClick={handleExport}
                className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download CSV
              </button>
              <p className="text-teal-200/60 text-xs text-center">
                Export {exportFilter} attendance data
              </p>
            </div>
          </FloatingCard>
        </div>

        {/* Today's Attendance Table */}
        <FloatingCard className="p-6 bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
          <h3 className="text-base font-semibold text-white mb-4">Today's Attendance</h3>
          <div className="mb-4">
            <input
              type="text"
              placeholder="All (3)"
              className="px-4 py-2 bg-teal-900/30 border border-teal-700/30 rounded-lg text-white placeholder-teal-300/50 text-sm w-48 focus:outline-none focus:border-teal-500"
              readOnly
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-teal-700/30">
                  <th className="text-left p-3 text-teal-200/70 font-medium text-xs uppercase">Student ID</th>
                  <th className="text-left p-3 text-teal-200/70 font-medium text-xs uppercase">Name</th>
                  <th className="text-left p-3 text-teal-200/70 font-medium text-xs uppercase">Grade</th>
                  <th className="text-left p-3 text-teal-200/70 font-medium text-xs uppercase">Time</th>
                  <th className="text-left p-3 text-teal-200/70 font-medium text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {todayRecords.length > 0 ? (
                  todayRecords.map((record, index) => (
                    <tr key={index} className="border-b border-teal-700/20 hover:bg-teal-900/20 transition-colors">
                      <td className="p-3 text-white font-medium">{record.studentId}</td>
                      <td className="p-3 text-white">{record.studentName}</td>
                      <td className="p-3 text-teal-200/70">CIT 2022</td>
                      <td className="p-3 text-teal-200/70">{record.time || '-'}</td>
                      <td className="p-3">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-semibold ${
                          record.status === 'PRESENT' ? 'bg-green-500/90 text-white' :
                          record.status === 'LATE_PRESENT' ? 'bg-yellow-500/90 text-white' :
                          'bg-red-500/90 text-white'
                        }`}>
                          {record.status === 'PRESENT' ? 'Present' :
                           record.status === 'LATE_PRESENT' ? 'Late' : 'Absent'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-teal-200/60">
                      No attendance records for today
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </FloatingCard>
      </main>

      <Footer />
    </div>
  );
};

export default AdminDashboard;
