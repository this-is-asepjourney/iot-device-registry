import { NextResponse } from 'next/server';
import { cachedQueryD1, isCloudflareD1Configured } from '@/lib/d1';
import { Device } from '@/types';

interface DeviceRow {
  mcid: string;
  mac_address: string;
  normalized_mac: string;
  machine_model: string;
  location: string;
  status: 'Installed' | 'Maintenance' | 'Removed';
  installed_at: string;
  updated_at: string;
  notes: string | null;
  last_technician: string | null;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // SWR in-memory cache: 25s TTL, auto-purged on any device mutation (saves up to 98% D1 rows read)
    const { results, fromCache } = await cachedQueryD1<DeviceRow>(
      'devices_all',
      `SELECT mcid, mac_address, normalized_mac, machine_model, location, status, installed_at, updated_at, notes, last_technician
       FROM devices
       ORDER BY updated_at DESC`,
      [],
      25,
      ['devices']
    );

    const formattedDevices: Device[] = results.map((row) => ({
      mcid: row.mcid,
      macAddress: row.mac_address,
      normalizedMac: row.normalized_mac,
      machineModel: row.machine_model,
      location: row.location,
      status: row.status,
      installedAt: row.installed_at,
      updatedAt: row.updated_at,
      notes: row.notes || undefined,
      lastTechnician: row.last_technician || undefined,
    }));

    return NextResponse.json({
      success: true,
      data: formattedDevices,
      cached: Boolean(fromCache),
      engine: isCloudflareD1Configured ? 'cloud-remote' : 'local-engine',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
