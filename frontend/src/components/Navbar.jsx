import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SolidShieldCheck from './SolidShieldCheck';
import { HardDrive, Radio, User, Users, LogOut, ArrowUpRight } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 navbar-dark-black text-white backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-md group-hover:scale-105 transition-transform">
              <SolidShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <span className="text-xl font-extrabold text-white tracking-tight">
                SecureShare
              </span>
              <span className="text-[11px] ml-2 px-2.5 py-0.5 rounded-full bg-white/10 text-cyan-300 border border-white/15 font-bold uppercase backdrop-blur-xs">
                Fast & Safe
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-2 sm:gap-3 text-sm font-bold">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                    isActive('/dashboard')
                      ? 'bg-white text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <HardDrive className="w-4 h-4" />
                  <span>My Files</span>
                </Link>

                <Link
                  to="/contacts"
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                    isActive('/contacts')
                      ? 'bg-white text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Contacts</span>
                </Link>

                <Link
                  to="/transfer"
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                    isActive('/transfer')
                      ? 'bg-white text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Radio className={`w-4 h-4 ${isActive('/transfer') ? 'text-slate-900' : 'text-emerald-400'} animate-pulse`} />
                  <span>Live Transfer</span>
                </Link>

                <Link
                  to="/profile"
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                    isActive('/profile')
                      ? 'bg-white text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>@{user.username}</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-all cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-slate-300 hover:text-white font-bold transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1 px-4.5 py-2 rounded-xl btn-gradient-primary font-bold shadow-md transition-all hover:scale-105"
                >
                  <span>Get Started</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}
