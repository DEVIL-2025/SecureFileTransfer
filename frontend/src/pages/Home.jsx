import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Zap,
  HardDrive,
  Radio,
  Lock,
  ArrowRight,
  Share2,
  Sparkles,
  Users
} from 'lucide-react';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="space-y-20 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto space-y-6 pt-4">
        
        {/* Pill Tag */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full badge-blue text-xs font-extrabold uppercase tracking-wider shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-slate-900" />
          <span>Simple, Safe & Private File Sharing</span>
        </div>

        {/* Crisp Headline */}
        <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-tight sm:leading-tight">
          Send files directly to anyone, <br />
          <span className="text-gradient-dark">fast and private.</span>
        </h1>

        {/* High-Contrast Subtitle */}
        <p className="text-base sm:text-lg text-slate-700 leading-relaxed max-w-2xl mx-auto font-medium">
          Transfer files in real time directly between browsers, or save your important documents safely in your own private cloud storage.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          {user ? (
            <>
              <Link
                to="/transfer"
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl btn-gradient-primary font-bold text-sm shadow-md transition-all"
              >
                <Radio className="w-4 h-4" />
                <span>Open Live Transfer</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/contacts"
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl soft-card hover:bg-white text-slate-900 font-bold text-sm transition-all"
              >
                <Users className="w-4 h-4 text-slate-900" />
                <span>My Contacts</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/register"
                className="flex items-center gap-2 px-7 py-3.5 rounded-2xl btn-gradient-primary font-bold text-sm shadow-md transition-all"
              >
                <span>Get Started — Free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl soft-card hover:bg-white text-slate-900 font-bold text-sm transition-all"
              >
                <span>Sign In</span>
              </Link>
            </>
          )}
        </div>

      </section>

      {/* 3 Simple Steps */}
      <section className="space-y-8 pt-4">
        <div className="text-center space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
            HOW IT WORKS
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            Three Simple Steps to Share Any File
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="soft-card p-7 rounded-3xl space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#070B14] to-[#1E293B] text-white flex items-center justify-center font-black text-lg shadow-xs">
              1
            </div>
            <h3 className="text-lg font-bold text-slate-900">Connect with One-Time Key</h3>
            <p className="text-sm text-slate-700 leading-relaxed font-medium">
              Generate a temporary pairing key to establish a secure trusted contact relationship.
            </p>
          </div>

          <div className="soft-card p-7 rounded-3xl space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-300 text-slate-900 flex items-center justify-center font-black text-lg shadow-xs">
              2
            </div>
            <h3 className="text-lg font-bold text-slate-900">Select Your File</h3>
            <p className="text-sm text-slate-700 leading-relaxed font-medium">
              Choose any photo, video, or document. The file is encrypted directly on your device.
            </p>
          </div>

          <div className="soft-card p-7 rounded-3xl space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] flex items-center justify-center font-black text-lg shadow-xs">
              3
            </div>
            <h3 className="text-lg font-bold text-slate-900">Instant Direct Download</h3>
            <p className="text-sm text-slate-700 leading-relaxed font-medium">
              Your recipient accepts and downloads the file live with zero-knowledge E2EE streaming.
            </p>
          </div>

        </div>
      </section>

      {/* Features Grid */}
      <section className="space-y-8 pt-4">
        <div className="text-center space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
            KEY FEATURES
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            Everything You Need For Easy File Sharing
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="soft-card p-7 rounded-3xl flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[#070B14] to-[#1E293B] text-white shrink-0 shadow-xs">
              <Zap className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900">Fast Live Streaming</h4>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                Stream files piece-by-piece in real time without waiting for slow cloud uploads.
              </p>
            </div>
          </div>

          <div className="soft-card p-7 rounded-3xl flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900">100% Private & Secure</h4>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                Your files are locked with encryption keys created only on your computer.
              </p>
            </div>
          </div>

          <div className="soft-card p-7 rounded-3xl flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-slate-100 border border-slate-300 text-slate-900 shrink-0">
              <HardDrive className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900">Private Cloud Storage</h4>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                Save your private documents online safely and download them whenever you need.
              </p>
            </div>
          </div>

          <div className="soft-card p-7 rounded-3xl flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[#070B14] to-[#1E293B] text-white shrink-0 shadow-xs">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900">Trusted Contacts</h4>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                Pair once with a temporary connection key and send files to trusted friends anytime.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* CTA Card */}
      <section className="soft-card p-8 sm:p-12 rounded-3xl text-center space-y-6 bg-white shadow-sm">
        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
            Ready to send your files safely?
          </h3>
          <p className="text-sm text-slate-700 font-medium">
            Create a free account in seconds and start sharing immediately.
          </p>
        </div>

        <div>
          {user ? (
            <Link
              to="/transfer"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl btn-gradient-primary font-bold text-sm shadow-md transition-all"
            >
              <span>Launch Live Transfer</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl btn-gradient-primary font-bold text-sm shadow-md transition-all"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-8 text-center text-xs font-bold text-slate-600">
        © 2026 SecureShare • Simple & Private File Transfer
      </footer>

    </div>
  );
}
