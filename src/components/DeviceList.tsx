'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Wrench,
  History,
  Copy,
  Check,
  Cpu,
  MapPin,
  Clock,
  Layers,
  Edit3,
  Building2,
} from 'lucide-react';
import { Device, DeviceStatus, FACTORY_LIST } from '@/types';
import { formatDate, extractFactory, getFactoryBadgeStyle } from '@/lib/utils';

interface DeviceListProps {
  devices: Device[];
  statusFilter: 'ALL' | DeviceStatus;
  factoryFilter: 'ALL' | string;
  onChangeStatusFilter: (status: 'ALL' | DeviceStatus) => void;
  onChangeFactoryFilter: (factory: 'ALL' | string) => void;
  onOpenEditModal: (device: Device) => void;
  onOpenReplaceModal: (device: Device) => void;
  onOpenStatusModal: (device: Device) => void;
  onOpenHistoryModal: (mcid: string) => void;
  onOpenInstallModal: () => void;
}

export function DeviceList({
  devices,
  statusFilter,
  factoryFilter,
  onChangeStatusFilter,
  onChangeFactoryFilter,
  onOpenEditModal,
  onOpenReplaceModal,
  onOpenStatusModal,
  onOpenHistoryModal,
  onOpenInstallModal,
}: DeviceListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      !searchTerm ||
      d.mcid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.macAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.machineModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;

    const deviceFactory = extractFactory(d.location);
    const matchesFactory = factoryFilter === 'ALL' || deviceFactory === factoryFilter;

    return matchesSearch && matchesStatus && matchesFactory;
  });

  const getStatusBadge = (status: DeviceStatus) => {
    switch (status) {
      case 'Installed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Installed
          </span>
        );
      case 'Maintenance':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Maintenance
          </span>
        );
      case 'Removed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Removed
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Top Search & Filter Toolbar */}
      <div className="p-3.5 sm:p-5 border-b border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari MCID, MAC, Model, Lokasi..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none -mx-1 px-1 sm:mx-0 sm:px-0">
            <Filter className="w-3.5 h-3.5 text-slate-500 mr-1 hidden sm:block shrink-0" />
            {(['ALL', 'Installed', 'Maintenance', 'Removed'] as const).map((st) => (
              <button
                key={st}
                onClick={() => onChangeStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all shrink-0 active:scale-95 ${
                  statusFilter === st
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {st === 'ALL' ? 'Semua Status' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Factory Filter Bar (A1, A2, B1, B2, C1, C2, D1, D2) */}
        <div className="pt-2 border-t border-slate-800/60 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 mr-1 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden xs:inline">Factory:</span>
          </div>

          <button
            onClick={() => onChangeFactoryFilter('ALL')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-all shrink-0 active:scale-95 ${
              factoryFilter === 'ALL'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Semua ({devices.length})
          </button>

          {FACTORY_LIST.map((fac) => {
            const count = devices.filter((d) => extractFactory(d.location) === fac).length;
            const badgeStyle = getFactoryBadgeStyle(fac);
            const isSelected = factoryFilter === fac;

            return (
              <button
                key={fac}
                onClick={() => onChangeFactoryFilter(fac)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border whitespace-nowrap transition-all shrink-0 active:scale-95 flex items-center gap-1 ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm scale-105'
                    : `${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} hover:opacity-90`
                }`}
              >
                <span>{fac}</span>
                <span className={`text-[10px] px-1 py-0.2 rounded-full ${isSelected ? 'bg-slate-900 text-cyan-300' : 'bg-slate-900/80 text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {filteredDevices.length === 0 ? (
        <div className="p-8 sm:p-12 text-center flex flex-col items-center justify-center">
          <div className="p-3 rounded-2xl bg-slate-800/50 text-slate-500 mb-3">
            <Layers className="w-8 h-8" />
          </div>
          <h4 className="text-sm font-semibold text-slate-300">Tidak ada perangkat ditemukan</h4>
          <p className="text-xs text-slate-500 max-w-xs mt-1">
            {searchTerm || statusFilter !== 'ALL' || factoryFilter !== 'ALL'
              ? 'Coba ganti kata kunci pencarian atau sesuaikan filter status / factory.'
              : 'Belum ada perangkat IoT yang terdaftar di sistem.'}
          </p>
          <div className="flex gap-2 mt-4">
            {(searchTerm || statusFilter !== 'ALL' || factoryFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  onChangeStatusFilter('ALL');
                  onChangeFactoryFilter('ALL');
                }}
                className="px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Reset Filter
              </button>
            )}
            <button
              onClick={onOpenInstallModal}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
            >
              Instal Device Baru
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 1. MOBILE CARD VIEW (Visible on small screens < md) */}
          <div className="block md:hidden divide-y divide-slate-800/80">
            {filteredDevices.map((device) => {
              const fac = extractFactory(device.location);
              const facStyle = getFactoryBadgeStyle(fac);

              return (
                <div key={device.mcid} className="p-3.5 space-y-3 bg-slate-950/40">
                  {/* Card Header: MCID & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-100 text-sm truncate">
                            {device.mcid}
                          </span>
                          <button
                            onClick={() => handleCopy(device.mcid)}
                            className="p-1 text-slate-500 hover:text-cyan-400 rounded transition-colors"
                            title="Salin MCID"
                          >
                            {copiedText === device.mcid ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="text-xs text-slate-300 font-medium truncate">
                          {device.machineModel}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {fac && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${facStyle.bg} ${facStyle.text} ${facStyle.border}`}>
                          {fac}
                        </span>
                      )}
                      {getStatusBadge(device.status)}
                    </div>
                  </div>

                  {/* Card Middle: MAC & Location Details */}
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">MAC Address IoT:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-cyan-300 font-medium bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {device.macAddress}
                        </span>
                        <button
                          onClick={() => handleCopy(device.macAddress)}
                          className="p-1 text-slate-500 hover:text-cyan-400 rounded transition-colors"
                          title="Salin MAC Address"
                        >
                          {copiedText === device.macAddress ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{device.location}</span>
                    </div>
                    {device.notes && (
                      <div className="text-slate-500 italic truncate max-w-full pl-5">
                        &ldquo;{device.notes}&rdquo;
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-slate-500 pl-5 text-[10px]">
                      <Clock className="w-3 h-3 text-slate-600" />
                      <span>Diperbarui: {formatDate(device.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Mobile Action Buttons Bar */}
                  <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                    {/* EDIT (CRUD) */}
                    <button
                      onClick={() => onOpenEditModal(device)}
                      className="py-2 px-1 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-800/50 flex items-center justify-center gap-1 text-[11px] font-semibold active:scale-95 transition-all"
                      title="Edit / Koreksi Data Mesin"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    {/* Swap MAC */}
                    <button
                      onClick={() => onOpenReplaceModal(device)}
                      className="py-2 px-1 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 border border-blue-800/50 flex items-center justify-center gap-1 text-[11px] font-medium active:scale-95 transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Swap</span>
                    </button>

                    {/* Status */}
                    <button
                      onClick={() => onOpenStatusModal(device)}
                      className="py-2 px-1 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-800/50 flex items-center justify-center gap-1 text-[11px] font-medium active:scale-95 transition-all"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Status</span>
                    </button>

                    {/* History */}
                    <button
                      onClick={() => onOpenHistoryModal(device.mcid)}
                      className="py-2 px-1 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-800/50 flex items-center justify-center gap-1 text-[11px] font-medium active:scale-95 transition-all"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Log</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. DESKTOP TABLE VIEW (Visible on md+ screens) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">Mesin & MCID</th>
                  <th className="py-3 px-4">MAC Address IoT</th>
                  <th className="py-3 px-4">Lokasi & Factory</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Terakhir Diperbarui</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredDevices.map((device) => {
                  const fac = extractFactory(device.location);
                  const facStyle = getFactoryBadgeStyle(fac);

                  return (
                    <tr
                      key={device.mcid}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Mesin & MCID */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0 mt-0.5">
                            <Cpu className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-100 text-sm">
                                {device.mcid}
                              </span>
                              <button
                                onClick={() => handleCopy(device.mcid)}
                                className="p-1 text-slate-500 hover:text-cyan-400 rounded transition-colors"
                                title="Salin MCID"
                              >
                                {copiedText === device.mcid ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <div className="text-slate-300 font-medium">{device.machineModel}</div>
                            {device.notes && (
                              <div className="text-[11px] text-slate-500 italic mt-0.5 truncate max-w-[220px]">
                                {device.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* MAC Address */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-cyan-300 font-medium px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                            {device.macAddress}
                          </span>
                          <button
                            onClick={() => handleCopy(device.macAddress)}
                            className="p-1 text-slate-500 hover:text-cyan-400 rounded transition-colors"
                            title="Salin MAC Address"
                          >
                            {copiedText === device.macAddress ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        {device.status === 'Removed' && (
                          <span className="text-[10px] text-rose-400 block mt-1">
                            (MAC telah dilepas)
                          </span>
                        )}
                      </td>

                      {/* Lokasi & Factory */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {fac && (
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${facStyle.bg} ${facStyle.text} ${facStyle.border}`}>
                              Factory {fac}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate max-w-[200px]">{device.location}</span>
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">{getStatusBadge(device.status)}</td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-slate-400">
                        <div className="flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{formatDate(device.updatedAt)}</span>
                        </div>
                        {device.lastTechnician && (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">
                            Oleh: {device.lastTechnician}
                          </div>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* EDIT (CRUD) Button */}
                          <button
                            onClick={() => onOpenEditModal(device)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600/30 text-cyan-300 border border-slate-700 hover:border-cyan-500/40 transition-colors"
                            title="Edit / Koreksi Data Perangkat Ini"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Ganti Device Button */}
                          <button
                            onClick={() => onOpenReplaceModal(device)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600/30 text-blue-300 border border-slate-700 hover:border-blue-500/40 transition-colors"
                            title="Ganti Perangkat IoT (Swap MAC)"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Ubah Status Button */}
                          <button
                            onClick={() => onOpenStatusModal(device)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-600/30 text-amber-300 border border-slate-700 hover:border-amber-500/40 transition-colors"
                            title="Ubah Status Mesin"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                          </button>

                          {/* Lihat Riwayat Button */}
                          <button
                            onClick={() => onOpenHistoryModal(device.mcid)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-indigo-300 border border-slate-700 hover:border-indigo-500/40 transition-colors"
                            title="Lihat Riwayat Instalasi MCID Ini"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
