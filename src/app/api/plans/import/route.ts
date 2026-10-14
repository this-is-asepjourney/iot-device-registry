import { NextResponse } from 'next/server';
import { queryD1, executeD1Batch } from '@/lib/d1';
import { normalizeMcid, formatLocation } from '@/lib/utils';
import { ImportPlansPayload } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload: ImportPlansPayload = await request.json();

    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada data rencana pemasangan yang dikirim untuk diimpor.' },
        { status: 400 }
      );
    }

    const technician = payload.technicianEmail || 'technician@factory.local';
    const now = new Date().toISOString();

    // Fetch existing plans to check for pending duplicates
    const existingPlansRes = await queryD1<{ mcid: string; status: string }>(
      "SELECT mcid, status FROM installation_plans WHERE status = 'Planned'"
    );
    const pendingPlansSet = new Set(existingPlansRes.results.map((p) => p.mcid.toUpperCase()));

    // Check if machine already has an active IoT installed in devices
    const existingDevicesRes = await queryD1<{ mcid: string }>(
      "SELECT mcid FROM devices WHERE status != 'Removed'"
    );
    const existingDevicesSet = new Set(existingDevicesRes.results.map((d) => d.mcid.toUpperCase()));

    const batchSeenMcid = new Set<string>();

    interface ValidPlanItem {
      id: string;
      mcid: string;
      machineModel: string;
      location: string;
      targetDate: string;
      notes: string;
      createdAt: string;
      createdBy: string;
    }

    const validItems: ValidPlanItem[] = [];
    const errors: string[] = [];

    for (let index = 0; index < payload.items.length; index++) {
      const item = payload.items[index];
      const rowNum = index + 1;

      const normMcid = normalizeMcid(item.mcid);

      // 1. Mandatory validation: MCID MUST NOT BE EMPTY
      if (!normMcid) {
        errors.push(`Baris ${rowNum}: MCID (Machine ID) wajib diisi.`);
        continue;
      }

      // 2. Check duplicates inside this import batch
      if (batchSeenMcid.has(normMcid)) {
        errors.push(`Baris ${rowNum}: Duplikasi MCID [${normMcid}] dalam file yang diimpor.`);
        continue;
      }
      batchSeenMcid.add(normMcid);

      // 3. Check if machine already has a pending plan
      if (pendingPlansSet.has(normMcid)) {
        errors.push(`Baris ${rowNum}: Mesin [${normMcid}] sudah memiliki rencana aktif (status: Planned).`);
        continue;
      }

      // Format location if factory or line provided
      let finalLocation = '';
      if (item.factory || item.line) {
        finalLocation = formatLocation(item.factory || '', item.line || '');
      }

      // Add auto-note if machine already active in devices
      let combinedNotes = item.notes?.trim() || '';
      if (existingDevicesSet.has(normMcid)) {
        combinedNotes = combinedNotes
          ? `${combinedNotes} (Catatan: Mesin sudah memiliki IoT aktif di registry)`
          : 'Catatan: Mesin sudah memiliki IoT aktif di registry';
      }

      const id = `plan-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`;

      validItems.push({
        id,
        mcid: normMcid,
        machineModel: item.machineModel?.trim() || '',
        location: finalLocation,
        targetDate: item.targetDate?.trim() || '',
        notes: combinedNotes,
        createdAt: now,
        createdBy: technician,
      });
    }

    if (validItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          totalRequested: payload.items.length,
          importedCount: 0,
          skippedCount: payload.items.length,
          errors,
          message: 'Semua baris dalam file gagal divalidasi. Pastikan kolom MCID terisi.',
        },
        { status: 400 }
      );
    }

    // Build batch SQL statements
    const statements = validItems.map((item) => ({
      sql: `INSERT INTO installation_plans 
            (id, mcid, machine_model, location, status, target_date, notes, created_at, created_by)
            VALUES (?, ?, ?, ?, 'Planned', ?, ?, ?, ?)`,
      params: [
        item.id,
        item.mcid,
        item.machineModel,
        item.location,
        item.targetDate,
        item.notes,
        item.createdAt,
        item.createdBy,
      ],
    }));

    await executeD1Batch(statements);

    return NextResponse.json({
      success: true,
      totalRequested: payload.items.length,
      importedCount: validItems.length,
      skippedCount: payload.items.length - validItems.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Berhasil mengimpor ${validItems.length} rencana pemasangan ke sistem.${
        errors.length > 0 ? ` (${errors.length} baris dilewati karena duplikasi/tidak valid)` : ''
      }`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
