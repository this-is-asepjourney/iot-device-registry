import { NextResponse } from 'next/server';
import { queryD1, executeD1Batch, isCloudflareD1Configured } from '@/lib/d1';

export const dynamic = 'force-dynamic';

export async function GET() {
  return POST();
}

interface PlannedRow {
  id: string;
  mcid: string;
  machine_model: string | null;
  location: string | null;
}

interface DeviceRow {
  mcid: string;
  mac_address: string;
  machine_model: string;
  location: string;
  installed_at: string;
  last_technician: string | null;
}

export async function POST() {
  try {
    // 1. Fetch pending plans
    const pendingPlansRes = await queryD1<PlannedRow>(
      "SELECT id, mcid, machine_model, location FROM installation_plans WHERE status = 'Planned'"
    );

    if (pendingPlansRes.results.length === 0) {
      return NextResponse.json({
        success: true,
        totalPlanned: 0,
        syncedCount: 0,
        message: 'Tidak ada rencana pemasangan dengan status menunggu (Planned). Semua rencana sudah tersinkron.',
      });
    }

    // 2. Fetch active installed devices
    const activeDevicesRes = await queryD1<DeviceRow>(
      "SELECT mcid, mac_address, machine_model, location, installed_at, last_technician FROM devices WHERE status != 'Removed'"
    );

    const deviceMap = new Map<string, DeviceRow>();
    activeDevicesRes.results.forEach((d) => {
      deviceMap.set(d.mcid.toUpperCase().trim(), d);
    });

    // 3. Match pending plans with installed devices
    const statements: { sql: string; params: (string | number | boolean | null)[] }[] = [];
    let syncedCount = 0;

    for (const plan of pendingPlansRes.results) {
      const normMcid = plan.mcid.toUpperCase().trim();
      const dev = deviceMap.get(normMcid);

      if (dev) {
        syncedCount++;
        const finalModel = plan.machine_model || dev.machine_model || '';
        const finalLocation = plan.location || dev.location || '';
        const technician = dev.last_technician || 'System Auto-Sync';
        const installedAt = dev.installed_at || new Date().toISOString();

        statements.push({
          sql: `UPDATE installation_plans
                SET status = 'Installed',
                    installed_mac = ?,
                    installed_at = ?,
                    installed_by = ?,
                    machine_model = CASE WHEN machine_model IS NULL OR machine_model = '' THEN ? ELSE machine_model END,
                    location = CASE WHEN location IS NULL OR location = '' THEN ? ELSE location END
                WHERE id = ?`,
          params: [dev.mac_address, installedAt, technician, finalModel, finalLocation, plan.id],
        });
      }
    }

    if (statements.length > 0) {
      await executeD1Batch(statements);
    }

    return NextResponse.json({
      success: true,
      totalPlanned: pendingPlansRes.results.length,
      syncedCount,
      message:
        syncedCount > 0
          ? `Sinkronisasi berhasil: ${syncedCount} rencana otomatis ditandai Selesai (Installed) karena perangkat IoT sudah terpasang di mesin.`
          : 'Semua rencana berstatus Planned saat ini belum memiliki modul IoT yang terpasang di daftar perangkat.',
      engine: isCloudflareD1Configured ? 'cloud-remote' : 'local-engine',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
