import { NextResponse } from 'next/server';
import { queryD1, isCloudflareD1Configured } from '@/lib/d1';
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

export async function GET() {
  try {
    const { results } = await queryD1<DeviceRow>(`
      SELECT mcid, mac_address, normalized_mac, machine_model, location, status, installed_at, updated_at, notes, last_technician
      FROM devices
      ORDER BY updated_at DESC
    `);

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
      engine: isCloudflareD1Configured ? 'cloudflare-d1-remote' : 'local-d1-sqlite',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
