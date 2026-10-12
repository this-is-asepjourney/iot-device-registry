'use client';

import React, { useState } from 'react';
import { X, User, Mail, Shield, CheckCircle2, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { demoUser, loginDemo } = useAuth();
  const [email, setEmail] = useState(demoUser?.email || 'asepjourney551@gmail.com');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      loginDemo(email.trim());
      onClose();
    }
  };

  const handleSelectPreset = (presetEmail: string) => {
    setEmail(presetEmail);
    loginDemo(presetEmail);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">Identitas Petugas / Teknisi</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">Dicatat dalam log riwayat transaksi sistem</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Email / Nama Teknisi Aktif
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="asepjourney551@gmail.com"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Identitas ini dicatat otomatis setiap kali melakukan instalasi, penggantian modul, atau pelepasan device.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan Identitas Sesi</span>
            </button>
          </form>

          {/* Quick Preset Selector */}
          <div className="pt-2 border-t border-slate-800/80">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Pilihan Cepat Shift / Petugas:
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { label: 'Asep (Lead IoT Engineer)', val: 'asepjourney551@gmail.com' },
                { label: 'Teknisi Shift 1 (Pagi)', val: 'teknisi.shift1@plant.local' },
                { label: 'Teknisi Shift 2 (Malam)', val: 'teknisi.shift2@plant.local' },
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => handleSelectPreset(preset.val)}
                  className={`w-full px-3 py-2 rounded-lg text-left text-xs flex items-center justify-between border transition-all ${
                    email === preset.val
                      ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{preset.label}</span>
                  </div>
                  {email === preset.val && <BadgeCheck className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
