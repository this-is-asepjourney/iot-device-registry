'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, Upload, CheckCircle2, AlertTriangle, Volume2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { playBeepSound, normalizeMacAddress, formatMacAddress, normalizeMcid } from '@/lib/utils';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetField: 'mcid' | 'mac';
  onScanSuccess: (scannedValue: string) => void;
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  targetField,
  onScanSuccess,
}: BarcodeScannerModalProps) {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scannerStatus, setScannerStatus] = useState<'idle' | 'starting' | 'scanning' | 'error' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualText, setManualText] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'interactive-barcode-scanner-viewport';

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error clearing scanner:', err);
      }
      scannerRef.current = null;
    }
  }, []);

  const handleScanMatched = useCallback((decodedText: string) => {
    playBeepSound();
    setScannedResult(decodedText);
    setScannerStatus('success');
    stopScanner();

    // Format value according to target field
    let processed = decodedText.trim();
    if (targetField === 'mac') {
      const cleanMac = normalizeMacAddress(processed);
      if (cleanMac.length === 12) {
        processed = formatMacAddress(cleanMac);
      }
    } else {
      processed = normalizeMcid(processed);
    }

    setTimeout(() => {
      onScanSuccess(processed);
      onClose();
    }, 600);
  }, [targetField, onScanSuccess, onClose, stopScanner]);

  const startScanner = useCallback(async (mode: 'environment' | 'user') => {
    await stopScanner();

    const element = document.getElementById(scannerContainerId);
    if (!element) return;

    setScannerStatus('starting');
    setErrorMessage('');
    setScannedResult(null);

    try {
      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;

      const qrCodeSuccessCallback = (decodedText: string) => {
        handleScanMatched(decodedText);
      };

      const qrCodeErrorCallback = () => {
        // Ignored on each frame with no match
      };

      const config = {
        fps: 15,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: mode },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      );

      setScannerStatus('scanning');
    } catch (err: unknown) {
      console.error('Camera scanner init failed:', err);
      setScannerStatus('error');
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setErrorMessage('Izin kamera ditolak browser. Izinkan akses kamera atau gunakan unggah foto / input barcode manual.');
      } else if (msg.includes('NotFoundError')) {
        setErrorMessage('Perangkat kamera tidak ditemukan pada sistem.');
      } else if (msg.includes('InsecureContext') || (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost')) {
        setErrorMessage('Akses kamera HP memerlukan koneksi HTTPS saat diakses dari jaringan lokal/WiFi.');
      } else {
        setErrorMessage('Gagal membuka kamera. Anda dapat menggunakan opsi unggah file foto barcode atau input manual.');
      }
    }
  }, [handleScanMatched, stopScanner]);

  useEffect(() => {
    if (isOpen) {
      setScannerStatus('idle');
      setScannedResult(null);
      setErrorMessage('');
      setIsManualInput(false);
      setManualText('');
      const timer = setTimeout(() => {
        startScanner(facingMode);
      }, 200);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, facingMode, startScanner, stopScanner]);

  // Handle image file upload for scanning
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScannerStatus('starting');
    setErrorMessage('');
    try {
      await stopScanner();
      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;
      const result = await html5QrCode.scanFile(file, true);
      handleScanMatched(result);
    } catch (err) {
      console.warn('Image decode error:', err);
      setScannerStatus('error');
      setErrorMessage('Tidak ditemukan barcode atau QR Code yang dapat dibaca pada gambar ini.');
    }
  };

  const handleApplyManual = () => {
    if (!manualText.trim()) return;
    let processed = manualText.trim();
    if (targetField === 'mac') {
      const cleanMac = normalizeMacAddress(processed);
      if (cleanMac.length === 12) {
        processed = formatMacAddress(cleanMac);
      }
    } else {
      processed = normalizeMcid(processed);
    }
    onScanSuccess(processed);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800/80 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">
                Scan {targetField === 'mac' ? 'MAC Address' : 'Machine Control ID'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Arahkan ke QR Code atau Barcode
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
        <div className="p-4 sm:p-6 flex flex-col items-center overflow-y-auto">
          {/* Viewport Box */}
          <div className="relative w-full aspect-square max-w-[260px] sm:max-w-[320px] rounded-2xl overflow-hidden bg-black/90 border border-slate-700/80 flex items-center justify-center shadow-inner shrink-0">
            {/* The html5-qrcode target div */}
            <div
              id={scannerContainerId}
              className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
            />

            {/* Reticle / Viewfinder Overlay */}
            {scannerStatus === 'scanning' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-44 h-44 sm:w-56 sm:h-56 border-2 border-cyan-400/70 rounded-xl relative">
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-300" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-300" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-300" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-300" />
                  
                  {/* Animated laser beam */}
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#06b6d4] animate-pulse top-1/2 -translate-y-1/2" />
                </div>
              </div>
            )}

            {/* Starting state overlay */}
            {scannerStatus === 'starting' && (
              <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center gap-2 text-cyan-400">
                <RefreshCw className="w-7 h-7 animate-spin" />
                <span className="text-xs font-medium text-slate-300">Menghubungkan kamera...</span>
              </div>
            )}

            {/* Success state overlay */}
            {scannerStatus === 'success' && (
              <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center gap-2 text-emerald-400 animate-in zoom-in-95 duration-150 p-3 text-center">
                <CheckCircle2 className="w-10 h-10" />
                <span className="text-xs font-semibold">Terscan:</span>
                <span className="text-xs px-2.5 py-1 rounded bg-emerald-900/60 font-mono text-emerald-200 border border-emerald-700 break-all max-w-full">
                  {scannedResult}
                </span>
              </div>
            )}

            {/* Error or No Camera Overlay */}
            {scannerStatus === 'error' && (
              <div className="absolute inset-0 p-3 bg-slate-950/95 flex flex-col items-center justify-center text-center gap-2.5">
                <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
                <p className="text-[11px] text-slate-300 leading-relaxed px-1">
                  {errorMessage}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => startScanner(facingMode)}
                    className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Coba Lagi
                  </button>
                  <button
                    onClick={() => setIsManualInput(true)}
                    className="px-2.5 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                  >
                    Input Manual
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls bar below camera */}
          <div className="flex items-center justify-between w-full mt-3.5 text-xs text-slate-400 gap-2">
            <button
              onClick={() => {
                const nextMode = facingMode === 'environment' ? 'user' : 'environment';
                setFacingMode(nextMode);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 active:scale-95 transition-all text-xs"
              title="Ganti Kamera"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{facingMode === 'environment' ? 'Kamera Belakang' : 'Kamera Depan'}</span>
            </button>

            {/* Upload image fallback */}
            <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 cursor-pointer active:scale-95 transition-all text-xs">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Foto</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {/* Manual input fallback */}
          {isManualInput ? (
            <div className="w-full mt-3.5 p-3 bg-slate-800/50 rounded-xl border border-slate-700/60">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Ketik Nilai Manual ({targetField === 'mac' ? 'MAC Address' : 'MCID'}):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder={targetField === 'mac' ? 'AA:BB:CC:DD:EE:FF' : 'CNC-LINE-01'}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleApplyManual}
                  className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Terapkan
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsManualInput(true)}
              className="text-[11px] text-slate-500 hover:text-cyan-400 mt-2.5 transition-colors"
            >
              Kamera bermasalah? Ketik atau paste teks manual
            </button>
          )}

          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500">
            <Volume2 className="w-3 h-3 text-cyan-500/70 shrink-0" />
            <span>Bunyi konfirmasi otomatis saat kode terdeteksi.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
