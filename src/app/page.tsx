'use client';

import React, { useState, useEffect } from 'react';
import {
  Camera,
  PlusCircle,
  Download,
  UploadCloud,
  Activity,
  ArrowRight,
  History,
  LayoutGrid,
  RefreshCw,
} from 'lucide-react';
import { Device, InstallationHistory, DeviceStatus } from '@/types';
import {
  subscribeDevices,
  subscribeHistory,
  checkDatabaseStatus,
  DatabaseSyncStatus,
} from '@/lib/device-service';
import { Navbar } from '@/components/Navbar';
import { DashboardSummary } from '@/components/DashboardSummary';
import { DeviceList } from '@/components/DeviceList';
import { InstallationModal } from '@/components/InstallationModal';
import { ReplaceDeviceModal } from '@/components/ReplaceDeviceModal';
import { StatusChangeModal } from '@/components/StatusChangeModal';
import { EditDeviceModal } from '@/components/EditDeviceModal';
import { HistoryModal } from '@/components/HistoryModal';
import { ExportCsvModal } from '@/components/ExportCsvModal';
import { ImportCsvModal } from '@/components/ImportCsvModal';
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal';
import { AuthModal } from '@/components/AuthModal';
import { formatDate } from '@/lib/utils';

export default function Home() {
  // Database sync & online indicator state
  const [dbSync, setDbSync] = useState<DatabaseSyncStatus>({
    connected: true,
    lastSyncTime: '',
  });

  // Data states
  const [devices, setDevices] = useState<Device[]>([]);
  const [history, setHistory] = useState<InstallationHistory[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | DeviceStatus>('ALL');
  const [factoryFilter, setFactoryFilter] = useState<'ALL' | string>('ALL');

  // Modals state
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEditDevice, setSelectedEditDevice] = useState<Device | null>(null);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [selectedReplaceDevice, setSelectedReplaceDevice] = useState<Device | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedStatusDevice, setSelectedStatusDevice] = useState<Device | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyFilterMcid, setHistoryFilterMcid] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Scanner modal state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'mcid' | 'mac'>('mcid');
  const [scannedForInstall, setScannedForInstall] = useState<{ field: 'mcid' | 'mac'; value: string } | null>(null);
  const [scannedForReplace, setScannedForReplace] = useState<string>('');
  const [scannedForEdit, setScannedForEdit] = useState<string>('');

  const refreshSync = () => {
    checkDatabaseStatus().then((st) => setDbSync(st));
  };

  // Check database mode and subscribe to data
  useEffect(() => {
    refreshSync();

    // Periodic heartbeat to keep sync status live
    const interval = setInterval(refreshSync, 30000);

    const unsubDevices = subscribeDevices((list) => {
      setDevices(list);
      refreshSync();
    });

    const unsubHistory = subscribeHistory((hist) => {
      setHistory(hist);
    });

    return () => {
      clearInterval(interval);
      unsubDevices();
      unsubHistory();
    };
  }, []);

  // Handlers for Scanner
  const handleOpenScannerForInstall = (field: 'mcid' | 'mac') => {
    setScannerTarget(field);
    setIsScannerOpen(true);
  };

  const handleOpenScannerForReplace = () => {
    setScannerTarget('mac');
    setIsScannerOpen(true);
  };

  const handleOpenScannerForEdit = () => {
    setScannerTarget('mac');
    setIsScannerOpen(true);
  };

  const handleOpenEditModal = (dev: Device) => {
    setSelectedEditDevice(dev);
    setScannedForEdit('');
    setIsEditModalOpen(true);
  };

  const handleScanSuccess = (scannedValue: string) => {
    if (isEditModalOpen) {
      setScannedForEdit(scannedValue);
    } else if (isReplaceModalOpen) {
      setScannedForReplace(scannedValue);
    } else {
      setScannedForInstall({ field: scannerTarget, value: scannedValue });
      if (!isInstallModalOpen) {
        setIsInstallModalOpen(true);
      }
    }
  };

  // Quick action from recent activity
  const handleQuickHistory = (mcid: string) => {
    setHistoryFilterMcid(mcid);
    setIsHistoryModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Navigation */}
      <Navbar
        dbConnected={dbSync.connected}
        latencyMs={dbSync.latencyMs}
        lastSyncTime={dbSync.lastSyncTime}
        onOpenInstallModal={() => {
          setScannedForInstall(null);
          setIsInstallModalOpen(true);
        }}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6 pb-24 sm:pb-8">
        {/* Real-Time Database Connection & Sync Status Lamp Card */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 backdrop-blur-md shadow-xl transition-all">
          <div className="flex items-center gap-3">
            {/* Animated Online Glow Lamp */}
            <div
              className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                dbSync.connected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              {dbSync.connected ? (
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 shadow-[0_0_12px_#10b981]"></span>
                </span>
              ) : (
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <span>{dbSync.connected ? 'Database Terhubung & Sinkron' : 'Menghubungkan ke Database...'}</span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      dbSync.connected
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {dbSync.connected ? 'ONLINE' : 'CONNECTING'}
                  </span>
                </h4>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Integritas pemetaan 1-to-1 mesin dan modul IoT tersimpan aman secara terpusat.</span>
                {dbSync.lastSyncTime && (
                  <span className="text-slate-500 text-[10px] hidden sm:inline">• Terakhir disinkronkan: {dbSync.lastSyncTime}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-center justify-end shrink-0 pt-1 sm:pt-0">
            {dbSync.latencyMs !== undefined && (
              <div className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 shadow-inner">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>{dbSync.latencyMs} ms</span>
              </div>
            )}
            <button
              onClick={() => refreshSync()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors active:scale-95"
              title="Cek ulang sinkronisasi database"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sinkron</span>
            </button>
          </div>
        </div>

        {/* Dashboard Header & KPI Metrics */}
        <section className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Dashboard Pemetaan IoT Mesin Pabrik</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                Monitor status instalasi modul IoT pada setiap mesin produksi secara real-time
              </p>
            </div>

            {/* Quick Action Buttons (visible on sm+) */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => {
                  setScannerTarget('mcid');
                  setIsScannerOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow-sm transition-colors active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span>Scan Barcode</span>
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 hover:border-cyan-500/70 shadow-sm transition-all active:scale-95"
                title="Import banyak perangkat sekaligus dari file CSV"
              >
                <UploadCloud className="w-4 h-4 text-cyan-400" />
                <span>Import CSV</span>
              </button>

              <button
                onClick={() => {
                  setScannedForInstall(null);
                  setIsInstallModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/25 transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Instal Device Baru</span>
              </button>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <DashboardSummary
            devices={devices}
            history={history}
            activeFilter={statusFilter}
            onSelectFilter={setStatusFilter}
            onOpenHistory={() => {
              setHistoryFilterMcid('');
              setIsHistoryModalOpen(true);
            }}
          />
        </section>

        {/* Main Grid: Device List & Recent Activity Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 items-start">
          {/* Main Registry Table (Col 1-3) */}
          <div className="lg:col-span-3 space-y-4">
            <DeviceList
              devices={devices}
              statusFilter={statusFilter}
              factoryFilter={factoryFilter}
              onChangeStatusFilter={setStatusFilter}
              onChangeFactoryFilter={setFactoryFilter}
              onOpenReplaceModal={(dev: Device) => {
                setSelectedReplaceDevice(dev);
                setScannedForReplace('');
                setIsReplaceModalOpen(true);
              }}
              onOpenEditModal={handleOpenEditModal}
              onOpenStatusModal={(dev: Device) => {
                setSelectedStatusDevice(dev);
                setIsStatusModalOpen(true);
              }}
              onOpenHistoryModal={(mcid: string) => handleQuickHistory(mcid)}
              onOpenInstallModal={() => {
                setScannedForInstall(null);
                setIsInstallModalOpen(true);
              }}
            />
          </div>

          {/* Quick Info & Audit Activity (Col 4) */}
          <div className="space-y-4">
            {/* Audit History Widget Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-800">
                <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs sm:text-sm">
                  <History className="w-4 h-4 text-cyan-400" />
                  <span>Aktivitas Terbaru</span>
                </div>
                <button
                  onClick={() => {
                    setHistoryFilterMcid('');
                    setIsHistoryModalOpen(true);
                  }}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1 transition-colors"
                >
                  <span>Semua</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  Belum ada log aktivitas tercatat.
                </div>
              ) : (
                <div className="space-y-3">
                  {history.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleQuickHistory(item.mcid)}
                      className="group p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-mono font-semibold text-cyan-400 group-hover:text-cyan-300 transition-colors">
                          {item.mcid}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {formatDate(item.timestamp)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 line-clamp-1">
                        <span className="text-slate-400">{item.eventType}:</span> {item.notes || `Update status ke ${item.newStatus}`}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span className="truncate max-w-[140px]">{item.macAddress}</span>
                        <span className="text-slate-400">{item.performedBy?.split('@')[0]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Tips / Operational Rules Card */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400 space-y-2">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
                <span>Aturan Integritas Registrasi</span>
              </div>
              <ul className="space-y-1.5 list-disc list-inside text-[11px] leading-relaxed text-slate-400">
                <li>
                  <strong className="text-slate-300">1 MCID = 1 MAC:</strong> Mengganti MAC otomatis mencatat riwayat pemindahan.
                </li>
                <li>
                  <strong className="text-slate-300">Area Factory:</strong> Seluruh unit dipetakan ke Factory A1 hingga D2 beserta nomor Line.
                </li>
                <li>
                  <strong className="text-slate-300">Sinkronisasi Real-Time:</strong> Setiap perubahan terjamin konsisten dan langsung aktif.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Bottom Quick Action Dock for Mobile Devices */}
      <div className="sm:hidden fixed bottom-3 inset-x-3 z-30 flex items-center justify-around p-2 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-2xl backdrop-blur-xl">
        <button
          onClick={() => {
            setScannerTarget('mcid');
            setIsScannerOpen(true);
          }}
          className="flex flex-col items-center gap-1 px-3 py-1.5 text-slate-300 hover:text-cyan-400 active:scale-95 transition-transform"
        >
          <Camera className="w-5 h-5 text-cyan-400" />
          <span className="text-[10px] font-medium">Scan Kamera</span>
        </button>

        <button
          onClick={() => {
            setScannedForInstall(null);
            setIsInstallModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold text-xs shadow-lg shadow-cyan-950/40 active:scale-95 transition-transform"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Instal Device</span>
        </button>

        <button
          onClick={() => setIsExportModalOpen(true)}
          className="flex flex-col items-center gap-1 px-3 py-1.5 text-slate-300 hover:text-emerald-400 active:scale-95 transition-transform"
        >
          <Download className="w-5 h-5 text-emerald-400" />
          <span className="text-[10px] font-medium">Export CSV</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* MODAL DIALOGS */}
      {/* ======================================================== */}

      {/* 1. Barcode / QR Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        targetField={scannerTarget}
        onScanSuccess={handleScanSuccess}
      />

      {/* 2. New Device Installation Modal */}
      <InstallationModal
        isOpen={isInstallModalOpen}
        onClose={() => {
          setIsInstallModalOpen(false);
          setScannedForInstall(null);
        }}
        onOpenScanner={handleOpenScannerForInstall}
        initialMcid={scannedForInstall?.field === 'mcid' ? scannedForInstall.value : ''}
        initialMac={scannedForInstall?.field === 'mac' ? scannedForInstall.value : ''}
      />

      {/* 3. Device Replacement / MAC Swap Modal */}
      <ReplaceDeviceModal
        device={selectedReplaceDevice}
        isOpen={isReplaceModalOpen}
        onClose={() => {
          setIsReplaceModalOpen(false);
          setSelectedReplaceDevice(null);
          setScannedForReplace('');
        }}
        onOpenScanner={handleOpenScannerForReplace}
        initialNewMac={scannedForReplace}
      />

      {/* 4. Edit Device Modal (CRUD Edit) */}
      <EditDeviceModal
        device={selectedEditDevice}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedEditDevice(null);
        }}
        onOpenScannerForEditMac={handleOpenScannerForEdit}
        scannedNewMac={scannedForEdit}
      />

      {/* 5. Status Change Modal */}
      <StatusChangeModal
        device={selectedStatusDevice}
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          setSelectedStatusDevice(null);
        }}
      />

      {/* 6. Installation History Modal */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={history}
        initialMcidFilter={historyFilterMcid}
      />

      {/* 7. Export CSV Modal */}
      <ExportCsvModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        devices={devices}
        history={history}
      />

      {/* 8. Import CSV Modal */}
      <ImportCsvModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingDevices={devices}
      />

      {/* 9. Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
