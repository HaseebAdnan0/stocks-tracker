import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb, type User } from './db';

/**
 * Hashes a password using bcrypt with a salt
 * @param password - The plain text password to hash
 * @returns Promise resolving to the hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);
  return hash;
}

/**
 * Verifies a password against a hash
 * @param password - The plain text password to verify
 * @param hash - The hashed password to compare against
 * @returns Promise resolving to true if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const isValid = await bcrypt.compare(password, hash);
  return isValid;
}

/**
 * Creates a new session for a user with 7-day expiration
 * @param userId - The ID of the user to create a session for
 * @returns Promise resolving to the session token
 */
export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  const db = getDb();
  const stmt = db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)');
  stmt.run(userId, token, expiresAt.toISOString());

  return token;
}

/**
 * Validates a session token and returns the associated user
 * @param token - The session token to validate
 * @returns Promise resolving to the user object or null if invalid/expired
 */
export async function validateSession(token: string): Promise<User | null> {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT u.* FROM users u
    INNER JOIN sessions s ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `);

  const user = stmt.get(token) as User | undefined;
  return user || null;
}

/**
 * Deletes a session (logout)
 * @param token - The session token to delete
 * @returns Promise resolving when session is deleted
 */
export async function deleteSession(token: string): Promise<void> {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
  stmt.run(token);
}
