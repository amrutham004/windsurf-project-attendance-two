/**
 * Index.tsx - 3D Landing Page
 * 
 * Features:
 * - Interactive 3D background scene
 * - Floating glass cards with 3D tilt
 * - Glassmorphism UI elements
 * - Animated content transitions
 */

import { Link } from 'react-router-dom';
import Header from '@/components/attendance/Header';
import Footer from '@/components/attendance/Footer';
import Scene3D from '@/components/3d/Scene3D';
import FloatingCard from '@/components/3d/FloatingCard';
import GlassButton from '@/components/3d/GlassButton';
import { ClipboardCheck, LayoutDashboard, Users, Clock, Sparkles } from 'lucide-react';
import { CUTOFF_TIME } from '@/lib/attendanceData';
import { useTranslation } from '@/lib/i18n';

const Index = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-teal-800 to-emerald-900 text-white overflow-hidden">
      {/* 3D Background Scene */}
      <Scene3D />
      
      {/* Header with glass effect */}
      <Header />
      
      <main className="container relative z-10 py-8 md:py-12">
        {/* Hero Section with 3D styling */}
        <div className="text-center mb-10 md:mb-16 animate-fade-in">
          {/* Glowing Logo Container */}
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-teal-500/30 blur-3xl rounded-full animate-pulse" />
            <div className="relative w-24 h-24 md:w-32 md:h-32 mx-auto rounded-full bg-gradient-to-br from-green-400 via-teal-500 to-blue-500 p-1 shadow-2xl shadow-teal-500/50">
              <div className="w-full h-full rounded-full bg-blue-900 flex items-center justify-center">
                <Sparkles className="w-12 h-12 md:w-16 md:h-16 text-teal-400" />
              </div>
            </div>
          </div>
          
          <p className="text-xl md:text-2xl text-teal-100/80 mb-3 font-light">
            {t('home.subtitle')}
          </p>
          <p className="text-sm text-teal-200/60 flex items-center justify-center gap-2">
            <Clock size={14} />
            {t('home.cutoff')}
          </p>
        </div>

        {/* Main CTA with 3D glass button */}
        <div className="flex justify-center mb-16">
          <GlassButton to="/mark-attendance" size="large">
            <ClipboardCheck size={24} />
            {t('home.markAttendance')}
          </GlassButton>
        </div>

        {/* Quick Access Cards with 3D hover effect */}
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto mb-16">
          <FloatingCard glowColor="rgba(45, 212, 191, 0.3)">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-teal-500/20 border border-teal-500/30">
                <LayoutDashboard size={28} className="text-teal-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold font-display mb-2 text-white">
                  {t('home.adminTitle')}
                </h2>
                <p className="text-sm text-teal-100/70 mb-4">
                  {t('home.adminDesc')}
                </p>
                <GlassButton to="/admin" variant="secondary">
                  {t('home.openDashboard')}
                </GlassButton>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard glowColor="rgba(59, 130, 246, 0.3)">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-blue-500/30">
                <Users size={28} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold font-display mb-2 text-white">
                  {t('home.studentTitle')}
                </h2>
                <p className="text-sm text-blue-100/70 mb-4">
                  {t('home.studentDesc')}
                </p>
                <GlassButton to="/student" variant="secondary">
                  {t('home.viewAttendance')}
                </GlassButton>
              </div>
            </div>
          </FloatingCard>
        </div>

        {/* How It Works - 3D Steps */}
        <div className="text-center">
          <h2 className="text-2xl font-semibold font-display mb-8 text-teal-100">
            {t('home.howItWorks')}
          </h2>
          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { num: 1, title: t('home.step1Title'), desc: t('home.step1Desc') },
              { num: 2, title: t('home.step2Title'), desc: t('home.step2Desc') },
              { num: 3, title: t('home.step3Title'), desc: t('home.step3Desc') },
            ].map((step) => (
              <div 
                key={step.num}
                className="
                  relative p-6 
                  bg-white/5 backdrop-blur-sm
                  border border-white/10 
                  rounded-2xl
                  transition-all duration-300
                  hover:bg-white/10 hover:border-white/20
                  hover:-translate-y-2
                  group
                "
              >
                {/* Step number with glow */}
                <div className="
                  w-14 h-14 mx-auto mb-4
                  rounded-full 
                  bg-gradient-to-br from-green-500 via-teal-500 to-blue-500
                  flex items-center justify-center 
                  font-bold font-display text-xl text-white
                  shadow-lg shadow-teal-500/30
                  group-hover:shadow-teal-500/50
                  transition-shadow duration-300
                ">
                  {step.num}
                </div>
                <h3 className="font-semibold text-lg mb-2 text-white">{step.title}</h3>
                <p className="text-sm text-teal-100/60">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
