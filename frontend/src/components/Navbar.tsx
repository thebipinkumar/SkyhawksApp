import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { LogOut, Menu, X, Trophy, UserCircle, Home, Settings } from 'lucide-react';
import { useState } from 'react';

const navLinks = [
  { to: '/matches',        label: 'Matches',        roles: ['player', 'manager', 'selector', 'admin'] },
  { to: '/team-selection', label: 'Team Selection',  roles: ['selector', 'admin'] },
  { to: '/announcements',  label: 'Announcements',   roles: ['player', 'manager', 'selector', 'admin'] },
  { to: '/budget',         label: 'Budget',          roles: ['manager', 'admin'] },
  { to: '/users',          label: 'Members',         roles: ['admin', 'manager', 'selector'] },
  { to: '/jerseys',        label: 'Merchandise',     roles: ['admin', 'manager', 'selector'] },
  { to: '/admin/settings', label: 'Settings',        roles: ['admin'] },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { club } = useClub();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/public/about'); };

  const userRoles: string[] = user?.roles ?? (user?.role ? [user.role] : []);

  const filteredLinks = navLinks.filter(l => l.roles.some(r => userRoles.includes(r)));

  const primaryRole = userRoles[0] ?? 'player';
  const roleBadgeClass: Record<string, string> = {
    player: 'badge-player', manager: 'badge-manager',
    selector: 'badge-selector', admin: 'badge-admin',
  };

  const Logo = () => club?.logo_url
    ? <img src={club.logo_url} alt="logo" className="h-8 w-8 object-contain" />
    : <Trophy size={24} className="text-yellow-400" />;

  return (
    <nav className="bg-blue-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg shrink-0">
            <Logo />
            <span className="hidden sm:inline">{club?.club_name || 'Skyhawks CC'}</span>
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-1">
            <Link to="/public/about"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === '/public/about' ? 'bg-blue-700' : 'text-blue-100 hover:bg-blue-800'}`}>
              <Home size={14} /> Home
            </Link>
            {filteredLinks.map(link => (
              <Link key={link.to} to={link.to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === link.to ? 'bg-blue-700' : 'text-blue-100 hover:bg-blue-800'}`}>
                {link.to === '/admin/settings' && <Settings size={14} />}
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Link to="/profile" className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-blue-800 transition-colors">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                : <UserCircle size={22} className="text-blue-200" />}
              <div className="text-right">
                <p className="text-sm font-medium leading-tight">{user?.name}</p>
                <div className="flex gap-1 justify-end flex-wrap">
                  {userRoles.map(r => (
                    <span key={r} className={`text-xs ${roleBadgeClass[r] ?? 'badge-player'}`}>{r}</span>
                  ))}
                </div>
              </div>
            </Link>
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-blue-800 transition-colors" title="Logout">
              <LogOut size={18} />
            </button>
          </div>

          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile */}
        {menuOpen && (
          <div className="md:hidden pb-4 space-y-1">
            <Link to="/public/about" onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${location.pathname === '/public/about' ? 'bg-blue-700' : 'hover:bg-blue-800'}`}>
              <Home size={14} /> Home
            </Link>
            {filteredLinks.map(link => (
              <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${location.pathname === link.to ? 'bg-blue-700' : 'hover:bg-blue-800'}`}>
                {link.to === '/admin/settings' && <Settings size={14} />}
                {link.label}
              </Link>
            ))}
            <div className="border-t border-blue-700 pt-3 mt-3 flex items-center justify-between px-3">
              <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2">
                <UserCircle size={18} className="text-blue-200" />
                <div>
                  <p className="text-sm font-medium">{user?.name}</p>
                  <div className="flex gap-1 flex-wrap mt-0.5">
                    {userRoles.map(r => (
                      <span key={r} className={`text-xs ${roleBadgeClass[r] ?? 'badge-player'}`}>{r}</span>
                    ))}
                  </div>
                </div>
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-1 text-sm hover:text-red-300">
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
