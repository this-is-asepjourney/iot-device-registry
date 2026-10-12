'use client';

import React, { useState, useEffect } from 'react';
import { X, Camera, RefreshCw, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { Device } from '@/types';
import { replaceDevice } from '@/lib/device-service';
import { formatMacAddress, isValidMacAddress } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface ReplaceDeviceModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenScanner: (field: 'mac') => void;
  initialNewMac?: string;
}

export function ReplaceDeviceModal({
  device,
  isOpen,
  onClose,
  onOpenScanner,
  initialNewMac = '',
}: ReplaceDeviceModalProps) {
  const { user, demoUser } = useAuth();
  const [newMacAddress, setNewMacAddress] = useState(initialNewMac);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialNewMac) setNewMacAddress(initialNewMac);
  }, [initialNewMac]);

  useEffect(() => {
    if (isOpen) {
      setNewMacAddress(initialNewMac || '');
      setNotes('');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialNewMac]);

  if (!isOpen || !device) return null;

  const handleMacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMacAddress(e.target.value);
    setNewMacAddress(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValidMacAddress(newMacAddress)) {
      setErrorMessage('Format MAC Address baru harus valid 12 digit heksadesimal.');
      return;
    }

    if (newMacAddress.toUpperCase() === device.macAddress.toUpperCase()) {
      setErrorMessage('MAC Address baru tidak boleh sama dengan MAC Address yang sedang terpasang.');
      return;
    }

    setLoading(true);
    const technician = user?.email || demoUser?.email || 'technician@factory.local';

    try {
      await replaceDevice({
        mcid: device.mcid,
        newMacAddress,
        notes,
        technicianEmail: technician,
      });

      setSuccessMessage(`Perangkat IoT berhasil diganti ke MAC baru [${newMacAddress}]. MAC lama telah dilepaskan dan riwayat tersimpan.`);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1400);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">
                Ganti Perangkat IoT (Swap)
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Pelepasan MAC lama & klaim MAC baru secara atomik
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto">
          {/* Machine Info Box */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">MCID:</span>
              <span className="font-mono font-bold text-cyan-400 text-sm">{device.mcid}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Model Mesin:</span>
              <span className="text-slate-200 truncate max-w-[180px] sm:max-w-xs">{device.machineModel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Lokasi:</span>
              <span className="text-slate-300 truncate max-w-[180px] sm:max-w-xs">{device.location}</span>
            </div>
          </div>

          {/* MAC Address Transformation Visualization */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="block text-[10px] text-slate-400 uppercase font-semibold">MAC Lama (Dilepas)</span>
              <span className="font-mono text-[11px] sm:text-xs text-rose-300 font-semibold truncate block">
                {device.macAddress}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="flex-1 min-w-0 text-right">
              <span className="block text-[10px] text-slate-400 uppercase font-semibold">MAC Pengganti</span>
              <span className="font-mono text-[11px] sm:text-xs text-emerald-300 font-semibold truncate block">
                {newMacAddress || 'Belum diisi'}
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/50 flex items-start gap-2.5 text-xs text-rose-200 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-600/50 flex items-start gap-2.5 text-xs text-emerald-200 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* New MAC Input */}
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              MAC Address Baru <span className="text-cyan-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMacAddress}
                onChange={handleMacChange}
                maxLength={17}
                placeholder="XX:XX:XX:XX:XX:XX"
                className="flex-1 px-3.5 py-2.5 text-sm font-mono bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => onOpenScanner('mac')}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl border border-slate-700/80 flex items-center gap-1.5 text-xs font-medium transition-colors shrink-0 active:scale-95"
                title="Scan Barcode / QR Code MAC Baru"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden xs:inline">Scan</span>
              </button>
            </div>
          </div>

          {/* Replacement Reason / Notes */}
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Alasan Penggantian Perangkat
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Contoh: Modul IoT error antena WiFi, diganti modul cadangan ESP32 baru."
              className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/30 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Eksekusi Pergantian</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
