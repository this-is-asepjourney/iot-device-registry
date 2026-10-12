'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  Cpu,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Building2,
  Scan,
  ShieldAlert,
} from 'lucide-react';
import { Device, DeviceStatus, FACTORY_LIST, FactoryCode } from '@/types';
import { editDevice, deleteDevice } from '@/lib/device-service';
import { formatMacAddress, normalizeMacAddress, isValidMacAddress, extractFactory, getFactoryBadgeStyle } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface EditDeviceModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenScannerForEditMac?: () => void;
  scannedNewMac?: string;
}

export function EditDeviceModal({
  device,
  isOpen,
  onClose,
  onOpenScannerForEditMac,
  scannedNewMac,
}: EditDeviceModalProps) {
  const { demoUser } = useAuth();
  const [machineModel, setMachineModel] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [selectedFactory, setSelectedFactory] = useState<FactoryCode>('A1');
  const [subLocation, setSubLocation] = useState('');
  const [status, setStatus] = useState<DeviceStatus>('Installed');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (device) {
      setMachineModel(device.machineModel || '');
      setMacAddress(device.macAddress || '');
      setStatus(device.status);
      setNotes(device.notes || '');
      setShowDeleteConfirm(false);
      setErrorMessage(null);
      setSuccessMessage(null);

      // Extract factory code or fallback to A1
      const extracted = extractFactory(device.location) as FactoryCode | null;
      if (extracted && FACTORY_LIST.includes(extracted)) {
        setSelectedFactory(extracted);
        // Clean sublocation
        const cleaned = device.location.replace(new RegExp(`^Factory\\s*${extracted}\\s*[-–]?\\s*`, 'i'), '').trim();
        setSubLocation(cleaned);
      } else {
        setSelectedFactory('A1');
        setSubLocation(device.location);
      }
    }
  }, [device, isOpen]);

  // Sync scanned MAC if user scanned from camera modal
  useEffect(() => {
    if (scannedNewMac && isOpen) {
      setMacAddress(formatMacAddress(scannedNewMac));
    }
  }, [scannedNewMac, isOpen]);

  if (!isOpen || !device) return null;

  const handleMacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMacAddress(formatMacAddress(e.target.value));
  };

  const handleFactorySelect = (factory: FactoryCode) => {
    setSelectedFactory(factory);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normMac = normalizeMacAddress(macAddress);
    if (!isValidMacAddress(normMac)) {
      setErrorMessage('Format MAC Address tidak valid. Harus 12 digit hexadecimal.');
      return;
    }

    if (!machineModel.trim()) {
      setErrorMessage('Nama / model mesin tidak boleh kosong.');
      return;
    }

    // Combine factory and subLocation
    const finalLocation = subLocation.trim()
      ? `Factory ${selectedFactory} - ${subLocation.trim()}`
      : `Factory ${selectedFactory}`;

    setIsSubmitting(true);
    try {
      await editDevice({
        mcid: device.mcid,
        macAddress,
        machineModel: machineModel.trim(),
        location: finalLocation,
        status,
        notes: notes.trim(),
        technicianEmail: demoUser?.email || 'Admin',
      });

      setSuccessMessage(`Data mesin ${device.mcid} berhasil diperbarui.`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await deleteDevice({
        mcid: device.mcid,
        technicianEmail: demoUser?.email || 'Admin',
        notes: `Dihapus melalui modal edit: ${device.mcid}`,
      });
      setSuccessMessage(`Perangkat ${device.mcid} berhasil dihapus.`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">
                  Edit Data Mesin & IoT
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-500/30">
                  {device.mcid}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Perbaiki kesalahan input nama mesin, lokasi factory, atau modul MAC
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

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/50 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-600/50 flex items-start gap-2.5 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* Delete Confirmation Box */}
          {showDeleteConfirm ? (
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800 space-y-3">
              <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs sm:text-sm">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Konfirmasi Penghapusan Perangkat</span>
              </div>
              <p className="text-xs text-rose-200 leading-relaxed">
                Apakah Anda yakin ingin menghapus data <strong>{device.mcid}</strong>? Tindakan ini akan menghapus mesin dari daftar dan membebaskan MAC address <code>{device.macAddress}</code> dari sistem.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Ya, Hapus Sekarang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="py-2 px-3 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Field MCID (Read-Only) */}
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Machine Control ID (MCID)
              </label>
              <div className="relative">
                <Cpu className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={device.mcid}
                  disabled
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-950/60 border border-slate-800 rounded-xl text-slate-400 font-mono cursor-not-allowed"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">MCID merupakan primary key unik mesin pabrik.</p>
            </div>

            {/* Field Model Mesin */}
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Nama / Model Mesin
              </label>
              <input
                type="text"
                value={machineModel}
                onChange={(e) => setMachineModel(e.target.value)}
                placeholder="Contoh: Haas CNC Milling VF-2"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                required
              />
            </div>

            {/* Field Factory & Location */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Pilih Factory Pabrik</span>
                </label>
                <span className="text-[11px] text-cyan-400 font-medium">
                  Factory Aktif: <strong>{selectedFactory}</strong>
                </span>
              </div>

              {/* Factory Grid Chips */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 mb-2.5">
                {FACTORY_LIST.map((code) => {
                  const style = getFactoryBadgeStyle(code);
                  const isSelected = selectedFactory === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleFactorySelect(code)}
                      className={`py-2 px-1 text-xs font-bold rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20 scale-105'
                          : `${style.bg} ${style.text} ${style.border} hover:opacity-90 active:scale-95`
                      }`}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>

              {/* Sub-location / Section Line */}
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={subLocation}
                  onChange={(e) => setSubLocation(e.target.value)}
                  placeholder="Detail workshop / lini (Contoh: Machining Line A - Section 1)"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Lokasi tersimpan: <strong className="text-slate-300">Factory {selectedFactory}{subLocation ? ` - ${subLocation}` : ''}</strong>
              </p>
            </div>

            {/* Field MAC Address (With Scanner Support) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300">
                  MAC Address IoT Module
                </label>
                {onOpenScannerForEditMac && (
                  <button
                    type="button"
                    onClick={onOpenScannerForEditMac}
                    className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <Scan className="w-3.5 h-3.5" />
                    <span>Scan Kamera</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={macAddress}
                onChange={handleMacChange}
                maxLength={17}
                placeholder="XX:XX:XX:XX:XX:XX"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors uppercase"
                required
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Jika MAC diubah, sistem akan memvalidasi aturan 1-to-1 secara atomik pada database D1.
              </p>
            </div>

            {/* Field Status */}
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Status Perangkat
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Installed', 'Maintenance', 'Removed'] as DeviceStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition-all ${
                      status === st
                        ? st === 'Installed'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md'
                          : st === 'Maintenance'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st === 'Installed' ? 'Installed' : st === 'Maintenance' ? 'Maintenance' : 'Removed'}
                  </button>
                ))}
              </div>
            </div>

            {/* Field Notes */}
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Catatan Teknis / Koreksi
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Catatan perbaikan kesalahan input atau spesifikasi sensor..."
                  className="w-full pl-10 pr-3.5 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none transition-colors"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Simpan Perubahan</span>
              </button>

              {!showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="py-2.5 px-3 text-xs font-medium rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800/60 transition-colors"
                  title="Hapus perangkat dari sistem"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
