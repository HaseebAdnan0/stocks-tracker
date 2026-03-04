import { NextRequest } from 'next/server';
import { validateSession } from './auth';
import { type User } from './db';

/**
 * Gets the current authenticated user from the request
 * @param request - The Next.js request object
 * @returns Promise resolving to the user object or null if not authenticated
 */
export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  // Read session token from cookies
  const token = request.cookies.get('session')?.value;

  if (!token) {
    return null;
  }

  // Validate session and return user
  const user = await validateSession(token);
  return user;
}
