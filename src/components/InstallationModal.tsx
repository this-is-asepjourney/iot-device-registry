'use client';

import React, { useState } from 'react';
import { X, Camera, PlusCircle, AlertCircle, CheckCircle2, Loader2, Info, Building2, Layers, Calendar, Clock } from 'lucide-react';
import { installDevice } from '@/lib/device-service';
import { formatMacAddress, isValidMacAddress, normalizeMcid, formatLocation, getFactoryBadgeStyle, toLocalDatetimeInputString } from '@/lib/utils';
import { FACTORY_LIST, FactoryCode } from '@/types';
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
  const [selectedFactory, setSelectedFactory] = useState<FactoryCode>('A1');
  const [line, setLine] = useState('');
  const [installedAt, setInstalledAt] = useState<string>(() => toLocalDatetimeInputString(new Date()));
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync props if modal opens with prefilled scanned data
  React.useEffect(() => {
    if (initialMcid) setMcid(initialMcid);
    if (initialMac) setMacAddress(initialMac);
    if (isOpen) {
      setInstalledAt(toLocalDatetimeInputString(new Date()));
    }
  }, [initialMcid, initialMac, isOpen]);

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

    setLoading(true);
    const technician = user?.email || demoUser?.email || 'technician@factory.local';
    const finalLocation = formatLocation(selectedFactory, line);
    const parsedInstalledAt = installedAt ? new Date(installedAt).toISOString() : new Date().toISOString();

    try {
      await installDevice({
        mcid: normMcid,
        macAddress,
        machineModel: machineModel.trim(),
        location: finalLocation,
        notes: notes.trim(),
        technicianEmail: technician,
        installedAt: parsedInstalledAt,
      });

      setSuccessMessage(`Berhasil mendaftarkan instalasi untuk MCID [${normMcid}] dengan MAC [${macAddress}].`);
      setTimeout(() => {
        setSuccessMessage(null);
        setMcid('');
        setMacAddress('');
        setMachineModel('');
        setLine('');
        setInstalledAt(toLocalDatetimeInputString(new Date()));
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

          {/* 1. MCID Input */}
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              1. Machine Control ID (MCID) <span className="text-cyan-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={mcid}
                onChange={(e) => setMcid(e.target.value.toUpperCase())}
                placeholder="Contoh: CNC-VF2-01"
                className="flex-1 px-3.5 py-2.5 text-sm font-mono bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors uppercase"
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

          {/* 2. MAC Address Input */}
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              2. MAC Address IoT <span className="text-cyan-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={macAddress}
                onChange={handleMacChange}
                maxLength={17}
                placeholder="XX:XX:XX:XX:XX:XX"
                className="flex-1 px-3.5 py-2.5 text-sm font-mono bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors uppercase"
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
              Alamat fisik 12 karakter heksadesimal modul IoT / ESP32 / Gateway.
            </p>
          </div>

          {/* 3. Model Mesin (Opsional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300">
                3. Model Mesin <span className="text-slate-500 font-normal lowercase">(opsional)</span>
              </label>
            </div>
            <input
              type="text"
              value={machineModel}
              onChange={(e) => setMachineModel(e.target.value)}
              placeholder="Contoh: Haas CNC VF-2, Aida 50 Ton Press (Opsional)..."
              className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
            />
            <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
              Merk dan tipe spesifikasi mesin manufaktur (opsional, dapat diisi atau diperbarui nanti).
            </p>
          </div>

          {/* 4. Factory Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>4. Factory Pabrik</span> <span className="text-cyan-400">*</span>
              </label>
              <span className="text-[11px] text-cyan-400 font-semibold font-mono">
                Factory {selectedFactory}
              </span>
            </div>

            {/* Factory Chips Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {FACTORY_LIST.map((f) => {
                const isSelected = selectedFactory === f;
                const style = getFactoryBadgeStyle(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSelectedFactory(f)}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/25 scale-105'
                        : `${style.bg} ${style.text} ${style.border} hover:opacity-90 active:scale-95`
                    }`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              Pilih area factory tempat mesin beroperasi (A1, A2, B1, B2, C1, C2, D1, D2).
            </p>
          </div>

          {/* 5. Line Input */}
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>5. Line / Lini Produksi</span>
            </label>
            <input
              type="text"
              value={line}
              onChange={(e) => setLine(e.target.value)}
              placeholder="Contoh: Line 1, Stamping Line A, Assembly Line 3..."
              className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500">
              <span>Nomor atau nama lintasan mesin</span>
              <span className="text-slate-400 font-mono">
                Lokasi: <strong className="text-cyan-400">{formatLocation(selectedFactory, line)}</strong>
              </span>
            </div>
          </div>

          {/* 6. Waktu / Tanggal Pemasangan */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>6. Waktu / Tanggal Pemasangan</span> <span className="text-cyan-400">*</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setInstalledAt(toLocalDatetimeInputString(new Date()))}
                  className="px-2 py-0.5 text-[10px] rounded font-medium bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-colors"
                >
                  Sekarang
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    setInstalledAt(toLocalDatetimeInputString(d));
                  }}
                  className="px-2 py-0.5 text-[10px] rounded font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  Kemarin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 2);
                    setInstalledAt(toLocalDatetimeInputString(d));
                  }}
                  className="px-2 py-0.5 text-[10px] rounded font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  2 Hari Lalu
                </button>
              </div>
            </div>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="datetime-local"
                value={installedAt}
                onChange={(e) => setInstalledAt(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                required
              />
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
              Sesuaikan tanggal & jam jika pemasangan fisik dilakukan pada hari sebelumnya (tidak harus hari H upload).
            </p>
          </div>

          {/* 7. Catatan Tambahan (Opsional) */}
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              7. Catatan Tambahan (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Contoh: Modul IoT ESP32 sensor getaran & suhu spindel, kabel power 24V..."
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
              <span>Simpan Instalasi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
