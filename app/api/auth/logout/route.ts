import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth';

/**
 * POST /api/auth/logout
 * Invalidates current session and clears session cookie
 */
export async function POST(request: NextRequest) {
  try {
    // Get session token from cookies
    const sessionToken = request.cookies.get('session')?.value;

    // Delete session from database if it exists
    if (sessionToken) {
      await deleteSession(sessionToken);
    }

    // Clear session cookie by setting maxAge to 0
    const response = NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    );

    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expires immediately
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error logging out user:', error);
    // Return success even if there's an error (as per acceptance criteria)
    const response = NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    );

    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  }
}
