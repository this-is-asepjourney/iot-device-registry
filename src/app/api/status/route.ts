import { NextResponse } from 'next/server';
import { isCloudflareD1Configured, resetLocalDatabase } from '@/lib/d1';

export async function GET() {
  return NextResponse.json({
    success: true,
    isCloudflareRemote: isCloudflareD1Configured,
    engine: isCloudflareD1Configured ? 'Cloudflare D1 Remote' : 'Local D1 SQLite Engine',
    databaseType: 'Cloudflare D1 SQLite',
  });
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
