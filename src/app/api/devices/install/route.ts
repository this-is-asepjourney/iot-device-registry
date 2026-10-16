import { NextResponse } from 'next/server';
import { queryD1, executeD1Batch } from '@/lib/d1';
import { normalizeMcid, normalizeMacAddress, formatMacAddress, isValidMacAddress } from '@/lib/utils';
import { InstallDevicePayload } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload: InstallDevicePayload = await request.json();

    const normMcid = normalizeMcid(payload.mcid);
    const normMac = normalizeMacAddress(payload.macAddress);
    const formattedMac = formatMacAddress(payload.macAddress);

    if (!normMcid) {
      return NextResponse.json({ success: false, error: 'MCID tidak boleh kosong.' }, { status: 400 });
    }

    if (!isValidMacAddress(payload.macAddress) || normMac.length !== 12) {
      return NextResponse.json(
        { success: false, error: 'Format MAC Address harus valid 12 digit heksadesimal.' },
        { status: 400 }
      );
    }

    if (!payload.machineModel?.trim() || !payload.location?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Model mesin dan lokasi pabrik wajib diisi.' },
        { status: 400 }
      );
    }

    // 1. Check if MCID already has an active device
    const existingDev = await queryD1<{ mcid: string; status: string; mac_address: string }>(
      'SELECT mcid, status, mac_address FROM devices WHERE mcid = ?',
      [normMcid]
    );

    if (existingDev.results.length > 0) {
      const dev = existingDev.results[0];
      if (dev.status === 'Installed' || dev.status === 'Maintenance') {
        return NextResponse.json(
          {
            success: false,
            error: `Mesin (MCID: ${normMcid}) sudah memiliki perangkat terdaftar (Status: ${dev.status}, MAC: ${dev.mac_address}). Gunakan fitur "Ganti Perangkat" jika ingin mengganti modul.`,
          },
          { status: 409 }
        );
      }
    }

    // 2. Check if MAC address is already registered in mac_index
    const existingMac = await queryD1<{ mcid: string; mac_address: string }>(
      'SELECT mcid, mac_address FROM mac_index WHERE normalized_mac = ?',
      [normMac]
    );

    if (existingMac.results.length > 0) {
      const owner = existingMac.results[0].mcid;
      return NextResponse.json(
        {
          success: false,
          error: `MAC Address [${formattedMac}] sudah terhubung aktif ke mesin MCID: [${owner}]. Satu MAC Address hanya boleh terhubung ke satu mesin aktif.`,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const installedAt =
      payload.installedAt && !isNaN(new Date(payload.installedAt).getTime())
        ? new Date(payload.installedAt).toISOString()
        : now;
    const historyId = `hist-${Date.now()}`;

    // 3. Execute atomic transaction in Cloudflare D1 / SQLite:
    // Insert into devices first (parent), then mac_index (child referencing devices.mcid), then history
    await executeD1Batch([
      {
        sql: `INSERT OR REPLACE INTO devices (mcid, mac_address, normalized_mac, machine_model, location, status, installed_at, updated_at, notes, last_technician) VALUES (?, ?, ?, ?, ?, 'Installed', ?, ?, ?, ?)`,
        params: [
          normMcid,
          formattedMac,
          normMac,
          payload.machineModel.trim(),
          payload.location.trim(),
          installedAt,
          now,
          payload.notes?.trim() || '',
          payload.technicianEmail || '',
        ],
      },
      {
        sql: `INSERT OR REPLACE INTO mac_index (normalized_mac, mcid, mac_address, status, updated_at) VALUES (?, ?, ?, 'active', ?)`,
        params: [normMac, normMcid, formattedMac, now],
      },
      {
        sql: `INSERT INTO installation_history (id, event_type, mcid, mac_address, new_status, machine_model, location, notes, timestamp, performed_by) VALUES (?, 'INSTALL', ?, ?, 'Installed', ?, ?, ?, ?, ?)`,
        params: [
          historyId,
          normMcid,
          formattedMac,
          payload.machineModel.trim(),
          payload.location.trim(),
          payload.notes?.trim() || 'Pemasangan awal perangkat IoT pada mesin.',
          installedAt,
          payload.technicianEmail || '',
        ],
      },
      {
        sql: `UPDATE installation_plans SET status = 'Installed', installed_mac = ?, installed_at = ?, installed_by = ? WHERE mcid = ? AND status = 'Planned'`,
        params: [formattedMac, installedAt, payload.technicianEmail || '', normMcid],
      },
    ]);

    return NextResponse.json({
      success: true,
      message: `Perangkat berhasil diinstal pada MCID [${normMcid}] dengan MAC [${formattedMac}].`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
