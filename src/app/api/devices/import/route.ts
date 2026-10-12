import { NextResponse } from 'next/server';
import { queryD1, executeD1Batch } from '@/lib/d1';
import {
  normalizeMcid,
  normalizeMacAddress,
  formatMacAddress,
  isValidMacAddress,
  formatLocation,
} from '@/lib/utils';
import { ImportDevicesPayload, FACTORY_LIST, FactoryCode } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload: ImportDevicesPayload = await request.json();

    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada data perangkat yang dikirim untuk diimpor.' },
        { status: 400 }
      );
    }

    const technician = payload.technicianEmail || 'technician@factory.local';
    const now = new Date().toISOString();

    // 1. Fetch current active devices and active MACs to validate uniqueness
    const [existingDevsRes, existingMacsRes] = await Promise.all([
      queryD1<{ mcid: string; status: string; mac_address: string }>(
        "SELECT mcid, status, mac_address FROM devices WHERE status != 'Removed'"
      ),
      queryD1<{ normalized_mac: string; mcid: string }>(
        "SELECT normalized_mac, mcid FROM mac_index WHERE status = 'active'"
      ),
    ]);

    const activeMcidMap = new Map<string, string>(); // mcid -> status
    existingDevsRes.results.forEach((d) => activeMcidMap.set(d.mcid.toUpperCase(), d.status));

    const activeMacMap = new Map<string, string>(); // normalized_mac -> mcid
    existingMacsRes.results.forEach((m) => activeMacMap.set(m.normalized_mac.toUpperCase(), m.mcid));

    // Sets to track duplicates within this import payload
    const batchSeenMcid = new Set<string>();
    const batchSeenMac = new Set<string>();

    interface ValidItem {
      mcid: string;
      formattedMac: string;
      normMac: string;
      machineModel: string;
      location: string;
      notes: string;
      historyId: string;
    }

    const validItems: ValidItem[] = [];
    const errors: string[] = [];

    for (let index = 0; index < payload.items.length; index++) {
      const item = payload.items[index];
      const rowNum = index + 1;

      const normMcid = normalizeMcid(item.mcid);
      const normMac = normalizeMacAddress(item.macAddress);
      const formattedMac = formatMacAddress(item.macAddress);

      // Validate MCID
      if (!normMcid) {
        errors.push(`Baris ${rowNum}: MCID tidak boleh kosong.`);
        continue;
      }

      // Validate MAC
      if (!isValidMacAddress(item.macAddress) || normMac.length !== 12) {
        errors.push(`Baris ${rowNum} (${normMcid}): Format MAC Address [${item.macAddress}] tidak valid.`);
        continue;
      }

      // Validate Machine Model
      if (!item.machineModel || !item.machineModel.trim()) {
        errors.push(`Baris ${rowNum} (${normMcid}): Model mesin tidak boleh kosong.`);
        continue;
      }

      // Validate Factory
      const upperFactory = (item.factory || '').trim().toUpperCase() as FactoryCode;
      if (!FACTORY_LIST.includes(upperFactory)) {
        errors.push(
          `Baris ${rowNum} (${normMcid}): Factory [${item.factory}] tidak valid. Harus salah satu dari (${FACTORY_LIST.join(', ')}).`
        );
        continue;
      }

      // Check duplicates within the file itself
      if (batchSeenMcid.has(normMcid)) {
        errors.push(`Baris ${rowNum}: Duplikasi MCID [${normMcid}] dalam file yang diimpor.`);
        continue;
      }
      if (batchSeenMac.has(normMac)) {
        errors.push(`Baris ${rowNum}: Duplikasi MAC [${formattedMac}] dalam file yang diimpor.`);
        continue;
      }

      // Check against existing database
      if (activeMcidMap.has(normMcid)) {
        errors.push(
          `Baris ${rowNum}: Mesin MCID [${normMcid}] sudah terdaftar di sistem (Status: ${activeMcidMap.get(normMcid)}).`
        );
        continue;
      }

      if (activeMacMap.has(normMac)) {
        errors.push(
          `Baris ${rowNum}: MAC [${formattedMac}] sudah aktif digunakan oleh mesin MCID [${activeMacMap.get(normMac)}].`
        );
        continue;
      }

      // Mark as seen in this batch
      batchSeenMcid.add(normMcid);
      batchSeenMac.add(normMac);

      const finalLocation = formatLocation(upperFactory, item.line);

      validItems.push({
        mcid: normMcid,
        formattedMac,
        normMac,
        machineModel: item.machineModel.trim(),
        location: finalLocation,
        notes: item.notes?.trim() || '',
        historyId: `hist-imp-${Date.now()}-${index}`,
      });
    }

    if (validItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          totalRequested: payload.items.length,
          importedCount: 0,
          skippedCount: errors.length,
          errors,
          error: 'Tidak ada data valid yang dapat diimpor.',
        },
        { status: 400 }
      );
    }

    // 2. Prepare atomic SQL statements for valid items
    const statements: { sql: string; params: (string | number | boolean | null)[] }[] = [];

    for (const v of validItems) {
      // 1. Insert/Replace into devices
      statements.push({
        sql: `INSERT OR REPLACE INTO devices (mcid, mac_address, normalized_mac, machine_model, location, status, installed_at, updated_at, notes, last_technician) VALUES (?, ?, ?, ?, ?, 'Installed', ?, ?, ?, ?)`,
        params: [
          v.mcid,
          v.formattedMac,
          v.normMac,
          v.machineModel,
          v.location,
          now,
          now,
          v.notes,
          technician,
        ],
      });

      // 2. Insert/Replace into mac_index
      statements.push({
        sql: `INSERT OR REPLACE INTO mac_index (normalized_mac, mcid, mac_address, status, updated_at) VALUES (?, ?, ?, 'active', ?)`,
        params: [v.normMac, v.mcid, v.formattedMac, now],
      });

      // 3. Insert into installation_history
      statements.push({
        sql: `INSERT INTO installation_history (id, event_type, mcid, mac_address, new_status, machine_model, location, notes, timestamp, performed_by) VALUES (?, 'INSTALL', ?, ?, 'Installed', ?, ?, ?, ?, ?)`,
        params: [
          v.historyId,
          v.mcid,
          v.formattedMac,
          v.machineModel,
          v.location,
          v.notes || 'Batch Import CSV',
          now,
          technician,
        ],
      });
    }

    // Execute batch
    await executeD1Batch(statements);

    return NextResponse.json({
      success: true,
      totalRequested: payload.items.length,
      importedCount: validItems.length,
      skippedCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Berhasil mengimpor ${validItems.length} perangkat baru ke database.${
        errors.length > 0 ? ` (${errors.length} baris dilewati karena kendala validasi)` : ''
      }`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
