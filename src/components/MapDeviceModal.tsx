'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  Cpu,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Building2,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  Clock,
} from 'lucide-react';
import { InstallationPlan, Device, FactoryCode, FACTORY_LIST } from '@/types';
import { completePlan } from '@/lib/device-service';
import {
  formatMacAddress,
  isValidMacAddress,
  normalizeMacAddress,
  normalizeMcid,
  extractFactory,
  extractLine,
  formatLocation,
  getFactoryBadgeStyle,
  toLocalDatetimeInputString,
} from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface MapDeviceModalProps {
  plan: InstallationPlan | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenScanner: () => void;
  scannedMac?: string;
  existingDevices: Device[];
}

export function MapDeviceModal({
  plan,
  isOpen,
  onClose,
  onOpenScanner,
  scannedMac = '',
  existingDevices,
}: MapDeviceModalProps) {
  const { user, demoUser } = useAuth();

  const [macAddress, setMacAddress] = useState('');
  const [machineModel, setMachineModel] = useState('');
  const [selectedFactory, setSelectedFactory] = useState<FactoryCode>('A1');
  const [line, setLine] = useState('');
  const [installedAt, setInstalledAt] = useState(() => toLocalDatetimeInputString(new Date()));
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Prefill data from selected plan
  useEffect(() => {
    if (plan) {
      setMachineModel(plan.machineModel || '');
      setNotes(plan.notes ? `Pemasangan IoT: ${plan.notes}` : '');

      // Parse factory and line from plan location
      const fact = extractFactory(plan.location);
      if (fact && FACTORY_LIST.includes(fact as FactoryCode)) {
        setSelectedFactory(fact as FactoryCode);
      }
      setLine(extractLine(plan.location));
      setMacAddress('');
      setInstalledAt(toLocalDatetimeInputString(new Date()));
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [plan]);

  // Handle scanned MAC from scanner
  useEffect(() => {
    if (scannedMac) {
      setMacAddress(formatMacAddress(scannedMac));
    }
  }, [scannedMac]);

  if (!isOpen || !plan) return null;

  const handleMacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMacAddress(e.target.value);
    setMacAddress(formatted);
  };

  // Real-time conflict validation
  const normInputMac = normalizeMacAddress(macAddress);
  const conflictingDevice =
    normInputMac.length === 12
      ? existingDevices.find(
          (d) =>
            d.normalizedMac === normInputMac &&
            d.mcid.toUpperCase() !== plan.mcid.toUpperCase() &&
            d.status !== 'Removed'
        )
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normMcid = normalizeMcid(plan.mcid);

    if (!isValidMacAddress(macAddress) || normInputMac.length !== 12) {
      setErrorMessage('Format MAC Address harus valid 12 digit heksadesimal (contoh: AA:BB:CC:11:22:33).');
      return;
    }

    if (conflictingDevice) {
      setErrorMessage(
        `MAC Address [${macAddress}] sudah aktif di mesin lain (MCID: ${conflictingDevice.mcid}). Aturan 1:1 melarang duplikasi MAC.`
      );
      return;
    }

    setLoading(true);
    const technician = user?.email || demoUser?.email || 'technician@factory.local';
    const finalLocation = formatLocation(selectedFactory, line);
    const parsedInstalledAt = installedAt ? new Date(installedAt).toISOString() : new Date().toISOString();

    try {
      await completePlan({
        planId: plan.id,
        mcid: normMcid,
        macAddress,
        machineModel: machineModel.trim() || plan.machineModel,
        location: finalLocation,
        notes: notes.trim(),
        technicianEmail: technician,
        installedAt: parsedInstalledAt,
      });

      setSuccessMessage(
        `Sukses! Modul IoT [${macAddress}] telah terpasang & dipetakan ke mesin [${normMcid}].`
      );

      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1300);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const factoryBadge = getFactoryBadgeStyle(selectedFactory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl p-4 sm:p-6 text-slate-100 my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Mapping Modul IoT ke Mesin</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Pemasangan unit IoT fisik sesuai rencana instalasi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Machine Planning Info Banner */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Mesin Tujuan (Target Plan)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Menunggu Pemasangan
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div>
              <div className="font-mono text-base sm:text-lg font-extrabold text-cyan-400">
                {plan.mcid}
              </div>
              <div className="text-xs text-slate-300 font-medium">
                {plan.machineModel || 'Model mesin belum ditentukan'}
              </div>
            </div>
            {plan.location && (
              <span className="text-right text-[11px] text-slate-400 max-w-[180px] truncate">
                {plan.location}
              </span>
            )}
          </div>

          {plan.notes && (
            <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2">Catatan Request: {plan.notes}</span>
            </div>
          )}
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {conflictingDevice && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>
              Perhatian: MAC Address [<strong>{macAddress}</strong>] sedang aktif di mesin [
              <strong>{conflictingDevice.mcid}</strong>]. Pemasangan tidak dapat diproses jika MAC
              tersebut belum dilepas (Aturan 1:1).
            </span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* MAC Address (Primary Focus) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200">
              MAC Address Modul IoT Terpasang <span className="text-rose-400">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={macAddress}
                  onChange={handleMacChange}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  maxLength={17}
                  disabled={loading}
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 font-mono text-sm sm:text-base tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors uppercase"
                />
                {normInputMac.length === 12 && !conflictingDevice && (
                  <div className="absolute right-3 top-3 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onOpenScanner}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-cyan-400 text-xs font-semibold rounded-xl border border-cyan-500/30 transition-all shrink-0"
                title="Scan barcode atau QR code modul fisik menggunakan kamera"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Scan Kamera</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 flex items-center justify-between">
              <span>Input 12 karakter MAC address fisik modul IoT (titik dua otomatis).</span>
              <span className="font-mono text-slate-400">{normInputMac.length}/12</span>
            </p>
          </div>

          {/* Machine Model (Editable) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200">
              Model Mesin
            </label>
            <input
              type="text"
              value={machineModel}
              onChange={(e) => setMachineModel(e.target.value)}
              placeholder="Contoh: Haas CNC Milling VF-2"
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Location: Factory & Line */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-200 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pabrik (Factory)</span>
              </label>
              <select
                value={selectedFactory}
                onChange={(e) => setSelectedFactory(e.target.value as FactoryCode)}
                disabled={loading}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-950 border border-slate-800 focus:outline-none focus:border-cyan-500 ${factoryBadge.text}`}
              >
                {FACTORY_LIST.map((code) => (
                  <option key={code} value={code} className="bg-slate-900 text-slate-200">
                    Factory {code}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-200 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Jalur / Line</span>
              </label>
              <input
                type="text"
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder="Contoh: Line 1 / Stamping Bay"
                disabled={loading}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* Waktu / Tanggal Pemasangan */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Waktu / Tanggal Pemasangan</span> <span className="text-cyan-400">*</span>
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
              </div>
            </div>
            <div className="relative">
              <Clock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="datetime-local"
                value={installedAt}
                onChange={(e) => setInstalledAt(e.target.value)}
                disabled={loading}
                className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
                required
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Sesuaikan jika instalasi fisik dilakukan pada hari sebelumnya (tidak harus hari H).
            </p>
          </div>

          {/* Installation Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200">
              Catatan Pemasangan (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tambahkan catatan teknis pemasangan modul sensor, gateway, dsb."
              rows={2}
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500 transition-colors resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || normInputMac.length !== 12 || Boolean(conflictingDevice)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-cyan-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memetakan & Menyimpan...</span>
                </>
              ) : (
                <>
                  <span>Simpan & Petakan IoT</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
