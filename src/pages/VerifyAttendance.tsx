/**
 * VerifyAttendance.tsx - Student Attendance Verification Page
 * 
 * This page is accessed when a student scans the QR code with their phone camera.
 * It:
 * 1. Validates the token from URL
 * 2. Records attendance automatically
 * 3. Shows confirmation message
 * 4. Redirects to face capture after 2-3 seconds
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Header from '@/components/attendance/Header';
import Footer from '@/components/attendance/Footer';
import Scene3D from '@/components/3d/Scene3D';
import FloatingCard from '@/components/3d/FloatingCard';
import { validateStudentQR, getStudentById } from '@/lib/attendanceData';
import { CheckCircle, XCircle, Clock, AlertCircle, Camera, Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

type Step = 'validating' | 'success' | 'error';

const VerifyAttendance = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qrData = searchParams.get('qr');
  
  const [step, setStep] = useState<Step>('validating');
  const [message, setMessage] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [errorType, setErrorType] = useState<'expired' | 'used' | 'invalid' | 'already'>('invalid');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!qrData) {
      setStep('error');
      setMessage('No QR code data found. Please scan a valid QR code.');
      setErrorType('invalid');
      return;
    }

    // Validate QR code data directly
    const result = validateStudentQR(qrData);
    
    if (result.valid && result.studentId) {
      // Look up student info
      const student = getStudentById(result.studentId);
      
      if (student) {
        setStep('success');
        setMessage('QR code verified. Proceeding to face verification...');
        setStudentName(student.name);
        setStudentId(result.studentId);
      } else {
        setStep('error');
        setMessage('Student not found in the system.');
        setErrorType('invalid');
      }
    } else {
      // QR validation failed
      setStep('error');
      setMessage(result.error || 'Invalid QR code');
      if (result.expired) {
        setErrorType('expired');
      } else {
        setErrorType('invalid');
      }
    }
  }, [qrData]);

  // Countdown and redirect for success
  useEffect(() => {
    if (step !== 'success') return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Redirect to face capture
          navigate(`/face-capture?roll_no=${studentId}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, navigate, studentId]);

  const getErrorIcon = () => {
    switch (errorType) {
      case 'expired':
        return <Clock size={40} className="text-yellow-400" />;
      case 'used':
      case 'already':
        return <AlertCircle size={40} className="text-yellow-400" />;
      default:
        return <XCircle size={40} className="text-red-400" />;
    }
  };

  const getErrorTitle = () => {
    switch (errorType) {
      case 'expired':
        return t('verify.qrExpired');
      case 'used':
        return t('verify.alreadyUsed');
      case 'already':
        return t('verify.alreadyRecorded');
      default:
        return t('verify.invalidQR');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      <Scene3D />
      <Header />

      <main className="container relative z-10 py-8 max-w-4xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 items-start min-h-[70vh]">
          
          {/* Left Column - QR Code Section */}
          <div className="flex flex-col items-center justify-center">
            <FloatingCard className="w-full max-w-md">
              <div className="text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-cyan-500/20 flex items-center justify-center">
                  {step === 'validating' ? (
                    <Loader2 size={32} className="text-cyan-400 animate-spin" />
                  ) : step === 'success' ? (
                    <CheckCircle size={32} className="text-green-400" />
                  ) : (
                    getErrorIcon()
                  )}
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold font-display text-white">
                    {step === 'validating' && t('verify.verifying')}
                    {step === 'success' && t('verify.verified')}
                    {step === 'error' && getErrorTitle()}
                  </h2>
                  
                  <p className="text-cyan-100/80 text-sm">
                    {step === 'validating' && t('verify.pleaseWait')}
                    {step === 'success' && t('verify.validatedMsg')}
                    {step === 'error' && message}
                  </p>
                </div>

                {/* Student Info */}
                {studentName && (
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="space-y-1">
                      <p className="text-sm text-cyan-100/60">{t('verify.studentDetails')}</p>
                      <p className="text-lg font-semibold text-white">{studentName}</p>
                      <p className="text-sm font-mono text-cyan-300">{studentId}</p>
                    </div>
                  </div>
                )}
              </div>
            </FloatingCard>
          </div>

          {/* Right Column - Face Verification Section */}
          <div className="flex flex-col items-center justify-center">
            {step === 'success' && (
              <FloatingCard glowColor="rgba(34, 211, 238, 0.2)" className="w-full max-w-md">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <Camera size={32} className="text-cyan-400" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white">{t('verify.faceRequired')}</h3>
                    <p className="text-cyan-100/80 text-sm">
                      {t('verify.faceCompleteMsg')}
                    </p>
                  </div>

                  {/* Countdown Timer */}
                  <div className="bg-cyan-500/10 rounded-lg p-4 border border-cyan-500/20">
                    <div className="space-y-1">
                      <p className="text-sm text-cyan-100/60">{t('verify.autoRedirect')}</p>
                      <div className="text-3xl font-mono font-bold text-cyan-300">
                        {countdown}
                      </div>
                      <p className="text-xs text-cyan-100/60">{t('mark.seconds')}</p>
                    </div>
                  </div>

                  {/* Manual Redirect Button */}
                  <button
                    onClick={() => navigate(`/face-capture?roll_no=${studentId}`)}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <Camera size={20} />
                    {t('verify.startFace')}
                  </button>
                </div>
              </FloatingCard>
            )}

            {step === 'validating' && (
              <FloatingCard className="w-full max-w-md opacity-60">
                <div className="text-center space-y-4 py-8">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gray-500/20 flex items-center justify-center">
                    <Camera size={32} className="text-gray-400" />
                  </div>
                  <p className="text-gray-400 text-sm">{t('verify.faceAvailableAfter')}</p>
                </div>
              </FloatingCard>
            )}

            {step === 'error' && (
              <FloatingCard glowColor="rgba(239, 68, 68, 0.2)" className="w-full max-w-md">
                <div className="text-center space-y-4 py-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                    <XCircle size={32} className="text-red-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-red-400">{t('verify.failed')}</h3>
                    <p className="text-cyan-100/80 text-sm">
                      {t('verify.contactTeacher')}
                    </p>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
                  >
                    {t('mark.tryAgain')}
                  </button>
                </div>
              </FloatingCard>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default VerifyAttendance;
