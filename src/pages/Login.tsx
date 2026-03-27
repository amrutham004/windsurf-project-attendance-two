import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Scene3D from '@/components/3d/Scene3D';
import FloatingCard from '@/components/3d/FloatingCard';
import { Input } from '@/components/ui/input';
import { LogIn, User, Lock } from 'lucide-react';
import { validateLogin, saveAuthUser, getAuthUser, getDefaultRedirectPath } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import LanguageSelector from '@/components/LanguageSelector';

const Login = () => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Check if already logged in
  useEffect(() => {
    const user = getAuthUser();
    if (user) {
      const redirectPath = getDefaultRedirectPath(user.role);
      navigate(redirectPath, { replace: true });
    }
  }, [navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate credentials
    const user = validateLogin(username, password);

    if (!user) {
      setError('Invalid username or password');
      setLoading(false);
      return;
    }

    // Save user session
    saveAuthUser(user);

    // Check if there's a stored redirect URL (e.g., from QR verification)
    const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
    
    if (redirectUrl) {
      // Clear the stored URL
      sessionStorage.removeItem('redirectAfterLogin');
      // Redirect to the original URL (preserves query params like QR token)
      navigate(redirectUrl, { replace: true });
    } else {
      // No stored URL - use default role-based redirect
      const redirectPath = getDefaultRedirectPath(user.role);
      navigate(redirectPath, { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-900 via-teal-800 to-emerald-900 text-white overflow-hidden">
      <Scene3D />
      
      <main className="container relative z-10 flex-1 flex items-center justify-center py-8 px-4">
        <FloatingCard className="w-full max-w-md bg-teal-800/40 backdrop-blur-md border border-teal-600/30">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-teal-500/30 flex items-center justify-center mx-auto mb-4">
              <LogIn size={40} className="text-teal-200" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{t('login.title')}</h1>
            <p className="text-teal-200/70">{t('home.subtitle')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username Input */}
            <div>
              <label className="block text-sm font-medium text-teal-200/90 mb-2">
                {t('login.username')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-teal-300/50" />
                </div>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="pl-10 bg-teal-900/30 border-teal-600/30 text-white placeholder:text-teal-300/30 focus:border-teal-400 focus:ring-teal-400"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-teal-200/90 mb-2">
                {t('login.password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-teal-300/50" />
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pl-10 bg-teal-900/30 border-teal-600/30 text-white placeholder:text-teal-300/30 focus:border-teal-400 focus:ring-teal-400"
                  required
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-red-200 text-sm">
                {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8 pt-6 border-t border-teal-600/30">
            <p className="text-teal-200/50 text-xs text-center mb-3">Demo Credentials:</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-teal-900/20 rounded-lg p-3 border border-teal-600/20">
                <p className="text-teal-300 font-semibold mb-1">Student</p>
                <p className="text-teal-200/60">student / student123</p>
              </div>
              <div className="bg-teal-900/20 rounded-lg p-3 border border-teal-600/20">
                <p className="text-teal-300 font-semibold mb-1">Admin</p>
                <p className="text-teal-200/60">admin / admin123</p>
              </div>
            </div>
          </div>
        </FloatingCard>
      </main>

      <footer className="relative z-10 py-4 text-center text-teal-200/50 text-sm flex items-center justify-center gap-4">
        <p>&copy; 2026 AttendaGo. {t('footer.rights')}</p>
        <LanguageSelector dropUp />
      </footer>
    </div>
  );
};

export default Login;
