import { NextResponse } from 'next/server';
import { queryD1, executeD1Batch } from '@/lib/d1';
import { normalizeMcid, normalizeMacAddress, formatMacAddress, isValidMacAddress } from '@/lib/utils';
import { ReplaceDevicePayload } from '@/types';

export async function POST(request: Request) {
  try {
    const payload: ReplaceDevicePayload = await request.json();

    const normMcid = normalizeMcid(payload.mcid);
    const normNewMac = normalizeMacAddress(payload.newMacAddress);
    const formattedNewMac = formatMacAddress(payload.newMacAddress);

    if (!normMcid) {
      return NextResponse.json({ success: false, error: 'MCID tidak boleh kosong.' }, { status: 400 });
    }

    if (!isValidMacAddress(payload.newMacAddress) || normNewMac.length !== 12) {
      return NextResponse.json(
        { success: false, error: 'Format MAC Address baru harus valid 12 digit heksadesimal.' },
        { status: 400 }
      );
    }

    // 1. Fetch current machine
    const devQuery = await queryD1<{
      mcid: string;
      mac_address: string;
      normalized_mac: string;
      machine_model: string;
      location: string;
      status: string;
      notes: string | null;
    }>('SELECT mcid, mac_address, normalized_mac, machine_model, location, status, notes FROM devices WHERE mcid = ?', [
      normMcid,
    ]);

    if (devQuery.results.length === 0) {
      return NextResponse.json({ success: false, error: `Mesin dengan MCID [${normMcid}] tidak ditemukan.` }, { status: 404 });
    }

    const currentDev = devQuery.results[0];
    const oldNormMac = currentDev.normalized_mac;
    const oldFormattedMac = currentDev.mac_address;

    if (oldNormMac === normNewMac) {
      return NextResponse.json(
        { success: false, error: `MAC Address baru sama persis dengan MAC Address yang sedang terpasang (${oldFormattedMac}).` },
        { status: 400 }
      );
    }

    // 2. Check if new MAC is already used by another machine
    const macCheck = await queryD1<{ mcid: string }>(
      'SELECT mcid FROM mac_index WHERE normalized_mac = ?',
      [normNewMac]
    );

    if (macCheck.results.length > 0) {
      const owner = macCheck.results[0].mcid;
      return NextResponse.json(
        {
          success: false,
          error: `MAC Address baru [${formattedNewMac}] sudah digunakan oleh MCID: [${owner}]. Pilih modul yang belum aktif.`,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const historyId = `hist-${Date.now()}`;

    // 3. Atomic D1 transaction: release old MAC + claim new MAC + update device + log history
    await executeD1Batch([
      {
        sql: `DELETE FROM mac_index WHERE normalized_mac = ?`,
        params: [oldNormMac],
      },
      {
        sql: `INSERT OR REPLACE INTO mac_index (normalized_mac, mcid, mac_address, status, updated_at) VALUES (?, ?, ?, 'active', ?)`,
        params: [normNewMac, normMcid, formattedNewMac, now],
      },
      {
        sql: `UPDATE devices SET mac_address = ?, normalized_mac = ?, status = 'Installed', updated_at = ?, notes = ?, last_technician = ? WHERE mcid = ?`,
        params: [
          formattedNewMac,
          normNewMac,
          now,
          payload.notes?.trim() || currentDev.notes || '',
          payload.technicianEmail || '',
          normMcid,
        ],
      },
      {
        sql: `INSERT INTO installation_history (id, event_type, mcid, mac_address, previous_mac_address, previous_status, new_status, machine_model, location, notes, timestamp, performed_by) VALUES (?, 'REPLACE_DEVICE', ?, ?, ?, ?, 'Installed', ?, ?, ?, ?, ?)`,
        params: [
          historyId,
          normMcid,
          formattedNewMac,
          oldFormattedMac,
          currentDev.status,
          currentDev.machine_model,
          currentDev.location,
          payload.notes?.trim() || `Penggantian IoT device dari ${oldFormattedMac} ke ${formattedNewMac}.`,
          now,
          payload.technicianEmail || '',
        ],
      },
    ]);

    return NextResponse.json({
      success: true,
      message: `Perangkat IoT pada MCID [${normMcid}] berhasil diganti dari ${oldFormattedMac} ke ${formattedNewMac}.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
