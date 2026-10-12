'use client';

import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, History, Check } from 'lucide-react';
import { Device, InstallationHistory } from '@/types';
import { downloadCsv, formatDate } from '@/lib/utils';

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
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

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

      const rows = devices.map((d) => [
        d.mcid,
        d.macAddress,
        d.machineModel,
        d.location,
        d.status,
        formatDate(d.installedAt),
        formatDate(d.updatedAt),
        d.lastTechnician || '',
        d.notes || '',
      ]);

      downloadCsv(`iot_devices_registry_${timestampStr}.csv`, headers, rows);
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

      const rows = history.map((h) => [
        formatDate(h.timestamp),
        h.eventType,
        h.mcid,
        h.macAddress,
        h.previousMacAddress || '-',
        h.newStatus,
        h.previousStatus || '-',
        h.machineModel,
        h.location,
        h.performedBy,
        h.notes || '',
      ]);

      downloadCsv(`iot_installation_history_${timestampStr}.csv`, headers, rows);
    }

    setDownloaded(true);
    setTimeout(() => {
      setDownloaded(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">Export Data ke CSV</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">Format UTF-8 BOM untuk Microsoft Excel</p>
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
        <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto">
          <div className="space-y-2.5">
            <label
              onClick={() => setExportType('devices')}
              className={`flex items-start gap-3 p-3 sm:p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.99] ${
                exportType === 'devices'
                  ? 'bg-slate-800/90 border-emerald-500/60 ring-1 ring-emerald-500/50'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="exportType"
                checked={exportType === 'devices'}
                onChange={() => setExportType('devices')}
                className="mt-1 text-emerald-500 focus:ring-emerald-500"
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-slate-100 flex items-center justify-between">
                  <span>Daftar Mapping Device Aktif</span>
                  <span className="text-emerald-400 font-mono text-[11px] shrink-0 ml-1">{devices.length} Data</span>
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Seluruh MCID, status, MAC aktif, model mesin, dan lokasi.
                </p>
              </div>
            </label>

            <label
              onClick={() => setExportType('history')}
              className={`flex items-start gap-3 p-3 sm:p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.99] ${
                exportType === 'history'
                  ? 'bg-slate-800/90 border-emerald-500/60 ring-1 ring-emerald-500/50'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="exportType"
                checked={exportType === 'history'}
                onChange={() => setExportType('history')}
                className="mt-1 text-emerald-500 focus:ring-emerald-500"
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-slate-100 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 truncate">
                    <History className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>Riwayat Audit Lengkap</span>
                  </span>
                  <span className="text-indigo-400 font-mono text-[11px] shrink-0 ml-1">{history.length} Log</span>
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Log kronologis termasuk pergantian MAC address & operator.
                </p>
              </div>
            </label>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
            File akan diunduh dengan ekstensi <code>.csv</code> dan langsung siap dibuka di Microsoft Excel atau Google Sheets.
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 active:scale-95 transition-all"
            >
              {downloaded ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>File Terunduh!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Unduh File CSV</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
