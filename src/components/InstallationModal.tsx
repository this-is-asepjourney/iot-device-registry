'use client';

import React, { useState } from 'react';
import { X, Camera, PlusCircle, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react';
import { installDevice } from '@/lib/device-service';
import { formatMacAddress, isValidMacAddress, normalizeMcid } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface InstallationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenScanner: (field: 'mcid' | 'mac') => void;
  initialMcid?: string;
  initialMac?: string;
}

export function InstallationModal({
  isOpen,
  onClose,
  onOpenScanner,
  initialMcid = '',
  initialMac = '',
}: InstallationModalProps) {
  const { user, demoUser } = useAuth();
  const [mcid, setMcid] = useState(initialMcid);
  const [macAddress, setMacAddress] = useState(initialMac);
  const [machineModel, setMachineModel] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync props if modal opens with prefilled scanned data
  React.useEffect(() => {
    if (initialMcid) setMcid(initialMcid);
    if (initialMac) setMacAddress(initialMac);
  }, [initialMcid, initialMac]);

  const handleMacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMacAddress(e.target.value);
    setMacAddress(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normMcid = normalizeMcid(mcid);
    if (!normMcid) {
      setErrorMessage('Machine Control ID (MCID) wajib diisi.');
      return;
    }

    if (!isValidMacAddress(macAddress)) {
      setErrorMessage('Format MAC Address harus valid 12 karakter heksadesimal (contoh: AA:BB:CC:11:22:33).');
      return;
    }

    if (!machineModel.trim()) {
      setErrorMessage('Nama atau model mesin wajib diisi.');
      return;
    }

    if (!location.trim()) {
      setErrorMessage('Lokasi penempatan mesin wajib diisi.');
      return;
    }

    setLoading(true);
    const technician = user?.email || demoUser?.email || 'technician@factory.local';

    try {
      await installDevice({
        mcid: normMcid,
        macAddress,
        machineModel,
        location,
        notes,
        technicianEmail: technician,
      });

      setSuccessMessage(`Berhasil mendaftarkan instalasi untuk MCID [${normMcid}] dengan MAC [${macAddress}].`);
      setTimeout(() => {
        setSuccessMessage(null);
        setMcid('');
        setMacAddress('');
        setMachineModel('');
        setLocation('');
        setNotes('');
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">
                Formulir Instalasi IoT Device
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Pendaftaran mapping baru perangkat IoT ke mesin pabrik
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
          {/* Rules Banner Info */}
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-2.5 text-xs text-slate-300">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <span className="font-semibold text-cyan-400">Aturan Atomic 1-to-1:</span> 1 MCID hanya dapat memiliki 1 MAC Address aktif, dan 1 MAC Address tidak boleh digunakan oleh lebih dari 1 MCID.
            </p>
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

          {/* MCID Input */}
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Machine Control ID (MCID) <span className="text-cyan-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={mcid}
                onChange={(e) => setMcid(e.target.value.toUpperCase())}
                placeholder="Contoh: CNC-VF2-01"
                className="flex-1 px-3.5 py-2.5 text-sm font-mono bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => onOpenScanner('mcid')}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl border border-slate-700/80 flex items-center gap-1.5 text-xs font-medium transition-colors shrink-0 active:scale-95"
                title="Scan Barcode / QR Code MCID"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden xs:inline">Scan</span>
              </button>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
              ID unik mesin pabrik yang tertera pada plat bodi mesin.
            </p>
          </div>

          {/* MAC Address Input */}
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              MAC Address IoT <span className="text-cyan-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={macAddress}
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
                title="Scan Barcode / QR Code MAC Address"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden xs:inline">Scan</span>
              </button>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
              Alamat fisik modul IoT / ESP32 / Gateway yang dipasang.
            </p>
          </div>

          {/* Machine Model & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Model / Tipe Mesin <span className="text-cyan-400">*</span>
              </label>
              <input
                type="text"
                value={machineModel}
                onChange={(e) => setMachineModel(e.target.value)}
                placeholder="Contoh: Haas CNC VF-2"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Lokasi Pabrik <span className="text-cyan-400">*</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Contoh: Plant 1 - Line A"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Catatan Teknis / Sensor Terpasang (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Contoh: Sensor getaran tri-axial dan modul ESP32..."
              className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
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
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/30 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Simpan Instalasi (Atomic Tx)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
