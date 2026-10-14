'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  SwitchCamera,
  Keyboard,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { playBeepSound, normalizeMacAddress, formatMacAddress, normalizeMcid } from '@/lib/utils';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetField: 'mcid' | 'mac';
  onScanSuccess: (scannedValue: string) => void;
}

interface CameraDeviceItem {
  id: string;
  label: string;
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  targetField,
  onScanSuccess,
}: BarcodeScannerModalProps) {
  const [cameras, setCameras] = useState<CameraDeviceItem[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scannerStatus, setScannerStatus] = useState<
    'idle' | 'starting' | 'scanning' | 'error' | 'success'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualText, setManualText] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const isMountedRef = useRef(true);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onCloseRef = useRef(onClose);

  // Keep callback refs fresh
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    onCloseRef.current = onClose;
  }, [onScanSuccess, onClose]);

  const scannerContainerId = 'interactive-barcode-scanner-viewport';

  // Safely stop and clear scanner instance
  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch (err) {
        console.warn('Scanner stop warning:', err);
      }
      try {
        await scanner.clear();
      } catch (err) {
        console.warn('Scanner clear warning:', err);
      }
      scannerRef.current = null;
    }

    // Clean up any lingering injected elements from container
    if (typeof document !== 'undefined') {
      const el = document.getElementById(scannerContainerId);
      if (el) {
        el.innerHTML = '';
      }
    }
  }, []);

  // Handle successful barcode / QR decode
  const handleScanMatched = useCallback(
    (decodedText: string) => {
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
        onScanSuccessRef.current(processed);
        onCloseRef.current();
      }, 500);
    },
    [targetField, stopScanner]
  );

  // Helper to start camera scanner with fallback chain
  const startCameraInstance = useCallback(
    async (
      camId: string | null,
      mode: 'environment' | 'user'
    ) => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;

      setScannerStatus('starting');
      setErrorMessage('');
      setScannedResult(null);

      await stopScanner();

      if (!isMountedRef.current) {
        isStartingRef.current = false;
        return;
      }

      const element = document.getElementById(scannerContainerId);
      if (!element) {
        isStartingRef.current = false;
        return;
      }
      element.innerHTML = '';

      try {
        const html5QrCode = new Html5Qrcode(scannerContainerId);
        scannerRef.current = html5QrCode;

        const qrSuccessCallback = (decodedText: string) => {
          handleScanMatched(decodedText);
        };

        const qrErrorCallback = () => {
          // No-op per frame scan miss
        };

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edgeSize = Math.max(160, Math.floor(minEdge * 0.72));
            return { width: edgeSize, height: edgeSize };
          },
          aspectRatio: 1.0,
        };

        let started = false;

        // Attempt 1: Try specific cameraId if provided
        if (camId) {
          try {
            await html5QrCode.start(
              camId,
              config,
              qrSuccessCallback,
              qrErrorCallback
            );
            started = true;
          } catch (camErr) {
            console.warn(`Starting camera ID ${camId} failed, trying fallback:`, camErr);
          }
        }

        // Attempt 2: Try facingMode
        if (!started) {
          try {
            await html5QrCode.start(
              { facingMode: mode },
              config,
              qrSuccessCallback,
              qrErrorCallback
            );
            started = true;
          } catch (modeErr) {
            console.warn(`Starting facingMode ${mode} failed, trying inverse/default:`, modeErr);
          }
        }

        // Attempt 3: Try opposite facingMode (e.g. laptop webcam if environment failed)
        if (!started) {
          const alternateMode = mode === 'environment' ? 'user' : 'environment';
          try {
            await html5QrCode.start(
              { facingMode: alternateMode },
              config,
              qrSuccessCallback,
              qrErrorCallback
            );
            started = true;
            setFacingMode(alternateMode);
          } catch (altErr) {
            console.warn(`Starting alternate mode ${alternateMode} failed:`, altErr);
          }
        }

        // Attempt 4: Fallback to any default video device
        if (!started) {
          const devices = await Html5Qrcode.getCameras().catch(() => []);
          if (devices && devices.length > 0) {
            await html5QrCode.start(
              devices[0].id,
              config,
              qrSuccessCallback,
              qrErrorCallback
            );
            started = true;
            setSelectedCameraId(devices[0].id);
          }
        }

        if (!started) {
          throw new Error('Semua opsi kamera gagal dimulai.');
        }

        // Query available cameras to update selector if not yet fetched
        try {
          const availableCams = await Html5Qrcode.getCameras();
          if (isMountedRef.current && availableCams.length > 0) {
            setCameras(
              availableCams.map((c) => ({
                id: c.id,
                label: c.label || `Kamera ${c.id.slice(0, 4)}`,
              }))
            );
          }
        } catch {
          // Ignore enumeration errors
        }

        if (isMountedRef.current) {
          setScannerStatus('scanning');
        }
      } catch (err: unknown) {
        console.error('Camera scanner init failed:', err);
        if (!isMountedRef.current) return;

        setScannerStatus('error');
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('NotAllowedError') ||
          msg.includes('Permission') ||
          msg.includes('denied')
        ) {
          setErrorMessage(
            'Izin kamera ditolak oleh browser. Klik icon gembok / izin di browser dan izinkan akses kamera.'
          );
        } else if (
          msg.includes('NotFoundError') ||
          msg.includes('DevicesNotFoundError')
        ) {
          setErrorMessage('Perangkat kamera tidak ditemukan pada sistem/komputer ini.');
        } else if (
          msg.includes('InsecureContext') ||
          (typeof window !== 'undefined' &&
            !window.isSecureContext &&
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1')
        ) {
          setErrorMessage(
            'Akses kamera memerlukan koneksi HTTPS saat dibuka dari jaringan WiFi atau HP.'
          );
        } else {
          setErrorMessage(
            'Gagal membuka kamera. Anda dapat mengganti kamera, upload file foto barcode, atau input manual.'
          );
        }
      } finally {
        isStartingRef.current = false;
      }
    },
    [handleScanMatched, stopScanner]
  );

  // Initialize or restart camera whenever modal is opened or camera changes
  useEffect(() => {
    isMountedRef.current = true;

    if (isOpen) {
      setScannerStatus('idle');
      setScannedResult(null);
      setErrorMessage('');
      setIsManualInput(false);
      setManualText('');

      // Enumerate cameras first to pre-select back camera if on mobile
      const initScanner = async () => {
        try {
          const camList = await Html5Qrcode.getCameras().catch(() => []);
          if (isMountedRef.current && camList.length > 0) {
            const formatted = camList.map((c) => ({
              id: c.id,
              label: c.label || `Kamera ${c.id.slice(0, 4)}`,
            }));
            setCameras(formatted);

            // Find rear camera if environment mode
            let preferredCamId = formatted[0].id;
            const rearCam = formatted.find((c) =>
              /back|rear|environment|belakang|traseira/i.test(c.label)
            );
            if (rearCam) {
              preferredCamId = rearCam.id;
            } else if (formatted.length > 1) {
              // On mobile, back camera is usually the last one in the list
              preferredCamId = formatted[formatted.length - 1].id;
            }

            setSelectedCameraId(preferredCamId);
            await startCameraInstance(preferredCamId, facingMode);
            return;
          }
        } catch {
          // If enumeration fails, fall back to default start
        }

        await startCameraInstance(selectedCameraId, facingMode);
      };

      const timer = setTimeout(() => {
        initScanner();
      }, 150);

      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }

    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Only rerun when modal opens/closes to prevent restart loops

  // Switch between cameras (toggle between cameras or front/back)
  const handleToggleCamera = async () => {
    if (cameras.length > 1) {
      const currentIdx = cameras.findIndex((c) => c.id === selectedCameraId);
      const nextIdx = (currentIdx + 1) % cameras.length;
      const nextCam = cameras[nextIdx];
      setSelectedCameraId(nextCam.id);
      await startCameraInstance(nextCam.id, facingMode);
    } else {
      const nextMode = facingMode === 'environment' ? 'user' : 'environment';
      setFacingMode(nextMode);
      await startCameraInstance(null, nextMode);
    }
  };

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
      setErrorMessage(
        'Tidak ditemukan barcode atau QR Code yang dapat dibaca pada gambar ini. Pastikan gambar jelas dan tidak buram.'
      );
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

  // Active camera display label
  const activeCameraObj = cameras.find((c) => c.id === selectedCameraId);
  const cameraLabel = activeCameraObj
    ? activeCameraObj.label
    : facingMode === 'environment'
    ? 'Kamera Belakang'
    : 'Kamera Depan';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800/80 bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">
                Scan {targetField === 'mac' ? 'MAC Address' : 'Machine Control ID'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Arahkan kamera ke QR Code atau Barcode perangkat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            title="Tutup Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 flex flex-col items-center overflow-y-auto">
          {/* Viewport Box */}
          <div className="relative w-full aspect-square max-w-[280px] sm:max-w-[340px] rounded-2xl overflow-hidden bg-black border border-slate-700/80 flex items-center justify-center shadow-inner shrink-0 min-h-[260px]">
            {/* The html5-qrcode target div */}
            <div
              id={scannerContainerId}
              className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_canvas]:hidden"
            />

            {/* Reticle / Viewfinder Overlay */}
            {scannerStatus === 'scanning' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-cyan-400/80 rounded-xl relative">
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-cyan-300" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-cyan-300" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-cyan-300" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-cyan-300" />

                  {/* Animated laser scan line */}
                  <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_10px_#06b6d4] animate-pulse top-1/2 -translate-y-1/2" />
                </div>
              </div>
            )}

            {/* Starting state overlay */}
            {scannerStatus === 'starting' && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-2.5 text-cyan-400 p-4 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
                <span className="text-xs font-medium text-slate-200">
                  Menginisialisasi kamera...
                </span>
                <span className="text-[11px] text-slate-400">
                  Mohon berikan izin kamera jika diminta browser
                </span>
              </div>
            )}

            {/* Success state overlay */}
            {scannerStatus === 'success' && (
              <div className="absolute inset-0 bg-emerald-950/95 flex flex-col items-center justify-center gap-2.5 text-emerald-400 animate-in zoom-in-95 duration-150 p-4 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-200">Kode Terdeteksi:</span>
                <span className="text-sm px-3 py-1.5 rounded-lg bg-emerald-900/70 font-mono text-emerald-100 border border-emerald-600 break-all max-w-full font-bold shadow-md">
                  {scannedResult}
                </span>
              </div>
            )}

            {/* Error or No Camera Overlay */}
            {scannerStatus === 'error' && (
              <div className="absolute inset-0 p-4 bg-slate-950/95 flex flex-col items-center justify-center text-center gap-3">
                <AlertTriangle className="w-9 h-9 text-amber-400 shrink-0" />
                <p className="text-xs text-slate-200 leading-relaxed px-1">
                  {errorMessage}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => startCameraInstance(selectedCameraId, facingMode)}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Coba Lagi
                  </button>
                  <button
                    onClick={handleToggleCamera}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                    Ganti Kamera
                  </button>
                  <button
                    onClick={() => setIsManualInput(true)}
                    className="px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-md"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    Ketik Manual
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls bar below camera */}
          <div className="flex items-center justify-between w-full mt-3.5 text-xs text-slate-400 gap-2">
            <button
              onClick={handleToggleCamera}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 active:scale-95 transition-all text-xs border border-slate-700/60"
              title="Ganti Kamera"
            >
              <SwitchCamera className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate max-w-[140px] sm:max-w-[170px]">{cameraLabel}</span>
            </button>

            {/* Upload image fallback */}
            <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 cursor-pointer active:scale-95 transition-all text-xs border border-slate-700/60">
              <Upload className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
            <div className="w-full mt-3.5 p-3 bg-slate-800/60 rounded-xl border border-slate-700/70 animate-in fade-in">
              <label className="block text-xs font-medium text-slate-200 mb-1.5">
                Ketik Nilai Manual ({targetField === 'mac' ? 'MAC Address' : 'MCID'}):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApplyManual();
                  }}
                  placeholder={
                    targetField === 'mac' ? 'AA:BB:CC:DD:EE:FF' : 'CNC-LINE-01'
                  }
                  autoFocus
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleApplyManual}
                  disabled={!manualText.trim()}
                  className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors shadow-md"
                >
                  Terapkan
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsManualInput(true)}
              className="text-xs text-slate-400 hover:text-cyan-400 mt-2.5 flex items-center gap-1.5 transition-colors"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Kamera bermasalah? Ketik atau paste teks manual di sini</span>
            </button>
          )}

          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Volume2 className="w-3.5 h-3.5 text-cyan-500/80 shrink-0" />
            <span>Bunyi konfirmasi otomatis berbunyi saat kode terdeteksi.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
