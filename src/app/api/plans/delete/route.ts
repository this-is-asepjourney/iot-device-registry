import { NextResponse } from 'next/server';
import { queryD1 } from '@/lib/d1';
import { DeletePlanPayload } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload: DeletePlanPayload = await request.json();

    if (!payload.id) {
      return NextResponse.json(
        { success: false, error: 'ID Rencana tidak boleh kosong.' },
        { status: 400 }
      );
    }

    await queryD1('DELETE FROM installation_plans WHERE id = ?', [payload.id]);

    return NextResponse.json({
      success: true,
      message: 'Rencana pemasangan berhasil dihapus dari sistem.',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
