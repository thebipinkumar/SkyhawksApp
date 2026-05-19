import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import {
  LogOut, Menu, X, Trophy, UserCircle, Home, Settings,
  Calendar, ClipboardList, Megaphone, DollarSign, Users,
  Package, CreditCard, LayoutDashboard,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState, useEffect } from 'react';

interface NavLink {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
}

const navLinks: NavLink[] = [
  { to: '/matches',        label: 'Matches',        icon: Calendar,       roles: ['player', 'manager', 'selector', 'admin'] },
  { to: '/team-selection', label: 'Team Selection',  icon: ClipboardList,  roles: ['selector', 'admin'] },
  { to: '/announcements',  label: 'Announcements',   icon: Megaphone,      roles: ['player', 'manager', 'selector', 'admin'] },
  { to: '/budget',         label: 'Finance',         icon: DollarSign,     roles: ['manager', 'admin'] },
  { to: '/users',          label: 'Members',         icon: Users,          roles: ['admin', 'manager', 'selector'] },
  { to: '/jerseys',        label: 'Merchandise',     icon: Package,        roles: ['admin', 'manager', 'selector', 'player'] },
  { to: '/membership',     label: 'Membership',      icon: CreditCard,     roles: ['admin', 'manager'] },
  { to: '/admin/settings', label: 'Settings',        icon: Settings,       roles: ['admin'] },
];

const roleBadgeClass: Record<string, string> = {
  player: 'badge-player', manager: 'badge-manager',
  selector: 'badge-selector', admin: 'badge-admin',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const { club } = useClub();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/public/about'); };

  const userRoles: string[] = user?.roles ?? (user?.role ? [user.role] : []);
  const filteredLinks = navLinks.filter(l => l.roles.some(r => userRoles.includes(r)));

  // Close drawer on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Prevent body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const Logo = () => club?.logo_url
    ? <img src={club.logo_url} alt="logo" className="h-8 w-8 object-contain" />
    : <Trophy size={24} className="text-yellow-400" />;

  return (
    <>
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <nav className="bg-blue-900 text-white shadow-lg relative z-30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg shrink-0">
              <Logo />
              <span className="hidden sm:inline">{club?.club_name || 'Skyhawks CC'}</span>
            </Link>

            {/* ── Right side: avatar + hamburger ── */}
            <div className="flex items-center gap-2">
              {/* Quick profile avatar (top bar) */}
              <Link to="/profile" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-blue-800 transition-colors">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                  : <UserCircle size={22} className="text-blue-200" />}
                <span className="hidden sm:block text-sm font-medium leading-tight">{user?.name}</span>
              </Link>

              {/* Hamburger — always visible */}
              <button
                className="p-2 rounded-lg hover:bg-blue-800 transition-colors"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu">
                <Menu size={24} />
              </button>
            </div>

          </div>
        </div>
      </nav>

      {/* ── Backdrop ───────────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      {/* ── Side drawer (slides in from right) ─────────────────────────────── */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-blue-900 z-50
                    flex flex-col shadow-2xl
                    transform transition-transform duration-300 ease-in-out
                    ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!menuOpen}>

        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-blue-800 shrink-0">
          <Link to="/dashboard" onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 font-bold text-lg">
            <Logo />
            <span className="text-white">{club?.club_name || 'Skyhawks CC'}</span>
          </Link>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-1.5 rounded-lg hover:bg-blue-800 text-blue-300 transition-colors"
            aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        {/* User profile */}
        <Link to="/profile" onClick={() => setMenuOpen(false)}
          className="flex items-center gap-3 px-5 py-4 hover:bg-blue-800 transition-colors border-b border-blue-800 shrink-0">
          {user?.avatar_url
            ? <img src={user.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-blue-600 shrink-0" />
            : <UserCircle size={40} className="text-blue-300 shrink-0" />}
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm truncate">{user?.name}</p>
            <div className="flex gap-1 flex-wrap mt-0.5">
              {userRoles.map(r => (
                <span key={r} className={`text-xs ${roleBadgeClass[r] ?? 'badge-player'}`}>{r}</span>
              ))}
            </div>
          </div>
        </Link>

        {/* Nav links — scrollable if many items */}
        <nav className="flex-1 overflow-y-auto py-2">
          <Link to="/dashboard" onClick={() => setMenuOpen(false)}
            className={`flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors ${location.pathname === '/dashboard' ? 'bg-blue-700 text-white border-r-4 border-yellow-400' : 'text-blue-100 hover:bg-blue-800 hover:text-white'}`}>
            <LayoutDashboard size={18} className="shrink-0" />
            Dashboard
          </Link>
          <Link to="/public/about" onClick={() => setMenuOpen(false)}
            className={`flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors ${location.pathname === '/public/about' ? 'bg-blue-700 text-white border-r-4 border-yellow-400' : 'text-blue-100 hover:bg-blue-800 hover:text-white'}`}>
            <Home size={18} className="shrink-0" />
            Home
          </Link>

          {filteredLinks.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors ${location.pathname === to ? 'bg-blue-700 text-white border-r-4 border-yellow-400' : 'text-blue-100 hover:bg-blue-800 hover:text-white'}`}>
              <Icon size={18} className="shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="shrink-0 border-t border-blue-800 px-5 py-4">
          <button onClick={handleLogout}
            className="flex items-center gap-3 text-sm font-medium text-blue-200 hover:text-red-300 transition-colors w-full">
            <LogOut size={18} className="shrink-0" />
            Sign Out
          </button>
        </div>

      </div>
    </>
  );
}
