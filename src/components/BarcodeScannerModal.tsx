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
  Flashlight,
  FlashlightOff,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
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
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const activeTrackRef = useRef<MediaStreamTrack | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
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

  // Safely stop and clear scanner instance and release hardware camera tracks
  const stopScanner = useCallback(async () => {
    // 0. Disconnect DOM mutation observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    // 1. Turn off torch and stop active video track if present
    if (activeTrackRef.current) {
      try {
        await activeTrackRef.current.applyConstraints({
          advanced: [{ torch: false } as MediaTrackConstraintSet],
        });
      } catch {}
      try {
        activeTrackRef.current.stop();
      } catch {}
      activeTrackRef.current = null;
    }
    setIsTorchOn(false);
    setHasTorch(false);

    // 2. Stop html5-qrcode instance
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

    // 3. Clean up any lingering video elements and media streams from container
    if (typeof document !== 'undefined') {
      const container = document.getElementById(scannerContainerId);
      if (container) {
        const videos = container.querySelectorAll('video');
        videos.forEach((video) => {
          if (video.srcObject instanceof MediaStream) {
            video.srcObject.getTracks().forEach((track) => {
              try {
                track.stop();
              } catch {}
            });
            video.srcObject = null;
          }
        });
        container.innerHTML = '';
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

  // Helper to ensure iOS Safari WebKit renders video inline properly without black screen
  const patchVideoElementForWebKit = useCallback((video: HTMLVideoElement) => {
    // Critical attributes for iOS Safari inline playback:
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.setAttribute('muted', 'true');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;

    // Force styles to override any inline style="width: 0px" during iOS layout animations
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.minWidth = '100%';
    video.style.minHeight = '100%';
    video.style.objectFit = 'cover';
    video.style.display = 'block';
    video.style.position = 'absolute';
    video.style.top = '0';
    video.style.left = '0';
    (video.style as unknown as Record<string, string>).webkitTransform = 'translateZ(0)';
    video.style.transform = 'translateZ(0)';

    // Ensure playback starts on iOS WebKit
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        setTimeout(() => {
          video.play().catch(() => {});
        }, 150);
      });
    }

    video.onloadedmetadata = () => {
      if (video.paused) {
        video.play().catch(() => {});
      }
    };
  }, []);

  // Helper to start camera scanner with fallback chain
  const startCameraInstance = useCallback(
    async (camId: string | null, mode: 'environment' | 'user') => {
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

      // Wait until container has real rendered dimensions (prevents iOS Safari 0x0 layout bug)
      let container: HTMLElement | null = null;
      for (let i = 0; i < 15; i++) {
        container = document.getElementById(scannerContainerId);
        if (container && container.clientWidth > 40 && container.clientHeight > 40) {
          break;
        }
        await new Promise((r) => setTimeout(r, 40));
      }

      if (!container) {
        isStartingRef.current = false;
        return;
      }
      container.innerHTML = '';

      // Setup MutationObserver to immediately patch any injected <video> with iOS WebKit attributes
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of Array.from(m.addedNodes)) {
            if (node.nodeName === 'VIDEO') {
              patchVideoElementForWebKit(node as HTMLVideoElement);
            } else if ((node as HTMLElement).querySelector) {
              const v = (node as HTMLElement).querySelector('video');
              if (v) patchVideoElementForWebKit(v);
            }
          }
        }
      });
      observer.observe(container, { childList: true, subtree: true });
      observerRef.current = observer;

      try {
        // Supported formats: QR Code + Industrial 1D Barcodes + Data Matrix
        const html5QrCode = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        const qrSuccessCallback = (decodedText: string) => {
          handleScanMatched(decodedText);
        };

        const qrErrorCallback = () => {
          // No-op per frame scan miss
        };

        // Note: Do not constrain qrbox to a small square.
        // Full frame scan allows wide 1D barcodes (MAC Code 128 / Code 39)
        // and 2D QR codes to be decoded smoothly without coordinate offset distortion.
        const config = {
          fps: 15,
        };

        let started = false;

        // Attempt 1: Try specific cameraId if explicitly selected by user from dropdown
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
            console.warn(`Starting camera ID ${camId} failed:`, camErr);
          }
        }

        // Attempt 2: Try facingMode (natively selects best primary rear camera on mobile phones)
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
            console.warn(`Starting facingMode ${mode} failed:`, modeErr);
          }
        }

        // Attempt 3: If environment failed (e.g. laptop / PC webcam without rear camera)
        if (!started && mode === 'environment') {
          try {
            await html5QrCode.start(
              { facingMode: 'user' },
              config,
              qrSuccessCallback,
              qrErrorCallback
            );
            started = true;
            setFacingMode('user');
          } catch (altErr) {
            console.warn('Starting user facingMode fallback failed:', altErr);
          }
        }

        // Attempt 4: Fallback to any enumerated video device
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
          throw new Error('Semua opsi kamera gagal dibuka. Pastikan izin kamera aktif.');
        }

        // Post-start WebKit video check and continuous autofocus
        try {
          const videoEl = container.querySelector('video') as HTMLVideoElement | null;
          if (videoEl) {
            patchVideoElementForWebKit(videoEl);

            if (videoEl.srcObject instanceof MediaStream) {
              const [track] = videoEl.srcObject.getVideoTracks();
              if (track) {
                activeTrackRef.current = track;
                const caps = ((track.getCapabilities && track.getCapabilities()) || {}) as Record<string, unknown>;
                const focusModeList = caps.focusMode;
                if (Array.isArray(focusModeList) && focusModeList.includes('continuous')) {
                  await track.applyConstraints({
                    advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
                  }).catch(() => {});
                }
                if ('torch' in caps && Boolean(caps.torch)) {
                  setHasTorch(true);
                  setIsTorchOn(false);
                } else {
                  setHasTorch(false);
                  setIsTorchOn(false);
                }
              }
            }
          }
        } catch {
          // Ignore track constraint error
        }

        // Query available cameras to populate camera switcher list
        try {
          const availableCams = await Html5Qrcode.getCameras();
          if (isMountedRef.current && availableCams && availableCams.length > 0) {
            const formatted = availableCams.map((c) => ({
              id: c.id,
              label: c.label || `Kamera ${c.id.slice(0, 4)}`,
            }));
            setCameras(formatted);
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
    [handleScanMatched, stopScanner, patchVideoElementForWebKit]
  );

  // Initialize camera whenever modal is opened
  useEffect(() => {
    isMountedRef.current = true;

    if (isOpen) {
      setScannerStatus('idle');
      setScannedResult(null);
      setErrorMessage('');
      setIsManualInput(false);
      setManualText('');
      setFacingMode('environment'); // Always start with rear camera
      setSelectedCameraId(null);
      setIsTorchOn(false);

      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          startCameraInstance(null, 'environment');
        }
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
  }, [isOpen, startCameraInstance, stopScanner]);

  // Toggle between rear camera and front camera
  const handleToggleFacingMode = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    setSelectedCameraId(null);
    await startCameraInstance(null, nextMode);
  };

  // Toggle Torch (flashlight)
  const handleToggleTorch = async () => {
    if (!activeTrackRef.current) return;
    try {
      const nextTorch = !isTorchOn;
      await activeTrackRef.current.applyConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      });
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
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

  const cameraLabel =
    facingMode === 'environment' ? 'Kamera Belakang' : 'Kamera Depan';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      {/* Global CSS to prevent iOS WebKit / Safari video collapsing and black screen */}
      <style>{`
        #${scannerContainerId} {
          width: 100% !important;
          height: 100% !important;
          min-height: 260px !important;
          position: relative !important;
          overflow: hidden !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          -webkit-transform: translateZ(0) !important;
          transform: translateZ(0) !important;
        }
        #${scannerContainerId} video {
          width: 100% !important;
          height: 100% !important;
          min-width: 100% !important;
          min-height: 100% !important;
          object-fit: cover !important;
          display: block !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          -webkit-transform: translateZ(0) !important;
          transform: translateZ(0) !important;
        }
        #${scannerContainerId} canvas {
          display: none !important;
        }
        #${scannerContainerId} #qr-shaded-region {
          display: none !important;
        }
      `}</style>

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
          {/* Viewport Box with WebKit GPU acceleration fixes */}
          <div
            className="relative w-full aspect-square max-w-[280px] sm:max-w-[340px] rounded-2xl overflow-hidden bg-black border border-slate-700/80 flex items-center justify-center shadow-inner shrink-0 min-h-[260px]"
            style={{
              WebkitTransform: 'translateZ(0)',
              transform: 'translateZ(0)',
              WebkitMaskImage: '-webkit-radial-gradient(white, black)',
            }}
          >
            {/* The html5-qrcode target div */}
            <div
              id={scannerContainerId}
              className="w-full h-full"
            />

            {/* Reticle / Viewfinder Overlay - Rectangular for both 1D Barcodes & QR Codes */}
            {scannerStatus === 'scanning' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                <div className="w-56 h-40 sm:w-64 sm:h-48 border-2 border-cyan-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-cyan-300 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-cyan-300 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-cyan-300 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-cyan-300 rounded-br-lg" />

                  {/* Animated laser scan line */}
                  <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#06b6d4] animate-pulse top-1/2 -translate-y-1/2" />

                  {/* Target Field Hint Overlay badge inside reticle */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-slate-900/85 border border-slate-700 text-[10px] text-cyan-300 font-mono tracking-wider shadow-sm whitespace-nowrap">
                    {targetField === 'mac' ? 'MAC BARCODE / QR' : 'MCID BARCODE / QR'}
                  </div>
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
                    onClick={handleToggleFacingMode}
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
            {/* Toggle Rear / Front Camera */}
            <button
              onClick={handleToggleFacingMode}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 active:scale-95 transition-all text-xs border border-slate-700/60"
              title="Ganti Kamera Belakang / Depan"
            >
              <SwitchCamera className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate max-w-[130px] sm:max-w-[160px]">{cameraLabel}</span>
            </button>

            {/* Flashlight / Torch toggle button (if supported by device rear camera) */}
            {hasTorch && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`px-3 py-2 rounded-xl active:scale-95 transition-all text-xs border flex items-center gap-1.5 ${
                  isTorchOn
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700/60'
                }`}
                title={isTorchOn ? 'Matikan Senter' : 'Nyalakan Senter'}
              >
                {isTorchOn ? (
                  <FlashlightOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Flashlight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
                <span className="hidden xs:inline">{isTorchOn ? 'Senter Aktif' : 'Senter'}</span>
              </button>
            )}

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

          {/* Optional camera lens selector if device has multiple cameras */}
          {cameras.length > 2 && (
            <div className="w-full mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="shrink-0 text-slate-500">Pilih Lensa:</span>
              <select
                value={selectedCameraId || (facingMode === 'environment' ? 'env' : 'usr')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'env') {
                    setFacingMode('environment');
                    setSelectedCameraId(null);
                    startCameraInstance(null, 'environment');
                  } else if (val === 'usr') {
                    setFacingMode('user');
                    setSelectedCameraId(null);
                    startCameraInstance(null, 'user');
                  } else {
                    setSelectedCameraId(val);
                    startCameraInstance(val, facingMode);
                  }
                }}
                className="flex-1 bg-slate-900 border border-slate-700/80 text-slate-200 rounded-lg px-2 py-1 text-[11px] truncate focus:outline-none focus:border-cyan-500"
              >
                <option value="env">Kamera Belakang (Otomatis)</option>
                <option value="usr">Kamera Depan (Selfie/Webcam)</option>
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

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
