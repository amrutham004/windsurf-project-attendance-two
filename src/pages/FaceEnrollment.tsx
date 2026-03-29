/**
 * FaceEnrollment.tsx - Admin Face Registration Page
 * 
 * Allows admin to capture and register student face photos
 * for the OpenCV LBPH face recognition system.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '@/components/attendance/Header';
import Footer from '@/components/attendance/Footer';
import Scene3D from '@/components/3d/Scene3D';
import FloatingCard from '@/components/3d/FloatingCard';
import GlassButton from '@/components/3d/GlassButton';
import { getStudentList, uploadStudentPhoto } from '@/lib/api';
import {
  Camera, CheckCircle, XCircle, RotateCcw, Users,
  UserCheck, UserX, Loader2, ArrowLeft, ScanFace
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/lib/i18n';

interface StudentInfo {
  id: string;
  name: string;
  grade: string;
  hasFaceEncoding: boolean;
}

const FaceEnrollment = () => {
  const { t } = useTranslation();
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);

  // Camera state
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch students
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const list = await getStudentList();
    setStudents(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Camera controls
  const startCamera = useCallback(async () => {
    try {
      setCameraError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
      }
    } catch {
      setCameraError('Unable to access camera. Please grant camera permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setResult(null);
    startCamera();
  }, [startCamera]);

  // Upload face
  const handleUpload = useCallback(async () => {
    if (!capturedImage || !selectedStudent) return;
    setUploading(true);
    setResult(null);
    try {
      const res = await uploadStudentPhoto(
        selectedStudent.id,
        selectedStudent.name,
        capturedImage,
        selectedStudent.grade
      );
      setResult({ success: res.success, message: res.message });
      if (res.success) {
        // Refresh student list to update enrollment status
        await fetchStudents();
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }, [capturedImage, selectedStudent, fetchStudents]);

  // Select a student to enroll
  const handleSelectStudent = (student: StudentInfo) => {
    setSelectedStudent(student);
    setCapturedImage(null);
    setResult(null);
    setCameraError('');
    stopCamera();
  };

  // Back to student list
  const handleBackToList = () => {
    stopCamera();
    setSelectedStudent(null);
    setCapturedImage(null);
    setResult(null);
    setCameraError('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const enrolledCount = students.filter((s) => s.hasFaceEncoding).length;
  const pendingCount = students.filter((s) => !s.hasFaceEncoding).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-teal-800 to-emerald-900 text-white overflow-hidden">
      <Scene3D />
      <Header />

      <main className="container relative z-10 py-8 max-w-4xl mx-auto px-4">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-teal-300/70 hover:text-teal-300 transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          {t('enroll.backToAdmin')}
        </Link>

        {/* Page Title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 via-teal-500/20 to-blue-500/20 border border-teal-500/30 flex items-center justify-center">
            <ScanFace size={40} className="text-teal-400" />
          </div>
          <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-green-300 via-teal-300 to-blue-300 bg-clip-text text-transparent mb-2">
            {t('enroll.title')}
          </h1>
          <p className="text-teal-100/80">
            {t('enroll.subtitle')}
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <FloatingCard>
            <div className="flex items-center gap-3">
              <Users size={20} className="text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">{students.length}</p>
                <p className="text-xs text-teal-200/60">{t('enroll.totalStudents')}</p>
              </div>
            </div>
          </FloatingCard>
          <FloatingCard>
            <div className="flex items-center gap-3">
              <UserCheck size={20} className="text-green-400" />
              <div>
                <p className="text-2xl font-bold text-green-300">{enrolledCount}</p>
                <p className="text-xs text-teal-200/60">{t('enroll.enrolled')}</p>
              </div>
            </div>
          </FloatingCard>
          <FloatingCard>
            <div className="flex items-center gap-3">
              <UserX size={20} className="text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-yellow-300">{pendingCount}</p>
                <p className="text-xs text-teal-200/60">{t('enroll.pending')}</p>
              </div>
            </div>
          </FloatingCard>
        </div>

        {/* Student List View */}
        {!selectedStudent && (
          <div className="space-y-4 animate-fade-in">
            <FloatingCard>
              <h2 className="text-lg font-bold text-white mb-4">{t('enroll.selectStudent')}</h2>

              {loading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-teal-200/60">
                  <Loader2 size={20} className="animate-spin" />
                  {t('common.loading')}
                </div>
              ) : students.length === 0 ? (
                <p className="text-center py-8 text-teal-200/60">{t('enroll.noStudents')}</p>
              ) : (
                <div className="space-y-2">
                  {students.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => handleSelectStudent(student)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                        student.hasFaceEncoding
                          ? 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            student.hasFaceEncoding
                              ? 'bg-green-500/20'
                              : 'bg-yellow-500/20'
                          }`}
                        >
                          {student.hasFaceEncoding ? (
                            <CheckCircle size={20} className="text-green-400" />
                          ) : (
                            <Camera size={20} className="text-yellow-400" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-white">{student.name}</p>
                          <p className="text-xs font-mono text-teal-300/70">{student.id}</p>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          student.hasFaceEncoding
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-yellow-500/20 text-yellow-300'
                        }`}
                      >
                        {student.hasFaceEncoding ? t('enroll.enrolledBadge') : t('enroll.notEnrolledBadge')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </FloatingCard>
          </div>
        )}

        {/* Camera / Capture View */}
        {selectedStudent && (
          <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
            {/* Student Info */}
            <FloatingCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-teal-200/60">{t('enroll.enrollingFor')}</p>
                  <p className="text-lg font-bold text-white">{selectedStudent.name}</p>
                  <p className="text-sm font-mono text-teal-300/70">{selectedStudent.id}</p>
                </div>
                <button
                  onClick={handleBackToList}
                  className="text-teal-300/70 hover:text-teal-300 transition-colors text-sm flex items-center gap-1"
                >
                  <ArrowLeft size={14} />
                  {t('enroll.changeStudent')}
                </button>
              </div>
            </FloatingCard>

            {/* Camera */}
            <FloatingCard>
              {cameraError && (
                <div className="mb-4 p-3 bg-red-500/20 text-red-300 rounded-lg text-center text-sm border border-red-500/30">
                  {cameraError}
                </div>
              )}

              <div className="aspect-[4/3] bg-black/50 rounded-xl overflow-hidden relative mb-4 border border-white/10">
                {!capturedImage && (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                )}
                {capturedImage && (
                  <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                )}

                {/* Face guide overlay */}
                {!capturedImage && isStreaming && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-40 h-48 border-2 border-teal-400/50 rounded-full" />
                  </div>
                )}

                {/* Uploading overlay */}
                {uploading && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                    <Loader2 size={40} className="text-teal-400 animate-spin mb-2" />
                    <p className="text-white text-sm">{t('enroll.registering')}</p>
                  </div>
                )}

                {/* Result overlay */}
                {result && result.success && (
                  <div className="absolute inset-0 bg-green-900/60 flex flex-col items-center justify-center">
                    <CheckCircle size={48} className="text-green-400 mb-2" />
                    <p className="text-green-300 font-medium">{t('enroll.success')}</p>
                  </div>
                )}
                {result && !result.success && (
                  <div className="absolute inset-0 bg-red-900/60 flex flex-col items-center justify-center">
                    <XCircle size={48} className="text-red-400 mb-2" />
                    <p className="text-red-300 font-medium text-sm text-center px-4">{result.message}</p>
                  </div>
                )}
              </div>

              <canvas ref={canvasRef} className="hidden" />

              {/* Action Buttons */}
              <div className="flex gap-3">
                {!isStreaming && !capturedImage && !result && (
                  <GlassButton variant="primary" onClick={startCamera} className="flex-1">
                    <Camera size={18} className="mr-2" />
                    {t('enroll.openCamera')}
                  </GlassButton>
                )}

                {isStreaming && !capturedImage && (
                  <>
                    <GlassButton variant="secondary" onClick={handleBackToList} className="flex-1">
                      {t('mark.cancel')}
                    </GlassButton>
                    <GlassButton variant="primary" onClick={capturePhoto} className="flex-1">
                      <Camera size={18} className="mr-2" />
                      {t('enroll.capture')}
                    </GlassButton>
                  </>
                )}

                {capturedImage && !uploading && !result && (
                  <>
                    <GlassButton variant="secondary" onClick={retakePhoto} className="flex-1">
                      <RotateCcw size={18} className="mr-2" />
                      {t('enroll.retake')}
                    </GlassButton>
                    <GlassButton variant="primary" onClick={handleUpload} className="flex-1">
                      <CheckCircle size={18} className="mr-2" />
                      {t('enroll.register')}
                    </GlassButton>
                  </>
                )}

                {result && (
                  <div className="flex gap-3 w-full">
                    {result.success ? (
                      <GlassButton variant="primary" onClick={handleBackToList} className="flex-1">
                        {t('enroll.enrollNext')}
                      </GlassButton>
                    ) : (
                      <GlassButton variant="primary" onClick={retakePhoto} className="flex-1">
                        <RotateCcw size={18} className="mr-2" />
                        {t('enroll.tryAgain')}
                      </GlassButton>
                    )}
                  </div>
                )}
              </div>
            </FloatingCard>

            {/* Tips */}
            <FloatingCard glowColor="rgba(59, 130, 246, 0.2)">
              <div className="space-y-2 text-sm text-teal-200/70">
                <p className="font-medium text-white">{t('enroll.tipsTitle')}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('enroll.tip1')}</li>
                  <li>{t('enroll.tip2')}</li>
                  <li>{t('enroll.tip3')}</li>
                  <li>{t('enroll.tip4')}</li>
                </ul>
              </div>
            </FloatingCard>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default FaceEnrollment;
