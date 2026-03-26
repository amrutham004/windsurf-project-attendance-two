/**

 * StudentFaceCapture.tsx - Student Face Capture Page

 * 

 * Standalone page for students to capture their face photo

 * after their attendance has been recorded.

 * 

 * Accessed via: /face-capture?roll_no=STU001

 */



import { useState, useRef, useCallback, useEffect } from 'react';

import { useSearchParams, useNavigate } from 'react-router-dom';

import Header from '@/components/attendance/Header';

import Footer from '@/components/attendance/Footer';

import Scene3D from '@/components/3d/Scene3D';

import FloatingCard from '@/components/3d/FloatingCard';

import GlassButton from '@/components/3d/GlassButton';

import { getStudentById, saveFaceCapture, getFaceCapture } from '@/lib/attendanceData';
import { markAttendance, getStudentAttendance } from '@/lib/api';

import { Camera, X, RotateCcw, Check, AlertCircle, CheckCircle, User } from 'lucide-react';



type Step = 'checking' | 'capture' | 'preview' | 'success' | 'error';



const StudentFaceCapture = () => {

  const [searchParams] = useSearchParams();

  const navigate = useNavigate();

  const rollNo = searchParams.get('roll_no');

  

  const [step, setStep] = useState<Step>('checking');

  const [studentName, setStudentName] = useState('');

  const [error, setError] = useState('');

  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);

  

  const videoRef = useRef<HTMLVideoElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const streamRef = useRef<MediaStream | null>(null);



  // Check if student can capture face

  useEffect(() => {

    if (!rollNo) {

      setError('No student ID provided');

      setStep('error');

      return;

    }



    const student = getStudentById(rollNo);

    if (!student) {

      setError('Student not found');

      setStep('error');

      return;

    }



    setStudentName(student.name);

    // Check if face already captured locally today
    const today = new Date().toISOString().split('T')[0];
    const existingCapture = getFaceCapture(rollNo, today);
    if (existingCapture) {
      setStep('success');
      setCapturedImage(existingCapture);
      return;
    }

    // Check if attendance already marked today on backend
    const checkBackend = async () => {
      try {
        const records = await getStudentAttendance(rollNo, today, today);
        if (records && records.length > 0) {
          setStep('success');
          return;
        }
      } catch (err) {
        // If check fails, proceed to capture anyway
      }
      // Start camera for face capture
      setStep('capture');
      startCamera();
    };
    checkBackend();

  }, [rollNo]);



  const startCamera = useCallback(async () => {

    try {

      setError('');

      

      const stream = await navigator.mediaDevices.getUserMedia({

        video: {

          facingMode: 'user',

          width: { ideal: 640 },

          height: { ideal: 480 }

        }

      });

      

      streamRef.current = stream;

      

      if (videoRef.current) {

        videoRef.current.srcObject = stream;

        setIsStreaming(true);

      }

    } catch (err) {

      console.error('Camera access error:', err);

      setError('Unable to access camera. Please grant camera permissions.');

    }

  }, []);



  const stopCamera = useCallback(() => {

    if (streamRef.current) {

      streamRef.current.getTracks().forEach(track => track.stop());

      streamRef.current = null;

    }

    setIsStreaming(false);

  }, []);



  const capturePhoto = useCallback(() => {

    if (!videoRef.current || !canvasRef.current) return;



    const video = videoRef.current;

    const canvas = canvasRef.current;

    const context = canvas.getContext('2d');

    

    if (!context) return;



    canvas.width = video.videoWidth;

    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    

    const imageData = canvas.toDataURL('image/jpeg', 0.8);

    setCapturedImage(imageData);

    setStep('preview');

    stopCamera();

  }, [stopCamera]);



  const retakePhoto = useCallback(() => {

    setCapturedImage(null);

    setStep('capture');

    startCamera();

  }, [startCamera]);



  const confirmCapture = useCallback(async () => {
    if (!capturedImage || !rollNo) return;

    const student = getStudentById(rollNo);
    if (!student) {
      setError('Student not found');
      setStep('error');
      return;
    }

    setStep('checking');
    setError('');

    try {
      // Call real backend API to verify face and mark attendance
      const result = await markAttendance(student.id, student.name, capturedImage);
      
      if (result.success && result.verified) {
        // Save face capture locally
        const today = new Date().toISOString().split('T')[0];
        saveFaceCapture(rollNo, today, capturedImage);
        
        setStep('success');
      } else {
        setError(result.message || 'Face verification failed.');
        setStep('error');
      }
    } catch (error) {
      console.error('Face verification failed:', error);
      setError('Face verification failed. Please try again.');
      setStep('error');
    }
  }, [capturedImage, rollNo]);



  // Cleanup camera on unmount

  useEffect(() => {

    return () => {

      stopCamera();

    };

  }, [stopCamera]);



  return (

    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">

      <Scene3D />

      <Header />



      <main className="container relative z-10 py-8 max-w-lg">

        {/* Page Header */}

        <div className="text-center mb-6">

          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center">

            <Camera size={32} className="text-cyan-400" />

          </div>

          <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent mb-2">

            Face Verification

          </h1>

          {studentName && (

            <p className="text-cyan-100/70">

              {rollNo} – {studentName}

            </p>

          )}

        </div>



        {/* Checking State */}
        {step === 'checking' && (
          <FloatingCard>
            <div className="text-center py-8">
              <div className="animate-pulse text-cyan-400 font-medium mb-2">
                Verifying face...
              </div>
              <p className="text-sm text-cyan-100/70">
                Please wait while we verify your face and mark attendance
              </p>
            </div>
          </FloatingCard>
        )}



        {/* Capture State */}

        {step === 'capture' && (

          <div className="space-y-6 animate-fade-in">

            <FloatingCard>

              <div className="space-y-4">

                {/* Camera View */}

                <div className="aspect-[4/3] bg-black rounded-xl overflow-hidden relative">

                  <video

                    ref={videoRef}

                    autoPlay

                    playsInline

                    muted

                    className="w-full h-full object-cover"

                  />

                  

                  {/* Face guide overlay */}

                  {isStreaming && (

                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

                      <div className="w-40 h-48 border-2 border-cyan-400/50 rounded-full shadow-lg shadow-cyan-500/20" />

                    </div>

                  )}

                </div>



                {error && (

                  <p className="text-sm text-red-400 text-center">{error}</p>

                )}



                {/* Capture Button */}

                <GlassButton 

                  onClick={capturePhoto} 

                  disabled={!isStreaming}

                  className="w-full"

                  variant="primary"

                >

                  <Camera size={18} />

                  Capture Face

                </GlassButton>

              </div>

            </FloatingCard>



            {/* Instructions */}

            <FloatingCard glowColor="rgba(168, 85, 247, 0.2)">

              <div className="flex items-start gap-3">

                <User size={20} className="text-purple-400 flex-shrink-0 mt-0.5" />

                <div>

                  <p className="font-medium text-sm text-white">Position Your Face</p>

                  <p className="text-sm text-purple-100/70 mt-1">

                    Center your face within the oval guide and ensure good lighting.

                  </p>

                </div>

              </div>

            </FloatingCard>

          </div>

        )}



        {/* Preview State */}

        {step === 'preview' && capturedImage && (

          <div className="space-y-6 animate-fade-in">

            <FloatingCard>

              <div className="space-y-4">

                {/* Captured Image */}

                <div className="aspect-[4/3] rounded-xl overflow-hidden">

                  <img

                    src={capturedImage}

                    alt="Captured face"

                    className="w-full h-full object-cover"

                  />

                </div>



                {/* Action Buttons */}

                <div className="flex gap-3">

                  <GlassButton

                    variant="secondary"

                    onClick={retakePhoto}

                    className="flex-1"

                  >

                    <RotateCcw size={18} />

                    Retake

                  </GlassButton>

                  

                  <GlassButton

                    variant="primary"

                    onClick={confirmCapture}

                    className="flex-1"

                  >

                    <Check size={18} />

                    Confirm

                  </GlassButton>

                </div>

              </div>

            </FloatingCard>

          </div>

        )}



        {/* Success State */}

        {step === 'success' && (

          <div className="animate-scale-in">

            <FloatingCard glowColor="rgba(34, 197, 94, 0.3)">

              <div className="text-center space-y-4 py-4">

                <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">

                  <CheckCircle size={40} className="text-green-400" />

                </div>

                

                <h2 className="text-xl font-bold font-display text-green-400">

                  Verification Complete!

                </h2>

                

                <p className="text-cyan-100/70">

                  Your attendance and face photo have been recorded successfully.

                </p>



                {capturedImage && (

                  <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-green-500/30">

                    <img

                      src={capturedImage}

                      alt="Your face"

                      className="w-full h-full object-cover"

                    />

                  </div>

                )}



                <div className="pt-4">

                  <GlassButton to="/" variant="secondary" className="w-full">

                    Return to Home

                  </GlassButton>

                </div>

              </div>

            </FloatingCard>

          </div>

        )}



        {/* Error State */}

        {step === 'error' && (

          <div className="animate-scale-in">

            <FloatingCard glowColor="rgba(239, 68, 68, 0.3)">

              <div className="text-center space-y-4 py-4">

                <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">

                  <AlertCircle size={40} className="text-red-400" />

                </div>

                

                <h2 className="text-xl font-bold font-display text-red-400">

                  Cannot Capture Face

                </h2>

                

                <p className="text-cyan-100/70">{error}</p>



                <div className="pt-4">

                  <GlassButton to="/" variant="secondary" className="w-full">

                    Return to Home

                  </GlassButton>

                </div>

              </div>

            </FloatingCard>

          </div>

        )}



        {/* Hidden canvas for capture */}

        <canvas ref={canvasRef} className="hidden" />

      </main>



      <Footer />

    </div>

  );

};



export default StudentFaceCapture;

