import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { clearAuthUser, getAuthUser } from '@/lib/auth';

const LogoutButton = () => {
  const navigate = useNavigate();
  const user = getAuthUser();

  const handleLogout = () => {
    // Clear authentication session
    clearAuthUser();
    
    // Redirect to login page
    navigate('/login', { replace: true });
  };

  // Don't render if not authenticated
  if (!user) return null;

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-lg text-red-200 hover:text-red-100 transition-all duration-200"
      title="Logout"
    >
      <LogOut size={18} />
      <span className="text-sm font-medium">Logout</span>
    </button>
  );
};

export default LogoutButton;
