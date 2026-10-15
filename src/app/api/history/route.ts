import { NextResponse } from 'next/server';
import { cachedQueryD1 } from '@/lib/d1';
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get('limit') || '200', 10);
    const limit = Math.min(Math.max(isNaN(limitParam) ? 200 : limitParam, 10), 500);
    const mcidFilter = searchParams.get('mcid')?.trim().toUpperCase();

    const cacheKey = `history_${mcidFilter || 'all'}_${limit}`;
    const sql = mcidFilter
      ? `SELECT id, event_type, mcid, mac_address, previous_mac_address, previous_status, new_status, machine_model, location, notes, timestamp, performed_by
         FROM installation_history
         WHERE UPPER(TRIM(mcid)) = ?
         ORDER BY timestamp DESC
         LIMIT ?`
      : `SELECT id, event_type, mcid, mac_address, previous_mac_address, previous_status, new_status, machine_model, location, notes, timestamp, performed_by
         FROM installation_history
         ORDER BY timestamp DESC
         LIMIT ?`;

    const params = mcidFilter ? [mcidFilter, limit] : [limit];

    // SWR Cache: 30s TTL, auto-purged on any write
    const { results, fromCache } = await cachedQueryD1<HistoryRow>(
      cacheKey,
      sql,
      params,
      30,
      ['history']
    );

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

    return NextResponse.json({
      success: true,
      data: formatted,
      cached: Boolean(fromCache),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
