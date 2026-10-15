'use client';

import React, { useState } from 'react';
import {
  X,
  Database,
  Zap,
  Layers,
  Sparkles,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { DatabaseSyncStatus, clearD1Cache, checkDatabaseStatus } from '@/lib/device-service';

interface DatabaseOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: DatabaseSyncStatus;
  onStatusUpdated?: (status: DatabaseSyncStatus) => void;
}

export function DatabaseOptimizerModal({
  isOpen,
  onClose,
  syncStatus,
  onStatusUpdated,
}: DatabaseOptimizerModalProps) {
  const [isFlushing, setIsFlushing] = useState(false);
  const [flushMessage, setFlushMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const metrics = syncStatus.metrics;

  const handleFlushCache = async () => {
    setIsFlushing(true);
    setFlushMessage(null);
    try {
      await clearD1Cache();
      const updated = await checkDatabaseStatus();
      if (onStatusUpdated) onStatusUpdated(updated);
      setFlushMessage('Cache berhasil dibersihkan! Request berikutnya akan langsung membaca dari Cloudflare D1.');
      setTimeout(() => setFlushMessage(null), 4000);
    } catch (err: unknown) {
      setFlushMessage(err instanceof Error ? err.message : 'Gagal membersihkan cache.');
    } finally {
      setIsFlushing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>D1 Database Optimizer & Eco-Engine</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  AKTIF
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Arsitektur hemat kuota read, caching cerdas, dan performa instan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Cache Hit Rate */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-[11px] text-slate-400">Cache Hit Rate</div>
              <div className="text-xl font-extrabold text-cyan-400 font-mono mt-1">
                {metrics?.hitRate || '100%'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">SWR In-Memory</div>
            </div>

            {/* Queries Saved */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-[11px] text-slate-400">Query Dihemat</div>
              <div className="text-xl font-extrabold text-emerald-400 font-mono mt-1">
                {metrics?.savedQueries || 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Tanpa roundtrip D1</div>
            </div>

            {/* Rows Read Saved */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-[11px] text-slate-400">Baris Dihemat</div>
              <div className="text-xl font-extrabold text-purple-400 font-mono mt-1">
                {metrics?.estimatedRowsSaved ? `${(metrics.estimatedRowsSaved).toLocaleString('id-ID')}` : '0'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Rows read kuota</div>
            </div>

            {/* Latency */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-[11px] text-slate-400">Latensi REST</div>
              <div className="text-xl font-extrabold text-amber-400 font-mono mt-1">
                {syncStatus.latencyMs !== undefined ? `${syncStatus.latencyMs} ms` : '-'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Edge ping status</div>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Teknologi Optimasi yang Diaktifkan</span>
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">SWR In-Memory Query Cache (25s TTL):</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Permintaan baca (SELECT devices & plans) disajikan langsung dari memori server (<span className="text-cyan-400">&lt;1ms</span>) sehingga tidak menguras kuota 5M Rows Read harian Cloudflare D1.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Write-Through Invalidation Otomatis:</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Begitu terjadi instalasi, remap, edit, hapus, atau import, cache langsung dibersihkan seketika. Data selalu 100% konsisten tanpa delay.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Tab Inactivity & Visibility Guard:</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Polling otomatis dijeda (0 request) saat tab berada di background atau laptop diminimize. Polling langsung bangun seketika saat user kembali membuka tab.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Lazy-Loading Audit History:</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Daftar riwayat audit hanya dimuat saat modal riwayat atau export dibuka, tidak lagi membaca seluruh log secara berkala di latar belakang.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback banner */}
          {flushMessage && (
            <div className="p-3 rounded-xl bg-cyan-950/50 border border-cyan-500/40 text-xs text-cyan-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{flushMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Engine: {metrics?.engine || 'cloud-remote'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFlushCache}
              disabled={isFlushing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors active:scale-95 disabled:opacity-50"
              title="Bersihkan cache server secara manual"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>{isFlushing ? 'Membersihkan...' : 'Flush Cache'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
