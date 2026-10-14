'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  PlusCircle,
  UploadCloud,
  Download,
  FileSpreadsheet,
  Cpu,
  Edit3,
  Trash2,
  Layers,
  Building2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { InstallationPlan, PlanStatus, FACTORY_LIST } from '@/types';
import {
  formatDate,
  extractFactory,
  getFactoryBadgeStyle,
} from '@/lib/utils';
import {
  downloadPlanTemplateExcel,
  downloadPlanTemplateCsv,
  exportPlansToExcel,
} from '@/lib/excel-utils';
import { deletePlan } from '@/lib/device-service';

interface PlanningListProps {
  plans: InstallationPlan[];
  onOpenCreateModal: () => void;
  onOpenImportModal: () => void;
  onOpenMapModal: (plan: InstallationPlan) => void;
  onOpenEditModal: (plan: InstallationPlan) => void;
  onNavigateToDevice?: (mcid: string) => void;
}

export function PlanningList({
  plans,
  onOpenCreateModal,
  onOpenImportModal,
  onOpenMapModal,
  onOpenEditModal,
  onNavigateToDevice,
}: PlanningListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PlanStatus>('ALL');
  const [factoryFilter, setFactoryFilter] = useState<'ALL' | string>('ALL');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Metrics
  const totalCount = plans.length;
  const plannedCount = plans.filter((p) => p.status === 'Planned').length;
  const installedCount = plans.filter((p) => p.status === 'Installed').length;
  const completionRate = totalCount > 0 ? Math.round((installedCount / totalCount) * 100) : 0;

  // Filtered plans
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      // Status filter
      if (statusFilter !== 'ALL' && p.status !== statusFilter) {
        return false;
      }

      // Factory filter
      if (factoryFilter !== 'ALL') {
        const fact = extractFactory(p.location);
        if (fact !== factoryFilter) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchMcid = p.mcid.toLowerCase().includes(q);
        const matchModel = (p.machineModel || '').toLowerCase().includes(q);
        const matchLoc = (p.location || '').toLowerCase().includes(q);
        const matchNotes = (p.notes || '').toLowerCase().includes(q);
        const matchMac = (p.installedMac || '').toLowerCase().includes(q);
        if (!matchMcid && !matchModel && !matchLoc && !matchNotes && !matchMac) {
          return false;
        }
      }

      return true;
    });
  }, [plans, statusFilter, factoryFilter, searchQuery]);

  const handleDelete = async (id: string, mcid: string) => {
    if (!confirm(`Hapus rencana pemasangan untuk mesin [${mcid}]?`)) return;
    setIsDeletingId(id);
    try {
      await deletePlan({ id });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus rencana.');
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Header & KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Plans */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-sm relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-slate-400">Total Rencana Mesin</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
              {totalCount}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Unit</span>
          </div>
        </div>

        {/* Pending Installation */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Planned' ? 'ALL' : 'Planned')}
          className={`p-3.5 sm:p-4 rounded-2xl border backdrop-blur-sm relative overflow-hidden shadow-lg cursor-pointer transition-all ${
            statusFilter === 'Planned'
              ? 'bg-amber-950/30 border-amber-500/50 ring-1 ring-amber-500/30'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-amber-400">Menunggu Pemasangan</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-3xl font-extrabold text-amber-400 tracking-tight">
              {plannedCount}
            </span>
            <span className="text-[11px] text-amber-400/70 font-mono">Perlu Diinstal</span>
          </div>
        </div>

        {/* Installed / Completed */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Installed' ? 'ALL' : 'Installed')}
          className={`p-3.5 sm:p-4 rounded-2xl border backdrop-blur-sm relative overflow-hidden shadow-lg cursor-pointer transition-all ${
            statusFilter === 'Installed'
              ? 'bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/30'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-emerald-400">Selesai Dipasang</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight">
              {installedCount}
            </span>
            <span className="text-[11px] text-emerald-400/70 font-mono">Aktif</span>
          </div>
        </div>

        {/* Progress % */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-sm relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-slate-400">Penyelesaian Rencana</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                {completionRate}%
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {installedCount}/{totalCount}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Actions & Filter Toolbar */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md space-y-3.5 shadow-xl">
        {/* Top Action Row: Title & Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>List Planning Pemasangan IoT</span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {filteredPlans.length} Mesin
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Daftar mesin pabrik yang direncanakan untuk instalasi modul IoT. Inputkan MAC address saat pemasangan di mesin selesai.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Download Template Excel Dropdown/Button */}
            <div className="relative group">
              <button
                onClick={() => downloadPlanTemplateExcel()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 shadow-sm transition-all active:scale-95"
                title="Download Format Template Excel (.xlsx) untuk diisi"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Format Template Excel</span>
              </button>
            </div>

            {/* Import Excel */}
            <button
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 hover:border-cyan-500/70 shadow-sm transition-all active:scale-95"
              title="Upload file Excel atau CSV yang sudah diisi"
            >
              <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
              <span>Import Excel</span>
            </button>

            {/* Tambah Plan Manual */}
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-950/40 transition-all active:scale-95"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Tambah Plan</span>
            </button>

            {/* Export Laporan */}
            {plans.length > 0 && (
              <button
                onClick={() => exportPlansToExcel(plans)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                title="Export seluruh daftar planning ke Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">Export Laporan</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-2 border-t border-slate-800/60">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari MCID, model mesin, factory, catatan, atau MAC..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200 text-xs"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {/* Status Filter Tabs */}
            <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 text-[11px] shrink-0">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-800 text-slate-100 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Semua ({totalCount})
              </button>
              <button
                onClick={() => setStatusFilter('Planned')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  statusFilter === 'Planned'
                    ? 'bg-amber-500/20 text-amber-300 shadow'
                    : 'text-slate-400 hover:text-amber-400'
                }`}
              >
                Menunggu ({plannedCount})
              </button>
              <button
                onClick={() => setStatusFilter('Installed')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  statusFilter === 'Installed'
                    ? 'bg-emerald-500/20 text-emerald-300 shadow'
                    : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                Selesai ({installedCount})
              </button>
            </div>

            {/* Factory Filter */}
            <select
              value={factoryFilter}
              onChange={(e) => setFactoryFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-medium text-slate-300 focus:outline-none focus:border-cyan-500 shrink-0"
            >
              <option value="ALL">Semua Factory</option>
              {FACTORY_LIST.map((f) => (
                <option key={f} value={f}>
                  Factory {f}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Planning Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
        {filteredPlans.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="inline-flex p-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-500">
              <Calendar className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-semibold text-slate-300">
              {plans.length === 0
                ? 'Belum ada rencana pemasangan IoT'
                : 'Tidak ada rencana yang cocok dengan filter'}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {plans.length === 0
                ? 'Mulai dengan mendownload format template Excel, isi kolom MCID mesin pabrik, dan import kembali file tersebut ke sistem.'
                : 'Coba ubah kata kunci pencarian atau reset filter status dan factory.'}
            </p>
            {plans.length === 0 && (
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  onClick={() => downloadPlanTemplateExcel()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 shadow-sm transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Format Excel</span>
                </button>
                <button
                  onClick={onOpenImportModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-900/30 transition-all"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Import Excel</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3.5 sm:px-4">Mesin / MCID</th>
                  <th className="py-3 px-3.5 sm:px-4">Lokasi Pabrik</th>
                  <th className="py-3 px-3.5 sm:px-4">Status Planning</th>
                  <th className="py-3 px-3.5 sm:px-4">MAC Address Terpasang</th>
                  <th className="py-3 px-3.5 sm:px-4">Target & Catatan</th>
                  <th className="py-3 px-3.5 sm:px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 font-normal">
                {filteredPlans.map((plan) => {
                  const factoryCode = extractFactory(plan.location);
                  const badge = getFactoryBadgeStyle(factoryCode);
                  const isInstalled = plan.status === 'Installed';

                  return (
                    <tr
                      key={plan.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* MCID & Model */}
                      <td className="py-3.5 px-3.5 sm:px-4">
                        <div className="font-mono text-sm font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors">
                          {plan.mcid}
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium truncate max-w-[200px]">
                          {plan.machineModel || 'Model belum ditentukan'}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-3.5 sm:px-4">
                        {factoryCode ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              Factory {factoryCode}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate max-w-[150px]">
                              {plan.location?.replace(new RegExp(`Factory\\s*${factoryCode}\\s*[-–]?\\s*`, 'i'), '') || plan.location}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {plan.location || '-'}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3.5 sm:px-4">
                        {isInstalled ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>Selesai Terpasang</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <span>Menunggu Pemasangan</span>
                          </span>
                        )}
                      </td>

                      {/* MAC Address (Mapped or Pending) */}
                      <td className="py-3.5 px-3.5 sm:px-4 font-mono">
                        {plan.installedMac ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-400 text-xs font-semibold">
                              {plan.installedMac}
                            </span>
                            <span className="text-[10px] text-slate-500 hidden xl:inline">
                              (Terpetakan)
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">
                            Belum terpasang
                          </span>
                        )}
                      </td>

                      {/* Target Date & Notes */}
                      <td className="py-3.5 px-3.5 sm:px-4 max-w-xs">
                        {plan.targetDate && (
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mb-0.5">
                            <Clock className="w-3 h-3 text-cyan-400" />
                            <span>Target: {plan.targetDate}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 line-clamp-2">
                          {plan.notes || '-'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3.5 sm:px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* PRIMARY ACTION: Pasang IoT (Mapping MAC) */}
                          {!isInstalled ? (
                            <button
                              onClick={() => onOpenMapModal(plan)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-[11px] shadow-sm shadow-cyan-900/30 transition-all active:scale-95"
                              title="Input atau scan MAC address IoT yang sudah dipasang di mesin ini"
                            >
                              <Cpu className="w-3.5 h-3.5" />
                              <span>Pasang IoT (Input MAC)</span>
                            </button>
                          ) : (
                            onNavigateToDevice && (
                              <button
                                onClick={() => onNavigateToDevice(plan.mcid)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 text-[11px] font-medium transition-colors"
                                title="Lihat mesin di tab Registry IoT"
                              >
                                <span>Lihat Unit</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )
                          )}

                          {/* Edit Plan */}
                          <button
                            onClick={() => onOpenEditModal(plan)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                            title="Edit rencana"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Plan */}
                          <button
                            onClick={() => handleDelete(plan.id, plan.mcid)}
                            disabled={isDeletingId === plan.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors disabled:opacity-50"
                            title="Hapus rencana"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
