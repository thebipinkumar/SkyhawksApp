import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import BannerSlider from '../../components/BannerSlider';
import { Trophy, Users, Calendar, Mail, MapPin, Award, Instagram, Facebook } from 'lucide-react';

interface AboutData {
  club_name: string; founded: string; tagline: string; description: string;
  stats: { members: number; matches: number; wins: number };
  contact_email: string; ground: string; achievements: string[];
  logo_url: string | null; instagram_url: string | null; facebook_url: string | null;
}

interface Banner { id: number; image_url: string; caption: string | null; sort_order: number; }

export default function About() {
  const [data, setData]       = useState<AboutData | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    api.get('/public/about').then(r => setData(r.data));
    api.get('/public/banners').then(r => setBanners(r.data));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Banner Slider ── */}
      {banners.length > 0 && <BannerSlider banners={banners} autoPlayMs={4500} />}

      {/* ── Hero ── */}
      <div className={`bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white px-4 text-center ${banners.length > 0 ? 'py-12' : 'py-20'}`}>
        <div className={`inline-flex items-center justify-center w-40 h-40 rounded-full mb-6 ${data?.logo_url ? '' : 'bg-yellow-400'}`}>
          {data?.logo_url
            ? <img src={data.logo_url} alt="logo" className="w-40 h-40 object-contain rounded-full" />
            : <Trophy size={80} className="text-blue-900" />}
        </div>
        <h1 className="text-4xl font-bold mb-2">{data?.club_name || 'Skyhawks Cricket Club'}</h1>
        <p className="text-xl text-blue-200 italic">{data?.tagline}</p>
        <p className="text-blue-300 mt-2">Est. {data?.founded}</p>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Link to="/register" className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-6 py-3 rounded-xl transition-colors">Join the Club</Link>
          <Link to="/public/matches" className="border border-blue-300 hover:bg-blue-800 text-white px-6 py-3 rounded-xl transition-colors">View Matches</Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">
        {/* Stats */}
        {data && (
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { icon: <Users size={28} className="text-blue-600" />,  value: data.stats.members, label: 'Members' },
              { icon: <Calendar size={28} className="text-purple-600" />, value: data.stats.matches, label: 'Matches Played' },
              { icon: <Trophy size={28} className="text-yellow-600" />, value: data.stats.wins,   label: 'Wins' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-center mb-2">{s.icon}</div>
                <p className="text-3xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* About */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">About Us</h2>
          <p className="text-gray-600 leading-relaxed">{data?.description}</p>
        </div>

        {/* Achievements */}
        {(data?.achievements?.length ?? 0) > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award size={22} className="text-yellow-500" /> Achievements
            </h2>
            <ul className="space-y-3">
              {data!.achievements.map(a => (
                <li key={a} className="flex items-center gap-3 text-gray-700">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contact */}
        {data && (
          <div className="bg-blue-900 text-white rounded-xl p-8">
            <h2 className="text-xl font-bold mb-4">Get in Touch</h2>
            <div className="space-y-3">
              <p className="flex items-center gap-3"><Mail size={18} className="text-blue-300" />{data.contact_email}</p>
              <p className="flex items-center gap-3"><MapPin size={18} className="text-blue-300" />{data.ground}</p>
            </div>
            {(data.instagram_url || data.facebook_url) && (
              <div className="mt-5 flex items-center gap-3">
                {data.instagram_url && (
                  <a href={data.instagram_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors text-sm">
                    <Instagram size={16} /> Instagram
                  </a>
                )}
                {data.facebook_url && (
                  <a href={data.facebook_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors text-sm">
                    <Facebook size={16} /> Facebook
                  </a>
                )}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <Link to="/register" className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-5 py-2.5 rounded-lg transition-colors text-sm">Join the Club</Link>
              <Link to="/login" className="border border-blue-400 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg transition-colors text-sm">Sign In</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
