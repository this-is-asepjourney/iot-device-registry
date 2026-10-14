import * as XLSX from 'xlsx';
import { InstallationPlan, FactoryCode, FACTORY_LIST } from '@/types';
import { normalizeMcid, downloadCsv } from '@/lib/utils';

export interface ParsedPlanRow {
  rowNumber: number;
  rawMcid: string;
  rawModel: string;
  rawFactory: string;
  rawLine: string;
  rawTargetDate: string;
  rawNotes: string;
  normMcid: string;
  factoryCode: FactoryCode | null;
  isValid: boolean;
  errors: string[];
}

/**
 * Downloads official Excel (.xlsx) template for installation planning
 */
export function downloadPlanTemplateExcel(): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Template Data
  const headers = [
    'MCID (*Wajib)',
    'Model_Mesin',
    'Factory (A1-D2)',
    'Line',
    'Target_Tanggal (YYYY-MM-DD)',
    'Catatan_Request',
  ];

  const sampleRows = [
    ['PRESS-80T-05', 'Komatsu 80 Ton Mechanical Press', 'A1', 'Press Line 1', '2026-10-25', 'Instalasi sensor getaran spindle & suhu motor'],
    ['CNC-VM3-02', 'Haas CNC VM-3 Mold Making', 'B2', 'Machining Bay 2', '2026-10-28', 'Modul IoT pemantau RPM & arus beban'],
    ['ROBOT-WELD-08', 'Fanuc Arc Mate 100iD', 'C1', 'Welding Line 3', '2026-11-02', 'Gateway Modbus TCP'],
    ['PUMP-CHILLER-01', 'Ebara Centrifugal 15kW', 'D1', 'Utility Plant', '2026-11-05', 'Sensor tekanan pipa air pendingin'],
    ['LATHE-MAZAK-04', 'Mazak Quick Turn 250', 'A2', 'Turning Line 2', '2026-11-10', 'Sensor power meter IoT'],
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 18 }, // MCID
    { wch: 32 }, // Model_Mesin
    { wch: 16 }, // Factory
    { wch: 20 }, // Line
    { wch: 26 }, // Target_Tanggal
    { wch: 42 }, // Catatan_Request
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Template_Planning');

  // Sheet 2: Petunjuk Pengisian
  const instructionHeaders = ['Kolom', 'Sifat', 'Aturan / Keterangan'];
  const instructionRows = [
    ['MCID', 'WAJIB', 'ID unik mesin pabrik (contoh: PRESS-80T-05, CNC-VF2-10). Huruf besar/kecil otomatis dinormalkan.'],
    ['Model_Mesin', 'Opsional', 'Tipe/merk mesin yang akan dipasangi unit IoT (contoh: Haas CNC Milling VF-2).'],
    ['Factory', 'Opsional', 'Kode area pabrik. Pilihan: A1, A2, B1, B2, C1, C2, D1, D2.'],
    ['Line', 'Opsional', 'Sub-area atau jalur produksi (contoh: Line 1, Stamping Bay A).'],
    ['Target_Tanggal', 'Opsional', 'Format tanggal YYYY-MM-DD (contoh: 2026-10-25).'],
    ['Catatan_Request', 'Opsional', 'Keterangan kebutuhan instalasi (contoh: Permintaan sensor getaran dari Dept Maintenance).'],
    ['MAC Address', 'TIDAK PERLU', 'Kolom MAC Address tidak ada di sini. Saat unit fisik sudah dipasang di mesin, teknisi tinggal menginput atau men-scan MAC Address pada aplikasi (mapping).'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet([instructionHeaders, ...instructionRows]);
  wsInstructions['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Petunjuk_Pengisian');

  // Generate buffer and trigger browser download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'format_request_planning_pemasangan_iot.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads CSV template fallback for installation planning
 */
export function downloadPlanTemplateCsv(): void {
  const headers = [
    'MCID',
    'Model_Mesin',
    'Factory',
    'Line',
    'Target_Tanggal',
    'Catatan_Request',
  ];

  const sampleRows = [
    ['PRESS-80T-05', 'Komatsu 80 Ton Mechanical Press', 'A1', 'Press Line 1', '2026-10-25', 'Instalasi sensor getaran spindle & suhu motor'],
    ['CNC-VM3-02', 'Haas CNC VM-3 Mold Making', 'B2', 'Machining Bay 2', '2026-10-28', 'Modul IoT pemantau RPM & arus beban'],
    ['ROBOT-WELD-08', 'Fanuc Arc Mate 100iD', 'C1', 'Welding Line 3', '2026-11-02', 'Gateway Modbus TCP'],
    ['PUMP-CHILLER-01', 'Ebara Centrifugal 15kW', 'D1', 'Utility Plant', '2026-11-05', 'Sensor tekanan pipa air pendingin'],
    ['LATHE-MAZAK-04', 'Mazak Quick Turn 250', 'A2', 'Turning Line 2', '2026-11-10', 'Sensor power meter IoT'],
  ];

  downloadCsv('format_request_planning_pemasangan_iot.csv', headers, sampleRows);
}

/**
 * Parses uploaded .xlsx, .xls, or .csv file into parsed plan rows
 */
export async function parsePlanSpreadsheet(file: File): Promise<ParsedPlanRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File tidak memiliki sheet data yang dapat dibaca.');
  }

  const ws = wb.Sheets[firstSheetName];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (grid.length < 2) {
    throw new Error('File harus memiliki minimal baris header dan 1 baris data.');
  }

  // Find header row by searching for "mcid" or similar keywords
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(grid.length, 5); i++) {
    const row = (grid[i] || []).map((c) => String(c || '').toLowerCase().trim());
    if (row.some((cell) => cell.includes('mcid') || cell.includes('mc_id') || cell.includes('machine id') || cell.includes('id mesin') || cell.includes('kode mesin'))) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = (grid[headerRowIndex] || []).map((c) => String(c || '').toLowerCase().trim());

  // Find column indexes
  const colIndex = {
    mcid: -1,
    model: -1,
    factory: -1,
    line: -1,
    targetDate: -1,
    notes: -1,
  };

  rawHeaders.forEach((h, idx) => {
    if (colIndex.mcid === -1 && (h.includes('mcid') || h.includes('mc_id') || h.includes('machine') || h.includes('id mesin') || h.includes('kode mesin'))) {
      colIndex.mcid = idx;
    } else if (colIndex.model === -1 && (h.includes('model') || h.includes('mesin') || h.includes('tipe') || h.includes('nama'))) {
      colIndex.model = idx;
    } else if (colIndex.factory === -1 && (h.includes('factory') || h.includes('pabrik') || h.includes('plant') || h.includes('area'))) {
      colIndex.factory = idx;
    } else if (colIndex.line === -1 && (h.includes('line') || h.includes('jalur') || h.includes('section'))) {
      colIndex.line = idx;
    } else if (colIndex.targetDate === -1 && (h.includes('target') || h.includes('tanggal') || h.includes('date') || h.includes('jadwal') || h.includes('due'))) {
      colIndex.targetDate = idx;
    } else if (colIndex.notes === -1 && (h.includes('catatan') || h.includes('notes') || h.includes('request') || h.includes('keterangan'))) {
      colIndex.notes = idx;
    }
  });

  // Fallback default column indexes if header not found
  if (colIndex.mcid === -1) colIndex.mcid = 0;
  if (colIndex.model === -1) colIndex.model = 1;
  if (colIndex.factory === -1) colIndex.factory = 2;
  if (colIndex.line === -1) colIndex.line = 3;
  if (colIndex.targetDate === -1) colIndex.targetDate = 4;
  if (colIndex.notes === -1) colIndex.notes = 5;

  const parsedRows: ParsedPlanRow[] = [];
  const seenMcidsInFile = new Set<string>();

  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    // Ignore completely empty rows
    if (row.every((cell) => !String(cell || '').trim())) {
      continue;
    }

    const rawMcid = String(row[colIndex.mcid] ?? '').trim();
    const rawModel = String(row[colIndex.model] ?? '').trim();
    const rawFactory = String(row[colIndex.factory] ?? '').trim();
    const rawLine = String(row[colIndex.line] ?? '').trim();

    // Handle date formatting
    let rawTargetDate = '';
    const dateVal = row[colIndex.targetDate];
    if (dateVal instanceof Date) {
      rawTargetDate = dateVal.toISOString().split('T')[0];
    } else if (typeof dateVal === 'number') {
      // Excel serial date format
      const parsedDate = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
      if (!isNaN(parsedDate.getTime())) {
        rawTargetDate = parsedDate.toISOString().split('T')[0];
      } else {
        rawTargetDate = String(dateVal);
      }
    } else {
      rawTargetDate = String(dateVal ?? '').trim();
    }

    const rawNotes = String(row[colIndex.notes] ?? '').trim();

    const normMcid = normalizeMcid(rawMcid);
    const errors: string[] = [];

    // Validation: MCID is MANDATORY
    if (!normMcid) {
      errors.push('MCID (Machine ID) wajib diisi');
    } else if (seenMcidsInFile.has(normMcid)) {
      errors.push(`Duplikasi MCID [${normMcid}] dalam file`);
    } else {
      seenMcidsInFile.add(normMcid);
    }

    // Factory validation (optional)
    let factoryCode: FactoryCode | null = null;
    if (rawFactory) {
      const match = rawFactory.match(/\b([A-D][1-2])\b/i);
      if (match) {
        factoryCode = match[1].toUpperCase() as FactoryCode;
      } else if (FACTORY_LIST.includes(rawFactory.toUpperCase() as FactoryCode)) {
        factoryCode = rawFactory.toUpperCase() as FactoryCode;
      }
    }

    parsedRows.push({
      rowNumber: r + 1,
      rawMcid,
      rawModel,
      rawFactory,
      rawLine,
      rawTargetDate,
      rawNotes,
      normMcid,
      factoryCode,
      isValid: errors.length === 0,
      errors,
    });
  }

  return parsedRows;
}

