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
    const existingDevicesRes = await queryD1<{
      mcid: string;
      mac_address: string;
      machine_model: string;
      location: string;
      installed_at: string;
      last_technician: string | null;
    }>("SELECT mcid, mac_address, machine_model, location, installed_at, last_technician FROM devices WHERE status != 'Removed'");

    const existingDeviceMap = new Map<string, (typeof existingDevicesRes.results)[0]>();
    existingDevicesRes.results.forEach((d) => existingDeviceMap.set(d.mcid.toUpperCase().trim(), d));

    const batchSeenMcid = new Set<string>();

    interface ValidPlanItem {
      id: string;
      mcid: string;
      machineModel: string;
      location: string;
      status: 'Planned' | 'Installed';
      targetDate: string;
      notes: string;
      installedMac?: string;
      installedAt?: string;
      installedBy?: string;
      createdAt: string;
      createdBy: string;
    }

    const validItems: ValidPlanItem[] = [];
    const errors: string[] = [];
    let autoSyncedCount = 0;

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

      // Check if machine already active in devices
      const activeDev = existingDeviceMap.get(normMcid);

      // Format location if factory or line provided
      let finalLocation = '';
      if (item.factory || item.line) {
        finalLocation = formatLocation(item.factory || '', item.line || '');
      } else if (activeDev?.location) {
        finalLocation = activeDev.location;
      }

      const finalModel = item.machineModel?.trim() || activeDev?.machine_model || '';

      const id = `plan-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`;

      if (activeDev) {
        autoSyncedCount++;
        validItems.push({
          id,
          mcid: normMcid,
          machineModel: finalModel,
          location: finalLocation,
          status: 'Installed',
          targetDate: item.targetDate?.trim() || '',
          notes: item.notes?.trim() || `Otomatis selesai: Mesin sudah terpasang modul IoT [${activeDev.mac_address}].`,
          installedMac: activeDev.mac_address,
          installedAt: activeDev.installed_at || now,
          installedBy: activeDev.last_technician || technician,
          createdAt: now,
          createdBy: technician,
        });
      } else {
        validItems.push({
          id,
          mcid: normMcid,
          machineModel: finalModel,
          location: finalLocation,
          status: 'Planned',
          targetDate: item.targetDate?.trim() || '',
          notes: item.notes?.trim() || '',
          createdAt: now,
          createdBy: technician,
        });
      }
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
            (id, mcid, machine_model, location, status, target_date, notes, installed_mac, installed_at, installed_by, created_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        item.id,
        item.mcid,
        item.machineModel,
        item.location,
        item.status,
        item.targetDate,
        item.notes,
        item.installedMac || null,
        item.installedAt || null,
        item.installedBy || null,
        item.createdAt,
        item.createdBy,
      ],
    }));

    await executeD1Batch(statements);

    return NextResponse.json({
      success: true,
      totalRequested: payload.items.length,
      importedCount: validItems.length,
      syncedCount: autoSyncedCount,
      skippedCount: payload.items.length - validItems.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Berhasil mengimpor ${validItems.length} rencana pemasangan (${autoSyncedCount} otomatis ditandai Selesai karena perangkat sudah terpasang).${
        errors.length > 0 ? ` (${errors.length} baris dilewati karena duplikasi/tidak valid)` : ''
      }`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
