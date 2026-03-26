# Authentication System Guide

## 🔐 Overview

This Smart Attendance System now includes a **role-based authentication system** with:
- Login page with demo credentials
- Student and Admin roles
- Protected routes based on user role
- Session persistence (survives page refresh)
- Logout functionality
- Automatic redirects

**Important:** All existing attendance functionality remains completely unchanged.

---

## 🎯 Demo Credentials

### Student Login
```
Username: student
Password: student123
Role: student
```

### Admin Login
```
Username: admin
Password: admin123
Role: admin
```

---

## 👤 User Roles & Permissions

### Student Access
Students can access:
- ✅ Home Page (`/home`)
- ✅ Mark Attendance Page (`/mark-attendance`)
- ✅ Student Dashboard (`/student`)
- ✅ Verify Attendance (`/verify-attendance`)
- ✅ Face Capture (`/face-capture`)

Students **cannot** access:
- ❌ Admin Dashboard (`/admin`)
- ❌ Teacher QR Display (`/teacher-qr`)

**Redirect:** If student tries to access admin pages → redirected to `/home`

### Admin Access
Admins can access:
- ✅ Admin Dashboard (`/admin`)

Admins **cannot** access:
- ❌ Home Page
- ❌ Mark Attendance Page
- ❌ Student Dashboard
- ❌ Teacher QR Display (`/teacher-qr`)

**Redirect:** If admin tries to access student pages → redirected to `/admin`

---

## 🔄 Authentication Flow

### 1. First Visit (Not Logged In)
```
User opens any page
    ↓
Not authenticated
    ↓
Redirect to /login
```

### 2. Login Process
```
User enters credentials
    ↓
Validate against demo credentials
    ↓
Save to localStorage as auth_user
    ↓
Redirect based on role:
  - Student → /home
  - Admin → /admin
```

### 3. Page Refresh
```
Page loads
    ↓
Check localStorage for auth_user
    ↓
If found → restore session
    ↓
User stays logged in
```

### 4. Logout
```
User clicks Logout button
    ↓
Clear auth_user from localStorage
    ↓
Redirect to /login
```

---

## 💾 Session Storage

### localStorage Structure
```javascript
// Student session
{
  "auth_user": {
    "username": "student",
    "role": "student"
  }
}

// Admin session
{
  "auth_user": {
    "username": "admin",
    "role": "admin"
  }
}
```

### Session Persistence
- Stored in browser `localStorage`
- Survives page refresh
- Survives browser close/reopen
- Only cleared on logout or manual localStorage clear

---

## 🛡️ Route Protection

### Protected Routes Implementation

All routes are protected using the `ProtectedRoute` component:

```tsx
<Route 
  path="/home" 
  element={
    <ProtectedRoute allowedRoles={['student']}>
      <Index />
    </ProtectedRoute>
  } 
/>
```

### Protection Logic
1. Check if user is authenticated
2. Check if user's role is in `allowedRoles`
3. Check if user can access the specific path
4. If any check fails → redirect appropriately

---

## 🚪 Logout Functionality

### Logout Button Location
- **Desktop:** Top navigation bar (right side)
- **Mobile:** Mobile menu (bottom of menu)

### Logout Process
1. User clicks "Logout" button
2. `clearAuthUser()` removes session from localStorage
3. User redirected to `/login`
4. All attendance data remains intact

**Important:** Logout does NOT affect:
- Attendance records
- Student data
- QR codes
- Face recognition data
- Any other system data

---

## 📱 Navigation Changes

### Student Navigation
Shows only student-accessible pages:
- Home
- Mark Attendance
- Student Dashboard
- Logout button

### Admin Navigation
Shows only admin-accessible pages:
- Admin Dashboard
- Logout button

### Dynamic Navigation
Navigation links change automatically based on logged-in user's role.

---

## 🔒 Security Features

### Input Validation
- Username and password required
- Credentials validated against hardcoded demo values
- Invalid login shows error message

### Route Guards
- All routes protected with `ProtectedRoute` component
- Unauthorized access automatically redirected
- No manual URL manipulation can bypass protection

### Session Management
- Session stored in localStorage
- Automatic session restoration on page load
- Clean logout clears session completely

---

## 📂 New Files Added

### Authentication Utilities
- `src/lib/auth.ts` - Authentication functions and validation

### Components
- `src/pages/Login.tsx` - Login page component
- `src/components/ProtectedRoute.tsx` - Route guard component
- `src/components/LogoutButton.tsx` - Logout button component

