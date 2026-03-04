import { NextResponse } from 'next/server';
import { clearAllCaches } from '@/lib/db';

export async function POST() {
  try {
    const deletedCounts = clearAllCaches();

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
      deleted_counts: deletedCounts,
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
