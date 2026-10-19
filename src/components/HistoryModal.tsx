'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  History,
  Search,
  ArrowRight,
  UserCheck,
  Calendar,
  Filter,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import { InstallationHistory, FACTORY_LIST } from '@/types';
import { formatDate, isDateInPreset, DateFilterPreset, extractFactory } from '@/lib/utils';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: InstallationHistory[];
  initialMcidFilter?: string;
  initialFactoryFilter?: string;
}

export function HistoryModal({
  isOpen,
  onClose,
  history,
  initialMcidFilter = '',
  initialFactoryFilter = 'ALL',
}: HistoryModalProps) {
  const [searchTerm, setSearchTerm] = useState(initialMcidFilter);
  const [selectedEvent, setSelectedEvent] = useState<string>('ALL');
  const [factoryFilter, setFactoryFilter] = useState<string>(initialFactoryFilter || 'ALL');
  const [modelFilter, setModelFilter] = useState<string>('ALL');
  const [timeFilter, setTimeFilter] = useState<DateFilterPreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  React.useEffect(() => {
    if (initialMcidFilter) {
      setSearchTerm(initialMcidFilter);
    }
  }, [initialMcidFilter]);

  React.useEffect(() => {
    if (isOpen) {
      setFactoryFilter(initialFactoryFilter || 'ALL');
    }
  }, [isOpen, initialFactoryFilter]);

  // Extract unique machine models from history
  const availableModels = useMemo(() => {
    const set = new Set<string>();
    history.forEach((h) => {
      if (h.machineModel && h.machineModel.trim()) {
        set.add(h.machineModel.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [history]);

  if (!isOpen) return null;

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.mcid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.macAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.previousMacAddress &&
        item.previousMacAddress.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.machineModel &&
        item.machineModel.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesEvent = selectedEvent === 'ALL' || item.eventType === selectedEvent;

    const itemFactory = extractFactory(item.location);
    const matchesFactory =
      factoryFilter === 'ALL' || itemFactory === factoryFilter;

    const matchesModel =
      modelFilter === 'ALL' ||
      (item.machineModel &&
        item.machineModel.toLowerCase() === modelFilter.toLowerCase());

    const matchesTime = isDateInPreset(
      item.timestamp,
      timeFilter,
      customStartDate,
      customEndDate
    );

    return matchesSearch && matchesEvent && matchesFactory && matchesModel && matchesTime;
  });

  const activeFiltersCount =
    (selectedEvent !== 'ALL' ? 1 : 0) +
    (factoryFilter !== 'ALL' ? 1 : 0) +
    (modelFilter !== 'ALL' ? 1 : 0) +
    (timeFilter !== 'ALL' ? 1 : 0) +
    (searchTerm.trim() ? 1 : 0);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedEvent('ALL');
    setFactoryFilter('ALL');
    setModelFilter('ALL');
    setTimeFilter('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'INSTALL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            Instalasi
          </span>
        );
      case 'REPLACE_DEVICE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
            Ganti MAC
          </span>
        );
      case 'STATUS_CHANGE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            Status
          </span>
        );
      case 'REMOVE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
            Lepas
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-slate-800 text-slate-300 shrink-0">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">
                Riwayat Audit & Siklus Hidup
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Log kronologis pemasangan, pergantian, dan status mesin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-950/50 flex flex-col gap-2.5 shrink-0">
          {/* Row 1: Search & Event */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari MCID, MAC, Model Mesin..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">Semua Peristiwa</option>
                <option value="INSTALL">Instalasi Baru</option>
                <option value="REPLACE_DEVICE">Ganti Device</option>
                <option value="STATUS_CHANGE">Ubah Status</option>
                <option value="REMOVE">Pelepasan</option>
              </select>
            </div>
          </div>

          {/* Row 2: Model Mesin & Waktu Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5 text-slate-400">
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="font-semibold text-slate-300 text-[11px]">Filter:</span>
            </div>

            {/* Factory Pabrik */}
            <div className="min-w-[120px] sm:min-w-[130px]">
              <select
                value={factoryFilter}
                onChange={(e) => setFactoryFilter(e.target.value)}
                className="w-full px-2.5 py-1 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">Semua Pabrik</option>
                {FACTORY_LIST.map((fac) => (
                  <option key={fac} value={fac}>
                    Factory {fac}
                  </option>
                ))}
              </select>
            </div>

            {/* Model Mesin */}
            <div className="min-w-[130px] sm:min-w-[150px]">
              <select
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="w-full px-2.5 py-1 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">Semua Model Mesin</option>
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Waktu Filter */}
            <div className="min-w-[130px] sm:min-w-[150px]">
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as DateFilterPreset)}
                className="w-full px-2.5 py-1 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">Semua Waktu</option>
                <option value="TODAY">Hari Ini</option>
                <option value="LAST_7_DAYS">7 Hari Terakhir</option>
                <option value="LAST_30_DAYS">30 Hari Terakhir</option>
                <option value="THIS_MONTH">Bulan Ini</option>
                <option value="CUSTOM">Custom Tanggal...</option>
              </select>
            </div>

            {/* Custom Date Pickers */}
            {timeFilter === 'CUSTOM' && (
              <div className="flex items-center gap-1.5 text-xs bg-slate-900 px-2 py-0.5 rounded-xl border border-slate-800 animate-in fade-in">
                <span className="text-[10px] text-slate-400">Dari:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-slate-400">Sampai:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            {/* Counter & Reset */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Menampilkan <strong className="text-indigo-400">{filteredHistory.length}</strong> dari{' '}
                {history.length}
              </span>
              {activeFiltersCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors active:scale-95 shadow-sm"
                  title="Reset filter riwayat"
                >
                  <RotateCcw className="w-3 h-3 text-rose-400" />
                  <span>Reset ({activeFiltersCount})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* History List */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-3 sm:space-y-4">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              Tidak ada catatan riwayat yang cocok dengan filter.
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div
                key={item.id}
                className="p-3 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    {getEventBadge(item.eventType)}
                    <span className="font-mono font-bold text-slate-100 text-xs sm:text-sm">
                      {item.mcid}
                    </span>
                    <span className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[140px] sm:max-w-none">
                      ({item.machineModel})
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500 shrink-0">
                    <Calendar className="w-3 h-3 text-slate-600" />
                    <span>{formatDate(item.timestamp)}</span>
                  </div>
                </div>

                {/* Specific Event Details */}
                {item.eventType === 'REPLACE_DEVICE' && (
                  <div className="flex items-center gap-1.5 sm:gap-2 p-2 rounded-lg bg-blue-950/20 border border-blue-900/40 text-[11px] sm:text-xs overflow-x-auto">
                    <span className="text-slate-400 shrink-0">Lama:</span>
                    <span className="font-mono text-rose-300 line-through shrink-0">
                      {item.previousMacAddress || '-'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-slate-400 shrink-0">Baru:</span>
                    <span className="font-mono text-emerald-300 font-semibold shrink-0">{item.macAddress}</span>
                  </div>
                )}

                {item.eventType === 'STATUS_CHANGE' && (
                  <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-300">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-medium text-slate-400">{item.previousStatus || '-'}</span>
                    <ArrowRight className="w-3 h-3 text-amber-400" />
                    <span className="font-semibold text-amber-300">{item.newStatus}</span>
                  </div>
                )}

                {item.eventType === 'INSTALL' && (
                  <div className="text-[11px] sm:text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                    <span className="text-slate-500">MAC Terpasang:</span>
                    <span className="font-mono font-semibold text-emerald-400">{item.macAddress}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-400 truncate">{item.location}</span>
                  </div>
                )}

                {item.eventType === 'REMOVE' && (
                  <div className="text-[11px] sm:text-xs text-rose-300 flex items-center gap-1.5">
                    <span>MAC {item.macAddress} telah dilepas & dibebaskan.</span>
                  </div>
                )}

                {/* Notes and Performed By */}
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 pt-1 border-t border-slate-900/80 gap-2">
                  <span className="italic text-slate-400 truncate max-w-[160px] sm:max-w-md">
                    &ldquo;{item.notes || 'Tanpa catatan'}&rdquo;
                  </span>
                  <div className="flex items-center gap-1 text-slate-400 shrink-0">
                    <UserCheck className="w-3 h-3 text-cyan-400" />
                    <span className="truncate max-w-[100px] sm:max-w-none">{item.performedBy}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