/**
 * Exports current installation plans list to Excel (.xlsx)
 */
export function exportPlansToExcel(plans: InstallationPlan[]): void {
  const wb = XLSX.utils.book_new();

  const headers = [
    'No',
    'MCID',
    'Model Mesin',
    'Lokasi',
    'Status Planning',
    'MAC Address Terpasang',
    'Target Tanggal',
    'Tanggal Pemasangan',
    'Teknisi',
    'Catatan / Request',
    'Dibuat Pada',
  ];

  const dataRows = plans.map((p, idx) => [
    idx + 1,
    p.mcid,
    p.machineModel || '-',
    p.location || '-',
    p.status === 'Installed' ? 'Selesai (Installed)' : p.status === 'Planned' ? 'Menunggu Pemasangan' : 'Dibatalkan',
    p.installedMac || '-',
    p.targetDate || '-',
    p.installedAt ? new Date(p.installedAt).toLocaleString('id-ID') : '-',
    p.installedBy || p.createdBy || '-',
    p.notes || '-',
    p.createdAt ? new Date(p.createdAt).toLocaleString('id-ID') : '-',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 30 },
    { wch: 25 },
    { wch: 22 },
    { wch: 22 },
    { wch: 15 },
    { wch: 22 },
    { wch: 25 },
    { wch: 35 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Laporan_Planning_IoT');

  const nowStr = new Date().toISOString().split('T')[0];
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan_planning_pemasangan_iot_${nowStr}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
