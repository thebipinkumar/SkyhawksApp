import { Link, useLocation } from 'react-router-dom';
import { Trophy, LogIn, Menu, X, Home } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';

const links = [
  { to: '/public/about',   label: 'Home',    icon: <Home size={14} /> },
  { to: '/public/matches', label: 'Matches', icon: null },
  { to: '/public/members', label: 'Members', icon: null },
];

export default function PublicNavbar() {
  const location = useLocation();
  const { user } = useAuth();
  const { club } = useClub();
  const [open, setOpen] = useState(false);

  const Logo = () => club?.logo_url
    ? <img src={club.logo_url} alt="logo" className="h-8 w-8 object-contain" />
    : <Trophy size={24} className="text-yellow-400" />;

  return (
    <nav className="bg-blue-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/public/about" className="flex items-center gap-2 font-bold text-lg shrink-0" title="Go to Home">
            <Logo />
            <span className="hidden sm:inline">{club?.club_name || 'Skyhawks CC'}</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <Link key={l.to} to={l.to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === l.to ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}>
                {l.icon}{l.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <Link to="/dashboard" className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1">
                <LogIn size={15} /> Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-blue-100 hover:text-white text-sm font-medium px-3 py-1.5 rounded-md hover:bg-blue-800 transition-colors">Sign In</Link>
                <Link to="/register" className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 text-sm font-bold px-4 py-1.5 rounded-lg transition-colors">Join Now</Link>
              </>
            )}
          </div>

          <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {open && (
          <div className="md:hidden pb-4 space-y-1">
            {links.map(l => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${location.pathname === l.to ? 'bg-blue-700' : 'hover:bg-blue-800'}`}>
                {l.icon}{l.label}
              </Link>
            ))}
            <div className="border-t border-blue-700 pt-3 mt-2 flex gap-2 px-1">
              {user ? (
                <Link to="/dashboard" onClick={() => setOpen(false)} className="flex-1 text-center text-sm py-2 rounded-lg bg-yellow-400 text-blue-900 font-bold">Dashboard</Link>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="flex-1 text-center text-sm py-2 rounded-lg border border-blue-400 text-blue-100">Sign In</Link>
                  <Link to="/register" onClick={() => setOpen(false)} className="flex-1 text-center text-sm py-2 rounded-lg bg-yellow-400 text-blue-900 font-bold">Join Now</Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
