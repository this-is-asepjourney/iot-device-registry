'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  History,
  Check,
  Calendar,
  Filter,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Device, InstallationHistory } from '@/types';
import { downloadCsv, formatDate, isDateInPreset, DateFilterPreset } from '@/lib/utils';

interface ExportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  history: InstallationHistory[];
}

export function ExportCsvModal({
  isOpen,
  onClose,
  devices,
  history,
}: ExportCsvModalProps) {
  const [exportType, setExportType] = useState<'devices' | 'history'>('devices');
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deviceDateField, setDeviceDateField] = useState<'installedAt' | 'updatedAt'>('installedAt');
  const [downloaded, setDownloaded] = useState(false);

  // Helper to format date object to YYYY-MM-DD for date input
  const toDateInputString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handlePresetSelect = (preset: DateFilterPreset) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      const todayStr = toDateInputString(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'LAST_7_DAYS') {
      const past7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      setStartDate(toDateInputString(past7));
      setEndDate(toDateInputString(now));
    } else if (preset === 'LAST_30_DAYS') {
      const past30 = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      setStartDate(toDateInputString(past30));
      setEndDate(toDateInputString(now));
    } else if (preset === 'THIS_MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toDateInputString(startOfMonth));
      setEndDate(toDateInputString(now));
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setDatePreset('CUSTOM');
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setDatePreset('CUSTOM');
  };

  const handleResetDateFilter = () => {
    handlePresetSelect('ALL');
  };

  // Filtered devices based on selected date range and target date field
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const dateToTest = deviceDateField === 'installedAt' ? d.installedAt : d.updatedAt;
      return isDateInPreset(dateToTest, datePreset, startDate, endDate);
    });
  }, [devices, deviceDateField, datePreset, startDate, endDate]);

  // Filtered history based on selected date range
  const filteredHistory = useMemo(() => {
    return history.filter((h) => {
      return isDateInPreset(h.timestamp, datePreset, startDate, endDate);
    });
  }, [history, datePreset, startDate, endDate]);

  if (!isOpen) return null;

  const isDateRangeInvalid = Boolean(startDate && endDate && startDate > endDate);
  const currentCount = exportType === 'devices' ? filteredDevices.length : filteredHistory.length;
  const totalCount = exportType === 'devices' ? devices.length : history.length;

  const handleExport = () => {
    if (currentCount === 0 || isDateRangeInvalid) return;

    let filenameDatePart = '';
    if (datePreset === 'ALL' || (!startDate && !endDate)) {
      filenameDatePart = `semua_${new Date().toISOString().slice(0, 10)}`;
    } else if (startDate && endDate) {
      filenameDatePart = startDate === endDate ? startDate : `${startDate}_sd_${endDate}`;
    } else if (startDate) {
      filenameDatePart = `dari_${startDate}`;
    } else if (endDate) {
      filenameDatePart = `sampai_${endDate}`;
    } else {
      filenameDatePart = datePreset.toLowerCase();
    }

    if (exportType === 'devices') {
      const headers = [
        'MCID',
        'MAC Address',
        'Model Mesin',
        'Lokasi Pabrik',
        'Status',
        'Tanggal Instalasi',
        'Terakhir Diperbarui',
        'Teknisi Terakhir',
        'Catatan',
      ];

      const rows = filteredDevices.map((d) => [
        d.mcid,
        d.macAddress,
        d.machineModel || '-',
        d.location,
        d.status,
        formatDate(d.installedAt),
        formatDate(d.updatedAt),
        d.lastTechnician || '',
        d.notes || '',
      ]);

      downloadCsv(`iot_devices_${filenameDatePart}.csv`, headers, rows);
    } else {
      const headers = [
        'Waktu Kejadian',
        'Tipe Event',
        'MCID',
        'MAC Address',
        'MAC Sebelumnya',
        'Status Baru',
        'Status Sebelumnya',
        'Model Mesin',
        'Lokasi Pabrik',
        'Operator/Teknisi',
        'Catatan',
      ];

      const rows = filteredHistory.map((h) => [
        formatDate(h.timestamp),
        h.eventType,
        h.mcid,
        h.macAddress,
        h.previousMacAddress || '-',
        h.newStatus,
        h.previousStatus || '-',
        h.machineModel || '-',
        h.location,
        h.performedBy,
        h.notes || '',
      ]);

      downloadCsv(`iot_history_${filenameDatePart}.csv`, headers, rows);
    }

    setDownloaded(true);
    setTimeout(() => {
      setDownloaded(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">Export Data ke CSV</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">Pilih dataset dan filter rentang tanggal laporan</p>
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
          {/* 1. Dataset Selection Cards */}
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              1. Pilih Dataset yang Diekspor
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                onClick={() => setExportType('devices')}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all active:scale-[0.99] ${
                  exportType === 'devices'
                    ? 'bg-emerald-950/20 border-emerald-500/60 ring-1 ring-emerald-500/50'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="exportType"
                  checked={exportType === 'devices'}
                  onChange={() => setExportType('devices')}
                  className="mt-0.5 text-emerald-500 focus:ring-emerald-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-slate-100 flex items-center justify-between">
                    <span>Device Aktif</span>
                    <span className="text-emerald-400 font-mono text-[11px] shrink-0 ml-1">{devices.length} Data</span>
                  </span>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                    MCID, MAC, Model Mesin, Lokasi, dan Status.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setExportType('history')}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all active:scale-[0.99] ${
                  exportType === 'history'
                    ? 'bg-indigo-950/20 border-indigo-500/60 ring-1 ring-indigo-500/50'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="exportType"
                  checked={exportType === 'history'}
                  onChange={() => setExportType('history')}
                  className="mt-0.5 text-indigo-500 focus:ring-indigo-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-slate-100 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 truncate">
                      <History className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Riwayat Log</span>
                    </span>
                    <span className="text-indigo-400 font-mono text-[11px] shrink-0 ml-1">{history.length} Log</span>
                  </span>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                    Log kronologis swap MAC, status, & operator.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* 2. Date Filtering Section */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>2. Rentang Tanggal Ekspor</span>
              </div>
              {(startDate || endDate || datePreset !== 'ALL') && (
                <button
                  type="button"
                  onClick={handleResetDateFilter}
                  className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Semua Waktu</span>
                </button>
              )}
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL' as const, label: 'Semua Waktu' },
                { id: 'TODAY' as const, label: 'Hari Ini' },
                { id: 'LAST_7_DAYS' as const, label: '7 Hari Terakhir' },
                { id: 'LAST_30_DAYS' as const, label: '30 Hari Terakhir' },
                { id: 'THIS_MONTH' as const, label: 'Bulan Ini' },
                { id: 'CUSTOM' as const, label: 'Kustom Tanggal' },
              ].map((p) => {
                const isActive = datePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetSelect(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Date Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="block text-[10px] sm:text-[11px] font-medium text-slate-400 mb-1">
                  Dari Tanggal (Mulai):
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] sm:text-[11px] font-medium text-slate-400 mb-1">
                  Sampai Tanggal (Selesai):
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Specific Date Anchor Toggle for Devices */}
            {exportType === 'devices' && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Filter className="w-3 h-3 text-slate-500" />
                  <span>Filter tanggal berdasarkan:</span>
                </span>
                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDeviceDateField('installedAt')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      deviceDateField === 'installedAt'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tgl Pasang
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceDateField('updatedAt')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      deviceDateField === 'updatedAt'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tgl Update
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Feedback / Status Alert */}
          {isDateRangeInvalid ? (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p>Tanggal Mulai tidak boleh melewati Tanggal Selesai. Silakan sesuaikan kembali.</p>
            </div>
          ) : currentCount === 0 ? (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-300 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Tidak ada data ditemukan</p>
                <p className="text-[11px] text-amber-400/80 mt-0.5">
                  Tidak ada data yang masuk dalam rentang tanggal ini. Silakan ubah rentang tanggal atau klik &quot;Semua Waktu&quot;.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/50 flex items-center justify-between text-xs text-emerald-300 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Siap mengekspor <strong className="text-white font-semibold">{currentCount}</strong> dari {totalCount} data
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60 hidden xs:inline">
                {datePreset === 'ALL' && !startDate && !endDate
                  ? 'Semua Waktu'
                  : `${startDate || 'Awal'} sd ${endDate || 'Sekarang'}`}
              </span>
            </div>
          )}

          {/* Compatibility Note */}
          <div className="text-[11px] text-slate-500 leading-relaxed px-1">
            File diunduh dengan format UTF-8 BOM (.csv) yang kompatibel langsung dengan Microsoft Excel tanpa teks rusak.
          </div>

          {/* Action buttons */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={currentCount === 0 || isDateRangeInvalid || downloaded}
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-950/40 active:scale-95 transition-all"
            >
              {downloaded ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>File Terunduh!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Unduh CSV ({currentCount} Baris)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
