import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/middleware';

/**
 * GET /api/auth/me
 * Returns current authenticated user or 401 if not authenticated
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Return user info without password_hash
    return NextResponse.json({
      id: user.id,
      username: user.username,
      created_at: user.created_at,
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
