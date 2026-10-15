import { NextResponse } from 'next/server';
import { cachedQueryD1, queryD1, isCloudflareD1Configured } from '@/lib/d1';
import { normalizeMcid } from '@/lib/utils';
import { InstallationPlan, CreatePlanPayload } from '@/types';

interface PlanRow {
  id: string;
  mcid: string;
  machine_model: string | null;
  location: string | null;
  status: 'Planned' | 'Installed' | 'Cancelled';
  target_date: string | null;
  notes: string | null;
  installed_mac: string | null;
  installed_at: string | null;
  installed_by: string | null;
  created_at: string;
  created_by: string | null;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // SWR in-memory cache: 25s TTL, auto-purged on any plan/device mutation (saves up to 98% D1 rows read)
    const { results, fromCache } = await cachedQueryD1<PlanRow>(
      'plans_all',
      `SELECT id, mcid, machine_model, location, status, target_date, notes, installed_mac, installed_at, installed_by, created_at, created_by
       FROM installation_plans
       ORDER BY 
         CASE 
           WHEN status = 'Planned' THEN 1 
           WHEN status = 'Installed' THEN 2 
           ELSE 3 
         END,
         created_at DESC`,
      [],
      25,
      ['plans']
    );

    const formattedPlans: InstallationPlan[] = results.map((row) => ({
      id: row.id,
      mcid: row.mcid,
      machineModel: row.machine_model || undefined,
      location: row.location || undefined,
      status: row.status,
      targetDate: row.target_date || undefined,
      notes: row.notes || undefined,
      installedMac: row.installed_mac || undefined,
      installedAt: row.installed_at || undefined,
      installedBy: row.installed_by || undefined,
      createdAt: row.created_at,
      createdBy: row.created_by || undefined,
    }));

    return NextResponse.json({
      success: true,
      data: formattedPlans,
      cached: Boolean(fromCache),
      engine: isCloudflareD1Configured ? 'cloud-remote' : 'local-engine',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload: CreatePlanPayload = await request.json();

    const normMcid = normalizeMcid(payload.mcid);
    if (!normMcid) {
      return NextResponse.json(
        { success: false, error: 'Machine ID (MCID) wajib diisi.' },
        { status: 400 }
      );
    }

    // Check if machine already has an active IoT installed in devices
    const existingDevRes = await queryD1<{
      mcid: string;
      mac_address: string;
      machine_model: string;
      location: string;
      installed_at: string;
      last_technician: string | null;
    }>("SELECT mcid, mac_address, machine_model, location, installed_at, last_technician FROM devices WHERE mcid = ? AND status != 'Removed'", [
      normMcid,
    ]);

    const activeDev = existingDevRes.results[0];
    const now = new Date().toISOString();
    const id = `plan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    if (activeDev) {
      // Auto-set to 'Installed' because device already exists in registry
      const finalModel = payload.machineModel?.trim() || activeDev.machine_model || '';
      const finalLocation = payload.location?.trim() || activeDev.location || '';
      const technician = activeDev.last_technician || payload.technicianEmail || 'System Auto-Sync';
      const installedAt = activeDev.installed_at || now;

      await queryD1(
        `INSERT INTO installation_plans 
         (id, mcid, machine_model, location, status, target_date, notes, installed_mac, installed_at, installed_by, created_at, created_by)
         VALUES (?, ?, ?, ?, 'Installed', ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          normMcid,
          finalModel,
          finalLocation,
          payload.targetDate?.trim() || '',
          payload.notes?.trim() || 'Otomatis selesai: Perangkat sudah terpasang di registry.',
          activeDev.mac_address,
          installedAt,
          technician,
          now,
          payload.technicianEmail || '',
        ]
      );

      const newPlan: InstallationPlan = {
        id,
        mcid: normMcid,
        machineModel: finalModel || undefined,
        location: finalLocation || undefined,
        status: 'Installed',
        targetDate: payload.targetDate?.trim() || undefined,
        notes: payload.notes?.trim() || undefined,
        installedMac: activeDev.mac_address,
        installedAt,
        installedBy: technician,
        createdAt: now,
        createdBy: payload.technicianEmail || undefined,
      };

      return NextResponse.json({
        success: true,
        data: newPlan,
        message: `Rencana pemasangan untuk mesin [${normMcid}] berhasil ditambahkan dan otomatis ditandai Selesai (Installed) karena modul IoT [${activeDev.mac_address}] sudah terpasang aktif.`,
      });
    }

    // Default: Insert as 'Planned'
    await queryD1(
      `INSERT INTO installation_plans (id, mcid, machine_model, location, status, target_date, notes, created_at, created_by)
       VALUES (?, ?, ?, ?, 'Planned', ?, ?, ?, ?)`,
      [
        id,
        normMcid,
        payload.machineModel?.trim() || '',
        payload.location?.trim() || '',
        payload.targetDate?.trim() || '',
        payload.notes?.trim() || '',
        now,
        payload.technicianEmail || '',
      ]
    );

    const newPlan: InstallationPlan = {
      id,
      mcid: normMcid,
      machineModel: payload.machineModel?.trim() || undefined,
      location: payload.location?.trim() || undefined,
      status: 'Planned',
      targetDate: payload.targetDate?.trim() || undefined,
      notes: payload.notes?.trim() || undefined,
      createdAt: now,
      createdBy: payload.technicianEmail || undefined,
    };

    return NextResponse.json({
      success: true,
      data: newPlan,
      message: `Rencana pemasangan untuk mesin [${normMcid}] berhasil ditambahkan.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

