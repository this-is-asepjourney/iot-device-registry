'use client';

import React, { useState } from 'react';
import { X, BookOpen, ExternalLink, Copy, Check, Terminal, Database, Key, ShieldCheck } from 'lucide-react';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SetupGuideModal({ isOpen, onClose }: SetupGuideModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const createD1Cmd = `npx wrangler d1 create iot-device-registry-db`;
  const executeD1Cmd = `npx wrangler d1 execute iot-device-registry-db --file=./schema.sql --remote`;
  const executeD1LocalCmd = `npx wrangler d1 execute iot-device-registry-db --file=./schema.sql --local`;

  const envSample = `CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_D1_DATABASE_ID=your-d1-database-id-guid
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token`;

  const wranglerTomlSample = `name = "iot-device-registry"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "iot-device-registry-db"
database_id = "your-d1-database-id-guid"`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
              <Database className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">
                Panduan Setup Cloudflare D1 SQLite
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Langkah konfigurasi database Cloudflare D1 & schema SQL
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 text-xs text-slate-300">
          {/* Status info */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            <span className="font-semibold text-orange-400">Arsitektur Cloudflare D1:</span> Aplikasi telah menggunakan database relasional SQL D1. Saat dijalankan secara lokal tanpa konfigurasi Cloudflare remote, aplikasi otomatis menggunakan <strong>Local D1 SQLite Engine (node:sqlite)</strong> dengan file di <code>data/iot-registry.sqlite</code>.
          </div>

          {/* Step 1 */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="font-semibold text-orange-400 flex items-center gap-2 text-xs sm:text-sm">
                <Terminal className="w-4 h-4 shrink-0" /> 1. Buat Database D1 di Cloudflare
              </span>
              <a
                href="https://dash.cloudflare.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-orange-400 hover:underline"
              >
                <span>Buka Cloudflare Dashboard</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="leading-relaxed">
              Jalankan perintah berikut di terminal VS Code untuk membuat database Cloudflare D1 baru:
            </p>
            <div className="relative mt-2">
              <pre className="p-3 bg-slate-900 rounded-lg font-mono text-[10px] sm:text-[11px] text-slate-300 overflow-x-auto border border-slate-800">
                {createD1Cmd}
              </pre>
              <button
                onClick={() => handleCopy(createD1Cmd, 'cmd1')}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors active:scale-95"
                title="Salin perintah"
              >
                {copiedKey === 'cmd1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Perintah ini akan mencetak <code>database_id</code> unik D1 Anda.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <span className="font-semibold text-orange-400 flex items-center gap-2 text-xs sm:text-sm">
              <Database className="w-4 h-4 shrink-0" /> 2. Terapkan Skema Database (schema.sql)
            </span>
            <p className="leading-relaxed">
              Jalankan migrasi tabel <code>devices</code>, <code>mac_index</code>, dan <code>installation_history</code> ke database Cloudflare D1:
            </p>
            <div className="relative mt-2">
              <pre className="p-3 bg-slate-900 rounded-lg font-mono text-[10px] sm:text-[11px] text-slate-300 overflow-x-auto border border-slate-800">
                {executeD1Cmd}
              </pre>
              <button
                onClick={() => handleCopy(executeD1Cmd, 'cmd2')}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors active:scale-95"
                title="Salin perintah"
              >
                {copiedKey === 'cmd2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Untuk eksekusi offline lokal: <code>{executeD1LocalCmd}</code>
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <span className="font-semibold text-orange-400 flex items-center gap-2 text-xs sm:text-sm">
              <Key className="w-4 h-4 shrink-0" /> 3. Masukkan Kredensial ke .env.local
            </span>
            <p className="leading-relaxed">
              Salin konfigurasi token dan ID ke file <code>.env.local</code>:
            </p>
            <div className="relative mt-2">
              <pre className="p-3 bg-slate-900 rounded-lg font-mono text-[10px] sm:text-[11px] text-slate-300 overflow-x-auto border border-slate-800">
                {envSample}
              </pre>
              <button
                onClick={() => handleCopy(envSample, 'env')}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors active:scale-95"
                title="Salin template"
              >
                {copiedKey === 'env' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <span className="font-semibold text-orange-400 flex items-center gap-2 text-xs sm:text-sm">
              <ShieldCheck className="w-4 h-4 shrink-0" /> 4. Konfigurasi wrangler.toml
            </span>
            <p className="leading-relaxed">
              Pastikan file <code>wrangler.toml</code> memiliki konfigurasi D1 database Anda:
            </p>
            <div className="relative mt-2">
              <pre className="p-3 bg-slate-900 rounded-lg font-mono text-[10px] sm:text-[11px] text-slate-300 overflow-x-auto border border-slate-800">
                {wranglerTomlSample}
              </pre>
              <button
                onClick={() => handleCopy(wranglerTomlSample, 'toml')}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors active:scale-95"
                title="Salin konfigurasi"
              >
                {copiedKey === 'toml' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-orange-600 hover:bg-orange-500 text-white transition-colors"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
}
