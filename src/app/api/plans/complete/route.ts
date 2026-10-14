import { NextResponse } from 'next/server';
import { queryD1, executeD1Batch } from '@/lib/d1';
import {
  normalizeMcid,
  normalizeMacAddress,
  formatMacAddress,
  isValidMacAddress,
} from '@/lib/utils';
import { CompletePlanPayload } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload: CompletePlanPayload = await request.json();

    const normMcid = normalizeMcid(payload.mcid);
    const normMac = normalizeMacAddress(payload.macAddress);
    const formattedMac = formatMacAddress(payload.macAddress);

    if (!normMcid) {
      return NextResponse.json(
        { success: false, error: 'MCID tidak boleh kosong.' },
        { status: 400 }
      );
    }

    if (!isValidMacAddress(payload.macAddress) || normMac.length !== 12) {
      return NextResponse.json(
        {
          success: false,
          error: 'Format MAC Address harus valid 12 digit heksadesimal (contoh: AA:BB:CC:11:22:33).',
        },
        { status: 400 }
      );
    }

    // 1. Enforce 1-to-1 MAC uniqueness across all active machines
    const existingMac = await queryD1<{ mcid: string; mac_address: string }>(
      'SELECT mcid, mac_address FROM mac_index WHERE normalized_mac = ?',
      [normMac]
    );

    if (existingMac.results.length > 0) {
      const owner = existingMac.results[0].mcid;
      if (owner.toUpperCase() !== normMcid.toUpperCase()) {
        return NextResponse.json(
          {
            success: false,
            error: `MAC Address [${formattedMac}] sudah aktif terhubung ke mesin [${owner}]. Aturan 1:1 melarang MAC yang sama dipakai di lebih dari 1 mesin.`,
          },
          { status: 409 }
        );
      }
    }

    // 2. Fetch existing plan details if available to backfill machineModel/location
    const planRes = await queryD1<{
      id: string;
      machine_model: string | null;
      location: string | null;
      notes: string | null;
    }>('SELECT id, machine_model, location, notes FROM installation_plans WHERE id = ? OR mcid = ? LIMIT 1', [
      payload.planId,
      normMcid,
    ]);

    const planData = planRes.results[0];
    const finalModel =
      payload.machineModel?.trim() || planData?.machine_model || `Mesin ${normMcid}`;
    const finalLocation = payload.location?.trim() || planData?.location || 'Area Produksi';
    const finalNotes =
      payload.notes?.trim() ||
      (planData?.notes ? `Pemasangan IoT selesai. Catatan: ${planData.notes}` : 'Instalasi selesai.');

    const now = new Date().toISOString();
    const historyId = `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const technician = payload.technicianEmail || 'technician@factory.local';

    // 3. Atomic transaction:
    // a. Insert/Update devices table
    // b. Update mac_index table (ensures 1:1 lock)
    // c. Add installation_history audit record
    // d. Update installation_plans record to 'Installed'
    await executeD1Batch([
      {
        sql: `INSERT OR REPLACE INTO devices 
              (mcid, mac_address, normalized_mac, machine_model, location, status, installed_at, updated_at, notes, last_technician) 
              VALUES (?, ?, ?, ?, ?, 'Installed', ?, ?, ?, ?)`,
        params: [
          normMcid,
          formattedMac,
          normMac,
          finalModel,
          finalLocation,
          now,
          now,
          finalNotes,
          technician,
        ],
      },
      {
        sql: `INSERT OR REPLACE INTO mac_index 
              (normalized_mac, mcid, mac_address, status, updated_at) 
              VALUES (?, ?, ?, 'active', ?)`,
        params: [normMac, normMcid, formattedMac, now],
      },
      {
        sql: `INSERT INTO installation_history 
              (id, event_type, mcid, mac_address, new_status, machine_model, location, notes, timestamp, performed_by) 
              VALUES (?, 'INSTALL', ?, ?, 'Installed', ?, ?, ?, ?, ?)`,
        params: [
          historyId,
          normMcid,
          formattedMac,
          finalModel,
          finalLocation,
          `Instalasi dari Rencana Pemasangan: ${finalNotes}`,
          now,
          technician,
        ],
      },
      {
        sql: `UPDATE installation_plans 
              SET status = 'Installed', 
                  installed_mac = ?, 
                  installed_at = ?, 
                  installed_by = ?,
                  machine_model = CASE WHEN machine_model IS NULL OR machine_model = '' THEN ? ELSE machine_model END,
                  location = CASE WHEN location IS NULL OR location = '' THEN ? ELSE location END
              WHERE id = ? OR (mcid = ? AND status = 'Planned')`,
        params: [formattedMac, now, technician, finalModel, finalLocation, payload.planId, normMcid],
      },
    ]);

    return NextResponse.json({
      success: true,
      message: `Modul IoT [${formattedMac}] berhasil dipetakan & dipasang pada mesin [${normMcid}]. Status rencana kini Selesai (Installed).`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
