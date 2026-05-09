import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClubProvider } from './contexts/ClubContext';
import Navbar from './components/Navbar';
import PublicNavbar from './components/PublicNavbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Matches from './pages/Matches';
import TeamSelection from './pages/TeamSelection';
import Announcements from './pages/Announcements';
import Budget from './pages/Budget';
import UsersPage from './pages/Users';
import Profile from './pages/Profile';
import AdminSettings from './pages/AdminSettings';
import About from './pages/public/About';
import PublicMatches from './pages/public/PublicMatches';
import PublicMembers from './pages/public/PublicMembers';

function ProtectedRoute({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
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

// Public pages — accessible without login, but with the public navbar
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
      <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Protected */}
      <Route path="/dashboard"     element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/matches"       element={<ProtectedRoute><Matches /></ProtectedRoute>} />
      <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
      <Route path="/profile"         element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><AdminSettings /></ProtectedRoute>} />
      <Route path="/team-selection" element={<ProtectedRoute roles={['selector','admin']}><TeamSelection /></ProtectedRoute>} />
      <Route path="/budget"  element={<ProtectedRoute roles={['manager','admin']}><Budget /></ProtectedRoute>} />
      <Route path="/users"   element={<ProtectedRoute roles={['admin','manager','selector']}><UsersPage /></ProtectedRoute>} />

      {/* Public — no login required */}
      <Route path="/public/about"   element={<PublicPageRoute><About /></PublicPageRoute>} />
      <Route path="/public/matches" element={<PublicPageRoute><PublicMatches /></PublicPageRoute>} />
      <Route path="/public/members" element={<PublicPageRoute><PublicMembers /></PublicPageRoute>} />

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/public/about" replace />} />
      <Route path="*" element={<Navigate to="/public/about" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ClubProvider>
          <AppRoutes />
        </ClubProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
