/**
 * FaceRecognitionCapture.tsx - Face Recognition Attendance Component
 * 
 * Captures student face for recognition-based attendance marking.
 * - Accesses front-facing camera
 * - Captures face photo for verification
 * - Simulates face recognition matching
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, RotateCcw, Check, Loader2 } from 'lucide-react';
import FloatingCard from '@/components/3d/FloatingCard';
import GlassButton from '@/components/3d/GlassButton';
import { markAttendance } from '@/lib/api';

interface FaceRecognitionCaptureProps {
  studentId: string;
  studentName: string;
  onSuccess: () => void;
  onCancel: () => void;
  onError?: (errorMessage: string) => void;
}

const FaceRecognitionCapture = ({ 
  studentId, 
  studentName, 
  onSuccess, 
  onCancel,
  onError
}: FaceRecognitionCaptureProps) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'success' | 'failed' | null>(null);
  const [error, setError] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    stopCamera();
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setVerificationResult(null);
    startCamera();
  }, [startCamera]);

  const verifyFace = useCallback(async () => {
    if (!capturedImage) return;

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      // Call backend API for face verification and attendance marking
      const result = await markAttendance(studentId, studentName, capturedImage);

      if (result.success && result.verified) {
        setVerificationResult('success');
        // Wait a moment to show success, then trigger callback
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        setVerificationResult('failed');
        // Call onError if provided
        if (onError) {
          setTimeout(() => {
            onError(result.message || 'Face verification failed. No matching face photo found for your student ID.');
          }, 1500);
        }
      }
    } catch (error) {
      console.error('Face verification error:', error);
      setVerificationResult('failed');
      if (onError) {
        setTimeout(() => {
          onError('Failed to verify face. Please try again.');
        }, 1500);
      }
    } finally {
      setIsVerifying(false);
    }
  }, [capturedImage, studentId, studentName, onSuccess, onError]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h2 className="text-xl font-bold font-display bg-gradient-to-r from-green-300 via-teal-300 to-blue-300 bg-clip-text text-transparent mb-2">
          Face Recognition
        </h2>
        <p className="text-teal-100/70">
          {studentName} ({studentId}) - Look at the camera
        </p>
      </div>

      <FloatingCard>
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 text-red-300 rounded-lg text-center text-sm border border-red-500/30">
            {error}
          </div>
        )}

        {/* Camera Preview / Captured Image */}
        <div className="aspect-[4/3] bg-black/50 rounded-xl overflow-hidden relative mb-4 border border-white/10">
          {/* Live Video */}
          {!capturedImage && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Captured Image */}
          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured face"
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Face Guide Overlay */}
          {!capturedImage && isStreaming && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-40 h-48 border-2 border-teal-400/50 rounded-full" />
            </div>
          )}

          {/* Verification Status Overlay */}
          {isVerifying && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
              <Loader2 size={40} className="text-teal-400 animate-spin mb-2" />
              <p className="text-white text-sm">Verifying face...</p>
            </div>
          )}

          {verificationResult === 'success' && (
            <div className="absolute inset-0 bg-green-900/60 flex flex-col items-center justify-center">
              <Check size={48} className="text-green-400 mb-2" />
              <p className="text-green-300 font-medium">Face Verified!</p>
            </div>
          )}

          {verificationResult === 'failed' && (
            <div className="absolute inset-0 bg-red-900/60 flex flex-col items-center justify-center">
              <X size={48} className="text-red-400 mb-2" />
              <p className="text-red-300 font-medium">Face not recognized</p>
              <p className="text-red-200/70 text-sm mt-1">Please try again</p>
            </div>
          )}
        </div>

        {/* Hidden Canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!capturedImage ? (
            <>
              <GlassButton 
                variant="secondary" 
                onClick={onCancel}
                className="flex-1"
              >
                <X size={18} className="mr-2" />
                Cancel
              </GlassButton>
              
              <GlassButton
                variant="primary"
                onClick={capturePhoto}
                disabled={!isStreaming}
                className="flex-1"
              >
                <Camera size={18} className="mr-2" />
                Capture
              </GlassButton>
            </>
          ) : verificationResult === 'failed' ? (
            <>
              <GlassButton 
                variant="secondary" 
                onClick={onCancel}
                className="flex-1"
              >
                Cancel
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={retakePhoto}
                className="flex-1"
              >
                <RotateCcw size={18} className="mr-2" />
                Retake
              </GlassButton>
            </>
          ) : !isVerifying && !verificationResult ? (
            <>
              <GlassButton
                variant="secondary"
                onClick={retakePhoto}
                className="flex-1"
              >
                <RotateCcw size={18} className="mr-2" />
                Retake
              </GlassButton>
              
              <GlassButton
                variant="primary"
                onClick={verifyFace}
                className="flex-1"
              >
                <Check size={18} className="mr-2" />
                Verify Face
              </GlassButton>
            </>
          ) : null}
        </div>
      </FloatingCard>

      {/* Helper Text */}
      <div className="text-center text-sm text-teal-200/60">
        <p>Position your face within the oval guide for best results.</p>
        <p className="mt-1">Ensure good lighting and remove glasses if possible.</p>
      </div>
    </div>
  );
};

export default FaceRecognitionCapture;
