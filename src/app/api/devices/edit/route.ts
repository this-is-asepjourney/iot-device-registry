import { NextResponse } from 'next/server';
import { queryD1, executeD1Batch } from '@/lib/d1';
import { normalizeMcid, normalizeMacAddress, formatMacAddress, isValidMacAddress } from '@/lib/utils';
import { EditDevicePayload } from '@/types';

export const dynamic = 'force-dynamic';

interface DeviceCheckRow {
  mcid: string;
  mac_address: string;
  normalized_mac: string;
  status: 'Installed' | 'Maintenance' | 'Removed';
  machine_model: string;
  location: string;
  installed_at: string;
}

interface MacCheckRow {
  mcid: string;
  mac_address: string;
}

export async function POST(request: Request) {
  try {
    const payload: EditDevicePayload = await request.json();

    const normMcid = normalizeMcid(payload.mcid);
    const normMac = normalizeMacAddress(payload.macAddress);
    const formattedMac = formatMacAddress(payload.macAddress);

    if (!normMcid) {
      return NextResponse.json({ success: false, error: 'MCID tidak boleh kosong.' }, { status: 400 });
    }

    if (!payload.machineModel?.trim()) {
      return NextResponse.json({ success: false, error: 'Nama/model mesin tidak boleh kosong.' }, { status: 400 });
    }

    if (!isValidMacAddress(normMac)) {
      return NextResponse.json(
        { success: false, error: 'Format MAC Address tidak valid. Harus 12 digit hexadecimal (XX:XX:XX:XX:XX:XX).' },
        { status: 400 }
      );
    }

    // 1. Fetch current device record
    const { results: currentDevices } = await queryD1<DeviceCheckRow>(
      'SELECT mcid, mac_address, normalized_mac, status, machine_model, location, installed_at FROM devices WHERE mcid = ?',
      [normMcid]
    );

    if (currentDevices.length === 0) {
      return NextResponse.json(
        { success: false, error: `Mesin dengan MCID "${normMcid}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    const currentDev = currentDevices[0];
    const macChanged = currentDev.normalized_mac !== normMac;
    const isNowRemoved = payload.status === 'Removed';
    const wasRemoved = currentDev.status === 'Removed';

    const targetInstalledAt =
      payload.installedAt && !isNaN(new Date(payload.installedAt).getTime())
        ? new Date(payload.installedAt).toISOString()
        : currentDev.installed_at;
    const installedAtChanged = targetInstalledAt !== currentDev.installed_at;

    // 2. If MAC changed, check if new MAC is already taken by another machine
    if (macChanged && !isNowRemoved) {
      const { results: macConflict } = await queryD1<MacCheckRow>(
        'SELECT mcid, mac_address FROM mac_index WHERE normalized_mac = ?',
        [normMac]
      );

      if (macConflict.length > 0 && macConflict[0].mcid !== normMcid) {
        return NextResponse.json(
          {
            success: false,
            error: `MAC Address ${formattedMac} sudah aktif terhubung ke mesin lain (${macConflict[0].mcid}). Aturan 1-to-1 melarang penggunaan MAC yang sama.`,
          },
          { status: 409 }
        );
      }
    }

    const now = new Date().toISOString();
    const batchStatements: { sql: string; params: (string | number | boolean | null)[] }[] = [];

    // 3. Update devices table
    batchStatements.push({
      sql: `UPDATE devices 
            SET mac_address = ?, normalized_mac = ?, machine_model = ?, location = ?, status = ?, installed_at = ?, notes = ?, updated_at = ?, last_technician = ?
            WHERE mcid = ?`,
      params: [
        formattedMac,
        normMac,
        payload.machineModel.trim(),
        payload.location.trim(),
        payload.status,
        targetInstalledAt,
        payload.notes?.trim() || '',
        now,
        payload.technicianEmail || 'Admin',
        normMcid,
      ],
    });

    // Also update installed_at in installation_plans if plan exists
    if (installedAtChanged) {
      batchStatements.push({
        sql: `UPDATE installation_plans SET installed_at = ? WHERE mcid = ? AND status = 'Installed'`,
        params: [targetInstalledAt, normMcid],
      });
    }

    // 4. Update mac_index table based on changes
    if (isNowRemoved) {
      // Remove any MAC claims for this device
      batchStatements.push({
        sql: 'DELETE FROM mac_index WHERE mcid = ? OR normalized_mac = ?',
        params: [normMcid, normMac],
      });
    } else if (macChanged || wasRemoved) {
      // Delete old MAC entry for this device
      batchStatements.push({
        sql: 'DELETE FROM mac_index WHERE mcid = ? OR normalized_mac = ?',
        params: [normMcid, normMac],
      });
      // Claim the new MAC
      batchStatements.push({
        sql: `INSERT OR REPLACE INTO mac_index (normalized_mac, mcid, mac_address, status, updated_at)
              VALUES (?, ?, ?, 'active', ?)`,
        params: [normMac, normMcid, formattedMac, now],
      });
    }

    // 5. Append audit log in installation_history
    const historyId = `hist-edit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const eventType = macChanged ? 'REPLACE_DEVICE' : 'STATUS_CHANGE';
    const auditNote = macChanged
      ? `[Koreksi / Edit Data] Ganti MAC ${currentDev.mac_address} -> ${formattedMac}.${installedAtChanged ? ` Waktu pasang diubah: ${targetInstalledAt}.` : ''} ${payload.notes || ''}`.trim()
      : `[Koreksi / Edit Data] Model: ${payload.machineModel}, Lokasi: ${payload.location}.${installedAtChanged ? ` Waktu pasang diubah: ${targetInstalledAt}.` : ''} ${payload.notes || ''}`.trim();

    batchStatements.push({
      sql: `INSERT INTO installation_history 
            (id, event_type, mcid, mac_address, previous_mac_address, previous_status, new_status, machine_model, location, notes, timestamp, performed_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        historyId,
        eventType,
        normMcid,
        formattedMac,
        macChanged ? currentDev.mac_address : null,
        currentDev.status,
        payload.status,
        payload.machineModel.trim(),
        payload.location.trim(),
        auditNote,
        now,
        payload.technicianEmail || 'Admin',
      ],
    });

    await executeD1Batch(batchStatements);

    return NextResponse.json({
      success: true,
      message: `Perangkat ${normMcid} berhasil diperbarui.`,
    });
  } catch (error: unknown) {
    console.error('API /api/devices/edit error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
