import { NextResponse } from 'next/server';
import { createUser, getUserByUsername } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';

/**
 * POST /api/auth/register
 * Creates a new user account and returns a session token
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    const { username, password } = body;
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Validate username (3-20 chars, alphanumeric)
    const usernameStr = String(username).trim();
    if (usernameStr.length < 3 || usernameStr.length > 20) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 20 characters' },
        { status: 400 }
      );
    }
    if (!/^[a-zA-Z0-9]+$/.test(usernameStr)) {
      return NextResponse.json(
        { error: 'Username must contain only alphanumeric characters' },
        { status: 400 }
      );
    }

    // Validate password (min 6 chars)
    const passwordStr = String(password);
    if (passwordStr.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUser = getUserByUsername(usernameStr);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 409 }
      );
    }

    // Hash password and create user
    const passwordHash = await hashPassword(passwordStr);
    const user = createUser(usernameStr, passwordHash);

    // Create session
    const sessionToken = await createSession(user.id);

    // Set session cookie (HTTP-only, secure in production)
    const response = NextResponse.json(
      {
        id: user.id,
        username: user.username,
        created_at: user.created_at,
      },
      { status: 201 }
    );

    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
