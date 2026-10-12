'use client';

import React, { useState, useEffect } from 'react';
import { X, Wrench, AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { Device, DeviceStatus } from '@/types';
import { updateDeviceStatus } from '@/lib/device-service';
import { useAuth } from '@/context/AuthContext';

interface StatusChangeModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
}

export function StatusChangeModal({ device, isOpen, onClose }: StatusChangeModalProps) {
  const { user, demoUser } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<DeviceStatus>('Installed');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (device) {
      setSelectedStatus(device.status);
      setNotes('');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [device, isOpen]);

  if (!isOpen || !device) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    setLoading(true);
    const technician = user?.email || demoUser?.email || 'technician@factory.local';

    try {
      await updateDeviceStatus({
        mcid: device.mcid,
        newStatus: selectedStatus,
        notes,
        technicianEmail: technician,
      });

      setSuccessMessage(`Status mesin [${device.mcid}] berhasil diubah menjadi ${selectedStatus}.`);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">Ubah Status Mesin</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-mono truncate">{device.mcid} · {device.macAddress}</p>
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
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/50 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-600/50 flex items-start gap-2.5 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* Status Options */}
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Pilih Status Baru
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Installed', 'Maintenance', 'Removed'] as DeviceStatus[]).map((st) => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`py-2 px-2 sm:px-3 rounded-xl text-xs font-medium border text-center transition-all active:scale-95 ${
                    selectedStatus === st
                      ? st === 'Installed'
                        ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500 font-semibold'
                        : st === 'Maintenance'
                        ? 'bg-amber-950/50 border-amber-500 text-amber-300 ring-1 ring-amber-500 font-semibold'
                        : 'bg-rose-950/50 border-rose-500 text-rose-300 ring-1 ring-rose-500 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Important explanation for Removed */}
          {selectedStatus === 'Removed' && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-2 text-xs text-rose-300">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed text-[11px] sm:text-xs">
                Perangkat akan dilepas. MAC Address <strong>{device.macAddress}</strong> otomatis dibebaskan dari <code>macIndex</code> agar dapat dipasang ke mesin lain.
              </p>
            </div>
          )}

          {/* Important explanation for Maintenance */}
          {selectedStatus === 'Maintenance' && (
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/60 text-[11px] sm:text-xs text-amber-300 leading-relaxed">
              Mesin dalam pemeliharaan. MAC Address tetap terdaftar dan terlindungi dari klaim mesin lain.
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Catatan Perubahan Status
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Contoh: Kalibrasi sensor berkala / Mesin overhaul..."
              className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
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
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-950/30 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Simpan Status</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