### Modified Files
- `src/App.tsx` - Added protected routes
- `src/components/attendance/Header.tsx` - Added role-based navigation and logout button

---

## ✅ Testing Checklist

### Student Login Test
1. Open `/login`
2. Enter: `student` / `student123`
3. Click "Sign In"
4. Should redirect to `/home`
5. Navigation shows: Home, Mark Attendance, Student Dashboard, Logout
6. Can access all student pages
7. Cannot access `/admin` (redirects to `/home`)

### Admin Login Test
1. Open `/login`
2. Enter: `admin` / `admin123`
3. Click "Sign In"
4. Should redirect to `/admin`
5. Navigation shows: Admin Dashboard, Logout
6. Can access admin pages
7. Cannot access `/home` or `/mark-attendance` (redirects to `/admin`)

### Session Persistence Test
1. Login as student
2. Navigate to any student page
3. Refresh browser (F5)
4. Should stay logged in
5. Should stay on same page
6. Session persists

### Logout Test
1. Login as any user
2. Click "Logout" button
3. Should redirect to `/login`
4. Session cleared
5. Cannot access protected pages
6. Must login again

### Unauthorized Access Test
1. Not logged in
2. Try to open `/home` directly
3. Should redirect to `/login`
4. Login as admin
5. Try to open `/home` directly
6. Should redirect to `/admin`

---

## 🎨 UI/UX Notes

### Login Page Design
- Matches existing site theme (blue/teal gradient)
- 3D background scene
- Floating card design
- Shows demo credentials for easy testing
- Clean, modern interface

### Logout Button Design
- Red theme (distinct from navigation)
- Icon + text label
- Hover effects
- Consistent with site design

### Navigation Updates
- Role-based menu items
- No visual changes to existing pages
- Seamless integration with existing design

---

## 🔧 Technical Implementation

### Authentication Functions (`src/lib/auth.ts`)

```typescript
// Validate login credentials
validateLogin(username, password): AuthUser | null

// Save user session
saveAuthUser(user): void

// Get current user
getAuthUser(): AuthUser | null

// Clear session (logout)
clearAuthUser(): void

// Check if authenticated
isAuthenticated(): boolean

// Check user role
hasRole(role): boolean

// Get redirect path for role
getDefaultRedirectPath(role): string

// Check path access permission
canAccessPath(path, role): boolean
```

### Protected Route Component

```tsx
<ProtectedRoute allowedRoles={['student', 'admin']}>
  <YourComponent />
</ProtectedRoute>
```

---

## ⚠️ Important Notes

### What Was NOT Changed
- ✅ Attendance marking functionality
- ✅ QR code generation
- ✅ Face recognition
- ✅ Dashboard statistics
- ✅ CSV export
- ✅ Student data
- ✅ Database operations
- ✅ UI styling
- ✅ Page layouts
- ✅ Existing components

### What WAS Added
- ✅ Login page
- ✅ Authentication utilities
- ✅ Protected routes
- ✅ Logout button
- ✅ Role-based navigation
- ✅ Session persistence

---

## 🚀 Quick Start

1. **Start the application:**
   ```bash
   npm run dev
   ```

2. **Open browser:**
   ```
   https://172.20.10.4:8080
   ```

3. **You'll be redirected to `/login`**

4. **Login as student:**
   - Username: `student`
   - Password: `student123`

5. **Or login as admin:**
   - Username: `admin`
   - Password: `admin123`

6. **Use the system normally** - all attendance features work exactly as before

7. **Logout when done** - click Logout button in navigation

---

## 📊 System Architecture

```
┌─────────────────────────────────────────┐
│          User Opens Any Page            │
└────────────────┬────────────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │ Authenticated? │
         └───────┬───────┘
                 │
        ┌────────┴────────┐
        │                 │
       No                Yes
        │                 │
        ▼                 ▼
  ┌──────────┐    ┌──────────────┐
  │  /login  │    │ Check Role   │
  └──────────┘    └──────┬───────┘
                         │
                ┌────────┴────────┐
                │                 │
            Student            Admin
                │                 │
                ▼                 ▼
        ┌───────────────┐  ┌──────────────┐
        │ Student Pages │  │ Admin Pages  │
        │ - Home        │  │ - Dashboard  │
        │ - Attendance  │  │ - QR Display │
        │ - Dashboard   │  └──────────────┘
        └───────────────┘
```

---

**Status:** ✅ Authentication System Fully Implemented
**Attendance System:** ✅ Completely Unchanged and Functional
