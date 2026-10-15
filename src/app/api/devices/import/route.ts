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
    const updateExisting = Boolean(payload.updateExisting);
    const now = new Date().toISOString();

    // 1. Fetch current active devices and active MACs to validate uniqueness
    const [existingDevsRes, existingMacsRes] = await Promise.all([
      queryD1<{ mcid: string; status: string; mac_address: string; normalized_mac: string }>(
        "SELECT mcid, status, mac_address, normalized_mac FROM devices WHERE status != 'Removed'"
      ),
      queryD1<{ normalized_mac: string; mcid: string }>(
        "SELECT normalized_mac, mcid FROM mac_index WHERE status = 'active'"
      ),
    ]);

    const activeMcidMap = new Map<string, { status: string; mac_address: string; normalized_mac: string }>();
    existingDevsRes.results.forEach((d) => activeMcidMap.set(d.mcid.toUpperCase().trim(), d));

    const activeMacMap = new Map<string, string>(); // normalized_mac -> mcid
    existingMacsRes.results.forEach((m) => activeMacMap.set(m.normalized_mac.toUpperCase().trim(), m.mcid.toUpperCase().trim()));

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
      isUpdate: boolean;
      oldMac?: string;
      oldNormMac?: string;
      historyId: string;
    }

    const validItems: ValidItem[] = [];
    const errors: string[] = [];
    let updatedCount = 0;
    let newImportCount = 0;

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
      const existingDev = activeMcidMap.get(normMcid);
      let isUpdate = false;
      let oldMac: string | undefined;
      let oldNormMac: string | undefined;

      if (existingDev) {
        if (!updateExisting) {
          errors.push(
            `Baris ${rowNum}: Mesin MCID [${normMcid}] sudah terdaftar di sistem (Status: ${existingDev.status}). Aktifkan "Mode Pembaruan / Remap" jika ingin mengganti ke MAC Address baru.`
          );
          continue;
        }

        // Check if the NEW MAC is already used by a DIFFERENT machine
        const activeOwner = activeMacMap.get(normMac);
        if (activeOwner && activeOwner !== normMcid) {
          errors.push(
            `Baris ${rowNum}: MAC [${formattedMac}] sudah aktif digunakan oleh mesin MCID [${activeOwner}]. Satu MAC hanya boleh terpasang pada satu mesin aktif.`
          );
          continue;
        }

        isUpdate = true;
        oldMac = existingDev.mac_address;
        oldNormMac = existingDev.normalized_mac;
        updatedCount++;
      } else {
        // New machine check MAC collision
        const activeOwner = activeMacMap.get(normMac);
        if (activeOwner) {
          errors.push(
            `Baris ${rowNum}: MAC [${formattedMac}] sudah aktif digunakan oleh mesin MCID [${activeOwner}].`
          );
          continue;
        }
        newImportCount++;
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
        isUpdate,
        oldMac,
        oldNormMac,
        historyId: `hist-imp-${Date.now()}-${index}`,
      });
    }

    if (validItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          totalRequested: payload.items.length,
          importedCount: 0,
          updatedCount: 0,
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
      if (v.isUpdate) {
        // Update existing device
        statements.push({
          sql: `UPDATE devices 
                SET mac_address = ?, normalized_mac = ?, machine_model = ?, location = ?, status = 'Installed', installed_at = ?, updated_at = ?, notes = ?, last_technician = ? 
                WHERE mcid = ?`,
          params: [
            v.formattedMac,
            v.normMac,
            v.machineModel,
            v.location,
            now,
            now,
            v.notes,
            technician,
            v.mcid,
          ],
        });

        // If MAC changed, retire old MAC in index and insert/activate new MAC
        if (v.oldNormMac && v.oldNormMac !== v.normMac) {
          statements.push({
            sql: `UPDATE mac_index SET status = 'replaced', updated_at = ? WHERE normalized_mac = ?`,
            params: [now, v.oldNormMac],
          });
          statements.push({
            sql: `INSERT OR REPLACE INTO mac_index (normalized_mac, mcid, mac_address, status, updated_at) VALUES (?, ?, ?, 'active', ?)`,
            params: [v.normMac, v.mcid, v.formattedMac, now],
          });

          // History for REPLACE_DEVICE
          statements.push({
            sql: `INSERT INTO installation_history (id, event_type, mcid, mac_address, previous_mac_address, previous_status, new_status, machine_model, location, notes, timestamp, performed_by) VALUES (?, 'REPLACE_DEVICE', ?, ?, ?, 'Installed', 'Installed', ?, ?, ?, ?, ?)`,
            params: [
              v.historyId,
              v.mcid,
              v.formattedMac,
              v.oldMac || '',
              v.machineModel,
              v.location,
              `Remap modul IoT via Import CSV (Ganti MAC: ${v.oldMac} -> ${v.formattedMac}). ${v.notes || ''}`.trim(),
              now,
              technician,
            ],
          });
        } else {
          // Normal update
          statements.push({
            sql: `INSERT OR REPLACE INTO mac_index (normalized_mac, mcid, mac_address, status, updated_at) VALUES (?, ?, ?, 'active', ?)`,
            params: [v.normMac, v.mcid, v.formattedMac, now],
          });
          statements.push({
            sql: `INSERT INTO installation_history (id, event_type, mcid, mac_address, new_status, machine_model, location, notes, timestamp, performed_by) VALUES (?, 'STATUS_CHANGE', ?, ?, 'Installed', ?, ?, ?, ?, ?)`,
            params: [
              v.historyId,
              v.mcid,
              v.formattedMac,
              v.machineModel,
              v.location,
              `Pembaruan data perangkat via Import CSV: ${v.notes || 'Data mesin/lokasi diperbarui'}`.trim(),
              now,
              technician,
            ],
          });
        }
      } else {
        // 1. Insert new into devices
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

      // Auto-complete any pending installation plan for this MCID
      statements.push({
        sql: `UPDATE installation_plans 
              SET status = 'Installed', 
                  installed_mac = ?, 
                  installed_at = ?, 
                  installed_by = ?,
                  machine_model = CASE WHEN machine_model IS NULL OR machine_model = '' THEN ? ELSE machine_model END,
                  location = CASE WHEN location IS NULL OR location = '' THEN ? ELSE location END
              WHERE mcid = ? AND status = 'Planned'`,
        params: [v.formattedMac, now, technician, v.machineModel, v.location, v.mcid],
      });
    }

    // Execute batch atomically
    await executeD1Batch(statements);

    return NextResponse.json({
      success: true,
      totalRequested: payload.items.length,
      importedCount: newImportCount,
      updatedCount,
      skippedCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Berhasil memproses ${validItems.length} perangkat (${newImportCount} baru didaftarkan, ${updatedCount} berhasil di-remap/diperbarui).${
        errors.length > 0 ? ` (${errors.length} baris dilewati karena kendala validasi)` : ''
      }`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
