/**
 * MarkAttendance.tsx - Student Attendance Page (3D Design)
 * 
 * Allows students to mark attendance via:
 * - QR Code (generate & scan)
 * - Face Recognition
 * 
 * Features:
 * - 3D styled glassmorphism cards
 * - Interactive 3D background
 * - Side-by-side attendance options
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/attendance/Header';
import Footer from '@/components/attendance/Footer';
import Scene3D from '@/components/3d/Scene3D';
import FloatingCard from '@/components/3d/FloatingCard';
import GlassButton from '@/components/3d/GlassButton';
import FaceRecognitionCapture from '@/components/attendance/FaceRecognitionCapture';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  generateAttendanceURL, 
  getStudentById, 
  QR_VALIDITY_SECONDS 
} from '@/lib/attendanceData';
import { getStudentAttendance, getRecentAttendanceEvents } from '@/lib/api';
import { ArrowLeft, CheckCircle, Clock, Shield, QrCode, Smartphone, ScanFace, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from '@/lib/i18n';

type Step = 'input' | 'qr-display' | 'qr-verified' | 'face-capture' | 'already-marked' | 'success' | 'error';

const MarkAttendance = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('input');
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [qrData, setQrData] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(QR_VALIDITY_SECONDS);
  const [error, setError] = useState('');
  const [qrVerified, setQrVerified] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  // Generate new QR code with URL for student scanning
  const generateNewQR = useCallback(() => {
    const url = generateAttendanceURL(studentId.toUpperCase());
    setQrData(url);
    setTimeRemaining(QR_VALIDITY_SECONDS);
  }, [studentId]);

  // Track when QR display started (for polling new events)
  const qrDisplayStartTime = useRef<string>('');

  // Generate QR code once when step changes
  useEffect(() => {
    if (step !== 'qr-display') return;
    generateNewQR();
    qrDisplayStartTime.current = new Date().toISOString();

    const countdownInterval = setInterval(() => {
      setTimeRemaining(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [step, generateNewQR]);

  // Poll backend to detect when phone marks attendance (cross-device sync)
  useEffect(() => {
    if (step !== 'qr-display' && step !== 'qr-verified' && step !== 'face-capture') return;
    const currentStudentId = studentId.toUpperCase();
    if (!currentStudentId) return;

    const pollForAttendance = async () => {
      try {
        const result = await getRecentAttendanceEvents(qrDisplayStartTime.current || undefined);
        const match = result.events.find(e => e.studentId === currentStudentId);
        if (match) {
          // Phone has marked attendance — show success on laptop!
          setStudentName(match.studentName);
          setStep('success');
        }
      } catch (err) {
        // Silent fail
      }
    };

    const interval = setInterval(pollForAttendance, 3000);
    return () => clearInterval(interval);
  }, [step, studentId]);

  // Auto-redirect countdown after QR verification
  useEffect(() => {
    if (step !== 'qr-verified') return;

    const redirectInterval = setInterval(() => {
      setRedirectCountdown(prev => {
        if (prev <= 1) {
          clearInterval(redirectInterval);
          setStep('face-capture');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(redirectInterval);
  }, [step]);

  // QR verification success handler
  const handleQRVerified = () => {
    setQrVerified(true);
    setStep('qr-verified');
    setRedirectCountdown(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const student = getStudentById(studentId.toUpperCase());
    if (!student) {
      setError('Student ID not found. Please check and try again.');
      return;
    }

    // Check database for existing attendance today
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const records = await getStudentAttendance(student.id, today, today);
      
      if (records && records.length > 0) {
        setStudentName(student.name);
        setStep('already-marked');
        return;
      }
    } catch (error) {
      console.error('Error checking attendance:', error);
      // Continue with attendance marking if check fails
    }

    setStudentName(student.name);
    setStep('qr-display');
  };

  const handleFaceRecognitionSuccess = () => {
    // Attendance is already marked by the backend API in FaceRecognitionCapture
    setStep('success');
  };

  const handleReset = () => {
    setStep('input');
    setStudentId('');
    setStudentName('');
    setQrData('');
    setError('');
    setQrVerified(false);
    setRedirectCountdown(3);
  };

  const handleFaceVerificationError = (errorMessage: string) => {
    setError(errorMessage);
    setStep('error');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-teal-800 to-emerald-900 text-white overflow-hidden">
      {/* 3D Background */}
      <Scene3D />
      <Header />

      <main className="container relative z-10 py-8 max-w-2xl">
        {/* Back Link */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-teal-300/70 hover:text-teal-300 transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          {t('mark.backHome')}
        </Link>

        {/* Step: Input - Student ID Entry */}
        {step === 'input' && (
          <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500/20 via-teal-500/20 to-purple-500/20 border border-teal-500/30 flex items-center justify-center">
                <Shield size={40} className="text-teal-400" />
              </div>
              <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-green-300 via-teal-300 to-blue-300 bg-clip-text text-transparent mb-2">
                {t('mark.title')}
              </h1>
              <p className="text-teal-100/80 text-lg">
                {t('mark.dualVerification')}
              </p>
            </div>

            <FloatingCard>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="studentId" className="text-teal-100">{t('mark.studentId')}</Label>
                  <Input
                    id="studentId"
                    placeholder={t('mark.studentIdPlaceholder')}
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    required
                    className="text-center text-lg font-mono uppercase bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                  <p className="text-xs text-teal-200/60">
                    {t('mark.studentIdHint')}
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-red-400 text-center">{error}</p>
                )}

                <GlassButton variant="primary" className="w-full">
                  {t('mark.startVerification')}
                </GlassButton>
              </form>
            </FloatingCard>

            {/* Dual Verification Info */}
            <FloatingCard glowColor="rgba(59, 130, 246, 0.2)">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-teal-300 font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-white">{t('mark.qrVerify')}</p>
                    <p className="text-sm text-blue-100/70 mt-1">
                      {t('mark.qrVerifyDesc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-300 font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-white">{t('mark.faceRecognition')}</p>
                    <p className="text-sm text-blue-100/70 mt-1">
                      {t('mark.faceRecognitionDesc')}
                    </p>
                  </div>
                </div>
              </div>
            </FloatingCard>
          </div>
        )}

        {/* Step: Face Capture */}
        {step === 'face-capture' && (
          <div className="max-w-lg mx-auto">
            <FaceRecognitionCapture
              studentId={studentId.toUpperCase()}
              studentName={studentName}
              onSuccess={handleFaceRecognitionSuccess}
              onCancel={handleReset}
              onError={handleFaceVerificationError}
            />
          </div>
        )}

        {/* Step: QR Display */}
        {step === 'qr-display' && (
          <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <QrCode size={32} className="text-teal-400" />
              </div>
              <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-green-300 via-teal-300 to-blue-300 bg-clip-text text-transparent mb-2">
                {t('mark.qrStep')}
              </h1>
              <p className="text-teal-100/70 flex items-center justify-center gap-2">
                <Smartphone size={16} />
                {t('mark.scanWithPhone')}
              </p>
            </div>

            <FloatingCard>
              {/* Student Info */}
              <div className="text-center mb-4 pb-4 border-b border-white/10">
                <p className="text-sm text-teal-200/60">{t('mark.student')}</p>
                <p className="text-lg font-bold text-white">{studentName}</p>
                <p className="text-sm font-mono text-teal-300/70">{studentId.toUpperCase()}</p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-white rounded-xl shadow-2xl shadow-teal-500/20">
                  <QRCodeSVG 
                    value={qrData}
                    size={200}
                    level="H"
                    includeMargin={false}
                    bgColor="transparent"
                    fgColor="hsl(210, 50%, 20%)"
                  />
                </div>
              </div>

              {/* Timer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-teal-200/60">
                    <Clock size={14} />
                    {t('mark.validFor')}
                  </span>
                  <span className={`font-mono font-bold ${timeRemaining <= 10 ? 'text-red-400' : 'text-teal-300'}`}>
                    {timeRemaining}s
                  </span>
                </div>
                <Progress 
                  value={(timeRemaining / QR_VALIDITY_SECONDS) * 100} 
                  className="h-2 bg-white/10"
                />
              </div>
            </FloatingCard>

            {/* Simulate QR verification button for testing */}
            <div className="space-y-3">
              <GlassButton variant="primary" onClick={handleQRVerified} className="w-full">
                {t('mark.simulateQR')}
              </GlassButton>
              <GlassButton variant="secondary" onClick={handleReset} className="w-full">
                {t('mark.cancel')}
              </GlassButton>
            </div>
          </div>
        )}

        {/* Step: QR Verified - Auto Redirect */}
        {step === 'qr-verified' && (
          <div className="space-y-6 animate-scale-in max-w-lg mx-auto">
            <FloatingCard glowColor="rgba(34, 197, 94, 0.3)">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle size={40} className="text-green-400" />
                </div>
                <h2 className="text-xl font-bold font-display text-green-400">{t('mark.qrVerified')}</h2>
                <p className="text-teal-100/70">
                  {t('mark.qrSuccess')} <strong className="text-white">{studentName}</strong>
                </p>
              </div>
            </FloatingCard>

            <FloatingCard glowColor="rgba(168, 85, 247, 0.2)">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center">
                  <ScanFace size={32} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">{t('mark.faceStep')}</h3>
                  <p className="text-teal-100/70 mb-4">
                    {t('mark.redirecting')}
                  </p>
                  <div className="text-4xl font-mono font-bold text-purple-300">
                    {redirectCountdown}
                  </div>
                  <p className="text-sm text-teal-200/60 mt-2">{t('mark.seconds')}</p>
                </div>
                <GlassButton variant="primary" onClick={() => setStep('face-capture')} className="w-full">
                  {t('mark.startFaceNow')}
                </GlassButton>
              </div>
            </FloatingCard>
          </div>
        )}

        {/* Step: Success (Face Recognition) */}
        {step === 'success' && (
          <div className="animate-scale-in max-w-lg mx-auto space-y-4">
            <FloatingCard glowColor="rgba(34, 197, 94, 0.3)">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle size={40} className="text-green-400" />
                </div>
                <h2 className="text-xl font-bold font-display text-green-400">{t('mark.success')}</h2>
                <p className="text-teal-100/70">
                  {t('mark.recorded')} <strong className="text-white">{studentName}</strong> ({studentId.toUpperCase()}).
                </p>

                {/* Sync confirmation */}
                <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-xl p-4 text-sm space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle size={16} />
                    <span className="font-medium">{t('mark.synced')}</span>
                  </div>
                  <p className="text-teal-200/60 text-xs">
                    {t('mark.syncDesc')}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <GlassButton to="/student" variant="primary" className="w-full">
                  <User size={16} className="mr-2" />
                  {t('mark.viewStudent')}
                </GlassButton>
                <GlassButton to="/admin" variant="secondary" className="w-full">
                  {t('mark.viewAdmin')}
                </GlassButton>
                <button 
                  onClick={handleReset}
                  className="w-full text-teal-300/70 hover:text-teal-300 transition-colors text-sm"
                >
                  {t('mark.markAnother')}
                </button>
              </div>
            </FloatingCard>
          </div>
        )}

        {/* Step: Error - Face Not Verified */}
        {step === 'error' && (
          <div className="animate-scale-in max-w-lg mx-auto">
            <FloatingCard glowColor="rgba(239, 68, 68, 0.3)">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                  <ScanFace size={40} className="text-red-400" />
                </div>
                <h2 className="text-xl font-bold font-display text-red-400">{t('mark.faceNotVerified')}</h2>
                <p className="text-teal-100/70">
                  {error || 'Face verification failed. No matching face photo found for your student ID.'}
                </p>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-300">
                  <p className="font-medium mb-2">{t('mark.possibleReasons')}</p>
                  <ul className="text-left space-y-1 text-xs">
                    <li>• {t('mark.reason1')}</li>
                    <li>• {t('mark.reason2')}</li>
                    <li>• {t('mark.reason3')}</li>
                    <li>• {t('mark.reason4')}</li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <GlassButton variant="primary" onClick={handleReset} className="w-full">
                  {t('mark.tryAgain')}
                </GlassButton>
                <GlassButton to="/" variant="secondary" className="w-full">
                  {t('mark.backHome')}
                </GlassButton>
              </div>
            </FloatingCard>
          </div>
        )}

        {/* Step: Already Marked */}
        {step === 'already-marked' && (
          <div className="animate-scale-in max-w-lg mx-auto">
            <FloatingCard glowColor="rgba(34, 197, 94, 0.3)">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle size={40} className="text-green-400" />
                </div>
                <h2 className="text-xl font-bold font-display text-green-400">{t('mark.alreadyRecorded')}</h2>
                <p className="text-teal-100/70">
                  <strong className="text-white">{studentName}</strong> {t('mark.alreadyMsg')}
                </p>
              </div>

              <div className="mt-8 space-y-3">
                <GlassButton to="/student" variant="secondary" className="w-full">
                  {t('home.viewAttendance')}
                </GlassButton>
                <button 
                  onClick={handleReset}
                  className="w-full text-teal-300/70 hover:text-teal-300 transition-colors text-sm"
                >
                  {t('mark.useDifferentId')}
                </button>
              </div>
            </FloatingCard>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default MarkAttendance;
