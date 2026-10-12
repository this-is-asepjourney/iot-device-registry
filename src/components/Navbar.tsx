'use client';

import React, { useState } from 'react';
import {
  Cpu,
  PlusCircle,
  Download,
  BookOpen,
  Database,
  Cloud,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface NavbarProps {
  isCloudflareRemote?: boolean;
  onOpenInstallModal: () => void;
  onOpenExportModal: () => void;
  onOpenSetupModal: () => void;
  onOpenAuthModal: () => void;
}

export function Navbar({
  isCloudflareRemote = false,
  onOpenInstallModal,
  onOpenExportModal,
  onOpenSetupModal,
  onOpenAuthModal,
}: NavbarProps) {
  const { user, demoUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeEmail = user?.email || demoUser?.email || 'admin@plant.local';

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo & Title */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="relative p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] shrink-0">
                <Cpu className="w-4 h-4 sm:w-5 sm:h-5" />
                <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-bold text-slate-100 tracking-tight text-sm sm:text-lg truncate">
                    <span className="inline sm:hidden">IoT Registry</span>
                    <span className="hidden sm:inline">IoT Installation Registry</span>
                  </span>
                  {isCloudflareRemote ? (
                    <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      <Cloud className="w-3 h-3 text-emerald-400" />
                      <span className="hidden xs:inline">D1 Remote</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
                      <Database className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span className="hidden xs:inline">D1 SQLite Local</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 hidden lg:block truncate">
                  Pemetaan 1:1 MCID & MAC Address dengan Cloudflare D1 SQLite Database
                </p>
              </div>
            </div>

            {/* Desktop Action Buttons */}
            <div className="hidden sm:flex items-center gap-2 sm:gap-3">
              {/* Setup Guide Button */}
              <button
                onClick={onOpenSetupModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-colors"
                title="Panduan Konfigurasi Cloudflare D1"
              >
                <BookOpen className="w-3.5 h-3.5 text-orange-400" />
                <span className="hidden md:inline">Setup D1</span>
              </button>

              {/* Export CSV Button */}
              <button
                onClick={onOpenExportModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/60 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>

              {/* Install New Device Button */}
              <button
                onClick={onOpenInstallModal}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/20 transition-all hover:shadow-cyan-900/40"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Instal Device</span>
              </button>

              {/* User status */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="hidden lg:flex flex-col text-right hover:opacity-80 transition-opacity"
                  title="Klik untuk ubah identitas teknisi"
                >
                  <span className="text-xs font-medium text-slate-200 truncate max-w-[130px]">
                    {activeEmail}
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1 justify-end">
                    <ShieldCheck className="w-2.5 h-2.5" /> Teknisi
                  </span>
                </button>
              </div>
            </div>

            {/* Mobile Header Actions */}
            <div className="flex sm:hidden items-center gap-1.5">
              <button
                onClick={onOpenInstallModal}
                className="p-2 rounded-lg bg-cyan-600 text-white text-xs font-semibold shadow-md active:scale-95 transition-transform"
                title="Instal Device Baru"
              >
                <PlusCircle className="w-4 h-4" />
              </button>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
                aria-label="Toggle Menu"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden fixed inset-x-0 top-14 z-30 bg-slate-950/95 border-b border-slate-800 p-4 backdrop-blur-xl animate-in slide-in-from-top-2 duration-150 shadow-2xl">
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-200 truncate">{activeEmail}</div>
                <div className="text-[10px] text-orange-400 flex items-center gap-1 mt-0.5">
                  <Database className="w-3 h-3" /> Database: Cloudflare D1 SQLite
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  onOpenExportModal();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200 active:bg-slate-850"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => {
                  onOpenSetupModal();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200 active:bg-slate-850"
              >
                <BookOpen className="w-4 h-4 text-orange-400" />
                <span>Setup D1</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
