/**
 * Header.tsx - Navigation Header Component
 * 
 * Displays the app header with:
 * - School logo and name
 * - Navigation links for all pages
 * - Mobile-responsive hamburger menu
 * 
 * No authentication - all routes are accessible to everyone
 */

import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, ClipboardCheck, LayoutDashboard, User, Menu, X } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { useState } from 'react';
import { getAuthUser } from '@/lib/auth';
import LogoutButton from '@/components/LogoutButton';
import LanguageSelector from '@/components/LanguageSelector';
import { useTranslation } from '@/lib/i18n';

const Header = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = getAuthUser();
  const { t } = useTranslation();

  // Navigation links based on user role
  const getNavLinks = () => {
    if (!user) return [];
    
    if (user.role === 'student') {
      return [{
        to: '/home',
        label: t('nav.home'),
        icon: Home
      }, {
        to: '/mark-attendance',
        label: t('nav.markAttendance'),
        icon: ClipboardCheck
      }, {
        to: '/student',
        label: t('nav.studentDashboard'),
        icon: User
      }];
    }
    
    if (user.role === 'admin') {
      return [{
        to: '/admin',
        label: t('nav.adminDashboard'),
        icon: LayoutDashboard
      }];
    }
    
    return [];
  };

  const navLinks = getNavLinks();

  // Check if a nav link is currently active
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <header className="sticky top-0 z-50 w-full bg-blue-900/80 backdrop-blur-xl border-b border-white/10">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo and School Name */}
        <Link to="/" className="flex items-center gap-3 group">
          <img 
            src={logoImg} 
            alt="AttendaGo Logo" 
            className="w-10 h-10 rounded-full shadow-lg shadow-teal-500/30 group-hover:shadow-teal-500/50 transition-shadow object-cover"
          />
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold font-display bg-gradient-to-r from-green-300 via-teal-300 to-blue-300 bg-clip-text text-transparent">
              AttendaGo
            </h1>
          </div>
        </Link>

        {/* Desktop Navigation - hidden on mobile */}
        <nav className="hidden md:flex items-center gap-2">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Button 
              key={to} 
              variant="ghost" 
              size="sm" 
              asChild
              className={`
                text-teal-100/70 hover:text-white hover:bg-white/10
                ${isActive(to) ? 'bg-white/10 text-white' : ''}
              `}
            >
              <Link to={to} className="flex items-center gap-2">
                <Icon size={16} />
                {label}
              </Link>
            </Button>
          ))}
          <LanguageSelector />
          <LogoutButton />
        </nav>

        {/* Mobile Menu Toggle Button */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden text-teal-100 hover:text-white hover:bg-white/10" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <nav className="md:hidden border-t border-white/10 bg-blue-900/95 backdrop-blur-xl animate-fade-in">
          <div className="container py-3 space-y-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Button 
                key={to} 
                variant="ghost" 
                className={`
                  w-full justify-start text-teal-100/70 hover:text-white hover:bg-white/10
                  ${isActive(to) ? 'bg-white/10 text-white' : ''}
                `}
                asChild 
                onClick={() => setMobileMenuOpen(false)}
              >
                <Link to={to} className="flex items-center gap-2">
                  <Icon size={18} />
                  {label}
                </Link>
              </Button>
            ))}
            <div className="pt-2 border-t border-white/10 mt-2 flex items-center gap-2">
              <LanguageSelector />
              <LogoutButton />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
};
export default Header;