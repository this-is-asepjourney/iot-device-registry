import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes a Machine Control ID (MCID):
 * Trims leading/trailing whitespace, converts to uppercase, replaces consecutive spaces with a single dash/space.
 */
export function normalizeMcid(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-');
}

/**
 * Strips colons, hyphens, spaces, and dots from MAC address and converts to uppercase.
 * Example: "00:1a:2b:3c:4d:5e" -> "001A2B3C4D5E"
 */
export function normalizeMacAddress(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
}

/**
 * Formats a raw or partial string into standard MAC Address notation (XX:XX:XX:XX:XX:XX).
 */
export function formatMacAddress(raw: string): string {
  const clean = normalizeMacAddress(raw);
  const parts: string[] = [];
  for (let i = 0; i < clean.length && i < 12; i += 2) {
    parts.push(clean.substring(i, i + 2));
  }
  return parts.join(':');
}

/**
 * Validates whether the given string is a valid 6-byte MAC address.
 */
export function isValidMacAddress(raw: string): boolean {
  const clean = normalizeMacAddress(raw);
  return clean.length === 12;
}

/**
 * Formats an ISO date string into user-friendly Indonesian locale representation.
 */
export function formatDate(isoString: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Plays a crisp synthesized audio beep on successful barcode/QR scan using the Web Audio API.
 */
export function playBeepSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08); // E6 note

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (err) {
    // Audio context may be restricted by browser policy; silently ignore
    console.debug('Beep sound error:', err);
  }
}

/**
 * Generates and triggers download of a CSV file with UTF-8 BOM so Microsoft Excel
 * properly parses characters and delimiters without encoding issues.
 */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | undefined | null)[][]): void {
  const escapeCell = (cell: string | number | undefined | null): string => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.map(escapeCell).join(','))
  ].join('\r\n');

  // \uFEFF is the UTF-8 Byte Order Mark (BOM) needed by Excel
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Extracts a factory code (A1, A2, B1, B2, C1, C2, D1, D2) from a location string.
 */
export function extractFactory(locationStr?: string): string | null {
  if (!locationStr) return null;
  const match = locationStr.match(/\b([A-D][1-2])\b/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Returns tailored Tailwind CSS badge classes for each factory code.
 */
export function getFactoryBadgeStyle(factoryCode?: string | null): { bg: string; text: string; border: string } {
  switch (factoryCode?.toUpperCase()) {
    case 'A1':
      return { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' };
    case 'A2':
      return { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' };
    case 'B1':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    case 'B2':
      return { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30' };
    case 'C1':
      return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' };
    case 'C2':
      return { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' };
    case 'D1':
      return { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' };
    case 'D2':
      return { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' };
    default:
      return { bg: 'bg-slate-800', text: 'text-slate-400', border: 'border-slate-700' };
  }
}

