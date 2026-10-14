import { NextResponse } from 'next/server';
import { queryD1 } from '@/lib/d1';
import { normalizeMcid } from '@/lib/utils';
import { EditPlanPayload } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload: EditPlanPayload = await request.json();

    if (!payload.id) {
      return NextResponse.json(
        { success: false, error: 'ID Rencana tidak boleh kosong.' },
        { status: 400 }
      );
    }

    const normMcid = normalizeMcid(payload.mcid);
    if (!normMcid) {
      return NextResponse.json(
        { success: false, error: 'MCID (Machine ID) wajib diisi.' },
        { status: 400 }
      );
    }

    await queryD1(
      `UPDATE installation_plans
       SET mcid = ?,
           machine_model = ?,
           location = ?,
           target_date = ?,
           notes = ?,
           status = COALESCE(?, status)
       WHERE id = ?`,
      [
        normMcid,
        payload.machineModel?.trim() || '',
        payload.location?.trim() || '',
        payload.targetDate?.trim() || '',
        payload.notes?.trim() || '',
        payload.status || null,
        payload.id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Rencana pemasangan untuk mesin [${normMcid}] berhasil diperbarui.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
