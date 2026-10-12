'use client';

import React, { useState, useEffect } from 'react';
import {
  Camera,
  PlusCircle,
  Download,
  BookOpen,
  RotateCcw,
  Activity,
  ShieldCheck,
  Database,
  Cloud,
  ArrowRight,
  History,
  LayoutGrid,
} from 'lucide-react';
import { Device, InstallationHistory, DeviceStatus } from '@/types';
import {
  subscribeDevices,
  subscribeHistory,
  resetDatabase,
  checkDatabaseStatus,
} from '@/lib/device-service';
import { Navbar } from '@/components/Navbar';
import { DashboardSummary } from '@/components/DashboardSummary';
import { DeviceList } from '@/components/DeviceList';
import { InstallationModal } from '@/components/InstallationModal';
import { ReplaceDeviceModal } from '@/components/ReplaceDeviceModal';
import { StatusChangeModal } from '@/components/StatusChangeModal';
import { HistoryModal } from '@/components/HistoryModal';
import { ExportCsvModal } from '@/components/ExportCsvModal';
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal';
import { SetupGuideModal } from '@/components/SetupGuideModal';
import { AuthModal } from '@/components/AuthModal';
import { formatDate } from '@/lib/utils';

export default function Home() {
  // Database status state
  const [dbStatus, setDbStatus] = useState<{ isCloudflareRemote: boolean; engine: string }>({
    isCloudflareRemote: false,
    engine: 'Local D1 SQLite Engine',
  });

  // Data states
  const [devices, setDevices] = useState<Device[]>([]);
  const [history, setHistory] = useState<InstallationHistory[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | DeviceStatus>('ALL');

  // Modals state
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [selectedReplaceDevice, setSelectedReplaceDevice] = useState<Device | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedStatusDevice, setSelectedStatusDevice] = useState<Device | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyFilterMcid, setHistoryFilterMcid] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Scanner modal state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'mcid' | 'mac'>('mcid');
  const [scannedForInstall, setScannedForInstall] = useState<{ field: 'mcid' | 'mac'; value: string } | null>(null);
  const [scannedForReplace, setScannedForReplace] = useState<string>('');

  // Check database mode and subscribe to data
  useEffect(() => {
    checkDatabaseStatus().then((st) => setDbStatus(st));

    const unsubDevices = subscribeDevices((list) => {
      setDevices(list);
    });

    const unsubHistory = subscribeHistory((hist) => {
      setHistory(hist);
    });

    return () => {
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

  const handleScanSuccess = (scannedValue: string) => {
    if (isReplaceModalOpen) {
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
        isCloudflareRemote={dbStatus.isCloudflareRemote}
        onOpenInstallModal={() => {
          setScannedForInstall(null);
          setIsInstallModalOpen(true);
        }}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenSetupModal={() => setIsSetupModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Area (Extra bottom padding on mobile for Bottom Dock) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6 pb-24 sm:pb-8">
        {/* Banner Alert for Cloudflare D1 Remote vs Local D1 SQLite */}
        {!dbStatus.isCloudflareRemote ? (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-orange-950/30 border border-orange-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 backdrop-blur-sm animate-in fade-in">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
                <Database className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-orange-300">
                    Engine Database: Local D1 SQLite (node:sqlite)
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-900/40 text-orange-200 border border-orange-800">
                    data/iot-registry.sqlite
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  Menjalankan transaksi atomik SQL 1:1, scanner barcode, dan export CSV secara lokal. Untuk menghubungkan Cloudflare D1 remote di cloud, masukkan <code>CLOUDFLARE_D1_DATABASE_ID</code> ke <code>.env.local</code>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-stretch sm:self-center justify-end shrink-0 pt-1 sm:pt-0">
              <button
                onClick={() => resetDatabase()}
                className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors active:scale-95"
                title="Kembalikan data database ke data sampel awal pabrik"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Demo</span>
              </button>
              <button
                onClick={() => setIsSetupModalOpen(true)}
                className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-500 text-white shadow-sm transition-colors active:scale-95"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Setup D1</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 sm:p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300 backdrop-blur-sm">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-[11px] sm:text-xs">
                Terhubung ke <strong>Cloudflare D1 Remote Database</strong>. Seluruh query dan transaksi SQL tereksekusi langsung di Cloudflare.
              </span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 hidden sm:inline shrink-0 ml-2">
              CLOUDFLARE D1
            </span>
          </div>
        )}

        {/* Dashboard Header & KPI Metrics */}
        <section className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Dashboard Pemetaan IoT (Cloudflare D1)</span>
                <span className="p-1 rounded bg-orange-500/10 text-orange-400 text-[10px] sm:text-xs font-normal border border-orange-500/20">
                  SQLite
                </span>
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
                <span>Scan Kamera</span>
              </button>

              <button
                onClick={() => {
                  setScannedForInstall(null);
                  setIsInstallModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/30 transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Pemasangan Baru</span>
              </button>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <DashboardSummary
            devices={devices}
            history={history}
            activeFilter={statusFilter}
            onSelectFilter={(st) => setStatusFilter(st)}
            onOpenHistory={() => {
              setHistoryFilterMcid('');
              setIsHistoryModalOpen(true);
            }}
          />
        </section>

        {/* Layout: Main Devices Table + Recent Activity Sidebar */}
        <section id="device-list-section" className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 items-start">
          {/* Main Device List Table / Mobile Cards (3 Cols) */}
          <div className="lg:col-span-3 space-y-4">
            <DeviceList
              devices={devices}
              statusFilter={statusFilter}
              onChangeStatusFilter={(st) => setStatusFilter(st)}
              onOpenReplaceModal={(dev) => {
                setSelectedReplaceDevice(dev);
                setScannedForReplace('');
                setIsReplaceModalOpen(true);
              }}
              onOpenStatusModal={(dev) => {
                setSelectedStatusDevice(dev);
                setIsStatusModalOpen(true);
              }}
              onOpenHistoryModal={(mcid) => {
                setHistoryFilterMcid(mcid);
                setIsHistoryModalOpen(true);
              }}
              onOpenInstallModal={() => {
                setScannedForInstall(null);
                setIsInstallModalOpen(true);
              }}
            />
          </div>

          {/* Recent Activity Feed (1 Col) */}
          <div className="lg:col-span-1 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5 sm:space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 sm:pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Aktivitas Terbaru
                </h3>
              </div>
              <button
                onClick={() => {
                  setHistoryFilterMcid('');
                  setIsHistoryModalOpen(true);
                }}
                className="text-[11px] text-cyan-400 hover:underline"
              >
                Lihat Semua
              </button>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                Belum ada aktivitas tercatat.
              </div>
            ) : (
              <div className="space-y-2.5 sm:space-y-3">
                {history.slice(0, 5).map((act) => (
                  <div
                    key={act.id}
                    onClick={() => handleQuickHistory(act.mcid)}
                    className="p-2.5 sm:p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors cursor-pointer group active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-mono font-bold text-slate-200 group-hover:text-cyan-400 transition-colors">
                        {act.mcid}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {act.eventType === 'INSTALL'
                          ? 'Instal'
                          : act.eventType === 'REPLACE_DEVICE'
                          ? 'Ganti MAC'
                          : act.eventType === 'REMOVE'
                          ? 'Lepas'
                          : 'Status'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 truncate">
                      {act.eventType === 'REPLACE_DEVICE'
                        ? `Ganti ke: ${act.macAddress}`
                        : act.notes || act.machineModel}
                    </div>

                    <div className="text-[10px] text-slate-500 mt-1.5 flex items-center justify-between">
                      <span>{formatDate(act.timestamp)}</span>
                      <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Export Button */}
            <div className="pt-1 sm:pt-2">
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="w-full py-2 px-3 text-xs font-medium rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center justify-center gap-1.5 transition-colors active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Unduh Laporan CSV</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* MOBILE BOTTOM NAVIGATION DOCK (Smartphone Sticky Navigation Bar) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-35 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-pb">
        {/* Tab 1: Daftar */}
        <button
          onClick={() => {
            setStatusFilter('ALL');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
            statusFilter === 'ALL' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutGrid className="w-4 h-4 mb-0.5" />
          <span>Daftar</span>
        </button>

        {/* Tab 2: Tambah Pasang */}
        <button
          onClick={() => {
            setScannedForInstall(null);
            setIsInstallModalOpen(true);
          }}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          <PlusCircle className="w-4 h-4 mb-0.5 text-cyan-400" />
          <span>Pasang</span>
        </button>

        {/* Tab 3: Raised Circular Center Scan Button */}
        <div className="relative -top-3">
          <button
            onClick={() => {
              setScannerTarget('mcid');
              setIsScannerOpen(true);
            }}
            className="p-3.5 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-950/60 border-2 border-slate-900 active:scale-90 transition-transform flex items-center justify-center"
            title="Scan Kamera Barcode / QR"
          >
            <Camera className="w-5 h-5 text-white" />
          </button>
          <span className="block text-[9px] text-cyan-400 text-center font-bold mt-0.5">SCAN</span>
        </div>

        {/* Tab 4: CSV Export */}
        <button
          onClick={() => setIsExportModalOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Download className="w-4 h-4 mb-0.5 text-emerald-400" />
          <span>CSV</span>
        </button>

        {/* Tab 5: Riwayat Audit */}
        <button
          onClick={() => {
            setHistoryFilterMcid('');
            setIsHistoryModalOpen(true);
          }}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          <History className="w-4 h-4 mb-0.5 text-indigo-400" />
          <span>Riwayat</span>
        </button>
      </nav>

      {/* MODALS */}
      {/* 1. Barcode/QR Scanner */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        targetField={scannerTarget}
        onScanSuccess={handleScanSuccess}
      />

      {/* 2. Installation Modal */}
      <InstallationModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        onOpenScanner={handleOpenScannerForInstall}
        initialMcid={scannedForInstall?.field === 'mcid' ? scannedForInstall.value : ''}
        initialMac={scannedForInstall?.field === 'mac' ? scannedForInstall.value : ''}
      />

      {/* 3. Replace Device Modal */}
      <ReplaceDeviceModal
        device={selectedReplaceDevice}
        isOpen={isReplaceModalOpen}
        onClose={() => {
          setIsReplaceModalOpen(false);
          setSelectedReplaceDevice(null);
        }}
        onOpenScanner={handleOpenScannerForReplace}
        initialNewMac={scannedForReplace}
      />

      {/* 4. Status Change Modal */}
      <StatusChangeModal
        device={selectedStatusDevice}
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          setSelectedStatusDevice(null);
        }}
      />

      {/* 5. Installation History Modal */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={history}
        initialMcidFilter={historyFilterMcid}
      />

      {/* 6. Export CSV Modal */}
      <ExportCsvModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        devices={devices}
        history={history}
      />

      {/* 7. Setup Guide Modal */}
      <SetupGuideModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
      />

      {/* 8. Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
