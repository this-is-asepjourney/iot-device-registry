import { NextResponse } from 'next/server';
import { queryD1, resetLocalDatabase } from '@/lib/d1';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  try {
    // Ping database query to verify live connectivity and synchronization
    await queryD1('SELECT 1 as ping;');
    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      connected: true,
      syncStatus: 'synced',
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        connected: false,
        syncStatus: 'disconnected',
        error: msg,
      },
      { status: 503 }
    );
  }
}

export async function POST() {
  try {
    resetLocalDatabase();
    return NextResponse.json({ success: true, message: 'Database reset successfully.' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
