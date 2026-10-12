import { NextResponse } from 'next/server';
import { queryD1, executeD1Batch } from '@/lib/d1';
import { normalizeMcid } from '@/lib/utils';
import { UpdateStatusPayload } from '@/types';

export async function POST(request: Request) {
  try {
    const payload: UpdateStatusPayload = await request.json();

    const normMcid = normalizeMcid(payload.mcid);
    if (!normMcid) {
      return NextResponse.json({ success: false, error: 'MCID tidak boleh kosong.' }, { status: 400 });
    }

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
    const oldStatus = currentDev.status;

    if (oldStatus === payload.newStatus) {
      return NextResponse.json({ success: true, message: 'Status tidak berubah.' });
    }

    const now = new Date().toISOString();
    const historyId = `hist-${Date.now()}`;

    if (payload.newStatus === 'Removed') {
      // 1. When removed: release MAC from mac_index so MAC can be used by another machine
      await executeD1Batch([
        {
          sql: 'DELETE FROM mac_index WHERE normalized_mac = ?',
          params: [currentDev.normalized_mac],
        },
        {
          sql: 'UPDATE devices SET status = ?, updated_at = ?, notes = ?, last_technician = ? WHERE mcid = ?',
          params: ['Removed', now, payload.notes?.trim() || currentDev.notes || '', payload.technicianEmail || '', normMcid],
        },
        {
          sql: `INSERT INTO installation_history (id, event_type, mcid, mac_address, previous_status, new_status, machine_model, location, notes, timestamp, performed_by) VALUES (?, 'REMOVE', ?, ?, ?, 'Removed', ?, ?, ?, ?, ?)`,
          params: [
            historyId,
            normMcid,
            currentDev.mac_address,
            oldStatus,
            currentDev.machine_model,
            currentDev.location,
            payload.notes?.trim() || `Perangkat dilepas dari mesin (MAC ${currentDev.mac_address} telah dilepaskan dari indeks).`,
            now,
            payload.technicianEmail || '',
          ],
        },
      ]);
    } else if (payload.newStatus === 'Installed' && oldStatus === 'Removed') {
      // 2. Returning to Installed from Removed: re-claim MAC
      const macCheck = await queryD1<{ mcid: string }>(
        'SELECT mcid FROM mac_index WHERE normalized_mac = ?',
        [currentDev.normalized_mac]
      );

      if (macCheck.results.length > 0) {
        const owner = macCheck.results[0].mcid;
        return NextResponse.json(
          {
            success: false,
            error: `MAC Address [${currentDev.mac_address}] telah digunakan oleh MCID: [${owner}]. Gunakan fitur "Ganti Perangkat" untuk memasang modul MAC baru.`,
          },
          { status: 409 }
        );
      }

      await executeD1Batch([
        {
          sql: `INSERT OR REPLACE INTO mac_index (normalized_mac, mcid, mac_address, status, updated_at) VALUES (?, ?, ?, 'active', ?)`,
          params: [currentDev.normalized_mac, normMcid, currentDev.mac_address, now],
        },
        {
          sql: 'UPDATE devices SET status = ?, updated_at = ?, notes = ?, last_technician = ? WHERE mcid = ?',
          params: ['Installed', now, payload.notes?.trim() || currentDev.notes || '', payload.technicianEmail || '', normMcid],
        },
        {
          sql: `INSERT INTO installation_history (id, event_type, mcid, mac_address, previous_status, new_status, machine_model, location, notes, timestamp, performed_by) VALUES (?, 'STATUS_CHANGE', ?, ?, ?, 'Installed', ?, ?, ?, ?, ?)`,
          params: [
            historyId,
            normMcid,
            currentDev.mac_address,
            oldStatus,
            currentDev.machine_model,
            currentDev.location,
            payload.notes?.trim() || 'Status dikembalikan ke Installed.',
            now,
            payload.technicianEmail || '',
          ],
        },
      ]);
    } else {
      // 3. Regular status change (e.g. Installed <-> Maintenance)
      await executeD1Batch([
        {
          sql: 'UPDATE devices SET status = ?, updated_at = ?, notes = ?, last_technician = ? WHERE mcid = ?',
          params: [payload.newStatus, now, payload.notes?.trim() || currentDev.notes || '', payload.technicianEmail || '', normMcid],
        },
        {
          sql: `INSERT INTO installation_history (id, event_type, mcid, mac_address, previous_status, new_status, machine_model, location, notes, timestamp, performed_by) VALUES (?, 'STATUS_CHANGE', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            historyId,
            normMcid,
            currentDev.mac_address,
            oldStatus,
            payload.newStatus,
            currentDev.machine_model,
            currentDev.location,
            payload.notes?.trim() || `Status mesin diubah menjadi ${payload.newStatus}.`,
            now,
            payload.technicianEmail || '',
          ],
        },
      ]);
    }

    return NextResponse.json({
      success: true,
      message: `Status mesin [${normMcid}] berhasil diubah menjadi ${payload.newStatus}.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
