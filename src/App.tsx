/**
 * App.tsx - Main Application Component
 * 
 * This is the root component that sets up:
 * - React Query for data management
 * - Toast notifications for user feedback
 * - All application routes
 */

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/lib/i18n";

// Import existing pages
import Index from "./pages/Index";
import MarkAttendance from "./pages/MarkAttendance";
import TeacherQRDisplay from "./pages/TeacherQRDisplay";
import VerifyAttendance from "./pages/VerifyAttendance";
import StudentFaceCapture from "./pages/StudentFaceCapture";
import AdminDashboard from "./pages/AdminDashboard";
import FaceEnrollment from "./pages/FaceEnrollment";
import StudentDashboard from "./pages/StudentDashboard";
import NotFound from "./pages/NotFound";

// Import authentication components
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

// Create a React Query client for data fetching/caching
const queryClient = new QueryClient();

const App = () => (
  <I18nProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* Toast notifications */}
      <Toaster />
      <Sonner />
      
      <BrowserRouter>
        <Routes>
          {/* Public route - Login page */}
          <Route path="/login" element={<Login />} />

          {/* Student routes - protected, only accessible by students */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <Index />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/home" 
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <Index />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/mark-attendance" 
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <MarkAttendance />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/student" 
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Student-side attendance flow (scanned from phone) - student only */}
          <Route 
            path="/verify-attendance" 
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <VerifyAttendance />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/face-capture" 
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentFaceCapture />
              </ProtectedRoute>
            } 
          />

          {/* Admin/Teacher routes - protected, only accessible by admin */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/face-enrollment" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <FaceEnrollment />
              </ProtectedRoute>
            } 
          />

          {/* 404 page for unknown routes */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </I18nProvider>
);

export default App;
