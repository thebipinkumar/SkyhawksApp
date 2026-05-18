import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClubProvider } from './contexts/ClubContext';
import api from './utils/api';
import Navbar from './components/Navbar';
import PublicNavbar from './components/PublicNavbar';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Matches from './pages/Matches';
import TeamSelection from './pages/TeamSelection';
import Announcements from './pages/Announcements';
import Budget from './pages/Budget';
import UsersPage from './pages/Users';
import Profile from './pages/Profile';
import AdminSettings from './pages/AdminSettings';
import JerseyList from './pages/JerseyList';
import MembershipExpired from './pages/MembershipExpired';
import AdminMemberProfile from './pages/AdminMemberProfile';
import About from './pages/public/About';
import PublicMatches from './pages/public/PublicMatches';
import PublicMembers from './pages/public/PublicMembers';

function ProtectedRoute({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  const userRoles: string[] = user.roles ?? [user.role];
  if (roles && !roles.some(r => userRoles.includes(r))) return <Navigate to="/dashboard" replace />;
  // Block non-admin users with expired membership
  const isAdmin = userRoles.includes('admin');
  if (!isAdmin && user.membership_end && new Date(user.membership_end) < new Date()) {
    return <Navigate to="/membership-expired" replace />;
  }
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}

function PublicRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicPageRoute({ children }: { children: JSX.Element }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />
      {children}
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/login"            element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register"         element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password"  element={<ForgotPassword />} />
      <Route path="/reset-password"   element={<ResetPassword />} />

      {/* Protected — any logged-in user */}
      <Route path="/dashboard"     element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/matches"       element={<ProtectedRoute><Matches /></ProtectedRoute>} />
      <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
      <Route path="/profile"       element={<ProtectedRoute><Profile /></ProtectedRoute>} />

      {/* Protected — role-gated */}
      <Route path="/team-selection" element={<ProtectedRoute roles={['selector','admin']}><TeamSelection /></ProtectedRoute>} />
      <Route path="/budget"         element={<ProtectedRoute roles={['manager','admin']}><Budget /></ProtectedRoute>} />
      <Route path="/users"          element={<ProtectedRoute roles={['admin','manager','selector']}><UsersPage /></ProtectedRoute>} />
      <Route path="/admin/settings"        element={<ProtectedRoute roles={['admin']}><AdminSettings /></ProtectedRoute>} />
      <Route path="/jerseys"               element={<ProtectedRoute roles={['admin','manager','selector','player']}><JerseyList /></ProtectedRoute>} />
      <Route path="/admin/members/:id"     element={<ProtectedRoute roles={['admin']}><AdminMemberProfile /></ProtectedRoute>} />
      <Route path="/membership-expired"    element={<MembershipExpired />} />

      {/* Public */}
      <Route path="/public/about"   element={<PublicPageRoute><About /></PublicPageRoute>} />
      <Route path="/public/matches" element={<PublicPageRoute><PublicMatches /></PublicPageRoute>} />
      <Route path="/public/members" element={<PublicPageRoute><PublicMembers /></PublicPageRoute>} />

      <Route path="/" element={<Navigate to="/public/about" replace />} />
      <Route path="*" element={<Navigate to="/public/about" replace />} />
    </Routes>
  );
}

const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

function KeepAlive() {
  useEffect(() => {
    const ping = () => api.get('/health').catch(() => {});
    const id = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ClubProvider>
          <KeepAlive />
          <AppRoutes />
        </ClubProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
