'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Cpu,
  RefreshCw,
  Layers,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export interface ImportLoadingOverlayProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  totalItems: number;
  isSuccess?: boolean;
  successMessage?: string | null;
  errorMessage?: string | null;
  onDone?: () => void;
}

interface Step {
  id: number;
  label: string;
  detail: string;
}

const STEPS: Step[] = [
  {
    id: 1,
    label: 'Parsing & Memory Buffer',
    detail: 'Mengekstraksi token baris CSV/Excel ke memori pipeline',
  },
  {
    id: 2,
    label: 'Integritas Constraint 1:1',
    detail: 'Memeriksa duplikasi MCID, validitas MAC, dan riwayat mesin',
  },
  {
    id: 3,
    label: 'Batch D1 Atomic Engine',
    detail: 'Eksekusi transaksi SQL atomik di Cloudflare D1 Storage',
  },
  {
    id: 4,
    label: 'Auto-Sync & Audit Trail',
    detail: 'Memperbarui status rencana & mencatat log audit instalasi',
  },
];

export function ImportLoadingOverlay({
  isOpen,
  title = 'Memproses Import Data',
  subtitle = 'Harap tunggu, sistem sedang memverifikasi dan menyinkronkan data secara atomik.',
  totalItems,
  isSuccess = false,
  successMessage,
  errorMessage,
  onDone,
}: ImportLoadingOverlayProps) {
  const [progress, setProgress] = useState(12);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setProgress(12);
      setCurrentStepIndex(0);
      return;
    }

    if (errorMessage) {
      return;
    }

    if (isSuccess) {
      setProgress(100);
      setCurrentStepIndex(STEPS.length - 1);
      return;
    }

    // Dynamic staged progress simulation while waiting for server response
    const timer1 = setTimeout(() => {
      setProgress(38);
      setCurrentStepIndex(1);
    }, 400);

    const timer2 = setTimeout(() => {
      setProgress(68);
      setCurrentStepIndex(2);
    }, 1100);

    const timer3 = setTimeout(() => {
      setProgress(88);
      setCurrentStepIndex(3);
    }, 2000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isOpen, isSuccess, errorMessage]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      {/* Background cybernetic glow orbs */}
      <div className="absolute w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -top-10 -left-10 animate-pulse" />
      <div className="absolute w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -bottom-10 -right-10 animate-pulse" />

      <div className="relative w-full max-w-lg bg-slate-900/90 border border-slate-700/70 shadow-2xl shadow-cyan-950/50 rounded-2xl p-6 sm:p-8 overflow-hidden text-slate-100">
        {/* Top ambient highlight line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

        {/* Header Section */}
        <div className="text-center mb-6">
          <div className="relative inline-flex items-center justify-center w-24 h-24 mb-4">
            {/* Concentric rotating rings */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-500/30 animate-spin-slow" />
            <div className="absolute inset-2 rounded-full border-2 border-dotted border-blue-400/40 animate-spin-reverse" />
            <div className="absolute inset-4 rounded-full bg-slate-950/80 border border-slate-700/80 flex items-center justify-center shadow-inner">
              {errorMessage ? (
                <AlertTriangle className="w-9 h-9 text-rose-400 animate-bounce" />
              ) : isSuccess ? (
                <div className="relative">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-in zoom-in-75 duration-300" />
                  <Sparkles className="w-4 h-4 text-emerald-300 absolute -top-1 -right-1 animate-ping" />
                </div>
              ) : (
                <div className="relative flex items-center justify-center">
                  <Database className="w-8 h-8 text-cyan-400 animate-pulse" />
                  <Cpu className="w-4 h-4 text-blue-400 absolute -bottom-1 -right-1 animate-spin-slow" />
                </div>
              )}
            </div>
          </div>

          <h3 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            {errorMessage ? (
              <span className="text-rose-400">Import Terhenti</span>
            ) : isSuccess ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-5 h-5" /> Import & Sinkronisasi Selesai
              </span>
            ) : (
              title
            )}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            {errorMessage ? errorMessage : isSuccess && successMessage ? successMessage : subtitle}
          </p>
        </div>

        {/* Progress Bar & Percentage */}
        {!errorMessage && (
          <div className="mb-6 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${!isSuccess ? 'animate-spin' : ''}`} />
                STATUS PIPELINE
              </span>
              <span className="text-cyan-300 font-bold text-sm tracking-wider">
                {progress}%
              </span>
            </div>

            {/* Glowing bar */}
            <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out rounded-full ${
                  isSuccess
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300'
                    : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500'
                }`}
                style={{ width: `${progress}%` }}
              >
                {/* Shimmer light sweep */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-2">
              <span>Payload: {totalItems} Baris Data</span>
              <span>{isSuccess ? '100% Tersimpan' : 'Cloudflare D1 Transaction'}</span>
            </div>
          </div>
        )}

        {/* 4-Step Pipeline Checklist */}
        {!errorMessage && (
          <div className="space-y-2 mb-6">
            {STEPS.map((step, idx) => {
              const isPast = isSuccess || idx < currentStepIndex;
              const isCurrent = !isSuccess && idx === currentStepIndex;

              return (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all duration-300 ${
                    isPast
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                      : isCurrent
                      ? 'bg-cyan-950/40 border-cyan-700/60 text-cyan-200 shadow-sm shadow-cyan-900/20'
                      : 'bg-slate-950/30 border-slate-800/50 text-slate-500'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isPast ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : isCurrent ? (
                      <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[10px] text-slate-500">
                        {step.id}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-xs font-semibold ${
                          isPast
                            ? 'text-emerald-300'
                            : isCurrent
                            ? 'text-cyan-200 font-bold'
                            : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </p>
                      {isCurrent && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 border border-cyan-700/50 animate-pulse">
                          RUNNING
                        </span>
                      )}
                      {isPast && (
                        <span className="text-[10px] font-mono text-emerald-400">
                          DONE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5 line-clamp-1">
                      {step.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer info or action button */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>SQLite WAL • 100% ACID Guaranteed</span>
          </div>

          {(isSuccess || errorMessage) && onDone && (
            <button
              type="button"
              onClick={onDone}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors shadow-sm ${
                errorMessage
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
              }`}
            >
              {errorMessage ? 'Tutup & Perbaiki' : 'Selesai'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
