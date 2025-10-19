/**
 * Clerk Authentication Middleware
 * Validates JWT tokens and extracts user information
 */

import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { verify } from 'hono/jwt';

interface ClerkPayload {
  sub: string; // User ID
  iss: string; // Issuer
  aud: string; // Audience
  exp: number; // Expiry
  iat: number; // Issued at
  email?: string;
  name?: string;
}

/**
 * Middleware to authenticate requests using Clerk JWT tokens
 */
export const clerkAuth = () => createMiddleware<{
  Bindings: {
    CLERK_PUBLISHABLE_KEY: string;
    CLERK_SECRET_KEY: string;
    DB: D1Database;
  };
  Variables: {
    userId: string;
    clerkUser: ClerkPayload;
  };
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  
  if (token === 'mock-token') {
    // Development mode - allow mock token
    if (c.env.CLERK_SECRET_KEY === 'mock-development') {
      c.set('userId', 'mock-user-id');
      c.set('clerkUser', {
        sub: 'mock-user-id',
        iss: 'mock',
        aud: 'mock',
        exp: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        email: 'test@example.com',
        name: 'Test User'
      });
      return await next();
    }
  }

  try {
    // Verify JWT token with Clerk's public key
    // In production, you'd fetch Clerk's JWKS and verify properly
    // For now, we'll do basic JWT verification with the secret
    const payload = await verify(token, c.env.CLERK_SECRET_KEY) as ClerkPayload;
    
    // Check if token is expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      throw new HTTPException(401, { message: 'Token expired' });
    }

    // Ensure user exists in our database
    await ensureUserExists(c.env.DB, payload);

    // Set user context for downstream handlers
    c.set('userId', payload.sub);
    c.set('clerkUser', payload);

    await next();
  } catch (error) {
    console.error('Auth error:', error);
    throw new HTTPException(401, { message: 'Invalid or expired token' });
  }
});

/**
 * Ensure user exists in our database (sync with Clerk)
 */
async function ensureUserExists(db: D1Database, clerkUser: ClerkPayload) {
  try {
    const existingUser = await db.prepare(`
      SELECT id FROM users WHERE clerk_user_id = ?
    `).bind(clerkUser.sub).first();

    if (!existingUser) {
      // Create user record
      await db.prepare(`
        INSERT INTO users (id, clerk_user_id, email, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        clerkUser.sub,
        clerkUser.sub,
        clerkUser.email || '',
        clerkUser.name || ''
      ).run();
    } else {
      // Update user info if changed
      await db.prepare(`
        UPDATE users 
        SET email = ?, name = ?, updated_at = datetime('now')
        WHERE clerk_user_id = ?
      `).bind(
        clerkUser.email || '',
        clerkUser.name || '',
        clerkUser.sub
      ).run();
    }
  } catch (error) {
    console.error('Error syncing user:', error);
    // Don't fail auth if user sync fails
  }
}

/**
 * Optional auth middleware - doesn't fail if no token provided
 */
export const optionalAuth = () => createMiddleware<{
  Bindings: {
    CLERK_PUBLISHABLE_KEY: string;
    CLERK_SECRET_KEY: string;
    DB: D1Database;
  };
  Variables: {
    userId?: string;
    clerkUser?: ClerkPayload;
  };
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return await next();
  }

  try {
    const token = authHeader.slice(7);
    const payload = await verify(token, c.env.CLERK_SECRET_KEY) as ClerkPayload;
    
    if (payload.exp && payload.exp >= Date.now() / 1000) {
      await ensureUserExists(c.env.DB, payload);
      c.set('userId', payload.sub);
      c.set('clerkUser', payload);
    }
  } catch (error) {
    // Ignore auth errors for optional auth
  }

  await next();
});