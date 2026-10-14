'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Check,
  FileText,
} from 'lucide-react';
import {
  downloadPlanTemplateExcel,
  downloadPlanTemplateCsv,
  parsePlanSpreadsheet,
  ParsedPlanRow,
} from '@/lib/excel-utils';
import { importPlans } from '@/lib/device-service';
import { useAuth } from '@/context/AuthContext';

interface ImportPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportPlanModal({ isOpen, onClose }: ImportPlanModalProps) {
  const { user, demoUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedPlanRow[]>([]);
  const [filterView, setFilterView] = useState<'ALL' | 'VALID' | 'INVALID'>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleProcessFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setParseError(null);
    setSuccessResult(null);
    setIsParsing(true);

    try {
      const rows = await parsePlanSpreadsheet(selectedFile);
      setParsedRows(rows);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setParseError(msg || 'Gagal membaca isi file spreadsheet.');
      setParsedRows([]);
    } finally {
      setIsParsing(false);
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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setParseError(null);
    setSuccessResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);

  const displayedRows =
    filterView === 'VALID' ? validRows : filterView === 'INVALID' ? invalidRows : parsedRows;

  const handleImportSubmit = async () => {
    if (validRows.length === 0) return;
    setIsSubmitting(true);
    setParseError(null);

    const technician = user?.email || demoUser?.email || 'technician@factory.local';

    try {
      const payloadItems = validRows.map((r) => ({
        mcid: r.normMcid,
        machineModel: r.rawModel || undefined,
        factory: r.factoryCode || r.rawFactory || undefined,
        line: r.rawLine || undefined,
        targetDate: r.rawTargetDate || undefined,
        notes: r.rawNotes || undefined,
      }));

      const result = await importPlans({
        items: payloadItems,
        technicianEmail: technician,
      });

      setSuccessResult(result.message);
      setTimeout(() => {
        handleReset();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setParseError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-6 text-slate-100 max-h-[90vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Import Request Planning via Excel</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Unggah daftar rencana pemasangan IoT mesin dari spreadsheet Excel (.xlsx) atau CSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template Download & Instructions Strip */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Format Template Reportan Excel</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Kolom wajib adalah <strong className="text-cyan-400">MCID</strong> (ID Mesin). MAC Address
              tidak perlu diisi di Excel, karena akan diinput/di-scan saat instalasi fisik selesai.
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
            <button
              onClick={() => downloadPlanTemplateExcel()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/40 shadow-sm transition-all active:scale-95 flex-1 sm:flex-initial"
              title="Download template resmi Microsoft Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Excel (.xlsx)</span>
            </button>

            <button
              onClick={() => downloadPlanTemplateCsv()}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Download format CSV (.csv)"
            >
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {parseError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{parseError}</span>
          </div>
        )}

        {successResult && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successResult}</span>
          </div>
        )}

        {/* Main Content Area (Upload Dropzone or Parsed Table) */}
        {!file ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3.5 ${
              isDragging
                ? 'border-cyan-400 bg-cyan-950/20 scale-[0.99]'
                : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-cyan-400 shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Pilih atau seret file Excel/CSV ke sini
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Mendukung format file <strong>.xlsx</strong>, <strong>.xls</strong>, dan <strong>.csv</strong>
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Browse File Komputer</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            {/* File Info & Stats Toolbar */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                  {file.name}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Filter View Segmented Control */}
                <div className="flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-[11px]">
                  <button
                    onClick={() => setFilterView('ALL')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      filterView === 'ALL'
                        ? 'bg-slate-800 text-slate-100 shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Semua ({parsedRows.length})
                  </button>
                  <button
                    onClick={() => setFilterView('VALID')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      filterView === 'VALID'
                        ? 'bg-emerald-500/20 text-emerald-400 shadow'
                        : 'text-slate-400 hover:text-emerald-400'
                    }`}
                  >
                    Valid ({validRows.length})
                  </button>
                  {invalidRows.length > 0 && (
                    <button
                      onClick={() => setFilterView('INVALID')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        filterView === 'INVALID'
                          ? 'bg-rose-500/20 text-rose-400 shadow'
                          : 'text-slate-400 hover:text-rose-400'
                      }`}
                    >
                      Bermasalah ({invalidRows.length})
                    </button>
                  )}
                </div>

                <button
                  onClick={handleReset}
                  disabled={isSubmitting}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                  title="Ganti file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Table Preview */}
            <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60 max-h-72">
              {isParsing ? (
                <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                  <span>Memproses data spreadsheet...</span>
                </div>
              ) : displayedRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Tidak ada baris yang sesuai dengan filter.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-900 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">MCID (Wajib)</th>
                      <th className="py-2.5 px-3">Model Mesin</th>
                      <th className="py-2.5 px-3">Factory / Line</th>
                      <th className="py-2.5 px-3">Target Tanggal</th>
                      <th className="py-2.5 px-3">Catatan Request</th>
                      <th className="py-2.5 px-3 w-28 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 font-normal">
                    {displayedRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={`hover:bg-slate-900/50 transition-colors ${
                          !row.isValid ? 'bg-rose-950/15' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-center text-slate-500 font-mono text-[10px]">
                          {row.rowNumber}
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold">
                          {row.normMcid ? (
                            <span className="text-cyan-400">{row.normMcid}</span>
                          ) : (
                            <span className="text-rose-400 italic">(Kosong)</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-300 max-w-[150px] truncate">
                          {row.rawModel || '-'}
                        </td>
                        <td className="py-2 px-3">
                          {row.factoryCode ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                              Factory {row.factoryCode} {row.rawLine ? `• ${row.rawLine}` : ''}
                            </span>
                          ) : row.rawFactory || row.rawLine ? (
                            <span className="text-[11px] text-slate-400">
                              {row.rawFactory} {row.rawLine}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                          {row.rawTargetDate || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-400 max-w-[180px] truncate">
                          {row.rawNotes || '-'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" />
                              <span>Valid</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full"
                              title={row.errors.join(', ')}
                            >
                              <AlertCircle className="w-3 h-3" />
                              <span>Error</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3.5 mt-3.5 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 hidden sm:block">
            {validRows.length > 0 && (
              <span>
                Siap mengimpor <strong className="text-emerald-400">{validRows.length}</strong> mesin ke
                dalam list planning
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Tutup
            </button>

            {file && validRows.length > 0 && (
              <button
                onClick={handleImportSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-cyan-900/30 disabled:opacity-50 transition-all active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan Rencana...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Import {validRows.length} Rencana Pemasangan</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
