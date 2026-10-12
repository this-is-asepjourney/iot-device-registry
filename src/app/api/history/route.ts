import { NextResponse } from 'next/server';
import { queryD1 } from '@/lib/d1';
import { InstallationHistory, DeviceStatus, HistoryEventType } from '@/types';

interface HistoryRow {
  id: string;
  event_type: HistoryEventType;
  mcid: string;
  mac_address: string;
  previous_mac_address: string | null;
  previous_status: DeviceStatus | null;
  new_status: DeviceStatus;
  machine_model: string;
  location: string;
  notes: string | null;
  timestamp: string;
  performed_by: string;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { results } = await queryD1<HistoryRow>(`
      SELECT id, event_type, mcid, mac_address, previous_mac_address, previous_status, new_status, machine_model, location, notes, timestamp, performed_by
      FROM installation_history
      ORDER BY timestamp DESC
    `);

    const formatted: InstallationHistory[] = results.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      mcid: r.mcid,
      macAddress: r.mac_address,
      previousMacAddress: r.previous_mac_address || undefined,
      previousStatus: r.previous_status || undefined,
      newStatus: r.new_status,
      machineModel: r.machine_model,
      location: r.location,
      notes: r.notes || undefined,
      timestamp: r.timestamp,
      performedBy: r.performed_by,
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
