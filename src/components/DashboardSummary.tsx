'use client';

import React from 'react';
import { Cpu, CheckCircle2, Wrench, Ban, History, ArrowRight } from 'lucide-react';
import { Device, InstallationHistory, DeviceStatus } from '@/types';

interface DashboardSummaryProps {
  devices: Device[];
  history: InstallationHistory[];
  activeFilter: 'ALL' | DeviceStatus;
  onSelectFilter: (filter: 'ALL' | DeviceStatus) => void;
  onOpenHistory: () => void;
}

export function DashboardSummary({
  devices,
  history,
  activeFilter,
  onSelectFilter,
  onOpenHistory,
}: DashboardSummaryProps) {
  const total = devices.length;
  const installedCount = devices.filter((d) => d.status === 'Installed').length;
  const maintenanceCount = devices.filter((d) => d.status === 'Maintenance').length;
  const removedCount = devices.filter((d) => d.status === 'Removed').length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-4">
      {/* 1. Total Mesin */}
      <button
        onClick={() => onSelectFilter('ALL')}
        className={`text-left p-3 sm:p-4 rounded-xl border transition-all active:scale-[0.98] ${
          activeFilter === 'ALL'
            ? 'bg-slate-800/90 border-cyan-500/50 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500/30'
            : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between text-slate-400 mb-1.5 sm:mb-2">
          <span className="text-[11px] sm:text-xs font-medium">Total Mesin</span>
          <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 shrink-0" />
        </div>
        <div className="text-xl sm:text-2xl font-bold text-slate-100 font-mono">{total}</div>
        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
          Seluruh MCID terdata
        </div>
      </button>

      {/* 2. Installed */}
      <button
        onClick={() => onSelectFilter('Installed')}
        className={`text-left p-3 sm:p-4 rounded-xl border transition-all active:scale-[0.98] ${
          activeFilter === 'Installed'
            ? 'bg-emerald-950/30 border-emerald-500/60 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/30'
            : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between text-slate-400 mb-1.5 sm:mb-2">
          <span className="text-[11px] sm:text-xs font-medium text-emerald-400">Installed</span>
          <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
        </div>
        <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">{installedCount}</div>
        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
          IoT terhubung aktif
        </div>
      </button>

      {/* 3. Maintenance */}
      <button
        onClick={() => onSelectFilter('Maintenance')}
        className={`text-left p-3 sm:p-4 rounded-xl border transition-all active:scale-[0.98] ${
          activeFilter === 'Maintenance'
            ? 'bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/30'
            : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between text-slate-400 mb-1.5 sm:mb-2">
          <span className="text-[11px] sm:text-xs font-medium text-amber-400">Maintenance</span>
          <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
        </div>
        <div className="text-xl sm:text-2xl font-bold text-amber-400 font-mono">{maintenanceCount}</div>
        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
          Dalam pemeliharaan
        </div>
      </button>

      {/* 4. Removed */}
      <button
        onClick={() => onSelectFilter('Removed')}
        className={`text-left p-3 sm:p-4 rounded-xl border transition-all active:scale-[0.98] ${
          activeFilter === 'Removed'
            ? 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-950/30 ring-1 ring-rose-500/30'
            : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between text-slate-400 mb-1.5 sm:mb-2">
          <span className="text-[11px] sm:text-xs font-medium text-rose-400">Removed</span>
          <Ban className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
        </div>
        <div className="text-xl sm:text-2xl font-bold text-rose-400 font-mono">{removedCount}</div>
        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
          MAC telah dilepas
        </div>
      </button>

      {/* 5. Riwayat Log */}
      <button
        onClick={onOpenHistory}
        className="text-left p-3 sm:p-4 rounded-xl border bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 hover:border-indigo-500/50 transition-all col-span-2 md:col-span-1 group active:scale-[0.98]"
      >
        <div className="flex items-center justify-between text-slate-400 mb-1.5 sm:mb-2">
          <span className="text-[11px] sm:text-xs font-medium text-indigo-400">Riwayat Audit</span>
          <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 group-hover:rotate-45 transition-transform shrink-0" />
        </div>
        <div className="text-xl sm:text-2xl font-bold text-indigo-400 font-mono">{history.length}</div>
        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 flex items-center justify-between">
          <span>Buka timeline log</span>
          <ArrowRight className="w-3 h-3 text-indigo-400 inline group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>
    </div>
  );
}
