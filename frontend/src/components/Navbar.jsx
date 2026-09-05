import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SolidShieldCheck from './SolidShieldCheck';
import { LayoutDashboard, Radio, User, Users, LogOut, ArrowUpRight, Menu, X } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 navbar-dark-black text-white backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-bold shadow-md group-hover:scale-105 transition-transform shrink-0">
              <SolidShieldCheck className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div className="flex items-center">
              <span className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                SecureShare
              </span>
              <span className="hidden sm:inline-block text-[11px] ml-2 px-2.5 py-0.5 rounded-full bg-white/10 text-cyan-300 border border-white/15 font-bold uppercase backdrop-blur-xs">
                Fast & Safe
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links (Hidden on mobile < md) */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3 text-sm font-bold">
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
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
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

          {/* Mobile Menu Button (< md) */}
          <div className="flex md:hidden items-center gap-2">
            {user && (
              <Link
                to="/profile"
                className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-bold ${
                  isActive('/profile') ? 'bg-white text-slate-950' : 'text-slate-300 bg-white/10'
                }`}
                title={`Logged in as @${user.username}`}
              >
                <User className="w-4 h-4" />
                <span className="max-w-[80px] truncate">@{user.username}</span>
              </Link>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Drawer (< md) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#030712]/95 backdrop-blur-xl px-4 py-4 space-y-2 animate-fade-in shadow-2xl">
          {user ? (
            <>
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive('/dashboard')
                    ? 'bg-white text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>Dashboard</span>
              </Link>

              <Link
                to="/contacts"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive('/contacts')
                    ? 'bg-white text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <Users className="w-5 h-5" />
                <span>Trusted Contacts</span>
              </Link>

              <Link
                to="/transfer"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive('/transfer')
                    ? 'bg-white text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <Radio className={`w-5 h-5 ${isActive('/transfer') ? 'text-slate-950' : 'text-emerald-400'} animate-pulse`} />
                <span>Live File Transfer</span>
              </Link>

              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive('/profile')
                    ? 'bg-white text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <User className="w-5 h-5" />
                <span>User Profile (@{user.username})</span>
              </Link>

              <div className="pt-2 border-t border-white/10">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 transition-all cursor-pointer"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout from Account</span>
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2 pt-1">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl btn-gradient-primary font-bold text-sm shadow-md"
              >
                <span>Get Started — Free</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
