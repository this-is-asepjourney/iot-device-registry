'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit3, AlertCircle, CheckCircle2, Loader2, Building2, Layers, Calendar } from 'lucide-react';
import { editPlan } from '@/lib/device-service';
import {
  normalizeMcid,
  extractFactory,
  extractLine,
  formatLocation,
  getFactoryBadgeStyle,
} from '@/lib/utils';
import { InstallationPlan, PlanStatus, FACTORY_LIST, FactoryCode } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface EditPlanModalProps {
  plan: InstallationPlan | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditPlanModal({ plan, isOpen, onClose }: EditPlanModalProps) {
  const { user, demoUser } = useAuth();
  const [mcid, setMcid] = useState('');
  const [machineModel, setMachineModel] = useState('');
  const [selectedFactory, setSelectedFactory] = useState<FactoryCode>('A1');
  const [line, setLine] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<PlanStatus>('Planned');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (plan) {
      setMcid(plan.mcid);
      setMachineModel(plan.machineModel || '');
      const fact = extractFactory(plan.location);
      if (fact && FACTORY_LIST.includes(fact as FactoryCode)) {
        setSelectedFactory(fact as FactoryCode);
      }
      setLine(extractLine(plan.location));
      setTargetDate(plan.targetDate || '');
      setStatus(plan.status);
      setNotes(plan.notes || '');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [plan]);

  if (!isOpen || !plan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normMcid = normalizeMcid(mcid);
    if (!normMcid) {
      setErrorMessage('Machine ID (MCID) wajib diisi.');
      return;
    }

    setLoading(true);
    const technician = user?.email || demoUser?.email || 'admin@plant.local';
    const finalLocation = formatLocation(selectedFactory, line);

    try {
      await editPlan({
        id: plan.id,
        mcid: normMcid,
        machineModel: machineModel.trim() || undefined,
        location: finalLocation || undefined,
        targetDate: targetDate || undefined,
        status,
        notes: notes.trim() || undefined,
        technicianEmail: technician,
      });

      setSuccessMessage(`Berhasil memperbarui rencana untuk mesin [${normMcid}].`);
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

  const factoryBadge = getFactoryBadgeStyle(selectedFactory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-6 text-slate-100 my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Edit Rencana Pemasangan
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Ubah rincian target instalasi untuk mesin {plan.mcid}
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

        {/* Alerts */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* MCID */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-200">
              Machine ID (MCID) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={mcid}
              onChange={(e) => setMcid(e.target.value)}
              disabled={loading}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 font-mono text-sm uppercase focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Model Mesin */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-200">
              Model / Nama Mesin
            </label>
            <input
              type="text"
              value={machineModel}
              onChange={(e) => setMachineModel(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-200">
              Status Rencana
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PlanStatus)}
              disabled={loading}
              className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="Planned">Menunggu Pemasangan (Planned)</option>
              <option value="Installed">Selesai Terpasang (Installed)</option>
              <option value="Cancelled">Dibatalkan (Cancelled)</option>
            </select>
          </div>

          {/* Factory & Line */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-200 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Factory</span>
              </label>
              <select
                value={selectedFactory}
                onChange={(e) => setSelectedFactory(e.target.value as FactoryCode)}
                disabled={loading}
                className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold bg-slate-950 border border-slate-800 focus:outline-none focus:border-cyan-500 ${factoryBadge.text}`}
              >
                {FACTORY_LIST.map((code) => (
                  <option key={code} value={code} className="bg-slate-900 text-slate-200">
                    Factory {code}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-200 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Line</span>
              </label>
              <input
                type="text"
                value={line}
                onChange={(e) => setLine(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* Target Date */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-200 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Target Tanggal</span>
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-200">
              Catatan Kebutuhan Request
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500 transition-colors resize-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
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
              disabled={loading || !mcid.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-cyan-900/30 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
