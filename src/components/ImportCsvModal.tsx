'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  Trash2,
  Check,
  FileText,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Device, FACTORY_LIST, FactoryCode, ImportDeviceItem } from '@/types';
import { importDevices } from '@/lib/device-service';
import {
  downloadCsv,
  parseCsvText,
  normalizeMcid,
  normalizeMacAddress,
  formatMacAddress,
  isValidMacAddress,
  getFactoryBadgeStyle,
} from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { ImportLoadingOverlay } from './ImportLoadingOverlay';

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingDevices: Device[];
}

interface ParsedRow {
  rowNumber: number;
  rawMcid: string;
  rawMac: string;
  rawModel: string;
  rawFactory: string;
  rawLine: string;
  rawNotes: string;
  normMcid: string;
  normMac: string;
  formattedMac: string;
  factoryCode: FactoryCode | null;
  isValid: boolean;
  isRemap?: boolean;
  isUpdate?: boolean;
  oldMac?: string;
  errors: string[];
}

export function ImportCsvModal({
  isOpen,
  onClose,
  existingDevices,
}: ImportCsvModalProps) {
  const { user, demoUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [rawCsvText, setRawCsvText] = useState<string | null>(null);
  const [allowUpdateExisting, setAllowUpdateExisting] = useState<boolean>(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [filterView, setFilterView] = useState<'ALL' | 'VALID' | 'INVALID'>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  // 1. Download official CSV template
  const handleDownloadTemplate = () => {
    const headers = ['MCID', 'MAC_Address', 'Model_Mesin', 'Factory', 'Line', 'Catatan'];
    const sampleRows = [
      ['CNC-VF2-05', 'B8:27:EB:4A:88:55', 'Haas CNC Milling VF-2', 'A1', 'Line 1', 'Sensor getaran spindle'],
      ['PRESS-50T-06', 'DC:A6:32:1B:90:66', 'Aida 50 Ton Hydraulic Press', 'B2', 'Stamping Line 2', 'Sensor hidrolik & stroke'],
      ['ROBOT-WELD-07', 'E4:5F:01:8C:7D:77', 'Fanuc Arc Mate 100iD', 'C1', 'Line Welding Bay 3', 'Modbus TCP sensor'],
      ['LATHE-08', 'AA:BB:CC:DD:EE:88', 'Mazak Quick Turn 250', 'D1', 'Turning Line A', 'Modul IoT arus motor'],
      ['PUMP-COOL-09', '11:22:33:44:55:99', 'Grundfos CR32 High Pressure', 'A2', 'Utility Line 1', 'Sensor tekanan pipa'],
    ];

    downloadCsv('template_import_iot_devices.csv', headers, sampleRows);
  };

  // 2. Parse and validate CSV with mode awareness (New or Remap)
  const processCsvData = (text: string, updateMode: boolean) => {
    try {
      const grid = parseCsvText(text);
      if (grid.length < 2) {
        setParseError('File harus memiliki baris judul header dan minimal 1 baris data.');
        setParsedRows([]);
        return;
      }

      // Map headers
      const headerRow = grid[0].map((h) => h.toLowerCase().trim().replace(/[\s_-]+/g, ''));
      const mcidIdx = headerRow.findIndex((h) => h.includes('mcid') || h.includes('machineid'));
      const macIdx = headerRow.findIndex((h) => h.includes('mac') || h.includes('macaddress'));
      const modelIdx = headerRow.findIndex((h) => h.includes('model') || h.includes('mesin'));
      const factoryIdx = headerRow.findIndex((h) => h.includes('factory') || h.includes('plant'));
      const lineIdx = headerRow.findIndex((h) => h.includes('line') || h.includes('lini'));
      const notesIdx = headerRow.findIndex((h) => h.includes('catatan') || h.includes('note') || h.includes('keterangan'));

      if (mcidIdx === -1 || macIdx === -1 || modelIdx === -1 || factoryIdx === -1) {
        setParseError(
          'Kolom wajib tidak ditemukan. Pastikan header memiliki: MCID, MAC_Address, Model_Mesin, Factory (dan Line, Catatan opsional).'
        );
        setParsedRows([]);
        return;
      }

      // Lookup maps for existing active devices
      const existingDeviceMap = new Map<string, Device>();
      const existingMacMap = new Map<string, Device>();

      existingDevices
        .filter((d) => d.status !== 'Removed')
        .forEach((d) => {
          existingDeviceMap.set(d.mcid.toUpperCase().trim(), d);
          existingMacMap.set(normalizeMacAddress(d.macAddress), d);
        });

      // Track duplicates within this batch file
      const fileSeenMcid = new Set<string>();
      const fileSeenMac = new Set<string>();

      const parsed: ParsedRow[] = [];

      for (let i = 1; i < grid.length; i++) {
        const row = grid[i];
        if (row.every((cell) => cell.trim().length === 0)) continue;

        const rawMcid = (row[mcidIdx] || '').trim();
        const rawMac = (row[macIdx] || '').trim();
        const rawModel = (row[modelIdx] || '').trim();
        const rawFactory = (row[factoryIdx] || '').trim().toUpperCase();
        const rawLine = lineIdx !== -1 ? (row[lineIdx] || '').trim() : '';
        const rawNotes = notesIdx !== -1 ? (row[notesIdx] || '').trim() : '';

        const normMcid = normalizeMcid(rawMcid);
        const normMac = normalizeMacAddress(rawMac);
        const formattedMac = formatMacAddress(rawMac);

        const errors: string[] = [];
        let isRemap = false;
        let isUpdate = false;
        let oldMac: string | undefined;

        // Check if MCID already exists in system
        const existingForMcid = existingDeviceMap.get(normMcid);
        if (existingForMcid) {
          oldMac = existingForMcid.macAddress;
          if (!updateMode) {
            errors.push(`MCID [${normMcid}] sudah terdaftar di sistem. Aktifkan opsi "Mode Pembaruan / Remap" untuk memetakan ulang.`);
          } else {
            // Remap mode enabled
            if (normalizeMacAddress(existingForMcid.macAddress) === normMac) {
              isUpdate = true;
            } else {
              isRemap = true;
            }
          }
        }

        // Validate MCID
        if (!normMcid) {
          errors.push('MCID kosong.');
        } else if (fileSeenMcid.has(normMcid)) {
          errors.push(`Duplikasi MCID [${normMcid}] dalam file ini.`);
        } else {
          fileSeenMcid.add(normMcid);
        }

        // Validate MAC format & uniqueness
        if (!isValidMacAddress(rawMac) || normMac.length !== 12) {
          errors.push(`Format MAC [${rawMac}] tidak valid (harus 12 digit heksa).`);
        } else if (fileSeenMac.has(normMac)) {
          errors.push(`Duplikasi MAC [${formattedMac}] dalam file ini.`);
        } else {
          // Check MAC collision across active devices
          const existingForMac = existingMacMap.get(normMac);
          if (existingForMac) {
            // If the MAC already belongs to ANOTHER machine, that's a collision!
            if (existingForMac.mcid.toUpperCase().trim() !== normMcid) {
              errors.push(
                `MAC [${formattedMac}] sedang aktif di mesin lain [${existingForMac.mcid}]. Tidak boleh bentrok.`
              );
            }
          }
          fileSeenMac.add(normMac);
        }

        // Validate Model
        if (!rawModel) {
          errors.push('Model mesin kosong.');
        }

        // Validate Factory
        let factoryCode: FactoryCode | null = null;
        if (!rawFactory) {
          errors.push('Factory kosong.');
        } else if (!FACTORY_LIST.includes(rawFactory as FactoryCode)) {
          errors.push(`Factory [${rawFactory}] tidak valid (${FACTORY_LIST.join(', ')}).`);
        } else {
          factoryCode = rawFactory as FactoryCode;
        }

        parsed.push({
          rowNumber: i + 1,
          rawMcid,
          rawMac,
          rawModel,
          rawFactory,
          rawLine,
          rawNotes,
          normMcid,
          normMac,
          formattedMac,
          factoryCode,
          isValid: errors.length === 0,
          isRemap,
          isUpdate,
          oldMac,
          errors,
        });
      }

      if (parsed.length === 0) {
        setParseError('Tidak ada baris data yang ditemukan dalam file CSV.');
      } else {
        setParseError(null);
      }

      setParsedRows(parsed);
    } catch (err: unknown) {
      setParseError(`Gagal memproses file: ${err instanceof Error ? err.message : String(err)}`);
      setParsedRows([]);
    }
  };

  const handleProcessFile = (selectedFile: File) => {
    setFile(selectedFile);
    setParseError(null);
    setSuccessResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setParseError('File kosong atau tidak dapat dibaca.');
        setParsedRows([]);
        return;
      }
      setRawCsvText(text);
      processCsvData(text, allowUpdateExisting);
    };

    reader.readAsText(selectedFile);
  };

  const handleToggleUpdateMode = (enabled: boolean) => {
    setAllowUpdateExisting(enabled);
    if (rawCsvText) {
      processCsvData(rawCsvText, enabled);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    setFile(null);
    setRawCsvText(null);
    setParsedRows([]);
    setParseError(null);
    setSuccessResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Filtered rows for preview table
  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);
  const remapRowsCount = validRows.filter((r) => r.isRemap).length;

  const displayedRows =
    filterView === 'VALID'
      ? validRows
      : filterView === 'INVALID'
      ? invalidRows
      : parsedRows;

  // 3. Submit batch to API
  const handleSubmitImport = async () => {
    if (validRows.length === 0) return;

    setIsSubmitting(true);
    setParseError(null);
    setSuccessResult(null);

    const technician = user?.email || demoUser?.email || 'technician@factory.local';

    const itemsToImport: ImportDeviceItem[] = validRows.map((r) => ({
      mcid: r.normMcid,
      macAddress: r.formattedMac,
      machineModel: r.rawModel,
      factory: r.factoryCode!,
      line: r.rawLine || undefined,
      notes: r.rawNotes || undefined,
    }));

    try {
      const res = await importDevices({
        items: itemsToImport,
        technicianEmail: technician,
        updateExisting: allowUpdateExisting,
      });

      setSuccessResult(res.message);
      setTimeout(() => {
        onClose();
        handleClear();
      }, 2000);
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Super Cool Cybernetic Loading Overlay */}
      <ImportLoadingOverlay
        isOpen={isSubmitting || !!successResult}
        title="Memproses Import Perangkat"
        subtitle="Menyimpan batch perangkat dan menyinkronkan status plan..."
        totalItems={validRows.length}
        isSuccess={!!successResult}
        successMessage={successResult}
        errorMessage={parseError && isSubmitting ? parseError : null}
        onDone={() => {
          onClose();
          handleClear();
        }}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">
                  Import Perangkat Masal (Batch CSV)
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                  Daftarkan atau petakan ulang perangkat IoT sekaligus ke Cloudflare D1
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
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
            {/* Template Info Card */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0 mt-0.5">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-200">
                    Format File & Template Excel / CSV
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Kolom wajib: <code className="text-cyan-300">MCID</code>, <code className="text-cyan-300">MAC_Address</code>, <code className="text-cyan-300">Model_Mesin</code>, <code className="text-cyan-300">Factory</code> (A1-D2). Opsional: <code className="text-slate-300">Line</code>, <code className="text-slate-300">Catatan</code>.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-cyan-500/30 transition-all active:scale-95 shrink-0 self-stretch sm:self-center justify-center shadow-sm"
                title="Unduh template CSV yang siap diedit di Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Template CSV</span>
              </button>
            </div>

            {/* Mode Pembaruan / Remap Toggle Option */}
            <div
              className={`p-3.5 sm:p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                allowUpdateExisting
                  ? 'bg-blue-950/30 border-blue-500/50 shadow-md shadow-blue-950/40'
                  : 'bg-slate-950/80 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2 rounded-xl transition-colors shrink-0 ${
                    allowUpdateExisting
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      : 'bg-slate-800/80 text-slate-400 border border-slate-700/50'
                  }`}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${
                      allowUpdateExisting ? 'animate-spin-slow text-blue-400' : ''
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-semibold text-slate-200">
                      Opsi Update & Remap MAC Address
                    </span>
                    {allowUpdateExisting ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold">
                        MODE REMAP AKTIF
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        MODE REGISTRASI BARU
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    {allowUpdateExisting
                      ? 'MCID yang sudah terdaftar akan di-mapping ulang ke MAC Address baru. MAC lama otomatis digantikan dan riwayat dicatat.'
                      : 'Jika diaktifkan, MCID yang sudah ada di database tidak akan ditolak, melainkan langsung diperbarui dengan MAC Address baru.'}
                  </p>
                </div>
              </div>

              {/* Custom Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={allowUpdateExisting}
                  onChange={(e) => handleToggleUpdateMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-inner" />
              </label>
            </div>

            {/* Feedback Banners */}
            {parseError && (
              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/50 flex items-start gap-2.5 text-xs text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{parseError}</div>
              </div>
            )}

            {/* Upload Dropzone */}
            {!file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                  isDragging
                    ? 'border-cyan-400 bg-cyan-950/20 scale-[0.99]'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <UploadCloud className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-semibold text-slate-200">
                    Tarik & lepas file CSV di sini, atau <span className="text-cyan-400 underline">Pilih File</span>
                  </p>
                  <p className="text-[11px] text-slate-500">Mendukung format .csv standar (Excel, Google Sheets)</p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-5 h-5 text-cyan-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200 truncate">{file.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} baris terdeteksi
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleClear}
                  className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Ganti File</span>
                </button>
              </div>
            )}

            {/* Validation & Preview Table */}
            {parsedRows.length > 0 && (
              <div className="space-y-3 pt-1">
                {/* Summary Metrics & Filter Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-300">Pratinjau Data:</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      Total: {parsedRows.length}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Valid: {validRows.length}
                    </span>
                    {remapRowsCount > 0 && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        Remap: {remapRowsCount}
                      </span>
                    )}
                    {invalidRows.length > 0 && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        Kendala: {invalidRows.length}
                      </span>
                    )}
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 self-start sm:self-auto">
                    <button
                      onClick={() => setFilterView('ALL')}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                        filterView === 'ALL'
                          ? 'bg-slate-800 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Semua ({parsedRows.length})
                    </button>
                    <button
                      onClick={() => setFilterView('VALID')}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                        filterView === 'VALID'
                          ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40'
                          : 'text-emerald-400 hover:text-emerald-300'
                      }`}
                    >
                      Siap ({validRows.length})
                    </button>
                    {invalidRows.length > 0 && (
                      <button
                        onClick={() => setFilterView('INVALID')}
                        className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                          filterView === 'INVALID'
                            ? 'bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/40'
                            : 'text-rose-400 hover:text-rose-300'
                        }`}
                      >
                        Kendala ({invalidRows.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Table Container */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/90 sticky top-0 z-10 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">MCID</th>
                          <th className="py-2.5 px-3">MAC Address</th>
                          <th className="py-2.5 px-3">Model Mesin</th>
                          <th className="py-2.5 px-3">Factory & Line</th>
                          <th className="py-2.5 px-3">Tipe Aksi</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {displayedRows.map((r) => {
                          const style = getFactoryBadgeStyle(r.factoryCode);
                          return (
                            <tr
                              key={r.rowNumber}
                              className={`transition-colors ${
                                r.isValid
                                  ? r.isRemap
                                    ? 'bg-blue-950/15 hover:bg-blue-950/25'
                                    : 'hover:bg-slate-900/40'
                                  : 'bg-rose-950/15 hover:bg-rose-950/25'
                              }`}
                            >
                              <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                                {r.rowNumber}
                              </td>
                              <td className="py-2 px-3 font-mono font-semibold text-slate-200">
                                {r.normMcid || <span className="text-rose-400 italic">Kosong</span>}
                              </td>
                              <td className="py-2 px-3 font-mono text-cyan-300 text-[11px]">
                                {r.formattedMac || <span className="text-rose-400 italic">{r.rawMac}</span>}
                              </td>
                              <td className="py-2 px-3 text-slate-300 max-w-[140px] truncate">
                                {r.rawModel || <span className="text-rose-400 italic">Kosong</span>}
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-1.5">
                                  {r.factoryCode ? (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}
                                    >
                                      {r.factoryCode}
                                    </span>
                                  ) : (
                                    <span className="text-rose-400 text-[10px] italic">Invalid</span>
                                  )}
                                  <span className="text-slate-400 text-[11px] truncate max-w-[100px]">
                                    {r.rawLine || '-'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                {r.isRemap ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 cursor-help"
                                    title={`Remap MAC: ${r.oldMac} ➔ ${r.formattedMac}`}
                                  >
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    <span>Remap MAC</span>
                                  </span>
                                ) : r.isUpdate ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    <span>Update Data</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                                    <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                                    <span>Baru</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right shrink-0">
                                {r.isValid ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <Check className="w-3 h-3" />
                                    <span>Siap</span>
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 cursor-help"
                                    title={r.errors.join(' ')}
                                  >
                                    <AlertCircle className="w-3 h-3 text-rose-400" />
                                    <span className="truncate max-w-[90px]">{r.errors[0]}</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3 shrink-0">
            <div className="text-[11px] text-slate-400">
              {validRows.length > 0 && (
                <span>
                  <strong className="text-emerald-400">{validRows.length}</strong> perangkat siap diimpor ke database
                  {remapRowsCount > 0 ? ` (${remapRowsCount} remap)` : ''}.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitImport}
                disabled={isSubmitting || validRows.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/30 active:scale-95 transition-all disabled:opacity-50"
              >
                <span>Import {validRows.length > 0 ? `(${validRows.length}) Perangkat` : ''}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
