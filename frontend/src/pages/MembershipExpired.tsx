import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, LogOut, Mail } from 'lucide-react';

export default function MembershipExpired() {
  const { logout } = useAuth();
  const navigate   = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-red-100 max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <AlertCircle size={32} className="text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Membership Expired</h1>
        <p className="text-gray-600 leading-relaxed mb-6">
          Your membership has expired. Please renew it by paying the annual membership fee and share the payment proof to{' '}
          <a href="mailto:skyhawkscricket@gmail.com" className="text-blue-600 font-medium hover:underline">
            skyhawkscricket@gmail.com
          </a>
          .
        </p>
        <a href="mailto:skyhawkscricket@gmail.com"
          className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-medium px-5 py-2.5 rounded-lg transition-colors mb-3 w-full justify-center">
          <Mail size={16} /> Email for Renewal
        </a>
        <button onClick={handleLogout}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm w-full justify-center py-2 transition-colors">
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}
