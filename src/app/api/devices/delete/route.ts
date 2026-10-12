import { NextResponse } from 'next/server';
import { queryD1, executeD1Batch } from '@/lib/d1';
import { normalizeMcid } from '@/lib/utils';
import { DeleteDevicePayload } from '@/types';

export const dynamic = 'force-dynamic';

interface DeviceCheckRow {
  mcid: string;
  mac_address: string;
  machine_model: string;
  location: string;
  status: 'Installed' | 'Maintenance' | 'Removed';
}

export async function POST(request: Request) {
  try {
    const payload: DeleteDevicePayload = await request.json();
    const normMcid = normalizeMcid(payload.mcid);

    if (!normMcid) {
      return NextResponse.json({ success: false, error: 'MCID tidak boleh kosong.' }, { status: 400 });
    }

    const { results: devices } = await queryD1<DeviceCheckRow>(
      'SELECT mcid, mac_address, machine_model, location, status FROM devices WHERE mcid = ?',
      [normMcid]
    );

    if (devices.length === 0) {
      return NextResponse.json(
        { success: false, error: `Mesin ${normMcid} tidak ditemukan.` },
        { status: 404 }
      );
    }

    const dev = devices[0];
    const now = new Date().toISOString();
    const historyId = `hist-del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Delete device, delete mac_index, and log REMOVE event
    const statements = [
      {
        sql: 'DELETE FROM mac_index WHERE mcid = ?',
        params: [normMcid],
      },
      {
        sql: 'DELETE FROM devices WHERE mcid = ?',
        params: [normMcid],
      },
      {
        sql: `INSERT INTO installation_history 
              (id, event_type, mcid, mac_address, previous_status, new_status, machine_model, location, notes, timestamp, performed_by)
              VALUES (?, 'REMOVE', ?, ?, ?, 'Removed', ?, ?, ?, ?, ?)`,
        params: [
          historyId,
          normMcid,
          dev.mac_address,
          dev.status,
          dev.machine_model,
          dev.location,
          `[Penghapusan Data Device] ${payload.notes || 'Dihapus oleh teknisi/operator.'}`.trim(),
          now,
          payload.technicianEmail || 'Admin',
        ],
      },
    ];

    await executeD1Batch(statements);

    return NextResponse.json({
      success: true,
      message: `Perangkat ${normMcid} berhasil dihapus dari sistem.`,
    });
  } catch (error: unknown) {
    console.error('API /api/devices/delete error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
