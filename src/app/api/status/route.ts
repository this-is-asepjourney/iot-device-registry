import { NextResponse } from 'next/server';
import { cachedQueryD1, resetLocalDatabase, getD1PerformanceMetrics, invalidateD1Cache } from '@/lib/d1';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  try {
    // Ping with 30s TTL cache: prevents hammering D1 with ping checks
    await cachedQueryD1('d1_ping_check', 'SELECT 1 as ping;', [], 30);
    const latencyMs = Date.now() - startTime;
    const metrics = getD1PerformanceMetrics();

    return NextResponse.json({
      success: true,
      connected: true,
      syncStatus: 'synced',
      latencyMs,
      timestamp: new Date().toISOString(),
      metrics,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        connected: false,
        syncStatus: 'disconnected',
        error: msg,
        metrics: getD1PerformanceMetrics(),
      },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    let body: { action?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is okay for reset
    }

    if (body.action === 'clear_cache') {
      invalidateD1Cache();
      return NextResponse.json({
        success: true,
        message: 'Cache memori D1 berhasil dibersihkan (Flushed). Pembacaan berikutnya akan langsung mengambil data terbaru.',
        metrics: getD1PerformanceMetrics(),
      });
    }

    resetLocalDatabase();
    return NextResponse.json({ success: true, message: 'Database reset successfully.' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
