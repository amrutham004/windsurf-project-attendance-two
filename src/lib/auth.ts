/**
 * Authentication Utility
 * Manages user authentication and session persistence
 */

export type UserRole = 'student' | 'admin';

export interface AuthUser {
  username: string;
  role: UserRole;
}

const AUTH_STORAGE_KEY = 'auth_user';

// Demo credentials (hardcoded for demo purposes)
const DEMO_CREDENTIALS = {
  student: {
    username: 'student',
    password: 'student123',
    role: 'student' as UserRole
  },
  admin: {
    username: 'admin',
    password: 'admin123',
    role: 'admin' as UserRole
  }
};

/**
 * Validate login credentials
 */
export function validateLogin(username: string, password: string): AuthUser | null {
  // Check student credentials
  if (username === DEMO_CREDENTIALS.student.username && 
      password === DEMO_CREDENTIALS.student.password) {
    return {
      username: DEMO_CREDENTIALS.student.username,
      role: DEMO_CREDENTIALS.student.role
    };
  }
  
  // Check admin credentials
  if (username === DEMO_CREDENTIALS.admin.username && 
      password === DEMO_CREDENTIALS.admin.password) {
    return {
      username: DEMO_CREDENTIALS.admin.username,
      role: DEMO_CREDENTIALS.admin.role
    };
  }
  
  return null;
}

/**
 * Save user session to localStorage
 */
export function saveAuthUser(user: AuthUser): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

/**
 * Get current authenticated user from localStorage
 */
export function getAuthUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    
    const user = JSON.parse(stored) as AuthUser;
    
    // Validate the stored data
    if (user.username && user.role && (user.role === 'student' || user.role === 'admin')) {
      return user;
    }
    
    return null;
  } catch (error) {
    console.error('Error reading auth user:', error);
    return null;
  }
}

/**
 * Clear user session (logout)
 */
export function clearAuthUser(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getAuthUser() !== null;
}

/**
 * Check if user has specific role
 */
export function hasRole(role: UserRole): boolean {
  const user = getAuthUser();
  return user?.role === role;
}

/**
 * Get redirect path based on user role
 */
export function getDefaultRedirectPath(role: UserRole): string {
  switch (role) {
    case 'student':
      return '/home';
    case 'admin':
      return '/admin';
    default:
      return '/login';
  }
}

/**
 * Check if user can access a specific path
 */
export function canAccessPath(path: string, userRole: UserRole): boolean {
  // Student allowed paths
  const studentPaths = ['/home', '/mark-attendance', '/student', '/verify-attendance', '/face-capture'];
  
  // Admin allowed paths
  const adminPaths = ['/admin'];
  
  // Normalize path (remove trailing slash)
  const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  
  if (userRole === 'student') {
    return studentPaths.some(allowedPath => normalizedPath.startsWith(allowedPath));
  }
  
  if (userRole === 'admin') {
    return adminPaths.some(allowedPath => normalizedPath.startsWith(allowedPath));
  }
  
  return false;
}
